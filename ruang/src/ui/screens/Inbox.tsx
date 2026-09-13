import { useEffect, useState } from 'react'
import { getPending, decide, type PendingInvite, type Decision } from '../../app/bot'
import { addActivity, focusScheduleDate, fmt, getActivities } from '../../app/store'
import { isoDate, shiftToWeekday } from '../../domain/occurrence'
import { DAY_LABEL } from '../../domain/types'

// Invites the WhatsApp bot detected, waiting on you. Approving here posts the
// verdict back to the group — the same gated path as the bot's terminal/DM.
// Polls the local bot API; if the bot isn't running, says so and stays calm.

export function Inbox() {
  const [invites, setInvites] = useState<PendingInvite[] | null>(null)
  const [busyId, setBusyId] = useState<string>('')
  const [customFor, setCustomFor] = useState<string>('')
  const [customText, setCustomText] = useState('')

  const refresh = async () => setInvites(await getPending())

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [])

  const act = async (id: string, decision: Decision, message?: string) => {
    setBusyId(id)
    const invite = invites?.find((item) => item.id === id)
    await decide(id, decision, message)
    if (invite && (decision === 'accept' || decision === 'counter' || decision === 'custom')) {
      const slot = decision === 'counter' && invite.counter ? invite.counter : invite
      const activityId = `invite-${invite.id}`
      if (!getActivities().some((activity) => activity.id === activityId)) {
        const date = shiftToWeekday(isoDate(new Date()), slot.day)
        addActivity({
          id: activityId,
          title: invite.ask,
          day: slot.day,
          start: slot.time,
          end: slot.time + 60,
          kind: 'meeting',
          locked: false,
          description: invite.groupName,
          recurrence: 'once',
          date,
        })
        focusScheduleDate(date)
      }
    }
    await refresh()
    setBusyId('')
    if (customFor === id) {
      setCustomFor('')
      setCustomText('')
    }
  }

  const sendCustom = (id: string) => {
    if (customText.trim()) act(id, 'custom', customText.trim())
  }

  return (
    <div>
      <div className="appbar">
        <div>
          <div className="eyebrow">WhatsApp</div>
          <h1>Invites</h1>
        </div>
      </div>

      {invites === null && (
        <div className="empty-day">
          <div>Bot offline.</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Start it: <code>cd bot && npm start</code></div>
        </div>
      )}

      {invites !== null && invites.length === 0 && (
        <div className="empty-day">Nothing waiting. Ruang is watching quietly.</div>
      )}

      <div className="inbox-list">
        {invites?.map((n) => (
          <div key={n.id} className="card invite">
            <div className="eyebrow">{n.groupName} · {n.author}</div>
            <div className="invite-ask">{n.ask}</div>
            <div className="chip-time" style={{ marginTop: 4 }}>
              {DAY_LABEL[n.day]} · {fmt(n.time)}
            </div>
            {n.busy ? (
              <div className="conflict">
                You're busy that {n.day === n.counter?.day ? 'day' : 'evening'}
                {n.counter ? ` — how about ${DAY_LABEL[n.counter.day]} ${fmt(n.counter.time)}?` : '.'}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--sage)', fontWeight: 600, margin: '6px 0 2px' }}>
                You're clear.
              </div>
            )}
            {customFor === n.id ? (
              <div className="custom-reply">
                <input
                  className="add-input"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Your own words…"
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setCustomFor(''); setCustomText('') }}>
                    Back
                  </button>
                  <button className="btn btn-primary" style={{ flex: 2 }} disabled={!customText.trim()} onClick={() => sendCustom(n.id)}>
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="invite-actions">
                  <button className="btn btn-ghost" disabled={busyId === n.id} onClick={() => act(n.id, 'decline')}>
                    {n.busy ? 'Decline' : 'No'}
                  </button>
                  {n.busy && n.counter ? (
                    <button className="btn btn-primary" disabled={busyId === n.id} onClick={() => act(n.id, 'counter')}>
                      Counter
                    </button>
                  ) : (
                    <button className="btn btn-primary" disabled={busyId === n.id} onClick={() => act(n.id, 'accept')}>
                      Yes
                    </button>
                  )}
                </div>
                <button
                  className="btn btn-link"
                  style={{ marginTop: 6, width: '100%' }}
                  disabled={busyId === n.id}
                  onClick={() => { setCustomFor(n.id); setCustomText('') }}
                >
                  Reply with your own message…
                </button>
              </>
            )}
            <div className="trustline" style={{ marginTop: 8 }}>Nothing posts until you tap.</div>
          </div>
        ))}
      </div>
    </div>
  )
}
