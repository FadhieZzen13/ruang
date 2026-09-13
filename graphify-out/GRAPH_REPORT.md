# Graph Report - hackathon2  (2026-09-12)

## Corpus Check
- 10 files · ~304,780 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 386 nodes · 650 edges · 28 communities (16 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.83)
- Token cost: 73,567 input · 0 output

## Community Hubs (Navigation)
- Voice Agent & Domain Types
- Bot Decision & Control
- Bot WhatsApp Connection
- Product & Design Overview
- App Store & Calendar Utils
- App Dependencies
- App TS Config
- Node TS Config
- OpenCode Config
- App Inbox & Bot Client
- Bot TS Config
- Whisper Sidecar (legacy)
- Core Feature Concepts
- Design System Artboards
- Oxlint Config
- App Entry Point
- Root TS Config
- Bot Trust Rules
- Speech Transcription
- Bot README
- Context Summary
- Architecture Docs
- Dark Mode (Rejected)
- Group Chat Script
- App Icon
- UI Icons
- Hero Image
- Vite Logo

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 18 edges
2. `Day` - 15 edges
3. `compilerOptions` - 15 edges
4. `Scheduler()` - 14 edges
5. `VoiceMemo()` - 13 edges
6. `fmt()` - 12 edges
7. `compilerOptions` - 11 edges
8. `onMessage()` - 9 edges
9. `startServer()` - 9 edges
10. `setActivities()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Design System for Ruang` --semantically_similar_to--> `Ruang Application`  [INFERRED] [semantically similar]
  figma/Design System for Ruang.svg → README.md
- `Index HTML` --references--> `Favicon (Lightning Bolt)`  [INFERRED]
  index.html → public/favicon.svg
- `Python Sidecar STT Decision` --semantically_similar_to--> `Web Speech API Transcription`  [INFERRED] [semantically similar]
  docs/decisions.md → ruang/README.md
- `Chaos Rebalance Feature` --implements--> `Domain Scheduling Logic`  [EXTRACTED]
  docs/features/voice-memo.md → domain/scheduling.ts
- `Index HTML` --references--> `Main Entry Point`  [EXTRACTED]
  index.html → src/main.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agentic Scheduling Flow** — app_speech, app_agent, domain_scheduling, app_store [EXTRACTED 0.90]
- **Ruang Visual Identity** — figma_design_system, public_icon, public_favicon, src_assets_hero [EXTRACTED 0.90]
- **Ruang Design Assets** — figma_design_system_for_ruang_4_svg, figma_design_system_for_ruang_5_svg, figma_design_system_for_ruang_6_svg, figma_design_system_for_ruang_7_svg, figma_design_system_for_ruang_8_svg [EXTRACTED 1.00]
- **Four-Beat Demo Flow** — docs_features_scheduler_scheduler, ruang_readme_voice_tab, whatsapp_bot, docs_requirements_verdict_entity [EXTRACTED 1.00]
- **GroupMessage to Verdict Pipeline** — docs_requirements_groupmessage_entity, docs_requirements_notification_entity, docs_requirements_verdict_entity, docs_requirements_activity_entity [EXTRACTED 1.00]
- **Warm Editorial Design System** — docs_design_signature_move, docs_design_colour_tokens, docs_design_inter_typeface, docs_design_free_busy_state [INFERRED 0.85]

## Communities (28 total, 12 thin omitted)

### Community 0 - "Voice Agent & Domain Types"
Cohesion: 0.07
Nodes (46): ActionKind, AgentAction, env, hasAgent(), normalize(), proposeAction(), ScheduleLite, stripFences() (+38 more)

### Community 1 - "Bot Decision & Control"
Cohesion: 0.10
Nodes (42): WATCHED_GROUPS, renderPending(), startControl(), addPending(), Decision, getPending(), listPending(), Pending (+34 more)

### Community 2 - "Bot WhatsApp Connection"
Cohesion: 0.06
Nodes (37): dependencies, pino, qrcode-terminal, @whiskeysockets/baileys, description, devDependencies, tsx, @types/node (+29 more)

### Community 3 - "Product & Design Overview"
Cohesion: 0.06
Nodes (38): Module-Level Store Decision, Raw PCM Transcribe Contract, Python Sidecar STT Decision, Simulated WhatsApp Decision, Overlaid Toast Notification Decision, Colour Tokens, Free/Busy Colour Rule, Inter Typeface (+30 more)

### Community 4 - "App Store & Calendar Utils"
Cohesion: 0.12
Nodes (28): syncSchedule(), addMonths(), dayKeyOf(), DOW_LABELS, monthLabel(), monthMatrix(), sameDay(), activities (+20 more)

### Community 5 - "App Dependencies"
Cohesion: 0.07
Nodes (29): @types/node, oxlint, react-dom, @types/react, @types/react-dom, vite, vite-plugin-pwa, @vitejs/plugin-react (+21 more)

### Community 6 - "App TS Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 7 - "Node TS Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "OpenCode Config"
Cohesion: 0.12
Nodes (15): models, name, npm, options, limit, name, context, output (+7 more)

### Community 9 - "App Inbox & Bot Client"
Cohesion: 0.26
Nodes (11): react, App(), BOT_URL, decide(), Decision, env, getPending(), PendingInvite (+3 more)

### Community 10 - "Bot TS Config"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, lib, module, moduleResolution, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck (+4 more)

### Community 11 - "Whisper Sidecar (legacy)"
Cohesion: 0.23
Nodes (11): ndarray, _apple_gpu_available(), main(), _cors(), do_OPTIONS(), do_POST(), RUANG transcribe sidecar. A thin HTTP wrapper around the whisper transcription…, Apple Silicon only: mlx-whisper runs the same model on the GPU. (+3 more)

### Community 12 - "Core Feature Concepts"
Cohesion: 0.25
Nodes (8): LLM Agent, App State Store, Chaos Rebalance Feature, Recurring Weekly Seed, WhatsApp Listener Feature, Product Requirements Document, Domain Listener Helpers, Domain Scheduling Logic

### Community 13 - "Design System Artboards"
Cohesion: 0.25
Nodes (3): Color Palette, Ruang Design System, Typography System

### Community 14 - "Oxlint Config"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 15 - "App Entry Point"
Cohesion: 0.67
Nodes (3): Index HTML, Favicon (Lightning Bolt), Main Entry Point

## Knowledge Gaps
- **145 isolated node(s):** `Phase`, `Handlers`, `Tab`, `DAY_PATTERNS`, `JS_DAY` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 168 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `App Inbox & Bot Client` to `Voice Agent & Domain Types`, `App Store & Calendar Utils`, `App Dependencies`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Why does `@types/node` connect `App Dependencies` to `Bot WhatsApp Connection`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `typescript` connect `Bot WhatsApp Connection` to `App Dependencies`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `Phase`, `Handlers`, `Tab` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Voice Agent & Domain Types` be split into smaller, more focused modules?**
  _Cohesion score 0.07467532467532467 - nodes in this community are weakly interconnected._
- **Should `Bot Decision & Control` be split into smaller, more focused modules?**
  _Cohesion score 0.1048265460030166 - nodes in this community are weakly interconnected._
- **Should `Bot WhatsApp Connection` be split into smaller, more focused modules?**
  _Cohesion score 0.06341463414634146 - nodes in this community are weakly interconnected._