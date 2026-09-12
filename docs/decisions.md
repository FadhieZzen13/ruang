# Decisions

| # | Decision | Rationale | Consequences |
|---|---|---|---|
| 1 | Python sidecar for STT, not in-browser whisper | Whisper is ~1GB of models and needs numpy; browser ports (transformers.js) are slow and heavy. Reuses Zen's already-verified Jarvis pipeline. | PWA needs the sidecar running locally to transcribe; falls back to a manual error state otherwise. |
| 2 | `mlx-whisper` on Apple GPU, `faster-whisper` on CPU | Matches `ears.py`; Apple Silicon is Zen's machine, so the GPU path is the hot one. | Two code paths in `transcribe_server.py`; both verified loading. |
| 3 | Raw int16 PCM over `POST /transcribe`, no multipart/wav | Simplest possible contract; MediaRecorder gives webm, we decode to PCM client-side. | We own the resample (Web Audio `AudioContext` at 16kHz) client-side. |
| 4 | `useSyncExternalStore` + a plain mutable store, no Redux/Zustand | Demo is small; a module-level store is the laziest thing that survives reload via localStorage. | State shape is fixed; fine for the demo. |
| 5 | Notification as an overlaid toast inside the phone frame | The wow moment must be visible over whatever screen the user is on. | Only the latest notification shows at a time (a queue's first item). |
| 6 | The WhatsApp group is simulated via a "Simulate incoming" button | Live Baileys is against WhatsApp ToS and heavy for a POC. | The demo's wow is fully reproducible with one tap. |
| 7 | Verdict text is day-granularity only | CONTEXT §6: the group sees the verdict, not exact commitments. | `verdictLine` uses `DAY_LABEL` + time, never other activities. |

## Rejected

- **Baileys/Cloud API live integration** — against ToS + setup cost for a POC; noted as the production path.
- **A fifth chaos screen** — PRD folds chaos into the voice-memo flow ("move this to Thursday — ok?").
- **Real red/green free-busy colours** — too "todo app"; sage/amber keeps the editorial feel (see design.md).
- **A backend database** — single-device demo, localStorage is enough.
