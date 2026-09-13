import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { fmt, takeFocusedScheduleDate, useAppState } from '../../app/store'
import { useTasks } from '../../app/tasks'
import { getPending, type PendingInvite } from '../../app/bot'
import { activitiesOn, dateFromIso, isoDate } from '../../domain/occurrence'
import { DAY_LABEL, type Activity, type ActivityKind, type Day } from '../../domain/types'
import { courseTint } from '../../domain/course'
import { deadlineMinutes, type Task } from '../../domain/task'
import { DAY_START, DAY_END } from '../../domain/scheduling'
import { shortDateLabel } from '../../domain/occurrence'
import { SegmentedUnderline } from '../bits'

// The new landing screen. Agenda-first instead of month-grid-first: what's on
// today, where the gaps are, and what's waiting on a decision — with the month
// calendar one tap away (the toggle at the top), so nothing shipped was lost.

type View = 'plan' | 'week'

const KIND_COLOR: Record<ActivityKind, string> = {
  class: '#6b625b',
  meeting: '#d9a441',
  activity: '#7a8b6f',
  work: '#c4694a',
}

const KIND_WASH: Record<ActivityKind, string> = {
  class: '#efe9e2',
  meeting: '#f6ecd6',
  activity: '#e9eee6',
  work: '#f6e6df',
}

export function Today({
  onMonth,
  selectedDate,
  onSelectDate,
}: {
  onMonth: () => void
  selectedDate: Date
  onSelectDate: (date: Date) => void
}) {
  const { activities, name } = useAppState()
  const tasks = useTasks()
  const [view, setView] = useState<View>('plan')
  const [invites, setInvites] = useState<PendingInvite[] | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [focusedDate] = useState(() => takeFocusedScheduleDate())
  useEffect(() => {
    if (focusedDate) onSelectDate(dateFromIso(focusedDate))
  }, [focusedDate, onSelectDate])
  const selectedDay = selectedDate

  // A live NOW marker needs a ticking clock, not a render-time Date.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let live = true
    const poll = async () => {
      const p = await getPending()
      if (live) setInvites(p)
    }
    void poll()
    const t = setInterval(poll, 4000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [])

  const selectedItems = useMemo(
    () => activitiesOn(activities, selectedDay).sort((a, b) => a.start - b.start),
    [activities, selectedDay],
  )

  const workMinutes = selectedItems.reduce((n, a) => n + (a.end - a.start), 0)
  const gapMinutes = freeMinutes(selectedItems)
  const dayKey = isoDate(now)
  const weekDays = useMemo(() => weekOf(new Date(dayKey)), [dayKey])
  const selectedIsToday = isoDate(selectedDay) === dayKey
  const selectedLabel = selectedIsToday
    ? 'today'
    : selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <div>
      <div className="sched-head">
        <div>
          <div className="eyebrow">{greeting(now)}</div>
          <h1 className="sched-title">{name}</h1>
        </div>
        <div className="view-toggle">
          <button className="on">Today</button>
          <button onClick={onMonth}>Month</button>
        </div>
      </div>

      <div className="dash-head">
        <p className="greet-sub">
          You have <span className="stat-work">{hoursLabel(workMinutes)} work</span> and{' '}
          <span className="stat-free">{hoursLabel(gapMinutes)} free</span> {selectedLabel}.
        </p>
      </div>

      <WeekStrip
        days={weekDays}
        activities={activities}
        today={now}
        selected={selectedDay}
        onSelect={onSelectDate}
      />

      <SegmentedUnderline
        value={view}
        onChange={setView}
        options={[
          { value: 'plan', label: "Today's Plan" },
          { value: 'week', label: 'Due This Week' },
        ]}
      />

      {view === 'plan' ? (
        <PlanTimeline items={selectedItems} now={now} showNow={selectedIsToday} />
      ) : (
        <DueThisWeek tasks={tasks} now={now} />
      )}

      <div className="inv-head">
        <span className="inv-label">
          Invitations <b>+{invites?.length ?? 0}</b>
        </span>
      </div>

      {invites === null ? (
        <div className="empty-day" style={{ padding: '10px 0' }}>
          Bot offline.
        </div>
      ) : invites.length === 0 ? (
        <div className="empty-day" style={{ padding: '10px 0' }}>
          Nothing waiting. Ruang is watching quietly.
        </div>
      ) : (
        invites.slice(0, 3).map((n) => <InvitePreview key={n.id} invite={n} />)
      )}
    </div>
  )
}

