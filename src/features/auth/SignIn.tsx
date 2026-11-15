import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { catSvgInner } from '../../components/catArt'

type Mode = 'in' | 'up' | 'reset'

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg(null)
    const redirect = window.location.origin + window.location.pathname
    const r = mode === 'in' ? await supabase.auth.signInWithPassword({ email, password })
      : mode === 'up' ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
      : await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect })
    setBusy(false)
    if (r.error) return setMsg({ ok: false, text: r.error.message })
    if (mode === 'up') setMsg({ ok: true, text: 'Check your email and tap the link to confirm, then sign in here.' })
    if (mode === 'reset') setMsg({ ok: true, text: 'Check your email for a link to set a new password.' })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-3">
        <svg role="img" aria-label="A cream kitten" width="112" height="112" viewBox="0 0 120 120" dangerouslySetInnerHTML={{ __html: catSvgInner('content', 'kitten') }} />
        <h1 className="h1 text-[30px]">{mode === 'up' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Welcome back'}</h1>
        <p className="m-0 text-muted">Your study space, saved safely across your phone and laptop.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div><label htmlFor="em" className="label">Email</label>
          <input id="em" className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        {mode !== 'reset' && <div><label htmlFor="pw" className="label">Password</label>
          <input id="pw" className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
          {mode === 'up' && <p className="hint mt-1.5">At least 8 characters.</p>}</div>}
        {msg && <p role="status" className={`m-0 rounded-xl px-3.5 py-2.5 ${msg.ok ? 'bg-rest-bg text-rest-fg' : 'bg-rose-soft text-rose-dark'}`}>{msg.text}</p>}
        <button className="btn-primary min-h-14 text-[17px]" disabled={busy}>{busy ? 'One moment…' : mode === 'up' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
      </form>
      <div className="flex flex-col items-center gap-1">
        {mode !== 'in' && <button type="button" className="btn-text" onClick={() => setMode('in')}>I already have an account</button>}
        {mode !== 'up' && <button type="button" className="btn-text" onClick={() => setMode('up')}>Create an account</button>}
        {mode === 'in' && <button type="button" className="btn-text" onClick={() => setMode('reset')}>Forgot password?</button>}
      </div>
      <p className="hint text-center">Invited to follow someone's progress? Create an account with the email they invited.</p>
    </main>
  )
}
