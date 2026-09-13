import { useState } from 'react'
import { addActivities, fmt } from '../../app/store'
import { saveTask, useTasks } from '../../app/tasks'
import { downloadFile } from '../../app/download'
import { icsFilename, toIcs } from '../../domain/ics'
import type { SharedPlan as Plan } from '../../domain/share-link'
import type { Task } from '../../domain/task'
import { hoursLabel, sessionsToActivities } from '../../domain/task'
import { shortDateLabel } from '../../domain/occurrence'

// What someone sees when they open a shared plan link. They may not use Ruang
// at all, so the schedule has to be readable and addable to any calendar
// without signing up for anything.
// Same plan, same sittings — someone tapping the link a second time (which is
// what people do in a chat) must not get a second set of blocks.
function fingerprint(title: string, deadline: string, sessions: { date: string; start: number; end: number }[]) {
  return [title, deadline, ...sessions.map((s) => `${s.date}:${s.start}:${s.end}`)].join('|')
}

// Id derived from the plan itself, not the clock: importing the same link twice
// upserts the same task instead of growing a second one.
function idFor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return `shared${(h >>> 0).toString(36)}`
}

function buildTask(plan: Plan, total: number, key: string): Task {
  return {
    id: idFor(key),
    title: plan.title,
    deadline: plan.deadline,
    pace: 'relaxed',
    totalMinutes: total,
    sessions: plan.sessions,
    status: 'draft',
    createdAt: new Date().toISOString(),
  }
}

export function SharedPlan({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const [added, setAdded] = useState(false)
  const tasks = useTasks()

  const key = fingerprint(plan.title, plan.deadline, plan.sessions)
  const alreadyHave = tasks.some((t) => fingerprint(t.title, t.deadline, t.sessions) === key)

  const total = plan.sessions.reduce((n, s) => n + (s.end - s.start), 0)

  // One file, every session — the thing a per-event link can't do.
  const saveToCalendar = () => {
    downloadFile(
      icsFilename(plan.title),
      toIcs({ title: plan.title, sessions: plan.sessions }),
      'text/calendar',
    )
  }

  // Their week, their tap. Same rule as everywhere else.
  const addAll = () => {
    const task = buildTask(plan, total, key)
    const activities = sessionsToActivities(task)
    addActivities(activities)
    saveTask({
      ...task,
      status: 'planned',
      sessions: task.sessions.map((s, i) => ({ ...s, activityId: activities[i]?.id ?? null })),
    })
    setAdded(true)
  }

  return (
    <div className="task-screen">
      <div className="appbar">
        <div>
          <div className="eyebrow">Shared plan · due {shortDateLabel(plan.deadline)}</div>
          <h1>{plan.title}</h1>
        </div>
      </div>

      <div className="session-list">
        {plan.sessions.map((s, i) => (
          <div key={s.id} className="chip activity session">
            <div className="chip-body">
              <div className="chip-time">
                {shortDateLabel(s.date)} · {fmt(s.start)}–{fmt(s.end)}
              </div>
              <div className="chip-title">
                {s.note || `Session ${i + 1}`}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="plan-summary">
        {plan.sessions.length} {plan.sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
        {hoursLabel(total)} · finishes {shortDateLabel(plan.sessions[plan.sessions.length - 1]!.date)}
      </div>

      <div className="share-row">
        <button className="btn btn-outline btn-block" onClick={saveToCalendar}>
          Save all {plan.sessions.length} to my calendar
        </button>
        <div className="sub-note">
          Opens in Google Calendar, Apple Calendar or Outlook — all {plan.sessions.length} at once.
        </div>
      </div>

      <div className="answer-actions">
        {added || alreadyHave ? (
          <>
            <div className="trustline">
              {added ? 'Added to your week.' : 'This is already in your week.'}
            </div>
            <button className="btn btn-sage btn-block" onClick={onClose}>
              Open Ruang
            </button>
          </>
        ) : (
          <>
            <div className="trustline">Nothing is added until you tap.</div>
            <button className="btn btn-primary btn-block" onClick={addAll}>
              Add all {plan.sessions.length} to my week
            </button>
            <div className="task-links">
              <button className="btn-link" onClick={onClose}>
                No thanks
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
