// Read-only view for invited family. Only fields the owner switched on ever arrive here.
// Built phone-first: one column, nothing wider than the screen.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../state/AppContext'
import { CHEERS, DAY_TYPE } from '../../content/strings'
import { catSvgInner, type Stage } from '../../components/catArt'
import { DayPill, ErrorBanner } from '../../components/ui'
import { fmtShort, weekOf } from '../../lib/dates'
import { hours, pretty } from '../../lib/schedule'
import type { Mode } from '../../lib/types'

interface GDay { day: string; mode: Mode; topic: string; done: boolean | null; progress?: { done: number; total: number }
  tasks?: { title: string; start: string; minutes: number; kind: string; optional: boolean; done: boolean; dismissed: boolean; from: string | null }[] }
interface Summary {
  name: string; cat_name: string; updated_at?: string; today?: string; cheers: boolean
  plan?: GDay[]; days?: { studied: number; planned: number }; topics?: { name: string; pct: number }[]
  pending?: { day: string; title: string }[]; changes?: { at: string; reason: string }[]
  mochi?: { stage: Stage; title: string }; countdown?: { exam: string; confirmed: boolean; daysLeft: number } | null
}
type Tab = 'week' | 'plan' | 'pending' | 'changes'

export default function Guest() {
  const { owners, signOut } = useApp()
  const [owner, setOwner] = useState(owners[0]?.owner_id)
  const [s, setS] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('week')
  const [sent, setSent] = useState<string | null>(null)
  const [myName, setMyName] = useState('')

  const load = useCallback(async () => {
    if (!owner) return
    const { data, error } = await supabase.rpc('get_supporter_summary', { p_owner: owner })
    if (error) { setErr('You no longer have access, or sharing is paused.'); setS(null) } else { setErr(null); setS(data as Summary) }
  }, [owner])
  useEffect(() => { load() }, [load])

  const cheer = async (m: string) => {
    const { error } = await supabase.rpc('send_cheer', { p_owner: owner, p_message: m, p_from_name: myName })
    setSent(error ? (error.message.includes('too many') ? "That's plenty of cheers for today." : 'Could not send. Try later.') : `Sent "${m}". She'll see it next time she opens the app.`)
  }
  const today = s?.today ?? new Date().toISOString().slice(0, 10)
  const week = weekOf(today)
  const plan = s?.plan ?? []
  const tabs: [Tab, string][] = [['week', 'This week'], ...(plan.length ? [['plan', 'Full plan'] as [Tab, string]] : []),
    ...(s?.pending ? [['pending', `Pending (${s.pending.length})`] as [Tab, string]] : []), ...(s?.changes ? [['changes', 'Changes'] as [Tab, string]] : [])]

  return (
    <div className="min-h-dvh overflow-x-clip">
      <ErrorBanner />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 md:px-10 md:py-10">
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0"><p className="hint m-0">Shared with you. View only.</p>
            <h1 className="h1 break-words md:text-4xl">How {s?.name ?? owners[0]?.name ?? 'she'} is doing</h1></div>
          <div className="flex flex-wrap gap-2">
            {owners.length > 1 && <select aria-label="Whose progress" className="input min-h-11 w-auto max-w-full" value={owner} onChange={e => setOwner(e.target.value)}>{owners.map(o => <option key={o.owner_id} value={o.owner_id}>{o.name}</option>)}</select>}
            <button type="button" className="btn-secondary min-h-11 text-sm" onClick={load}>Refresh</button>
            <button type="button" className="btn-secondary min-h-11 text-sm" onClick={signOut}>Sign out</button>
          </div>
        </header>
        {err && <p role="alert" className="card m-0">{err}</p>}
        {s && <>
          {(s.days || s.countdown) && <section className="rounded-2xl bg-rose-soft px-4 py-3.5 text-[17px] md:text-lg">
            {s.days && <>She studied <b>{s.days.studied} of {s.days.planned}</b> planned days so far this week. </>}
            {s.countdown && <>The exam is <b>{s.countdown.daysLeft} days</b> away{s.countdown.confirmed ? '' : ' (date not booked yet)'}.</>}
          </section>}

          {tabs.length > 1 && <div role="tablist" aria-label="Views" className="grid grid-cols-2 gap-1 rounded-3xl bg-rose-soft p-1 sm:flex sm:rounded-full">
            {tabs.map(([k, label]) => <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`min-h-11 grow rounded-full border-0 px-3 text-[15px] font-semibold ${tab === k ? 'bg-surface text-ink' : 'bg-transparent text-muted'}`}>{label}</button>)}
          </div>}

          {tab === 'week' && <div className="grid gap-4 md:grid-cols-2">
            {s.mochi && <section className="card flex items-center gap-3">
              <svg role="img" aria-label={`${s.cat_name}, ${s.mochi.title}`} width="88" height="88" viewBox="0 0 120 120" className="shrink-0" dangerouslySetInnerHTML={{ __html: catSvgInner('happy', s.mochi.stage) }} />
              <div className="min-w-0"><h2 className="h2 m-0">{s.cat_name} is a {s.mochi.title}</h2><p className="m-0 text-[15px] text-muted">Her buddy grows when she shows up, reviews mistakes and rests.</p></div></section>}
            {plan.length > 0 && <section className="card min-w-0"><h2 className="h2 m-0 mb-1">This week</h2>
              {plan.filter(d => week.includes(d.day)).map(d => <DayRow key={d.day} d={d} today={today} />)}</section>}
            {s.topics && <section className="card min-w-0"><h2 className="h2 m-0 mb-2">Chapters covered</h2>
              {s.topics.map(t => <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_72px_40px] items-center gap-2 py-1.5"><span className="truncate">{t.name}</span>
                <span className="bar h-2" role="img" aria-label={`${t.name} ${t.pct}%`}><span style={{ width: `${t.pct}%` }} /></span><span className="text-right text-muted">{t.pct}%</span></div>)}</section>}
            {s.cheers && <section className="card flex min-w-0 flex-col gap-3"><h2 className="h2 m-0">Send a cheer</h2>
              <div><label htmlFor="mn" className="label">Your name</label><input id="mn" className="input" value={myName} onChange={e => setMyName(e.target.value)} placeholder="e.g. Mum" /></div>
              <div className="flex flex-wrap gap-2">{CHEERS.map(c => <button key={c} type="button" className="chip" onClick={() => cheer(c)}>{c}</button>)}</div>
              {sent && <p role="status" className="m-0 text-rest-fg">{sent}</p>}</section>}
          </div>}

          {tab === 'plan' && <section className="card min-w-0">{plan.map(d => <DayRow key={d.day} d={d} today={today} />)}</section>}

          {tab === 'pending' && <section className="card min-w-0">
            {!s.pending?.length && <p className="m-0">Nothing pending. All caught up.</p>}
            {s.pending?.map((p, i) => <div key={i} className="border-t border-line py-2.5 first:border-t-0"><p className="m-0">{p.title}</p><p className="hint m-0">From {fmtShort(p.day)}</p></div>)}
          </section>}

          {tab === 'changes' && <section className="card min-w-0">
            {!s.changes?.length && <p className="m-0">No changes to the plan yet.</p>}
            {s.changes?.map((c, i) => <div key={i} className="border-t border-line py-2.5 first:border-t-0"><p className="m-0">{c.reason}</p>
              <p className="hint m-0">{new Date(c.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>)}
          </section>}

          <p className="hint m-0">Mood, notes, exam scores and water always stay private.{s.updated_at ? ` Updated ${new Date(s.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.` : ''}</p>
        </>}
      </main>
    </div>
  )
}

