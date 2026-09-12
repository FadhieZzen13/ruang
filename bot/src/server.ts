import { createServer } from 'node:http'
import { setSchedule, getSchedule } from './schedule.js'
import { listPending, postVerdict, type Decision, type Sender } from './decisions.js'
import { WATCHED_GROUPS } from './config.js'
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
export function startServer(send: Sender): void {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-bot-token')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') return end(res, 204, {})

    const url = req.url || '/'
    try {
      if (req.method === 'GET' && url === '/health') {
        return end(res, 200, { ok: true, watching: WATCHED_GROUPS.length, schedule: getSchedule().length, auth: Boolean(AUTH_TOKEN) })
      }

      if (AUTH_TOKEN && !authorized(req)) {
        return end(res, 401, { ok: false, error: 'unauthorized' })
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
      logger.error({ e }, 'server error')
      return end(res, 500, { error: 'server error' })
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
