import type { Activity, Day } from './types'
import { DAY_ORDER, JS_DAY } from './types'

// Real dates, carefully.
//
// An Activity is either PINNED to one calendar date (`a.date` set — a planned
// task session, a one-off you added on a specific day) or FLOATING on a weekday
// (`a.date` absent — anything weekly, and everything that predates this field).
// Floating is the old behaviour, so untouched saved data keeps working.
//
// Every date string here is built from LOCAL getters. `toISOString().slice(0,10)`
// converts to UTC first, so east of Greenwich it hands back yesterday — which
// would land every planned block on the wrong day.

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dateFromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function weekdayOf(date: Date): Day {
  return JS_DAY[date.getDay()]!
}

export function weekdayOfIso(s: string): Day {
  return weekdayOf(dateFromIso(s))
}

// The one question every calendar view asks: does this thing happen on this date?
export function occursOn(a: Activity, date: Date): boolean {
  return a.date ? a.date === isoDate(date) : a.day === weekdayOf(date)
}

export function activitiesOn(activities: Activity[], date: Date): Activity[] {
  return activities.filter((a) => occursOn(a, date))
}

// Date-aware overlap. `findConflict` in scheduling.ts matches on weekday alone,
// which is right for the floating week but would flag all four Wednesdays of a
// month as clashing with each other.
export function busyOnDate(
  activities: Activity[],
  date: Date,
  start: number,
  end: number,
  ignoreId?: string,
): Activity | null {
  return (
    activitiesOn(activities, date).find(
      (a) => a.id !== ignoreId && start < a.end && end > a.start,
    ) ?? null
  )
}

// Moving a pinned activity to a different weekday has to move its date too,
// or the two disagree forever. Returns the nearest date on or after `fromIso`
// that falls on `day`.
export function shiftToWeekday(fromIso: string, day: Day): string {
  const from = dateFromIso(fromIso)
  const want = DAY_ORDER.indexOf(day)
  const have = DAY_ORDER.indexOf(weekdayOf(from))
  const delta = (want - have + 7) % 7
  const next = new Date(from)
  next.setDate(next.getDate() + delta)
  return isoDate(next)
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// "Thu 18 Sep" — the label a planned block wears everywhere.
export function shortDateLabel(iso: string): string {
  return dateFromIso(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
