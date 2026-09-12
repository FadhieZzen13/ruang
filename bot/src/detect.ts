import type { Day } from './types.js'

// Cheap keyword/day/time detection — the same heuristics the app uses. This is
// the POC path; production would hand the message to the LLM agent. Ported from
// ruang/src/domain/listener.ts so the two sides read messages the same way.
// ponytail: duplicated with the app on purpose — the bot is a separate service.

const DAY_PATTERNS: [Day, RegExp][] = [
  ['mon', /monday|\bmon\b/i],
  ['tue', /tuesday|\btues\b|\btue\b/i],
  ['wed', /wednesday|\bwed\b/i],
  ['thu', /thursday|\bthurs\b|\bthu\b/i],
  ['fri', /friday|\bfri\b/i],
  ['sat', /saturday|\bsat\b/i],
  ['sun', /sunday|\bsun\b/i],
]

// Activity-type words. The listener watches for these; anything else in a group
// message is ignored. Add words that mean "let's do something" — the more casual
// ones (dinner, coffee, date) matter most because students don't say "meeting".
const INTENT_WORDS =
  /\b(meet|meeting|meet-up|meetup|hang|hangout|catch up|kopo|gotcha|gather|study|discuss|sync|futsal|sports|badminton|gym|run|jog|rehearsal|practice|training|dinner|lunch|breakfast|brunch|supper|coffee|kopi|tea|boba|date|movie|film|cinema|watch|game|gaming|board game|karaoke|picnic|trip|hike|swim|yoga|zumba|basketball|volley|tennis|fotbar|makan|nongkrong|main|jemput|antar)\b/i

const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i

export interface Detection {
  isActivity: boolean
  day: Day | null
  time: number | null
  title: string
}

export function detect(body: string): Detection {
  return {
    isActivity: INTENT_WORDS.test(body),
    day: parseDay(body),
    time: parseTime(body),
    title: extractTitle(body),
  }
}

// JS getDay(): 0=Sun..6=Sat
const JS_DAY: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function parseDay(body: string, now = new Date()): Day | null {
  // Explicit weekday wins.
  for (const [day, re] of DAY_PATTERNS) {
    if (re.test(body)) return day
  }
  // Relative days, resolved against today.
  if (/\btomorrow\b/i.test(body)) return JS_DAY[(now.getDay() + 1) % 7]!
  if (/\b(today|tonight|tonite)\b/i.test(body)) return JS_DAY[now.getDay()]!
  return null
}

export function parseTime(body: string): number | null {
  const m = body.match(TIME_PATTERN)
  if (!m) return null
  let hour = parseInt(m[1]!, 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3]?.toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  return hour * 60 + minute
}

function extractTitle(body: string): string {
  const t = body
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi, '')
    .replace(/\b(tomorrow|today|tonight|tonite)\b/gi, '')
    .replace(/\b(on|at|this|next|lets|let's|wanna|want to|we should|yo|hey)\b/gi, '')
    .replace(/\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '')
    .replace(/[?!.]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t || body.trim()
}
