import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Day, ScheduleItem } from './types.js'
import { DAY_LABEL, DAY_ORDER } from './types.js'

// Your week, so Ruang can tell free from busy. Starts from schedule.local.json
// (git-ignored — your real week) or the checked-in schedule.json demo, and can
// be replaced live by the Ruang app pushing its schedule to the bot's API.

const here = dirname(fileURLToPath(import.meta.url))
const LOCAL = join(here, '..', 'schedule.local.json')
const EVENING = 17 * 60 // 5pm+ reads as "evening"
const COUNTER_HOUR = 19 * 60 // counter-offers target a clean 7pm

function load(): ScheduleItem[] {
  for (const name of ['schedule.local.json', 'schedule.json']) {
    try {
      return JSON.parse(readFileSync(join(here, '..', name), 'utf8')) as ScheduleItem[]
    } catch {
      // try the next one
    }
  }
  return []
}

let week: ScheduleItem[] = load()

// Replace the week (called when the app pushes its schedule). Persists to
// schedule.local.json so a restart keeps your real week, not the demo.
export function setSchedule(items: ScheduleItem[]): void {
  week = items
  try {
    writeFileSync(LOCAL, JSON.stringify(items, null, 2))
  } catch {
    // read-only fs — in-memory update still works for this run
  }
}

export function getSchedule(): ScheduleItem[] {
  return week
}

export function isBusy(day: Day, time: number, minutes = 60): boolean {
  const end = time + minutes
  return week.some((a) => a.day === day && time < a.end && end > a.start)
}

// RULE 3: day-granularity only. Never the exact time, never the other event.
export function conflictReason(day: Day, time: number): string {
  const part = time >= EVENING ? 'evening' : 'day'
  return `${DAY_LABEL[day]} ${part}`
}

// RULE 5: a decline/busy always offers an alternative — the next free 7pm.
export function nextEvening(day: Day): { day: Day; time: number } | null {
  const idx = DAY_ORDER.indexOf(day)
  for (let offset = 1; offset < 7; offset++) {
    const d = DAY_ORDER[(idx + offset) % 7]!
    if (!isBusy(d, COUNTER_HOUR)) return { day: d, time: COUNTER_HOUR }
  }
  return null
}

export function hasSchedule(): boolean {
  return week.length > 0
}
