import { useState } from 'react'
import plan from '../../data/plan.json'

const WHY = ["Didn't know it", 'Misread', 'Rushed']
const SUBJECTS = (plan.subjects as { id: string; name: string }[]).slice(0, 9).map(s => s.name).concat('Other')

export default function NoteForm({ initial = '', onSubmit, onSkip }: {
  initial?: string; onSubmit: (n: { body: string; subject: string | null; why: string | null; source: string }) => Promise<void>; onSkip?: () => void
}) {
  const [body, setBody] = useState(initial)
  const [subject, setSubject] = useState<string | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <form className="flex flex-col gap-4" onSubmit={async e => { e.preventDefault(); if (!body.trim()) return; setBusy(true); await onSubmit({ body: body.trim(), subject, why, source: 'manual' }); setBusy(false) }}>
      <div><label htmlFor="nb" className="label">One thing to remember</label>
        <textarea id="nb" className="input min-h-24 py-3" maxLength={600} required value={body} onChange={e => setBody(e.target.value)} placeholder="In your own words" />
        <p className="hint mt-1.5">Don't paste the question itself. Just the lesson.</p></div>
      <div role="group" aria-label="Subject" className="flex flex-wrap gap-2">
        {SUBJECTS.map(s => <button key={s} type="button" className="chip min-h-11 px-3.5 text-[15px]" aria-pressed={subject === s} onClick={() => setSubject(subject === s ? null : s)}>{s}</button>)}
      </div>
      <div role="group" aria-label="Why I missed it" className="flex flex-wrap gap-2">
        {WHY.map(w => <button key={w} type="button" className="chip min-h-11 px-3.5 text-[15px]" aria-pressed={why === w} onClick={() => setWhy(why === w ? null : w)}>{w}</button>)}
      </div>
      <button className="btn-primary min-h-14" disabled={busy || !body.trim()}>Save note</button>
      {onSkip && <button type="button" className="btn-text self-center" onClick={onSkip}>No notes this time</button>}
    </form>
  )
}
