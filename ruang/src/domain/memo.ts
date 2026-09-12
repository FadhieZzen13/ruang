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

  // Strip the day/time phrases to leave a rough title.
  let title = text
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi, '')
    .replace(/\bon\b/gi, '')
    .replace(/\bat\b/gi, '')
    .replace(/\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (title.length === 0) title = text.trim()

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    day,
    time,
  }
}
