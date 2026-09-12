import { useSyncExternalStore } from 'react'
import type { Activity, Day } from '../domain/types'
import { SEED_ACTIVITIES } from '../data/seed'
import { syncSchedule } from './bot'

interface AppState {
  activities: Activity[]
  name: string
}

const STORAGE_KEY = 'ruang.activities.v1'
const NAME_KEY = 'ruang.name.v1'

let activities: Activity[] = loadActivities()
let name: string = loadName()
let state: AppState = { activities, name }
const listeners = new Set<() => void>()

void syncSchedule(activities) // push the current week to the bot on load

function loadName(): string {
  try {
    const raw = localStorage.getItem(NAME_KEY)
    if (raw) return raw
  } catch {
    // no storage — fall through to the default
  }
  return 'Hana'
}

function loadActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // whatever was stored is bad — fall through to seed
  }
  return SEED_ACTIVITIES
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities))
  } catch {
    // storage full or unavailable — keeps working in memory
  }
}

function setActivities(next: Activity[]) {
  activities = next
  state = { activities, name }
  persist()
  syncSchedule(activities) // keep the bot's free/busy in sync (fails soft)
  for (const l of listeners) l()
}

export function setName(next: string): void {
  name = next
  state = { activities, name }
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // storage unavailable — keeps working in memory
  }
  for (const l of listeners) l()
}

export function addActivity(a: Activity): void {
  setActivities([...activities, a])
}

export function addActivities(items: Activity[]): void {
  setActivities([...activities, ...items])
}

export function removeActivity(id: string): void {
  setActivities(activities.filter((a) => a.id !== id))
}

export function moveActivity(id: string, day: Day, start: number, end: number): void {
  setActivities(activities.map((a) => (a.id === id ? { ...a, day, start, end } : a)))
}

export function getActivities(): Activity[] {
  return activities
}

// Demo controls: start from an empty week, or reload the built-in demo week.
export function clearActivities(): void {
  setActivities([])
}

export function loadDemo(): void {
  setActivities(SEED_ACTIVITIES)
}

export function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const ampm = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hh}${ampm}` : `${hh}:${String(m).padStart(2, '0')}${ampm}`
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}
