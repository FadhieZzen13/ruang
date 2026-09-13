import { describe, expect, it } from 'vitest'
import { isPlanRequest, parseDeadline, parseEffort, parsePace, parseRequest } from './plan-parse'

const NOW = new Date(2026, 8, 13, 9, 0) // Sunday 13 Sep 2026

describe('isPlanRequest', () => {
  it('fires on an actual request, in either language', () => {
    for (const line of [
      'ruang, plan the group report due monday',
      'plan the lab report',
      'schedule my thesis draft',
      'jadwalin tugas MGT 204 besok',
      'bikin jadwal buat skripsi',
    ]) {
      expect(isPlanRequest(line), line).toBe(true)
    }
  })

  it('stays out of ordinary chatter', () => {
    for (const line of [
      'report due monday guys',
      'anyone free for futsal friday?',
      'i finished the lab report',
      'what time is the meeting',
    ]) {
      expect(isPlanRequest(line), line).toBe(false)
    }
  })
})

describe('parseDeadline', () => {
  it('reads the ways people actually write dates', () => {
    expect(parseDeadline('due monday', NOW)).toBe('2026-09-14')
    expect(parseDeadline('due friday', NOW)).toBe('2026-09-18')
    expect(parseDeadline('besok', NOW)).toBe('2026-09-14')
    expect(parseDeadline('due 20 sep', NOW)).toBe('2026-09-20')
    expect(parseDeadline('due sept 20', NOW)).toBe('2026-09-20')
    expect(parseDeadline('in 3 days', NOW)).toBe('2026-09-16')
    expect(parseDeadline('3 hari lagi', NOW)).toBe('2026-09-16')
  })

  it('reads a weekday as the NEXT one, not today', () => {
    // NOW is a Sunday; "sunday" means the one coming, not this morning.
    expect(parseDeadline('due sunday', NOW)).toBe('2026-09-20')
  })

  it('rolls a past date into next year', () => {
    expect(parseDeadline('due 5 jan', NOW)).toBe('2027-01-05')
  })

  it('returns null when the message never says — that becomes the question', () => {
    expect(parseDeadline('plan the lab report', NOW)).toBeNull()
    expect(parseDeadline('plan it quickly, 4 hours', NOW)).toBeNull()
  })
})

describe('parseEffort', () => {
  it.each([
    ['4 hours', 240],
    ['6h', 360],
    ['2 jam', 120],
    ['half a day', 240],
    ['setengah hari', 240],
    ['a full day', 480],
    ['90 minutes', 90],
  ])('%s → %i minutes', (input, expected) => {
    expect(parseEffort(input)).toBe(expected)
  })

  it('is null when unsaid, so the default applies silently', () => {
    expect(parseEffort('plan the lab report due friday')).toBeNull()
  })
})

describe('parsePace', () => {
  it('hears urgency and its opposite', () => {
    expect(parsePace('get it over with quickly')).toBe('quick')
    expect(parsePace('cepat dong')).toBe('quick')
    expect(parsePace('santai aja')).toBe('relaxed')
    expect(parsePace('spread it out')).toBe('relaxed')
    expect(parsePace('plan the lab report')).toBeNull()
  })
})

describe('parseRequest', () => {
  it('pulls the title out from under the scheduling words', () => {
    expect(parseRequest('ruang, plan the group report due monday', NOW)).toEqual({
      title: 'Group report',
      deadline: '2026-09-14',
      minutes: null,
      pace: null,
    })
  })

  it('takes everything at once when it is all there', () => {
    expect(parseRequest('plan literature review due 20 sep, 6 hours, quickly', NOW)).toEqual({
      title: 'Literature review',
      deadline: '2026-09-20',
      minutes: 360,
      pace: 'quick',
    })
  })

  it('does not turn the request wording into the task title', () => {
    expect(parseRequest('can you build a plan for me', NOW)).toEqual({
      title: '',
      deadline: null,
      minutes: null,
      pace: null,
    })
  })
})

describe('spoken dates and rambling titles', () => {
  it('reads "20th of september" as a deadline, not as part of the title', () => {
    const r = parseRequest('plan the lab report due 20th of september', NOW)
    expect(r.deadline).toBe('2026-09-20')
    expect(r.title).toBe('Lab report')
  })

  it('accepts the same date however it is said', () => {
    for (const line of ['due 20 sep', 'due sept 20', 'due 20th of september', 'due september 20th']) {
      expect(parseDeadline(line, NOW), line).toBe('2026-09-20')
    }
  })

  it('keeps the assignment title when the date is spoken conversationally', () => {
    expect(parseRequest('plan the assignment is on the 15th of sept tuesday', NOW)).toEqual({
      title: 'Assignment',
      deadline: '2026-09-15',
      minutes: null,
      pace: null,
    })
  })

  it('drops a whole transcript instead of echoing it back as a title', () => {
    const rambling =
      "when's the build me i have to submit task on 20th of september i want it to be out three days due"
    expect(parseRequest(rambling, NOW).title).toBe('')
  })
})
