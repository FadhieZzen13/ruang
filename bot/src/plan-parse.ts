import type { Day } from './types.js'
import type { Pace, PlanRequest } from './plan.js'
import { isoDate } from './plan.js'

// Reading "ruang, plan the group report due monday, 4 hours" off a chat line.
//
// Everything here is best-effort and allowed to come back null: whatever is
// missing becomes ONE question, asked privately. It never guesses a deadline —
// that's the one thing worth interrupting you for.

const TRIGGER = /\b(?:ruang[,:]?\s*)?(?:plan|schedule|jadwal(?:kan|in)?|bikin\s+jadwal|atur\s+jadwal|build(?:\s+me)?(?:\s+a)?\s+plan)\b/i

const DAY_WORDS: [Day, RegExp][] = [
  ['mon', /\b(monday|mon|senin|senen)\b/i],
  ['tue', /\b(tuesday|tues|tue|selasa)\b/i],
  ['wed', /\b(wednesday|wed|rabu|rebo)\b/i],
  ['thu', /\b(thursday|thurs|thu|kamis|kemis)\b/i],
  ['fri', /\b(friday|fri|jumat|jum'at)\b/i],
  ['sat', /\b(saturday|sat|sabtu)\b/i],
  ['sun', /\b(sunday|sun|minggu|ahad)\b/i],
]
const DAY_ORDER: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, mei: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, agustus: 7,
  sep: 8, sept: 8, september: 8, oct: 9, okt: 9, october: 9, oktober: 9,
  nov: 10, november: 10, dec: 11, des: 11, december: 11, desember: 11,
}
const MONTH_RE = Object.keys(MONTHS).join('|')

export function isPlanRequest(body: string): boolean {
  return TRIGGER.test(body)
}

// 'YYYY-MM-DD', or null when the message doesn't say when it's due.
export function parseDeadline(body: string, now = new Date()): string | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (/\b(today|tonight|hari ini|malam ini)\b/i.test(body)) return isoDate(today)
  if (/\b(tomorrow|besok|esok)\b/i.test(body)) {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return isoDate(d)
  }

  // "in 3 days" / "3 hari lagi"
  const rel = body.match(/\bin\s+(\d{1,2})\s+days?\b|\b(\d{1,2})\s+hari\s+lagi\b/i)
  if (rel) {
    const n = parseInt(rel[1] ?? rel[2] ?? '0', 10)
    if (n > 0) {
      const d = new Date(today)
      d.setDate(d.getDate() + n)
      return isoDate(d)
    }
  }

  // "20 sep" / "sep 20"
  let dayNum: number | undefined
  let mon: number | undefined
  let m = body.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\b`, 'i'))
  if (m) {
    dayNum = parseInt(m[1]!, 10)
    mon = MONTHS[m[2]!.toLowerCase()]
  } else {
    m = body.match(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'))
    if (m) {
      mon = MONTHS[m[1]!.toLowerCase()]
      dayNum = parseInt(m[2]!, 10)
    }
  }
  if (dayNum != null && mon != null && dayNum >= 1 && dayNum <= 31) {
    let d = new Date(now.getFullYear(), mon, dayNum)
    if (d.getTime() < today.getTime()) d = new Date(now.getFullYear() + 1, mon, dayNum)
    return isoDate(d)
  }

  // A weekday name means the next one coming up.
  for (const [day, re] of DAY_WORDS) {
    if (!re.test(body)) continue
    const want = DAY_ORDER.indexOf(day)
    const have = today.getDay()
    const delta = (want - have + 7) % 7 || 7 // "monday" on a Monday means next Monday
    const d = new Date(today)
    d.setDate(d.getDate() + delta)
    return isoDate(d)
  }

  return null
}

// "4 hours", "4h", "2 jam", "half a day", "a day"
export function parseEffort(body: string): number | null {
  if (/\bhalf\s+a?\s*day\b|\bsetengah\s+hari\b/i.test(body)) return 240
  if (/\b(a|one|1)\s+(full\s+)?day\b|\bsehari\b|\bseharian\b/i.test(body)) return 480

  const m = body.match(/\b(\d{1,2})(?:\.5)?\s*(?:h|hr|hrs|hour|hours|jam)\b/i)
  if (m) {
    const hours = parseFloat(body.slice(m.index!).match(/\d{1,2}(?:\.5)?/)![0])
    if (hours > 0 && hours <= 24) return Math.round(hours * 60)
  }

  const mins = body.match(/\b(\d{1,3})\s*(?:m|min|mins|minutes|menit)\b/i)
  if (mins) {
    const n = parseInt(mins[1]!, 10)
    if (n >= 15 && n <= 1440) return n
  }
  return null
}

export function parsePace(body: string): Pace | null {
  if (/\b(quick|quickly|fast|asap|cepat|buruan|sekalian|get it over|one go|sekali)\b/i.test(body)) {
    return 'quick'
  }
  if (/\b(slow|spread|santai|pelan|take my time|bit by bit|cicil|nyicil)\b/i.test(body)) {
    return 'relaxed'
  }
  return null
}

// Strip the command words and the scheduling details, leaving the thing itself.
export function parseTitle(body: string): string {
  const t = body
    .replace(TRIGGER, ' ')
    .replace(/\b(due|deadline|by|before|sebelum|paling lambat|dl)\b/gi, ' ')
    .replace(/\b(?:is|it's|it is)\s+on\b/gi, ' ')
    .replace(/\bme\b/gi, ' ')
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH_RE})\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), ' ')
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues|tue|wed|thurs|thu|fri|sat|sun|senin|senen|selasa|rabu|rebo|kamis|kemis|jumat|jum'at|sabtu|minggu|ahad)\b/gi, ' ')
    .replace(/\b(today|tonight|tomorrow|besok|esok|hari ini|malam ini)\b/gi, ' ')
    .replace(/\bin\s+\d{1,2}\s+days?\b|\b\d{1,2}\s+hari\s+lagi\b/gi, ' ')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:[ap])\.?\s?m\.?\b/gi, ' ')
    .replace(/\b\d{1,2}(?:\.5)?\s*(?:h|hr|hrs|hour|hours|jam)\b/gi, ' ')
    .replace(/\b\d{1,3}\s*(?:m|min|mins|minutes|menit)\b/gi, ' ')
    .replace(/\bhalf\s+a?\s*day\b|\bsetengah\s+hari\b|\b(a|one|1)\s+(full\s+)?day\b|\bsehari\b/gi, ' ')
    .replace(/\b(quick|quickly|fast|asap|cepat|slow|spread|santai|pelan|cicil|nyicil)\b/gi, ' ')
    // "could you plan X" / "bisa jadwalin X" — politeness, not the title.
    .replace(/\b(could|can|would|will|bisa|bisakah)\s+(you|u|kamu|lo|lu)?\b/gi, ' ')
    .replace(/\b(the|my|our|a|an|for|on|please|pls|tolong|mohon|dong|ya|yah|buat|untuk|ruang)\b/gi, ' ')
    .replace(/[,:;.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // "group report" reads better as "Group report" when it's quoted back at you.
  return t ? t[0]!.toUpperCase() + t.slice(1) : t
}

export function parseRequest(body: string, now = new Date()): PlanRequest {
  return {
    title: parseTitle(body),
    deadline: parseDeadline(body, now),
    minutes: parseEffort(body),
    pace: parsePace(body),
  }
}
