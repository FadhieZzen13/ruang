# Voice Memo

Beat 2 of the demo. Tap the mic, speak, and the agent understands it, then proposes an activity — and, if the target slot is cramped, folds in the chaos rebalance ("that slot's packed — I'd move it to Thursday").

## Flow

1. Tap the record button → `speech.startListening` (browser Web Speech API) transcribes on-device / via the browser. Interim text shows live.
2. On stop, the transcript goes to `agent.proposeFromText` → an OpenAI-compatible LLM call to the gateway → `{ title, day, time }`.
3. If no key is configured (or the call fails), it falls back to the offline `parseMemo` heuristic and tags the card "Offline parse".
4. `scheduling.findConflict` + `rebalance` decide free vs busy → the proposal card.
5. Confirm adds the activity to the week; cancel drops it.

There is also a **"…or type a memo"** input for when the mic isn't available (unsupported browser, no permission) or for a quick demo without speaking — it runs the same agent → propose path.

## The chaos feature (folded in)

The rebalance is *not* a fifth screen. When the spoken slot collides with an existing activity, the proposal card shows the conflict and offers to move it to the next free slot — "Move & add" instead of "Add to week".

## Trust

Nothing is written until "Add to week" / "Move & add" is tapped. The transcript and proposal are shown first. The trust line — "It proposes, you decide. Nothing moves on its own." — sits under the mic in the idle state.

## Failure modes

- **No mic / unsupported browser:** the mic hint says so and the type input takes over.
- **Agent unreachable / no key:** silently falls back to the offline parser (card shows "Offline parse"). The rest of the demo still works — NFR-2.

ponytail: no on-screen confirmation toast after adding; the activity just appears in the calendar. Every memo becomes a fixed 60-minute block for the POC.
