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
}

export interface Handlers {
  onMessage: (m: IncomingMessage) => void
  // Text you send in your own "Message Yourself" chat — the DM control channel.
  onOwnerCommand: (text: string) => void
}

export interface Wa {
  sendToGroup: (jid: string, text: string) => Promise<void>
  sendToOwner: (text: string) => Promise<void> // posts to your self-chat
  listGroups: () => Promise<{ jid: string; name: string }[]>
}

const groupNames = new Map<string, string>()

function textOf(msg: WAMessage): string {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  )
}

export async function connect(handlers: Handlers): Promise<Wa> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock: WASocket = makeWASocket({
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

  sock.ev.on('creds.update', saveCreds)

  // Your own JID — the "Message Yourself" chat we use to notify you and read
  // your yes/no/counter replies. Filled once connected.
  let selfJid = ''

  // Login by pairing code (OWNER_NUMBER set), else QR.
  if (OWNER_NUMBER && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(OWNER_NUMBER)
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
  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u

    if (qr && !OWNER_NUMBER && !qrShown) {
      qrShown = true
      logger.info('Scan this QR in WhatsApp → Linked devices:')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      selfJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : ''
      logger.info(`${BOT_NAME} is linked and listening.`)
      listGroups().catch(() => {}) // warm the group-name cache
    }
    if (connection === 'close') {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        logger.error('Logged out. Delete the auth/ folder and re-link.')
        return
      }
      logger.warn({ code }, 'connection closed, reconnecting…')
      connect(handlers).catch((e) => logger.error({ e }, 'reconnect failed'))
    }
  })

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages) {
      const jid = msg.key.remoteJid
      if (!jid) continue
      const body = textOf(msg)
      if (!body) continue

      // Your DM control channel: text you type in your own "Message Yourself" chat.
      if (selfJid && jid === selfJid && msg.key.fromMe) {
        handlers.onOwnerCommand(body)
        continue
      }

      if (!isJidGroup(jid)) continue // RULE 1: groups only, never other DMs/status
      if (msg.key.fromMe && !LISTEN_TO_SELF) continue // ignore own group messages (unless testing)
      if (!isWatched(jid)) continue // RULE 1: only the groups you chose

      handlers.onMessage({
        groupJid: jid,
        groupName: groupNames.get(jid) || jid,
        author: msg.pushName || msg.key.participant || 'someone',
        body,
      })
    }
  })

  const listGroups = async () => {
    const all = await sock.groupFetchAllParticipating()
    const rows = Object.values(all).map((g) => ({ jid: g.id, name: g.subject }))
    for (const r of rows) groupNames.set(r.jid, r.name)
    return rows
  }

  return {
    sendToGroup: async (jid, text) => {
      await sock.sendMessage(jid, { text })
    },
    sendToOwner: async (text) => {
      if (selfJid) await sock.sendMessage(selfJid, { text })
    },
    listGroups,
  }
}
