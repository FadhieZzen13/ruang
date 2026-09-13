// A Google Calendar "add this event" link.
//
// The stamp is local wall-clock time with no conversion, paired with the ctz
// parameter. Running it through toISOString() would turn a 4pm Jakarta session
// into 9am, because that converts to UTC first.

export interface CalendarEvent {
  title: string
  date: string // 'YYYY-MM-DD'
  start: number // minutes since midnight
  end: number
  details?: string
}

function stamp(date: string, minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0')
  const m = String(minutes % 60).padStart(2, '0')
  return `${date.replace(/-/g, '')}T${h}${m}00`
}

function localZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.date, e.start)}/${stamp(e.date, e.end)}`,
  })
  if (e.details) params.set('details', e.details)
  // Without ctz Google reads the stamp in the account's zone, which is usually
  // right anyway — so only send it when we actually know the device's zone.
  const tz = localZone()
  if (tz) params.set('ctz', tz)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
