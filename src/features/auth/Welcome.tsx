// Shown to a signed-in person with no study space yet: start one, or wait for an invite.
import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { catSvgInner } from '../../components/catArt'

export default function Welcome() {
  const { session, refresh, signOut } = useApp()
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <svg role="img" aria-label="A cream kitten" width="140" height="140" viewBox="0 0 120 120" dangerouslySetInnerHTML={{ __html: catSvgInner('nudge', 'kitten') }} />
      <h1 className="h1 text-[30px]">Hi! What brings you here?</h1>
      <Link to="/setup" className="btn-primary min-h-14 text-[17px]">Set up my study space</Link>
      <section className="card flex flex-col gap-2">
        <h2 className="h2 m-0">I was invited to follow along</h2>
        <p className="m-0 text-muted">Ask the person to invite <b className="text-ink">{session?.user.email}</b> from their Settings. Then tap below.</p>
        <button type="button" className="btn-secondary" onClick={refresh}>Check for my invite</button>
      </section>
      <button type="button" className="btn-text self-center" onClick={signOut}>Sign out</button>
    </main>
  )
}