// The 7-day strip. Today is a filled circle; every other day carries as many
// dots as it has things, colored by the activity's kind — a compact busy-heatmap.
function WeekStrip({
  days,
  activities,
  today,
  selected,
  onSelect,
}: {
  days: Date[]
  activities: Activity[]
  today: Date
  selected: Date
  onSelect: (date: Date) => void
}) {
  return (
    <div className="week-strip">
      {days.map((d) => {
        const items = activitiesOn(activities, d)
        const isToday = isoDate(d) === isoDate(today)
        const isSelected = isoDate(d) === isoDate(selected)
        return (
          <button
            key={isoDate(d)}
            className={`ws-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(d)}
            aria-label={`Show plans for ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
            aria-pressed={isSelected}
          >
            <span className="ws-dow">{DAY_LABEL[weekdayKey(d)].slice(0, 1)}</span>
            <span className="ws-num">{d.getDate()}</span>
            <span className="ws-dots">
              {items.slice(0, 3).map((a, i) => (
                <span key={i} style={{ background: KIND_COLOR[a.kind] }} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Today's agenda with the gaps left in — and a NOW line at the real clock time.
// The per-gap + is the dashboard's version of "add something here".
function PlanTimeline({ items, now, showNow = true }: { items: Activity[]; now: Date; showNow?: boolean }) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const inWaking = showNow && nowMin >= DAY_START && nowMin <= DAY_END

  const rows: ReactNode[] = []
  let cursor = DAY_START
  let markerPlaced = false

  // Place the NOW line the first time the cursor passes it, so it sits in the
  // right gap or above the right block instead of floating at a fixed spot.
  const maybeMarker = (at: number) => {
    if (markerPlaced || !inWaking || nowMin < cursor || nowMin > at) return
    rows.push(<NowMarker key={`now-${at}`} now={now} />)
    markerPlaced = true
  }

  for (const a of items) {
    const start = Math.max(a.start, DAY_START)
    const end = Math.min(a.end, DAY_END)
    if (end <= cursor) continue
    if (start > cursor) {
      maybeMarker(start)
      rows.push(<GapRow key={`gap-${cursor}`} start={cursor} end={start} />)
    }
    maybeMarker(end)
    rows.push(<EventBlock key={a.id} activity={a} />)
    cursor = Math.max(cursor, end)
  }
  if (cursor < DAY_END) {
    maybeMarker(DAY_END)
    rows.push(<GapRow key={`gap-${cursor}`} start={cursor} end={DAY_END} />)
  }
  if (!markerPlaced && inWaking) rows.push(<NowMarker key="now-end" now={now} />)

  return <div className="tl2">{rows}</div>
}

function GapRow({ start, end }: { start: number; end: number }) {
  const mins = end - start
  if (mins < 30) return null
  return (
    <div className="gap-row">
      <span className="gap-text">
        {fmt(start)} – {fmt(end)} · {hoursLabel(mins)} free
      </span>
      <button className="gap-add" aria-label={`Add something between ${fmt(start)} and ${fmt(end)}`}>
        +
      </button>
    </div>
  )
}

function EventBlock({ activity }: { activity: Activity }) {
  // Tasks color by course; everything else by its kind. See UI-improvement §6 —
  // the two systems live on different data, so they never fight for one block.
  const isTask = activity.id.startsWith('t')
  const tint = isTask ? courseTint(activity.title) : null
  const bg = tint ? tint.wash : KIND_WASH[activity.kind]
  const ink = tint ? tint.ink : KIND_COLOR[activity.kind]

  return (
    <div className="event-block" style={{ background: bg }}>
      <div className="event-top">
        <span
          className="tag-pill"
          style={{ background: tint ? tint.pill : 'rgba(255,255,255,0.65)', color: ink }}
        >
          {tint ? tint.label : activity.kind}
        </span>
        <span className="event-time" style={{ color: ink }}>
          {fmt(activity.start)} – {fmt(activity.end)}
        </span>
      </div>
      <div className="event-title">{activity.title}</div>
      {activity.description && <div className="event-desc">{activity.description}</div>}
    </div>
  )
}

function NowMarker({ now }: { now: Date }) {
  const label = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return (
    <div className="now-mark">
      <span className="now-time">{label}</span>
      <span className="now-label">NOW</span>
    </div>
  )
}

function DueThisWeek({ tasks, now }: { tasks: Task[]; now: Date }) {
  const end = new Date(now)
  end.setDate(end.getDate() + 6)
  const endIso = isoDate(end)
  const due = tasks
    .filter((t) => t.deadline >= isoDate(now) && t.deadline <= endIso)
    .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))

  if (due.length === 0) {
    return (
      <div className="empty-day" style={{ padding: '24px 0' }}>
        Nothing due in the next 7 days.
      </div>
    )
  }
  return (
    <div className="task-list">
      {due.map((t) => {
        const tint = courseTint(t.course)
        return (
          <div key={t.id} className="tl-card">
            <div className="tl-card-top">
              <span className="tag-pill" style={{ background: tint.pill, color: tint.ink }}>
                {tint.label || 'Task'}
              </span>
              <span className="session2-dur">
                {shortDateLabel(t.deadline)} · {fmt(deadlineMinutes(t))}
              </span>
            </div>
            <div className="tl-card-title">{t.title}</div>
          </div>
        )
      })}
    </div>
  )
}

function InvitePreview({ invite }: { invite: PendingInvite }) {
  return (
    <div className="inv-preview" style={{ marginBottom: 10 }}>
      <div className="inv-preview-top">
        <span className="inv-from">
          {invite.author} · {invite.groupName}
        </span>
        <span className="inv-time">pending</span>
      </div>
      <div className="inv-msg">{invite.ask}</div>
      <div className={`inv-status ${invite.busy ? '' : 'clear'}`}>
        <span className="dot" />
        {invite.busy
          ? `Busy ${DAY_LABEL[invite.day]} ${fmt(invite.time)} · tap to decide`
          : `Clear ${DAY_LABEL[invite.day]} ${fmt(invite.time)} · tap to decide`}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------

function freeMinutes(items: Activity[]): number {
  let cursor = DAY_START
  let free = 0
  for (const a of items) {
    if (a.start > cursor) free += Math.min(a.start, DAY_END) - cursor
    cursor = Math.max(cursor, a.end)
  }
  if (cursor < DAY_END) free += DAY_END - cursor
  return Math.max(0, free)
}

function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function hoursLabel(mins: number): string {
  const h = Math.round((mins / 60) * 10) / 10
  return `${h} hrs`
}

const JS_DAY_KEYS: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function weekdayKey(d: Date): Day {
  return JS_DAY_KEYS[d.getDay()]!
}

// Sunday through Saturday, so the strip reads S M T W T F S like the mockup and
// today's circle sits where the week actually is.
function weekOf(from: Date): Date[] {
  const start = new Date(from)
  start.setDate(start.getDate() - start.getDay())
  const out: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    out.push(d)
  }
  return out
}
