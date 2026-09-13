import type { DateSlot, Pace } from '../domain/planner'
import { fallbackSteps } from '../domain/task'
import { dateFromIso, shortDateLabel } from '../domain/occurrence'
import { chatJson } from './llm'

// What to actually do in each sitting. The planner decides WHEN; this decides
// WHAT — one short line per block, so a session says "outline + pick 3 sources"
// instead of just staring back at you.
//
// Always resolves to exactly one step per slot. The screen renders the
// deterministic fallback immediately and swaps these in when they land, so a
// slow or missing model never blocks the plan.

export interface PlanBrief {
  title: string
  deadline: string
  totalMinutes: number
  pace: Pace
  // Everything the capture step gathered but never used to ask. The course
  // makes the steps subject-specific ("run the regression" beats "do the main
  // work"), the name makes them addressed to someone, and the deadline time
  // decides whether the last sitting is real work or a final read-through.
  course?: string
  deadlineTime?: string
  name?: string
}

const MAX_STEP_CHARS = 80

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function daysBefore(date: string, deadline: string): number {
  return Math.round((dateFromIso(deadline).getTime() - dateFromIso(date).getTime()) / 86400000)
}

function systemPrompt(brief: PlanBrief, slots: DateSlot[]): string {
  // A sitting the model can actually reason about: how long, which day, and how
  // close to the wire. "2h on the evening it's due" earns a different step from
  // "2h nine days out", and only the real dates carry that.
  const sittings = slots.map((s, i) => {
    const away = daysBefore(s.date, brief.deadline)
    const when =
      away <= 0 ? 'the day it is due' : away === 1 ? 'the day before it is due' : `${away} days before it is due`
    return `${i + 1}. ${(s.end - s.start) / 60}h on ${shortDateLabel(s.date)}, ${hhmm(s.start)}–${hhmm(s.end)} — ${when}`
  })

  return [
    brief.name ? `You are helping ${brief.name}, a university student.` : 'You are helping a university student.',
    `They are planning "${brief.title}"${brief.course ? ` for their ${brief.course} course` : ''},`,
    `due ${brief.deadline}${brief.deadlineTime ? ` at ${brief.deadlineTime}` : ''}, with ${brief.totalMinutes / 60}h of work in total.`,
    brief.pace === 'quick'
      ? 'They want it done in few, heavy sittings — front-load the real work.'
      : 'They want it spread out in lighter sittings — build it up gradually.',
    '',
    `Their ${slots.length} ${slots.length === 1 ? 'sitting is' : 'sittings are'}:`,
    ...sittings,
    '',
    'Say what to do in each one. Reply with ONLY a JSON object:',
    '{"steps":["...","..."]}',
    '',
    `- Exactly ${slots.length} strings, in order.`,
    '- Each at most 8 words, imperative, a concrete distinct chunk of the work.',
    '- A longer sitting gets a bigger bite than a short one.',
    brief.course
      ? `- Use the real vocabulary of ${brief.course} — name the actual artifact or method, not "the work".`
      : '- Name the actual artifact being produced, not "the work".',
    '- No dates, no times, no numbering — the app already shows those.',
    '- The last one should be reviewing or finishing, and must fit before the deadline.',
  ].join('\n')
}

// Never throws, always returns exactly `n` steps — same contract as the
// scheduling agent's normalize().
export function normalizeSteps(raw: unknown, n: number, fallback: string[]): string[] {
  const o = (raw ?? {}) as Record<string, unknown>
  const list = Array.isArray(o.steps) ? o.steps : []
  const clean = list
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().slice(0, MAX_STEP_CHARS))
    .filter(Boolean)

  const out = clean.slice(0, n)
  for (let i = out.length; i < n; i++) out.push(fallback[i] ?? `Work on it`)
  return out
}

export async function describeSessions(
  brief: PlanBrief,
  slots: DateSlot[],
): Promise<{ steps: string[]; provider: string }> {
  const fallback = fallbackSteps(brief.title, slots.length)
  const { json, provider } = await chatJson(
    [
      { role: 'system', content: systemPrompt(brief, slots) },
      { role: 'user', content: brief.title },
    ],
    // A little variety is fine here, unlike the scheduling maths.
    { temperature: 0.3 },
  )
  return { steps: normalizeSteps(json, slots.length, fallback), provider }
}
