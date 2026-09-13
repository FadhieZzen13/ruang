import { describe, expect, it } from 'vitest'
import type { Activity } from './types'
import { DAY_START, DAY_END } from './scheduling'
import { freeGapsOn, planSessions, shapeFor } from './planner'
import { dateFromIso, isoDate, weekdayOfIso } from './occurrence'

// Monday 14 Sept 2026, 9:00am. Fixed so the tests don't drift with the clock.
const NOW = new Date(2026, 8, 14, 9, 0)
const FROM = new Date(2026, 8, 14)
const DEADLINE = '2026-09-18' // Friday

function act(over: Partial<Activity> & { day: Activity['day']; start: number; end: number }): Activity {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'thing',
    kind: 'class',
    locked: true,
    description: '',
    recurrence: 'weekly',
    ...over,
  }
}

function overlaps(a: { date: string; start: number; end: number }, b: { date: string; start: number; end: number }) {
  return a.date === b.date && a.start < b.end && b.start < a.end
}

describe('shapeFor', () => {
  it('keeps the budget and changes only the shape', () => {
    const quick = shapeFor('quick', 240, 5)
    const relaxed = shapeFor('relaxed', 240, 5)

    expect(quick).toEqual({ sessions: 2, minutes: 120 })
    expect(relaxed).toEqual({ sessions: 4, minutes: 60 })
    expect(quick.sessions * quick.minutes).toBe(relaxed.sessions * relaxed.minutes)
  })

  it('never asks for more sessions than there are days to hold them', () => {
    const { sessions, minutes } = shapeFor('relaxed', 480, 2)
    expect(sessions).toBeLessThanOrEqual(2)
    expect(sessions * minutes).toBeGreaterThanOrEqual(480)
  })
})

describe('freeGapsOn', () => {
  it('finds the gaps around a booked day', () => {
    const acts = [act({ day: 'tue', start: 10 * 60, end: 12 * 60 })]
    const gaps = freeGapsOn(acts, dateFromIso('2026-09-15'), 60, NOW)
    expect(gaps).toEqual([
      { start: DAY_START, end: 10 * 60 },
      { start: 12 * 60, end: DAY_END },
    ])
  })

  it('does not offer time that has already passed today', () => {
    const gaps = freeGapsOn([], new Date(2026, 8, 14), 60, new Date(2026, 8, 14, 14, 5))
    expect(gaps[0]!.start).toBe(14 * 60 + 15) // rounded up from 14:05, not 8am
  })

  it('ignores a pinned block on a different date', () => {
    const acts = [act({ day: 'tue', start: 10 * 60, end: 12 * 60, date: '2026-09-22', recurrence: 'once' })]
    const gaps = freeGapsOn(acts, dateFromIso('2026-09-15'), 60, NOW)
    expect(gaps).toEqual([{ start: DAY_START, end: DAY_END }])
  })
})

describe('planSessions', () => {
  const base = { activities: [], from: FROM, deadline: DEADLINE, now: NOW }

  it('places every session inside waking hours and before the deadline', () => {
    const slots = planSessions({ ...base, sessions: 4, minutes: 60, pace: 'relaxed' })

    expect(slots).toHaveLength(4)
    for (const s of slots) {
      expect(s.start).toBeGreaterThanOrEqual(DAY_START)
      expect(s.end).toBeLessThanOrEqual(DAY_END)
      expect(s.date <= DEADLINE).toBe(true)
      expect(s.day).toBe(weekdayOfIso(s.date))
    }
  })

  it('never books two sessions into the same gap', () => {
    const slots = planSessions({ ...base, sessions: 4, minutes: 120, pace: 'quick' })
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        expect(overlaps(slots[i]!, slots[j]!)).toBe(false)
      }
    }
  })

  it('works around what is already in the week', () => {
    const activities = [
      act({ day: 'mon', start: 8 * 60, end: 18 * 60 }),
      act({ day: 'tue', start: 8 * 60, end: 18 * 60 }),
    ]
    const slots = planSessions({ ...base, activities, sessions: 3, minutes: 60, pace: 'relaxed' })

    for (const s of slots) {
      const day = weekdayOfIso(s.date)
      const clash = activities.some((a) => a.day === day && s.start < a.end && a.start < s.end)
      expect(clash).toBe(false)
    }
  })

  it('front-loads when quick and spreads out when relaxed', () => {
    const quick = planSessions({ ...base, sessions: 2, minutes: 120, pace: 'quick' })
    const relaxed = planSessions({ ...base, sessions: 2, minutes: 60, pace: 'relaxed' })

    expect(quick.every((s) => s.date === isoDate(FROM))).toBe(true) // both today, maxPerDay 2
    expect(new Set(relaxed.map((s) => s.date)).size).toBe(2) // one a day
    // Relaxed uses the whole run-up: first session now, last one on the deadline.
    expect(relaxed[0]!.date).toBe(isoDate(FROM))
    expect(relaxed[relaxed.length - 1]!.date).toBe(DEADLINE)
  })

  it('spreads across the range instead of finishing days early', () => {
    const slots = planSessions({ ...base, sessions: 4, minutes: 60, pace: 'relaxed' })
    // Mon 14 to Fri 18 is 5 days for 4 sessions — the last one belongs at the end.
    expect(slots[slots.length - 1]!.date).toBe(DEADLINE)
  })

  it('returns what fits rather than throwing when the week is full', () => {
    const activities = (['mon', 'tue', 'wed', 'thu', 'fri'] as const).map((day) =>
      act({ day, start: DAY_START, end: DAY_END }),
    )
    const slots = planSessions({ ...base, activities, sessions: 4, minutes: 60, pace: 'relaxed' })
    expect(slots).toEqual([])
  })

  it('handles a deadline of today', () => {
    const slots = planSessions({ ...base, deadline: isoDate(FROM), sessions: 2, minutes: 60, pace: 'quick' })
    expect(slots.every((s) => s.date === isoDate(FROM))).toBe(true)
  })
})
