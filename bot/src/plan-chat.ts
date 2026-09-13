import { putPlan } from './plans.js'
import { isWatched, WATCHED_GROUPS } from './config.js'
import { logger } from './logger.js'
import type { Sender } from './decisions.js'
import {
  DEFAULT_MINUTES,
  buildPlan,
  planLines,
  prettyDate,
  slugify,
  toIcs,
  type Pace,
  type PlanSession,
} from './plan.js'
import { isPlanRequest, parseDeadline, parseEffort, parsePace, parseRequest } from './plan-parse.js'

// Building a schedule from a chat line, one question at a time.
//
// Shape of the conversation, all of it in YOUR DM:
//   you   "ruang, plan the group report due monday"
//   ruang  (nothing missing) → the plan, and how to share it
//   you   "p1 6h"  /  "p1 quick"     → replans with a different size or pace
//   you   "share p1"                 → NOW it posts to the group
//
// RULE 2 holds: the question and the draft are private, and the only thing that
// reaches the group is what you explicitly share.

export interface Draft {
  id: string
  title: string
  deadline: string | null
  minutes: number
  pace: Pace
  groupJid: string | null // where it came from, and where it'd be shared
  sessions: PlanSession[]
  awaiting: 'deadline' | null
}

const drafts = new Map<string, Draft>()
let seq = 0

// Belt and braces against the echo loop. wa.ts already drops messages this
// socket sent, but if an id ever slips through (a reconnect, a resend), these
// shapes are unmistakably our own output — and "Plan for ..." is itself a plan
// request, which is how one missed echo becomes hundreds of messages.
const OUR_OWN_WORDS = [
  /^Plan for "/,
  /^When's ".*" due\?/,
  /Reply "share p\d+"/,
  /^I didn't catch a date/,
  /^There's no free time before/,
  /^Shared\. The group has/,
  /^Nothing to share yet/,
]

function isOurOwnOutput(text: string): boolean {
  return OUR_OWN_WORDS.some((re) => re.test(text))
}

const MAX_DRAFTS = 20
function remember(draft: Draft): void {
  drafts.set(draft.id, draft)
  // Drafts are a short conversation, not a store. Keep the newest few.
  while (drafts.size > MAX_DRAFTS) {
    const oldest = drafts.keys().next().value as string
    drafts.delete(oldest)
  }
}

export function getDraft(id: string): Draft | undefined {
  return drafts.get(id)
}

export function listDrafts(): Draft[] {
  return [...drafts.values()]
}

export function pendingQuestion(): Draft | undefined {
  return [...drafts.values()].find((d) => d.awaiting !== null)
}

function nextId(): string {
  seq += 1
  return `p${seq}`
}

// Where a shared plan would go: the group it was asked in, else your only
// watched group. With several watched groups and no context, we say so rather
// than picking one.
function targetGroup(from: string | null): string | null {
  if (from && isWatched(from)) return from
  return WATCHED_GROUPS.length === 1 ? WATCHED_GROUPS[0]! : null
}

export interface Reply {
  text: string
  draftId?: string
}

// Someone (you) asked for a plan. Returns what to say back in the DM.
export function startPlan(body: string, fromGroup: string | null, now = new Date()): Reply {
  const req = parseRequest(body, now)
  const title = req.title || 'this'
  const draft: Draft = {
    id: nextId(),
    title,
    deadline: req.deadline,
    minutes: req.minutes ?? DEFAULT_MINUTES,
    pace: req.pace ?? 'relaxed',
    groupJid: targetGroup(fromGroup),
    sessions: [],
    awaiting: req.deadline ? null : 'deadline',
  }
  remember(draft)

  if (draft.awaiting === 'deadline') {
    // The one thing worth interrupting for. Everything else has a sane default
    // you can override afterwards.
    return { text: `When's "${draft.title}" due?`, draftId: draft.id }
  }
  return replan(draft, now)
}

// An answer to the question we asked.
export function answerQuestion(draft: Draft, body: string, now = new Date()): Reply {
  if (draft.awaiting === 'deadline') {
    const deadline = parseDeadline(body, now)
    if (!deadline) {
      return {
        text: `I didn't catch a date in that. When's "${draft.title}" due? (e.g. "monday", "20 sep", "in 3 days")`,
        draftId: draft.id,
      }
    }
    draft.deadline = deadline
    draft.awaiting = null
    return replan(draft, now)
  }
  return replan(draft, now)
}

