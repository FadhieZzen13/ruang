import type { Day } from './types'
import { parseDay, parseTime } from './listener'

export interface ParsedMemo {
  title: string
  day: Day | null
  time: number | null
}

// Turn a transcript like "meet with the club on friday at 7pm" into a proposal.
// Deliberately heuristic — this is the demo's POC, not a model call.
export function parseMemo(text: string): ParsedMemo {
  const day = parseDay(text)
  const time = parseTime(text)

  // Strip day/time phrases and request filler to leave a rough title.
  let title = text
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi, '')
    .replace(/\b(tomorrow|today|tonight|tonite)\b/gi, '')
    .replace(/\b(can you|could you|would you|please|remind me to|add|schedule|put|set up|create|book|make)\b/gi, '')
    .replace(/\b(on|at|this|next|the)\b/gi, '')
    .replace(/\d{1,2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?/gi, '')
    .replace(/[?.!,]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (title.length === 0) title = text.trim()

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    day,
    time,
  }
}
