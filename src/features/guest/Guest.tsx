// Read-only view for invited family. Only fields the owner switched on ever arrive here.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../state/AppContext'
import { CHEERS, DAY_TYPE } from '../../content/strings'
import { catSvgInner, type Stage } from '../../components/catArt'
import { DayPill, ErrorBanner } from '../../components/ui'
import { fmtShort } from '../../lib/dates'
import type { Mode } from '../../lib/types'

interface Summary {
  name: string; cat_name: string; updated_at?: string; cheers: boolean
  plan?: { day: string; mode: Mode; topic: string; done: boolean | null }[]
  days?: { studied: number; planned: number }
  topics?: { name: string; pct: number }[]
  mochi?: { stage: Stage; title: string }
  countdown?: { exam: string; confirmed: boolean; daysLeft: number } | null
}

export default function Guest() {
  const { owners, signOut } = useApp()
  const [owner, setOwner] = useState(owners[0]?.owner_id)
  const [s, setS] = useState<Summary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [myName, setMyName] = useState('')

  const load = useCallback(async () => {
    if (!owner) return
    const { data, error } = await supabase.rpc('get_supporter_summary', { p_owner: owner })
    if (error) { setErr('You no longer have access, or the link was paused.'); setS(null) } else { setErr(null); setS(data as Summary) }
  }, [owner])
  useEffect(() => { load() }, [load])

  const cheer = async (m: string) => {
    const { error } = await supabase.rpc('send_cheer', { p_owner: owner, p_message: m, p_from_name: myName })
    setSent(error ? (error.message.includes('too many') ? "That's plenty of cheers for today." : 'Could not send. Try later.') : `Sent "${m}". She'll see it with her buddy.`)
  }

  return (
    <div className="min-h-dvh">
      <ErrorBanner />
      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-6 md:px-10 md:py-10">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="hint m-0">Shared with you. View only.</p><h1 className="h1 md:text-4xl">How {s?.name ?? owners[0]?.name ?? 'she'} is doing</h1></div>
          <div className="flex gap-2">
            {owners.length > 1 && <select aria-label="Whose progress" className="input min-h-11 w-auto" value={owner} onChange={e => setOwner(e.target.value)}>{owners.map(o => <option key={o.owner_id} value={o.owner_id}>{o.name}</option>)}</select>}
            <button type="button" className="btn-secondary min-h-11 text-sm" onClick={load}>Refresh</button>
            <button type="button" className="btn-secondary min-h-11 text-sm" onClick={signOut}>Sign out</button>
          </div>
        </header>
        {err && <p role="alert" className="card m-0">{err}</p>}
        {s && <>
          {(s.days || s.countdown) && <section className="rounded-2xl bg-rose-soft px-5 py-4 text-lg">
            {s.days && <>She studied <b>{s.days.studied} of {s.days.planned}</b> planned days so far this week. </>}
            {s.countdown && <>The exam is <b>{s.countdown.daysLeft} days</b> away{s.countdown.confirmed ? '' : ' (date not booked yet)'}.</>}
          </section>}
          <div className="grid gap-4 md:grid-cols-2">
            {s.mochi && <section className="card flex items-center gap-4">
              <svg role="img" aria-label={`${s.cat_name}, ${s.mochi.title}`} width="104" height="104" viewBox="0 0 120 120" className="shrink-0" dangerouslySetInnerHTML={{ __html: catSvgInner('happy', s.mochi.stage) }} />
              <div><h2 className="h2 m-0">{s.cat_name} is a {s.mochi.title}</h2><p className="m-0 text-muted">Her buddy grows when she shows up, reviews mistakes and rests.</p></div></section>}
            {s.plan && <section className="card"><h2 className="h2 m-0 mb-2">This week's plan</h2>
              {s.plan.map(d => <div key={d.day} className="flex min-h-12 items-center gap-3 border-t border-line py-1.5">
                <span className="w-24 shrink-0 text-muted">{fmtShort(d.day)}</span><span className="flex-1">{d.topic}<span className="sr-only"> ({DAY_TYPE[d.mode].label})</span></span>
                <span className="hidden md:inline"><DayPill mode={d.mode} /></span>
                <span className="text-sm font-semibold text-muted">{d.done === true ? 'Done' : ''}</span></div>)}</section>}
            {s.topics && <section className="card"><h2 className="h2 m-0 mb-2">Chapters covered</h2>
              {s.topics.map(t => <div key={t.name} className="grid grid-cols-[1fr_96px_44px] items-center gap-3 py-1.5"><span>{t.name}</span>
                <span className="bar h-2" role="img" aria-label={`${t.name} ${t.pct}%`}><span style={{ width: `${t.pct}%` }} /></span><span className="text-right text-muted">{t.pct}%</span></div>)}</section>}
            {s.cheers && <section className="card flex flex-col gap-3"><h2 className="h2 m-0">Send a cheer</h2>
              <div><label htmlFor="mn" className="label">Your name</label><input id="mn" className="input" value={myName} onChange={e => setMyName(e.target.value)} placeholder="e.g. Mum" /></div>
              <div className="flex flex-wrap gap-2">{CHEERS.map(c => <button key={c} type="button" className="chip" onClick={() => cheer(c)}>{c}</button>)}</div>
              {sent && <p role="status" className="m-0 text-rest-fg">{sent}</p>}</section>}
          </div>
          <p className="hint m-0">Mood, notes, exam scores and water always stay private.{s.updated_at ? ` Updated ${new Date(s.updated_at).toLocaleString('en-GB')}.` : ''}</p>
        </>}
      </main>
    </div>
  )
}
