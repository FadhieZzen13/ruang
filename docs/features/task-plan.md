# Task — build a plan

The Tasks tab. You name a piece of work and its deadline; Ruang finds the hours for it in the gaps you actually have, says what to do in each sitting, and — only once you tap — puts the blocks in your week.

## Flow

1. **Build a plan — step 1 of 3** (the capture step, reskinned per `docs/UI-improvement.md`): task name (with example helper text below), an optional course/label, and a deadline split into a date field and a time field. The time defaults to `11:59 PM` silently; the course feeds the card's color. Effort moved to step 2.
2. **Step 2 of 3 — how do you want to approach it?** A recap card of step 1's input sits at the top so nothing is lost crossing steps. Then two `.choice` cards:
   - *Finish it quickly* — fewer, longer sittings (2h each), front-loaded to the earliest free slots, up to 2 a day.
   - *Take my time* — shorter sittings (1h each), one a day, anchored evenly across the run-up so the last one lands on the deadline.
   Same total budget either way; only the shape changes. Below them, the effort chip row (`1–2 hrs / Half a day / Full day / 2+ days`).
3. **Step 3 of 3** shows the concrete plan: an AI info banner, the session cards (last one sage), and `Accept this plan`.
4. `planner.planSessions` places the blocks in real gaps (`domain/planner.ts`). Each placement is added to a working copy before the next is placed, so two sittings can never land in the same gap. Anything that won't fit before the deadline comes back short, and the screen says so rather than quietly planning less.
5. The blocks render immediately with deterministic notes (`task.fallbackSteps`), and `plan-agent.describeSessions` swaps in the model's per-session lines when they arrive. The plan is never gated on the LLM.
6. **Accept this plan** → `plan-actions.acceptPlan` writes one `Activity` per session and saves the task as `planned`.
7. The share step: *Save all N to my calendar* (one `.ics`, every sitting), *Share the plan with someone* (Web Share sheet, clipboard fallback), and *Send the plan to the group* via the bot. The last two send the same editable text — the schedule in words, then **one link carrying the whole plan**.

## Editing

Any proposed session opens an inline editor — date, start, end, note. No modal; the app has no modal pattern. Changing the start **moves** the session and keeps its length. A clash is reported against both the rest of the week and the other sittings of the same plan, and it **warns without blocking**: the user decides.

## Real dates

This is the feature that made `Activity.date` necessary. Accepted sessions are pinned to one calendar date, so they appear on Thursday the 17th and not on every Thursday. Anything without a `date` still floats on its weekday, which is how weekly classes and all pre-existing saved data behave. See `domain/occurrence.ts` — and note that every date string is built from local getters, never `toISOString()`, which would roll the date back a day east of Greenwich.

The bot's schedule payload has no date field, so accepted sessions read as busy on *every* matching weekday in the bot's free/busy. That over-blocks rather than under-blocks — it fails safe.

## Trust

Nothing is written until "Add these to my week". The trust line sits on the proposal step. Nothing is posted to a group until "Send to the group".

What goes out is the plan itself (`task.planText`) — the sittings, what each one is for, and a Google Calendar link per sitting — because the group is usually on the same assignment and wants to work to the same rhythm. It's shown in full in an editable box first; the same text is what "Share the plan with someone" sends.

That is not a hole in RULE 3. RULE 3 governs what the bot volunteers *about your availability* when it answers an invite — "unavailable Thursday evening", never your other commitments. This is you choosing to send your own plan for a piece of shared work, having read and edited every word of it. The line that still holds absolutely: the text contains this task's sessions and nothing else — never another activity, never the rest of your week.

## Failure modes

- **No LLM key / call fails:** the deterministic notes stay and the card reads "offline". The whole flow works with no network.
- **Bot offline:** Send to the group is replaced by the same "Bot offline" treatment the Invites tab uses. Everything else — planning, accepting, calendar links, sharing — is unaffected.
- **No room before the deadline:** the plan comes back partial, with "Only 2h of 4h fits before the deadline"; an entirely full week says so instead of proposing nothing.

