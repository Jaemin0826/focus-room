import { supabase } from '../supabase'
import { clearLocal, readLocal, writeLocal } from './localRecords'
import { asEndReason, openSessions, type EndReason, type Milestone, type Task, type WorkSession } from './model'

function fail(error: { message?: string; code?: string | null }): never {
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
    end_reason: asEndReason(row.end_reason),
    created_at: row.created_at,
    user_id: row.user_id,
  }
}

function asMilestone(row: Milestone): Milestone {
  return {
    id: row.id,
    task_id: row.task_id,
    session_id: row.session_id,
    note: row.note,
    created_at: row.created_at,
    user_id: row.user_id,
  }
}

function missingTimeline(error: { message?: string; code?: string | null }) {
  const message = error.message ?? ''
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /end_reason|milestones/i.test(message)
  )
}

const sessionColumns = 'id,task_id,started_at,ended_at,end_reason,created_at,user_id'
const milestoneColumns = 'id,task_id,session_id,note,created_at,user_id'

export async function loadRemote() {
  const tasksRes = await supabase
    .from('tasks')
    .select('id,name,created_at,archived,user_id')
    .eq('archived', false)
    .order('created_at')
  if (tasksRes.error) fail(tasksRes.error)

  const sessionsFull = await supabase.from('sessions').select(sessionColumns).order('started_at')
  let sessionRows: WorkSession[]
  if (!sessionsFull.error) {
    sessionRows = (sessionsFull.data ?? []).map((row) => asSession(row as WorkSession))
  } else if (missingTimeline(sessionsFull.error)) {
    const sessionsBasic = await supabase
      .from('sessions')
      .select('id,task_id,started_at,ended_at,created_at,user_id')
      .order('started_at')
    if (sessionsBasic.error) fail(sessionsBasic.error)
    sessionRows = (sessionsBasic.data ?? []).map((row) => asSession({ ...(row as WorkSession), end_reason: null }))
  } else {
    fail(sessionsFull.error)
  }

  const milestonesRes = await supabase.from('milestones').select(milestoneColumns).order('created_at')
  let milestones: Milestone[] = []
  if (milestonesRes.error) {
    if (!missingTimeline(milestonesRes.error)) fail(milestonesRes.error)
  } else {
    milestones = (milestonesRes.data ?? []).map((row) => asMilestone(row as Milestone))
  }

  return {
    tasks: (tasksRes.data ?? []).map((row) => asTask(row as Task)),
    sessions: sessionRows,
    milestones,
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
    .select(sessionColumns)
    .single()
  if (error && missingTimeline(error)) {
    const basic = await supabase
      .from('sessions')
      .insert({ task_id: taskId, user_id: uid })
      .select('id,task_id,started_at,ended_at,created_at,user_id')
      .single()
    if (basic.error) fail(basic.error)
    return asSession(basic.data as WorkSession)
  }
  if (error) fail(error)
  return asSession(data as WorkSession)
}

export async function closeRemoteSessions(ids: string[], endedAt: string, reason: EndReason) {
  if (ids.length === 0) return
  const withReason = await supabase.from('sessions').update({ ended_at: endedAt, end_reason: reason }).in('id', ids)
  if (!withReason.error) return
  if (!missingTimeline(withReason.error)) fail(withReason.error)
  const basic = await supabase.from('sessions').update({ ended_at: endedAt }).in('id', ids)
  if (basic.error) fail(basic.error)
}

export async function setRemoteEndReason(id: string, reason: EndReason) {
  const { error } = await supabase.from('sessions').update({ end_reason: reason }).eq('id', id)
  if (error) fail(error)
}

export async function addRemoteMilestone(taskId: string, note: string, sessionId: string | null) {
  const uid = await userId()
  const { data, error } = await supabase
    .from('milestones')
    .insert({ task_id: taskId, note, session_id: sessionId, user_id: uid, created_at: new Date().toISOString() })
    .select(milestoneColumns)
    .single()
  if (error) fail(error)
  return asMilestone(data as Milestone)
}

export async function deleteRemoteMilestone(id: string) {
  const { error } = await supabase.from('milestones').delete().eq('id', id)
  if (error) fail(error)
}

export function loadLocalView() {
  const records = readLocal()
  return {
    tasks: records.tasks.filter((task) => !task.archived),
    sessions: records.sessions,
    milestones: records.milestones,
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
    end_reason: null,
    created_at: now,
    user_id: null,
  }
  records.sessions.push(session)
  writeLocal(records)
  return session
}

export function closeLocalSessions(ids: string[], endedAt: string, reason: EndReason) {
  if (ids.length === 0) return
  const records = readLocal()
  records.sessions = records.sessions.map((session) =>
    ids.includes(session.id) && session.ended_at === null ? { ...session, ended_at: endedAt, end_reason: reason } : session,
  )
  writeLocal(records)
}

export function setLocalEndReason(id: string, reason: EndReason) {
  const records = readLocal()
  records.sessions = records.sessions.map((session) => (session.id === id ? { ...session, end_reason: reason } : session))
  writeLocal(records)
}

export function addLocalMilestone(taskId: string, note: string, sessionId: string | null) {
  const records = readLocal()
  const milestone: Milestone = {
    id: crypto.randomUUID(),
    task_id: taskId,
    session_id: sessionId,
    note,
    created_at: new Date().toISOString(),
    user_id: null,
  }
  records.milestones.push(milestone)
  writeLocal(records)
  return milestone
}

export function deleteLocalMilestone(id: string) {
  const records = readLocal()
  records.milestones = records.milestones.filter((milestone) => milestone.id !== id)
  writeLocal(records)
}

export async function settleOpen(sessions: WorkSession[], remote: boolean) {
  const open = openSessions(sessions)
  if (open.length <= 1) return sessions
  const endedAt = new Date().toISOString()
  const extras = open.slice(0, -1).map((session) => session.id)
  if (remote) await closeRemoteSessions(extras, endedAt, 'pause')
  else closeLocalSessions(extras, endedAt, 'pause')
  return sessions.map((session) =>
    extras.includes(session.id) ? { ...session, ended_at: endedAt, end_reason: 'pause' as const } : session,
  )
}

export async function uploadLocalRecords() {
  const local = readLocal()
  if (local.tasks.length === 0 && local.sessions.length === 0 && local.milestones.length === 0) return
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
        end_reason: session.end_reason,
        created_at: session.created_at,
        user_id: uid,
      })),
      { onConflict: 'id' },
    )
    if (error) fail(error)
  }
  if (local.milestones.length > 0) {
    const { error } = await supabase.from('milestones').upsert(
      local.milestones.map((milestone) => ({
        id: milestone.id,
        task_id: milestone.task_id,
        session_id: milestone.session_id,
        note: milestone.note,
        created_at: milestone.created_at,
        user_id: uid,
      })),
      { onConflict: 'id' },
    )
    if (error) fail(error)
  }
  clearLocal()
}
