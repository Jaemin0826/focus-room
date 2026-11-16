import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { credentialsFor, validateLogin } from './identity'
import { hasLocalRecords } from './localRecords'
import {
  buildTimeline,
  formatDuration,
  openSessions,
  taskTotalMs,
  todayTotalMs,
  sessionMs,
  type EndReason,
  type Milestone,
  type Phase,
  type Task,
  type WorkSession,
} from './model'
import {
  addLocalMilestone,
  addLocalSession,
  addLocalTask,
  addRemoteMilestone,
  addRemoteSession,
  addRemoteTask,
  closeLocalSessions,
  closeRemoteSessions,
  deleteLocalMilestone,
  deleteRemoteMilestone,
  loadLocalView,
  loadRemote,
  setLocalEndReason,
  setRemoteEndReason,
  settleOpen,
  uploadLocalRecords,
} from './records'

function invalidLogin(error: { message?: string; code?: string }) {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  return code === 'invalid_credentials' || message.includes('invalid login')
}

export function useTimer() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offerCreate, setOfferCreate] = useState(false)
  const [pendingLocal, setPendingLocal] = useState(false)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  const signedIn = user !== null

  const apply = useCallback(
    (nextTasks: Task[], nextSessions: WorkSession[], nextMilestones: Milestone[], preferRunning: boolean) => {
      const visible = nextTasks.filter((task) => !task.archived)
      const running = openSessions(nextSessions).at(-1) ?? null
      setTasks(visible)
      setSessions(nextSessions)
      setMilestones(nextMilestones)
      if (running && preferRunning) {
        setSelectedId(running.task_id)
        setPhase('running')
        return
      }
      setSelectedId((current) => (current && visible.some((task) => task.id === current) ? current : null))
      if (!running) setPhase((current) => (current === 'running' ? 'idle' : current))
    },
    [],
  )

  const refresh = useCallback(
    async (activeUser: User | null, preferRunning = true) => {
      if (!activeUser) {
        const local = loadLocalView()
        const settled = await settleOpen(local.sessions, false)
        apply(local.tasks, settled, local.milestones, preferRunning)
        setPendingLocal(false)
        return
      }
      const remote = await loadRemote()
      const settled = await settleOpen(remote.sessions, true)
      apply(remote.tasks, settled, remote.milestones, preferRunning)
      setPendingLocal(hasLocalRecords())
    },
    [apply],
  )

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    let ignore = false
    supabase.auth.getSession().then(({ data }) => {
      if (ignore) return
      const next = data.session?.user ?? null
      setUser(next)
      refresh(next)
        .catch((reason: Error) => setError(reason.message))
        .finally(() => {
          if (!ignore) setReady(true)
        })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null
      setUser(next)
      window.setTimeout(() => {
        refresh(next).catch((reason: Error) => setError(reason.message))
      }, 0)
    })
    return () => {
      ignore = true
      data.subscription.unsubscribe()
    }
  }, [refresh])

  useEffect(() => {
    const onFocus = () => {
      if (signedIn) refresh(user).catch((reason: Error) => setError(reason.message))
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh, signedIn, user])

  const guard = useCallback(async (action: () => Promise<void>) => {
    if (lock.current) return false
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '저장하지 못했습니다')
      return false
    } finally {
      lock.current = false
      setBusy(false)
    }
  }, [])

  const closeOpen = useCallback(
    async (current: WorkSession[], reason: EndReason) => {
      const ids = openSessions(current).map((session) => session.id)
      if (ids.length === 0) return current
      const endedAt = new Date().toISOString()
      if (signedIn) await closeRemoteSessions(ids, endedAt, reason)
      else closeLocalSessions(ids, endedAt, reason)
      return current.map((session) =>
        ids.includes(session.id) && session.ended_at === null
          ? { ...session, ended_at: endedAt, end_reason: reason }
          : session,
      )
    },
    [signedIn],
  )

  const signIn = useCallback(
    (name: string, pin: string) =>
      guard(async () => {
        const problem = validateLogin(name, pin)
        if (problem) {
          setNotice(null)
          setOfferCreate(false)
          setError(problem)
          return
        }
        const creds = await credentialsFor(name, pin)
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: creds.email,
          password: creds.password,
        })
        if (authError) {
          if (invalidLogin(authError)) {
            setNotice(null)
            setOfferCreate(true)
            setError('이름 또는 비밀번호 틀림')
            return
          }
          throw new Error('로그인하지 못했습니다')
        }
        if (!data.session) {
          setOfferCreate(false)
          setError('이메일 확인이 켜져 있어 로그인되지 않았습니다. Supabase에서 Confirm email을 꺼 주세요.')
          return
        }
        await supabase.auth.updateUser({ data: { display_name: creds.displayName } })
        setOfferCreate(false)
        setNotice(null)
      }),
    [guard],
  )

  const createAccount = useCallback(
    (name: string, pin: string) =>
      guard(async () => {
        const problem = validateLogin(name, pin)
        if (problem) {
          setError(problem)
          return
        }
        const creds = await credentialsFor(name, pin)
        const { data, error: authError } = await supabase.auth.signUp({
          email: creds.email,
          password: creds.password,
          options: { data: { display_name: creds.displayName } },
        })
        if (authError) {
          const message = authError.message.toLowerCase()
          if (message.includes('already') || authError.code === 'user_already_exists') {
            setError('이름 또는 비밀번호 틀림')
            return
          }
          throw new Error('계정을 만들지 못했습니다')
        }
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setError('이름 또는 비밀번호 틀림')
          return
        }
        if (!data.session) {
          setError('이메일 확인이 켜져 있어 로그인되지 않았습니다. Supabase에서 Confirm email을 꺼 주세요.')
          return
        }
        setOfferCreate(false)
        setError(null)
        setNotice('새 계정 생성됨')
      }),
    [guard],
  )

  const signOut = useCallback(() => {
    setNotice(null)
    setOfferCreate(false)
    setPhase('idle')
    return supabase.auth.signOut()
  }, [])

  const addTask = useCallback(
    async (name: string) => {
      const trimmed = name.normalize('NFC').trim()
      if (!trimmed) {
        setError('작업 이름을 입력하세요')
        return false
      }
      const saved = await guard(async () => {
        const task = signedIn ? await addRemoteTask(trimmed) : addLocalTask(trimmed)
        setTasks((current) => [...current, task])
        setSelectedId((current) => current ?? task.id)
      })
      return saved
    },
    [guard, signedIn],
  )

  const selectTask = useCallback(
    (id: string) =>
      guard(async () => {
        if (id === selectedId) return
        const next = await closeOpen(sessions, 'pause')
        setSessions(next)
        setSelectedId(id)
        setPhase('idle')
      }),
    [closeOpen, guard, selectedId, sessions],
  )

  const start = useCallback(
    () =>
      guard(async () => {
        if (!selectedId || phase === 'running') return
        const closed = await closeOpen(sessions, 'pause')
        const session = signedIn ? await addRemoteSession(selectedId) : addLocalSession(selectedId)
        setSessions([...closed, session])
        setPhase('running')
      }),
    [closeOpen, guard, phase, selectedId, sessions, signedIn],
  )

  const pause = useCallback(
    () =>
      guard(async () => {
        if (phase !== 'running') return
        const next = await closeOpen(sessions, 'pause')
        setSessions(next)
        setPhase('paused')
      }),
    [closeOpen, guard, phase, sessions],
  )

  const stop = useCallback(
    () =>
      guard(async () => {
        const open = openSessions(sessions)
        if (open.length > 0) {
          setSessions(await closeOpen(sessions, 'stop'))
        } else if (selectedId) {
          const latest = sessions
            .filter((session) => session.task_id === selectedId && session.ended_at)
            .sort((a, b) => Date.parse(b.ended_at ?? '') - Date.parse(a.ended_at ?? ''))[0]
          if (latest?.end_reason === 'pause') {
            if (signedIn) await setRemoteEndReason(latest.id, 'stop')
            else setLocalEndReason(latest.id, 'stop')
            setSessions((current) =>
              current.map((session) => (session.id === latest.id ? { ...session, end_reason: 'stop' } : session)),
            )
          }
        }
        setPhase('idle')
      }),
    [closeOpen, guard, selectedId, sessions, signedIn],
  )

  const addMilestone = useCallback(
    async (note: string) => {
      const trimmed = note.normalize('NFC').trim()
      if (!selectedId || !trimmed) {
        setError('완료한 일을 입력하세요')
        return false
      }
      return guard(async () => {
        const sessionId = openSessions(sessions).find((session) => session.task_id === selectedId)?.id ?? null
        const milestone = signedIn
          ? await addRemoteMilestone(selectedId, trimmed, sessionId)
          : addLocalMilestone(selectedId, trimmed, sessionId)
        setMilestones((current) => [...current, milestone])
      })
    },
    [guard, selectedId, sessions, signedIn],
  )

  const deleteMilestone = useCallback(
    (id: string) =>
      guard(async () => {
        if (signedIn) await deleteRemoteMilestone(id)
        else deleteLocalMilestone(id)
        setMilestones((current) => current.filter((milestone) => milestone.id !== id))
      }),
    [guard, signedIn],
  )

  const migrate = useCallback(
    () =>
      guard(async () => {
        if (!signedIn) return
        await uploadLocalRecords()
        setPendingLocal(false)
        await refresh(user, true)
        setNotice('기록을 옮겼습니다')
      }),
    [guard, refresh, signedIn, user],
  )

  const exportJson = useCallback(() => {
    const payload = {
      exported_at: new Date().toISOString(),
      mode: signedIn ? 'supabase' : 'local',
      tasks,
      sessions,
      milestones,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'focus-room-records.json'
    link.click()
    URL.revokeObjectURL(url)
  }, [milestones, sessions, signedIn, tasks])

  const selected = tasks.find((task) => task.id === selectedId) ?? null
  const runningSession = openSessions(sessions).at(-1) ?? null
  const boutMs = useMemo(() => {
    if (!selected) return 0
    const mine = sessions.filter((session) => session.task_id === selected.id)
    if (phase === 'running') {
      const open = mine.find((session) => session.ended_at === null)
      return open ? sessionMs(open, now) : 0
    }
    if (phase === 'paused') {
      const latest = mine
        .filter((session) => session.ended_at)
        .sort((a, b) => Date.parse(b.ended_at ?? '') - Date.parse(a.ended_at ?? ''))[0]
      return latest ? sessionMs(latest, now) : 0
    }
    return 0
  }, [now, phase, selected, sessions])

  const displayName =
    (typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name) || user?.email || ''

  const timeline = useMemo(
    () => (selectedId ? buildTimeline(sessions, milestones, selectedId) : []),
    [milestones, selectedId, sessions],
  )

  return {
    ready,
    signedIn,
    displayName,
    tasks,
    selectedId,
    phase,
    busy,
    notice,
    error,
    offerCreate,
    pendingLocal,
    clock: formatDuration(boutMs),
    today: formatDuration(todayTotalMs(sessions, now)),
    totalFor: (taskId: string) => formatDuration(taskTotalMs(sessions, taskId, now)),
    runningTaskId: runningSession?.task_id ?? null,
    timeline,
    signIn,
    createAccount,
    signOut,
    addTask,
    selectTask,
    start,
    pause,
    stop,
    addMilestone,
    deleteMilestone,
    migrate,
    exportJson,
  }
}