// Adjust and replan: "p1 6h", "p1 quick".
export function adjust(draft: Draft, body: string, now = new Date()): Reply | null {
  const minutes = parseEffort(body)
  const pace = parsePace(body)
  if (minutes == null && pace == null) return null
  if (minutes != null) draft.minutes = minutes
  if (pace != null) draft.pace = pace
  return replan(draft, now)
}

function replan(draft: Draft, now: Date): Reply {
  if (!draft.deadline) return { text: `When's "${draft.title}" due?`, draftId: draft.id }

  draft.sessions = buildPlan(draft.deadline, draft.minutes, draft.pace, now)
  if (draft.sessions.length === 0) {
    return {
      text: `There's no free time before ${prettyDate(draft.deadline)} — your week is full. Try a later date, or free something up.`,
      draftId: draft.id,
    }
  }

  const planned = draft.sessions.reduce((n, s) => n + (s.end - s.start), 0)
  const short = draft.minutes - planned

  const lines = [
    planLines(draft.title, draft.deadline, draft.sessions),
    short > 0 ? `\nOnly ${planned / 60}h of ${draft.minutes / 60}h fits before then.` : '',
    '',
    draft.groupJid
      ? `Reply "share ${draft.id}" to post it to the group.`
      : `Reply "share ${draft.id} <group>" — you watch more than one group.`,
    `Or "${draft.id} 6h" / "${draft.id} quick" to change the size or pace.`,
  ]
  return { text: lines.filter(Boolean).join('\n'), draftId: draft.id }
}

// The only thing here that reaches the group, and only from your explicit
// "share". Hosts the .ics so the group gets one short link with every session.
export async function sharePlan(
  send: Sender,
  postMessage: (send: Sender, jid: string, text: string) => Promise<boolean>,
  draft: Draft,
  origin: string,
): Promise<string> {
  if (!draft.deadline || draft.sessions.length === 0) {
    return `Nothing to share yet for "${draft.title}".`
  }
  const jid = draft.groupJid
  if (!jid) return 'Which group? Add the JID: `share <id> <group-jid>`.'

  const slug = `${slugify(draft.title)}-${draft.id}`
  putPlan(slug, draft.title, toIcs(draft.title, draft.sessions))
  const url = `${origin.replace(/\/$/, '')}/plan/${slug}.ics`

  const text = [
    planLines(draft.title, draft.deadline, draft.sessions),
    '',
    'Add it all to your calendar:',
    url,
  ].join('\n')

  const ok = await postMessage(send, jid, text)
  if (!ok) return `Couldn't post to that group — it isn't in WATCHED_GROUPS.`
  drafts.delete(draft.id)
  logger.info({ id: draft.id, slug }, 'plan shared to group (on your tap)')
  return `Shared. The group has the schedule and the link.`
}

// Route a line from you to the right part of the conversation. Returns null
// when it isn't about planning at all, so other commands still work.
export function routeOwnerLine(
  body: string,
  fromGroup: string | null,
  now = new Date(),
): { kind: 'reply'; reply: Reply } | { kind: 'share'; draft: Draft } | null {
  const text = body.trim()
  if (isOurOwnOutput(text)) return null // never answer ourselves

  // "share p1" — the tap.
  const shareMatch = text.match(/^share\s+(p\d+)(?:\s+(\S+))?$/i)
  if (shareMatch) {
    const draft = drafts.get(shareMatch[1]!.toLowerCase())
    if (!draft) return { kind: 'reply', reply: { text: `No draft called ${shareMatch[1]}.` } }
    if (shareMatch[2]) draft.groupJid = shareMatch[2]
    return { kind: 'share', draft }
  }

  // "p1 6h" / "p1 quick"
  const adjustMatch = text.match(/^(p\d+)\s+(.+)$/i)
  if (adjustMatch) {
    const draft = drafts.get(adjustMatch[1]!.toLowerCase())
    if (draft) {
      const reply = adjust(draft, adjustMatch[2]!, now)
      if (reply) return { kind: 'reply', reply }
    }
  }

  // A new request.
  if (isPlanRequest(text)) return { kind: 'reply', reply: startPlan(text, fromGroup, now) }

  // An answer to the question we asked.
  const waiting = pendingQuestion()
  if (waiting) return { kind: 'reply', reply: answerQuestion(waiting, text, now) }

  return null
}
