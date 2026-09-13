import { describe, expect, it } from 'vitest'
import { makeSession } from './task'
import { icsFilename, slugify, toIcs } from './ics'

const sessions = [
  makeSession('2026-09-15', 20 * 60, 60, 'Research', 's1'),
  makeSession('2026-09-17', 20 * 60, 60, 'Write report', 's2'),
  makeSession('2026-09-19', 19 * 60, 60, 'Review', 's3'),
  makeSession('2026-09-20', 23 * 60, 30, 'Submit', 's4'),
]
const NOW = new Date(Date.UTC(2026, 8, 13, 5, 0, 0))

describe('toIcs', () => {
  const ics = toIcs({ title: 'Group Assignment', sessions }, NOW)

  it('carries every session in one file', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('writes local wall-clock times, so 8pm imports as 8pm', () => {
    expect(ics).toContain('DTSTART:20260915T200000')
    expect(ics).toContain('DTEND:20260915T210000')
    expect(ics).toContain('DTSTART:20260920T230000')
    expect(ics).toContain('DTEND:20260920T233000')
    // No Z on the event times — that would be a UTC conversion.
    expect(ics).not.toMatch(/DTSTART:\d+T\d+Z/)
  })

  it('stamps DTSTAMP in UTC, as the spec requires', () => {
    expect(ics).toContain('DTSTAMP:20260913T050000Z')
  })

  it('uses CRLF line endings', () => {
    expect(ics.split('\r\n').length).toBeGreaterThan(10)
    expect(ics).not.toMatch(/[^\r]\n/)
  })

  it('names each event for the task and the sitting', () => {
    expect(ics).toContain('SUMMARY:Group Assignment — Research')
  })

  it('escapes characters that are delimiters in the format', () => {
    const tricky = toIcs(
      { title: 'Report, draft; v2\\final', sessions: [makeSession('2026-09-15', 600, 60, 'a,b;c', 'x')] },
      NOW,
    )
    expect(tricky).toContain('SUMMARY:Report\\, draft\\; v2\\\\final — a\\,b\\;c')
  })

  it('folds lines longer than 75 characters', () => {
    const long = toIcs(
      { title: 'x'.repeat(200), sessions: [makeSession('2026-09-15', 600, 60, 'note', 'x')] },
      NOW,
    )
    for (const line of long.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
  })
})

describe('slugify / icsFilename', () => {
  it('reads as the task and the group', () => {
    expect(slugify('Group Report', 'MGT 204 group')).toBe('group-report-mgt-204-group')
    expect(icsFilename('Literature Review', 'ENG 301')).toBe('literature-review-eng-301.ics')
  })

  it('copes with punctuation, accents and emptiness', () => {
    expect(slugify('Tugas — Análisis!!')).toBe('tugas-analisis')
    expect(slugify('')).toBe('plan')
    expect(slugify('...')).toBe('plan')
  })
})
