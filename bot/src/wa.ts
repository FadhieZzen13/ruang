import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
  isJidGroup,
  DisconnectReason,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import { AUTH_DIR, BOT_NAME, OWNER_NUMBER, LISTEN_TO_SELF, isWatched } from './config.js'
import { logger, waLogger } from './logger.js'

export interface IncomingMessage {
  groupJid: string
  groupName: string
  author: string // display name or number of the sender
  body: string
  // True only under LISTEN_TO_SELF, where your own message is replayed through
  // the invite detector for solo testing. It has already gone to the owner
  // channel, so planning must not warn about it a second time.
  fromMe: boolean
}

export interface Handlers {
  onMessage: (m: IncomingMessage) => void
  // Text YOU sent: in your own "Message Yourself" chat (the DM control
  // channel), or in a watched group from your own number. `groupJid` is set
  // only for the latter, so a plan asked for in a group knows where it'd go.
  onOwnerCommand: (text: string, groupJid?: string) => void
}

export interface Wa {
  sendToGroup: (jid: string, text: string) => Promise<void>
  sendToOwner: (text: string) => Promise<void> // posts to your self-chat
  listGroups: () => Promise<{ jid: string; name: string }[]>
  // Name of a group we've already seen, from the cache warmed on connect.
  // Never fetches — the API uses this and must not trigger WhatsApp calls.
  getGroupName: (jid: string) => string
}

const groupNames = new Map<string, string>()

// Ids of messages THIS socket sent. Everything the bot says lands back in
// messages.upsert as fromMe — its own DM in your self-chat, its own post in a
// watched group — and without this it reads its own words as your instructions.
// A plan reply starts with "Plan for ...", which is itself a plan request: that
// is an infinite loop that sends you hundreds of messages.
const sentByUs = new Set<string>()
function rememberSent(id?: string | null): void {
  if (!id) return
  sentByUs.add(id)
  // Bounded: this is an echo guard, not a history.
  if (sentByUs.size > 500) sentByUs.delete(sentByUs.values().next().value as string)
}

// A message you type on your PHONE arrives at a linked device wrapped: WhatsApp
// syncs it as deviceSentMessage (and ephemeral/view-once chats add their own
// layer). Read the wrapper and the text is empty, so the message gets dropped
// before anything can route it — which looks exactly like the bot ignoring you.
type Content = NonNullable<WAMessage['message']>
function unwrap(m: Content): Content {
  return (
    m.deviceSentMessage?.message ??
    m.ephemeralMessage?.message ??
    m.viewOnceMessage?.message ??
    m.viewOnceMessageV2?.message ??
    m.documentWithCaptionMessage?.message ??
    m
  )
}

