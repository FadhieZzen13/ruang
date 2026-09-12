# WhatsApp Listener

The wow. A chosen group chat is watched for activity-type messages; when one lands, it surfaces privately to Hana, and the verdict posts back only on her explicit tap.

## Status: real bot, in `../../bot/`

This is **no longer an in-app demo screen.** The earlier version simulated it inside the app (a fake "Chat" tab, a "Simulate incoming" button, a notification toast). That was removed — the WhatsApp side is a **real Baileys bot** that runs against WhatsApp on your own number and is shown live in the demo.

The bot lives in [`bot/`](../../bot/) (see its README). It's built and rule-abiding; it just needs the WhatsApp link (QR or number, added later) and the `WATCHED_GROUPS` list filled in. The five trust rules are enforced in [`bot/src/rules.ts`](../../bot/src/rules.ts):

1. Watches only the groups you list (empty = nothing).
2. Never posts without your explicit approval — one gated `postVerdict`, detection never replies.
3. Day-granularity conflict reasons only.
4. The notification always fires, free or busy.
5. Every no ships with a counter-offer.

The approval surface is the bot's terminal for now (type `yes`/`no`/`counter <id>`); that's the seam where the Ruang app or an owner-DM plugs in later, with the posting gate unchanged.

## What stayed in this repo

- `domain/listener.ts` keeps the small `parseDay` / `parseTime` helpers — reused as the Voice tab's offline fallback.
- The scheduling core (`findConflict`, `rebalance`) that the bot's "busy? counter-offer" logic mirrors is still here and unit-testable.

## Trust model (unchanged, now enforced bot-side)

- Ruang is silent in the group until Hana's tap. No tap → no post, ever.
- The verdict is day-granularity: *"Hana can't make Thursday 8pm — how about Friday 7pm?"* The group sees the outcome, never Hana's other commitments.
- The notification always fires — even when free — so silence never becomes a silent commitment.

## Demo wiring

The live bot handles the WhatsApp message → private surface → verdict-on-tap loop. Production path (noted): Baileys (POC) → official Cloud API.
