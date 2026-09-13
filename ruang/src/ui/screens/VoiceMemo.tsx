import { useRef, useState, type ReactNode } from 'react'
import { startListening, isSpeechSupported, type SpeechController } from '../../app/speech'
import { proposeAction, hasAgent, type ActionKind, type ScheduleLite } from '../../app/agent'
import { speak, stopSpeaking, isMuted, setMuted, ttsSupported } from '../../app/tts'
import {
  addActivities,
  moveActivity,
  removeActivity,
  getActivities,
  fmt,
} from '../../app/store'
import { parseMemo } from '../../domain/memo'
import { isPlanRequest, parseRequest } from '../../domain/plan-parse'
import { setPlanDraft } from '../../app/plan-draft'
import { negotiate, expandRecurring, type Negotiation, type ResolveOption } from '../../domain/scheduling'
import { DAY_LABEL, type Day, type Recurrence } from '../../domain/types'

type Phase = 'idle' | 'recording' | 'thinking' | 'clarify' | 'propose'
const DURATION = 60

interface Plan {
  action: ActionKind
  source: 'agent' | 'offline'
  provider?: string
  title: string
  day: Day
  start: number
  end: number
  targetId: string | null
  fromLabel: string | null
  description: string
  recurrence: Recurrence
  negotiation: Negotiation | null
}

type RawAction = { action: ActionKind; title: string; day: Day | null; time: number | null; targetId: string | null; provider?: string }

function liteSchedule(): ScheduleLite[] {
  return getActivities().map((a) => ({ id: a.id, title: a.title, day: a.day, start: a.start }))
}

