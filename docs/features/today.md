# Today — the dashboard

The Schedule tab's landing screen (`ui/screens/Today.tsx`). It answers "what's on
today and what's waiting on me?" before you've asked, and the month calendar is
one tap away at the top.

## What it shows

1. **Term line** — `WEEK 4 OF 14`, the same global header the Tasks list wears.
2. **Greeting** — time-of-day aware, using the editable name, over a stat line
   that colors two inline spans: `Today, you will have 12 hrs work and 8 hrs free.`
   The hours are computed from the real day's activities; "free" is the waking-day
   gap not covered by anything.
3. **Week strip** — Sunday through Saturday, today as a filled terracotta circle.
   Each day carries a dot per thing on it, colored by `Activity.kind` — a compact
   busy-heatmap.
4. **Today's Plan / Due This Week** — an underline-tab switch. The plan is the
   agenda with the free gaps left in: a `12am – 10am · 10 hrs free` row with a
   dashed `+` to add something there, event blocks tinted by course (tasks) or
   kind (everything else), and a **NOW** rule at the live clock time. The second
   tab lists tasks due in the next seven days.
5. **Invitations** — a count and up to three condensed preview cards from the
   bot's pending list, each naming the sender, the ask, and a status line. Unlike
   the bot's group replies (RULE 3), a preview shown privately to the owner may
   name the specific conflicting task — that's the detail the owner is supposed
   to get.

## The month calendar is still there

The top toggle swaps to `Scheduler.tsx`, unchanged: month grid, busy dots,
Demo/Clear, `+ Add`, recurrence. The dashboard is a front door, not a
replacement — resolving the first open question in `docs/UI-improvement.md`.

## Live clock

`NOW` needs a ticking clock, not a render-time `Date`. A 30-second interval
updates it; the marker slides to the right gap as time moves rather than jumping
to a fixed row.
