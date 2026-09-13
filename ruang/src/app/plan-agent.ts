import type { DateSlot, Pace } from '../domain/planner'
import { fallbackSteps } from '../domain/task'
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
}

const MAX_STEP_CHARS = 80

function systemPrompt(brief: PlanBrief, slots: DateSlot[]): string {
  const lengths = slots.map((s, i) => `${i + 1}. a ${(s.end - s.start) / 60}h sitting`).join('\n')
  return [
    `The user is planning "${brief.title}", due ${brief.deadline}.`,
    `They have ${slots.length} work ${slots.length === 1 ? 'session' : 'sessions'} booked:`,
    lengths,
    '',
    'Say what to do in each one. Reply with ONLY a JSON object:',
    '{"steps":["...","..."]}',
    '',
    `- Exactly ${slots.length} strings, in order.`,
    '- Each at most 8 words, imperative, a concrete distinct chunk of the work.',
    '- A longer sitting gets a bigger bite than a short one.',
    '- No dates, no times, no numbering — the app already shows those.',
    '- The last one should be reviewing or finishing.',
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
