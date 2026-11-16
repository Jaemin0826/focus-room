import { supabase } from '../supabase'
import { clearLocal, readLocal, writeLocal } from './localRecords'
import { openSessions, type Task, type WorkSession } from './model'

function fail(error: { message?: string; code?: string | null }) {
  const message = error.message ?? ''
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /could not find the table/i.test(message) ||
    /relation .* does not exist/i.test(message)
  ) {
    throw new Error('테이블이 아직 없습니다. schema.sql을 실행해 주세요.')
  }
  throw new Error('저장하지 못했습니다')
}

function asTask(row: Task): Task {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    archived: Boolean(row.archived),
    user_id: row.user_id,
  }
}

function asSession(row: WorkSession): WorkSession {
  return {
    id: row.id,
    task_id: row.task_id,
    started_at: row.started_at,
    ended_at: row.ended_at,
    created_at: row.created_at,
    user_id: row.user_id,
  }
}

export async function loadRemote() {
  const [tasksRes, sessionsRes] = await Promise.all([
    supabase.from('tasks').select('id,name,created_at,archived,user_id').eq('archived', false).order('created_at'),
    supabase.from('sessions').select('id,task_id,started_at,ended_at,created_at,user_id').order('started_at'),
  ])
  if (tasksRes.error) fail(tasksRes.error)
  if (sessionsRes.error) fail(sessionsRes.error)
  return {
    tasks: (tasksRes.data ?? []).map((row) => asTask(row as Task)),
    sessions: (sessionsRes.data ?? []).map((row) => asSession(row as WorkSession)),
  }
}

async function userId() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('로그인이 필요합니다')
  return data.user.id
}

export async function addRemoteTask(name: string) {
  const uid = await userId()
  const { data, error } = await supabase
    .from('tasks')
    .insert({ name, user_id: uid })
    .select('id,name,created_at,archived,user_id')
    .single()
  if (error) fail(error)
  return asTask(data as Task)
}

export async function addRemoteSession(taskId: string) {
  const uid = await userId()
  const { data, error } = await supabase
    .from('sessions')
    .insert({ task_id: taskId, user_id: uid })
    .select('id,task_id,started_at,ended_at,created_at,user_id')
    .single()
  if (error) fail(error)
  return asSession(data as WorkSession)
}

export async function closeRemoteSessions(ids: string[], endedAt: string) {
  if (ids.length === 0) return
  const { error } = await supabase.from('sessions').update({ ended_at: endedAt }).in('id', ids)
  if (error) fail(error)
}

export function loadLocalView() {
  const records = readLocal()
  return {
    tasks: records.tasks.filter((task) => !task.archived),
    sessions: records.sessions,
  }
}

export function addLocalTask(name: string) {
  const records = readLocal()
  const task: Task = {
    id: crypto.randomUUID(),
    name,
    created_at: new Date().toISOString(),
    archived: false,
    user_id: null,
  }
  records.tasks.push(task)
  writeLocal(records)
  return task
}

export function addLocalSession(taskId: string) {
  const records = readLocal()
  const now = new Date().toISOString()
  const session: WorkSession = {
    id: crypto.randomUUID(),
    task_id: taskId,
    started_at: now,
    ended_at: null,
    created_at: now,
    user_id: null,
  }
  records.sessions.push(session)
  writeLocal(records)
  return session
}

export function closeLocalSessions(ids: string[], endedAt: string) {
  if (ids.length === 0) return
  const records = readLocal()
  records.sessions = records.sessions.map((session) =>
    ids.includes(session.id) && session.ended_at === null ? { ...session, ended_at: endedAt } : session,
  )
  writeLocal(records)
}

export async function settleOpen(sessions: WorkSession[], remote: boolean) {
  const open = openSessions(sessions)
  if (open.length <= 1) return sessions
  const endedAt = new Date().toISOString()
  const extras = open.slice(0, -1).map((session) => session.id)
  if (remote) await closeRemoteSessions(extras, endedAt)
  else closeLocalSessions(extras, endedAt)
  return sessions.map((session) => (extras.includes(session.id) ? { ...session, ended_at: endedAt } : session))
}

export async function uploadLocalRecords() {
  const local = readLocal()
  if (local.tasks.length === 0 && local.sessions.length === 0) return
  const uid = await userId()
  if (local.tasks.length > 0) {
    const { error } = await supabase.from('tasks').upsert(
      local.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        created_at: task.created_at,
        archived: task.archived,
        user_id: uid,
      })),
      { onConflict: 'id' },
    )
    if (error) fail(error)
  }
  if (local.sessions.length > 0) {
    const { error } = await supabase.from('sessions').upsert(
      local.sessions.map((session) => ({
        id: session.id,
        task_id: session.task_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        created_at: session.created_at,
        user_id: uid,
      })),
      { onConflict: 'id' },
    )
    if (error) fail(error)
  }
  clearLocal()
}