export function VoiceMemo({ onPlan }: { onPlan?: () => void } = {}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [muted, setMutedState] = useState(isMuted())
  // Conversation state — what Ruang asked and the running context to build on.
  const [question, setQuestion] = useState('')
  const [clarifyText, setClarifyText] = useState('')
  const [clarifyMode, setClarifyMode] = useState<'missing' | 'custom'>('missing')
  const context = useRef('') // accumulated transcript across turns
  const controller = useRef<SpeechController | null>(null)

  const speechOk = isSpeechSupported()

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const listen = (onFinal: (t: string) => void) => {
    setError('')
    const c = startListening({
      onInterim: setText,
      onFinal: (t) => (t ? onFinal(t) : setPhase((p) => (p === 'recording' ? 'idle' : p))),
      onError: (msg) => {
        setError(msg)
        setPhase('idle')
      },
    })
    if (!c) {
      setError('Speech recognition unavailable — type it instead.')
      return false
    }
    controller.current = c
    setPhase('recording')
    return true
  }

  const startMic = () => {
    stopSpeaking()
    setText('')
    setPlan(null)
    listen(understand)
  }

  const stopMic = () => controller.current?.stop()

  // Core loop: understand the running transcript, then either ASK for a missing
  // piece (day/time) or propose. Requires all three — activity + day + time.
  const understand = async (fullText: string) => {
    setText(fullText)
    setPhase('thinking')
    setError('')

    // "plan the lab report due friday" is a different kind of ask: it wants a
    // whole schedule, not one block. Deadline is the only thing worth stopping
    // for — size and pace have defaults you can change on the proposal.
    if (isPlanRequest(fullText)) {
      const req = parseRequest(fullText)
      if (!req.deadline) {
        context.current = fullText
        setClarifyMode('missing')
        const q = `When's ${req.title ? `the ${req.title.toLowerCase()}` : 'it'} due?`
        setQuestion(q)
        setPhase('clarify')
        speak(q)
        return
      }
      setPlanDraft({
        title: req.title || 'New task',
        deadline: req.deadline,
        minutes: req.minutes ?? 240,
        pace: req.pace ?? 'relaxed',
      })
      reset()
      onPlan?.()
      return
    }

    let a: RawAction
    let source: 'agent' | 'offline' = 'agent'
    try {
      if (!hasAgent()) throw new Error('no agent')
      a = await proposeAction(fullText, liteSchedule())
    } catch {
      const p = parseMemo(fullText)
      a = { action: 'create', title: p.title, day: p.day, time: p.time, targetId: null }
      source = 'offline'
    }

    // For a NEW thing, we need a day AND a time. If either is missing, ask —
    // don't silently default.
    if (a.action === 'create' && (a.day == null || a.time == null)) {
      context.current = fullText
      setClarifyMode('missing')
      const q = missingQuestion(a)
      setQuestion(q)
      setPhase('clarify')
      speak(q)
      return
    }

    const pl = planFromAction(a, source)
    setPlan(pl)
    setPhase('propose')
    speak(spoken(pl))
  }

  // The user answered a question (missing info, or a custom "something else").
  const answer = (reply: string) => {
    setClarifyText('')
    const combined =
      clarifyMode === 'custom'
        ? `${context.current}. Actually, I want: ${reply}`
        : `${context.current} ${reply}`
    understand(combined.trim())
  }

  function planFromAction(a: RawAction, source: 'agent' | 'offline'): Plan {
    const base = {
      targetId: null as string | null, fromLabel: null as string | null,
      description: '', recurrence: 'once' as Recurrence, negotiation: null as Negotiation | null,
      provider: a.provider,
    }
    const target = a.targetId ? getActivities().find((x) => x.id === a.targetId) : undefined

    if (a.action === 'cancel' && target) {
      return { ...base, action: 'cancel', source, title: target.title, day: target.day, start: target.start, end: target.end, targetId: target.id, description: target.description, recurrence: target.recurrence }
    }
    if (a.action === 'move' && target) {
      const day = a.day ?? target.day
      const start = a.time ?? target.start
      const dur = target.end - target.start
      return { ...base, action: 'move', source, title: target.title, day, start, end: start + dur, targetId: target.id, fromLabel: `${DAY_LABEL[target.day]} ${fmt(target.start)}`, description: target.description, recurrence: target.recurrence }
    }
    const day = a.day ?? 'mon'
    const start = a.time ?? 9 * 60
    return { ...base, action: 'create', source, title: a.title, day, start, end: start + DURATION, negotiation: negotiate(getActivities(), day, start, DURATION) }
  }

  const submitTyped = () => {
    const t = typed.trim()
    if (t) {
      setTyped('')
      stopSpeaking()
      understand(t)
    }
  }

  const reset = () => {
    stopSpeaking()
    setPhase('idle')
    setText('')
    setPlan(null)
    setError('')
    context.current = ''
  }

  const placeNew = (p: Plan, day: Day, start: number) => {
    const entries = expandRecurring(
      { title: p.title, day, start, end: start + DURATION, kind: 'activity', locked: false, description: p.description, recurrence: p.recurrence },
      (_d, i) => `m${Date.now()}${i}`,
    )
    addActivities(entries)
  }

  const applyOption = (opt: ResolveOption) => {
    if (!plan) return
    if (opt.kind === 'skip') return reset()
    if (opt.kind === 'move-existing') {
      moveActivity(opt.id, opt.toDay, opt.toStart, opt.toEnd)
      placeNew(plan, plan.day, plan.start)
    } else {
      placeNew(plan, opt.day, opt.start)
    }
    reset()
  }

  const confirmSimple = () => {
    if (!plan) return
    if (plan.action === 'cancel' && plan.targetId) removeActivity(plan.targetId)
    else if (plan.action === 'move' && plan.targetId) moveActivity(plan.targetId, plan.day, plan.start, plan.end)
    reset()
  }

  // "Something else…" — the user wants to say what they'd rather do.
  const startCustom = () => {
    stopSpeaking()
    context.current = text
    setClarifyMode('custom')
    const q = 'Sure — what would you rather do?'
    setQuestion(q)
    setClarifyText('')
    setPhase('clarify')
    speak(q)
  }

  const patch = (p: Partial<Plan>) => setPlan((cur) => (cur ? { ...cur, ...p } : cur))

  const muteBtn = ttsSupported() ? (
    <button
      className={`mute-btn ${muted ? 'off' : 'on'}`}
      onClick={toggleMute}
      aria-label={muted ? 'Turn voice on' : 'Turn voice off'}
      title={muted ? 'Voice off' : 'Voice on'}
    >
      <SpeakerIcon muted={muted} />
    </button>
  ) : null

  if (phase === 'recording') {
    return (
      <div className="voice-listen">
        <div className="listen-text">{text || 'Listening…'}</div>
        <button className="waveform" onClick={stopMic} aria-label="Stop recording">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} style={{ animationDelay: `${(i % 12) * 0.07}s` }} />
          ))}
        </button>
        <div className="listen-hint">Tap to stop</div>
      </div>
    )
  }

  if (phase === 'thinking') {
    return (
      <div className="voice-listen">
        <div className="listen-quote">“{text}”</div>
        <div className="listen-text thinking">Checking your week…</div>
      </div>
    )
  }

  // Ruang asked a question — answer by voice or type.
  if (phase === 'clarify') {
    return (
      <div className="clarify">
        {muteBtn}
        <div className="clarify-q">{question}</div>
        <button className="record-btn small" onClick={() => listen(answer)} disabled={!speechOk} aria-label="Answer by voice">
          <MicIcon />
        </button>
        <div className="type-row">
          <input
            value={clarifyText}
            onChange={(e) => setClarifyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && clarifyText.trim() && answer(clarifyText.trim())}
            placeholder="…or type your answer"
            autoFocus
          />
          <button className="btn btn-primary" onClick={() => clarifyText.trim() && answer(clarifyText.trim())} disabled={!clarifyText.trim()}>
            Reply
          </button>
        </div>
        {error && <div className="error-line">{error}</div>}
        <button className="btn-link centered" onClick={reset}>Never mind</button>
      </div>
    )
  }

  if (phase === 'propose' && plan) {
    return (
      <Answer plan={plan} transcript={text} muteBtn={muteBtn} onPatch={patch} onApply={applyOption} onConfirmSimple={confirmSimple} onCustom={startCustom} onCancel={reset} />
    )
  }

  return (
    <div className="voice-idle">
      {muteBtn}
      <div className="voice-hero">
        <button className="record-btn" onClick={startMic} disabled={!speechOk} aria-label="Record memo">
          <MicIcon />
        </button>
        <div className="voice-lead">{speechOk ? 'Tap and just say it' : 'Mic not available here'}</div>
        <div className="voice-sub">
          {speechOk ? '“Bro ajak futsal Jumat malam. Bisa gak?”' : 'Type your memo below instead'}
        </div>
      </div>

      {error && <div className="error-line">{error}</div>}

      <div className="type-row">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitTyped()} placeholder="…or type a memo" />
        <button className="btn btn-primary" onClick={submitTyped} disabled={!typed.trim()}>Ask</button>
      </div>
      <div className="trustline">It checks your week, then you decide. Nothing moves on its own.</div>
    </div>
  )
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {muted ? (
        <path d="M22 9l-6 6M16 9l6 6" />
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
      )}
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  )
}

