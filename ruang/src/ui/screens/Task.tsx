import { useEffect, useMemo, useRef, useState } from 'react'
import { fmt, getActivities, useAppState } from '../../app/store'
import { removeTask, saveTask, useTasks } from '../../app/tasks'
import { acceptPlan } from '../../app/plan-actions'
import { describeSessions } from '../../app/plan-agent'
import { downloadFile } from '../../app/download'
import { getGroups, publishPlan, sayToGroup, type BotGroup } from '../../app/bot'
import type { Task, TaskSession } from '../../domain/task'
import {
  fallbackSteps,
  hoursLabel,
  makeSession,
  planText,
  sessionFromSlot,
  totalPlannedMinutes,
} from '../../domain/task'
import { maxPerDayFor, planSessions, shapeFor, type DateSlot, type Pace } from '../../domain/planner'
import { busyOnDate, dateFromIso, isoDate, shortDateLabel, weekdayOfIso } from '../../domain/occurrence'
import { SHARE_PREFIX, encodePlan } from '../../domain/share-link'
import { takePlanDraft } from '../../app/plan-draft'
import { FromWhatsApp } from './FromWhatsApp'
import type { BotDraft } from '../../app/bot'
import { icsFilename, planToIcs, slugify } from '../../domain/ics'

type Phase = 'list' | 'capture' | 'pace' | 'propose' | 'shared'

const BUDGETS = [120, 240, 360, 480]

