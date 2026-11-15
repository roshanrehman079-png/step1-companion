// Quick logging after a task. Each form is a few taps; nothing is required except the main number.
import { useEffect, useState } from 'react'
import { Counter, Sheet } from '../../components/ui'
import NoteForm from '../notes/NoteForm'
import type { EventKind, StudyDay } from '../../lib/types'

export type LogKind = 'block' | 'review' | 'read' | 'notes' | 'score' | 'plain'
type Saved = (kind: EventKind | 'note' | null, payload: Record<string, unknown>) => Promise<void>

export default function LogSheet({ open, kind, day, bookNow, pendingReviews, onClose, onSaved }: {
  open: boolean; kind: LogKind; day: StudyDay; bookNow: number; pendingReviews: number; onClose: () => void; onSaved: Saved
}) {
  const [fresh, setFresh] = useState(20), [wrong, setWrong] = useState(0), [pct, setPct] = useState(0)
  const [reviewed, setReviewed] = useState(0), [book, setBook] = useState(bookNow)
  const [form, setForm] = useState(''), [score, setScore] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setFresh(20); setWrong(0); setPct(0); setReviewed(pendingReviews); setBook(bookNow); setForm(''); setScore('') } }, [open, pendingReviews, bookNow])
  const save = async (k: EventKind | null, p: Record<string, unknown>) => { setBusy(true); await onSaved(k, p); setBusy(false) }

  const titles: Record<LogKind, string> = { block: 'How did the block go?', review: 'Explanations reviewed', read: 'Where did you get to?',
    notes: 'Add a mistake note', score: 'Practice exam score', plain: 'Done' }
  return (
    <Sheet open={open} onClose={onClose} title={titles[kind]}>
      {kind === 'block' && <>
        <div className="card py-1">
          <Counter label="New questions done" value={fresh} onChange={setFresh} max={40} />
          <div className="border-t border-line" />
          <Counter label="Wrong or unsure" sub="These start your next review" value={wrong} onChange={v => setWrong(Math.min(v, fresh))} max={40} />
          <div className="border-t border-line" />
          <Counter label="Percent correct" sub="Optional, from UWorld" value={pct} onChange={setPct} step={5} max={100} />
        </div>
        <button className="btn-primary min-h-14" disabled={busy} onClick={() => save('qblock', { fresh, wrong, pct: pct || null })}>Save</button>
        <p className="hint m-0 text-center">Reviews never count as new questions.</p>
      </>}
      {kind === 'review' && <>
        <div className="card py-1"><Counter label="Flagged explanations reviewed" value={reviewed} onChange={setReviewed} max={Math.max(pendingReviews, 1)} sub={`${pendingReviews} waiting`} /></div>
        <button className="btn-primary min-h-14" disabled={busy} onClick={() => save('qreview', { reviewed })}>Save</button>
      </>}
      {kind === 'read' && <>
        <div className="card py-1"><Counter label="Chapter done, in percent" value={book} onChange={setBook} step={5} max={100} /></div>
        <p className="hint m-0">Enter where you are now. It replaces the old number instead of adding to it.</p>
        <button className="btn-primary min-h-14" disabled={busy} onClick={() => save('book', { subject: day.book_subject, pct: book })}>Save</button>
      </>}
      {kind === 'notes' && <NoteForm onSubmit={async n => { await onSaved('note', n) }} onSkip={() => save(null, {})} />}
      {kind === 'score' && <>
        <div><label htmlFor="fm" className="label">Which form?</label><input id="fm" className="input" placeholder="e.g. NBME 30" value={form} onChange={e => setForm(e.target.value)} /></div>
        <div><label htmlFor="sc" className="label">Score or percent correct (optional)</label><input id="sc" className="input" value={score} onChange={e => setScore(e.target.value)} />
          <p className="hint mt-1.5">Private by default. The app never predicts pass or fail.</p></div>
        <button className="btn-primary min-h-14" disabled={busy} onClick={() => save('assessment', { form, score })}>Save</button>
      </>}
    </Sheet>
  )
}
