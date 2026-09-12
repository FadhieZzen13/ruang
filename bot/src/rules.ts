// The trust model — lifted straight from context.md §6. These are not
// suggestions; the rest of the bot is written to make them true. Every place
// that could break one of these points back here.
//
//   1. WATCH ONLY CHOSEN GROUPS. The listener only reads the group chats you
//      list in WATCHED_GROUPS. Never anything else. Empty list = watch nothing.
//
//   2. NEVER POST WITHOUT YOUR TAP. Ruang is silent in the group until you
//      explicitly approve a verdict. There is exactly one code path that sends
//      a message to a group (decisions.postVerdict), and it only runs from an
//      explicit approval. Nothing about detecting a message ever replies.
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
