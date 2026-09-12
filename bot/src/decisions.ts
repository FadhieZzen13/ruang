import type { Day } from './types.js'
import { DAY_LABEL, fmt } from './types.js'
import { conflictReason } from './schedule.js'
import { logger } from './logger.js'

// A detected invite waiting for YOUR decision. Nothing here has been sent.
export interface Pending {
  id: string
  groupJid: string
  groupName: string
  author: string
  ask: string
  day: Day
  time: number
  busy: boolean
  counter: { day: Day; time: number } | null
}

export type Decision = 'accept' | 'decline' | 'counter' | 'custom'

// Send a text to a JID. Injected by wa.ts so this module never imports the
// socket — and so there is exactly one function in the whole bot that can.
export type Sender = (jid: string, text: string) => Promise<void>

const pending = new Map<string, Pending>()

export function addPending(p: Pending): void {
  pending.set(p.id, p)
}
export function listPending(): Pending[] {
  return [...pending.values()]
}
export function getPending(id: string): Pending | undefined {
  return pending.get(id)
}

// RULE 2: THE ONLY PATH THAT POSTS TO A GROUP. Called solely from an explicit
// approval (control.ts). Detecting a message never calls this.
// `customText` is only honored for the 'custom' decision — your own words post
// verbatim, so you can answer however you like without the bot's templates.
export async function postVerdict(
  send: Sender,
  id: string,
  decision: Decision,
  customText?: string,
): Promise<boolean> {
  const p = pending.get(id)
  if (!p) return false
  const line = decision === 'custom' ? (customText?.trim() || verdictLine(p, 'decline')) : verdictLine(p, decision)
  await send(p.groupJid, line)
  pending.delete(id)
  logger.info({ id, decision, group: p.groupName }, 'verdict posted (on your tap)')
  return true
}

function verdictLine(p: Pending, decision: Decision): string {
  if (decision === 'accept') {
    return `Yep, I'm in for ${DAY_LABEL[p.day]} ${fmt(p.time)}. 👍`
  }
  if (decision === 'counter') {
    const c = p.counter
    // RULE 3: reason is day-granularity; the counter time is a clean suggestion.
    const reason = `Can't do ${conflictReason(p.day, p.time)}`
    return c ? `${reason} — ${DAY_LABEL[c.day]} ${fmt(c.time)} instead?` : `${reason}. Another time?`
  }
  // decline — RULE 5: still offer a way forward.
  return p.counter
    ? `Can't make it this time — ${DAY_LABEL[p.counter.day]} ${fmt(p.counter.time)} maybe?`
    : `Can't make it this time — maybe next week?`
}
