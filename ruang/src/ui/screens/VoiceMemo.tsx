import { useRef, useState } from 'react'
import { startListening, isSpeechSupported, type SpeechController } from '../../app/speech'
import { proposeAction, hasAgent, type ActionKind, type ScheduleLite } from '../../app/agent'
import {
  addActivities,
  moveActivity,
  removeActivity,
  getActivities,
  fmt,
} from '../../app/store'
import { parseMemo } from '../../domain/memo'
import { negotiate, expandRecurring, type Negotiation, type ResolveOption } from '../../domain/scheduling'
import { DAY_LABEL, type Day, type Recurrence } from '../../domain/types'

type Phase = 'idle' | 'recording' | 'thinking' | 'propose'
const DURATION = 60

interface Plan {
  action: ActionKind
  source: 'agent' | 'offline'
  title: string
  day: Day
  start: number
  end: number
  targetId: string | null
  fromLabel: string | null
  description: string
  recurrence: Recurrence
  negotiation: Negotiation | null // create only — the calendar check + choices
}

function liteSchedule(): ScheduleLite[] {
  return getActivities().map((a) => ({ id: a.id, title: a.title, day: a.day, start: a.start }))
}

export function VoiceMemo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [text, setText] = useState('')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const controller = useRef<SpeechController | null>(null)

  const speechOk = isSpeechSupported()

  const startMic = () => {
    setError('')
    setText('')
    setPlan(null)
    const c = startListening({
      onInterim: setText,
      onFinal: (t) => (t ? understand(t) : setPhase('idle')),
      onError: (msg) => {
        setError(msg)
        setPhase('idle')
      },
    })
    if (!c) {
      setError('Speech recognition unavailable — type it below instead.')
      return
    }
    controller.current = c
    setPhase('recording')
  }

  const stopMic = () => controller.current?.stop()

  const understand = async (raw: string) => {
    setText(raw)
    setPhase('thinking')
    setError('')
    try {
      if (!hasAgent()) throw new Error('no agent')
      const a = await proposeAction(raw, liteSchedule())
      setPlan(planFromAction(a, 'agent'))
    } catch {
      const p = parseMemo(raw)
      setPlan(
        planFromAction(
          { action: 'create', title: p.title, day: p.day, time: p.time, targetId: null },
          'offline',
        ),
      )
    }
    setPhase('propose')
  }

  function planFromAction(
    a: { action: ActionKind; title: string; day: Day | null; time: number | null; targetId: string | null },
    source: 'agent' | 'offline',
  ): Plan {
    const base = {
      targetId: null as string | null, fromLabel: null as string | null,
      description: '', recurrence: 'once' as Recurrence, negotiation: null as Negotiation | null,
    }
    const target = a.targetId ? getActivities().find((x) => x.id === a.targetId) : undefined

    if (a.action === 'cancel' && target) {
      return {
        ...base, action: 'cancel', source, title: target.title, day: target.day,
        start: target.start, end: target.end, targetId: target.id,
        description: target.description, recurrence: target.recurrence,
      }
    }
    if (a.action === 'move' && target) {
      const day = a.day ?? target.day
      const start = a.time ?? target.start
      const dur = target.end - target.start
      return {
        ...base, action: 'move', source, title: target.title, day,
        start, end: start + dur, targetId: target.id,
        fromLabel: `${DAY_LABEL[target.day]} ${fmt(target.start)}`,
        description: target.description, recurrence: target.recurrence,
      }
    }
    // create — check the calendar and lay out the choices
    const day = a.day ?? 'mon'
    const start = a.time ?? 9 * 60
    return {
      ...base, action: 'create', source, title: a.title, day, start, end: start + DURATION,
      negotiation: negotiate(getActivities(), day, start, DURATION),
    }
  }

  const submitTyped = () => {
    const t = typed.trim()
    if (t) {
      setTyped('')
      understand(t)
    }
  }

  const reset = () => {
    setPhase('idle')
    setText('')
    setPlan(null)
    setError('')
  }

  // Put the new activity at a chosen slot (respects note + weekly repeat).
  const placeNew = (p: Plan, day: Day, start: number) => {
    const entries = expandRecurring(
      {
        title: p.title, day, start, end: start + DURATION,
        kind: 'activity', locked: false, description: p.description, recurrence: p.recurrence,
      },
      (_d, i) => `m${Date.now()}${i}`,
    )
    addActivities(entries)
  }

  // The user picked how to resolve a create clash.
  const applyOption = (opt: ResolveOption) => {
    if (!plan) return
    if (opt.kind === 'skip') return reset()
    if (opt.kind === 'move-existing') {
      moveActivity(opt.id, opt.toDay, opt.toStart, opt.toEnd) // clear the blocker…
      placeNew(plan, plan.day, plan.start) // …and keep the new thing where asked
    } else {
      placeNew(plan, opt.day, opt.start)
    }
    reset()
  }

  // move / cancel are explicit — no negotiation, just confirm.
  const confirmSimple = () => {
    if (!plan) return
    if (plan.action === 'cancel' && plan.targetId) removeActivity(plan.targetId)
    else if (plan.action === 'move' && plan.targetId) moveActivity(plan.targetId, plan.day, plan.start, plan.end)
    reset()
  }

  const patch = (p: Partial<Plan>) => setPlan((cur) => (cur ? { ...cur, ...p } : cur))

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

  if (phase === 'propose' && plan) {
    return (
      <Answer
        plan={plan}
        transcript={text}
        onPatch={patch}
        onApply={applyOption}
        onConfirmSimple={confirmSimple}
        onCancel={reset}
      />
    )
  }

  return (
    <div className="voice-idle">
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
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
          placeholder="…or type a memo"
        />
        <button className="btn btn-primary" onClick={submitTyped} disabled={!typed.trim()}>
          Ask
        </button>
      </div>
      <div className="trustline">It checks your week, then you decide. Nothing moves on its own.</div>
    </div>
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
  plan,
  transcript,
  onPatch,
  onApply,
  onConfirmSimple,
  onCancel,
}: {
  plan: Plan
  transcript: string
  onPatch: (p: Partial<Plan>) => void
  onApply: (opt: ResolveOption) => void
  onConfirmSimple: () => void
  onCancel: () => void
}) {
  const neg = plan.negotiation
  const isCreate = plan.action === 'create'
  const free = !!neg?.free

  return (
    <div className="answer">
      {transcript && <div className="answer-quote">“{transcript}”</div>}
      <div className="answer-verdict">{verdict(plan)}</div>

      {/* move / cancel — explicit, single confirm */}
      {!isCreate && (
        <>
          {plan.action === 'move' && plan.fromLabel && (
            <div className="moves">
              <div className="moves-label">What moves</div>
              <div className="moves-row">
                <span className="moves-title">{plan.title}</span>
                <span className="moves-shift">
                  {plan.fromLabel} <span className="arrow">→</span> {DAY_LABEL[plan.day]} {fmt(plan.start)}
                </span>
              </div>
            </div>
          )}
          <div className="answer-actions">
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={onConfirmSimple}>
              {plan.action === 'cancel' ? 'Cancel it' : 'Move it'}
            </button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel}>
              {plan.action === 'cancel' ? 'Keep it' : 'Skip it'}
            </button>
          </div>
        </>
      )}

      {/* create — note + weekly toggle apply to the new thing */}
      {isCreate && (
        <div className="answer-details">
          <input
            className="note-input"
            value={plan.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Add a note… (optional)"
            aria-label="Description"
          />
          <button
            className={`recur-toggle ${plan.recurrence === 'weekly' ? 'on' : ''}`}
            onClick={() => onPatch({ recurrence: plan.recurrence === 'weekly' ? 'once' : 'weekly' })}
            aria-pressed={plan.recurrence === 'weekly'}
          >
            <span className="recur-icon" aria-hidden>↻</span>
            {plan.recurrence === 'weekly' ? 'Repeats weekly' : 'Repeat weekly?'}
          </button>
        </div>
      )}

      {/* create + free — one green button */}
      {isCreate && free && neg && (
        <div className="answer-actions">
          <button className="btn btn-sage btn-block" onClick={() => onApply(neg.options[0]!)}>
            Add it
          </button>
        </div>
      )}

      {/* create + busy — negotiate: pick what happens */}
      {isCreate && neg && !free && (
        <>
          <div className="neg-label">How do you want to handle it?</div>
          <div className="neg-options">
            {neg.options.map((opt, i) => (
              <OptionRow key={i} opt={opt} newTitle={plan.title} requested={`${DAY_LABEL[plan.day]} ${fmt(plan.start)}`} onPick={() => onApply(opt)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OptionRow({
  opt,
  newTitle,
  requested,
  onPick,
}: {
  opt: ResolveOption
  newTitle: string
  requested: string
  onPick: () => void
}) {
  if (opt.kind === 'skip') {
    return (
      <button className="neg-option skip" onClick={onPick}>
        <span className="neg-title">Skip it</span>
        <span className="neg-sub">leave your week as is</span>
      </button>
    )
  }
  if (opt.kind === 'move-existing') {
    return (
      <button className="neg-option" onClick={onPick}>
        <span className="neg-title">Move {opt.title}</span>
        <span className="neg-sub">
          → {DAY_LABEL[opt.toDay]} {fmt(opt.toStart)} · keep {newTitle} at {requested}
        </span>
      </button>
    )
  }
  // place
  if (opt.label === 'move-new') {
    return (
      <button className="neg-option" onClick={onPick}>
        <span className="neg-title">Put {newTitle} at a free slot</span>
        <span className="neg-sub">→ {DAY_LABEL[opt.day]} {fmt(opt.start)}</span>
      </button>
    )
  }
  return (
    <button className="neg-option" onClick={onPick}>
      <span className="neg-title">Keep both anyway</span>
      <span className="neg-sub">double-book {requested}</span>
    </button>
  )
}

function verdict(plan: Plan): string {
  const at = `${DAY_LABEL[plan.day]} ${fmt(plan.start)}`
  if (plan.action === 'cancel') return `Clear ${plan.title} off your ${DAY_LABEL[plan.day]}?`
  if (plan.action === 'move') return `Move ${plan.title} to ${at}?`
  const neg = plan.negotiation!
  if (neg.free) return `${DAY_LABEL[plan.day]}'s clear. ${plan.title} goes in at ${fmt(plan.start)}.`
  const names = neg.conflicts.map((c) => c.title).join(' and ')
  const lockedNote = neg.locked.length
    ? ` ${neg.locked.map((c) => c.title).join(', ')} can't move.`
    : ''
  return `${at} clashes with ${names}.${lockedNote}`
}
