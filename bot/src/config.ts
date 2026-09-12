// All config in one place. Secrets/JIDs come from .env (see .env.example).

export const BOT_NAME = 'Ruang'

// Where Baileys stores the linked-device session. Deleting it = logged out.
export const AUTH_DIR = 'auth'

// Your number (E.164, no +). Only used for pairing-code login. Added later.
export const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '')

// RULE 1: the only groups Ruang may watch. Empty = watch nothing.
export const WATCHED_GROUPS = (process.env.WATCHED_GROUPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

// Testing only: let the bot react to messages you send from your own account.
// Off by default (a real invite comes from someone else).
export const LISTEN_TO_SELF = process.env.LISTEN_TO_SELF === 'true'

export function isWatched(groupJid: string): boolean {
  return WATCHED_GROUPS.includes(groupJid)
}