function textOf(msg: WAMessage): string {
  if (!msg.message) return ''
  const m = unwrap(msg.message)
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// A single long-lived connection with self-healing. Replaces the old pattern of
// spawning a fresh socket on every close (which stacked duplicate handlers and
// made the flapping worse). One socket, recreated only when it dies, with sends
// that wait-and-retry while the link re-establishes.
export async function connect(handlers: Handlers): Promise<Wa> {
  let sock: WASocket | null = null
  let selfJid = ''
  let isOpen = false
  let stopped = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  async function open(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()

    const s = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, waLogger),
      },
      logger: waLogger,
      browser: [BOT_NAME, 'Chrome', '1.0.0'], // shows as "Ruang" in Linked Devices
      markOnlineOnConnect: false,
      syncFullHistory: false,
    })
    sock = s

    s.ev.on('creds.update', saveCreds)

    // Login by pairing code (OWNER_NUMBER set), else QR.
    if (OWNER_NUMBER && !s.authState.creds.registered) {
      setTimeout(async () => {
        try {
          const code = await s.requestPairingCode(OWNER_NUMBER)
          const pretty = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
          logger.info(
            `\n\n  ┌─────────────────────────────────────────────┐\n  │  Pairing code: ${pretty}                     \n  │  WhatsApp → Linked devices →                 \n  │  “Link with phone number instead” → type it  │\n  │  Enter it NOW — it expires in about a minute. │\n  └─────────────────────────────────────────────┘\n`,
          )
        } catch (e) {
          logger.error({ e }, 'pairing code request failed — check OWNER_NUMBER, or clear auth/ and retry')
        }
      }, 3000)
    }

    let qrShown = false
    s.ev.on('connection.update', (u) => {
      const { connection, lastDisconnect, qr } = u

      if (qr && !OWNER_NUMBER && !qrShown) {
        qrShown = true
        logger.info('Scan this QR in WhatsApp → Linked devices:')
        qrcode.generate(qr, { small: true })
      }

      if (connection === 'open') {
        selfJid = s.user?.id ? jidNormalizedUser(s.user.id) : ''
        isOpen = true
        logger.info(`${BOT_NAME} is linked and listening.`)
        warmGroups(s).catch(() => {}) // warm the group-name cache
      } else if (connection === 'close') {
        isOpen = false
        const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
        if (code === DisconnectReason.loggedOut) {
          logger.error('Logged out. Delete the auth/ folder and re-link.')
          return
        }
        logger.warn({ code }, 'connection closed — scheduling reconnect…')
        scheduleReconnect()
      }
    })

    s.ev.on('messages.upsert', ({ messages }) => {
      for (const msg of messages) {
        const jid = msg.key.remoteJid
        if (!jid) continue
        // Our own words, echoed back. Never treat them as input.
        if (msg.key.id && sentByUs.has(msg.key.id)) continue
        const body = textOf(msg)
        if (!body) {
          // Yours, but we couldn't read it — worth knowing about rather than
          // silently ignoring, since that's indistinguishable from a dead bot.
          if (msg.key.fromMe && msg.message) {
            logger.warn({ kinds: Object.keys(unwrap(msg.message)) }, 'your message had no text we could read')
          }
          continue
        }

        // Your DM control channel: text you type in your own "Message Yourself" chat.
        if (selfJid && jid === selfJid && msg.key.fromMe) {
          logger.info({ from: 'self-chat' }, `you said: "${body}"`)
          handlers.onOwnerCommand(body)
          continue
        }

        if (!isJidGroup(jid)) continue // RULE 1: groups only, never other DMs/status
        if (!isWatched(jid)) {
          // The commonest "why did nothing happen": right words, wrong chat.
          if (msg.key.fromMe) logger.warn({ jid }, 'ignored — that group is not in WATCHED_GROUPS')
          continue
        }

        // Your own message in a watched group. It's never an invite to you, but
        // it may be you asking Ruang to plan something — so it goes to the owner
        // channel, not the invite detector. LISTEN_TO_SELF only adds the invite
        // path for solo testing; it must never take the owner path away, or
        // asking for a plan in a group silently does nothing.
        if (msg.key.fromMe) {
          logger.info({ from: groupNames.get(jid) || jid }, `you said: "${body}"`)
          handlers.onOwnerCommand(body, jid)
          if (!LISTEN_TO_SELF) continue
        }

        handlers.onMessage({
          fromMe: Boolean(msg.key.fromMe),
          groupJid: jid,
          groupName: groupNames.get(jid) || jid,
          author: msg.pushName || msg.key.participant || 'someone',
          body,
        })
      }
    })
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectTimer) return
    const delay = 1500 + Math.random() * 1500 // jitter to avoid thundering herd
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null
      try {
        await open()
      } catch (e) {
        logger.error({ e }, 'reconnect failed, retrying…')
        scheduleReconnect()
      }
    }, delay)
  }

  // Send, waiting for the link to come back if it's currently down. Returns only
  // after the message is actually sent (or throws after exhausting retries).
  async function sendWithRetry(send: () => Promise<void>, what: string): Promise<void> {
    const maxAttempts = 10
    for (let i = 0; i < maxAttempts; i++) {
      if (isOpen && sock) {
        try {
          await send()
          return
        } catch (e) {
          // Socket claimed open but the send bounced (dropped mid-flight). Mark
          // closed and let the reconnect logic re-establish, then retry.
          logger.warn({ e, what }, 'send failed, waiting for reconnect…')
          isOpen = false
          scheduleReconnect()
        }
      }
      // Not open yet (or dropped): wait, then try again.
      await sleep(1000 * Math.min(2 ** i, 8)) // 1s, 2s, 4s, 8s… capped at 8s
    }
    throw new Error(`could not send ${what} after ${maxAttempts} attempts (link down)`)
  }

  await open()

  return {
    sendToGroup: (jid, text) =>
      sendWithRetry(async () => {
        if (!sock) return
        const sent = await sock.sendMessage(jid, { text })
        rememberSent(sent?.key?.id)
      }, 'to group'),
    sendToOwner: (text) =>
      sendWithRetry(async () => {
        if (!sock || !selfJid) return
        const sent = await sock.sendMessage(selfJid, { text })
        rememberSent(sent?.key?.id)
      }, 'to owner'),
    getGroupName: (jid) => groupNames.get(jid) ?? '',
    listGroups: async () => {
      if (!sock) return []
      const all = await sock.groupFetchAllParticipating()
      const rows = Object.values(all).map((g) => ({ jid: g.id, name: g.subject }))
      for (const r of rows) groupNames.set(r.jid, r.name)
      return rows
    },
  }
}

async function warmGroups(sock: WASocket): Promise<void> {
  const all = await sock.groupFetchAllParticipating()
  const rows = Object.values(all)
  for (const r of rows) groupNames.set(r.id, r.subject)
}
