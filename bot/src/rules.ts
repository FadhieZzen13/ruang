// The trust model — lifted straight from context.md §6. These are not
// suggestions; the rest of the bot is written to make them true. Every place
// that could break one of these points back here.
//
//   1. WATCH ONLY CHOSEN GROUPS. The listener only reads the group chats you
//      list in WATCHED_GROUPS. Never anything else. Empty list = watch nothing.
//
//   2. NEVER POST WITHOUT YOUR TAP. Ruang is silent in the group until you
//      explicitly say so. There are exactly two code paths that send a message
//      to a group — decisions.postVerdict (answering an invite) and
//      decisions.postMessage (your own words, e.g. telling the group about a
//      plan) — and each only runs from an explicit approval. Both refuse any
//      group outside WATCHED_GROUPS. Nothing about detecting a message ever
//      replies.
//
//      Note what this rule does NOT promise: that nobody else can reach the
//      API. With BOT_AUTH_TOKEN blank the whole API is open, and both senders
//      are reachable by anything that can hit the port (/pending lists the ids
//      /decide needs). The tap is the gate on Ruang's own behaviour, not an
//      access control. Set BOT_AUTH_TOKEN and don't expose the port if that
//      matters — bearing in mind the app hands its copy of the token to every
//      browser that loads it.
//
//   3. DAY-GRANULARITY REASONS ONLY. When you're busy, the group is told the
//      day/part-of-day ("unavailable Thursday evening") — never the exact time
//      or what the other commitment is.
//
//   4. THE NOTIFICATION ALWAYS FIRES. Even when you're free. A silence must
//      never become a silent yes — you decide every time, free or busy.
//
//   5. EVERY "NO" SHIPS WITH A COUNTER. A decline offers an alternative, so the
//      bot never just reads as rude (context.md §11).
//
// POC note: login runs on your own number via Baileys (WhatsApp Web protocol).
// The production path is the official Cloud API. The bot never signs up, never
// touches settings, never posts anywhere but the chosen group, and only on tap.

export const RULES = {
  watchOnlyChosenGroups: true,
  neverPostWithoutApproval: true,
  dayGranularityOnly: true,
  alwaysNotify: true,
  declineWithCounter: true,
} as const
