import { useSyncExternalStore } from 'react'
import type { Task, TaskSession, TaskStatus } from '../domain/task'
import type { Pace } from '../domain/planner'
import { weekdayOfIso } from '../domain/occurrence'

// Tasks live in their own store, not in AppState. Two reasons: every write to
// the activities store pushes the week to the bot, which editing a draft plan
// has no business doing; and a bad task blob must not be able to take the
// schedule down with it.

const TASKS_KEY = 'ruang.tasks.v1'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

let tasks: Task[] = loadTasks()
const listeners = new Set<() => void>()

// Unlike loadActivities, validate every row. A malformed Activity just renders
// oddly; a Task missing `sessions` throws on render and takes the screen out.
function coerceSession(raw: unknown): TaskSession | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (typeof s.date !== 'string' || !ISO_DATE.test(s.date)) return null
  if (typeof s.start !== 'number' || typeof s.end !== 'number' || s.end <= s.start) return null
  return {
    id: typeof s.id === 'string' ? s.id : `s${Math.random().toString(36).slice(2, 9)}`,
    date: s.date,
    day: weekdayOfIso(s.date), // always re-derived; never trusted from storage
    start: s.start,
    end: s.end,
    note: typeof s.note === 'string' ? s.note : '',
    activityId: typeof s.activityId === 'string' ? s.activityId : null,
  }
}

function coerceTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  if (typeof t.id !== 'string' || typeof t.title !== 'string') return null
  if (typeof t.deadline !== 'string' || !ISO_DATE.test(t.deadline)) return null
  const sessions = Array.isArray(t.sessions)
    ? t.sessions.map(coerceSession).filter((s): s is TaskSession => s !== null)
    : []
  const status = t.status as TaskStatus
  return {
    id: t.id,
    title: t.title,
    deadline: t.deadline,
    deadlineTime: validTime(t.deadlineTime) ? (t.deadlineTime as string) : undefined,
    course: typeof t.course === 'string' && t.course.trim() ? t.course.trim() : undefined,
    pace: (t.pace === 'quick' || t.pace === 'relaxed' ? t.pace : 'relaxed') as Pace,
    totalMinutes: typeof t.totalMinutes === 'number' ? t.totalMinutes : 240,
    sessions,
    status: status === 'draft' || status === 'planned' || status === 'done' ? status : 'draft',
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
  }
}

function validTime(v: unknown): boolean {
  return typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v)
}

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // One bad row is dropped; the rest of the list survives.
    return parsed.map(coerceTask).filter((t): t is Task => t !== null)
  } catch {
    return []
  }
}

function setTasks(next: Task[]) {
  tasks = next
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  } catch {
    // storage full or unavailable — keeps working in memory
  }
  for (const l of listeners) l()
}

export function getTasks(): Task[] {
  return tasks
}

export function saveTask(task: Task): void {
  const i = tasks.findIndex((t) => t.id === task.id)
  setTasks(i === -1 ? [...tasks, task] : tasks.map((t) => (t.id === task.id ? task : t)))
}

export function removeTask(id: string): void {
  setTasks(tasks.filter((t) => t.id !== id))
}

export function setTaskSessions(id: string, sessions: TaskSession[]): void {
  setTasks(tasks.map((t) => (t.id === id ? { ...t, sessions } : t)))
}

export function useTasks(): Task[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => tasks,
  )
}
