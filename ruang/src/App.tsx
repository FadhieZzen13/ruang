import { useEffect, useState } from 'react'
import { Scheduler } from './ui/screens/Scheduler'
import { VoiceMemo } from './ui/screens/VoiceMemo'
import { Inbox } from './ui/screens/Inbox'
import { getPending } from './app/bot'

type Tab = 'week' | 'voice' | 'inbox'

export default function App() {
  const [tab, setTab] = useState<Tab>('week')
  const [pending, setPending] = useState(0)

  // Poll the bot so the Invites tab shows a live count wherever you are.
  useEffect(() => {
    const poll = async () => {
      const p = await getPending()
      setPending(p?.length ?? 0)
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="stage">
      <div className="phone">
        <div className="statusbar">
          <span>9:41</span>
          <span className="brand">Ruang</span>
        </div>

        <div className="screen">
          {tab === 'week' && <Scheduler />}
          {tab === 'voice' && <VoiceMemo />}
          {tab === 'inbox' && <Inbox />}
        </div>

        <div className="tabbar">
          <button className={tab === 'week' ? 'active' : ''} onClick={() => setTab('week')}>
            <span className="tab-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
            </span>
            Schedule
          </button>
          <button className={tab === 'voice' ? 'active' : ''} onClick={() => setTab('voice')}>
            <span className="tab-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
              </svg>
            </span>
            Voice
          </button>
          <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
            <span className="tab-icon" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.5-8.6" />
                <path d="M21 3l-9 9" />
              </svg>
            </span>
            Invites{pending > 0 && <span className="tab-badge">{pending}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
