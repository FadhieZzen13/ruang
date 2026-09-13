import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { logger } from './logger.js'

// Shared plans, so a schedule can live at a short readable URL.
//
// The app builds the .ics and hands it here; the bot just stores the bytes and
// serves them as text/calendar at /plan/<slug>.ics. That's what makes the link
// short: the plan is HERE, so the URL only has to carry a name. The alternative
// (the whole plan encoded in the link) needs no server but runs to 300+ chars.
//
// Read is deliberately public — a share link that needed a token wouldn't be a
// share link. The slug carries a short random suffix so plans aren't guessable
// by name alone.

const here = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || join(here, '..')
const STORE = join(DATA_DIR, 'plans.local.json')

export const MAX_ICS_BYTES = 64 * 1024
export const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/

export interface StoredPlan {
  title: string
  ics: string
  savedAt: string
}

function load(): Record<string, StoredPlan> {
  try {
    return JSON.parse(readFileSync(STORE, 'utf8')) as Record<string, StoredPlan>
  } catch {
    return {} // nothing shared yet
  }
}

let plans: Record<string, StoredPlan> = load()

export function putPlan(slug: string, title: string, ics: string): void {
  plans[slug] = { title, ics, savedAt: new Date().toISOString() }
  try {
    writeFileSync(STORE, JSON.stringify(plans, null, 2))
  } catch {
    // read-only fs — the link still works until the bot restarts
  }
  logger.info({ slug, title }, 'plan published')
}

export function getPlan(slug: string): StoredPlan | undefined {
  return plans[slug]
}

export function countPlans(): number {
  return Object.keys(plans).length
}
