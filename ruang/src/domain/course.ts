// A course label ("BIO 101", "Literature Review") gets a stable color from a
// fixed palette, so the same course reads the same everywhere without the user
// ever choosing a color. With no label, everything falls back to a neutral slate.
//
// The hues are pulled from the app's own warm palette rather than a generic
// rainbow: every tint is mixed from --bg's cream so a card looks like it belongs
// to the same sheet of paper.

export interface CourseTint {
  // The saturated hue — tag text, progress fill, left border, date number.
  ink: string
  // A very light wash of the same hue — card background.
  wash: string
  // Slightly deeper than the wash — the tag pill background.
  pill: string
  // The label itself, or empty when this is the no-course fallback.
  label: string
}

const PALETTE: { ink: string; hue: string; label: string }[] = [
  { ink: '#b04a34', hue: '#c4694a', label: 'terracotta' },
  { ink: '#9a7620', hue: '#d9a441', label: 'gold' },
  { ink: '#5c6b52', hue: '#7a8b6f', label: 'sage' },
  { ink: '#7a4a6a', hue: '#9c6b8c', label: 'plum' },
  { ink: '#4a5f7a', hue: '#6b82a0', label: 'slate' },
]

// Deterministic index for a string. Same label always lands on the same hue.
function hashIndex(s: string, n: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h) % n
}

// mix a hue with the app's cream ground at `pct` opacity, in sRGB — good enough
// for a flat tint and keeps every hue reading warm instead of chalky.
function wash(hex: string, pct: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const bg = [0xfa, 0xf6, 0xf0]
  const mix = (c: number, base: number) => Math.round(c * pct + base * (1 - pct))
  const to = (c: number) => c.toString(16).padStart(2, '0')
  return `#${to(mix(r, bg[0]!))}${to(mix(g, bg[1]!))}${to(mix(b, bg[2]!))}`
}

// The neutral "no course assigned" tint — the gray tag in the mockups.
export const NEUTRAL_TINT: CourseTint = {
  ink: '#6b625b',
  wash: '#f2ede6',
  pill: '#e8e0d6',
  label: '',
}

export function courseTint(label?: string | null): CourseTint {
  const key = (label ?? '').trim()
  if (!key) return NEUTRAL_TINT
  const c = PALETTE[hashIndex(key.toLowerCase(), PALETTE.length)]!
  return {
    ink: c.ink,
    wash: wash(c.hue, 0.14),
    pill: wash(c.hue, 0.26),
    label: key,
  }
}
