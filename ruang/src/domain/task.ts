import type { Activity, Day } from './types'
import type { DateSlot, Pace } from './planner'
import { dateFromIso, shortDateLabel, weekdayOfIso } from './occurrence'

// A task is a piece of work with a deadline. Its sessions are when you'll
// actually do it. Nothing here touches the week until the user accepts.

export type TaskStatus = 'draft' | 'planned' | 'done'

export interface TaskSession {
  id: string
  date: string // 'YYYY-MM-DD'
  day: Day // derived from date — only ever set by makeSession
  start: number // minutes since midnight
  end: number
  note: string // what to actually do this sitting
  activityId: string | null // null while proposed; set once it's in the week
}

export interface Task {
  id: string
  title: string
  deadline: string // 'YYYY-MM-DD'
  pace: Pace
  totalMinutes: number
  sessions: TaskSession[]
  status: TaskStatus
  createdAt: string
}

export function makeSession(
  date: string,
  start: number,
  minutes: number,
  note: string,
  id = `s${Math.random().toString(36).slice(2, 9)}`,
): TaskSession {
  return { id, date, day: weekdayOfIso(date), start, end: start + minutes, note, activityId: null }
}

export function sessionFromSlot(slot: DateSlot, note: string): TaskSession {
  return makeSession(slot.date, slot.start, slot.end - slot.start, note)
}

// What to do in each sitting, when there's no model to ask. Deterministic, and
// also used to pad a short answer from the LLM.
export function fallbackSteps(title: string, n: number): string[] {
  if (n <= 1) return [`Work on ${title}`]
  if (n === 2) return ['Start and outline', 'Finish and review']
  if (n === 3) return ['Outline it', 'Do the main work', 'Review and finish']
  const middle = Array.from({ length: n - 2 }, (_, i) => `Work through part ${i + 1}`)
  return ['Outline and gather', ...middle, 'Review and submit']
}

// The blocks that land in the week. `note` becomes the description, which the
// agenda already renders as .chip-desc — no new Scheduler code needed.
export function sessionsToActivities(task: Task): Activity[] {
  return task.sessions.map((s, i) => ({
    id: `t${task.id}-${s.id}-${i}`,
    title: task.title,
    day: s.day,
    start: s.start,
    end: s.end,
    kind: 'activity' as const,
    locked: false,
    description: s.note,
    recurrence: 'once' as const,
    date: s.date,
  }))
}

export function totalPlannedMinutes(task: Task): number {
  return task.sessions.reduce((sum, s) => sum + (s.end - s.start), 0)
}

export function hoursLabel(minutes: number): string {
  const h = minutes / 60
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`
}

function timeRange(s: TaskSession, fmt: (m: number) => string): string {
  return `${fmt(s.start)}–${fmt(s.end)}`
}

// The plan, written out to send to someone — a groupmate on the same
// assignment, or a friend who wants to work to the same rhythm.
//
// `planUrl` is one link carrying the whole schedule — whoever opens it sees
// every sitting and can add them all at once. Passed in rather than built here
// so this module stays free of app concerns.
//
// Only this task's sessions ever go in — never the rest of your week. That's
// the line RULE 3 draws: the bot never volunteers your other commitments, but
// what YOU choose to send about your own work is yours to send, and you see and
// can edit every word of it first.
export function planText(task: Task, fmt: (m: number) => string, planUrl?: string): string {
  // The schedule reads first, in plain text, so it's useful even to someone who
  // never opens the link. The link then carries the whole thing in one tap.
  const lines = task.sessions.map(
    (s, i) => `${i + 1}. ${shortDateLabel(s.date)}, ${timeRange(s, fmt)} — ${s.note}`,
  )
  const count = `${task.sessions.length} ${task.sessions.length === 1 ? 'session' : 'sessions'} · ${hoursLabel(totalPlannedMinutes(task))} total`

  const out = [`Plan for "${task.title}" — due ${shortDateLabel(task.deadline)}`, ...lines, count]
  if (planUrl) out.push('', 'Open the whole schedule and add it to your calendar:', planUrl)
  return out.join('\n')
}

export function isPast(iso: string, today = new Date()): boolean {
  return dateFromIso(iso).getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
}