function Answer({
  plan, transcript, muteBtn, onPatch, onApply, onConfirmSimple, onCustom, onCancel,
}: {
  plan: Plan
  transcript: string
  muteBtn: ReactNode
  onPatch: (p: Partial<Plan>) => void
  onApply: (opt: ResolveOption) => void
  onConfirmSimple: () => void
  onCustom: () => void
  onCancel: () => void
}) {
  const neg = plan.negotiation
  const isCreate = plan.action === 'create'
  const free = !!neg?.free

  return (
    <div className="answer">
      {muteBtn}
      {transcript && <div className="answer-quote">“{transcript}”</div>}
      <div className="answer-verdict">{verdict(plan)}</div>
      <div className="answer-source">{plan.source === 'agent' ? `via ${plan.provider ?? 'agent'}` : 'offline parser'}</div>

      {!isCreate && (
        <>
          {plan.action === 'move' && plan.fromLabel && (
            <div className="moves">
              <div className="moves-label">What moves</div>
              <div className="moves-row">
                <span className="moves-title">{plan.title}</span>
                <span className="moves-shift">{plan.fromLabel} <span className="arrow">→</span> {DAY_LABEL[plan.day]} {fmt(plan.start)}</span>
              </div>
            </div>
          )}
          <div className="answer-actions">
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={onConfirmSimple}>{plan.action === 'cancel' ? 'Cancel it' : 'Move it'}</button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel}>{plan.action === 'cancel' ? 'Keep it' : 'Skip it'}</button>
          </div>
          <button className="btn-link centered" onClick={onCustom}>Something else…</button>
        </>
      )}

      {isCreate && (
        <div className="answer-details">
          <input className="note-input" value={plan.description} onChange={(e) => onPatch({ description: e.target.value })} placeholder="Add a note… (optional)" aria-label="Description" />
          <button className={`recur-toggle ${plan.recurrence === 'weekly' ? 'on' : ''}`} onClick={() => onPatch({ recurrence: plan.recurrence === 'weekly' ? 'once' : 'weekly' })} aria-pressed={plan.recurrence === 'weekly'}>
            <span className="recur-icon" aria-hidden>↻</span>
            {plan.recurrence === 'weekly' ? 'Repeats weekly' : 'Repeat weekly?'}
          </button>
        </div>
      )}

      {isCreate && free && neg && (
        <>
          <div className="answer-actions">
            <button className="btn btn-sage btn-block" onClick={() => onApply(neg.options[0]!)}>Add it</button>
          </div>
          <button className="btn-link centered" onClick={onCustom}>Something else…</button>
        </>
      )}

      {isCreate && neg && !free && (
        <>
          <div className="neg-label">How do you want to handle it?</div>
          <div className="neg-options">
            {neg.options.map((opt, i) => (
              <OptionRow key={i} opt={opt} newTitle={plan.title} requested={`${DAY_LABEL[plan.day]} ${fmt(plan.start)}`} onPick={() => onApply(opt)} />
            ))}
            <button className="neg-option custom" onClick={onCustom}>
              <span className="neg-title">Something else…</span>
              <span className="neg-sub">tell me what you'd rather do</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function OptionRow({ opt, newTitle, requested, onPick }: { opt: ResolveOption; newTitle: string; requested: string; onPick: () => void }) {
  if (opt.kind === 'skip') {
    return <button className="neg-option skip" onClick={onPick}><span className="neg-title">Skip it</span><span className="neg-sub">leave your week as is</span></button>
  }
  if (opt.kind === 'move-existing') {
    return <button className="neg-option" onClick={onPick}><span className="neg-title">Move {opt.title}</span><span className="neg-sub">→ {DAY_LABEL[opt.toDay]} {fmt(opt.toStart)} · keep {newTitle} at {requested}</span></button>
  }
  if (opt.label === 'move-new') {
    return <button className="neg-option" onClick={onPick}><span className="neg-title">Put {newTitle} at a free slot</span><span className="neg-sub">→ {DAY_LABEL[opt.day]} {fmt(opt.start)}</span></button>
  }
  return <button className="neg-option" onClick={onPick}><span className="neg-title">Keep both anyway</span><span className="neg-sub">double-book {requested}</span></button>
}

// What to ask when a create is missing pieces.
function missingQuestion(a: RawAction): string {
  const title = a.title && a.title !== 'New activity' ? a.title : 'that'
  const noDay = a.day == null
  const noTime = a.time == null
  if (noDay && noTime) return `Sure — which day and what time for ${title}?`
  if (noDay) return `What day should I put ${title}?`
  return `What time on ${DAY_LABEL[a.day!]} for ${title}?`
}

function verdict(plan: Plan): string {
  const at = `${DAY_LABEL[plan.day]} ${fmt(plan.start)}`
  if (plan.action === 'cancel') return `Clear ${plan.title} off your ${DAY_LABEL[plan.day]}?`
  if (plan.action === 'move') return `Move ${plan.title} to ${at}?`
  const neg = plan.negotiation!
  if (neg.free) return `${DAY_LABEL[plan.day]}'s clear. ${plan.title} goes in at ${fmt(plan.start)}.`
  const names = neg.conflicts.map((c) => c.title).join(' and ')
  const lockedNote = neg.locked.length ? ` ${neg.locked.map((c) => c.title).join(', ')} can't move.` : ''
  return `${at} clashes with ${names}.${lockedNote}`
}

// A slightly more spoken version for TTS.
function spoken(plan: Plan): string {
  if (plan.action === 'cancel') return `Want me to clear ${plan.title}?`
  if (plan.action === 'move') return `Moving ${plan.title} to ${DAY_LABEL[plan.day]} ${fmt(plan.start)}?`
  const neg = plan.negotiation!
  if (neg.free) return `${DAY_LABEL[plan.day]} is clear. I'll add ${plan.title} at ${fmt(plan.start)}.`
  return `${DAY_LABEL[plan.day]} ${fmt(plan.start)} clashes with ${neg.conflicts.map((c) => c.title).join(' and ')}. How do you want to handle it?`
}
