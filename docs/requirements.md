# Requirements

## Scope

Demoable PWA of RUANG — the four-beat demo (scheduler → voice memo → WhatsApp listener → verdict). Traces to `docs/prd.md`.

## Functional

| ID | Requirement | Priority | Source |
|---|---|---|---|
| FR-1 | User sees a populated week view of classes, meetings, and activities | Must | PRD §What it does #1 |
| FR-2 | User records a voice memo; real whisper transcription returns text | Must | PRD §What it does #2 |
| FR-3 | Transcription is parsed into a proposed activity (title, day, time) and shown for confirmation before it lands | Must | PRD §What it does #2 |
| FR-4 | When the target slot is cramped, the proposal includes a rebalance suggestion (move to a free slot) — the chaos feature | Must | PRD §What it does #3 |
| FR-5 | A chosen group chat surfaces an activity-type message as a private in-app notification | Must | PRD §What it does #4 |
| FR-6 | On a busy target time, the notification offers a counter-time; on a free time, it offers yes/maybe/no | Must | PRD §What it does #4 |
| FR-7 | The user's verdict posts back to the group only on their explicit tap | Must | PRD §What it does #4 |
| FR-8 | Verdict text is day-granularity ("not free Thursday evening"), never exact times | Must | CONTEXT §6 |
| FR-9 | Data persists across reloads via localStorage | Should | PRD §What it does NOT do |
| FR-10 | App installs/loads as a PWA (manifest + service worker) | Should | PRD §Constraints |

## Non-functional

| ID | Category | Requirement (quantified) | Priority |
|---|---|---|---|
| NFR-1 | Performance | Voice transcription returns in < 5s for a ≤ 15s clip on the local whisper sidecar (M-series, GPU) | Must |
| NFR-2 | Reliability | The scheduler renders and the demo completes even if the sidecar is unreachable (fallback to a typed-memo path) | Must |
| NFR-3 | Usability | The four-beat demo completes with taps only — no typing, no dead ends — in under 3 minutes | Must |
| NFR-4 | Compatibility | Runs in current Chrome/Safari on macOS; primary viewport is a phone frame (~390×844) | Must |
| NFR-5 | Security | No secret is stored in the app; the sidecar runs local-only on 127.0.0.1 | Must |
| NFR-6 | Maintainability | Domain logic has no React/framework imports; UI depends inward | Should |

## Data

**Entities**

- `Activity` — `{ id, title, day (mon–sun), start (hh:mm), end (hh:mm), kind (class | meeting | activity | work), locked }`
- `GroupMessage` — `{ id, groupId, author, body, detectedDay, detectedTime, detectedIntent }`
- `Notification` — derived from a detected `GroupMessage` + the current week: `{ messageId, groupName, author, ask, busy, conflictReason (day-granularity), counterOffer }`
- `Verdict` — `{ messageId, decision (accept | decline | counter), proposedDay, proposedTime }`
- `Memo` — `{ id, rawText, parsed (title/day/time) | null }`

**Relationships**

- A `Notification` is produced by the listener from one `GroupMessage` against the week's `Activity`s.
- A `Verdict` resolves one `Notification` into a group post and, on accept/counter, one new/moved `Activity`.

**Validation**

- An `Activity` is invalid if `end <= start` or `day` isn't in the seven-day set.
- A `Notification` is "busy" only if an existing `Activity` overlaps the proposed slot; otherwise "free".

**Lifetime**

- `Activity`s persist in `localStorage`. `Notification`s and `Memo`s are session-ephemeral. Volume: tens of activities, one demo group.

## Constraints

- Stack: Vite + React + TS, `vite-plugin-pwa`.
- Voice: local Python sidecar (whisper `small.en` via `mlx-whisper`/`faster-whisper`) at `127.0.0.1:8765`, endpoint `POST /transcribe`.
- Design tokens: from `figma/` — see `docs/design.md`.

## Assumptions

- The incoming WhatsApp message is simulated in-app (a "simulate incoming" trigger), not a live Baileys session.
- The whisper model is already cached in the HF cache from Jarvis use (first call may still download).
- Demo is single-user, single-device.

## Acceptance criteria

```
FR-2/FR-3 — Voice memo → proposed activity
  Given the sidecar is running
  When the user records a memo and releases
  Then a transcript appears and a proposed activity (title, day, time) is shown for confirm, within 5s

FR-6 — Busy vs free notification
  Given a group message proposes a time that overlaps an existing activity
  When the notification surfaces
  Then it shows a day-granularity conflict reason and a counter-time; if free, it shows yes/maybe/no

FR-7 — Verdict posts only on tap
  Given a surfaced notification
  When the user does nothing
  Then nothing posts to the group; only a tap on a verdict posts
```

## Traceability

| ID | From (PRD) | To (feature) | Verified by |
|---|---|---|---|
| FR-1 | §What it does #1 | `docs/features/scheduler.md` | manual |
| FR-2/3/4 | §What it does #2/3 | `docs/features/voice-memo.md` | manual |
| FR-5/6/7/8 | §What it does #4 | `docs/features/whatsapp-listener.md` | manual |

## Cut

- Real WhatsApp (Baileys/Cloud API) integration — POC only, out of scope.
- Real multi-user sync, auth, backend database — single-device demo.
- The chaos feature as a standalone fifth screen — folded into the voice-memo flow (PRD §What it does #2).
