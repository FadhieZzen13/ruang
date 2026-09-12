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
| `--accent` | `#C4694A` | terracotta — primary action / highlight |
| `--gold` | `#D9A441` | amber — secondary accent, warnings |
| `--sage` | `#7A8B6F` | green — free/busy "clear" state |
| `--frame` | `#2A2520` / `#1E1A18` | phone frame charcoal |

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

## Rules

- No drop shadows except on the phone frame and elevated cards.
- One primary (terracotta) action per screen; secondary actions are ink-on-cream text buttons.
- The trust line "It proposes. You decide." is always visible at a confirm step.
- Free/busy state uses sage (`--sage`) for clear and terracotta/amber for conflict — never red/green traffic-light harshness.

## Rejected

- Dark mode — the brand is cream/editorial; dark would double the token surface for no demo gain.
- Red/green for free/busy — too "todo app". Sage + amber keeps it editorial.
- A pure mobile-app native shell — PWA in a phone frame is enough to demo and screen-mirror.
