import { useEffect, useMemo, useRef, useState } from 'react'
import { fmt, getActivities, renameActivities, useAppState } from '../../app/store'
import { saveTask, useTasks } from '../../app/tasks'
import { acceptPlan } from '../../app/plan-actions'
import { describeSessions } from '../../app/plan-agent'
import { downloadFile } from '../../app/download'
import { getGroups, publishPlan, sayToGroup, type BotGroup } from '../../app/bot'
import type { Task, TaskSession } from '../../domain/task'
import {
  countdownLabel,
  deadlineMinutes,
  fallbackSteps,
  hoursLabel,
  makeSession,
  planText,
  progressPercent,
  sessionFromSlot,
  shortTitle,
} from '../../domain/task'
import { maxPerDayFor, planSessions, shapeFor, type DateSlot, type Pace } from '../../domain/planner'
import { busyOnDate, dateFromIso, isoDate, shortDateLabel, weekdayOfIso } from '../../domain/occurrence'
import { courseTint } from '../../domain/course'
import { SHARE_PREFIX, encodePlan } from '../../domain/share-link'
import { takePlanDraft } from '../../app/plan-draft'
import { FromWhatsApp } from './FromWhatsApp'
import type { BotDraft } from '../../app/bot'
import { icsFilename, planToIcs, slugify } from '../../domain/ics'
import { termWeek, TERM_WEEKS } from '../../app/dates'
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeft,
  ClockBadge,
  ClockIcon,
  Progress,
  ScreenShell,
  Segmented,
  StarIcon,
  TagPill,
  WizardTop,
} from '../bits'

type Phase = 'list' | 'capture' | 'pace' | 'propose' | 'shared'
type Scope = 'week' | 'month' | 'year'

const BUDGETS = [120, 240, 360, 480]
const EFFORT_LABELS = ['1–2 hrs', 'Half a day', 'Full day', '2+ days']

