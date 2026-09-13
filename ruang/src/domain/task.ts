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
  // 'HH:MM' 24h — the time-of-day the deadline falls on. Absent on older saved
  // tasks, which then read as end-of-day.
  deadlineTime?: string
  // The free-text course/label the task belongs to. Colors are derived from it
  // (domain/course.ts); it is never a scheduling input.
  course?: string
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

// The deadline as minutes since midnight. Older tasks with no stored time read
// as 11:59pm — the same silent default the capture step uses.
export function deadlineMinutes(task: Pick<Task, 'deadlineTime'>): number {
  const [h, m] = (task.deadlineTime ?? '23:59').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// "7 hrs left" when the deadline lands today, otherwise "5 days". Hours while
// there's still a same-day countdown; days once it's a future date.
export function countdownLabel(task: Pick<Task, 'deadline' | 'deadlineTime'>, now = new Date()): string {
  const due = dateFromIso(task.deadline)
  const todayIso = isoDateLocal(now)
  if (task.deadline === todayIso) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const left = deadlineMinutes(task) - nowMin
    if (left <= 0) return 'due now'
    const hrs = Math.max(1, Math.round(left / 60))
    return `${hrs} hr${hrs === 1 ? '' : 's'} left`
  }
  const days = Math.round((due.getTime() - startOfDay(now).getTime()) / 86400000)
  if (days <= 0) return 'today'
  return `${days} day${days === 1 ? '' : 's'}`
}

// Progress has no stored source of truth (see docs/UI-improvement.md §5): a
// session counts as done once its window has passed. The last session lands on
// the deadline, so working to the wire reads as ~100%. Deterministic, and it
// needs no new field or user gesture.
export function progressPercent(task: Pick<Task, 'sessions'>, now = new Date()): number {
  if (task.sessions.length === 0) return 0
  const nowMin = now.getHours() * 60 + now.getMinutes()
  let done = 0
  for (const s of task.sessions) {
    const end = dateFromIso(s.date)
    end.setHours(0, 0, 0, 0)
    if (end.getTime() < startOfDay(now).getTime()) done++
    else if (isoDateLocal(now) === s.date && s.end <= nowMin) done++
  }
  return Math.round((done / task.sessions.length) * 100)
}

// A short form for the timeline, where the full title wraps to three lines. Not
// a clipped string — a real abbreviation: initials for "Problem Set 4" → PS4.
export function shortTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 2) return title
  const head = words.slice(0, 2).join(' ')
  if (head.length <= 22) return head
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isoDateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
