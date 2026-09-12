# Architecture

## Layers

```
src/
  domain/    pure logic — no React, no imports from the framework
  app/       React state + side effects (store, speech, agent, dates)
  data/      seed data
  ui/        components + screens (imports inward only)
```

Dependency rule: `ui → app → domain`; `domain` imports nothing from the others. `data/` feeds `app` with seed content. Business logic (`scheduling`, `memo`) lives in `domain/` and is unit-testable without the browser.

## Modules

| Module | File | Responsibility |
|---|---|---|
| Types | `domain/types.ts` | `Activity`, `Day`, `ActivityKind`, day maps |
| Scheduling | `domain/scheduling.ts` | `findConflict`, `nextFreeSlot`, `rebalance` (chaos) |
| Parse helpers | `domain/listener.ts` | `parseDay`, `parseTime` — offline day/time extraction |
| Memo parse | `domain/memo.ts` | `parseMemo` — offline fallback transcript → proposal |
| Store | `app/store.ts` | activities state + `useSyncExternalStore`, localStorage persist |
| Speech | `app/speech.ts` | `startListening` — browser Web Speech API (no key, no sidecar) |
| Agent | `app/agent.ts` | `proposeFromText` — LLM call to the OpenAI-compatible gateway |
| Dates | `app/dates.ts` | month-grid + weekday helpers for the calendar |
| Seed | `data/seed.ts` | Hana's recurring week |

## Transcription — browser, no sidecar

Speech-to-text is the browser's built-in Web Speech API (`webkitSpeechRecognition`, Chrome/Edge). **No Python sidecar, no API key.** If the browser doesn't support it, the UI falls back to a "type it" text input. The old `transcribe_server.py` whisper sidecar is no longer used.

## The agent

`app/agent.ts` POSTs the transcript to an **OpenAI-compatible** chat endpoint and gets back a structured `{ title, day, time }` proposal. Config is in `.env` (see `.env.example`):

- `VITE_LLM_BASE_URL` — default `https://rootsys.cloud/v1`
- `VITE_LLM_API_KEY` — the key (kept out of git)
- `VITE_LLM_MODEL` — model id the gateway exposes

If no key is set (or the call fails), it falls back to the offline `parseMemo` heuristic and tags the proposal "Offline parse". Scheduling/conflict logic stays **local and deterministic** — the model only does language understanding, never the calendar math.

> ⚠️ `VITE_*` vars ship to the browser. Fine for a demo against your own gateway; for production, proxy the call through a small backend so the key never reaches the client.

## Data flow (voice → calendar)

1. `speech.startListening` transcribes the memo in the browser.
2. `agent.proposeFromText` (or the offline `parseMemo` fallback) → `{ title, day, time }`.
3. `scheduling.rebalance` checks the slot and, if busy, suggests the next free slot (chaos).
4. On confirm, `store.addActivity` appends and persists; it shows up in the calendar's day agenda.

## WhatsApp

Now a **real external bot** (built separately), not an in-app screen. The in-app chat demo, notification toast, and listener/notification logic were removed.

## Decisions

See `docs/decisions.md`.
