# Routes

Single-page app; no router. Two tabs inside the phone frame, keyed by local state in `App.tsx`:

| Tab | State value | Screen | Doc |
|---|---|---|---|
| Schedule | `week` | `ui/screens/Scheduler.tsx` | features/scheduler.md |
| Voice | `voice` | `ui/screens/VoiceMemo.tsx` | features/voice-memo.md |

The **Schedule** tab is a month calendar (today highlighted, dots on days that have activities) over a single-day agenda that defaults to today. The **Voice** tab records a memo (browser speech-to-text), sends it to the LLM agent, and proposes one calendar entry.

The in-app WhatsApp **Chat** tab was removed — the WhatsApp side is now a real external bot (see features/whatsapp-listener.md), not a simulated in-app screen.

ponytail: no URL routing — a demo doesn't need deep links or history.