export function Task() {
  const { activities } = useAppState()
  const tasks = useTasks()
  const [phase, setPhase] = useState<Phase>('list')

  // Draft being built. Held here rather than in the store so nothing is saved
  // until the plan is accepted.
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [budget, setBudget] = useState(240)
  const [pace, setPace] = useState<Pace>('relaxed')
  const [sessions, setSessions] = useState<TaskSession[]>([])
  const [source, setSource] = useState<string>('offline')
  const [current, setCurrent] = useState<Task | null>(null)

  const today = useMemo(() => new Date(), [])
  const todayIso = isoDate(today)

  const reset = () => {
    setTitle('')
    setDeadline('')
    setBudget(240)
    setPace('relaxed')
    setSessions([])
    setCurrent(null)
    setSource('offline')
    setPhase('list')
  }

  // Voice may have handed us a request already understood ("plan the lab report
  // due friday"). Pick it up once and land straight on the proposed blocks.
  useEffect(() => {
    const draft = takePlanDraft()
    if (!draft) return
    setTitle(draft.title)
    setDeadline(draft.deadline)
    setBudget(draft.minutes)
    setPace(draft.pace)
    planNow(draft.title, draft.deadline, draft.minutes, draft.pace)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once, on arrival
  }, [])

  // Build the blocks. Takes its inputs explicitly so the Voice handoff can plan
  // in the same tick it fills the form, without waiting for state to settle.
  const planNow = (t: string, dl: string, mins: number, withPace: Pace) => {
    const days = Math.max(
      1,
      Math.round((dateFromIso(dl).getTime() - dateFromIso(todayIso).getTime()) / 86400000) + 1,
    )
    const shape = shapeFor(withPace, mins, days)
    const slots = planSessions({
      activities: getActivities(),
      from: today,
      deadline: dl,
      sessions: shape.sessions,
      minutes: shape.minutes,
      pace: withPace,
      maxPerDay: maxPerDayFor(withPace),
    })

    const steps = fallbackSteps(t, slots.length)
    setSessions(slots.map((s, i) => sessionFromSlot(s, steps[i] ?? 'Work on it')))
    setSource('offline')
    setPace(withPace)
    setPhase('propose')
    void fillNotes(slots, t, dl, mins, withPace)
  }

  const build = (withPace: Pace) => planNow(title, deadline, budget, withPace)

  // A draft Ruang built over WhatsApp, opened here. Its sessions come across as
  // they are — this is the same plan, not a re-plan — so what you saw in chat is
  // what you edit and accept.
  const openBotDraft = (d: BotDraft) => {
    setTitle(d.title)
    setDeadline(d.deadline ?? todayIso)
    setBudget(d.minutes)
    setPace(d.pace)
    setSessions(d.sessions.map((s) => makeSession(s.date, s.start, s.end - s.start, s.note)))
    setSource('from WhatsApp')
    setPhase('propose')
  }

  // Ask the model what each sitting is for, and swap the lines in when they
  // arrive. The plan is already on screen and usable — this only improves it.
  const fillNotes = async (
    slots: DateSlot[],
    t: string,
    dl: string,
    mins: number,
    p: Pace,
  ) => {
    if (slots.length === 0) return
    try {
      const { steps, provider } = await describeSessions(
        { title: t, deadline: dl, totalMinutes: mins, pace: p },
        slots,
      )
      setSessions((cur) =>
        cur.length === steps.length ? cur.map((s, i) => ({ ...s, note: steps[i] ?? s.note })) : cur,
      )
      setSource(provider)
    } catch {
      // no model, no network — the deterministic steps already shown are fine
    }
  }

  const accept = () => {
    const task: Task = {
      id: `t${Date.now()}`,
      title,
      deadline,
      pace,
      totalMinutes: budget,
      sessions,
      status: 'draft',
      createdAt: new Date().toISOString(),
    }
    setCurrent(acceptPlan(task))
    setPhase('shared')
  }

  if (phase === 'capture') {
    const ready = title.trim().length > 0 && deadline >= todayIso
    return (
      <Screen title="New task" eyebrow="Build a plan">
        <div className="task-form">
          <input
            className="add-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            aria-label="Task"
            autoFocus
          />
          <label className="task-field">
            <span className="task-field-label">Due</span>
            <input
              type="date"
              value={deadline}
              min={todayIso}
              onChange={(e) => setDeadline(e.target.value)}
              aria-label="Deadline"
            />
          </label>

          <div className="task-field-label">How long will it take?</div>
          <div className="kind-row">
            {BUDGETS.map((b) => (
              <button
                key={b}
                className={`kind-pill ${budget === b ? 'on' : ''}`}
                onClick={() => setBudget(b)}
                aria-pressed={budget === b}
              >
                {hoursLabel(b)}
              </button>
            ))}
          </div>
        </div>

        <div className="answer-actions">
          <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => setPhase('pace')}>
            Next
          </button>
        </div>
        <button className="btn-link centered" onClick={reset}>
          Never mind
        </button>
      </Screen>
    )
  }

  if (phase === 'pace') {
    return (
      <Screen title="How do you want to do it?" eyebrow={title}>
        <div className="neg-options">
          <button className="neg-option" onClick={() => build('quick')}>
            <span className="neg-title">Finish it quick</span>
            <span className="neg-sub">Fewer, longer sittings — starting as soon as you're free</span>
          </button>
          <button className="neg-option" onClick={() => build('relaxed')}>
            <span className="neg-title">Take your time</span>
            <span className="neg-sub">
              Shorter sittings, spread out to {shortDateLabel(deadline)}
            </span>
          </button>
        </div>
        <div className="answer-actions" />
        <button className="btn-link centered" onClick={() => setPhase('capture')}>
          Back
        </button>
      </Screen>
    )
  }

  if (phase === 'propose') {
    const planned = sessions.reduce((n, s) => n + (s.end - s.start), 0)
    const short = budget - planned
    return (
      <Screen title={title} eyebrow={`Due ${shortDateLabel(deadline)}`}>
        {sessions.length === 0 ? (
          <div className="empty-day">
            <div>No free time before {shortDateLabel(deadline)}.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Try a later deadline, or clear something first.</div>
          </div>
        ) : (
          <>
            <div className="session-list">
              {sessions.map((s, i) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  index={i}
                  title={title}
                  activities={activities}
                  siblings={sessions.filter((_, j) => j !== i)}
                  onChange={(next) => setSessions((cur) => cur.map((c, j) => (j === i ? next : c)))}
                />
              ))}
            </div>

            <div className="plan-summary">
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
              {hoursLabel(planned)} · done by {shortDateLabel(sessions[sessions.length - 1]!.date)}
              {short > 0 && (
                <div className="error-line">
                  Only {hoursLabel(planned)} of {hoursLabel(budget)} fits before the deadline.
                </div>
              )}
            </div>
            <div className="answer-source">{source === 'offline' ? 'offline' : `via ${source}`}</div>
          </>
        )}

        {/* Trust line sits ABOVE the commit, so it's on screen when you decide
            rather than below the fold under it. */}
        <div className="answer-actions">
          <div className="trustline">It proposes. You decide. Nothing moves on its own.</div>
          <button
            className="btn btn-primary btn-block"
            disabled={sessions.length === 0}
            onClick={accept}
          >
            Add these to my week
          </button>
          <div className="task-links">
            <button className="btn-link" onClick={() => build(pace === 'quick' ? 'relaxed' : 'quick')}>
              {pace === 'quick' ? 'Spread it out instead' : 'Get it over with instead'}
            </button>
            <button className="btn-link" onClick={reset}>
              Never mind
            </button>
          </div>
        </div>
      </Screen>
    )
  }

  if (phase === 'shared' && current) {
    return <Share task={current} onDone={reset} />
  }

  // list
  return (
    <div>
      <div className="appbar">
        <div>
          <div className="eyebrow">Your work</div>
          <h1>Tasks</h1>
        </div>
      </div>

      <FromWhatsApp onOpen={openBotDraft} />

      {tasks.length === 0 ? (
        <div className="empty-day">
          <div>Nothing planned yet.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Give Ruang a deadline and it'll find the hours.
          </div>
        </div>
      ) : (
        <div className="session-list">
          {tasks.map((t) => (
            <div key={t.id} className="task-card">
              <div className="task-card-top">
                <span className="chip-title">{t.title}</span>
                <button className="chip-del" onClick={() => removeTask(t.id)} aria-label="Delete task">
                  ×
                </button>
              </div>
              <div className="task-card-meta">
                Due {shortDateLabel(t.deadline)} · {t.sessions.length}{' '}
                {t.sessions.length === 1 ? 'session' : 'sessions'} · {hoursLabel(totalPlannedMinutes(t))}
              </div>
              {t.status === 'planned' && (
                <button className="btn-link" onClick={() => { saveTask(t); setCurrent(t); setPhase('shared') }}>
                  Share this plan
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="answer-actions">
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setPhase('capture')
          }}
        >
          Build a plan
        </button>
      </div>
    </div>
  )
}

function Screen({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <div className="task-screen">
      <div className="appbar">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
      </div>
      {children}
    </div>
  )
}

// One proposed block: when, and what to do. Tap to change any of it — the
// clash check warns but never blocks, because the user decides.
function SessionRow({
  session,
  index,
  title,
  activities,
  siblings,
  onChange,
}: {
  session: TaskSession
  index: number
  title: string
  activities: import('../../domain/types').Activity[]
  siblings: TaskSession[]
  onChange: (next: TaskSession) => void
}) {
  const [editing, setEditing] = useState(false)

  // Against the rest of the week, and against the other sittings of this same
  // plan — dragging session 3 on top of session 2 is the likeliest clash of all.
  const inWeek = busyOnDate(
    activities,
    dateFromIso(session.date),
    session.start,
    session.end,
    session.activityId ?? undefined,
  )
  const sibling = siblings.find(
    (s) => s.date === session.date && session.start < s.end && s.start < session.end,
  )
  const clash = inWeek
    ? { title: inWeek.title }
    : sibling
      ? { title: 'another sitting of this plan' }
      : null

  if (!editing) {
    return (
      <div className="chip activity session">
        <div className="chip-body">
          <div className="chip-time">
            {shortDateLabel(session.date)} · {fmt(session.start)}–{fmt(session.end)}
          </div>
          <div className="chip-title">
            {title} <span className="session-n">({index + 1})</span>
          </div>
          <div className="chip-desc">{session.note}</div>
          {clash && <div className="error-line">Overlaps {clash.title}</div>}
        </div>
        <button className="session-edit" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    )
  }

  const setTime = (which: 'start' | 'end', value: string) => {
    const minutes = toMinutes(value)
    if (minutes === null) return
    if (which === 'start') {
      // Moving a session keeps its length. Anything else silently turns a
      // one-hour sitting into a four-hour one when you drag it earlier.
      const length = session.end - session.start
      onChange({ ...session, start: minutes, end: minutes + length })
      return
    }
    onChange({ ...session, end: Math.max(minutes, session.start + 15) })
  }

  return (
    <div className="card session-edit-card">
      <div className="add-row">
        <input
          type="date"
          value={session.date}
          onChange={(e) =>
            e.target.value &&
            onChange({ ...session, date: e.target.value, day: weekdayOfIso(e.target.value) })
          }
          aria-label="Date"
        />
      </div>
      <div className="add-row">
        <input type="time" value={toValue(session.start)} onChange={(e) => setTime('start', e.target.value)} aria-label="Start" />
        <input type="time" value={toValue(session.end)} onChange={(e) => setTime('end', e.target.value)} aria-label="End" />
      </div>
      <input
        className="note-input"
        value={session.note}
        onChange={(e) => onChange({ ...session, note: e.target.value })}
        placeholder="What will you do?"
        aria-label="Note"
      />
      {clash && <div className="error-line">Overlaps {clash.title} — your call.</div>}
      <button className="btn btn-sage btn-block" onClick={() => setEditing(false)}>
        Done
      </button>
    </div>
  )
}

// One link that carries the whole schedule. The plan rides in the fragment, so
// it works with no backend and nothing about your week is stored anywhere.
// The slug is cosmetic — it puts the task (and who it's with) at the front of
// the link instead of opening straight into base64.
function planLink(task: Task, groupName?: string): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}${SHARE_PREFIX}${slugify(task.title, groupName)}/${encodePlan(task)}`
}

// The plan as text: the schedule in words, then the one link.
function shareText(task: Task, groupName?: string, hostedUrl?: string): string {
  return planText(task, fmt, hostedUrl || planLink(task, groupName))
}

// The bot client speaks in same-origin paths; a link you send has to be whole.
function absolute(url: string): string {
  return url.startsWith('http') ? url : `${window.location.origin}${url}`
}

// The name the hosted calendar file lives under. Readable, and with a short
// suffix so someone can't reach your plans by guessing "lab-report.ics".
function hostedSlug(task: Task, groupName?: string): string {
  let h = 0
  const seed = `${task.id}:${task.title}:${task.deadline}`
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return `${slugify(task.title, groupName)}-${(h >>> 0).toString(36).slice(0, 4)}`
}

function Share({ task, onDone }: { task: Task; onDone: () => void }) {
  const [groups, setGroups] = useState<BotGroup[] | null>(null)
  const [groupJid, setGroupJid] = useState('')
  // The group is usually doing the same assignment, so what goes out is the
  // plan itself — not a "heads up, I'm busy". Editable before it goes.
  const [message, setMessage] = useState(() => shareText(task))
  const [status, setStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  // The hosted .ics URL, once the bot has taken a copy.
  const [hosted, setHosted] = useState<string | null>(null)
  // Once you've touched the message it's yours — we stop rewriting it.
  const editedRef = useRef(false)

  const groupName = groups?.find((g) => g.jid === groupJid)?.name

  // One file, every session. A Google Calendar link can only ever carry one
  // event, so "all of it in one tap" has to be a calendar file.
  const saveToCalendar = () => {
    downloadFile(icsFilename(task.title, groupName), planToIcs(task), 'text/calendar')
  }

  useEffect(() => {
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = async () => {
      const g = await getGroups()
      if (!live) return
      setGroups(g)
      if (g && g.length) {
        setGroupJid((cur) => cur || g[0]!.jid)
        if (!editedRef.current) setMessage(shareText(task, g[0]!.name))
      }
      // The bot is up, so it can host the calendar file. That turns a
      // 300-character self-contained link into /bot/plan/<name>.ics — and the
      // link IS the calendar file, so a phone opens it straight into Calendar.
      if (g !== null) {
        const name = g[0]?.name
        const url = await publishPlan(
          hostedSlug(task, name),
          task.title,
          planToIcs(task),
        )
        if (live && url) {
          setHosted(url)
          if (!editedRef.current) setMessage(shareText(task, name, absolute(url)))
        }
      }
      // Keep looking while the bot is unreachable. Checking once on mount means
      // a screen opened before the bot was up stays "offline" forever, even
      // after you start it — the Invites tab polls for exactly this reason.
      if (g === null) timer = setTimeout(load, 3000)
    }

    void load()
    return () => {
      live = false
      if (timer) clearTimeout(timer)
    }
  }, [task])

  // Share whatever is in the box, so an edit applies to both routes out.
  // Both APIs need the user gesture, so no awaiting before they're called.
  const share = () => {
    setCopied(false)
    const text = message.trim() || shareText(task)
    if (navigator.share) {
      navigator.share({ title: task.title, text }).catch(() => {
        // sheet dismissed — not an error
      })
      return
    }
    navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  const send = async () => {
    if (!groupJid || !message.trim()) return
    setSending(true)
    const res = await sayToGroup(groupJid, message.trim())
    setSending(false)
    setStatus(res.ok ? 'Posted to the group.' : res.error ?? 'Could not post.')
  }

  return (
    <div className="task-screen">
      <div className="appbar">
        <div>
          <div className="eyebrow">Added to your week</div>
          <h1>{task.title}</h1>
        </div>
      </div>

      <div className="session-list">
        {task.sessions.map((s) => (
          <div key={s.id} className="chip activity session">
            <div className="chip-body">
              <div className="chip-time">
                {shortDateLabel(s.date)} · {fmt(s.start)}–{fmt(s.end)}
              </div>
              <div className="chip-desc">{s.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="share-row">
        <button className="btn btn-outline btn-block" onClick={saveToCalendar}>
          Save all {task.sessions.length} to my calendar
        </button>
        <div className="sub-note">
          One file, every session — Google Calendar, Apple Calendar or Outlook.
        </div>
      </div>

      {/* The message is always here to read, edit and share. Only POSTING it to
          a group needs the bot. */}
      <div className="share-row">
        <div className="task-field-label">What you'll send</div>
        <textarea
          className="note-input share-text"
          value={message}
          onChange={(e) => {
            editedRef.current = true
            setMessage(e.target.value)
          }}
          rows={Math.min(12, message.split('\n').length + 1)}
          aria-label="Message to the group"
        />
        {!hosted && groups !== null && (
          <div className="sub-note">
            The bot isn't hosting this one, so the link carries the plan itself — long, but it
            works anywhere.
          </div>
        )}
      </div>

      <div className="share-row">
        <div className="task-field-label">Send it to the group</div>
        {groups === null && (
          <div className="empty-day" style={{ padding: '12px 0' }}>
            <div>Bot offline.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Start it: <code>cd bot && npm start</code> — this picks it up on its own.
            </div>
          </div>
        )}
        {groups !== null && groups.length === 0 && (
          <div className="empty-day" style={{ padding: '12px 0' }}>
            No watched groups yet.
          </div>
        )}
        {groups !== null && groups.length > 1 && (
          <select
            className="add-input"
            value={groupJid}
            onChange={(e) => {
              setGroupJid(e.target.value)
              const picked = groups.find((g) => g.jid === e.target.value)
              if (!editedRef.current) {
                setMessage(shareText(task, picked?.name, hosted ? absolute(hosted) : undefined))
              }
            }}
            aria-label="Group"
          >
            {groups.map((g) => (
              <option key={g.jid} value={g.jid}>
                {g.name}
              </option>
            ))}
          </select>
        )}
        {status && <div className="answer-source">{status}</div>}
      </div>

      <div className="answer-actions">
        <div className="trustline">Nothing posts until you tap.</div>
        <button
          className="btn btn-primary btn-block"
          disabled={!groupJid || sending || !message.trim()}
          onClick={send}
        >
          {sending ? 'Sending…' : 'Send to the group'}
        </button>
        <div className="task-links">
          <button className="btn-link" onClick={share}>
            {copied ? 'Copied' : 'Share the plan with someone'}
          </button>
          <button className="btn-link" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function toValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function toMinutes(value: string): number | null {
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return (h ?? 0) * 60 + (m ?? 0)
}
