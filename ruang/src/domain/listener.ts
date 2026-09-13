import type { Day } from './types'
import { JS_DAY } from './types'

// Lightweight day/time extraction. Used as the offline fallback when the LLM
// agent is unavailable — the real understanding now happens in app/agent.ts.

const DAY_PATTERNS: [Day, RegExp][] = [
  ['mon', /monday|\bmon\b/i],
  ['tue', /tuesday|\btues\b|\btue\b/i],
  ['wed', /wednesday|\bwed\b/i],
  ['thu', /thursday|\bthurs\b|\bthu\b/i],
  ['fri', /friday|\bfri\b/i],
  ['sat', /saturday|\bsat\b/i],
  ['sun', /sunday|\bsun\b/i],
]

// Accepts 3pm, 3 pm, 3:30pm, "3:00 p.m.", 15:00, bare "3".
const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s?m\.?)?/i

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}
const MONTH_RE = Object.keys(MONTHS).join('|')

export function parseDay(body: string, now = new Date()): Day | null {
  for (const [day, re] of DAY_PATTERNS) {
    if (re.test(body)) return day
  }
  if (/\btomorrow\b/i.test(body)) return JS_DAY[(now.getDay() + 1) % 7]!
  if (/\b(today|tonight|tonite)\b/i.test(body)) return JS_DAY[now.getDay()]!
  return parseDate(body, now)
}

// "13 september" / "september 13" / "sept 13th" / "13 sep" -> the weekday it lands on.
export function parseDate(body: string, now = new Date()): Day | null {
  let dayNum: number | undefined
  let mon: number | undefined
  let m = body.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b`, 'i'))
  if (m) {
    dayNum = parseInt(m[1], 10)
    mon = MONTHS[m[2].toLowerCase()]
  } else {
    m = body.match(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'))
    if (m) {
      mon = MONTHS[m[1].toLowerCase()]
      dayNum = parseInt(m[2], 10)
    }
  }
  if (dayNum == null || mon == null || dayNum < 1 || dayNum > 31) return null
  let date = new Date(now.getFullYear(), mon, dayNum)
  // A date clearly in the past means they mean next year.
  if (date.getTime() < now.getTime() - 86_400_000) date = new Date(now.getFullYear() + 1, mon, dayNum)
  return JS_DAY[date.getDay()]!
}

export function parseTime(body: string): number | null {
  // Strip date phrases first, so "13 September" isn't read as 1pm.
  const clean = body
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH_RE})\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), ' ')
  const m = clean.match(TIME_PATTERN)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]?.toLowerCase() // 'a' | 'p' | undefined
  if (ap === 'p' && hour < 12) hour += 12
  if (ap === 'a' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}
