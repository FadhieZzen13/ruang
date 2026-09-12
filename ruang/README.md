# Ruang

Takes the work off your plate. A student scheduler that listens to your voice and (via a separate WhatsApp bot) your group chats, and clears the pile instead of showing it.

This repo is the **app**: a phone-framed React + Vite PWA with two tabs — **Schedule** (month calendar + today's agenda) and **Voice** (speak a memo → the agent proposes a calendar entry, moving it if the slot's busy).

## Run it

```bash
npm install
cp .env.example .env   # then fill in your key (see below)
npm run dev
```

Open the printed localhost URL in **Chrome or Edge** (the Voice tab uses the browser's built-in speech recognition).

## The agent (Voice tab)

- **Transcription** = the browser's Web Speech API. **No Python sidecar, no key.** If the browser can't do it, use the "…or type a memo" input.
- **Understanding** = an LLM call to an OpenAI-compatible gateway. Set these in `.env`:
  - `VITE_LLM_BASE_URL` (default `https://rootsys.cloud/v1`)
  - `VITE_LLM_API_KEY`
  - `VITE_LLM_MODEL`
- **No key set?** It still works — it falls back to an offline heuristic parser and tags proposals "Offline parse".

> ⚠️ `VITE_*` vars ship to the browser. Fine for a demo against your own gateway; for production, proxy the call through a small backend so the key never reaches the client.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run lint` — oxlint

## Docs

Architecture, design, and per-feature notes live in [`../docs/`](../docs/).
