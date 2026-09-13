import type { Task, TaskSession } from './task'

// The whole plan as one calendar file.
//
// Google's render?action=TEMPLATE URL carries exactly one event — there is no
// multi-event version of it. A .ics file is how you hand someone a whole
// schedule in one tap, and Google Calendar, Apple Calendar and Outlook all
// import it.
//
// Times are written "floating" (no Z, no TZID): 8pm means 8pm in whatever
// calendar imports it. That's right for a study plan, and it sidesteps having
// to ship a VTIMEZONE block. A UTC conversion here would move every session.

const CRLF = '\r\n'

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function localStamp(date: string, minutes: number): string {
  return `${date.replace(/-/g, '')}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`
}

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

// RFC 5545 §3.3.11 — commas, semicolons and backslashes are delimiters, and a
// literal newline has to be written as \n.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Lines cap at 75 octets; continuations start with a single space.
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

export interface IcsPlan {
  title: string
  sessions: TaskSession[]
}

export function toIcs(plan: IcsPlan, now = new Date()): string {
  const stamp = utcStamp(now)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ruang//Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  plan.sessions.forEach((s, i) => {
    lines.push(
      'BEGIN:VEVENT',
      // Stable per session, so re-importing updates rather than duplicates.
      `UID:${s.date.replace(/-/g, '')}-${s.start}-${i}@ruang`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localStamp(s.date, s.start)}`,
      `DTEND:${localStamp(s.date, s.end)}`,
      `SUMMARY:${escapeText(s.note ? `${plan.title} — ${s.note}` : plan.title)}`,
      `DESCRIPTION:${escapeText(s.note)}`,
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return lines.map(fold).join(CRLF) + CRLF
}

// A filename you recognise in a downloads list: the task, and who it's with.
export function slugify(...parts: (string | undefined)[]): string {
  const slug = parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'plan'
}

export function icsFilename(title: string, groupName?: string): string {
  return `${slugify(title, groupName)}.ics`
}

export function planToIcs(task: Task, now?: Date): string {
  return toIcs({ title: task.title, sessions: task.sessions }, now)
}
