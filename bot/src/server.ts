import { createServer } from 'node:http'
import { setSchedule, getSchedule } from './schedule.js'
import { listPending, postMessage, postVerdict, type Decision, type Sender } from './decisions.js'
import { WATCHED_GROUPS } from './config.js'
import { MAX_ICS_BYTES, SLUG, countPlans, getPlan, putPlan } from './plans.js'
import { listDrafts, routeOwnerLine, sharePlan } from './plan-chat.js'
import { logger } from './logger.js'
import type { ScheduleItem } from './types.js'

const PORT = Number(process.env.BOT_PORT || 8788)
const AUTH_TOKEN = process.env.BOT_AUTH_TOKEN || ''

// Tiny local API so the Ruang app can: push your real schedule, read the
// invites waiting on you, and approve them in-app. Approving here goes through
// the exact same gated postVerdict as the terminal — RULE 2 is unchanged.
// If BOT_AUTH_TOKEN is set, every non-health call must send it as
// `Authorization: Bearer <token>` (or `x-bot-token`), so the API can be
// published behind Cloudflare without exposing your approvals. Empty = open.
const PUBLIC_ORIGIN =
  process.env.PUBLIC_ORIGIN || `http://localhost:${process.env.BOT_PORT || 8788}`

export function startServer(send: Sender, groupName: (jid: string) => string): void {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bot-token')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') return end(res, 204, {})

    const url = req.url || '/'
    try {
      if (req.method === 'GET' && url === '/health') {
        return end(res, 200, { ok: true, watching: WATCHED_GROUPS.length, schedule: getSchedule().length, plans: countPlans(), auth: Boolean(AUTH_TOKEN) })
      }

      // Public on purpose, like /health: this is the share link itself, opened
      // by people who have no token and may not use Ruang at all. Serving it as
      // text/calendar is what lets a phone hand it straight to the calendar app
      // with every session in it.
      if (req.method === 'GET' && url.startsWith('/plan/')) {
        const slug = url.slice('/plan/'.length).replace(/\.ics$/, '')
        const plan = SLUG.test(slug) ? getPlan(slug) : undefined
        if (!plan) return end(res, 404, { ok: false, error: 'no such plan' })
        res.writeHead(200, {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="${slug}.ics"`,
          'Cache-Control': 'no-cache',
        })
        return res.end(plan.ics)
      }

      if (AUTH_TOKEN && !authorized(req)) {
        return end(res, 401, { ok: false, error: 'unauthorized' })
      }

      // Publishing needs the same trust as everything else behind the gate.
      if (req.method === 'POST' && url === '/plan') {
        const body = await readJson(req)
        const slug = String(body.slug ?? '')
        const title = String(body.title ?? '').slice(0, 200)
        const ics = String(body.ics ?? '')
        if (!SLUG.test(slug)) return end(res, 400, { ok: false, error: 'bad slug' })
        if (!ics.startsWith('BEGIN:VCALENDAR')) {
          return end(res, 400, { ok: false, error: 'not a calendar file' })
        }
        if (Buffer.byteLength(ics, 'utf8') > MAX_ICS_BYTES) {
          return end(res, 413, { ok: false, error: 'calendar file too large' })
        }
        putPlan(slug, title, ics)
        return end(res, 200, { ok: true, path: `/plan/${slug}.ics` })
      }

      // What Ruang is currently working out with you in chat. The app shows
      // these so a conversation started on WhatsApp doesn't vanish when you
      // pick up the phone — same drafts, same ids, either surface.
      if (req.method === 'GET' && url === '/drafts') {
        const drafts = listDrafts().map((d) => ({
          id: d.id,
          title: d.title,
          deadline: d.deadline,
          minutes: d.minutes,
          pace: d.pace,
          awaiting: d.awaiting,
          groupName: d.groupJid ? groupName(d.groupJid) || d.groupJid : null,
          askedBy: d.askedBy,
          sessions: d.sessions,
        }))
        return end(res, 200, { drafts })
      }

      // The app as a third owner channel, beside the DM and the terminal. Same
      // router, same rules: "monday", "p1 6h", "share p1" all mean what they
      // mean in chat, and only "share" reaches a group.
      if (req.method === 'POST' && url === '/owner') {
        const body = await readJson(req)
        const text = String(body.text ?? '').trim()
        if (!text) return end(res, 400, { ok: false, error: 'text is required' })
        const routed = routeOwnerLine(text, null)
        if (!routed) return end(res, 200, { ok: false, reply: null })
        const reply =
          routed.kind === 'share'
            ? await sharePlan(send, postMessage, routed.draft, PUBLIC_ORIGIN)
            : routed.reply.text
        return end(res, 200, { ok: true, reply })
      }

      if (req.method === 'GET' && url === '/pending') {
        return end(res, 200, { pending: listPending() })
      }
      if (req.method === 'POST' && url === '/schedule') {
        const body = await readJson(req)
        const items = (body.activities ?? []) as ScheduleItem[]
        setSchedule(items)
        logger.info({ count: items.length }, 'schedule updated from app')
        return end(res, 200, { ok: true, count: items.length })
      }
      if (req.method === 'GET' && url === '/groups') {
        // Only the groups you chose to watch, never the full list of every
        // group you're in — that belongs at your terminal (`npm run groups`),
        // not in a browser.
        const groups = WATCHED_GROUPS.map((jid) => ({ jid, name: groupName(jid) || jid }))
        return end(res, 200, { groups })
      }
      if (req.method === 'POST' && url === '/say') {
        // Same trust level as /decide: gated by BOT_AUTH_TOKEN when one is set,
        // open when it isn't. A token wouldn't make this route safer than
        // /decide anyway — the app ships VITE_BOT_TOKEN to the browser, so
        // anyone who can load the app already has it. What actually limits
        // this route is isWatched() below, and not exposing the port.
        const body = await readJson(req)
        const jid = String(body.jid ?? '')
        const text = String(body.text ?? '').trim()
        if (!jid || !text) return end(res, 400, { ok: false, error: 'jid and text are required' })
        const ok = await postMessage(send, jid, text)
        return end(res, ok ? 200 : 403, {
          ok,
          ...(ok ? {} : { error: 'that group is not in WATCHED_GROUPS' }),
        })
      }
      if (req.method === 'POST' && url === '/decide') {
        const body = await readJson(req)
        const id = String(body.id ?? '')
        const decision = body.decision as Decision
        if (!['accept', 'decline', 'counter', 'custom'].includes(decision)) {
          return end(res, 400, { ok: false, error: 'bad decision' })
        }
        const customText = decision === 'custom' ? String(body.message ?? '').trim() : undefined
        if (decision === 'custom' && !customText) {
          return end(res, 400, { ok: false, error: 'custom needs a message' })
        }
        const ok = await postVerdict(send, id, decision, customText)
        return end(res, ok ? 200 : 404, { ok })
      }
      return end(res, 404, { error: 'not found' })
    } catch (e) {
      // A send that couldn't get through (link down after retries) is a
      // 503 — retryable — not a 500. The verdict has NOT been posted.
      logger.error({ e }, 'server error')
      return end(res, 503, { ok: false, error: 'link down, try again' })
    }
  })

  // Bind 0.0.0.0 INSIDE the container so Docker's port mapping can reach it;
  // the compose file still maps it to 127.0.0.1 on the host.
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`API on http://0.0.0.0:${PORT} (schedule sync + in-app approvals)`)
  })
}

function authorized(req: import('node:http').IncomingMessage): boolean {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const header = req.headers['x-bot-token']
  const token = bearer || header
  return typeof token === 'string' && token === AUTH_TOKEN
}

function end(res: import('node:http').ServerResponse, code: number, body: unknown): void {
  res.writeHead(code)
  res.end(JSON.stringify(body))
}

function readJson(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}
