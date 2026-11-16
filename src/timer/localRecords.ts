import { asEndReason, type Milestone, type Task, type WorkSession } from './model'

const KEY = 'focus-room.local.v1'

export type LocalRecords = {
  tasks: Task[]
  sessions: WorkSession[]
  milestones: Milestone[]
}

function empty(): LocalRecords {
  return { tasks: [], sessions: [], milestones: [] }
}

function asSession(session: WorkSession): WorkSession {
  return { ...session, end_reason: asEndReason(session.end_reason) }
}

export function readLocal(): LocalRecords {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<LocalRecords>
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(asSession) : [],
      milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
    }
  } catch {
    return empty()
  }
}

export function writeLocal(records: LocalRecords) {
  localStorage.setItem(KEY, JSON.stringify(records))
}

export function clearLocal() {
  localStorage.removeItem(KEY)
}

export function hasLocalRecords() {
  const records = readLocal()
  return records.tasks.length > 0 || records.sessions.length > 0 || records.milestones.length > 0
}
