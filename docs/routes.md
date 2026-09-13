# Routes

Single-page app; no router. Five tabs inside the phone frame, keyed by local state in `App.tsx`:

| Tab | State value | Screen | Doc |
|---|---|---|---|
| Schedule | `week` | `ui/screens/Today.tsx` (default) / `ui/screens/Scheduler.tsx` (month) | features/today.md, features/scheduler.md |
| Task | `task` | `ui/screens/Task.tsx` | features/task-plan.md |
| Ask | `ask` | `ui/screens/VoiceMemo.tsx` | features/voice-memo.md |
| Invitation | `inbox` | `ui/screens/Inbox.tsx` | features/whatsapp-listener.md |
| Profile | `profile` | `ui/screens/Profile.tsx` | — (name + demo controls) |

The **Schedule** tab opens on the **Today** dashboard (greeting, work/free stat line, week strip, agenda with free gaps and a live NOW marker, inline invitations) with the month calendar one tap away — a Today/Month toggle at the top swaps them, because the month view still has shipped features (Demo/Clear, +Add, recurrence) that the dashboard doesn't. The **Task** tab lists open tasks in course colors, then a 3-step build-a-plan wizard (features/task-plan.md). The **Ask** tab is the raised center FAB: record a memo (browser speech-to-text), the LLM agent proposes one calendar entry. The **Invitation** tab shows what the WhatsApp bot is holding for your decision. The **Profile** tab holds the editable name and the demo controls (was inline on the Schedule header).

## The redesign

`docs/UI-improvement.md` records the six-mockup redesign this nav and its screens implement. Its open questions were resolved with the product owner: the dashboard sits *in front of* the month calendar (not replacing it), progress is derived from sessions elapsed, course colors come from a fixed hash palette, the deadline carries a time (default 11:59 PM), and the Profile tab is functional.

The in-app WhatsApp **Chat** tab was removed — the WhatsApp side is now a real external bot (see features/whatsapp-listener.md), not a simulated in-app screen.

## The one URL that means something: shared plans

`#/p/<payload>` opens a plan someone shared with you. It takes over the whole
frame — no tab bar — because whoever follows the link wants the schedule, not
an app they may not use. `domain/share-link.ts` decodes it, `ui/screens/
SharedPlan.tsx` renders it, and `App.tsx` watches `hashchange` so a link tapped
while the app is already open still works.

The plan travels inside the fragment rather than behind an id, because there is
no backend to keep a row in. A fragment never reaches the server, so a shared
schedule isn't stored or logged anywhere — the trade is a long URL. Swapping to
`/task/abc123` is a storage change behind `encodePlan`/`decodePlan`, not a
rewrite of the screen.

ponytail: still no router — one hash prefix, checked on load and on hashchange.
