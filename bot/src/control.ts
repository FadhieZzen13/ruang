import { createInterface } from 'node:readline'
import { DAY_LABEL, fmt } from './types.js'
import { conflictReason } from './schedule.js'
import { listPending, getPending, postMessage, postVerdict, type Sender } from './decisions.js'
import { routeOwnerLine, sharePlan } from './plan-chat.js'

// The approval surface. For now it's this terminal — the explicit "tap" that
// RULE 2 requires before anything is ever posted. Later this gets replaced by
// the Ruang app (or an owner DM), but the gate stays exactly the same:
// postVerdict only ever runs from here, on your command.

const HELP = `
Commands:
  list                 show invites waiting on you
  yes  <id>            accept — posts "I'm in"
  no   <id>            decline (with a soft counter)
  counter <id>         propose the counter-offer time
  say  <id> <message>  post your own words instead (verbatim)

  plan <what> [due ...]  build a schedule — asks only for a missing deadline
  <id> 6h | <id> quick   resize or repace a draft (e.g. "p1 quick")
  share <id>             post that schedule + its calendar link to the group

  help                 this
Nothing is ever posted to a group until you type one of yes/no/counter/say/share.
`

export function renderPending(id: string): void {
  const p = getPending(id)
  if (!p) return
  const when = `${DAY_LABEL[p.day]} ${fmt(p.time)}`
  const status = p.busy ? `busy — ${conflictReason(p.day, p.time)}` : "you're clear"
  const counter = p.counter ? ` · counter: ${DAY_LABEL[p.counter.day]} ${fmt(p.counter.time)}` : ''
  console.log(
    `\n🔔 [${id}] ${p.groupName} — ${p.author}\n   "${p.ask}"\n   → ${when} (${status})${counter}\n   reply:  yes ${id}  |  no ${id}  |  counter ${id}\n`,
  )
}

const PUBLIC_ORIGIN =
  process.env.PUBLIC_ORIGIN || `http://localhost:${process.env.BOT_PORT || 8788}`

export function startControl(send: Sender): void {
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: 'ruang> ' })
  console.log(HELP)
  rl.prompt()

  rl.on('line', async (line) => {
    const [cmd, id] = line.trim().split(/\s+/)
    try {
      if (cmd === 'list') {
        const items = listPending()
        if (!items.length) console.log('nothing waiting.')
        else items.forEach((p) => renderPending(p.id))
      } else if (cmd === 'help' || cmd === '?') {
        console.log(HELP)
      } else if (cmd === 'yes' || cmd === 'no' || cmd === 'counter') {
        if (!id) console.log('which one? e.g. `yes a1`')
        else {
          const decision = cmd === 'yes' ? 'accept' : cmd === 'no' ? 'decline' : 'counter'
          const ok = await postVerdict(send, id, decision)
          console.log(ok ? `✓ posted (${cmd}) for ${id}` : `no pending invite ${id}`)
        }
      } else if (cmd === 'say') {
        if (!id) console.log('which one? e.g. `say a1 count me in, but late`')
        else {
          const message = line.trim().slice(cmd.length).trim().slice(id.length).trim()
          const ok = message
            ? await postVerdict(send, id, 'custom', message)
            : false
          console.log(ok ? `✓ posted your message for ${id}` : !message ? 'say needs a message after the id' : `no pending invite ${id}`)
        }
      } else if (cmd) {
        // The same planner the WhatsApp DM uses, so you can build and share a
        // schedule from here without touching your phone.
        const routed = routeOwnerLine(line.trim(), null)
        if (!routed) {
          console.log(`unknown: ${cmd}. type \`help\`.`)
        } else if (routed.kind === 'share') {
          console.log(await sharePlan(send, postMessage, routed.draft, PUBLIC_ORIGIN))
        } else {
          console.log(routed.reply.text)
        }
      }
    } catch (e) {
      console.error('error:', e)
    }
    rl.prompt()
  })
}
