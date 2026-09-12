import type { Activity, Day } from './types'
import { DAY_ORDER } from './types'

export interface OverlapResult {
  busy: boolean
  conflict: Activity | null
}

// Does a slot overlap any existing activity? Returns the first conflicting one.
export function findConflict(
  activities: Activity[],
  day: Day,
  start: number,
  end: number,
  ignoreId?: string,
): OverlapResult {
  const conflict =
    activities.find(
      (a) => a.id !== ignoreId && a.day === day && start < a.end && end > a.start,
    ) ?? null
  return { busy: conflict !== null, conflict }
}

// The free/busy scan behind the counter-offer. Walk the same day, then the
// following days, and return the first gap long enough to hold `minutes`.
export function nextFreeSlot(
  activities: Activity[],
  day: Day,
  minutes: number,
  after: number,
): { day: Day; start: number } | null {
  let cursorDay = day
  // cheap + safe: scan the current day and the six after it, wrapping.
  for (let offset = 0; offset < 7; offset++) {
    const d = dayFromOffset(cursorDay, offset)
    const today = activities.filter((a) => a.day === d).sort((x, y) => x.start - y.start)
    let cursor = offset === 0 ? after : 0
    for (const a of today) {
      if (cursor + minutes <= a.start) {
        return { day: d, start: cursor }
      }
      cursor = Math.max(cursor, a.end)
    }
    if (cursor + minutes <= 23 * 60) {
      return { day: d, start: cursor }
    }
  }
  return null
}

function dayFromOffset(day: Day, offset: number): Day {
  const order: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const idx = order.indexOf(day)
  return order[(idx + offset) % 7]
}

// Chaos rebalance: if the slot is busy, suggest moving the proposed activity
// to the next free slot on a later day. Returns null if already free.
export function rebalance(
  activities: Activity[],
  day: Day,
  start: number,
  minutes: number,
): { day: Day; start: number } | null {
  const { busy } = findConflict(activities, day, start, start + minutes)
  if (!busy) return null
  return nextFreeSlot(activities, day, minutes, start)
}

// Expand one planned activity into the concrete entries to store. A weekly
// recurrence becomes one entry per remaining day of the week (Mon..Sun); a
// one-off stays a single entry on its own day.
export function expandRecurring(
  base: Omit<Activity, 'id' | 'day'> & { day: Day },
  idFor: (day: Day, i: number) => string,
): Activity[] {
  if (base.recurrence !== 'weekly') {
    return [{ ...base, id: idFor(base.day, 0) }]
  }
  const startIdx = DAY_ORDER.indexOf(base.day)
  return DAY_ORDER.slice(startIdx).map((day, i) => ({
    ...base,
    id: idFor(day, i),
    day,
  }))
}
