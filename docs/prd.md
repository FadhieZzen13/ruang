# RUANG — PRD

## Why

2nd and 3rd-year students don't fail because they're disorganised. Their week is built by three or four other people — a lecturer, a club, a manager, a groupmate — and none of them can see each other. So every request looks reasonable on its own, and the pile is invisible to everyone, including the student. "I don't know where to start" is the symptom; uncontrolled arrival is the cause. RUANG answers a question every other scheduler dodges: *does it reduce the pile, or just display it?* It reduces it.

If this doesn't get built, the hackathon has no demoable proof of the one mechanism nobody in the room has built — an app that *notices first* and acts before the student has to watch.

## Who it's for

2nd and 3rd-year students holding a committee position while working part-time. For the demo: one user (Hana) and one group (COM203 Group Project).

## What it does

Four features, one arc. All interaction is real (no canned "demo mode"), but the incoming WhatsApp message and the voice transcription are simulated locally — this is a POC, not a WhatsApp integration.

1. **Scheduler** — the base. A week view of classes, meetings, and activities, editable.
2. **Voice memo** — record a memo, the real whisper transcription (extracted from Jarvis/backtalk `ears.py`) produces a proposed entry (move/create), the user confirms before anything lands. Folds in the chaos feature: when the week is cramped, the proposal includes a rebalance suggestion ("you're cramped Tuesday — move to Thursday?").
3. **Chaos rebalance** — when the week is over-full, the agent surfaces *decisions* ("drop this tonight, because X"), reflected into the calendar only on confirm.
4. **WhatsApp listener** — the wow. A chosen group chat surfaces an activity-type message (meeting/meet-up/sports) as a private notification in the app. The user accepts, declines, or counters with a new time; the verdict posts back to the group only on the user's tap.

The listener and the chaos feature are the same wow from two sides: *the agent notices the pile and acts before you have to.*

## What it does NOT do

- **No real WhatsApp integration** (Baileys/Cloud API). The incoming message is a simulated push triggered in-app for the demo. Production path is the official Cloud API — out of scope.
- **No real WhatsApp integration** (Baileys/Cloud API) — unchanged, out of scope.
- **No auth, no database.** Single-user, single-device demo; persistence is `localStorage`.
- **No production STT infra.** Transcription runs through a local Python sidecar that reuses the Jarvis whisper pipeline — not a cloud API, not deployable.
- **No multi-user sync, no real group adoption.** Works single-player from day one.
- **No mobile-app build** — it's a PWA that screen-mirrors.

## Success

The 3-minute, four-beat demo runs end-to-end without a dead end:

1. Scheduler opens showing a populated week.
2. A voice memo creates a new activity (with a chaos rebalance suggestion folded in).
3. A simulated WhatsApp message surfaces in-app as a private notification.
4. Hana declines/counters, the verdict "posts" to the group, and the phone is already handled.

Measured by: the flow completes with only taps, no dead ends, and the trust model ("it proposes, you decide") is visible at every confirm step.

## Constraints

- **Deadline:** hackathon demo.
- **Platform:** PWA, runnable via `npm run dev` and screen-mirrorable; primary device is a phone-frame viewport.
- **Stack:** Vite + React + TypeScript, `vite-plugin-pwa` for the PWA manifest/service worker. Voice: local Python sidecar (whisper via `mlx-whisper`/`faster-whisper`) exposing `POST /transcribe`.
- **Design:** match the Figma design system in `figma/` — warm off-white `#FAF6F0`, terracotta `#C4694A`, amber `#D9A441`, sage `#7A8B6F`, ink `#1F1B18`, secondary `#6B625B`.

## Open questions

- Font family from the Figma design system — resolved: Zen said "just pick one"; using a warm serif (`Fraunces`) + humanist sans (`Instrument Sans`).
- Voice memo backend — resolved: Python sidecar reusing the Jarvis whisper pipeline.

## Rough shape

Clean architecture: `domain/` (pure scheduling + listener logic, no React), `app/` (React state/UI), `data/` (seed data + localStorage adapter), `ui/` (components). Business logic never imports the framework. Docs live in `docs/`, design tokens in `docs/design.md`.
