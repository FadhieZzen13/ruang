import { useState } from 'react'
import { clearActivities, loadDemo, setName, useAppState } from '../../app/store'
import { termWeek, TERM_WEEKS } from '../../app/dates'
import { ChevronRight } from '../bits'

// The Profile tab the new nav adds. The mockups never specify its content, so
// this holds what the app already had living in odd corners: the editable name
// (was tappable inline on the Schedule header) and the Demo/Clear controls.
// Nothing else is invented here — a profile screen with no spec earns no
// fictional settings.
export function Profile() {
  const { name, activities } = useAppState()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [armed, setArmed] = useState(false)
  const week = termWeek()

  const commit = () => {
    setName(draft.trim() || name)
    setEditing(false)
  }

  const clear = () => {
    if (activities.length === 0) return
    if (armed) {
      clearActivities()
      setArmed(false)
    } else {
      setArmed(true)
      setTimeout(() => setArmed(false), 4000)
    }
  }

  return (
    <div>
      <div className="appbar">
        <div>
          <div className="eyebrow">You</div>
          <h1>Profile</h1>
        </div>
      </div>

      <div className="profile-head">
        <div className="avatar-lg">{name.trim().charAt(0).toUpperCase() || 'R'}</div>
        {editing ? (
          <div className="name-editor">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(false)
              }}
              autoFocus
            />
            <button className="name-done" onClick={commit} aria-label="Save name">
              ✓
            </button>
          </div>
        ) : (
          <button className="profile-name" onClick={() => { setDraft(name); setEditing(true) }}>
            {name}
            <span className="edit">✎</span>
          </button>
        )}
        <div className="profile-term">
          Week {week} of {TERM_WEEKS} · {activities.length} thing
          {activities.length === 1 ? '' : 's'} in your week
        </div>
      </div>

      <div className="profile-group">
        <span className="glabel">Demo</span>
        <button className="profile-row" onClick={loadDemo}>
          Load the demo week
          <ChevronRight />
        </button>
        <button className={`profile-row ${armed ? 'danger' : ''}`} onClick={clear}>
          {armed ? 'Tap again to clear' : 'Clear my week'}
          <span className="chev">{armed ? '!' : '×'}</span>
        </button>
      </div>

      <div className="profile-group">
        <span className="glabel">About</span>
        <div className="profile-row" style={{ cursor: 'default' }}>
          Ruang
          <span className="meta">It proposes. You decide.</span>
        </div>
      </div>
    </div>
  )
}
