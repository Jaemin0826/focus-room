export type Task = {
  id: string
  name: string
  created_at: string
  archived: boolean
  user_id: string | null
}

export type EndReason = 'pause' | 'stop'

export type WorkSession = {
  id: string
  task_id: string
  started_at: string
  ended_at: string | null
  end_reason: EndReason | null
  created_at: string
  user_id: string | null
}

export type Milestone = {
  id: string
  task_id: string
  session_id: string | null
  note: string
  created_at: string
  user_id: string | null
}

export type TimelineItem = {
  id: string
  at: string
  text: string
  kind: 'session' | 'milestone'
  milestoneId?: string
}

export type TimelineDay = {
  key: string
  label: string
  items: TimelineItem[]
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

export function asEndReason(value: unknown): EndReason | null {
  return value === 'pause' || value === 'stop' ? value : null
}

function clock(iso: string) {
  const date = new Date(iso)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function dayKey(iso: string) {
  const date = new Date(iso)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export function buildTimeline(sessions: WorkSession[], milestones: Milestone[], taskId: string): TimelineDay[] {
  const mine = sessions
    .filter((session) => session.task_id === taskId)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at) || a.id.localeCompare(b.id))
  const items: TimelineItem[] = []
  let previous: EndReason | null = null
  for (const session of mine) {
    items.push({
      id: `${session.id}:start`,
      at: session.started_at,
      text: `${clock(session.started_at)} ${previous === 'pause' ? '다시 시작' : '시작'}`,
      kind: 'session',
    })
    if (session.ended_at) {
      const label = session.end_reason === 'pause' ? '일시정지' : session.end_reason === 'stop' ? '종료' : '멈춤'
      items.push({
        id: `${session.id}:end`,
        at: session.ended_at,
        text: `${clock(session.ended_at)} ${label}`,
        kind: 'session',
      })
    }
    previous = session.end_reason
  }
  for (const milestone of milestones) {
    if (milestone.task_id !== taskId) continue
    items.push({
      id: milestone.id,
      at: milestone.created_at,
      text: `✓ ${clock(milestone.created_at)} ${milestone.note}`,
      kind: 'milestone',
      milestoneId: milestone.id,
    })
  }
  items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))
  const days: TimelineDay[] = []
  for (const item of items) {
    const key = dayKey(item.at)
    const last = days.at(-1)
    if (!last || last.key !== key) days.push({ key, label: dayLabel(item.at), items: [item] })
    else last.items.push(item)
  }
  return days
}
