// Full-screen focus timer. The buddy stays silent; nav and messages are hidden.
import { useEffect, useRef, useState } from 'react'
import { Cat } from '../../components/ui'

export default function FocusTimer({ minutes, title, onDone, onExit }: { minutes: number; title: string; onDone: () => void; onExit: () => void }) {
  const total = minutes * 60
  const [left, setLeft] = useState(total)
  const [paused, setPaused] = useState(false)
  const endAt = useRef(Date.now() + total * 1000)

  useEffect(() => {
    if (paused) return
    endAt.current = Date.now() + left * 1000
    const t = setInterval(() => setLeft(Math.max(0, Math.round((endAt.current - Date.now()) / 1000))), 500)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0')
  const C = 2 * Math.PI * 104, frac = left / total
  return (
    <div role="dialog" aria-modal="true" aria-label="Focus session" className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-paper px-6">
      <p className="hint m-0 text-[15px]">Focus session</p>
      <h1 className="h1 max-w-md text-center">{title}</h1>
      <div className="relative size-[232px]">
        <svg aria-hidden width="232" height="232" viewBox="0 0 232 232">
          <circle cx="116" cy="116" r="104" fill="none" stroke="var(--color-rose-soft)" strokeWidth="12" />
          <circle cx="116" cy="116" r="104" fill="none" stroke="var(--color-rose)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 116 116)" />
        </svg>
        <div role="timer" aria-live="off" className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[52px] font-bold tracking-tight">{mm}:{ss}</span>
          <span className="hint">{left === 0 ? "Time's up" : paused ? 'Paused' : `of ${minutes} min`}</span>
        </div>
      </div>
      <div className="flex items-center gap-2"><Cat size={32} mood="focus" label="Your buddy studying quietly" /><p className="hint m-0">Studying quietly with you. No messages until you're done.</p></div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => setPaused(p => !p)} disabled={left === 0}>{paused ? 'Resume' : 'Pause'}</button>
        <button type="button" className="btn-primary" onClick={onDone}>I'm done</button>
      </div>
      <button type="button" className="btn-text" onClick={onExit}>Leave without finishing</button>
    </div>
  )
}
