// The whole plan: search it, open any day to tick or edit, see what's pending, and undo changes.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { DayPill } from '../../components/ui'
import { fmt, fmtShort } from '../../lib/dates'
import { dayProgress, pending, searchDays, tasksOf, timeline, pretty } from '../../lib/schedule'
import type { StudyDay } from '../../lib/types'
import DaySheet from './DaySheet'

type Tab = 'plan' | 'pending' | 'changes'

export default function Planner() {
  const { days, today, events, versions, restoreVersion, profile, tickTask, moveTask, dismissTask, dismissMany } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'plan'
  const openDay = days.find(d => d.day === params.get('day')) ?? null
  const set = (k: string, v: string | null) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const joined = profile?.onboarded_at?.slice(0, 10) ?? today
  const backlog = pending(days, events, today, joined)
  const start = profile?.day_start ?? '08:00'

  const weeks = useMemo(() => {
    const out: { label: string; list: StudyDay[] }[] = []
    days.forEach((d, i) => { const w = Math.floor(i / 7); (out[w] ??= { label: '', list: [] }).list.push(d) })
    out.forEach((w, i) => { w.label = `Week ${i + 1}: ${fmt(w.list[0].day, { day: 'numeric', month: 'short' })} to ${fmt(w.list.at(-1)!.day, { day: 'numeric', month: 'short' })}` })
    return out
  }, [days])
  const curWeek = Math.max(0, weeks.findIndex(w => w.list.some(d => d.day >= today)))
  const results = q.trim() ? searchDays(q, days) : null

  const status = (d: StudyDay) => {
    const p = dayProgress(d, events)
    if (d.day === today) return { text: `Today, ${p.done} of ${p.total} done`, tone: 'text-rose' }
    if (d.day > today) return { text: p.done ? `${p.done} of ${p.total} done` : '', tone: 'text-muted' }
    if (d.day < joined) return { text: '', tone: 'text-muted' }
    return p.done === p.total ? { text: 'All done', tone: 'text-rest-fg' } : { text: `${p.total - p.done} pending`, tone: 'text-exam-fg' }
  }
  const DayCard = ({ d }: { d: StudyDay }) => {
    const s = status(d)
    const first = timeline(tasksOf(d), d.start_time ?? start).filter(t => t.kind !== 'break').slice(0, 2)
    return (
      <button type="button" onClick={() => set('day', d.day)} className={`card grid w-full grid-cols-[52px_minmax(0,1fr)] gap-3 p-3.5 text-left hover:border-rose ${d.day === today ? 'border-2 border-rose' : ''}`}>
        <span className="text-center"><span className="block text-sm text-muted">{fmt(d.day, { weekday: 'short' })}</span><span className="block text-[22px] font-bold">{fmt(d.day, { day: 'numeric' })}</span></span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"><DayPill mode={d.mode} /><span className={`text-sm font-semibold ${s.tone}`}>{s.text}</span></span>
          <span className="text-[17px] font-semibold">{d.topic}</span>
          <span className="hint">{first.map(t => `${pretty(t.start)} ${t.title}`).join(' · ')}</span>
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">Your plan</h1><p className="m-0 text-muted">{days.length} days. You're in charge: tap any day to tick, edit or move it.</p></div>
        <button type="button" className="no-print btn-secondary" onClick={() => { set('tab', null); setAll(true); setTimeout(() => window.print(), 80) }}>Print or save PDF</button>
      </header>
      <div className="no-print"><label htmlFor="ps" className="sr-only">Search the plan</label>
        <input id="ps" type="search" className="input" placeholder="Search: a topic, Anki, Mehlman…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {!results && <div role="tablist" aria-label="Planner views" className="no-print grid grid-cols-3 gap-1 rounded-full bg-rose-soft p-1">
        {([['plan', 'Plan'], ['pending', `Pending (${backlog.length})`], ['changes', `Changes (${versions.filter(v => v.reason !== 'Starting plan').length})`]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => set('tab', k === 'plan' ? null : k)}
            className={`min-h-11 rounded-full border-0 px-2 text-[15px] font-semibold ${tab === k ? 'bg-surface text-ink' : 'bg-transparent text-muted'}`}>{label}</button>))}
      </div>}

      {results && <section className="flex flex-col gap-2.5" aria-live="polite">
        <p className="m-0 text-muted">{results.length} day{results.length === 1 ? '' : 's'} match "{q}"</p>
        {results.map(d => <DayCard key={d.id} d={d} />)}
      </section>}

      {!results && tab === 'plan' && <>
        {(all ? weeks : weeks.slice(curWeek, curWeek + 2)).map(w => (
          <section key={w.label} className="flex flex-col gap-2.5">
            <h2 className="h2 m-0">{w.label}</h2>
            <div className="grid gap-2.5 lg:grid-cols-2">{w.list.map(d => <DayCard key={d.id} d={d} />)}</div>
          </section>))}
        <button type="button" className="no-print btn-secondary self-start" onClick={() => setAll(a => !a)}>{all ? 'Show this week only' : 'Show all weeks'}</button>
      </>}

      {!results && tab === 'pending' && <section className="flex flex-col gap-3">
        {backlog.length === 0 && <p className="card m-0">Nothing pending. Everything from earlier days is ticked, moved or let go.</p>}
        {backlog.length > 0 && <p className="hint m-0">Things from earlier days that aren't ticked. Tick what you did, move what you still want to do, let go of the rest.</p>}
        {[...new Set(backlog.map(p => p.day.day))].map(date => {
          const items = backlog.filter(p => p.day.day === date); const d = items[0].day
          return (
            <details key={date} open={items.length <= 3} className="card p-0">
              <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span><b>{fmtShort(date)}</b><span className="text-muted">: {d.topic}</span></span><span className="text-sm font-semibold text-exam-fg">{items.length} pending</span>
              </summary>
              <div className="flex flex-col gap-2.5 border-t border-line p-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary min-h-11 text-sm" onClick={async () => { for (const i of items) await tickTask(d, i.task.id) }}>I did all of these</button>
                  <button type="button" className="btn-secondary min-h-11 text-sm" onClick={() => dismissMany(d, items.map(i => i.task.id))}>Let all of these go</button>
                </div>
                {items.map(({ task }) => <PendingRow key={task.id} day={d} task={task} days={days} today={today}
                  onTick={() => tickTask(d, task.id)} onMove={to => moveTask(d, task, to)} onDismiss={() => dismissTask(d, task, true)} />)}
              </div>
            </details>)
        })}
      </section>}

      {!results && tab === 'changes' && <section className="flex flex-col gap-2">
        {versions.filter(v => v.reason !== 'Starting plan').length === 0 && <p className="card m-0">No changes yet. Every edit is listed here and can be undone.</p>}
        {versions.filter(v => v.reason !== 'Starting plan').map(v => (
          <div key={v.id} className="card flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1"><span className="block">{v.reason}</span><span className="hint">{new Date(v.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
            <button type="button" className="btn-secondary min-h-11 text-sm" onClick={() => restoreVersion(v.id)}>Undo this</button>
          </div>))}
        <p className="hint m-0">"Undo this" puts the plan back to how it was just before that change.</p>
      </section>}

      <DaySheet day={openDay} onClose={() => set('day', null)} />
    </div>
  )
}

function PendingRow({ day, task, days, today, onTick, onMove, onDismiss }: { day: StudyDay; task: { id: string; title: string; minutes: number }; days: StudyDay[]; today: string;
  onTick: () => void; onMove: (to: string) => void; onDismiss: () => void }) {
  const [to, setTo] = useState('')
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-paper p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1"><p className="m-0 font-semibold">{task.title}</p><p className="hint m-0">{task.minutes} min</p></div>
        <label className="flex size-12 shrink-0 items-center justify-center"><input type="checkbox" className="size-7 accent-rose" aria-label={`Tick off: ${task.title}`} onChange={onTick} /></label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`mv${day.day}${task.id}`} className="sr-only">Move to</label>
        <select id={`mv${day.day}${task.id}`} className="input min-h-11 min-w-0 flex-1 text-base" value={to} onChange={e => setTo(e.target.value)}>
          <option value="">Move to a day…</option>
          {days.filter(d => d.day >= today).map(d => <option key={d.id} value={d.day}>{fmtShort(d.day)}: {d.topic}</option>)}
        </select>
        <button type="button" className="btn-secondary min-h-11" disabled={!to} onClick={() => onMove(to)}>Move</button>
        <button type="button" className="btn-secondary min-h-11" onClick={onDismiss}>Let it go</button>
      </div>
    </div>
  )
}
