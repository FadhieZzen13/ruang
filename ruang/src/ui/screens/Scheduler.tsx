import { useMemo, useRef, useState } from 'react'
import {
  useAppState,
  fmt,
  addActivity,
  removeActivity,
  clearActivities,
  loadDemo,
  setName,
} from '../../app/store'
import { DAY_LABEL, type ActivityKind, type Day } from '../../domain/types'
import {
  DOW_LABELS,
  monthMatrix,
  monthLabel,
  addMonths,
  dayKeyOf,
  sameDay,
} from '../../app/dates'
import { activitiesOn, isoDate, occursOn } from '../../domain/occurrence'

const KINDS: ActivityKind[] = ['class', 'meeting', 'activity', 'work']

export function Scheduler() {
  const { activities, name } = useAppState()
  const today = useMemo(() => new Date(), [])
  const [editingName, setEditingName] = useState(false)
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(today)
  const [adding, setAdding] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const armed = useRef(false)

  const cells = useMemo(() => monthMatrix(view), [view])
  // Two sets, because a day can be busy for two different reasons: something
  // pinned to that exact date, or something floating on that weekday.
  const busy = useMemo(() => {
    const dated = new Set<string>()
    const floating = new Set<Day>()
    for (const a of activities) {
      if (a.date) dated.add(a.date)
      else floating.add(a.day)
    }
    return { dated, floating }
  }, [activities])

  const selectedKey = dayKeyOf(selected)
  const agenda = activitiesOn(activities, selected).sort((a, b) => a.start - b.start)

  const isToday = sameDay(selected, today)

  const nextBusy = useMemo(() => {
    for (let offset = 1; offset <= 7; offset++) {
      const d = new Date(selected)
      d.setDate(d.getDate() + offset)
      const items = activities.filter((a) => occursOn(a, d))
      if (items.length) return { date: d, count: items.length }
    }
    return null
  }, [selected, activities])

  // Two-tap clear: first tap arms, second tap wipes. Auto-disarms after 4s.
  // Uses a ref so the armed state is read synchronously (survives fast taps).
  const clearAll = () => {
    if (activities.length === 0) return
    if (armed.current) {
      clearActivities()
      setAdding(false)
      armed.current = false
      setConfirmClear(false)
    } else {
      armed.current = true
      setConfirmClear(true)
      setTimeout(() => {
        armed.current = false
        setConfirmClear(false)
      }, 4000)
    }
  }

  return (
    <div>
      <div className="appbar">
        <div>
          <div className="eyebrow">Your week</div>
          {editingName ? (
            <NameEditor
              value={name}
              onDone={(v) => {
                setName(v)
                setEditingName(false)
              }}
            />
          ) : (
            <h1 onClick={() => setEditingName(true)} title="Tap to rename">
              {name}
            </h1>
          )}
        </div>
        <div className="profile-actions">
          <button onClick={() => { loadDemo(); armed.current = false; setConfirmClear(false) }}>Demo</button>
          <button className={confirmClear ? 'danger' : ''} onClick={clearAll}>
            {confirmClear ? 'Sure?' : 'Clear'}
          </button>
        </div>
      </div>

      <div className="cal">
        <div className="cal-head">
          <div className="cal-month">{monthLabel(view)}</div>
          <div className="cal-nav">
            <button onClick={() => setView(addMonths(view, -1))} aria-label="Previous month">
              ‹
            </button>
            <button onClick={() => setView(addMonths(view, 1))} aria-label="Next month">
              ›
            </button>
          </div>
        </div>

        <div className="cal-grid">
          {DOW_LABELS.map((d) => (
            <div key={d} className="cal-dow">
              {d[0]}
            </div>
          ))}
          {cells.map((date, i) => {
            if (!date) return <div key={`p${i}`} className="cal-cell pad" />
            const cls = [
              'cal-cell',
              sameDay(date, today) ? 'today' : '',
              sameDay(date, selected) ? 'selected' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button key={date.toISOString()} className={cls} onClick={() => setSelected(date)}>
                {date.getDate()}
                {(busy.dated.has(isoDate(date)) || busy.floating.has(dayKeyOf(date))) && (
                  <span className="cal-dot" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="agenda-head">
        <div>
          <div className="agenda-title">{isToday ? 'Today' : DAY_LABEL[selectedKey]}</div>
          <div className="agenda-date">
            {selected.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
            {agenda.length > 0 && ` · ${agenda.length} ${agenda.length === 1 ? 'thing' : 'things'}`}
          </div>
        </div>
        <button className="add-btn" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Close' : '+ Add'}
        </button>
      </div>

      {adding && (
        <AddEvent
          dayLabel={DAY_LABEL[selectedKey]}
          onAdd={(title, start, end, kind) => {
            addActivity({
              id: `u${Date.now()}`,
              title,
              day: selectedKey,
              start,
              end,
              kind,
              locked: false,
              description: '',
              recurrence: 'once',
              // A one-off belongs to the day you picked, not to every Tuesday.
              date: isoDate(selected),
            })
            setAdding(false)
          }}
        />
      )}

      {agenda.length === 0 ? (
        <div className="empty-day">
          <div>Nothing on {isToday ? 'today' : DAY_LABEL[selectedKey]}.</div>
          {nextBusy && !adding && (
            <button className="next-up" onClick={() => setSelected(nextBusy.date)}>
              Next: {DAY_LABEL[dayKeyOf(nextBusy.date)]} · {nextBusy.count} thing
              {nextBusy.count > 1 ? 's' : ''} →
            </button>
          )}
        </div>
      ) : (
        <div className="day-col">
          {agenda.map((a) => (
            <div key={a.id} className={`chip ${a.kind}`}>
              <div className="chip-body">
                <div className="chip-time">
                  {fmt(a.start)} – {fmt(a.end)}
                  {a.recurrence === 'weekly' && <span className="recur-mark" title="Repeats weekly"> ↻</span>}
                </div>
                <div className="chip-title">{a.title}</div>
                {a.description && <div className="chip-desc">{a.description}</div>}
              </div>
              <button
                className="chip-del"
                onClick={() => removeActivity(a.id)}
                aria-label={`Remove ${a.title}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NameEditor({ value, onDone }: { value: string; onDone: (v: string) => void }) {
  const [draft, setDraft] = useState(value)

  const commit = () => onDone(draft.trim() || value)

  return (
    <div className="name-editor">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onDone(value)
        }}
        placeholder="Your name"
        autoFocus
      />
      <button onClick={commit} className="name-done" aria-label="Save name">
        ✓
      </button>
    </div>
  )
}

function AddEvent({
  dayLabel,
  onAdd,
}: {
  dayLabel: string
  onAdd: (title: string, start: number, end: number, kind: ActivityKind) => void
}) {
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('18:00')
  const [end, setEnd] = useState('19:00')
  const [kind, setKind] = useState<ActivityKind>('activity')

  const startMin = toMinutes(start)
  const endMin = toMinutes(end)
  const valid = title.trim() !== '' && endMin > startMin

  return (
    <div className="add-form card">
      <div className="eyebrow">New on {dayLabel}</div>
      <input
        className="add-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What is it? (e.g. Calculus lecture)"
        autoFocus
      />
      <div className="add-row">
        <label>
          Start
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          End
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="kind-row">
        {KINDS.map((k) => (
          <button
            key={k}
            className={`kind-pill ${k} ${kind === k ? 'on' : ''}`}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={!valid}
        onClick={() => onAdd(title.trim(), startMin, endMin, kind)}
      >
        Add to {dayLabel}
      </button>
    </div>
  )
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
