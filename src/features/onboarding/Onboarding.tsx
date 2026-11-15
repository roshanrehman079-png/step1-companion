// First-time setup in five short steps. Everything here can be changed later in Settings.
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { catSvgInner } from '../../components/catArt'
import { RULES } from '../../content/strings'
import { drName } from '../../lib/growth'
import plan from '../../data/plan.json'

const NAME_IDEAS = ['Mochi', 'Biscuit', 'Miso', 'Paws']

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="chip" aria-pressed={on} onClick={onClick}>{children}</button>
}

export default function Onboarding() {
  const { completeOnboarding } = useApp()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({
    display_name: 'Azka', cat_name: 'Mochi', exam_date: plan.examDate, exam_confirmed: false,
    daily_hours: 8, qbank_start: 2600, track_mode: 'percent' as const, water_goal_ml: 3000 as number | null,
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(p => ({ ...p, [k]: v }))
  const last = 4
  const next = async () => {
    if (step < last) return setStep(step + 1)
    setBusy(true)
    const ok = await completeOnboarding({ ...f, cat_name: f.cat_name.trim() || 'Mochi' })
    setBusy(false)
    if (ok) nav('/', { replace: true })
  }
  const dr = drName(f.cat_name)

  const screens: ReactNode[] = [
    <>
      <svg role="img" aria-label="A cream kitten holding a book" width="140" height="140" viewBox="0 0 120 120" dangerouslySetInnerHTML={{ __html: catSvgInner('content', 'kitten') }} />
      <h1 className="h1 text-[30px]">Let's set up your study space.</h1>
      <p className="m-0 text-muted">About a minute. You can change anything later.</p>
      <div><label htmlFor="yn" className="label">What should we call you?</label>
        <input id="yn" className="input" value={f.display_name} onChange={e => set('display_name', e.target.value)} /></div>
    </>,
    <>
      <div className="flex items-center gap-3">
        <svg role="img" aria-label="Kitten waving" width="88" height="88" viewBox="0 0 120 120" className="shrink-0" dangerouslySetInnerHTML={{ __html: catSvgInner('nudge', 'kitten') }} />
        <p className="m-0 rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5">Hi! I'm your study doctor and buddy. What's my name?</p>
      </div>
      <div><label htmlFor="cn" className="label">Your buddy's name</label>
        <input id="cn" className="input" maxLength={24} value={f.cat_name} onChange={e => set('cat_name', e.target.value)} /></div>
      <div role="group" aria-label="Name ideas" className="flex flex-wrap gap-2">
        {NAME_IDEAS.map(n => <Chip key={n} on={f.cat_name === n} onClick={() => set('cat_name', n)}>{n}</Chip>)}
      </div>
      <p className="m-0 text-lg">Nice to meet you. I'm <b>{dr}</b>.</p>
      <p className="hint m-0">I start as a kitten in my first year and grow into a senior doctor as you study.</p>
    </>,
    <>
      <h1 className="h1">When is your exam?</h1>
      <div><label htmlFor="ed" className="label">Exam date</label>
        <input id="ed" type="date" className="input" value={f.exam_date} onChange={e => set('exam_date', e.target.value)} />
        <label className="mt-2 flex min-h-12 items-center gap-3"><input type="checkbox" className="size-6 accent-rose" checked={f.exam_confirmed} onChange={e => set('exam_confirmed', e.target.checked)} />The date is booked</label>
        <p className="hint m-0">Not booked yet? That's fine. The app never moves your exam date by itself.</p></div>
      <div><span id="hl" className="label">How long can you study on a normal day?</span>
        <div role="group" aria-labelledby="hl" className="flex flex-wrap gap-2">
          {[4, 6, 8].map(h => <Chip key={h} on={f.daily_hours === h} onClick={() => set('daily_hours', h)}>{h} hours</Chip>)}
        </div><p className="hint mt-2">Including breaks. You can change it any morning.</p></div>
    </>,
    <>
      <h1 className="h1">Where are you starting from?</h1>
      <div><label htmlFor="uw" className="label">UWorld questions you haven't done yet</label>
        <input id="uw" className="input" inputMode="numeric" value={f.qbank_start} onChange={e => set('qbank_start', Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} />
        <p className="hint mt-1.5">Just for your records. Nobody expects you to finish them all.</p></div>
      <div><span id="wg" className="label">Daily water goal</span>
        <div role="group" aria-labelledby="wg" className="flex flex-wrap gap-2">
          {[2000, 2500, 3000].map(w => <Chip key={w} on={f.water_goal_ml === w} onClick={() => set('water_goal_ml', w)}>{w.toLocaleString()} mL</Chip>)}
          <Chip on={f.water_goal_ml === null} onClick={() => set('water_goal_ml', null)}>No goal</Chip>
        </div><p className="hint mt-2">Your choice, not medical advice.</p></div>
    </>,
    <>
      <h1 className="h1">Three things to know</h1>
      {RULES.map(r => (
        <div key={r.title} className="card flex flex-col gap-1">
          <p className="m-0 font-semibold">{r.title.replace('Your buddy', dr)}</p>
          <p className="m-0 text-muted">{r.body}</p>
        </div>
      ))}
    </>,
  ]

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pb-8 pt-5">
      <div className="flex min-h-11 items-center justify-between">
        {step > 0 ? <button type="button" className="btn-text" onClick={() => setStep(step - 1)}>Back</button> : <span />}
        <div role="img" aria-label={`Setup step ${step + 1} of 5`} className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map(i => <span key={i} className={`h-2.5 rounded-full ${i === step ? 'w-6' : 'w-2.5'} ${i <= step ? 'bg-rose' : 'bg-track'}`} />)}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-5">{screens[step]}</div>
      <button type="button" className="btn-primary min-h-14 text-[17px]" onClick={next} disabled={busy}>
        {busy ? 'Setting things up…' : step === 1 ? "That's my name" : step === last ? 'Show me today' : step === 0 ? 'Start' : 'Next'}
      </button>
    </main>
  )
}
