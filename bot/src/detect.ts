import type { Day } from './types.js'

// Cheap keyword/day/time detection — the same heuristics the app uses. This is
// the POC path; production would hand the message to the LLM agent. Ported from
// ruang/src/domain/listener.ts so the two sides read messages the same way.
// ponytail: duplicated with the app on purpose — the bot is a separate service.

const DAY_PATTERNS: [Day, RegExp][] = [
  ['mon', /monday|\bmon\b|\bsenin\b|\bsenen\b|\bsen\b/i],
  ['tue', /tuesday|\btues\b|\btue\b|\bselasa\b|\bsel\b/i],
  ['wed', /wednesday|\bwed\b|\brabu\b|\brebo\b|\brbu\b/i],
  ['thu', /thursday|\bthurs\b|\bthu\b|\bkamis\b|\bkemis\b|\bkm\b/i],
  ['fri', /friday|\bfri\b|\bjumat\b|\bjum'at\b|\bjum\b|\bjumhat\b/i],
  ['sat', /saturday|\bsat\b|\bsabtu\b|\bsaptu\b|\bsab\b/i],
  ['sun', /sunday|\bsun\b|\bminggu\b|\bahad\b|\bakad\b|\bming\b/i],
]

// Intent words that mean "let's do something together". The listener watches for
// these. Casual food/hangout words matter most because students rarely say the
// word "meeting". Broadly multilingual (EN + ID/MY) to catch how students actually
// invite each other.
const INTENT_WORDS =
  /\b(meet|meeting|meet-?up|hang|hangout|hang ?out|catch ?up|kopo|gotcha|gather|gathering|study|studying|discuss|discussion|sync|syncing|standup|call|zoom|gmeet|g-?meet|vc|voice ?call|futsal|sports?|badminton|gym|workout|work ?out|nge-?gym|run|jog|jogging|lari|rehearsal|rehearse|practice|training|latihan|match|scrim|sparring|tanding|dinner|lunch|breakfast|brunch|supper|makan malam|makan siang|sarapan|coffee|kopi|ngopi|ngopdul|tea|boba|boba ?time|cimol|date|ngedate|nge-?date|movie|film|cinema|bioskop|nonton|nobar|watch|watching|game|gaming|mabar|ranked|main|board ?game|karaoke|nge-?korek|picnic|trip|jalan|jalan-?jalan|hang ?out|hike|hiking|naik gunung|swim|swimming|renang|nge-?renang|yoga|zumba|basketball|basket|volley|voli|tennis|bowling|billiard|biliar|fotbar|foto ?bareng|makan|makan-?makan|mam|ngemil|bukber|buka ?bersama|sahur|nongkrong|nongki|ngumpul|kumpul|kumpulan|jemput|antar|shopping|belanja|mall|cafe|warkop|warteg|rapat|diskusi|diskusiin|belajar|les|ngerjain|tugas|project|proyek|presentation|presentasi|kerja ?kelompok|kek|party|pesta|ultah|birthday|hbd|wedding|nikahan|nikah|reunion|reuni|concert|konser|gig|event|acara|gathering|kopdar|meet up)\b/i

// Invitation cues: words that turn a time+place mention into a proposal aimed at
// others. A message WITHOUT one of these is more likely a statement/answer than
// an invite (see isInvitation below).
const INVITE_CUES =
  /\b(let'?s|lets|let us|wanna|want to|mau|ayo|ayok|yuk|gas|gaskeun|sikat|yok|shall we|how about|what about|gimana kalo|gmn kalo|kalo|join|joinin|ikutan|ikut|come|datang|pada bisa|bisa ga|bisa gak|free|available|luang|senggang|on\?|on gak|on ga|siapa yang|who'?s|ada yang|anyone|anybody|ada gak|ada ga|mau gak|mau ga|mau nggak|pengen|pengin|kepingin|interested|minat|down|dulu gais|gais|guys|rek|bro|sob)\b/i

// Questions that ask FOR information rather than PROPOSE a plan. If a message
// is a question led by one of these, it's not an invite (someone asking what
// time something is, not suggesting one).
const INFO_QUESTION =
  /\b(what time|what day|jam berapa|tanggal berapa|kapan|where|dimana|di mana|tempatnya|where'?s|when|which|how much|berapa|udah jadi belum|jadi ga|jadi gak|fix belum|jadi belum|confirm)\b/i

// Negation / past / statement signals that DISQUALIFY an invite even when the
// intent word and a time are present.
const PAST_TENSE =
  /\b(went|going|gone|did|was|were|had|attended|met|played|watched|ate|joined|dateng|udah|sudah|tadi|kemarin|barusan|waktu itu|yesterday|last night|just now|already|udh|udah|selesai|done|siap)\b/i
const QUESTION_ONLY = /\?\s*$/
// Copula/statement markers: "the meeting IS AT 3pm", "it's on thursday". These
// describe an existing event rather than propose one, so they need an explicit
// invite cue to count.
const STATEMENT_MARKER = /\b(is at|it'?s at|it is at|will be at|on thursday|on friday|on saturday|on sunday|on monday|on tuesday|on wednesday|ada di|jamnya|diadakan|bakal|akan di|rencananya|planning|already set|already planned)\b/i
const I_ONLY = /\b(i|saya|gw|gue|aku|gua)\b/i

// Accepts 3pm, 3 pm, 3:30pm, "3:00 p.m.", 15:00.
const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s?m\.?)?/i

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, mei: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, agustus: 7, august: 7,
  sep: 8, sept: 8, september: 8, okt: 9, oct: 9, october: 9, oktober: 9,
  nov: 10, november: 10, nop: 10, des: 11, dec: 11, december: 11, desember: 11,
}
const MONTH_RE = Object.keys(MONTHS).join('|')

export interface Detection {
  isActivity: boolean
  day: Day | null
  time: number | null
  title: string
}

export function detect(body: string): Detection {
  const isActivity = isInvitation(body)
  return {
    isActivity,
    day: parseDay(body),
    time: parseTime(body),
    title: extractTitle(body),
  }
}

// Is this message actually proposing a get-together, rather than just mentioning
// an activity or a time in passing? Combines three checks:
//   1. an intent word is present,
//   2. at least one invitation cue (or the message reads as a question to the
//      group — "futsal sat 3pm?" with no cue still counts),
//   3. none of the disqualifiers (past tense, "I already...", etc.) fire.
function isInvitation(body: string): boolean {
  if (!INTENT_WORDS.test(body)) return false
  if (PAST_TENSE.test(body)) return false

  // A question asking FOR info ("what time?") is not a proposal.
  if (INFO_QUESTION.test(body)) return false

  const hasCue = INVITE_CUES.test(body)
  const isQuestion = QUESTION_ONLY.test(body.trim())
  if (hasCue || isQuestion) return true

  // A statement describing an existing event ("the meeting is at 3pm") needs a
  // cue; don't surface it from the bare day+time alone.
  if (STATEMENT_MARKER.test(body)) return false

  // No cue and no question mark: likely a statement. But bare "futsal sat 3pm"
  // in a group is often still an invite. Require BOTH a day and a time for the
  // bare form — if it has neither, it's too ambiguous to surface.
  const hasDay = parseDay(body) != null
  const hasTime = parseTime(body) != null
  return hasDay && hasTime
}

// JS getDay(): 0=Sun..6=Sat
const JS_DAY: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function parseDay(body: string, now = new Date()): Day | null {
  // Explicit weekday wins.
  for (const [day, re] of DAY_PATTERNS) {
    if (re.test(body)) return day
  }
  // Relative days, resolved against today.
  if (/\btomorrow\b|\bbesok\b|\besok\b/i.test(body)) return JS_DAY[(now.getDay() + 1) % 7]!
  if (/\b(today|tonight|tonite|hari ini|malam ini)\b/i.test(body)) return JS_DAY[now.getDay()]!
  // "next monday" — still resolves to the weekday name (day-granularity only).
  // Calendar dates: "13 september", "sept 30".
  let dayNum: number | undefined
  let mon: number | undefined
  let m = body.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b`, 'i'))
  if (m) { dayNum = parseInt(m[1]!, 10); mon = MONTHS[m[2]!.toLowerCase()] }
  else {
    m = body.match(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'))
    if (m) { mon = MONTHS[m[1]!.toLowerCase()]; dayNum = parseInt(m[2]!, 10) }
  }
  if (dayNum != null && mon != null && dayNum >= 1 && dayNum <= 31) {
    let date = new Date(now.getFullYear(), mon, dayNum)
    if (date.getTime() < now.getTime() - 86_400_000) date = new Date(now.getFullYear() + 1, mon, dayNum)
    return JS_DAY[date.getDay()]!
  }
  return null
}

export function parseTime(body: string): number | null {
  // Strip date phrases first, so "13 September" isn't read as 1pm.
  const clean = body
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_RE})\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b(?:${MONTH_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi'), ' ')
  const m = clean.match(TIME_PATTERN)
  if (!m) return null
  let hour = parseInt(m[1]!, 10)
  const minute = m[2] ? parseInt(m[2], 10) : 0
  const ap = m[3]?.toLowerCase()
  if (ap === 'p' && hour < 12) hour += 12
  if (ap === 'a' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

function extractTitle(body: string): string {
  const t = body
    .replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun|senin|senen|selasa|rabu|rebo|kamis|kemis|jumat|jum'at|sabtu|minggu|ahad)\b/gi, '')
    .replace(/\b(tomorrow|besok|esok|today|tonight|tonite|hari ini|malam ini)\b/gi, '')
    .replace(/\b(on|at|this|next|lets|let's|wanna|want to|we should|yo|hey|ayo|yuk|gas|mau|gimana|kalo)\b/gi, '')
    .replace(/\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, '')
    .replace(/[?!.]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t || body.trim()
}
