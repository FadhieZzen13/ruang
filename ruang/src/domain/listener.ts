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

export function parseDay(body: string, now = new Date()): Day | null {
  for (const [day, re] of DAY_PATTERNS) {
    if (re.test(body)) return day
  }
  if (/\btomorrow\b/i.test(body)) return JS_DAY[(now.getDay() + 1) % 7]!
  if (/\b(today|tonight|tonite)\b/i.test(body)) return JS_DAY[now.getDay()]!
  return null
}

export function parseTime(body: string): number | null {
  const m = body.match(TIME_PATTERN)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]?.toLowerCase() // 'a' | 'p' | undefined
  if (ap === 'p' && hour < 12) hour += 12
  if (ap === 'a' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}
