// One day: see the timeline and tick things off, or edit everything about it.
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { DayPill, Sheet } from '../../components/ui'
import { DAY_TYPE } from '../../content/strings'
import { QUICK_ADD, newTaskId } from '../../content/tasks'
import { fmtLong, fmtShort } from '../../lib/dates'
import { hours, pretty, similarDays, tasksOf, ticked, timeline } from '../../lib/schedule'
import type { Mode, PlanTask, StudyDay } from '../../lib/types'

const MODES = Object.keys(DAY_TYPE) as Mode[]

export default function DaySheet({ day, onClose }: { day: StudyDay | null; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  useEffect(() => { setEditing(false) }, [day?.id])
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? fmtLong(day.day) : ''}>
      {day && (editing ? <Editor day={day} onDone={() => setEditing(false)} onClose={onClose} /> : <View day={day} onEdit={() => setEditing(true)} />)}
    </Sheet>
  )
}

function View({ day, onEdit }: { day: StudyDay; onEdit: () => void }) {
  const { events, profile, tickTask, untickTask } = useApp()
  const done = ticked(events, day.day)
  const tl = timeline(tasksOf(day), day.start_time ?? profile?.day_start ?? '08:00')
  return (
    <>
      <div className="flex flex-wrap items-center gap-2"><DayPill mode={day.mode} />{day.locked && <span className="hint">Fixed date</span>}</div>
      <p className="m-0 text-xl font-bold">{day.topic}</p>
      {day.instructions && <p className="m-0 text-muted">{day.instructions}</p>}
      <ol className="m-0 list-none p-0">
        {tl.map(t => t.kind === 'break'
          ? <li key={t.id} className="flex gap-3 border-t border-line py-2 text-sm text-muted"><span className="w-[72px] shrink-0 tabular-nums">{pretty(t.start)}</span>{t.title}, {hours(t.minutes)}</li>
          : <li key={t.id} className="flex items-center gap-3 border-t border-line py-2">
              <span className="w-[72px] shrink-0 text-sm font-semibold tabular-nums text-muted">{pretty(t.start)}</span>
              <span className="min-w-0 flex-1"><span className={`block ${done.has(t.id) ? 'text-muted line-through' : ''}`}>{t.title}{t.optional ? ' (optional)' : ''}{t.dismissed ? ' (let go)' : ''}</span>
                <span className="hint">{hours(t.minutes)}{t.from ? `, moved from ${fmtShort(t.from)}` : ''}</span></span>
              <input type="checkbox" className="size-7 shrink-0 accent-rose" aria-label={`${done.has(t.id) ? 'Untick' : 'Tick off'}: ${t.title}`} checked={done.has(t.id)}
                onChange={() => (done.has(t.id) ? untickTask(day, t.id) : tickTask(day, t.id))} />
            </li>)}
      </ol>
      <button type="button" className="btn-primary" onClick={onEdit}>Edit this day</button>
    </>
  )
}

