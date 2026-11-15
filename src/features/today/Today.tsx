// Today: Check in -> Do (one numbered list) -> Wrap up. The heart of the app.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { DayPill, MochiSays, Stepper, Bar } from '../../components/ui'
import { MOODS } from '../../content/strings'
import { line } from '../../content/mochi'
import { tasksOf, timeline, ticked, pending, pretty, hours, type Timed } from '../../lib/schedule'
import { addDays, daysBetween, fmtLong, fmtShort } from '../../lib/dates'
import { goalFor, moodOn, onDate, questionTotals, waterOn, bookPercents, live } from '../../lib/progress'
import type { Mood, StudyDay } from '../../lib/types'
import FocusTimer from './FocusTimer'
import { BirthdayBanner } from '../birthday/Birthday'
import LogSheet, { type LogKind } from './LogSheet'
import WrapUp from './WrapUp'
import plan from '../../data/plan.json'

const DAY_LINE = { QUESTION: 'practiceDay', BOOK: 'readingDay', NBME: 'examDay', 'FREE 120': 'examDay',
  'NBME REVIEW': 'reviewDay', 'FREE 120 REVIEW': 'reviewDay', RECOVERY: 'recoveryDay', TAPER: 'recoveryDay', EXAM: 'examDay' } as const
const subjectName = (id: string) => (plan.subjects as { id: string; name: string }[]).find(s => s.id === id)?.name ?? id

