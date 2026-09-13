# Ruang — WhatsApp bot

The real WhatsApp side of Ruang. It watches the group chats you choose, notices
activity invites, and surfaces them to you privately — then posts a verdict back
to the group **only when you approve it**. Runs on your own number via Baileys
(WhatsApp Web protocol); the production path is the official Cloud API.

## The rules it keeps (from `../context.md` §6)

See [`src/rules.ts`](src/rules.ts). In short:

1. **Watches only the groups you list** (`WATCHED_GROUPS`). Empty = watches nothing.
2. **Never posts without your tap.** Exactly two code paths post to a group —
   `decisions.postVerdict` (answering an invite) and `decisions.postMessage`
   (your own words, e.g. telling the group about a plan) — and each only runs
   from an explicit approval. Both refuse any group outside `WATCHED_GROUPS`.
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
| `src/decisions.ts` | pending queue + the two gated senders (`postVerdict`, `postMessage`) |
| `src/control.ts` | the terminal approval surface (your "tap") |
| `src/index.ts` | wiring: detect → surface (never reply) → await approval |

## Planning from chat

Say it and Ruang builds the schedule. Only YOUR messages trigger it — in your
self-chat, or in a watched group from your own number. Groupmates talking about
deadlines never set anything off.

```
you    ruang, plan the group report due monday
ruang  Plan for "Group report" — due Mon, Sep 14
       1. Sun, Sep 13, 9am-11am - Start and outline
       2. Mon, Sep 14, 12:30pm-2:30pm - Finish and review
       2 sessions - 4h total
       Reply "share p1" to post it to the group.
       Or "p1 6h" / "p1 quick" to change the size or pace.
you    share p1
       -> NOW the group gets the schedule + one .ics link
```

If the deadline is missing it asks **one** question — privately, in your DM —
and nothing else. Size defaults to 4h and pace to "take your time"; both are
changeable on the draft (`p1 6h`, `p1 quick`) rather than asked up front.

The question and the draft never touch the group. RULE 2 is unchanged: the only
thing that reaches it is what you `share`.

The same works in the app's Voice tab — say "plan the lab report due friday" and
it lands on the proposed blocks; say it without a deadline and it asks the one
question, then plans.

## API

Everything the app talks to. If `BOT_AUTH_TOKEN` is set, every route except
`/health` needs `Authorization: Bearer <token>` (or `x-bot-token`).

| Route | Does |
|---|---|
| `GET /health` | liveness + whether auth is on |
| `GET /pending` | invites waiting on your decision |
| `POST /schedule` | the app pushes your week (full overwrite) |
| `POST /decide` | `{id, decision, message?}` — posts a verdict, on your tap |
| `GET /groups` | the watched groups, so the app can offer a picker |
| `POST /say` | `{jid, text}` — posts your own words to a watched group, on your tap |
| `POST /plan` | `{slug, title, ics}` — parks a plan's calendar file for sharing |
| — | plans asked for in chat are hosted here too, then linked in the group |
| `GET /plan/<slug>.ics` | serves it as `text/calendar` — **public, no token** |

`GET /groups` returns only the groups in `WATCHED_GROUPS`, never every group
you're in — that list is for you at a terminal (`npm run groups`), not for a
browser.

`GET /plan/<slug>.ics` is public on purpose: it IS the share link, opened by
people who have no token and may not use Ruang at all. Serving it as
`text/calendar` is what lets a phone hand the whole schedule to its calendar app
in one tap — a Google Calendar URL can only ever carry one event. Slugs carry a
short random suffix so plans can't be reached by guessing the task name, and
plans are stored in `plans.local.json` (git-ignored). Posting one needs the same
token as everything else behind the gate.

`POST /say` sits at the same trust level as `POST /decide`: both post to a group
only on your tap, both refuse groups outside `WATCHED_GROUPS`, and both are
behind `BOT_AUTH_TOKEN` when one is set. With a blank token the whole API is
open — including `/pending`, which hands out the ids `/decide` needs — so on a
shared network set a token, or don't expose the port. A token is not a secret
from app users either: the app inlines `VITE_BOT_TOKEN` into its browser
bundle.

### RULE 2 regression test

Run this after touching anything in `server.ts` or `decisions.ts`:

```bash
# 1. no token configured -> the route refuses to exist, nothing sent
curl -s -X POST localhost:8788/say -H 'Content-Type: application/json'   -d '{"jid":"<watched-jid>","text":"hi"}'
#    {"ok":false,"error":"set BOT_AUTH_TOKEN before sending messages from the app"}

# with BOT_AUTH_TOKEN=secret in .env and the bot restarted:

# 2. no auth header -> 401, nothing sent
curl -s -X POST localhost:8788/say -H 'Content-Type: application/json'   -d '{"jid":"<watched-jid>","text":"hi"}'

# 3. authed but an unwatched group -> refused, nothing sent
curl -s -X POST localhost:8788/say -H 'Authorization: Bearer secret'   -H 'Content-Type: application/json' -d '{"jid":"stranger@g.us","text":"hi"}'

# 4. authed + watched -> posts exactly once, and /pending is untouched
curl -s -X POST localhost:8788/say -H 'Authorization: Bearer secret'   -H 'Content-Type: application/json' -d '{"jid":"<watched-jid>","text":"hi"}'
```
