// Phone: small buddy bar on top + tab bar at the bottom. Desktop: side rail.
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Cat, ErrorBanner } from './ui'

const TABS = [
  { to: '/', label: 'Today' },
  { to: '/planner', label: 'Planner' },
  { to: '/notes', label: 'Notes' },
  { to: '/buddy', label: 'Buddy' },
]

function BuddyBar() {
  const { catName, growth, bubble, say, logEvent } = useApp()
  const pet = async () => { say('pet', 'petted', {}, true); await logEvent('pet') }
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur md:hidden">
      <div className="flex items-center gap-3 px-4 py-2">
        <button type="button" onClick={pet} aria-label={`Pet ${catName}`} className="rounded-full border-0 bg-transparent p-0">
          <Cat size={40} mood={bubble?.mood ?? 'content'} react={bubble?.key} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex justify-between text-sm"><b>{catName}</b><span className="text-muted">{growth.stage.title}</span></div>
          <div className="bar h-1.5" role="img" aria-label={`Growth to next stage ${growth.pct}%`}><span style={{ width: `${growth.pct}%` }} /></div>
        </div>
        <NavLink to="/settings" className="btn-secondary min-h-11 px-3.5 text-sm">Settings</NavLink>
      </div>
      {bubble && <p aria-live="polite" className="bubble-in m-0 border-t border-line bg-rose-soft px-4 py-2 text-[15px]">{bubble.text}</p>}
    </header>
  )
}

function Rail() {
  const { catName, growth, bubble, say, logEvent } = useApp()
  const pet = async () => { say('pet', 'petted', {}, true); await logEvent('pet') }
  return (
    <nav aria-label="Main" className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-surface p-4 md:flex">
      <button type="button" onClick={pet} aria-label={`Pet ${catName}`} className="mb-3 flex items-center gap-3 rounded-2xl border-0 bg-transparent p-1.5 text-left">
        <Cat size={48} mood={bubble?.mood ?? 'content'} react={bubble?.key} />
        <span><b className="block">{catName}</b><span className="text-sm text-muted">{growth.stage.title}</span></span>
      </button>
      {bubble && <p aria-live="polite" className="bubble-in mb-2 rounded-xl bg-rose-soft px-3 py-2 text-[15px]">{bubble.text}</p>}
      {[...TABS, { to: '/settings', label: 'Settings' }].map(t => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}
          className={({ isActive }) => `flex min-h-12 items-center rounded-xl px-3.5 font-medium no-underline ${isActive ? 'bg-rose-soft font-semibold text-ink' : 'text-muted hover:bg-rose-soft/60'}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { focusMode } = useApp()
  const loc = useLocation()
  return (
    <div className="min-h-dvh md:flex">
      <ErrorBanner />
      {!focusMode && <Rail />}
      <div className="flex min-w-0 flex-1 flex-col">
        {!focusMode && <BuddyBar />}
        <main key={loc.pathname} className={`mx-auto w-full ${loc.pathname === '/planner' ? 'max-w-6xl' : 'max-w-3xl'} flex-1 px-5 pb-28 pt-5 md:px-10 md:pb-12 md:pt-8`}>
          <Outlet />
        </main>
      </div>
      {!focusMode && (
        <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
          {TABS.map(t => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}
              className={({ isActive }) => `flex min-h-16 flex-1 items-center justify-center border-t-[3px] text-[15px] no-underline ${isActive ? 'border-rose font-bold text-rose' : 'border-transparent font-medium text-muted'}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
