import { useState, type FormEvent } from 'react'
import { useTimer } from '../timer/useTimer'

const STATUS = {
  idle: '대기',
  running: '진행 중',
  paused: '일시정지',
} as const

export function TimerPanel() {
  const timer = useTimer()
  const [loginName, setLoginName] = useState('')
  const [pin, setPin] = useState('')
  const [taskName, setTaskName] = useState('')

  const onLogin = (event: FormEvent) => {
    event.preventDefault()
    void timer.signIn(loginName, pin)
  }

  const onAdd = (event: FormEvent) => {
    event.preventDefault()
    void timer.addTask(taskName).then((saved) => {
      if (saved) setTaskName('')
    })
  }

  return (
    <aside className="panel" aria-label="타이머">
      {timer.signedIn ? (
        <div className="panel-row panel-account">
          <span className="panel-name">{timer.displayName}</span>
          <button type="button" onClick={() => void timer.signOut()}>
            로그아웃
          </button>
        </div>
      ) : (
        <form className="login" onSubmit={onLogin}>
          <label>
            이름
            <input
              name="username"
              value={loginName}
              maxLength={40}
              autoComplete="username"
              spellCheck={false}
              onChange={(event) => setLoginName(event.target.value)}
            />
          </label>
          <label>
            핀
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              maxLength={4}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>
          <button type="submit" disabled={timer.busy}>
            들어가기
          </button>
          {timer.offerCreate ? (
            <button type="button" disabled={timer.busy} onClick={() => void timer.createAccount(loginName, pin)}>
              새로 만들기
            </button>
          ) : null}
        </form>
      )}

      <div className="panel-meta">
        <span>오늘 {timer.today}</span>
        <span>{timer.signedIn ? '계정' : '이 기기에만 저장'}</span>
      </div>

      <form className="panel-row" onSubmit={onAdd}>
        <input
          aria-label="작업 이름"
          value={taskName}
          maxLength={40}
          onChange={(event) => setTaskName(event.target.value)}
        />
        <button type="submit" disabled={timer.busy}>
          작업 추가
        </button>
      </form>

      <ul className="task-list">
        {timer.tasks.length === 0 ? <li className="task-empty">작업 없음</li> : null}
        {timer.tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              className={task.id === timer.selectedId ? 'task is-selected' : 'task'}
              onClick={() => void timer.selectTask(task.id)}
            >
              <span className="task-name">
                {timer.runningTaskId === task.id ? '▶ ' : ''}
                {task.name}
              </span>
              <span className="task-time">{timer.totalFor(task.id)}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="clock">
        <span className="clock-status">{STATUS[timer.phase]}</span>
        <span className="clock-time">{timer.selectedId ? timer.clock : '--:--:--'}</span>
      </p>

      <div className="panel-actions">
        <button type="button" disabled={!timer.selectedId || timer.phase === 'running' || timer.busy} onClick={() => void timer.start()}>
          시작
        </button>
        <button type="button" disabled={timer.phase !== 'running' || timer.busy} onClick={() => void timer.pause()}>
          일시정지
        </button>
        <button type="button" disabled={timer.phase === 'idle' || timer.busy} onClick={() => void timer.stop()}>
          종료
        </button>
      </div>

      <div className="panel-actions">
        {timer.signedIn && timer.pendingLocal ? (
          <button type="button" disabled={timer.busy} onClick={() => void timer.migrate()}>
            기록 옮기기
          </button>
        ) : null}
        <button type="button" onClick={timer.exportJson}>
          내보내기
        </button>
      </div>

      {timer.notice ? <p className="panel-note">{timer.notice}</p> : null}
      {timer.error ? <p className="panel-error">{timer.error}</p> : null}
    </aside>
  )
}
