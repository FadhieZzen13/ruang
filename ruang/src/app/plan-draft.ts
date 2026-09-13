import type { Pace } from '../domain/planner'

// A plan request handed from one screen to another — Voice understands
// "plan the group report due monday" and the Tasks tab picks it up already
// filled in, so you land on the proposed blocks instead of a blank form.
//
// Deliberately not persisted: it's a baton, not state. If the app reloads
// before the handoff, the request is simply gone.

export interface PlanDraft {
  title: string
  deadline: string // 'YYYY-MM-DD'
  minutes: number
  pace: Pace
}

let draft: PlanDraft | null = null
const listeners = new Set<() => void>()

export function setPlanDraft(next: PlanDraft): void {
  draft = next
  for (const l of listeners) l()
}

// Read once and clear — the receiving screen owns it from then on.
export function takePlanDraft(): PlanDraft | null {
  const out = draft
  draft = null
  return out
}

export function onPlanDraft(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
