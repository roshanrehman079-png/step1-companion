// The whole plan at a glance. Table on desktop, cards on phone. Printable.
import { useMemo, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { DayPill, Sheet } from '../../components/ui'
import { fmt, fmtShort } from '../../lib/dates'
import { onDate } from '../../lib/progress'
import type { StudyDay } from '../../lib/types'
import plan from '../../data/plan.json'

const goalText = (d: StudyDay) => ({
  QUESTION: `${d.q_core} questions`, BOOK: `Reach ${d.book_target_pct ?? 100}%`, NBME: 'One sitting, timed', 'FREE 120': 'Timed sample',
  'NBME REVIEW': 'Review only', 'FREE 120 REVIEW': 'Review only', RECOVERY: 'Rest first', TAPER: 'No new material', EXAM: 'Exam',
}[d.mode])

export default function Planner() {
  const { days, today, events, versions, restoreVersion, profile } = useApp()
  const joined = profile?.onboarded_at?.slice(0, 10) ?? today
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<StudyDay | null>(null)
  const [hist, setHist] = useState(false)
  const status = (d: StudyDay) => d.day === today ? 'Today' : d.day < today ? (onDate(events, d.day).length ? 'Done' : d.day >= joined ? 'Skipped, that\'s okay' : '') : ''
  const weeks = useMemo(() => {
    const out: { label: string; list: StudyDay[] }[] = []
    days.forEach((d, i) => { const w = Math.floor(i / 7); (out[w] ??= { label: '', list: [] }).list.push(d) })
    out.forEach((w, i) => { w.label = `Week ${i + 1}: ${fmt(w.list[0].day, { day: 'numeric', month: 'short' })} to ${fmt(w.list.at(-1)!.day, { day: 'numeric', month: 'short' })}` })
    return out
  }, [days])
  const curWeek = Math.max(0, weeks.findIndex(w => w.list.some(d => d.day >= today)))
  const shown = all ? weeks : weeks.slice(curWeek, curWeek + 2)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">Your {plan.days.length}-day plan</h1><p className="m-0 text-muted">Lost? Find today and do just that.</p></div>
        <div className="no-print flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setAll(a => !a)}>{all ? 'Show this week' : 'Show all weeks'}</button>
          <button type="button" className="btn-secondary" onClick={() => { setAll(true); setTimeout(() => window.print(), 50) }}>Print or save PDF</button>
        </div>
      </header>
      {shown.map(w => (
        <section key={w.label} className="flex flex-col gap-2.5">
          <h2 className="h2 m-0">{w.label}</h2>
          {/* phone */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {w.list.map(d => (
              <button key={d.id} type="button" onClick={() => setOpen(d)} className={`card grid grid-cols-[52px_1fr] gap-3 p-3.5 text-left ${d.day === today ? 'border-2 border-rose' : ''}`}>
                <span className="text-center"><span className="block text-sm text-muted">{fmt(d.day, { weekday: 'short' })}</span><span className="block text-[22px] font-bold">{fmt(d.day, { day: 'numeric' })}</span></span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center justify-between gap-2"><DayPill mode={d.mode} /><span className={`text-sm font-semibold ${d.day === today ? 'text-rose' : 'text-muted'}`}>{status(d)}</span></span>
                  <span className="text-[17px] font-semibold">{d.topic}</span><span className="hint">{goalText(d)}</span>
                </span>
              </button>
            ))}
          </div>
          {/* desktop / print */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block print:block">
            <table className="w-full border-collapse text-left text-[16px]">
              <caption className="sr-only">{w.label}</caption>
              <thead><tr className="text-sm text-muted">{['Date', 'Type', 'Focus', 'What to do', 'Goal', ''].map(h => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody>{w.list.map(d => (
                <tr key={d.id} className={`border-t border-line align-top ${d.day === today ? 'bg-rose-soft' : ''}`}>
                  <td className="whitespace-nowrap px-4 py-3.5 font-medium">{fmtShort(d.day)}</td>
                  <td className="px-4 py-3.5"><DayPill mode={d.mode} /></td>
                  <td className="px-4 py-3.5 font-semibold">{d.topic}</td>
                  <td className="px-4 py-3.5 text-muted">{d.instructions}{d.extra.carry?.map(c => <span key={c.from} className="mt-1 block text-rose-dark">Optional extra: {c.pct}% from {fmtShort(c.from)}</span>)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5">{goalText(d)}</td>
                  <td className={`px-4 py-3.5 text-sm font-semibold ${d.day === today ? 'text-rose' : 'text-muted'}`}>{status(d)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>
      ))}
      <section className="no-print card flex flex-col gap-2">
        <button type="button" className="btn-text justify-start px-0" onClick={() => setHist(h => !h)} aria-expanded={hist}>Plan history ({versions.length})</button>
        {hist && versions.map(v => (
          <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
            <span><span className="block">{v.reason}</span><span className="hint">{new Date(v.created_at).toLocaleString('en-GB')}</span></span>
            <button type="button" className="btn-secondary min-h-11 text-sm" onClick={() => restoreVersion(v.id)}>Restore this</button>
          </div>))}
      </section>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? fmtShort(open.day) : ''}>
        {open && <>
          <DayPill mode={open.mode} />
          <p className="m-0 text-xl font-bold">{open.topic}</p>
          <p className="m-0">{open.instructions}</p>
          <p className="m-0 text-muted">Goal: {goalText(open)}{open.locked ? '. This date is fixed and never moves on its own.' : ''}</p>
        </>}
      </Sheet>
    </div>
  )
}
