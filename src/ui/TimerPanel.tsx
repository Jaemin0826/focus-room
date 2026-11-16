import { useEffect, useRef, useState, type FormEvent } from 'react'
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
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const timelineRef = useRef<HTMLDivElement>(null)

  const onLogin = (event: FormEvent) => {
    event.preventDefault()
    void timer.signIn(loginName, pin)
  }

  useEffect(() => {
    const node = timelineRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [timer.timeline])

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
            {task.id === timer.selectedId ? (
              <div className="timeline" ref={timelineRef}>
                {timer.timeline.length === 0 ? <p className="timeline-empty">기록 없음</p> : null}
                {timer.timeline.map((day) => (
                  <section key={day.key}>
                    <h3>{day.label}</h3>
                    <ul>
                      {day.items.map((item) => (
                        <li key={item.id} className={item.kind === 'milestone' ? 'is-milestone' : undefined}>
                          <span>{item.text}</span>
                          {item.milestoneId ? (
                            <button type="button" disabled={timer.busy} onClick={() => void timer.deleteMilestone(item.milestoneId!)}>
                              삭제
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}
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

      {timer.selectedId ? (
        noteOpen ? (
          <form
            className="panel-row"
            onSubmit={(event) => {
              event.preventDefault()
              void timer.addMilestone(note).then((saved) => {
                if (saved) {
                  setNote('')
                  setNoteOpen(false)
                }
              })
            }}
          >
            <input
              aria-label="완료한 일"
              value={note}
              maxLength={80}
              onChange={(event) => setNote(event.target.value)}
            />
            <button type="submit" disabled={timer.busy}>
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setNoteOpen(false)
                setNote('')
              }}
            >
              취소
            </button>
          </form>
        ) : (
          <div className="panel-actions">
            <button type="button" onClick={() => setNoteOpen(true)}>
              + 완료
            </button>
          </div>
        )
      ) : null}

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
