// Today: Check in -> Do (one numbered list) -> Wrap up. The heart of the app.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { DayPill, MochiSays, Stepper, Bar } from '../../components/ui'
import { MOODS, DAY_SOURCE } from '../../content/strings'
import { line } from '../../content/mochi'
import { tasksFor, type TaskTemplate } from '../../content/tasks'
import { addDays, daysBetween, fmtLong, fmtShort } from '../../lib/dates'
import { goalFor, moodOn, onDate, questionTotals, waterOn, bookPercents, live } from '../../lib/progress'
import type { Mood, StudyDay } from '../../lib/types'
import FocusTimer from './FocusTimer'
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
  const { events, profile, today, logEvent, voidEvent, say, setFocusMode, addNote } = useApp()
  const goal = goalFor(day, mood, events, profile!.daily_hours, profile!.qbank_start)
  const pending = goal.kind === 'questions' ? goal.pending ?? 0 : 0
  const blocks = goal.kind === 'questions' ? Math.ceil(goal.target / 20) : 0
  const tasks = useMemo(() => tasksFor(day.mode, { pendingReviews: pending, blocks }), [day.mode, pending, blocks])
  const stepEvents = onDate(events, today).filter(e => e.kind === 'step')
  const doneIdx = new Set(stepEvents.map(e => Number(e.payload.i)))
  const current = tasks.findIndex((t, i) => !doneIdx.has(i) && !t.optional)
  const [focus, setFocus] = useState<{ i: number; minutes: number } | null>(null)
  const [log, setLog] = useState<{ i: number; kind: LogKind } | null>(null)
  const sprint = goal.sprint || 45
  const fresh = onDate(events, today).filter(e => e.kind === 'qblock').reduce((a, e) => a + Number(e.payload.fresh || 0), 0)
  const bookNow = day.book_subject ? bookPercents(events)[day.book_subject] ?? 0 : 0

  const finishTask = (i: number, t: TaskTemplate) => {
    setFocus(null); setFocusMode(false)
    const kind: LogKind | null = t.kind === 'plain' ? null : t.kind
    if (kind) setLog({ i, kind }); else markDone(i)
  }
  const markDone = async (i: number) => { if (await logEvent('step', { i })) say('logged', 'happy') }

  return (
    <div className="flex flex-col gap-5">
      {header}
      <Stepper active={1} />
      <MochiSays text={line(DAY_LINE[day.mode])} mood="happy" />
      <section aria-label="Today's job" className="card flex flex-col gap-3 md:p-6">
        <div className="flex items-center justify-between gap-2"><DayPill mode={day.mode} /><span className="hint">{DAY_SOURCE[day.mode] ?? ''}</span></div>
        <h2 className="m-0 text-[22px] font-bold leading-tight">{day.topic}</h2>
        {goal.kind === 'questions' && <p className="m-0 text-muted">Goal today: <b className="text-ink">{goal.target ? `${goal.target} new questions` : 'one gentle block, or rest'}</b>{goal.target !== day.q_core && ` (smaller because you're ${mood})`}. Done so far: <b className="text-ink">{fresh}</b>.</p>}
        {goal.kind === 'book' && <>
          <p className="m-0 text-muted">Goal today: reach <b className="text-ink">{goal.target}%</b> of {subjectName(day.book_subject!)}. No UWorld today, on purpose.</p>
          <Bar pct={bookNow} marker={goal.target} label={`Chapter ${bookNow}% done, goal ${goal.target}%`} />
        </>}
        {goal.kind === 'other' && <p className="m-0 text-muted">{day.instructions}</p>}
        {day.extra.carry?.map(c => <p key={c.from} className="m-0 rounded-xl bg-rose-soft px-3 py-2 text-[15px]">Optional extra from {fmtShort(c.from)}: {c.pct}% of {subjectName(c.subject)}.</p>)}
        <ol className="m-0 list-none border-t border-line p-0">
          {tasks.map((t, i) => {
            const done = doneIdx.has(i); const now = i === current
            return (
              <li key={i} className="flex items-start gap-3 border-b border-line py-3">
                <span aria-hidden className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${done ? 'bg-rose text-white' : now ? 'border-2 border-rose text-rose' : 'border border-field text-muted'}`}>{done ? '✓' : i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={`m-0 text-[17px] ${done ? 'text-muted line-through' : now ? 'font-semibold' : ''}`}>{t.title}{t.optional && <span className="text-muted"> (optional)</span>}</p>
                  <p className="hint m-0">{t.detail}</p>
                  {!done && (now || t.optional) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.minutes > 0 && <button type="button" className="btn-primary" onClick={() => { setFocus({ i, minutes: Math.min(t.minutes, sprint) }); setFocusMode(true) }}>Start {Math.min(t.minutes, sprint)}-min focus</button>}
                      <button type="button" className="btn-secondary" onClick={() => finishTask(i, t)}>{t.kind === 'plain' ? 'Mark done' : 'Done, log it'}</button>
                    </div>
                  )}
                  {done && <button type="button" className="btn-text min-h-10 px-0 text-sm" onClick={() => { const ev = stepEvents.filter(e => Number(e.payload.i) === i).at(-1); if (ev) voidEvent(ev.id) }}>Undo</button>}
                </div>
              </li>
            )
          })}
        </ol>
        <button type="button" className={current === -1 ? 'btn-primary' : 'btn-secondary'} onClick={onFinish}>{current === -1 ? 'Wrap up the day' : 'Stop here and wrap up'}</button>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        <WaterCard />
        {profile!.ai_enabled && <Link to="/ask" className="card flex items-center justify-between gap-2 no-underline text-ink hover:border-rose">
          <span><b className="block">Stuck on something?</b><span className="hint">Ask {catName}</span></span><span className="btn-secondary min-h-11 px-4 text-sm">Ask</span></Link>}
      </div>
      <p className="hint text-center">Feeling different? <button type="button" className="btn-text inline min-h-0 p-0" onClick={() => { const c = onDate(events, today).filter(e => e.kind === 'checkin').at(-1); if (c) voidEvent(c.id) }}>Check in again</button></p>

      {focus && <FocusTimer minutes={focus.minutes} title={tasks[focus.i].title} onDone={() => finishTask(focus.i, tasks[focus.i])} onExit={() => { setFocus(null); setFocusMode(false) }} />}
      <LogSheet open={!!log} kind={log?.kind ?? 'plain'} day={day} bookNow={bookNow} pendingReviews={questionTotals(events, profile!.qbank_start).reviewPending}
        onClose={() => setLog(null)}
        onSaved={async (payloadKind, payload) => {
          const i = log!.i
          if (payloadKind === 'note') { const ok = await addNote(payload as { body: string }); if (!ok) return }
          else if (payloadKind) { const ev = await logEvent(payloadKind, payload); if (!ev) return }
          setLog(null); await markDone(i)
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
