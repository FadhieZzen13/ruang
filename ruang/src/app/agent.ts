import type { Day } from '../domain/types'
import { DAY_LABEL } from '../domain/types'
import { fmt } from './store'

// The agent: turns a spoken memo into a scheduling ACTION against your week —
// add a new thing, move an existing one, or cancel one. Talks to an
// OpenAI-compatible gateway via the Vite dev proxy (/llm); the key stays
// server-side. The model does the understanding; applying the change and the
// conflict math stay local and deterministic.

const env = import.meta.env as Record<string, string | undefined>
const BASE = '/llm'
const MODEL = env.VITE_LLM_MODEL || 'kimi-k2.7'

const VALID_DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const VALID_ACTIONS = ['create', 'move', 'cancel'] as const

export type ActionKind = (typeof VALID_ACTIONS)[number]

export interface AgentAction {
  action: ActionKind
  title: string
  day: Day | null
  time: number | null // minutes since midnight, null if unspecified
  targetId: string | null // which existing item to move/cancel
}

// One line per existing item, so the model can reference it for move/cancel.
export interface ScheduleLite {
  id: string
  title: string
  day: Day
  start: number
}

export function hasAgent(): boolean {
  return true
}

function systemPrompt(schedule: ScheduleLite[]): string {
  const list = schedule.length
    ? schedule.map((a) => `- id ${a.id}: "${a.title}" on ${DAY_LABEL[a.day]} at ${fmt(a.start)}`).join('\n')
    : '(the week is empty)'
  return `You are the scheduling agent inside a student calendar app.
The user speaks a memo. Decide ONE action against their week and reply with ONLY a JSON object:
{"action":"create"|"move"|"cancel","title":string,"day":"mon".."sun"|null,"time":integer minutes-since-midnight|null,"targetId":string|null}

- "create": a new thing. Fill title/day/time. targetId=null.
- "move": reschedule something that already exists. Set targetId to its id, and day/time to the new slot.
- "cancel": remove something that already exists. Set targetId to its id.
- title: short and clean (e.g. "Gym"). Strip filler like "remind me to".
- time: 7pm -> 1140, 9:30am -> 570. null if none said.

The user's current week:
${list}`
}

export async function proposeAction(transcript: string, schedule: ScheduleLite[]): Promise<AgentAction> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt(schedule) },
        { role: 'user', content: transcript },
      ],
    }),
  })

  if (!res.ok) throw new Error(`agent request failed: ${res.status}`)
  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content ?? '{}'
  return normalize(JSON.parse(stripFences(content)), schedule)
}

function stripFences(s: string): string {
  return s.replace(/```json\s*|\s*```/g, '').trim()
}

function normalize(raw: unknown, schedule: ScheduleLite[]): AgentAction {
  const o = (raw ?? {}) as Record<string, unknown>
  const action = (VALID_ACTIONS as readonly string[]).includes(o.action as string)
    ? (o.action as ActionKind)
    : 'create'
  const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'New activity'
  const day = VALID_DAYS.includes(o.day as Day) ? (o.day as Day) : null
  const time = typeof o.time === 'number' && o.time >= 0 && o.time < 1440 ? o.time : null
  // Only trust a targetId that actually exists.
  const targetId =
    typeof o.targetId === 'string' && schedule.some((a) => a.id === o.targetId) ? o.targetId : null
  // move/cancel need a real target; if the model didn't give one, treat as create.
  if ((action === 'move' || action === 'cancel') && !targetId) {
    return { action: 'create', title, day, time, targetId: null }
  }
  return { action, title, day, time, targetId }
}
