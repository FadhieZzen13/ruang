# Scheduler

The base of RUANG: the week as a month calendar over a single-day agenda. Seeded from `data/seed.ts`, persisted to localStorage.

## What it shows

- A **month calendar** (Monday-first). Today is marked in terracotta; days that have activities get a dot. Tap any date to select it.
- Below it, the **selected day's agenda** — colour-coded chips sorted by time. Defaults to today.
- Chip colours map to `Activity.kind`: class (ink), meeting (amber), activity (sage), work (terracotta).
- When the selected day is empty, a **"Next: …" hint** points at the next day that has activities.

The seed is a *recurring weekly* schedule, so it projects onto every matching weekday of the month (every Monday shows Monday's items, etc.).

## Demo controls (control all the variables)

Header actions + an add form let you build any week from scratch:

- **Demo** — reloads the built-in seed week (`store.loadDemo`).
- **Clear** — two-tap (`Clear` → `Sure?`) wipe to an empty week from 0 (`store.clearActivities`). Armed state auto-disarms after 4s; uses a ref so fast taps are safe.
- **+ Add** — inline form on the selected day: title, start/end (native time pickers), and kind (class / meeting / activity / work). Writes via `store.addActivity`.
- **×** on any chip removes that event (`store.removeActivity`).

## Behaviour

- Reads from `useAppState().activities`; every mutation persists to localStorage, so a hand-built week survives reload (until Clear/Demo).

## Notes

- Tuesday evening in the seed is deliberately crammed so the chaos rebalance (voice memo / agent) has raw material when something lands there.

ponytail: no drag-to-edit and no month-spanning event model — activities are keyed by weekday and added/removed through the form and confirm flows.
