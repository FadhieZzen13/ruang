export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type ActivityKind = 'class' | 'meeting' | 'activity' | 'work'

export type Recurrence = 'once' | 'weekly'

export interface Activity {
  id: string
  title: string
  day: Day
  start: number // minutes since midnight
  end: number
  kind: ActivityKind
  locked: boolean
  description: string
  recurrence: Recurrence
}

export const DAY_ORDER: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const DAY_LABEL: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

// JS getDay() (0=Sun..6=Sat) → our Day key.
export const JS_DAY: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
