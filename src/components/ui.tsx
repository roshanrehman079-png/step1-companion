// Small shared building blocks. Styling comes from the classes in styles/index.css.
import { useEffect, useRef, type ReactNode } from 'react'
import { catSvgInner, type CatMood, type Stage } from './catArt'
import { DAY_TYPE } from '../content/strings'
import type { Mode } from '../lib/types'
import { useApp } from '../state/AppContext'

export function Cat({ size, mood = 'content', stage, label, react }: { size: number; mood?: CatMood; stage?: Stage; label?: string; react?: number }) {
  const { growth, catName } = useApp()
  const st = stage ?? (growth.stage.key as Stage)
  return (
    <svg key={react} role="img" aria-label={label ?? catName} width={size} height={size} viewBox="0 0 120 120"
      className={react ? 'mochi-react shrink-0' : 'shrink-0'} style={{ overflow: 'visible' }}
      dangerouslySetInnerHTML={{ __html: catSvgInner(mood, st) }} />
  )
}

/** Quiet Mochi: a small face and one short line. */
export function MochiSays({ text, mood = 'content', size = 52 }: { text: string; mood?: CatMood; size?: number }) {
  return (
    <section aria-label="Your buddy says" className="flex items-center gap-3">
      <Cat size={size} mood={mood} />
      <p className="bubble-in m-0 rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-base leading-snug">{text}</p>
    </section>
  )
}

const TONES = {
  read: 'bg-read-bg text-read-fg', q: 'bg-q-bg text-q-fg', exam: 'bg-exam-bg text-exam-fg',
  rest: 'bg-rest-bg text-rest-fg', real: 'bg-ink text-white',
} as const
export function DayPill({ mode }: { mode: Mode }) {
  const t = DAY_TYPE[mode]
  return <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${TONES[t.tone]}`}>{t.label}</span>
}

export function Bar({ pct, label, marker }: { pct: number; label: string; marker?: number }) {
  return (
    <div role="img" aria-label={label} className="bar overflow-visible">
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      {marker !== undefined && <i className="absolute -top-1.5 h-5 w-[3px] rounded bg-ink" style={{ left: `${marker}%` }} />}
    </div>
  )
}

export function Stepper({ active }: { active: number }) {
  const steps = ['Check in', 'Do', 'Wrap up']
  return (
    <div role="group" aria-label={`Today, step ${active + 1} of ${steps.length}: ${steps[active]}`} className="flex gap-1.5">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col gap-1.5">
          <div className={`h-[5px] rounded-full ${i <= active ? 'bg-rose' : 'bg-track'}`} />
          <span className={`text-[13px] ${i === active ? 'font-bold text-ink' : 'text-muted'}`}>{s}</span>
        </div>
      ))}
    </div>
  )
}

export function Counter({ label, value, onChange, step = 1, min = 0, max = 999, sub }: {
  label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; sub?: string
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3">
      <div><p className="m-0 font-semibold">{label}</p>{sub && <p className="hint m-0">{sub}</p>}</div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary w-12 px-0 text-2xl" aria-label={`Less: ${label}`} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <output aria-live="polite" className="min-w-12 text-center text-[22px] font-bold">{value}</output>
        <button type="button" className="btn-secondary w-12 px-0 text-2xl" aria-label={`More: ${label}`} onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  )
}

/** Accessible bottom sheet / dialog using the native <dialog> element. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onClose={onClose} aria-label={title}
      className="m-auto mb-0 w-full max-w-lg rounded-t-3xl border-0 bg-paper p-0 text-ink backdrop:bg-ink/40 md:mb-auto md:rounded-3xl">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="h2 m-0">{title}</h2>
          <button type="button" className="btn-secondary min-h-11 px-4 text-sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function ErrorBanner() {
  const { error, setError } = useApp()
  if (!error) return null
  return (
    <div role="alert" className="no-print fixed inset-x-3 top-3 z-50 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-white">
      <span>{error}</span>
      <button type="button" className="btn min-h-11 border border-white/40 bg-transparent px-4 text-sm text-white" onClick={() => setError(null)}>OK</button>
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <p role="status" className="p-10 text-center text-muted">{label}…</p>
}
