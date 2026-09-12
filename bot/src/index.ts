import './env.js'
import { detect } from './detect.js'
import { isBusy, nextEvening, conflictReason, hasSchedule } from './schedule.js'
import { addPending, listPending, postVerdict, type Pending, type Decision } from './decisions.js'
import { connect, type IncomingMessage, type Wa } from './wa.js'
import { startControl, renderPending } from './control.js'
import { startServer } from './server.js'
import { WATCHED_GROUPS, BOT_NAME } from './config.js'
import { DAY_LABEL, fmt } from './types.js'
import { logger } from './logger.js'

let wa: Wa // assigned once connected; handlers below only fire after that
let seq = 0
const nextId = () => `a${++seq}`

// A watched-group message arrived. Detect an invite, size it against your week,
// and SURFACE it three ways (terminal + WhatsApp DM + the app's inbox) — but
// never reply. Posting only happens later, on your explicit approval.
function onMessage(m: IncomingMessage): void {
  const d = detect(m.body)
  if (!d.isActivity || !d.day || d.time == null) return

  const busy = isBusy(d.day, d.time)
  const p: Pending = {
    id: nextId(),
    groupJid: m.groupJid,
    groupName: m.groupName,
    author: m.author,
    ask: m.body,
    day: d.day,
    time: d.time,
    busy,
    counter: busy ? nextEvening(d.day) : null, // RULE 5
  }
  addPending(p) // parked, not sent
  renderPending(p.id) // terminal
  wa?.sendToOwner(dmFor(p)).catch(() => {}) // WhatsApp DM (RULE 4: always fires)
}

function dmFor(p: Pending): string {
  const when = `${DAY_LABEL[p.day]} ${fmt(p.time)}`
  const status = p.busy ? `you're busy — ${conflictReason(p.day, p.time)}` : "you're clear"
  const counter = p.counter ? `\nCounter: ${DAY_LABEL[p.counter.day]} ${fmt(p.counter.time)}` : ''
  return `🔔 *${p.groupName}* — ${p.author}\n"${p.ask}"\n\n→ ${when}  (${status})${counter}\n\nReply *yes*, *no*, or *counter*  (id ${p.id}). Nothing posts until you do.`
}

// You replied in your "Message Yourself" chat. Parse a decision and post it.
async function onOwnerCommand(text: string): Promise<void> {
  const [verb, arg] = text.trim().toLowerCase().split(/\s+/)
  const map: Record<string, Decision> = {
    yes: 'accept', y: 'accept',
    no: 'decline', n: 'decline',
    counter: 'counter', c: 'counter',
  }
  const decision = verb ? map[verb] : undefined
  if (!decision) return // not a command (ignores the bot's own DM posts)

  let id = arg
  if (!id) {
    const open = listPending()
    if (open.length === 1) id = open[0]!.id
    else {
      await wa.sendToOwner(open.length ? 'Which one? add the id, e.g. `yes a1`' : 'Nothing waiting.')
      return
    }
  }
  const ok = await postVerdict(wa.sendToGroup, id, decision)
  await wa.sendToOwner(ok ? `✓ posted (${verb}) for ${id}` : `No pending invite ${id}.`)
}

async function main(): Promise<void> {
  wa = await connect({ onMessage, onOwnerCommand })

  if (process.argv.includes('--list-groups')) {
    setTimeout(async () => {
      const groups = await wa.listGroups()
      console.log('\nGroups you are in — paste the JIDs you want into WATCHED_GROUPS:\n')
      for (const g of groups) console.log(`  ${g.jid}  —  ${g.name}`)
      process.exit(0)
    }, 4000)
    return
  }

  startServer(wa.sendToGroup) // app: schedule sync + in-app approvals

  if (WATCHED_GROUPS.length === 0) {
    logger.warn('WATCHED_GROUPS is empty — Ruang is watching NO groups (rule 1). Add JIDs via `npm run groups`, then .env.')
  }
  if (!hasSchedule()) {
    logger.warn('No schedule loaded yet — invites read as "clear" until the app pushes your week.')
  }

  logger.info(`${BOT_NAME} ready. Waiting for invites in ${WATCHED_GROUPS.length} watched group(s).`)
  startControl(wa.sendToGroup)
}

main().catch((e) => {
  logger.error({ e }, 'fatal')
  process.exit(1)
})