export default function Today() {
  const app = useApp()
  const { days, events, today, profile, logEvent, voidEvent, say, catName, cheers, markCheersSeen } = app
  const day = days.find(d => d.day === today)
  const mood = moodOn(events, today)
  const todays = onDate(events, today)
  const wrapped = todays.some(e => e.kind === 'wrap')
  const [wrapOpen, setWrapOpen] = useState(false)

  // Gentle moments: cheers from family, one nudge after 2 pm if nothing started.
  useEffect(() => {
    const unseen = cheers.filter(c => !c.seen)
    if (unseen.length) { say('cheer', 'happy', { from: unseen[0].from_name || 'Someone', message: unseen[0].message }, true); markCheersSeen(); return }
    const key = `nudged-${today}`
    if (mood && mood !== 'rest' && !wrapped && new Date().getHours() >= 14 && !todays.some(e => e.kind === 'step') && !localStorage.getItem(key)) {
      localStorage.setItem(key, '1'); say('nudge', 'nudge')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!profile) return null
  if (!day) return <NoPlanDay />

  const lastActive = live(events).filter(e => e.local_date < today).map(e => e.local_date).sort().at(-1)
  const away = lastActive ? daysBetween(lastActive, today) > 1 : false
  const header = (
    <header className="flex flex-col gap-1">
      <p className="hint m-0">{fmtLong(today)}, day {daysBetween(plan.startDate, today) + 1} of {plan.days.length}</p>
      <h1 className="h1">{greeting()}, {profile.display_name || 'Azka'}</h1>
      <BirthdayBanner />
    </header>
  )

  // ---------- 1. Check in ----------
  if (!mood) {
    const pick = async (m: Mood) => { if (await logEvent('checkin', { mood: m })) say(m, m === 'overwhelmed' ? 'content' : 'happy') }
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Stepper active={0} />
        <MochiSays text={line(away ? 'welcomeBack' : 'morning', { name: profile.display_name })} mood={away ? 'wistful' : 'content'} />
        <p className="hint m-0">Your answer only changes how big today feels, never what kind of day it is.</p>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {MOODS.map(m => (
            <button key={m.id} type="button" onClick={() => pick(m.id)} className="card flex min-h-[76px] flex-col items-start gap-0.5 p-3.5 text-left hover:border-rose">
              <span className="text-[17px] font-semibold">{m.label}</span><span className="text-sm text-muted">{m.hint}</span>
            </button>
          ))}
        </div>
        {!day.locked && <button type="button" className="btn-secondary" onClick={async () => { if (await logEvent('rest', {})) say('rest', 'rest', {}, true) }}>Take a rest day</button>}
        <button type="button" className="btn-text self-center" onClick={() => logEvent('checkin', { mood: 'okay', skipped: true })}>Skip check-in</button>
      </div>
    )
  }

  // ---------- Rest day ----------
  if (mood === 'rest') {
    const restEv = todays.find(e => e.kind === 'rest')
    return (
      <div className="flex flex-col gap-5">
        {header}
        <MochiSays text={line('rest')} mood="rest" size={72} />
        <section className="rounded-2xl bg-rest-bg p-4 text-rest-fg">
          <p className="m-0 font-semibold">Rest day saved.</p>
          <p className="m-0">Nothing gets added to tomorrow. Today's plan stays in the planner if you want to look.</p>
        </section>
        <WaterCard />
        {restEv && <button type="button" className="btn-secondary" onClick={() => voidEvent(restEv.id)}>I changed my mind, check in instead</button>}
      </div>
    )
  }

  if (wrapped && !wrapOpen) return <DayDone day={day} />
  if (wrapOpen) return <WrapUp day={day} onBack={() => setWrapOpen(false)} />

  // ---------- 2. Do ----------
  return <DoStep day={day} mood={mood} header={header} onFinish={() => setWrapOpen(true)} catName={catName} />
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function DoStep({ day, mood, header, onFinish, catName }: { day: StudyDay; mood: Mood; header: React.ReactNode; onFinish: () => void; catName: string }) {
  const { events, profile, today, days, tickTask, untickTask, say, setFocusMode, addNote, logEvent } = useApp()
  const goal = goalFor(day, mood, events, profile!.daily_hours, profile!.qbank_start)
  const tl = timeline(tasksOf(day), day.start_time ?? profile!.day_start ?? '08:00')
  const done = ticked(events, day.day)
  // Mood makes blocks beyond today's smaller goal optional (display only; the plan itself doesn't change).
  const blocksToday = goal.kind === 'questions' ? Math.ceil(goal.target / 20) : 99
  let blockN = 0
  const shown = tl.map(t => { if (t.kind === 'block') blockN++; return { ...t, optionalToday: t.optional || (t.kind === 'block' && blockN > blocksToday) } })
  const current = shown.find(t => t.kind !== 'break' && !t.optionalToday && !done.has(t.id))
  const [focus, setFocus] = useState<{ id: string; minutes: number; title: string } | null>(null)
  const [log, setLog] = useState<{ id: string; kind: LogKind } | null>(null)
  const fresh = onDate(events, today).filter(e => e.kind === 'qblock').reduce((a, e) => a + Number(e.payload.fresh || 0), 0)
  const bookNow = day.book_subject ? bookPercents(events)[day.book_subject] ?? 0 : 0
  const backlog = pending(days, events, today, profile!.onboarded_at?.slice(0, 10) ?? today)
  const req = shown.filter(t => t.kind !== 'break' && !t.optionalToday)
  const doneN = req.filter(t => done.has(t.id)).length

  const complete = (t: Timed) => {
    setFocus(null); setFocusMode(false)
    if (['block', 'read', 'review', 'notes', 'score'].includes(t.kind)) setLog({ id: t.id, kind: t.kind as LogKind })
    else markDone(t.id)
  }
  const markDone = async (id: string) => { if (await tickTask(day, id)) say('logged', 'happy') }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <Stepper active={1} />
      <MochiSays text={line(DAY_LINE[day.mode])} mood="happy" />
      {backlog.length > 0 && <Link to="/planner?tab=pending" className="card flex items-center justify-between gap-3 border-exam-fg/30 bg-exam-bg text-ink no-underline">
        <span><b className="block">{backlog.length} pending from earlier days</b><span className="text-[15px]">Tick them off, move them, or let them go.</span></span><span className="btn-secondary min-h-11 px-4 text-sm">Review</span></Link>}
      <section aria-label="Today's plan" className="card flex flex-col gap-3 md:p-6">
        <div className="flex items-center justify-between gap-2"><DayPill mode={day.mode} /><span className="hint">{doneN} of {req.length} done</span></div>
        <h2 className="m-0 text-[22px] font-bold leading-tight">{day.topic}</h2>
        {goal.kind === 'questions' && <p className="m-0 text-muted">Goal today: <b className="text-ink">{goal.target ? `${goal.target} new questions` : 'one gentle block, or rest'}</b>{goal.target < day.q_core && ` (smaller because you're ${mood}, extra blocks are optional)`}. Done so far: <b className="text-ink">{fresh}</b>.</p>}
        {goal.kind === 'book' && <>
          <p className="m-0 text-muted">Goal today: reach <b className="text-ink">{goal.target}%</b> of {subjectName(day.book_subject!)}.</p>
          <Bar pct={bookNow} marker={goal.target} label={`Chapter ${bookNow}% done, goal ${goal.target}%`} />
        </>}
        {day.instructions && goal.kind === 'other' && <p className="m-0 text-muted">{day.instructions}</p>}
        <ol className="m-0 list-none border-t border-line p-0">
          {shown.map(t => {
            const isDone = done.has(t.id); const now = current?.id === t.id
            if (t.kind === 'break') return (
              <li key={t.id} className="flex items-center gap-3 border-b border-line py-2 text-muted">
                <span className="w-[84px] shrink-0 text-sm tabular-nums">{pretty(t.start)}</span><span className="text-[15px]">{t.title}, {hours(t.minutes)}</span>
              </li>)
            return (
              <li key={t.id} className={`flex items-start gap-3 border-b border-line py-3 ${now ? 'bg-rose-soft/40 -mx-4 px-4 md:-mx-6 md:px-6' : ''}`}>
                <span className="w-[72px] shrink-0 pt-1 text-sm font-semibold tabular-nums text-muted">{pretty(t.start)}</span>
                <div className="min-w-0 flex-1">
                  <p className={`m-0 text-[17px] ${isDone ? 'text-muted line-through' : now ? 'font-semibold' : ''}`}>{t.title}{t.optionalToday && <span className="text-muted"> (optional)</span>}</p>
                  <p className="hint m-0">{hours(t.minutes)}, until {pretty(t.end)}{t.detail ? `. ${t.detail}` : ''}{t.from ? `. Moved from ${fmtShort(t.from)}` : ''}</p>
                  {!isDone && now && t.minutes > 0 && <button type="button" className="btn-primary mt-2" onClick={() => { setFocus({ id: t.id, minutes: Math.min(t.minutes, goal.sprint || 45), title: t.title }); setFocusMode(true) }}>Start {Math.min(t.minutes, goal.sprint || 45)}-min focus</button>}
                </div>
                <label className="flex size-12 shrink-0 cursor-pointer items-center justify-center">
                  <input type="checkbox" className="size-7 accent-rose" aria-label={`${isDone ? 'Untick' : 'Tick off'}: ${t.title}`} checked={isDone}
                    onChange={() => (isDone ? untickTask(day, t.id) : complete(t))} />
                </label>
              </li>)
          })}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Link to={`/planner?day=${day.day}`} className="btn-secondary">Edit today's plan</Link>
          <button type="button" className={current ? 'btn-secondary' : 'btn-primary'} onClick={onFinish}>{current ? 'Stop here and wrap up' : 'Wrap up the day'}</button>
        </div>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        <WaterCard />
        {profile!.ai_enabled && <Link to="/ask" className="card flex items-center justify-between gap-2 no-underline text-ink hover:border-rose">
          <span><b className="block">Stuck on something?</b><span className="hint">Ask {catName}</span></span><span className="btn-secondary min-h-11 px-4 text-sm">Ask</span></Link>}
      </div>
      <p className="hint text-center">Feeling different? <button type="button" className="btn-text inline min-h-0 p-0" onClick={async () => { const c = onDate(events, today).filter(e => e.kind === 'checkin').at(-1); if (c) await logEvent('checkin', { mood: null, reset: true }) }}>Check in again</button></p>

      {focus && <FocusTimer minutes={focus.minutes} title={focus.title} onDone={() => { const t = shown.find(x => x.id === focus.id); if (t) complete(t) }} onExit={() => { setFocus(null); setFocusMode(false) }} />}
      <LogSheet open={!!log} kind={log?.kind ?? 'plain'} day={day} bookNow={bookNow} pendingReviews={questionTotals(events, profile!.qbank_start).reviewPending}
        onClose={() => setLog(null)}
        onSaved={async (payloadKind, payload) => {
          const id = log!.id
          if (payloadKind === 'note') { const ok = await addNote(payload as { body: string }); if (!ok) return }
          else if (payloadKind) { const ev = await logEvent(payloadKind, payload); if (!ev) return }
          setLog(null); await markDone(id)
        }} />
    </div>
  )
}

export function WaterCard() {
  const { events, today, profile, logEvent, voidEvent, say } = useApp()
  const total = waterOn(events, today)
  const goal = profile?.water_goal_ml
  const last = onDate(events, today).filter(e => e.kind === 'water').at(-1)
  return (
    <section aria-label="Water" className="card flex items-center justify-between gap-2 py-3">
      <div><p className="m-0 font-semibold">Water {total.toLocaleString()}{goal ? ` / ${goal.toLocaleString()}` : ''} mL</p><p className="hint m-0">Tap when you drink</p></div>
      <div className="flex gap-1.5">
        {last && <button type="button" className="btn-secondary min-h-11 px-3 text-sm" aria-label="Undo last water" onClick={() => voidEvent(last.id)}>Undo</button>}
        <button type="button" className="btn-secondary min-h-11 px-3.5" onClick={async () => { if (await logEvent('water', { ml: 250 })) say('water', 'sipping') }}>+250 mL</button>
      </div>
    </section>
  )
}

function DayDone({ day }: { day: StudyDay }) {
  const { days, today, events, voidEvent } = useApp()
  const tomorrow = days.find(d => d.day === addDays(today, 1))
  const wrap = onDate(events, today).filter(e => e.kind === 'wrap').at(-1)
  return (
    <div className="flex flex-col gap-5">
      <MochiSays text={line('goalMet')} mood="sleepy" size={72} />
      <h1 className="h1">That's today done.</h1>
      <p className="m-0 text-muted">{day.topic} is wrapped up. Rest well.</p>
      {tomorrow && <section className="rounded-2xl bg-q-bg p-4"><p className="m-0 text-sm font-bold text-q-fg">Tomorrow</p><p className="m-0"><DayPill mode={tomorrow.mode} /> <span className="ml-1">{tomorrow.topic}</span></p></section>}
      <WaterCard />
      {wrap && <button type="button" className="btn-text self-center" onClick={() => voidEvent(wrap.id)}>Reopen today</button>}
    </div>
  )
}

function NoPlanDay() {
  const { today, days } = useApp()
  const first = days[0]?.day, lastDay = days.at(-1)?.day
  const before = first && today < first
  return (
    <div className="flex flex-col gap-5">
      <MochiSays text={before ? `Your plan starts on ${fmtLong(first!)}. Rest up until then!` : lastDay && today > lastDay ? 'The plan is finished. Whatever happened, I am proud of you.' : 'Nothing planned today.'} mood="happy" size={72} />
      <Link to="/planner" className="btn-secondary">See the plan</Link>
    </div>
  )
}
