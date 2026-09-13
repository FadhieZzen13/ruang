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

// Waking hours — don't suggest 3am. Free slots live between these.
export const DAY_START = 8 * 60 // 8am
export const DAY_END = 22 * 60 // 10pm

// The free/busy scan behind the counter-offer. Walk the same day, then the
// following days, and return the first daytime gap long enough to hold `minutes`.
export function nextFreeSlot(
  activities: Activity[],
  day: Day,
  minutes: number,
  after: number,
): { day: Day; start: number } | null {
  const cursorDay = day
  for (let offset = 0; offset < 7; offset++) {
    const d = dayFromOffset(cursorDay, offset)
    const today = activities.filter((a) => a.day === d).sort((x, y) => x.start - y.start)
    let cursor = offset === 0 ? Math.max(after, DAY_START) : DAY_START
    for (const a of today) {
      if (cursor + minutes <= a.start) {
        return { day: d, start: cursor }
      }
      cursor = Math.max(cursor, a.end)
    }
    if (cursor + minutes <= DAY_END) {
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

// A single way to resolve (or accept) a proposed new slot.
export type ResolveOption =
  | { kind: 'place'; day: Day; start: number; label: 'free' | 'move-new' | 'anyway' }
  | {
      kind: 'move-existing'
      id: string
      title: string
      fromDay: Day
      fromStart: number
      toDay: Day
      toStart: number
      toEnd: number
    }
  | { kind: 'skip' }

export interface Negotiation {
  free: boolean
  conflicts: Activity[] // everything overlapping the requested slot
  locked: Activity[] // conflicts that can't be moved (classes, shifts)
  options: ResolveOption[]
}

// Check the calendar and lay out the choices, so the USER decides how to
// resolve a clash instead of the app deciding for them. Movable (unlocked)
// blockers can be shifted; locked ones (class/shift) can't and are only named.
export function negotiate(
  activities: Activity[],
  day: Day,
  start: number,
  minutes: number,
): Negotiation {
  const end = start + minutes
  const conflicts = activities.filter((a) => a.day === day && start < a.end && end > a.start)
  if (conflicts.length === 0) {
    return { free: true, conflicts: [], locked: [], options: [{ kind: 'place', day, start, label: 'free' }] }
  }

  const options: ResolveOption[] = []
  // 1) Move each movable blocker out of the way — the new thing keeps the slot.
  for (const c of conflicts) {
    if (c.locked) continue
    const dur = c.end - c.start
    const slot = nextFreeSlot(activities.filter((a) => a.id !== c.id), c.day, dur, end)
    if (slot) {
      options.push({
        kind: 'move-existing', id: c.id, title: c.title,
        fromDay: c.day, fromStart: c.start,
        toDay: slot.day, toStart: slot.start, toEnd: slot.start + dur,
      })
    }
  }
  // 2) Move the new thing to the next free slot.
  const newSlot = nextFreeSlot(activities, day, minutes, end)
  if (newSlot) options.push({ kind: 'place', day: newSlot.day, start: newSlot.start, label: 'move-new' })
  // 3) Keep it anyway (double-book).
  options.push({ kind: 'place', day, start, label: 'anyway' })
  // 4) Skip.
  options.push({ kind: 'skip' })

  return { free: false, conflicts, locked: conflicts.filter((c) => c.locked), options }
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
  // A weekly thing floats on its weekday — carrying one date across all seven
  // copies would pin Tuesday's clone to Monday's date.
  const { date: _pinned, ...floating } = base
  const startIdx = DAY_ORDER.indexOf(base.day)
  return DAY_ORDER.slice(startIdx).map((day, i) => ({
    ...floating,
    id: idFor(day, i),
    day,
  }))
}
