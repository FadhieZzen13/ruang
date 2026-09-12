import pino from 'pino'
import { LOG_LEVEL } from './config.js'

export const logger = pino({
  level: LOG_LEVEL,
  transport: {
    target: 'pino/file', // plain, readable stdout
    options: { destination: 1 },
  },
})

// Baileys wants its own child logger; keep it quieter than ours.
export const waLogger = logger.child({ mod: 'baileys' }, { level: 'warn' })
