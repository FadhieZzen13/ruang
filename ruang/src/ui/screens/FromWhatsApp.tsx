import { useEffect, useState } from 'react'
import { fmt } from '../../app/store'
import { getDrafts, tellRuang, type BotDraft } from '../../app/bot'
import { hoursLabel } from '../../domain/task'
import { shortDateLabel } from '../../domain/occurrence'

// Plans you started in WhatsApp, shown in the app.
//
// A conversation begun in chat shouldn't vanish when you pick up the app, and a
// question Ruang asked there shouldn't be answerable only there. This is the
// same drafts, the same ids — answer the question here or on your phone,
// whichever is in your hand.

export function FromWhatsApp({ onOpen }: { onOpen: (draft: BotDraft) => void }) {
  const [drafts, setDrafts] = useState<BotDraft[] | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    const poll = async () => {
      const d = await getDrafts()
      if (live) setDrafts(d)
    }
    void poll()
    const t = setInterval(poll, 4000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [])

  // Anything you'd type in chat works here too.
  const say = async (text: string) => {
    setBusy(true)
    const reply = await tellRuang(text)
    setBusy(false)
    setAnswer('')
    setNote(reply ? reply.split('\n')[0]! : 'Ruang didn’t understand that.')
    setDrafts(await getDrafts())
  }

  // Nothing waiting, or the bot is off: stay out of the way entirely.
  if (!drafts || drafts.length === 0) return null

  return (
    <div className="from-wa">
      <div className="task-field-label">From WhatsApp</div>

      {drafts.map((d) => (
        <div key={d.id} className="task-card">
          <div className="task-card-top">
            <span className="chip-title">{d.title}</span>
            <span className="ghost grey">{d.id}</span>
          </div>

          {d.awaiting === 'deadline' ? (
            <>
              <div className="task-card-meta">Ruang asked: when&rsquo;s it due?</div>
              <div className="add-row" style={{ marginTop: 8 }}>
                <input
                  className="add-input"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="monday / 20 sep / in 3 days"
                  aria-label={`Deadline for ${d.title}`}
                />
                <button
                  className="btn btn-primary btn-sml"
                  disabled={busy || !answer.trim()}
                  onClick={() => say(answer.trim())}
                >
                  Answer
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="task-card-meta">
                {d.deadline ? `Due ${shortDateLabel(d.deadline)} · ` : ''}
                {d.sessions.length} {d.sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
                {hoursLabel(d.sessions.reduce((n, s) => n + (s.end - s.start), 0))}
              </div>
              <div className="from-wa-sessions">
                {d.sessions.map((s, i) => (
                  <div key={i} className="from-wa-session">
                    {shortDateLabel(s.date)} · {fmt(s.start)}–{fmt(s.end)} — {s.note}
                  </div>
                ))}
              </div>
              <div className="task-links" style={{ justifyContent: 'flex-start' }}>
                <button className="btn-link" onClick={() => onOpen(d)}>
                  Open here
                </button>
                {d.groupName && (
                  <button className="btn-link" disabled={busy} onClick={() => say(`share ${d.id}`)}>
                    Send to {d.groupName}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      ))}

      {note && <div className="answer-source">{note}</div>}
    </div>
  )
}
