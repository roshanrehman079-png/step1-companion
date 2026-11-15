// "Ask Dr. Mochi": a short study chat answered by Gemini through our server function.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../state/AppContext'
import { Cat, Sheet } from '../../components/ui'
import NoteForm from '../notes/NoteForm'

type Msg = { role: 'user' | 'model'; text: string; sources?: { uri: string; title: string }[] }
const ERRORS: Record<string, string> = {
  limit: "That's all my questions for today. Let's rest our brains and try again tomorrow.",
  'not-configured': "My answer service isn't set up yet. Roshan needs to add the Gemini key in Supabase.",
  off: 'Asking is switched off in Settings.',
  'sign-in': 'Please sign in again.',
}

export default function Ask() {
  const { catName, today, profile, addNote } = useApp()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, busy])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const q = text.trim(); if (!q || busy) return
    const next: Msg[] = [...msgs, { role: 'user', text: q }]
    setMsgs(next); setText(''); setBusy(true)
    const { data, error } = await supabase.functions.invoke('ask-mochi', { body: { messages: next.map(({ role, text }) => ({ role, text })), localDate: today } })
    setBusy(false)
    let code: string | undefined = data?.error
    if (error && 'context' in error) { try { code = (await (error.context as Response).json()).error } catch { /* ignore */ } }
    if (error || !data?.text) return setMsgs([...next, { role: 'model', text: ERRORS[code ?? ''] ?? "Hmm, I couldn't answer just now. Try again in a minute?" }])
    setLeft(data.left ?? null)
    setMsgs([...next, { role: 'model', text: data.text, sources: data.sources }])
  }

  if (!profile?.ai_enabled) return <p>{ERRORS.off} <Link to="/settings">Settings</Link></p>
  const lastQ = [...msgs].reverse().find(m => m.role === 'user')?.text ?? ''

  return (
    <div className="flex min-h-[70dvh] flex-col gap-4">
      <header className="flex items-center gap-3">
        <Cat size={56} mood={busy ? 'focus' : 'content'} />
        <div><h1 className="h1 m-0">Ask {catName}</h1><p className="hint m-0">For quick concept questions. Always check answers against First Aid.</p></div>
      </header>
      <div className="flex flex-1 flex-col gap-3" aria-live="polite">
        {msgs.length === 0 && <div className="card text-muted">
          <p className="m-0">Ask about a concept in your own words, for example:</p>
          <ul className="mb-0 mt-2 pl-5"><li>Why is methylmalonic acid only high in B12 deficiency?</li><li>Difference between type II and type III hypersensitivity?</li></ul>
          <p className="hint mb-0 mt-2">Please don't paste UWorld or NBME questions. Describe the idea instead.</p></div>}
        {msgs.map((m, i) => m.role === 'user'
          ? <p key={i} className="m-0 max-w-[85%] self-end rounded-2xl rounded-br-sm bg-rose px-4 py-2.5 text-white">{m.text}</p>
          : <div key={i} className="flex max-w-[92%] items-start gap-2 self-start">
              <Cat size={36} mood="happy" />
              <div className="card flex flex-col gap-2 rounded-tl-sm">
                <p className="m-0 whitespace-pre-wrap">{m.text}</p>
                {m.sources && m.sources.length > 0 && <div><p className="hint m-0">Sources</p><ul className="m-0 pl-5 text-[15px]">{m.sources.map(s => <li key={s.uri}><a href={s.uri} target="_blank" rel="noreferrer">{s.title || 'Source'}</a></li>)}</ul></div>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary min-h-11 px-3.5 text-sm" onClick={() => setSaving(m.text.slice(0, 280))}>Save as mistake note</button>
                  <a className="btn-secondary min-h-11 px-3.5 text-sm" href={`https://www.google.com/search?q=${encodeURIComponent(msgs[i - 1]?.text ?? lastQ)}`} target="_blank" rel="noreferrer">Search Google</a>
                </div>
              </div>
            </div>)}
        {busy && <p className="hint m-0 flex items-center gap-2"><Cat size={28} mood="focus" /> {catName} is thinking…</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="sticky bottom-20 flex gap-2 rounded-2xl bg-paper py-2 md:bottom-4">
        <label htmlFor="q" className="sr-only">Your question</label>
        <input id="q" className="input flex-1" value={text} maxLength={800} onChange={e => setText(e.target.value)} placeholder="Type your question" autoComplete="off" />
        <button className="btn-primary" disabled={busy || !text.trim()}>Ask</button>
      </form>
      <div className="flex items-center justify-between">
        <Link to="/" className="btn-text px-0">Back to today</Link>
        {left !== null && <span className="hint">{left} questions left today</span>}
      </div>
      <Sheet open={!!saving} onClose={() => setSaving(null)} title="Save as mistake note">
        {saving !== null && <NoteForm initial={saving} onSubmit={async n => { if (await addNote({ ...n, source: 'ask' })) setSaving(null) }} />}
      </Sheet>
    </div>
  )
}