export function Task() {
  const { activities } = useAppState()
  const tasks = useTasks()
  const [phase, setPhase] = useState<Phase>('list')
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd')

  // Draft being built. Held here rather than in the store so nothing is saved
  // until the plan is accepted.
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [deadline, setDeadline] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('23:59')
  const [budget, setBudget] = useState(240)
  const [pace, setPace] = useState<Pace>('quick')
  const [sessions, setSessions] = useState<TaskSession[]>([])
  const [source, setSource] = useState<string>('offline')
  const [current, setCurrent] = useState<Task | null>(null)
  // "Edit all" opens every block's inline editor at once.
  const [editAll, setEditAll] = useState(false)

  const today = useMemo(() => new Date(), [])
  const todayIso = isoDate(today)

  const go = (next: Phase, direction: 'fwd' | 'back' = 'fwd') => {
    setDir(direction)
    setPhase(next)
  }

  const reset = () => {
    setTitle('')
    setCourse('')
    setDeadline('')
    setDeadlineTime('23:59')
    setBudget(240)
    setPace('quick')
    setSessions([])
    setCurrent(null)
    setSource('offline')
    setEditAll(false)
    go('list', 'back')
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
    setEditAll(false)
    go('propose')
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
    go('propose')
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
      course: course.trim() || undefined,
      deadline,
      deadlineTime,
      pace,
      totalMinutes: budget,
      sessions,
      status: 'planned',
      createdAt: new Date().toISOString(),
    }
    setCurrent(acceptPlan(task))
    go('shared')
  }

  if (phase === 'capture') {
    const ready = title.trim().length > 0 && deadline >= todayIso
    return (
      <ScreenShell>
        <WizardTop back="Tasks" step="Step 1 of 3" onBack={reset} />
        <h1 className="wizard-h1">What do you need to get done?</h1>
        <p className="wizard-sub">Ruang will fit it into your week.</p>

        <div className={`wizard-body step-anim ${dir === 'back' ? 'back' : ''}`}>
          <label className="field">
            <span className="field-label">Task name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thesis Introduction Draft"
              aria-label="Task name"
              autoFocus
            />
            <span className="field-hint">e.g. Finish problem set, write lit review section</span>
          </label>

          <label className="field">
            <span className="field-label">Course or label (optional)</span>
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="ENG 401"
              aria-label="Course or label"
            />
          </label>

          <div className="field">
            <span className="field-label">Deadline</span>
            <div className="field-split">
              <div className="field-half">
                <input
                  type="date"
                  value={deadline}
                  min={todayIso}
                  onChange={(e) => setDeadline(e.target.value)}
                  aria-label="Deadline date"
                />
                <span className="field-icon"><CalendarIcon /></span>
              </div>
              <div className="field-half narrow">
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  aria-label="Deadline time"
                />
                <span className="field-icon"><ClockIcon /></span>
              </div>
            </div>
          </div>
        </div>

        <div className="docked">
          <button className="btn btn-primary btn-block" disabled={!ready} onClick={() => go('pace')}>
            Next →
          </button>
        </div>
      </ScreenShell>
    )
  }

  if (phase === 'pace') {
    const tint = courseTint(course)
    return (
      <ScreenShell>
        <WizardTop back="Back" step="Step 2 of 3" onBack={() => go('capture', 'back')} />
        <h1 className="wizard-h1">How do you want to approach it?</h1>
        <p className="wizard-sub">This shapes how Ruang slots sessions into your week.</p>

        <div className={`wizard-body step-anim ${dir === 'back' ? 'back' : ''}`}>
          {/* The recap keeps step 1's input visible so nothing feels lost
              crossing steps. */}
          <div className="context-card">
            <TagPill tint={tint} />
            <div className="context-title">{title}</div>
            <div className="context-sub">
              Due {shortDateLabel(deadline)} · {fmt(toMinutes(deadlineTime) ?? 23 * 60 + 59)}
            </div>
          </div>

          <button
            className={`choice ${pace === 'quick' ? 'on' : ''}`}
            onClick={() => setPace('quick')}
            aria-pressed={pace === 'quick'}
          >
            {pace === 'quick' && <span className="choice-check"><CheckIcon /></span>}
            <span className="choice-badge" style={{ background: '#f4e4dd' }}>
              <StarIcon color="#c4694a" />
            </span>
            <span className="choice-body">
              <span className="choice-title">Finish it quickly</span>
              <span className="choice-desc">Ruang blocks longer sessions early — done before you know it.</span>
              <span className="choice-bars" aria-hidden>
                <span style={{ width: '100%', background: '#c4694a' }} />
                <span style={{ width: '70%', background: '#e0a48e' }} />
                <span style={{ width: '42%', background: '#efd0c4' }} />
              </span>
              <span className="choice-bars-cap">Heavy early · lighter later</span>
            </span>
          </button>

          <button
            className={`choice ${pace === 'relaxed' ? 'on' : ''}`}
            onClick={() => setPace('relaxed')}
            aria-pressed={pace === 'relaxed'}
          >
            {pace === 'relaxed' && <span className="choice-check"><CheckIcon /></span>}
            <span className="choice-badge" style={{ background: '#ece5db' }}>
              <ClockBadge color="#a08a6e" />
            </span>
            <span className="choice-body">
              <span className="choice-title">Take my time</span>
              <span className="choice-desc">Even sessions spread over the week — less pressure, same result.</span>
              <span className="choice-bars" aria-hidden>
                <span style={{ width: '80%', background: '#7a8b6f' }} />
                <span style={{ width: '80%', background: '#a3b199' }} />
                <span style={{ width: '80%', background: '#c8d2c0' }} />
              </span>
              <span className="choice-bars-cap">Even · same result</span>
            </span>
          </button>

          <div className="field">
            <span className="field-label">Estimated effort</span>
            <div className="effort-row">
              {BUDGETS.map((b, i) => (
                <button
                  key={b}
                  className={budget === b ? 'on' : ''}
                  onClick={() => setBudget(b)}
                  aria-pressed={budget === b}
                >
                  {EFFORT_LABELS[i]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="docked">
          <button className="btn btn-primary btn-block" onClick={() => build(pace)}>
            See proposed schedule →
          </button>
        </div>
      </ScreenShell>
    )
  }

  if (phase === 'propose') {
    const planned = sessions.reduce((n, s) => n + (s.end - s.start), 0)
    const short = budget - planned
    const last = sessions[sessions.length - 1]
    return (
      <ScreenShell>
        <WizardTop back="Back" step="Step 3 of 3" onBack={() => go('pace', 'back')} />

        <div className="eyebrow sm" style={{ padding: '4px 20px 0' }}>
          {course.trim() || 'Task'} · Due {shortDateLabel(deadline).toUpperCase()}
        </div>
        <h1 className="wizard-h1" style={{ paddingBottom: 16 }}>{title}</h1>

        {sessions.length === 0 ? (
          <div className="empty-day">
            <div>No free time before {shortDateLabel(deadline)}.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Try a later deadline, or clear something first.</div>
          </div>
        ) : (
          <>
            <div className="ai-banner">
              <span className="ai-avatar">R</span>
              <p>
                {sessions.length} session{sessions.length === 1 ? '' : 's'} across{' '}
                {new Set(sessions.map((s) => s.date)).size} day
                {new Set(sessions.map((s) => s.date)).size === 1 ? '' : 's'} — each fits your free
                gaps. Tap a block to shift it.
              </p>
            </div>

            <div className="prop-head">
              <span className="prop-label">Proposed blocks</span>
              <button className="prop-edit" onClick={() => setEditAll((v) => !v)}>
                {editAll ? 'Done editing' : 'Edit all'}
              </button>
            </div>

            <div className="session-stack step-anim">
              {sessions.map((s, i) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  index={i}
                  last={i === sessions.length - 1}
                  forceEdit={editAll}
                  activities={activities}
                  siblings={sessions.filter((_, j) => j !== i)}
                  onChange={(next) => setSessions((cur) => cur.map((c, j) => (j === i ? next : c)))}
                />
              ))}
            </div>

            <div className="plan-summary" style={{ paddingTop: 14 }}>
              {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
              {hoursLabel(planned)}
              {last && ` · done by ${shortDateLabel(last.date)}`}
              {short > 0 && (
                <div className="error-line">
                  Only {hoursLabel(planned)} of {hoursLabel(budget)} fits before the deadline.
                </div>
              )}
            </div>
            <div className="answer-source" style={{ paddingLeft: 20 }}>
              {source === 'offline' ? 'offline' : `via ${source}`}
            </div>
          </>
        )}

        <div className="docked">
          <div className="trustline">It proposes. You decide. Nothing moves on its own.</div>
          <button
            className="btn btn-primary btn-block"
            disabled={sessions.length === 0}
            onClick={accept}
          >
            Accept this plan
          </button>
          <div className="task-links">
            <button className="btn-link" onClick={() => build(pace === 'quick' ? 'relaxed' : 'quick')}>
              {pace === 'quick' ? 'Spread it out instead' : 'Get it over with instead'}
            </button>
          </div>
        </div>
      </ScreenShell>
    )
  }

  if (phase === 'shared' && current) {
    return <Share task={current} onDone={reset} />
  }

  // list
  return (
    <TaskList
      tasks={tasks}
      onNew={() => go('capture')}
      onDraft={openBotDraft}
      onShare={(t) => {
        saveTask(t)
        setCurrent(t)
        go('shared')
      }}
    />
  )
}

function TaskList({
  tasks,
  onNew,
  onShare,
  onDraft,
}: {
  tasks: Task[]
  onNew: () => void
  onShare: (t: Task) => void
  onDraft: (d: BotDraft) => void
}) {
  const [scope, setScope] = useState<Scope>('week')
  const [asc, setAsc] = useState(true)
  const week = termWeek()

  const sorted = useMemo(() => {
    const by = [...tasks].sort((a, b) =>
      a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0,
    )
    return asc ? by : by.reverse()
  }, [tasks, asc])

  return (
    <div>
      <div className="appbar">
        <div>
          <div className="eyebrow">
            Week {week} of {TERM_WEEKS}
          </div>
          <h1>Tasks</h1>
        </div>
      </div>

      <FromWhatsApp onOpen={onDraft} />

      <button className="plan-banner" onClick={onNew}>
        <span className="pb-badge">+</span>
        <span className="pb-copy">
          <span className="pb-title">Build a plan</span>
          <span className="pb-sub">Add a task and Ruang schedules it for you</span>
        </span>
      </button>

      <Segmented
        value={scope}
        onChange={setScope}
        options={[
          { value: 'week', label: 'This week' },
          { value: 'month', label: 'This month' },
          { value: 'year', label: 'This year' },
        ]}
      />

      <div className="scope-bar">
        <span className="scope-count">
          {sorted.length} task{sorted.length === 1 ? '' : 's'}
        </span>
        <button className="sort-btn" onClick={() => setAsc((v) => !v)}>
          sort by due date {asc ? '↑' : '↓'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-day">
          <div>Nothing planned yet.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Give Ruang a deadline and it'll find the hours.
          </div>
        </div>
      ) : (
        <div className="task-list">
          {sorted.map((t) => (
            <TaskCard key={t.id} task={t} onShare={() => onShare(t)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, onShare }: { task: Task; onShare: () => void }) {
  const tint = courseTint(task.course)
  const pct = progressPercent(task)
  const planned = task.status === 'planned' || task.status === 'done'
  const [editingTitle, setEditingTitle] = useState(false)
  const [nextTitle, setNextTitle] = useState(task.title)

  const rename = () => {
    const title = nextTitle.trim()
    if (!title || title === task.title) {
      setNextTitle(task.title)
      setEditingTitle(false)
      return
    }
    saveTask({ ...task, title })
    renameActivities(`t${task.id}-`, title)
    setEditingTitle(false)
  }

  return (
    <div className="task-card2" style={{ background: tint.wash, borderColor: 'transparent' }}>
      <div className="tc-top">
        <TagPill tint={tint} />
        <span className="tc-due">
          {shortDateLabel(task.deadline)} · {fmt(deadlineMinutes(task))}
        </span>
      </div>
      {editingTitle ? (
        <div className="tc-rename">
          <input
            className="note-input"
            value={nextTitle}
            onChange={(e) => setNextTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') rename()
              if (e.key === 'Escape') {
                setNextTitle(task.title)
                setEditingTitle(false)
              }
            }}
            aria-label="Assignment name"
            autoFocus
          />
          <button className="btn-link" onClick={rename}>Save name</button>
        </div>
      ) : (
        <button className="tc-title tc-title-button" onClick={() => setEditingTitle(true)}>
          {task.title}
        </button>
      )}
      <Progress pct={pct} color={tint.ink} />
      <div className="tc-foot">
        <span className="tc-done">{pct}% done</span>
        <span className="count-pill" style={{ background: tint.pill, color: tint.ink }}>
          {countdownLabel(task)}
        </span>
      </div>
      {planned && (
        <button className="btn-link" style={{ marginTop: 10 }} onClick={onShare}>
          Share this plan
        </button>
      )}
    </div>
  )
}

// One proposed block: when, and what to do. Tap to change any of it — the
// clash check warns but never blocks, because the user decides.
function SessionRow({
  session,
  index,
  last,
  forceEdit,
  activities,
  siblings,
  onChange,
}: {
  session: TaskSession
  index: number
  last: boolean
  forceEdit?: boolean
  activities: import('../../domain/types').Activity[]
  siblings: TaskSession[]
  onChange: (next: TaskSession) => void
}) {
  const [editing, setEditing] = useState(false)
  const open = editing || Boolean(forceEdit)

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

  if (!open) {
    return (
      <div className={`session2 ${last ? 'sage' : ''}`}>
        <div className="session2-top">
          <span className="session2-when" style={{ color: last ? '#7a8b6f' : '#c4694a' }}>
            {shortDateLabel(session.date)} {fmt(session.start)} – {fmt(session.end)}
          </span>
          <span className="session2-dur">{hoursLabel(session.end - session.start)}</span>
        </div>
        <div className="session2-note">{session.note}</div>
        <div className="session2-top">
          <span className="session2-num">Session {index + 1}</span>
          <button className="session2-edit" onClick={() => setEditing(true)}>
            ✎ Edit
          </button>
        </div>
        {clash && (
          <div className="error-line" style={{ textAlign: 'left', margin: '8px 0 0' }}>
            Overlaps {clash.title}
          </div>
        )}
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
        <input
          type="time"
          value={toValue(session.start)}
          onChange={(e) => setTime('start', e.target.value)}
          aria-label="Start"
        />
        <input
          type="time"
          value={toValue(session.end)}
          onChange={(e) => setTime('end', e.target.value)}
          aria-label="End"
        />
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

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V3M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  )
}

// Post-commit confirmation + sharing. The timeline is the mockup's shape: a day
// node per date, sessions hanging off it. Everything below is unchanged
// plumbing — the same bot publish, calendar file and share text as before.
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
        const url = await publishPlan(hostedSlug(task, name), task.title, planToIcs(task))
        if (live && url) {
          setHosted(url)
          if (!editedRef.current) setMessage(shareText(task, name, absolute(url)))
        }
      }
      // Keep looking while the bot is unreachable. Checking once on mount means
      // a screen opened before the bot was up stays "offline" forever, even
      // after you start it — the Invitation tab polls for exactly this reason.
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

  const last = task.sessions.length - 1

  return (
    <div className="task-screen">
      <div className="wizard-top">
        <button className="back-link" onClick={onDone}>
          <ChevronLeft /> Tasks
        </button>
        <button className="btn-outline-icon" onClick={share}>
          <ShareIcon /> Share
        </button>
      </div>

      <div className="success-row">
        <span className="check-circle"><CheckIcon /></span>
        Plan saved · {task.sessions.length} session{task.sessions.length === 1 ? '' : 's'} blocked
      </div>

      <div className="appbar" style={{ paddingTop: 0 }}>
        <div>
          <h1>{task.title}</h1>
          <div className="context-sub" style={{ marginTop: 6 }}>
            {task.course ? `${task.course} · ` : ''}
            Due {shortDateLabel(task.deadline)} · {fmt(deadlineMinutes(task))}
          </div>
        </div>
      </div>

      <div className="timeline">
        {task.sessions.map((s, i) => (
          <div className="tl-row" key={s.id}>
            <div className={`tl-node ${i === last ? 'sage' : 'orange'}`}>
              <span className="tl-dow">{weekdayShort(s.date)}</span>
              <span className="tl-date">{dateFromIso(s.date).getDate()}</span>
            </div>
            <div className="tl-body">
              <div className="tl-card">
                <div className="tl-card-top">
                  <span
                    className="session2-when"
                    style={{ color: i === last ? '#7a8b6f' : '#c4694a' }}
                  >
                    {fmt(s.start)} – {fmt(s.end)}
                  </span>
                  <span className="session2-dur">{hoursLabel(s.end - s.start)}</span>
                </div>
                <div className="tl-card-title">{shortTitle(task.title)}</div>
                <div className="tl-card-desc">{s.note}</div>
              </div>
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

      <div className="docked">
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
            Alright, Thank you
          </button>
        </div>
      </div>
    </div>
  )
}

function weekdayShort(iso: string): string {
  return dateFromIso(iso).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

function toValue(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function toMinutes(value: string): number | null {
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return (h ?? 0) * 60 + (m ?? 0)
}
