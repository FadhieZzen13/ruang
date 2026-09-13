import { describe, expect, it } from 'vitest'
import type { Activity } from './types'
import { busyOnDate, dateFromIso, isoDate, occursOn, shiftToWeekday, weekdayOfIso } from './occurrence'
import { googleCalendarUrl } from '../app/calendar-link'

function act(over: Partial<Activity>): Activity {
  return {
    id: 'a1',
    title: 'thing',
    day: 'mon',
    start: 9 * 60,
    end: 10 * 60,
    kind: 'class',
    locked: false,
    description: '',
    recurrence: 'weekly',
    ...over,
  }
}

describe('isoDate', () => {
  // The whole reason this helper exists. toISOString() converts to UTC first,
  // so anywhere east of Greenwich an evening date rolls back to yesterday.
  it('uses the local date, not UTC', () => {
    const lateEvening = new Date(2026, 8, 13, 23, 30)
    expect(isoDate(lateEvening)).toBe('2026-09-13')
  })

  it('round-trips through dateFromIso', () => {
    expect(isoDate(dateFromIso('2026-01-05'))).toBe('2026-01-05')
    expect(weekdayOfIso('2026-09-18')).toBe('fri')
  })
})

describe('occursOn', () => {
  const date = dateFromIso('2026-09-16') // a Wednesday

  it('floats on the weekday when there is no date', () => {
    expect(occursOn(act({ day: 'wed' }), date)).toBe(true)
    expect(occursOn(act({ day: 'thu' }), date)).toBe(false)
  })

  it('pins to the exact date when there is one', () => {
    const pinned = act({ day: 'wed', date: '2026-09-16', recurrence: 'once' })
    expect(occursOn(pinned, date)).toBe(true)
    expect(occursOn(pinned, dateFromIso('2026-09-23'))).toBe(false) // next Wednesday
  })
})

describe('busyOnDate', () => {
  it('only clashes with things happening that day', () => {
    const acts = [
      act({ id: 'x', day: 'wed', start: 9 * 60, end: 11 * 60, date: '2026-09-23', recurrence: 'once' }),
    ]
    expect(busyOnDate(acts, dateFromIso('2026-09-16'), 9 * 60, 10 * 60)).toBeNull()
    expect(busyOnDate(acts, dateFromIso('2026-09-23'), 9 * 60, 10 * 60)?.id).toBe('x')
  })
})

describe('shiftToWeekday', () => {
  it('walks the date forward to the new weekday', () => {
    expect(shiftToWeekday('2026-09-16', 'fri')).toBe('2026-09-18') // Wed -> Fri
    expect(shiftToWeekday('2026-09-16', 'tue')).toBe('2026-09-22') // Wed -> next Tue
    expect(shiftToWeekday('2026-09-16', 'wed')).toBe('2026-09-16') // unchanged
  })
})

describe('googleCalendarUrl', () => {
  it('sends local wall-clock time, never a UTC conversion', () => {
    const url = googleCalendarUrl({
      title: 'Literature Review',
      date: '2026-09-17',
      start: 16 * 60, // 4pm
      end: 18 * 60,
      details: 'Outline and gather',
    })
    const dates = new URL(url).searchParams.get('dates')
    // 4pm stays 4pm. A toISOString() slip would show 09:00 here in UTC+7.
    expect(dates).toBe('20260917T160000/20260917T180000')
    expect(new URL(url).searchParams.get('text')).toBe('Literature Review')
  })
})
