import type { Day } from './types'

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

const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i

export function parseDay(body: string): Day | null {
  for (const [day, re] of DAY_PATTERNS) {
    if (re.test(body)) return day
  }
  return null
}

export function parseTime(body: string): number | null {
  const m = body.match(TIME_PATTERN)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]?.toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}
