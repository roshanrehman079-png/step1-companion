// Shown to a signed-in person with no study space yet: start one, or wait for an invite.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { catSvgInner } from '../../components/catArt'

export default function Welcome() {
  const { claimCode, signOut } = useApp()
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <svg role="img" aria-label="A cream kitten" width="140" height="140" viewBox="0 0 120 120" dangerouslySetInnerHTML={{ __html: catSvgInner('nudge', 'kitten') }} />
      <h1 className="h1 text-[30px]">Hi! What brings you here?</h1>
      <Link to="/setup" className="btn-primary min-h-14 text-[17px]">Set up my study space</Link>
      <section className="card flex flex-col gap-2">
        <h2 className="h2 m-0">I was invited to follow along</h2>
        <p className="m-0 text-muted">Open the invite link they sent you, or paste the code from the end of the link.</p>
        <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); const ok = await claimCode(code.split('/').pop()!.trim()); setMsg(ok ? '' : "That code didn't work. It may already be used; ask for a new link.") }}>
          <label htmlFor="ic" className="sr-only">Invite code</label>
          <input id="ic" className="input flex-1" placeholder="Invite code" value={code} onChange={e => setCode(e.target.value)} />
          <button className="btn-secondary">Join</button>
        </form>
        {msg && <p role="alert" className="m-0 text-rose-dark">{msg}</p>}
      </section>
      <button type="button" className="btn-text self-center" onClick={signOut}>Sign out</button>
    </main>
  )
}
