import type { Task, TaskSession } from './task'
import { makeSession } from './task'

// One link that carries a whole plan.
//
// There is no backend, so there is nowhere to put a row and hand back an
// "abc123". Instead the plan travels INSIDE the link, in the fragment:
//
//   https://your-app/#/p/<base64url of the plan>
//
// The fragment never leaves the browser — it isn't sent to the server, isn't in
// request logs, and needs no hosting. The cost is a long URL. Chat apps still
// render it as one tappable link.

export interface SharedPlan {
  title: string
  deadline: string
  sessions: TaskSession[]
}

export const SHARE_PREFIX = '#/p/'

const MAX_SESSIONS = 24
const MAX_TITLE = 120
const MAX_NOTE = 120
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Wire form is positional, not named — a 4-session plan is ~300 characters of
// URL instead of ~600.
type WireSession = [date: string, start: number, end: number, note: string]
type Wire = [title: string, deadline: string, sessions: WireSession[]]

function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(payload: string): string {
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodePlan(task: Task): string {
  const wire: Wire = [
    task.title.slice(0, MAX_TITLE),
    task.deadline,
    task.sessions
      .slice(0, MAX_SESSIONS)
      .map((s) => [s.date, s.start, s.end, s.note.slice(0, MAX_NOTE)] as WireSession),
  ]
  return b64urlEncode(JSON.stringify(wire))
}

// Untrusted input: this arrives from a link someone was sent. Validate
// everything, never throw, and return null rather than a half-built plan.
export function decodePlan(payload: string): SharedPlan | null {
  try {
    const raw: unknown = JSON.parse(b64urlDecode(payload))
    if (!Array.isArray(raw) || raw.length < 3) return null

    const [title, deadline, sessions] = raw as [unknown, unknown, unknown]
    if (typeof title !== 'string' || !title.trim()) return null
    if (typeof deadline !== 'string' || !ISO_DATE.test(deadline)) return null
    if (!Array.isArray(sessions) || sessions.length === 0) return null

    const out: TaskSession[] = []
    for (const s of sessions.slice(0, MAX_SESSIONS)) {
      if (!Array.isArray(s) || s.length < 3) continue
      const [date, start, end, note] = s as [unknown, unknown, unknown, unknown]
      if (typeof date !== 'string' || !ISO_DATE.test(date)) continue
      if (typeof start !== 'number' || typeof end !== 'number') continue
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue
      if (start < 0 || end > 24 * 60 || end <= start) continue
      out.push(
        makeSession(date, start, end - start, typeof note === 'string' ? note.slice(0, MAX_NOTE) : ''),
      )
    }
    if (out.length === 0) return null

    return { title: title.slice(0, MAX_TITLE).trim(), deadline, sessions: out }
  } catch {
    return null // not base64, not JSON, not ours
  }
}

// Pull a plan out of a location hash, if there's one in it.
//
// Accepts `#/p/<payload>` and `#/p/<slug>/<payload>` — the slug is there so the
// link opens with words you recognise ("group-report-mgt-204") instead of
// starting in base64. It carries no meaning; the payload is always last.
export function readPlanFromHash(hash: string): SharedPlan | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null
  const rest = hash.slice(SHARE_PREFIX.length)
  const payload = rest.split('/').filter(Boolean).pop()
  return payload ? decodePlan(payload) : null
}
