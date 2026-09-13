import type { Activity, Day } from '../domain/types'

// Talks to the local Ruang bot's API (bot/src/server.ts). All calls fail soft:
// if the bot isn't running, the app just carries on.
//
// Default is the same-origin path /bot, which Vite proxies to the bot's port
// (see vite.config.ts). Going through the dev server means a phone on the LAN
// — or a browser on an https tunnel — reaches the bot without hitting its own
// "localhost", and without mixed-content blocking. Set VITE_BOT_URL to an
// absolute URL only when the bot lives somewhere else.

const env = import.meta.env as Record<string, string | undefined>
const BOT_URL = (env.VITE_BOT_URL || '/bot').replace(/\/$/, '')
const BOT_TOKEN = env.VITE_BOT_TOKEN || ''
const AUTH_HEADERS: Record<string, string> = BOT_TOKEN ? { Authorization: `Bearer ${BOT_TOKEN}` } : {}

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

// The groups you told the bot to watch — the only ones it will post to. Null
// means the bot is unreachable, same convention as getPending.
export interface BotGroup {
  jid: string
  name: string
}

export async function getGroups(): Promise<BotGroup[] | null> {
  try {
    const res = await fetch(`${BOT_URL}/groups`, { headers: AUTH_HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    return (data.groups ?? []) as BotGroup[]
  } catch {
    return null
  }
}

// A plan Ruang is working out with you over WhatsApp. The app shows these so a
// conversation you started in chat doesn't disappear when you pick up the app.
export interface BotDraft {
  id: string
  title: string
  deadline: string | null
  minutes: number
  pace: 'quick' | 'relaxed'
  awaiting: 'deadline' | null
  groupName: string | null
  sessions: { date: string; start: number; end: number; note: string }[]
}

export async function getDrafts(): Promise<BotDraft[] | null> {
  try {
    const res = await fetch(`${BOT_URL}/drafts`, { headers: AUTH_HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    return (data.drafts ?? []) as BotDraft[]
  } catch {
    return null
  }
}

// Say something to Ruang exactly as you would in chat — "monday", "p1 6h",
// "share p1". Same router, same rules; only "share" reaches a group.
export async function tellRuang(text: string): Promise<string | null> {
  try {
    const res = await fetch(`${BOT_URL}/owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.reply === 'string' ? data.reply : null
  } catch {
    return null
  }
}

// Park a plan's .ics on the bot so it can be shared as a short readable URL
// (/bot/plan/<slug>.ics) instead of a 300-character self-contained link.
// Returns the path to share, or null if the bot isn't there — the caller then
// falls back to the link that needs no server.
export async function publishPlan(
  slug: string,
  title: string,
  ics: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${BOT_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({ slug, title, ics }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.path === 'string' ? `${BOT_URL}${data.path}` : null
  } catch {
    return null
  }
}

// Post your own words to one of those groups. Runs only from an explicit tap.
// Unlike the rest of this module it reports WHY it failed — sending to a group
// is the one thing the user must never be left guessing about.
export async function sayToGroup(
  jid: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BOT_URL}/say`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS },
      body: JSON.stringify({ jid, text }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.ok) return { ok: true }
    return { ok: false, error: typeof data.error === 'string' ? data.error : `failed (${res.status})` }
  } catch {
    return { ok: false, error: 'bot unreachable' }
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
