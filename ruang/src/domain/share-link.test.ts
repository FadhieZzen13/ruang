import { describe, expect, it } from 'vitest'
import type { Task } from './task'
import { makeSession } from './task'
import { SHARE_PREFIX, decodePlan, encodePlan, readPlanFromHash } from './share-link'

const task: Task = {
  id: 't1',
  title: 'Group Assignment',
  deadline: '2026-09-20',
  pace: 'relaxed',
  totalMinutes: 240,
  sessions: [
    makeSession('2026-09-15', 20 * 60, 60, 'Research', 's1'),
    makeSession('2026-09-17', 20 * 60, 60, 'Write report', 's2'),
    makeSession('2026-09-19', 19 * 60, 60, 'Review', 's3'),
    makeSession('2026-09-20', 23 * 60, 30, 'Submit', 's4'),
  ],
  status: 'planned',
  createdAt: '2026-09-13T00:00:00.000Z',
}

describe('encode/decode', () => {
  it('round-trips the whole schedule', () => {
    const plan = decodePlan(encodePlan(task))!
    expect(plan.title).toBe('Group Assignment')
    expect(plan.deadline).toBe('2026-09-20')
    expect(plan.sessions.map((s) => [s.date, s.start, s.end, s.note])).toEqual([
      ['2026-09-15', 1200, 1260, 'Research'],
      ['2026-09-17', 1200, 1260, 'Write report'],
      ['2026-09-19', 1140, 1200, 'Review'],
      ['2026-09-20', 1380, 1410, 'Submit'],
    ])
  })

  it('re-derives the weekday from the date instead of trusting the link', () => {
    const plan = decodePlan(encodePlan(task))!
    expect(plan.sessions[0]!.day).toBe('tue') // 15 Sep 2026
    expect(plan.sessions[3]!.day).toBe('sun') // 20 Sep 2026
  })

  it('survives non-ASCII titles', () => {
    const plan = decodePlan(encodePlan({ ...task, title: 'Tugas — Análisis 数据' }))!
    expect(plan.title).toBe('Tugas — Análisis 数据')
  })

  it('stays URL-safe', () => {
    expect(encodePlan(task)).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('decode rejects junk', () => {
  // This arrives from a link a stranger could have edited.
  it.each([
    ['not base64', '!!!!'],
    ['not json', btoa('hello').replace(/=+$/, '')],
    ['not our shape', btoa(JSON.stringify({ hi: 1 })).replace(/=+$/, '')],
    ['empty sessions', btoa(JSON.stringify(['t', '2026-09-20', []])).replace(/=+$/, '')],
    ['bad deadline', btoa(JSON.stringify(['t', 'someday', [['2026-09-20', 60, 120, 'x']]])).replace(/=+$/, '')],
  ])('%s → null', (_label, payload) => {
    expect(decodePlan(payload)).toBeNull()
  })

  it('drops individual malformed sessions but keeps the good ones', () => {
    const wire = JSON.stringify([
      'Task',
      '2026-09-20',
      [
        ['2026-09-15', 1200, 1260, 'good'],
        ['nope', 1200, 1260, 'bad date'],
        ['2026-09-16', 1300, 1200, 'ends before it starts'],
        ['2026-09-17', 1200, 99999, 'past midnight'],
      ],
    ])
    const plan = decodePlan(btoa(wire).replace(/=+$/, ''))!
    expect(plan.sessions).toHaveLength(1)
    expect(plan.sessions[0]!.note).toBe('good')
  })
})

describe('readPlanFromHash', () => {
  it('reads our links and ignores everything else', () => {
    expect(readPlanFromHash(`${SHARE_PREFIX}${encodePlan(task)}`)?.title).toBe('Group Assignment')
    expect(readPlanFromHash('')).toBeNull()
    expect(readPlanFromHash('#/somewhere-else')).toBeNull()
    expect(readPlanFromHash(SHARE_PREFIX)).toBeNull()
  })
})
