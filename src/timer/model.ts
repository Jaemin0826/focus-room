export type Task = {
  id: string
  name: string
  created_at: string
  archived: boolean
  user_id: string | null
}

export type WorkSession = {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
  created_at: string
  user_id: string | null
}

export type Phase = 'idle' | 'running' | 'paused'

export function sessionMs(session: WorkSession, now: number) {
  const start = Date.parse(session.started_at)
  const end = session.ended_at ? Date.parse(session.ended_at) : now
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, end - start)
}

export function taskTotalMs(sessions: WorkSession[], taskId: string, now: number) {
  return sessions.reduce((sum, session) => (session.task_id === taskId ? sum + sessionMs(session, now) : sum), 0)
}

export function todayTotalMs(sessions: WorkSession[], now: number) {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  const dayStart = day.getTime()
  const dayEnd = dayStart + 24 * 60 * 60 * 1000
  return sessions.reduce((sum, session) => {
    const start = Date.parse(session.started_at)
    const end = session.ended_at ? Date.parse(session.ended_at) : now
    if (!Number.isFinite(start) || !Number.isFinite(end)) return sum
    const from = Math.max(start, dayStart)
    const to = Math.min(end, dayEnd)
    return sum + Math.max(0, to - from)
  }, 0)
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function openSessions(sessions: WorkSession[]) {
  return sessions
    .filter((session) => session.ended_at === null)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at))
}
