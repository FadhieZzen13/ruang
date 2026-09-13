import type { Task } from '../domain/task'
import { sessionsToActivities } from '../domain/task'
import { addActivities, removeActivities } from './store'
import { saveTask } from './tasks'

// The one place a plan turns into real blocks in the week. Called only from an
// explicit tap — it proposes, you decide.
export function acceptPlan(task: Task): Task {
  const activities = sessionsToActivities(task)
  addActivities(activities) // one write, so one schedule sync to the bot

  const planned: Task = {
    ...task,
    status: 'planned',
    sessions: task.sessions.map((s, i) => ({ ...s, activityId: activities[i]?.id ?? null })),
  }
  saveTask(planned)
  return planned
}

// Dropping a planned task takes its blocks back out of the week with it.
export function unacceptPlan(task: Task): Task {
  const ids = task.sessions.map((s) => s.activityId).filter((id): id is string => id !== null)
  if (ids.length) removeActivities(ids)

  const draft: Task = {
    ...task,
    status: 'draft',
    sessions: task.sessions.map((s) => ({ ...s, activityId: null })),
  }
  saveTask(draft)
  return draft
}
