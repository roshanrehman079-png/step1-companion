// End of day: what you did, what your buddy earned, tomorrow, and an honest catch-up offer.
import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { Cat, DayPill, Stepper } from '../../components/ui'
import { line } from '../../content/mochi'
import { addDays, fmtShort } from '../../lib/dates'
import { stageFor, POINTS } from '../../lib/growth'
import { bookPercents, goalFor, moodOn, onDate, questionTotals } from '../../lib/progress'
import { proposeBookCatchUp } from '../../lib/planner'
import type { StudyDay } from '../../lib/types'
import type { Stage } from '../../components/catArt'

export default function WrapUp({ day, onBack }: { day: StudyDay; onBack: () => void }) {
  const { events, today, days, profile, growth, logEvent, addCarry, say } = useApp()
  const [busy, setBusy] = useState(false)
  const [carried, setCarried] = useState(false)
  const todayPts = growth.byDay.find(d => d.date === today)
  const before = stageFor(growth.total - (todayPts?.total ?? 0))
  const after = stageFor(growth.total + POINTS.wrap)
  const levelUp = after.index > before.index
  const mood = moodOn(events, today)
  const goal = goalFor(day, mood, events, profile!.daily_hours, profile!.qbank_start)
  const t = onDate(events, today)
  const fresh = t.filter(e => e.kind === 'qblock').reduce((a, e) => a + Number(e.payload.fresh || 0), 0)
  const reviewed = t.filter(e => e.kind === 'qreview').reduce((a, e) => a + Number(e.payload.reviewed || 0), 0)
  const notesN = t.filter(e => e.kind === 'note_review').length
  const pending = questionTotals(events, profile!.qbank_start).reviewPending
  const tomorrow = days.find(d => d.day === addDays(today, 1))

  // Reading shortfall: try future reading days with real room; otherwise offer an optional recovery slot.
  let shortfall = 0, recovery: StudyDay | undefined
  if (goal.kind === 'book' && day.book_subject) {
    const now = bookPercents(events)[day.book_subject] ?? 0
    const proposal = proposeBookCatchUp({ todayDate: today, progress: { subjectId: day.book_subject, absolutePercent: now, targetCumulativePercent: goal.target },
      observedMinutesPerPercentPoint: 4, futureDays: days.filter(d => d.day > today).map(d => ({ date: d.day, mode: d.mode, protected: d.locked || d.rest_protected,
        availableFocusMinutes: profile!.daily_hours * 60 * 0.8125, allocatedFocusMinutes: profile!.daily_hours * 60 * 0.8125 })) })
    shortfall = proposal.unplaced[0]?.units ?? 0
    recovery = days.find(d => d.day > today && d.mode === 'RECOVERY')
  }

  const close = async () => { setBusy(true); if (await logEvent('wrap', {})) say(levelUp ? 'levelUp' : 'goalMet', 'celebrate', {}, true); setBusy(false); onBack() }

  return (
    <div className="flex flex-col gap-5">
      <Stepper active={2} />
      <div className="flex flex-col items-center gap-2 text-center">
        <Cat size={150} mood="celebrate" stage={(levelUp ? after.stage.key : growth.stage.key) as Stage} react={1} />
        <h1 className="h1">{levelUp ? `New stage: ${after.stage.title}!` : 'Nice work today'}</h1>
        <p className="m-0 text-muted">{levelUp ? 'A new outfit, earned by showing up.' : line('goalMet')}</p>
      </div>
      <section className="card"><p className="m-0 font-semibold">Today</p>
        <p className="m-0">{day.mode === 'QUESTION' ? `${fresh} new questions, ${reviewed} explanations reviewed.` : day.mode === 'BOOK' ? `${day.topic}: you're at ${bookPercents(events)[day.book_subject!] ?? 0}%.` : day.topic}{notesN ? ` ${notesN} notes reviewed.` : ''}</p></section>
      {todayPts && todayPts.items.length > 0 && <section className="card py-2.5">
        {[...todayPts.items, { label: 'Closing the day', points: POINTS.wrap }].map(i => <div key={i.label} className="flex justify-between py-1.5"><span>{i.label}</span><b className="text-rose">+{i.points}</b></div>)}
        <p className="hint m-0 mt-1">Points never go down. The number of questions doesn't count.</p></section>}
      {shortfall > 0 && !carried && <section className="rounded-2xl bg-exam-bg p-4 text-exam-fg">
        <p className="m-0 font-semibold">{shortfall}% of today's reading didn't fit</p>
        <p className="m-0 text-ink">Your upcoming reading days are already full, so I won't squeeze it in. You could:</p>
        <div className="mt-3 flex flex-col gap-2">
          {recovery && <button type="button" className="btn-secondary justify-start" onClick={async () => { if (await addCarry(recovery!, { subject: day.book_subject!, pct: shortfall, from: today })) setCarried(true) }}>Add it to {fmtShort(recovery.day)} recovery day, optional</button>}
          <button type="button" className="btn-secondary justify-start" onClick={() => setCarried(true)}>Leave it. It's fine.</button>
        </div>
        <p className="hint m-0 mt-2">You can undo plan changes from the Planner.</p></section>}
      {tomorrow && <section className="rounded-2xl bg-q-bg p-4"><p className="m-0 text-sm font-bold text-q-fg">Tomorrow</p>
        <p className="m-0"><DayPill mode={tomorrow.mode} /> <span className="ml-1">{tomorrow.topic}</span></p>
        {tomorrow.mode === 'QUESTION' && pending > 0 && <p className="m-0 mt-1">It starts with the {pending} explanations you flagged.</p>}</section>}
      <button type="button" className="btn-primary min-h-14" disabled={busy} onClick={close}>Close the day</button>
      <button type="button" className="btn-text self-center" onClick={onBack}>Back to today's list</button>
    </div>
  )
}
