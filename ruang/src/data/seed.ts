import type { Activity, ActivityKind, Day, Recurrence } from '../domain/types'

// Hana's week. Tuesday evening is intentionally cramped — that's the chaos
// feature's raw material and why Thursday evening reads as busy in the demo.

interface Seed {
  id: string
  title: string
  day: Day
  start: number
  end: number
  kind: ActivityKind
  locked: boolean
  recurrence?: Recurrence
  description?: string
}

function make(s: Seed): Activity {
  return { description: '', recurrence: 'once', ...s }
}

// Classes and shifts recur weekly; one-off meetings/deadlines don't.
export const SEED_ACTIVITIES: Activity[] = [
  make({ id: 'a1', title: 'Data Structures', day: 'mon', start: 540, end: 630, kind: 'class', locked: true, recurrence: 'weekly', description: 'Dr. Rina · room 304' }),
  make({ id: 'a2', title: 'Human-Computer Interaction', day: 'mon', start: 660, end: 750, kind: 'class', locked: true, recurrence: 'weekly' }),
  make({ id: 'a3', title: 'Shift — Kopi Kenangan', day: 'mon', start: 1020, end: 1260, kind: 'work', locked: true, recurrence: 'weekly' }),

  make({ id: 'a4', title: 'Algorithms', day: 'tue', start: 480, end: 570, kind: 'class', locked: true, recurrence: 'weekly' }),
  make({ id: 'a5', title: 'Database Systems', day: 'tue', start: 600, end: 690, kind: 'class', locked: true, recurrence: 'weekly' }),
  make({ id: 'a6', title: 'COM203 group meetup', day: 'tue', start: 840, end: 960, kind: 'meeting', locked: false }),
  make({ id: 'a7', title: 'Lab report — draft', day: 'tue', start: 1020, end: 1140, kind: 'activity', locked: false }),
  make({ id: 'a8', title: 'Assignment: OS', day: 'tue', start: 1140, end: 1260, kind: 'activity', locked: false }),

  make({ id: 'a9', title: 'Networks', day: 'wed', start: 540, end: 630, kind: 'class', locked: true, recurrence: 'weekly' }),
  make({ id: 'a10', title: 'Shift — Kopi Kenangan', day: 'wed', start: 1020, end: 1260, kind: 'work', locked: true, recurrence: 'weekly' }),

  make({ id: 'a11', title: 'Software Engineering', day: 'thu', start: 480, end: 570, kind: 'class', locked: true, recurrence: 'weekly' }),
  make({ id: 'a12', title: 'Committee meeting', day: 'thu', start: 1020, end: 1260, kind: 'meeting', locked: false }),

  make({ id: 'a13', title: 'Shift — Kopi Kenangan', day: 'fri', start: 1020, end: 1140, kind: 'work', locked: true, recurrence: 'weekly' }),
]