function Editor({ day, onDone, onClose }: { day: StudyDay; onDone: () => void; onClose: () => void }) {
  const { days, profile, saveDay, insertDayAfter, removeDay, swapDays } = useApp()
  const [topic, setTopic] = useState(day.topic)
  const [mode, setMode] = useState<Mode>(day.mode)
  const [notes, setNotes] = useState(day.instructions)
  const [start, setStart] = useState(day.start_time ?? profile?.day_start ?? '08:00')
  const [tasks, setTasks] = useState<PlanTask[]>(() => tasksOf(day).filter(t => !t.moved_to))
  const [swapWith, setSwapWith] = useState('')
  const [confirm, setConfirm] = useState<'remove' | 'insert' | null>(null)
  const [busy, setBusy] = useState(false)
  const similar = useMemo(() => (topic.trim() && topic.trim() !== day.topic ? similarDays(topic, days, day.day) : []), [topic, days, day])
  const lockedAfter = days.filter(d => d.day > day.day && d.locked)
  const tl = timeline(tasks, start)

  const setTask = (i: number, patch: Partial<PlanTask>) => setTasks(ts => ts.map((t, k) => (k === i ? { ...t, ...patch } : t)))
  const moveUp = (i: number) => i > 0 && setTasks(ts => { const c = [...ts]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c })
  const remove = (i: number) => setTasks(ts => ts.filter((_, k) => k !== i))
  const add = (t: Omit<PlanTask, 'id'>) => setTasks(ts => [...ts, { ...t, id: newTaskId() }])
  const moved = tasksOf(day).filter(t => t.moved_to)

  const save = async () => {
    setBusy(true)
    const changes: string[] = []
    if (topic !== day.topic) changes.push(`topic to "${topic}"`)
    if (mode !== day.mode) changes.push(`type to ${DAY_TYPE[mode].label}`)
    if (start !== (day.start_time ?? profile?.day_start)) changes.push(`start to ${pretty(start)}`)
    if (JSON.stringify(tasks) !== JSON.stringify(tasksOf(day).filter(t => !t.moved_to))) changes.push('tasks and times')
    if (notes !== day.instructions) changes.push('notes')
    const ok = !changes.length || await saveDay(day, { topic: topic.trim() || day.topic, mode, instructions: notes, start_time: start, tasks: [...tasks, ...moved] },
      `Changed ${fmtShort(day.day)}: ${changes.join(', ')}`)
    setBusy(false); if (ok) onDone()
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); save() }}>
      <div><label htmlFor="tp" className="label">What you're studying</label>
        <input id="tp" className="input" value={topic} onChange={e => setTopic(e.target.value)} />
        {similar.length > 0 && <div role="status" className="mt-2 rounded-xl bg-exam-bg px-3.5 py-2.5 text-[15px]">
          <b>Already in your plan:</b> {similar.slice(0, 4).map(d => `${d.topic} (${fmtShort(d.day)})`).join(', ')}{similar.length > 4 ? ` and ${similar.length - 4} more` : ''}. Is this a repeat?</div>}</div>
      <div className="grid grid-cols-2 gap-3">
        <div><label htmlFor="md" className="label">Type of day</label>
          <select id="md" className="input" value={mode} onChange={e => setMode(e.target.value as Mode)}>{MODES.map(m => <option key={m} value={m}>{DAY_TYPE[m].label}</option>)}</select></div>
        <div><label htmlFor="st" className="label">Day starts at</label>
          <input id="st" type="time" className="input" value={start} onChange={e => setStart(e.target.value || '08:00')} /></div>
      </div>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label">Schedule</legend>
        {tasks.map((t, i) => (
          <div key={t.id} className={`card flex flex-col gap-2 p-3 ${t.kind === 'break' ? 'bg-paper' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-muted">{pretty(tl[i]?.start ?? start)}</span>
              <label className="sr-only" htmlFor={`tt${i}`}>Task {i + 1}</label>
              <input id={`tt${i}`} className="input min-h-11 flex-1 text-base" value={t.title} onChange={e => setTask(i, { title: e.target.value })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm">Minutes
                <input type="number" min={0} step={5} className="input min-h-11 w-20 text-base" value={t.minutes} onChange={e => setTask(i, { minutes: Math.max(0, Number(e.target.value) || 0) })} /></label>
              <label className="flex items-center gap-1.5 text-sm">Fixed time
                <input type="time" className="input min-h-11 w-32 text-base" value={t.at ?? ''} onChange={e => setTask(i, { at: e.target.value || undefined })} /></label>
              <span className="ml-auto flex gap-1">
                <button type="button" className="btn-secondary min-h-11 px-3 text-sm" disabled={i === 0} onClick={() => moveUp(i)} aria-label={`Move ${t.title} earlier`}>Up</button>
                <button type="button" className="btn-secondary min-h-11 px-3 text-sm" onClick={() => remove(i)} aria-label={`Delete ${t.title}`}>Delete</button>
              </span>
            </div>
          </div>))}
        <p className="hint m-0">Times follow on from each other. Set a fixed time to start something at a particular hour.</p>
        <div role="group" aria-label="Add to this day" className="flex flex-wrap gap-2">
          {QUICK_ADD.map(q => <button key={q.label} type="button" className="chip min-h-11 px-3.5 text-[15px]" onClick={() => add(q.task)}>+ {q.label}</button>)}
        </div>
      </fieldset>

      <div><label htmlFor="nt" className="label">Notes</label><textarea id="nt" className="input min-h-20 py-3" value={notes} onChange={e => setNotes(e.target.value)} /></div>
      <div className="flex gap-2"><button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button type="button" className="btn-secondary" onClick={onDone}>Cancel</button></div>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <h3 className="h2 m-0">Move days around</h3>
        <button type="button" className="btn-secondary justify-start" onClick={() => setConfirm('insert')}>Need more time? Add another day of this topic</button>
        <div className="flex gap-2">
          <label htmlFor="sw" className="sr-only">Swap with</label>
          <select id="sw" className="input min-h-12 flex-1" value={swapWith} onChange={e => setSwapWith(e.target.value)}>
            <option value="">Swap with another day…</option>
            {days.filter(d => d.day !== day.day).map(d => <option key={d.id} value={d.day}>{fmtShort(d.day)}: {d.topic}</option>)}
          </select>
          <button type="button" className="btn-secondary" disabled={!swapWith || busy} onClick={async () => { const b = days.find(d => d.day === swapWith); if (b && await swapDays(day, b)) onClose() }}>Swap</button>
        </div>
        <button type="button" className="btn-secondary justify-start text-rose-dark" onClick={() => setConfirm('remove')}>Remove this day</button>
        {confirm && <div role="alert" className="rounded-xl bg-exam-bg p-3.5">
          <p className="m-0">{confirm === 'insert' ? `A new ${DAY_TYPE[day.mode].label.toLowerCase()} of "${day.topic}" goes on ${fmtShort(addOne(day.day))}, and every later day moves one day later.` : `${fmtShort(day.day)} is removed and every later day moves one day earlier.`}
            {lockedAfter.length > 0 && <> This also moves fixed dates: {lockedAfter.slice(0, 3).map(d => `${d.topic} (${fmtShort(d.day)})`).join(', ')}.</>} You can undo it in Changes.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); const ok = confirm === 'insert' ? await insertDayAfter(day) : await removeDay(day); setBusy(false); if (ok) onClose() }}>Yes, do it</button>
            <button type="button" className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
          </div></div>}
      </section>
    </form>
  )
}

function addOne(iso: string) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
