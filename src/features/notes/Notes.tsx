// Mistake notes with simple spaced review: 1, 3, 7 then 14 days.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { MochiSays, Sheet } from '../../components/ui'
import { fmtShort } from '../../lib/dates'
import NoteForm from './NoteForm'
import type { Note } from '../../lib/types'

export default function Notes() {
  const { notes, today, reviewNote, archiveNote, addNote, profile, catName } = useApp()
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const subjects = [...new Set(notes.map(n => n.subject).filter(Boolean))] as string[]
  const list = notes.filter(n => !filter || n.subject === filter)
  const due = list.filter(n => n.due_date <= today)
  const later = list.filter(n => n.due_date > today)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="h1">Mistake notes</h1>
        <button type="button" className="btn-primary" onClick={() => setAdding(true)}>Add</button>
      </header>
      <MochiSays text={notes.length === 0 ? 'No notes yet. After a block, write one line per lesson. I will bring them back at the right time.'
        : due.length ? `${due.length} to look at today. About ${Math.max(1, Math.round(due.length / 2))} minute${due.length > 2 ? 's' : ''}.` : 'All done for today. Nice.'} />
      {subjects.length > 1 && <div role="group" aria-label="Filter by subject" className="flex flex-wrap gap-2">
        <button type="button" className="chip" aria-pressed={!filter} onClick={() => setFilter(null)}>All</button>
        {subjects.map(s => <button key={s} type="button" className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>{s}</button>)}
      </div>}
      {due.length > 0 && <h2 className="h2 m-0">Due today</h2>}
      {due.map(n => <NoteCard key={n.id} n={n} due onRemember={() => reviewNote(n, true)} onAgain={() => reviewNote(n, false)} onArchive={() => archiveNote(n.id)} />)}
      {later.length > 0 && <h2 className="h2 m-0">Coming up</h2>}
      {later.map(n => <NoteCard key={n.id} n={n} onArchive={() => archiveNote(n.id)} />)}
      {profile?.ai_enabled && <Link to="/ask" className="btn-secondary self-start">Ask {catName} about something</Link>}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a mistake note">
        <NoteForm onSubmit={async n => { if (await addNote(n)) setAdding(false) }} />
      </Sheet>
    </div>
  )
}

function NoteCard({ n, due, onRemember, onAgain, onArchive }: { n: Note; due?: boolean; onRemember?: () => void; onAgain?: () => void; onArchive: () => void }) {
  return (
    <section className="card flex flex-col gap-2.5">
      <p className="m-0 text-[17px] font-medium leading-normal">{n.body}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {[n.subject, n.why].filter(Boolean).map(t => <span key={t} className="rounded-full bg-rose-soft px-2.5 py-1 text-sm text-rose-dark">{t}</span>)}
        <span className="hint">{due ? `added ${fmtShort(n.created_at.slice(0, 10))}` : `next on ${fmtShort(n.due_date)}`}</span>
      </div>
      {due ? <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary min-h-11 text-[15px]" onClick={onRemember}>I remembered</button>
        <button type="button" className="btn-secondary min-h-11 text-[15px]" onClick={onAgain}>Show again tomorrow</button>
      </div> : null}
      <button type="button" className="btn-text min-h-10 self-start px-0 text-sm" onClick={onArchive}>I know this now, archive</button>
    </section>
  )
}
