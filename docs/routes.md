# Routes

Single-page app; no router. Four tabs inside the phone frame, keyed by local state in `App.tsx`:

| Tab | State value | Screen | Doc |
|---|---|---|---|
| Schedule | `week` | `ui/screens/Scheduler.tsx` | features/scheduler.md |
| Tasks | `task` | `ui/screens/Task.tsx` | features/task-plan.md |
| Voice | `voice` | `ui/screens/VoiceMemo.tsx` | features/voice-memo.md |
| Invites | `inbox` | `ui/screens/Inbox.tsx` | features/whatsapp-listener.md |

The **Schedule** tab is a month calendar (today highlighted, dots on days that have activities) over a single-day agenda that defaults to today. The **Tasks** tab takes a piece of work with a deadline and proposes real blocks for it (features/task-plan.md). The **Voice** tab records a memo (browser speech-to-text), sends it to the LLM agent, and proposes one calendar entry. The **Invites** tab shows what the WhatsApp bot is holding for your decision.

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
