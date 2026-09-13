import type { Day } from '../domain/types'
import { JS_DAY } from '../domain/types'

export const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Monday-first month grid, padded with nulls so every row has 7 cells.
export function monthMatrix(view: Date): (Date | null)[] {
  const year = view.getFullYear()
  const month = view.getMonth()
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7 // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function dayKeyOf(date: Date): Day {
  return JS_DAY[date.getDay()]
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function monthLabel(view: Date): string {
  return view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function addMonths(view: Date, delta: number): Date {
  return new Date(view.getFullYear(), view.getMonth() + delta, 1)
}

// The "WEEK 4 OF 14" counter. Nothing in the app tracks a term today, so this
// anchors a 14-week term to a fixed Monday and counts forward. It's a demo
// header, not a scheduling input — move TERM_START to shift the whole thing.
export const TERM_WEEKS = 14
const TERM_START = new Date(2026, 7, 17) // Monday 17 Aug 2026

export function termWeek(today = new Date()): number {
  const ms = startOfDay(today).getTime() - startOfDay(TERM_START).getTime()
  const week = Math.floor(ms / (7 * 86400000)) + 1
  return Math.min(TERM_WEEKS, Math.max(1, week))
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
