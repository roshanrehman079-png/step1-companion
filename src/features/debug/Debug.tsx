// Hidden helper page (#/debug) for troubleshooting. Shows what the app has loaded; changes nothing
// except letting you void a wrong log entry.
import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { askMochi } from '../chat/Ask'
import { configured } from '../../lib/supabase'
import { live } from '../../lib/progress'
import pkg from '../../../package.json'

export default function Debug() {
  const { session, profile, days, events, notes, grants, owners, today, growth, voidEvent, refresh } = useApp()
  const info = {
    version: pkg.version, configured, today, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    user: session?.user.id, email: session?.user.email, role: profile?.role, onboarded: profile?.onboarded_at,
    counts: { days: days.length, events: events.length, liveEvents: live(events).length, notes: notes.length, grants: grants.length, owners: owners.length },
    growth: { total: growth.total, stage: growth.stage.key },
  }
  const text = JSON.stringify(info, null, 2)
  const [ask, setAsk] = useState('')
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="h1">Debug</h1>
      <pre className="card overflow-x-auto text-sm">{text}</pre>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(text)}>Copy</button>
        <button type="button" className="btn-secondary" onClick={refresh}>Reload data</button>
        <button type="button" className="btn-secondary" onClick={async () => { setAsk('Asking…'); const r = await askMochi([{ role: 'user', text: 'Say hello in five words.' }], today); setAsk(r.ok ? `OK: ${r.data.text}` : `${r.message} | ${r.detail}`) }}>Test Ask</button>
      </div>
      {ask && <pre className="card whitespace-pre-wrap break-all text-sm">{ask}</pre>}
      <h2 className="h2">Last 30 events</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {[...events].reverse().slice(0, 30).map(e => (
          <li key={e.id} className={`card flex items-center justify-between gap-2 text-sm ${e.voided ? 'opacity-50' : ''}`}>
            <code className="break-all">{e.local_date} {e.kind} {JSON.stringify(e.payload)}{e.voided ? ' (voided)' : ''}</code>
            {!e.voided && <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => voidEvent(e.id)}>Void</button>}
          </li>))}
      </ul>
    </div>
  )
}
