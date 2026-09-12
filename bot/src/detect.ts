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
// Mix of English + Indonesian slang, since that's how students actually invite.
const INTENT_WORDS =
  /\b(meet|meeting|meet-?up|hang|hangout|catch ?up|kopo|gotcha|gather|study|discuss|sync|standup|call|zoom|futsal|sports?|badminton|gym|workout|work ?out|run|jog|rehearsal|rehearse|practice|training|match|scrim|dinner|lunch|breakfast|brunch|supper|coffee|kopi|ngopi|tea|boba|cimol|date|ngedate|movie|film|cinema|nonton|nobar|watch|game|gaming|mabar|ranked|main|board ?game|karaoke|picnic|trip|jalan|jalan-?jalan|hike|hiking|swim|renang|yoga|zumba|basketball|basket|volley|tennis|bowling|billiard|fotbar|makan|makan-?makan|bukber|sahur|nongkrong|ngumpul|kumpul|jemput|antar|shopping|belanja|mall|cafe|warteg|rapat|diskusi|belajar|les|ngerjain|tugas|project|presentation|presentasi|kerja ?kelompok|party|pesta|ultah|birthday|wedding|nikahan|reunion|reuni|concert|konser|gig)\b/i

// Accepts 3pm, 3 pm, 3:30pm, "3:00 p.m.", 15:00.
const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s?m\.?)?/i

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}
const MONTH_RE = Object.keys(MONTHS).join('|')

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
  // Calendar dates: "13 september", "sept 30".
  let dayNum: number | undefined
  let mon: number | undefined
  let m = body.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b`, 'i'))
  if (m) { dayNum = parseInt(m[1]!, 10); mon = MONTHS[m[2]!.toLowerCase()] }
  else {
    m = body.match(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'))
    if (m) { mon = MONTHS[m[1]!.toLowerCase()]; dayNum = parseInt(m[2]!, 10) }
  }
  if (dayNum != null && mon != null && dayNum >= 1 && dayNum <= 31) {
    let date = new Date(now.getFullYear(), mon, dayNum)
    if (date.getTime() < now.getTime() - 86_400_000) date = new Date(now.getFullYear() + 1, mon, dayNum)
    return JS_DAY[date.getDay()]!
  }
  return null
}

export function parseTime(body: string): number | null {
  // Strip date phrases first, so "13 September" isn't read as 1pm.
  const clean = body
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), ' ')
  const m = clean.match(TIME_PATTERN)
  if (!m) return null
  let hour = parseInt(m[1]!, 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]?.toLowerCase()
  if (ap === 'p' && hour < 12) hour += 12
  if (ap === 'a' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
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
