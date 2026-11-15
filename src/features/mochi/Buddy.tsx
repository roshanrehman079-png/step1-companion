// The buddy's page: pet, rename, growth, stickers, how chatty it is.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { Bar, Cat } from '../../components/ui'
import { POINTS, STAGES, drName } from '../../lib/growth'
import { live } from '../../lib/progress'
import type { Stage } from '../../components/catArt'

export default function Buddy() {
  const { catName, growth, profile, saveProfile, say, logEvent, bubble, events } = useApp()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(profile?.cat_name ?? 'Mochi')
  const ev = live(events)
  const count = (k: string) => ev.filter(e => e.kind === k).length
  const stickers = [
    { t: 'First check-in', got: count('checkin') > 0 }, { t: 'First rest day', got: count('rest') > 0 },
    { t: '10 notes reviewed', got: count('note_review') >= 10 }, { t: 'First practice exam', got: count('assessment') > 0 },
    { t: '50 notes reviewed', got: count('note_review') >= 50 }, { t: 'All 3 practice exams', got: count('assessment') >= 3 },
    { t: '7 days closed', got: count('wrap') >= 7 }, { t: '20 days closed', got: count('wrap') >= 20 }, { t: 'First water log', got: count('water') > 0 },
  ]
  const pet = async () => { say('pet', 'petted', {}, true); await logEvent('pet') }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <button type="button" onClick={pet} aria-label={`Pet ${catName}`} className="rounded-full border-0 bg-transparent p-0"><Cat size={160} mood={bubble?.mood ?? 'content'} react={bubble?.key} /></button>
        <p className="hint m-0" aria-live="polite">{bubble?.text ?? `Tap ${catName} to say hi.`}</p>
        <h1 className="h1">{catName}</h1>
        <p className="m-0 text-muted">{growth.stage.title}. {growth.total} points{growth.next ? `, ${growth.toNext} more to ${growth.next.title}` : ''}.</p>
        <div className="w-full"><Bar pct={growth.pct} label={`Growth to next stage ${growth.pct}%`} /></div>
        {!renaming ? <button type="button" className="btn-secondary" onClick={() => setRenaming(true)}>Rename</button> :
          <form className="flex w-full gap-2" onSubmit={async e => { e.preventDefault(); if (await saveProfile({ cat_name: name.trim() || 'Mochi' })) setRenaming(false) }}>
            <label htmlFor="rn" className="sr-only">New name</label>
            <input id="rn" className="input flex-1" maxLength={24} value={name} onChange={e => setName(e.target.value)} />
            <button className="btn-primary">Save</button>
          </form>}
        {renaming && <p className="hint m-0">Will be called {drName(name)}.</p>}
      </div>

      <section className="card flex flex-col"><h2 className="h2 m-0 mb-1">How {catName} grows</h2>
        {[['Check in', POINTS.checkin], ["Finish today's goal, whatever size", POINTS.goal], ['Review flagged explanations', POINTS.review],
          ['Review a mistake note', POINTS.note], ['Take a planned rest day', POINTS.rest], ['Log water (up to 3 a day)', POINTS.water], ['Close the day', POINTS.wrap]]
          .map(([l, p]) => <div key={l} className="flex justify-between py-1.5"><span>{l}</span><b className="text-rose">+{p}</b></div>)}
        <p className="hint m-0 mt-1">Points never go down. The number of questions doesn't count.</p></section>

      <section className="card flex flex-col gap-3"><h2 className="h2 m-0">Stages</h2>
        {STAGES.map((s, i) => (
          <div key={s.key} className={`flex items-center gap-3 ${i > growth.index ? 'opacity-55' : ''}`}>
            <Cat size={52} stage={s.key as Stage} label={s.title} />
            <div className="flex-1"><p className="m-0 font-semibold">{s.title}</p><p className="hint m-0">{s.at} points</p></div>
            <span className={`text-sm font-semibold ${i === growth.index ? 'text-rose' : 'text-muted'}`}>{i < growth.index ? 'Done' : i === growth.index ? 'Now' : ''}</span>
          </div>))}
      </section>

      <section className="flex flex-col gap-2"><h2 className="h2 m-0">Stickers</h2>
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
          {stickers.map(s => <li key={s.t} className={`card p-3 text-center ${s.got ? '' : 'border-dashed'}`}>
            <span aria-hidden className={`block text-2xl ${s.got ? 'text-rose' : 'text-field'}`}>{s.got ? '★' : '☆'}</span>
            <span className={`text-sm font-semibold ${s.got ? '' : 'text-muted'}`}>{s.t}</span><span className="sr-only">{s.got ? 'earned' : 'not yet'}</span></li>)}
        </ul></section>

      <section className="card flex flex-col gap-3"><h2 id="chat" className="h2 m-0">How chatty should {catName} be?</h2>
        <div role="group" aria-labelledby="chat" className="grid grid-cols-2 gap-2">
          <button type="button" className="chip justify-center" aria-pressed={profile?.chat_level === 'quiet'} onClick={() => saveProfile({ chat_level: 'quiet' })}>Quiet</button>
          <button type="button" className="chip justify-center" aria-pressed={profile?.chat_level !== 'quiet'} onClick={() => saveProfile({ chat_level: 'normal' })}>Normal</button>
        </div>
        <p className="hint m-0">{profile?.chat_level === 'quiet' ? 'Quiet: only the morning check-in, level-ups and messages from family. No nudges.' : 'Normal: speaks at check-in, after logging and on level-ups, with at most one nudge a day. Never during focus.'}</p>
      </section>
      {profile?.ai_enabled && <Link to="/ask" className="btn-primary">Ask {catName} a study question</Link>}
    </div>
  )
}
