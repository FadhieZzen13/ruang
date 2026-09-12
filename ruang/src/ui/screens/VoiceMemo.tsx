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
import { findConflict, rebalance, expandRecurring } from '../../domain/scheduling'
import { DAY_LABEL, type Day, type Recurrence } from '../../domain/types'

type Phase = 'idle' | 'recording' | 'thinking' | 'propose'
const DURATION = 60 // new memos become a 60-min block

interface Plan {
  action: ActionKind
  source: 'agent' | 'offline'
  title: string
  day: Day
  start: number
  end: number
  targetId: string | null
  busy: boolean
  moveTo: { day: Day; start: number } | null
  // user-supplied details gathered AFTER the agent's first pass:
  description: string
  recurrence: Recurrence
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
      const p = parseMemo(raw) // offline fallback = always a create
      setPlan(
        planFromAction(
          { action: 'create', title: p.title, day: p.day, time: p.time, targetId: null },
          'offline',
        ),
      )
    }
    setPhase('propose')
  }

  // Turn an agent action into a concrete, displayable plan against the week.
  function planFromAction(
    a: { action: ActionKind; title: string; day: Day | null; time: number | null; targetId: string | null },
    source: 'agent' | 'offline',
  ): Plan {
    const target = a.targetId ? getActivities().find((x) => x.id === a.targetId) : undefined

    if (a.action === 'cancel' && target) {
      return {
        action: 'cancel', source, title: target.title, day: target.day,
        start: target.start, end: target.end, targetId: target.id, busy: false, moveTo: null,
        description: target.description, recurrence: target.recurrence,
      }
    }
    if (a.action === 'move' && target) {
      const day = a.day ?? target.day
      const start = a.time ?? target.start
      const dur = target.end - target.start
      return {
        action: 'move', source, title: target.title, day,
        start, end: start + dur, targetId: target.id, busy: false, moveTo: null,
        description: target.description, recurrence: target.recurrence,
      }
    }
    // create
    const day = a.day ?? 'mon'
    const start = a.time ?? 9 * 60
    const { busy } = findConflict(getActivities(), day, start, start + DURATION)
    return {
      action: 'create', source, title: a.title, day, start, end: start + DURATION,
      targetId: null, busy, moveTo: busy ? rebalance(getActivities(), day, start, DURATION) : null,
      description: '', recurrence: 'once',
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

  const confirm = () => {
    if (!plan) return
    if (plan.action === 'cancel' && plan.targetId) {
      removeActivity(plan.targetId)
    } else if (plan.action === 'move' && plan.targetId) {
      moveActivity(plan.targetId, plan.day, plan.start, plan.end)
    } else {
      // create — apply the rebalance if the slot was busy
      const day = plan.moveTo ? plan.moveTo.day : plan.day
      const start = plan.moveTo ? plan.moveTo.start : plan.start
      const entries = expandRecurring(
        {
          title: plan.title,
          day,
          start,
          end: start + DURATION,
          kind: 'activity',
          locked: false,
          description: plan.description,
          recurrence: plan.recurrence,
        },
        (_d, i) => `m${Date.now()}${i}`,
      )
      addActivities(entries)
    }
    reset()
  }

  return (
    <div className="voice-wrap">
      <div className="appbar" style={{ width: '100%' }}>
        <div>
          <div className="eyebrow">Voice memo</div>
          <h1>Dictate it</h1>
        </div>
      </div>

      <button
        className={`record-btn ${phase === 'recording' ? 'recording' : ''}`}
        onClick={phase === 'recording' ? stopMic : startMic}
        disabled={!speechOk || phase === 'thinking'}
        aria-label={phase === 'recording' ? 'Stop recording' : 'Record memo'}
      >
        {phase === 'recording' ? (
          <span className="bars"><span /><span /><span /><span /></span>
        ) : (
          '●'
        )}
      </button>

      <div className="mic-hint">
        {phase === 'recording'
          ? 'Listening — click to stop'
          : speechOk
            ? 'Click, speak, click to stop'
            : 'Mic not supported here — type below'}
      </div>

      <div className={`transcript ${text ? '' : 'dim'}`}>
        {phase === 'thinking' ? 'Thinking…' : text || '“move my gym to friday 6pm”'}
      </div>

      {error && <div className="error-line">{error}</div>}

      {phase === 'propose' && plan && (
        <PlanCard
          plan={plan}
          onChange={(patch) => setPlan((p) => (p ? { ...p, ...patch } : p))}
          onConfirm={confirm}
          onCancel={reset}
        />
      )}

      {phase !== 'propose' && phase !== 'thinking' && (
        <>
          <div className="type-row">
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
              placeholder="…or type a memo"
            />
            <button className="btn btn-primary" onClick={submitTyped} disabled={!typed.trim()}>
              Add
            </button>
          </div>
          <div className="trustline">It proposes, you decide. Nothing moves on its own.</div>
        </>
      )}
    </div>
  )
}

function PlanCard({
  plan,
  onChange,
  onConfirm,
  onCancel,
}: {
  plan: Plan
  onChange: (patch: Partial<Plan>) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const verb = plan.action === 'cancel' ? 'Cancel' : plan.action === 'move' ? 'Move' : 'Add'
  const cta =
    plan.action === 'cancel'
      ? 'Cancel it'
      : plan.action === 'move'
        ? 'Move it'
        : plan.busy && plan.moveTo
          ? 'Move & add'
          : 'Add to week'

  return (
    <div className="propose">
      <div className="card">
        <div className="eyebrow">{plan.action === 'create' ? 'I heard' : `${verb}`}</div>

        {plan.action === 'create' ? (
          <input
            className="add-input"
            value={plan.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label="Title"
          />
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 2 }}>
            {plan.title}
          </div>
        )}

        {plan.action !== 'cancel' && (
          <div className="chip-time" style={{ marginTop: 4 }}>
            {plan.action === 'move' ? '→ ' : ''}
            {DAY_LABEL[plan.day]} · {fmt(plan.start)}
          </div>
        )}
        {plan.action === 'cancel' && (
          <div className="chip-time" style={{ marginTop: 4 }}>
            {DAY_LABEL[plan.day]} · {fmt(plan.start)} — removing this
          </div>
        )}
        {plan.action === 'create' && plan.busy && (
          <div className="conflict">
            That slot's packed — I'd move it to {plan.moveTo ? DAY_LABEL[plan.moveTo.day] : 'a later day'}
            {plan.moveTo ? ` at ${fmt(plan.moveTo.start)}` : ''}.
          </div>
        )}

        {plan.action === 'create' && (
          <div className="details">
            <input
              className="add-input"
              value={plan.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Add a note… (optional)"
              aria-label="Description"
            />
            <button
              className={`recur-toggle ${plan.recurrence === 'weekly' ? 'on' : ''}`}
              onClick={() => onChange({ recurrence: plan.recurrence === 'weekly' ? 'once' : 'weekly' })}
              aria-pressed={plan.recurrence === 'weekly'}
            >
              <span className="recur-icon" aria-hidden>↻</span>
              {plan.recurrence === 'weekly' ? 'Repeats weekly' : 'One-time · tap to repeat weekly'}
            </button>
          </div>
        )}

        <span className={`badge ${plan.source === 'agent' ? '' : 'heuristic'}`}>
          {plan.source === 'agent' ? 'Agent' : 'Offline parse'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary" style={{ flex: 2 }} onClick={onConfirm}>
          {cta}
        </button>
      </div>
    </div>
  )
}
