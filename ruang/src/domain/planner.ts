import type { Activity, Day } from './types'
import { DAY_START, DAY_END } from './scheduling'
import { activitiesOn, addDays, dateFromIso, isoDate, weekdayOf } from './occurrence'

// Turning "4 hours before Friday" into actual blocks in actual gaps.
//
// This is deliberately separate from scheduling.ts. Those functions match on
// weekday alone, which is correct for the floating week but wrong here: across
// a three-week deadline, every Wednesday would look like the same Wednesday.

export type Pace = 'quick' | 'relaxed'

export interface DateSlot {
  date: string // 'YYYY-MM-DD'
  day: Day
  start: number // minutes since midnight
  end: number
}

export interface Shape {
  sessions: number
  minutes: number
}

const QUICK_CHUNK = 120 // get it done in a couple of long sittings
const RELAXED_CHUNK = 60 // little and often
const MAX_HORIZON_DAYS = 60 // a deadline in 2027 shouldn't mean 500 iterations

function roundUpTo15(m: number): number {
  return Math.ceil(m / 15) * 15
}

export function maxPerDayFor(pace: Pace): number {
  return pace === 'quick' ? 2 : 1
}

// Same budget, different shape. 4h quick = 2x2h; 4h relaxed = 4x1h.
export function shapeFor(pace: Pace, totalMinutes: number, daysAvailable: number): Shape {
  const chunk = pace === 'quick' ? QUICK_CHUNK : RELAXED_CHUNK
  const ceiling = Math.max(1, daysAvailable * maxPerDayFor(pace))
  const sessions = Math.max(1, Math.min(Math.ceil(totalMinutes / chunk), ceiling))
  // Re-derive the length so the sessions still add up to the budget.
  const minutes = roundUpTo15(Math.ceil(totalMinutes / sessions))
  return { sessions, minutes }
}

// Every gap on ONE calendar date that's long enough to hold `minMinutes`.
// Generalizes the inner loop of nextFreeSlot, but date-aware.
export function freeGapsOn(
  activities: Activity[],
  date: Date,
  minMinutes: number,
  now = new Date(),
): { start: number; end: number }[] {
  const items = activitiesOn(activities, date).sort((a, b) => a.start - b.start)
  const isToday = isoDate(date) === isoDate(now)
  // Don't propose a block that started an hour ago.
  let cursor = isToday
    ? Math.max(DAY_START, roundUpTo15(now.getHours() * 60 + now.getMinutes()))
    : DAY_START

  const gaps: { start: number; end: number }[] = []
  for (const a of items) {
    if (a.start - cursor >= minMinutes) gaps.push({ start: cursor, end: a.start })
    cursor = Math.max(cursor, a.end)
  }
  if (DAY_END - cursor >= minMinutes) gaps.push({ start: cursor, end: DAY_END })
  return gaps
}

export interface PlanRequest {
  activities: Activity[]
  from: Date // today
  deadline: string // 'YYYY-MM-DD', inclusive
  sessions: number
  minutes: number
  pace: Pace
  maxPerDay?: number
  now?: Date
}

// Place `sessions` blocks of `minutes` each, before the deadline, in real gaps.
// May return FEWER than asked — a week with no room says so rather than
// pretending, and the screen tells the user what didn't fit.
export function planSessions(opts: PlanRequest): DateSlot[] {
  const { activities, from, deadline, sessions, minutes, pace } = opts
  const now = opts.now ?? new Date()
  const perDay = opts.maxPerDay ?? maxPerDayFor(pace)

  const dates = candidateDates(from, deadline)
  if (dates.length === 0) return []

  // quick front-loads: earliest dates first. relaxed spreads: stride across the
  // range, then mop up the dates we skipped if anything is still unplaced.
  const order = pace === 'quick' ? dates : spread(dates, sessions)

  // Placed sessions have to block the next one, or two blocks land in the same
  // gap. Keep a working copy and add each placement to it as we go.
  const working = [...activities]
  const placed: DateSlot[] = []
  const perDayCount = new Map<string, number>()

  for (let i = 0; i < sessions; i++) {
    let slot: DateSlot | null = null
    for (const date of order) {
      const iso = isoDate(date)
      if ((perDayCount.get(iso) ?? 0) >= perDay) continue
      const gap = freeGapsOn(working, date, minutes, now)[0]
      if (!gap) continue
      slot = { date: iso, day: weekdayOf(date), start: gap.start, end: gap.start + minutes }
      break
    }
    if (!slot) break // nothing fits anywhere before the deadline

    placed.push(slot)
    perDayCount.set(slot.date, (perDayCount.get(slot.date) ?? 0) + 1)
    working.push(slotAsActivity(slot, i))
  }

  return placed.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1))
}

// Today through the deadline, inclusive.
function candidateDates(from: Date, deadline: string): Date[] {
  const end = dateFromIso(deadline)
  const out: Date[] = []
  for (let i = 0; i < MAX_HORIZON_DAYS; i++) {
    const d = addDays(from, i)
    if (isoDate(d) > isoDate(end)) break
    out.push(d)
  }
  return out
}

// Anchor the sessions evenly across the whole range — first one now, last one
// on the deadline, the rest spaced between. A fixed stride collapses to "every
// day from today" as soon as the day count nears the session count, which is
// how "take your time" ends up finishing on Wednesday for a Friday deadline.
// Dates we skipped follow as fallbacks, for when an anchor day has no room.
function spread(dates: Date[], sessions: number): Date[] {
  if (sessions <= 1 || dates.length <= 1) return dates
  const span = dates.length - 1
  const used = new Set<number>()
  const picked: Date[] = []
  for (let i = 0; i < sessions; i++) {
    const idx = Math.round((i * span) / (sessions - 1))
    if (used.has(idx)) continue
    used.add(idx)
    picked.push(dates[idx]!)
  }
  const rest = dates.filter((_, i) => !used.has(i))
  return [...picked, ...rest]
}

function slotAsActivity(slot: DateSlot, i: number): Activity {
  return {
    id: `plan-working-${i}`,
    title: 'planned',
    day: slot.day,
    start: slot.start,
    end: slot.end,
    kind: 'activity',
    locked: false,
    description: '',
    recurrence: 'once',
    date: slot.date,
  }
}
