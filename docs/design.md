# Design

## Devices

Primary: phone frame (~390×844), rendered as a centered phone mockup on a warm neutral backdrop so it screen-mirrors cleanly on a projector. Secondary: the same layout at desktop width (phone stays centered, no reflow).

## Reference

The Figma design system in `../figma/` (10 SVGs). A warm, editorial, terracotta-and-sage palette on off-white, with a dark charcoal phone frame. The App.svg shows the full app; the "Design System for Ruang-*" files show individual screens.

## Tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAF6F0` | app surface (off-white) |
| `--bg-dim` | `#E8E0D6` | backdrop / muted surface |
| `--ink` | `#1F1B18` | primary text |
| `--ink-2` | `#6B625B` | secondary text |
| `--ink-3` | `#9A9088` | tertiary text / eyebrows |
| `--accent` | `#C4694A` | terracotta — primary action / highlight |
| `--accent-ink` | `#9C492C` | terracotta darkened for small text (4.5:1 on cream) |
| `--gold` | `#D9A441` | amber — secondary accent, warnings |
| `--sage` | `#7A8B6F` | green — free/busy "clear" state |
| `--sage-ink` | `#556347` | sage darkened for small text (4.5:1 on cream) |
| `--frame` | `#2A2520` / `#1E1A18` | phone frame charcoal |

The two `*-ink` tokens exist because the saturated hues are fills and large type: at 14px or smaller on the cream ground, `--accent` and `--sage` fall under 4.5:1. Small colored text (the dashboard's "12 hrs work / 8 hrs free" stats, the week-strip labels) uses the ink pair instead.

### Course colors

Task sessions color by **course/label**, not by `Activity.kind` — the two systems live on different data, so they never fight for one element. `domain/course.ts` hashes a label into a fixed five-hue palette (terracotta, gold, sage, plum, slate), each yielding an `ink` (tag text, progress fill, left border), a `wash` (card background) and a `pill`. A task with no course falls back to a neutral slate. The hues are mixed from the cream ground in sRGB so every tint reads as the same sheet of paper.

### Type

- One typeface everywhere: **Inter** (clean, modern, neutral). Headings use weight 700 with tight tracking (-0.02em); body/UI use 500–600. The old Fraunces/Instrument Sans serif pairing was dropped — read as too "editorial notebook" and not the crisp app feel wanted.
- Size ramp (px): 11 / 13 / 14 / 15 / 18 / 22 / 26

### Spacing & radii

- 8pt base rhythm; cards radius 16px; buttons radius 12px (pill for primary CTA); phone frame radius 40px.

### Depth

- Flat, warm. No hard shadows. One soft diffuse shadow on the phone frame and on elevated cards. Borders are subtle (`#D0C8BE` at low alpha) rather than shadows for separation.

### Density

Airy. Generous whitespace, one primary action per screen, large tap targets. This is the missed token most often — the Figma screens are sparse, not packed.

### Motion

Minimal and purposeful. While recording, the mic shows calm equalizer bars (a steady 1s ease, not the old shockwave "pump"). No bouncy/squashy motion — it's a calm, "takes things off your plate" feel.

## The signature move

**The warm off-white + terracotta palette, set in clean Inter.** It reads calm and modern — the warmth comes from the cream + terracotta, not from a serif. The terracotta is used *sparingly*, only for the single primary action, today's date, and the conflict highlight, so every accent feels like the app is quietly pointing at the one thing that matters.

## Component language (the redesign)

The UI-improvement build added a second layer of components in `index.css`, all built from the same tokens:

- **`.plan-banner`** — full-width solid-terracotta CTA card (translucent `+` badge, two-line copy). The Tasks list's way into the wizard.
- **Two segmented controls, deliberately different.** `.seg` (pill-track, white pill in a gray track) is the **scope switch** on the Tasks list ("This week / month / year" — which records the list *shows*). `.seg-underline` (accent text + underline) is the **view switch** on the dashboard ("Today's Plan / Due This Week" — which facet of the same day you're looking at). Different jobs, so different weight; this was a resolved open question, not an inconsistency.
- **`.choice`** — the wizard's pacing card: icon badge, title, description, an embedded 3-bar distribution preview, selected = 2px terracotta border + teal-soft fill + filled check. The "Take my time" bars are sage even though its badge is beige — intentional, borrowing the app's "calm/even" semantic.
- **`.ai-banner`** — pale-peach card with a round `R` avatar. It's the same "the AI said this" signal the Voice tab makes with gray text; the wizard uses the heavier card because it also states the tap-to-edit affordance. Two weights, two contexts, not two competing conventions for one.
- **`.session2`** — proposed/committed session card with a 4px left border. The **last session of a plan is sage**, the working ones terracotta: the submission-adjacent sitting is marked distinctly. This is the one place a thick side border is kept, and it's earning real semantics (the mockup specifies it).
- **`.tl-node`** — the share screen's timeline day marker (small-caps weekday over a large date number, connected by a hairline). Same sage-for-last rule, expressed as the node's color.
- **Today dashboard**: `.week-strip` (S–S, today a filled circle, per-day busy dots), `.gap-row` with a dashed `+` (a per-gap add, not the old single global `+`), `.now-mark` (a live horizontal rule at the real clock time), `.event-block` (course- or kind-colored).

Progress bars animate with `transform: scaleX`, never `width`, so a plan landing never thrashes layout.

## Rules

- No drop shadows except on the phone frame and elevated cards.
- One primary (terracotta) action per screen; secondary actions are ink-on-cream text buttons.
- The trust line "It proposes. You decide." is always visible at a confirm step.
- Free/busy state uses sage (`--sage`) for clear and terracotta/amber for conflict — never red/green traffic-light harshness.

## Rejected

- Dark mode — the brand is cream/editorial; dark would double the token surface for no demo gain.
- Red/green for free/busy — too "todo app". Sage + amber keeps it editorial.
- A pure mobile-app native shell — PWA in a phone frame is enough to demo and screen-mirror.