progress is **derived, not stored** (`task.progressPercent`): a session counts as done once its window has passed, so a task reads as ~100% as the deadline nears. There is still no manual tick — you remove work by deleting blocks. The Tasks list also shows a countdown (`task.countdownLabel`: hours when the deadline is today, days otherwise) and colors by course (`domain/course.ts`).

## The share link

`planLink()` encodes the task into `#/p/<payload>` (see `domain/share-link.ts`).
Whoever opens it gets `ui/screens/SharedPlan.tsx`: every sitting with its date,
time and what it's for, a Google Calendar link per sitting, and one button that
adds all of them to their own week at once. The tab bar is hidden — the link is
about the plan, not about the app.

Three things that matter in that file:

- **The payload is untrusted.** It came from a link that anyone could have
  edited, so `decodePlan` validates every field, caps the sizes, drops
  individual malformed sittings, and returns `null` rather than throwing.
- **Weekdays are re-derived** from the dates in the payload, never trusted from
  it, so a hand-edited link can't produce a session whose day and date disagree.
- **Re-opening is safe.** People re-tap links in chats. The task id is a hash of
  the plan itself, and the screen recognises a plan already in the week and says
  so instead of adding a second copy.

There is no backend, so there is no `abc123` — the plan rides in the fragment,
which never reaches a server. Nothing about a shared schedule is stored or
logged anywhere. The cost is a long URL (~300 characters for four sittings);
chat apps render it as one tappable link.

## Saving the whole plan to a calendar

`domain/ics.ts` writes every sitting into a single `.ics` (`app/download.ts`
hands it to the browser). Google's `render?action=TEMPLATE` URL carries exactly
one event and has no multi-event form, so one tap for a whole schedule has to be
a calendar file. It imports into Google Calendar, Apple Calendar and Outlook
alike, and it's offered in the same place on both screens — the sender's share
step and the recipient's shared-plan page.

Details that matter:

- **Times are floating** (`DTSTART:20260915T200000`, no `Z`, no `TZID`): 8pm
  imports as 8pm in whatever calendar opens it, which is what a study plan
  means. A UTC conversion here would move every session.
- `DTSTAMP` *is* UTC, as the spec requires — the one place a `Z` belongs.
- Text is escaped per RFC 5545 (`,`, `;`, `\`, newlines) and lines are folded at
  75 octets, so a long title can't corrupt the file.
- UIDs are derived from the session, so re-importing updates rather than
  duplicates.
- The filename is the task and the group — `group-assignment-test-bot.ics` —
  so it's recognisable in a downloads list.

## The short link

When the bot is reachable the app publishes the `.ics` to it and shares that
URL instead:

    http://<host>/bot/plan/group-assignment-test-bot-1x13.ics    (65 chars)

Short, readable, named after the task and the group — and the link IS the
calendar file, so opening it on a phone offers the whole schedule to Calendar in
one step. The four-character suffix is derived from the task, so the same plan
keeps the same URL, and someone can't reach your plans by guessing
`lab-report.ics`.

The bot has to be running and reachable for that link to work. When it isn't,
the app falls back to the self-contained fragment link below, and says so under
the message box. Sharing never depends on the bot: the message is always
visible, editable and shareable — only *posting to a group* needs it.

## The fallback link

`#/p/<slug>/<payload>` puts the task and group at the front
(`…/#/p/group-assignment-test-bot/WyJHcm91cCBB…`) so the link opens with words
instead of base64. The slug is cosmetic: `readPlanFromHash` always takes the
last segment as the payload, and older links with no slug still work.

It is **not** shorter — the slug adds ~30 characters. A genuinely short
`/task/abc123` needs somewhere to store the plan and look it up, which this app
deliberately doesn't have. The trade to make knowingly: short links mean shared
schedules live on a server; fragment links mean they live only in the link.