function DayRow({ d, today }: { d: GDay; today: string }) {
  const p = d.progress
  const label = !p || !p.total ? '' : d.day > today && !p.done ? '' : p.done === p.total ? 'All done' : `${p.done} of ${p.total} done`
  return (
    <details className="border-t border-line first:border-t-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 py-2">
        <span className={`w-[74px] shrink-0 text-[15px] ${d.day === today ? 'font-bold text-rose' : 'text-muted'}`}>{d.day === today ? 'Today' : fmtShort(d.day).replace(/^\w+ /, m => m)}</span>
        <span className="min-w-0 flex-1"><span className="block break-words">{d.topic}</span><span className="sr-only">{DAY_TYPE[d.mode].label}</span>
          <span className="hidden sm:inline"><DayPill mode={d.mode} /></span></span>
        <span className={`shrink-0 text-sm font-semibold ${label === 'All done' ? 'text-rest-fg' : 'text-muted'}`}>{label}</span>
      </summary>
      {d.tasks && <ul className="m-0 mb-2 list-none rounded-xl bg-paper p-2">
        {d.tasks.filter(t => t.kind !== 'break').map((t, i) => (
          <li key={i} className="flex items-start gap-2 py-1 text-[15px]">
            <span aria-hidden className={`mt-0.5 shrink-0 ${t.done ? 'text-rest-fg' : 'text-field'}`}>{t.done ? '✓' : '○'}</span>
            <span className="w-16 shrink-0 tabular-nums text-muted">{pretty(t.start)}</span>
            <span className={`min-w-0 flex-1 break-words ${t.dismissed ? 'text-muted line-through' : ''}`}>{t.title}{t.optional ? ' (optional)' : ''}<span className="text-muted">, {hours(t.minutes)}</span>
              <span className="sr-only">{t.done ? ', done' : ', not done'}</span></span>
          </li>))}
      </ul>}
    </details>
  )
}
