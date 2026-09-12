import type { Activity, Day } from '../domain/types'

// Talks to the local Ruang bot's API (bot/src/server.ts). All calls fail soft:
// if the bot isn't running, the app just carries on. Set VITE_BOT_URL to point
// elsewhere; defaults to the bot's localhost port.

const env = import.meta.env as Record<string, string | undefined>
const BOT_URL = (env.VITE_BOT_URL || 'http://localhost:8788').replace(/\/$/, '')
const BOT_TOKEN = env.VITE_BOT_TOKEN || ''
const AUTH_HEADERS = BOT_TOKEN ? { Authorization: `Bearer ${BOT_TOKEN}` } : {}

export interface PendingInvite {
  id: string
  groupName: string
  author: string
  ask: string
  day: Day
  time: number
  busy: boolean
  counter: { day: Day; time: number } | null
}

export type Decision = 'accept' | 'decline' | 'counter' | 'custom'

// Push the current week so the bot's free/busy uses YOUR real schedule.
export async function syncSchedule(activities: Activity[]): Promise<void> {
  try {
    await fetch(`${BOT_URL}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({
        activities: activities.map((a) => ({ title: a.title, day: a.day, start: a.start, end: a.end })),
      }),
    })
  } catch {
    // bot offline — fine, it'll get the schedule next time it's up
  }
}

// null = bot unreachable (offline); [] = up but nothing waiting.
export async function getPending(): Promise<PendingInvite[] | null> {
  try {
    const res = await fetch(`${BOT_URL}/pending`, { headers: AUTH_HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    return (data.pending ?? []) as PendingInvite[]
  } catch {
    return null
  }
}

export async function decide(id: string, decision: Decision, message?: string): Promise<boolean> {
  try {
    const res = await fetch(`${BOT_URL}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify(message !== undefined ? { id, decision, message } : { id, decision }),
    })
    const data = await res.json()
    return Boolean(data.ok)
  } catch {
    return false
  }
}
