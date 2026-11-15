import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { configured } from './lib/supabase'
import { useApp } from './state/AppContext'
import Layout from './components/Layout'
import { ErrorBanner, Spinner } from './components/ui'
import SignIn from './features/auth/SignIn'
import Welcome from './features/auth/Welcome'
import Onboarding from './features/onboarding/Onboarding'
import Today from './features/today/Today'
import Planner from './features/planner/Planner'
import Notes from './features/notes/Notes'
import Buddy from './features/mochi/Buddy'
import Ask from './features/chat/Ask'
import Settings from './features/settings/Settings'
import Guest from './features/guest/Guest'
import Debug from './features/debug/Debug'

function NotConfigured() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="h1">Almost there</h1>
      <p>The app isn't connected to its database yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see SETUP.md).</p>
    </main>
  )
}

function Gate() {
  const { ready, session, profile, owners } = useApp()
  if (!configured) return <NotConfigured />
  if (!session) return <SignIn />
  if (!ready) return <Spinner />
  if (profile?.role === 'learner' && profile.onboarded_at) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Today />} />
          <Route path="planner" element={<Planner />} />
          <Route path="notes" element={<Notes />} />
          <Route path="buddy" element={<Buddy />} />
          <Route path="ask" element={<Ask />} />
          <Route path="settings" element={<Settings />} />
          <Route path="debug" element={<Debug />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    )
  }
  if (owners.length) return <Routes><Route path="debug" element={<Debug />} /><Route path="*" element={<Guest />} /></Routes>
  return (
    <Routes>
      <Route path="setup" element={<Onboarding />} />
      <Route path="debug" element={<Debug />} />
      <Route path="*" element={<Welcome />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBanner />
      <Gate />
    </HashRouter>
  )
}
