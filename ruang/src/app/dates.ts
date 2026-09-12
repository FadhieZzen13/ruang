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
