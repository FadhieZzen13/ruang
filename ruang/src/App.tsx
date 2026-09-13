import { useEffect, useState } from 'react'
import { Scheduler } from './ui/screens/Scheduler'
import { Today } from './ui/screens/Today'
import { VoiceMemo } from './ui/screens/VoiceMemo'
import { Inbox } from './ui/screens/Inbox'
import { Task } from './ui/screens/Task'
import { Profile } from './ui/screens/Profile'
import { SharedPlan } from './ui/screens/SharedPlan'
import { readPlanFromHash } from './domain/share-link'
import { getPending } from './app/bot'

type Tab = 'week' | 'task' | 'ask' | 'inbox' | 'profile'

export default function App() {
  const [tab, setTab] = useState<Tab>('week')
  const [pending, setPending] = useState(0)
  // A shared plan link (#/p/...) takes over the screen — someone opening one
  // wants the schedule, not the app they may not use.
  const [shared, setShared] = useState(() => readPlanFromHash(window.location.hash))

  useEffect(() => {
    const onHash = () => setShared(readPlanFromHash(window.location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const closeShared = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setShared(null)
  }

  // Poll the bot so the Invitation tab shows a live count wherever you are.
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
          {shared && <SharedPlan plan={shared} onClose={closeShared} />}
          {!shared && tab === 'week' && <ScheduleTab />}
          {!shared && tab === 'task' && <Task />}
          {!shared && tab === 'ask' && <VoiceMemo onPlan={() => setTab('task')} />}
          {!shared && tab === 'inbox' && <Inbox />}
          {!shared && tab === 'profile' && <Profile />}
        </div>

        {!shared && (
          <div className="tabbar">
            <TabButton tab="week" current={tab} setTab={setTab} label="Schedule" icon={<CalendarIcon />} />
            <TabButton tab="task" current={tab} setTab={setTab} label="Task" icon={<ChecklistIcon />} />

            {/* Ask is the one raised button — it's the way in, so it leads. */}
            <div className="tab-fab-wrap">
              <button className="tab-fab" onClick={() => setTab('ask')} aria-label="Ask Ruang">
                <MicIcon />
              </button>
              <span className="fab-label">Ask</span>
            </div>

            <TabButton
              tab="inbox"
              current={tab}
              setTab={setTab}
              label="Invitation"
              icon={<EnvelopeIcon />}
              badge={pending}
            />
            <TabButton tab="profile" current={tab} setTab={setTab} label="Profile" icon={<PersonIcon />} />
          </div>
        )}
      </div>
    </div>
  )
}

// The Schedule tab now opens on the Today dashboard, with the shipped month
// calendar one tap away. Both live in one tab so nothing that already worked
// (´/Clear, +Add, recurrence) was thrown out to make room.
function ScheduleTab() {
  const [view, setView] = useState<'today' | 'month'>('today')
  return view === 'today' ? (
    <Today onMonth={() => setView('month')} />
  ) : (
    <Scheduler onToday={() => setView('today')} />
  )
}

function TabButton({
  tab,
  current,
  setTab,
  label,
  icon,
  badge = 0,
}: {
  tab: Tab
  current: Tab
  setTab: (t: Tab) => void
  label: string
  icon: React.ReactNode
  badge?: number
}) {
  return (
    <button className={`tab-cell ${current === tab ? 'active' : ''}`} onClick={() => setTab(tab)}>
      <span className="tab-icon" aria-hidden>
        {icon}
      </span>
      <span className="tab-label">
        {label}
        {badge > 0 && <span className="tab-badge">{badge}</span>}
      </span>
    </button>
  )
}

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  )
}

function ChecklistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
      <path d="M9 11l2 2 4-4" />
      <rect x="3" y="4" width="18" height="17" rx="2" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  )
}

function EnvelopeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}
