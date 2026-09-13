import type { Day } from './types.js'
import { getSchedule } from './schedule.js'

// Turning "plan the group report, due monday" into actual blocks.
//
// The bot plans against the same week the app pushes it (schedule.ts). Its
// schedule is weekday-keyed with no dates, so "is this date busy?" means "is
// that weekday busy?" — the safe direction: it over-blocks, never under-blocks.
//
// ponytail: the maths mirrors ruang/src/domain/planner.ts. Duplicated on
// purpose, like detect.ts — the bot is a separate service and must plan without
// the app running.

const DAY_START = 8 * 60
const DAY_END = 22 * 60
const QUICK_CHUNK = 120
const RELAXED_CHUNK = 60
const DEFAULT_MINUTES = 240
const MAX_HORIZON_DAYS = 60

const JS_DAY: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export type Pace = 'quick' | 'relaxed'

export interface PlanSession {
  date: string // 'YYYY-MM-DD'
  start: number // minutes since midnight
  end: number
  note: string
}

export interface PlanRequest {
  title: string
  deadline: string | null // 'YYYY-MM-DD'
  minutes: number | null
  pace: Pace | null
}

// ---- dates -----------------------------------------------------------------

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dateFromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function weekdayOf(date: Date): Day {
  return JS_DAY[date.getDay()]!
}

export function prettyDate(iso: string): string {
  return dateFromIso(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function fmtTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hh}${ampm}` : `${hh}:${String(m).padStart(2, '0')}${ampm}`
}

// ---- free/busy -------------------------------------------------------------

function busyOn(date: Date, start: number, end: number, placed: PlanSession[]): boolean {
  const day = weekdayOf(date)
  const iso = isoDate(date)
  const clashesWeek = getSchedule().some((a) => a.day === day && start < a.end && end > a.start)
  const clashesPlaced = placed.some((p) => p.date === iso && start < p.end && end > p.start)
  return clashesWeek || clashesPlaced
}

function firstGapOn(
  date: Date,
  minutes: number,
  placed: PlanSession[],
  now: Date,
): number | null {
  const isToday = isoDate(date) === isoDate(now)
  const earliest = isToday
    ? Math.max(DAY_START, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15)
    : DAY_START
  for (let start = earliest; start + minutes <= DAY_END; start += 15) {
    if (!busyOn(date, start, start + minutes, placed)) return start
  }
  return null
}

// ---- shaping ---------------------------------------------------------------

export function shapeFor(pace: Pace, totalMinutes: number, daysAvailable: number) {
  const chunk = pace === 'quick' ? QUICK_CHUNK : RELAXED_CHUNK
  const perDay = pace === 'quick' ? 2 : 1
  const ceiling = Math.max(1, daysAvailable * perDay)
  const sessions = Math.max(1, Math.min(Math.ceil(totalMinutes / chunk), ceiling))
  const minutes = Math.ceil(Math.ceil(totalMinutes / sessions) / 15) * 15
  return { sessions, minutes, perDay }
}

export function steps(n: number): string[] {
  if (n <= 1) return ['Work on it']
  if (n === 2) return ['Start and outline', 'Finish and review']
  if (n === 3) return ['Outline it', 'Do the main work', 'Review and finish']
  const middle = Array.from({ length: n - 2 }, (_, i) => `Work through part ${i + 1}`)
  return ['Outline and gather', ...middle, 'Review and submit']
}

// ---- planning --------------------------------------------------------------

export function buildPlan(
  deadline: string,
  totalMinutes: number,
  pace: Pace,
  now = new Date(),
): PlanSession[] {
  const end = dateFromIso(deadline)
  const dates: Date[] = []
  for (let i = 0; i < MAX_HORIZON_DAYS; i++) {
    const d = addDays(now, i)
    if (isoDate(d) > isoDate(end)) break
    dates.push(d)
  }
  if (dates.length === 0) return []

  const shape = shapeFor(pace, totalMinutes, dates.length)
  const order = pace === 'quick' ? dates : spread(dates, shape.sessions)
  const labels = steps(shape.sessions)

  const placed: PlanSession[] = []
  const perDayCount = new Map<string, number>()

  for (let i = 0; i < shape.sessions; i++) {
    let put: PlanSession | null = null
    for (const date of order) {
      const iso = isoDate(date)
      if ((perDayCount.get(iso) ?? 0) >= shape.perDay) continue
      const start = firstGapOn(date, shape.minutes, placed, now)
      if (start == null) continue
      put = { date: iso, start, end: start + shape.minutes, note: labels[i] ?? 'Work on it' }
      break
    }
    if (!put) break
    placed.push(put)
    perDayCount.set(put.date, (perDayCount.get(put.date) ?? 0) + 1)
  }

  return placed.sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1))
}

// Anchor evenly across the run-up so "take your time" actually uses it.
function spread(dates: Date[], sessions: number): Date[] {
  if (sessions <= 1 || dates.length <= 1) return dates
  const span = dates.length - 1
  const used = new Set<number>()
  const picked: Date[] = []
  for (let i = 0; i < sessions; i++) {
    const idx = Math.round((i * span) / (sessions - 1))
    if (used.has(idx)) continue
    used.add(idx)
    picked.push(dates[idx]!)
  }
  return [...picked, ...dates.filter((_, i) => !used.has(i))]
}

// ---- the calendar file -----------------------------------------------------

const CRLF = '\r\n'

function escapeText(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function fold(line: string): string {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest) parts.push(` ${rest}`)
  return parts.join(CRLF)
}

export function toIcs(title: string, sessions: PlanSession[], now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stamp =
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ruang//Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  sessions.forEach((s, i) => {
    const local = (m: number) => `${s.date.replace(/-/g, '')}T${p(Math.floor(m / 60))}${p(m % 60)}00`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.date.replace(/-/g, '')}-${s.start}-${i}@ruang`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${local(s.start)}`,
      `DTEND:${local(s.end)}`,
      `SUMMARY:${escapeText(s.note ? `${title} — ${s.note}` : title)}`,
      `DESCRIPTION:${escapeText(s.note)}`,
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  return lines.map(fold).join(CRLF) + CRLF
}

export function slugify(...parts: (string | undefined)[]): string {
  const slug = parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'plan'
}

export function planLines(title: string, deadline: string, sessions: PlanSession[]): string {
  const rows = sessions.map(
    (s, i) => `${i + 1}. ${prettyDate(s.date)}, ${fmtTime(s.start)}–${fmtTime(s.end)} — ${s.note}`,
  )
  const total = sessions.reduce((n, s) => n + (s.end - s.start), 0)
  const hours = total / 60
  return [
    `Plan for "${title}" — due ${prettyDate(deadline)}`,
    ...rows,
    `${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'} · ${Number.isInteger(hours) ? hours : hours.toFixed(1)}h total`,
  ].join('\n')
}

export { DEFAULT_MINUTES }
