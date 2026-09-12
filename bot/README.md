# Ruang — WhatsApp bot

The real WhatsApp side of Ruang. It watches the group chats you choose, notices
activity invites, and surfaces them to you privately — then posts a verdict back
to the group **only when you approve it**. Runs on your own number via Baileys
(WhatsApp Web protocol); the production path is the official Cloud API.

## The rules it keeps (from `../context.md` §6)

See [`src/rules.ts`](src/rules.ts). In short:

1. **Watches only the groups you list** (`WATCHED_GROUPS`). Empty = watches nothing.
2. **Never posts without your tap.** One code path posts to a group
   (`decisions.postVerdict`) and it only runs from an explicit approval.
   Detecting a message never replies.
3. **Day-granularity reasons only** — "unavailable Thursday evening", never the
   exact time or what your other commitment is.
4. **The notification always fires**, even when you're free — you decide every time.
5. **Every no ships with a counter-offer.**

## Setup

```bash
cd bot
npm install
cp .env.example .env   # optional — you can link by QR without editing anything
```

## Link your WhatsApp (do this when you're ready)

- **By QR (no number needed):** just run `npm start` and scan the QR in
  WhatsApp → **Linked devices → Link a device**.
- **By pairing code:** put your number in `.env` as `OWNER_NUMBER` (E.164, no `+`),
  run `npm start`, and it prints a code to type under **Link with phone number**.

The session is saved in `auth/` (git-ignored). Delete that folder to log out.

## Choose which groups it watches

After linking once:

```bash
npm run groups
```

It prints every group you're in with its JID. Paste the ones you want into
`WATCHED_GROUPS` in `.env` (comma-separated), then `npm start` again.

## Use it

Run `npm start`. When someone in a watched group proposes an activity, you'll
see a private notification in the terminal:

```
🔔 [a1] COM203 — Aiman
   "yo meet thursday 8pm to finish the slides?"
   → Thursday 8pm (busy — Thursday evening) · counter: Friday 7pm
   reply:  yes a1  |  no a1  |  counter a1
```

Type `yes a1` / `no a1` / `counter a1` to post the verdict to the group. Until
you do, **nothing is sent**.

> The terminal is the approval surface for now. It's the seam where the Ruang
> app (or a DM to your own number) plugs in later — the posting gate stays
> exactly the same.

## Your week (free/busy)

Free/busy comes from [`schedule.json`](schedule.json) (the demo week). Drop a
`schedule.local.json` (git-ignored) with your real week to override it — same
shape. Later this can be exported straight from the Ruang app.

## Files

| File | Job |
|---|---|
| `src/rules.ts` | the trust rules, as the single source of truth |
| `src/wa.ts` | Baileys connection, QR/pairing, watched-group filter |
| `src/detect.ts` | is this an invite? day/time/title (heuristic POC) |
| `src/schedule.ts` | free/busy + day-granularity reason + counter-offer |
| `src/decisions.ts` | pending queue + the ONE gated `postVerdict` |
| `src/control.ts` | the terminal approval surface (your "tap") |
| `src/index.ts` | wiring: detect → surface (never reply) → await approval |
