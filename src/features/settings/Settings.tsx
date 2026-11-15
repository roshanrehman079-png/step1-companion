// Settings, sharing, and data. Owner-only.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { supabase } from '../../lib/supabase'
import { Sheet } from '../../components/ui'
import type { Grant, SharePermissions } from '../../lib/types'

const SHARE_LABELS: [keyof SharePermissions, string][] = [
  ['plan', "This week's plan"], ['days', 'Days studied'], ['topics', 'Chapters covered'],
  ['mochi', "Buddy's stage"], ['countdown', 'Days to the exam'], ['cheers', 'Let them send cheers'],
]

export default function Settings() {
  const { profile, saveProfile, grants, invite, setGrant, removeGrant, signOut, session, days, events, notes, versions, catName } = useApp()
  const [label, setLabel] = useState('')
  const [fresh, setFresh] = useState<Grant | null>(null)
  const [examOpen, setExamOpen] = useState(false)
  const [newExam, setNewExam] = useState(profile?.exam_date ?? '')
  const [confirmDel, setConfirmDel] = useState('')
  const [delOpen, setDelOpen] = useState(false)
  const [saved, setSaved] = useState('')
  if (!profile) return null
  const flash = (t: string) => { setSaved(t); setTimeout(() => setSaved(''), 2500) }
  const save = async (patch: Parameters<typeof saveProfile>[0]) => { if (await saveProfile(patch)) flash('Saved') }

  const doInvite = async (e: FormEvent) => { e.preventDefault(); const g = await invite(label); if (g) { setLabel(''); setFresh(g) } }
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), schema: 1, profile, days, events, notes, versions }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `study-space-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const deleteAll = async () => { const { error } = await supabase.rpc('delete_my_data'); if (!error) { await signOut() } }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="h1">Settings and sharing</h1>
      {saved && <p role="status" className="m-0 rounded-xl bg-rest-bg px-3.5 py-2.5 text-rest-fg">{saved}</p>}

      <section className="card flex flex-col gap-4">
        <h2 className="h2 m-0">You</h2>
        <div><label htmlFor="dn" className="label">Your name</label>
          <input id="dn" className="input" defaultValue={profile.display_name} onBlur={e => e.target.value !== profile.display_name && save({ display_name: e.target.value })} /></div>
        <div><p className="label">Exam date</p>
          <p className="m-0">{profile.exam_date ? new Date(profile.exam_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set'} {profile.exam_confirmed ? '(booked)' : '(not booked yet)'}</p>
          <button type="button" className="btn-secondary mt-2" onClick={() => setExamOpen(true)}>Change exam date</button></div>
        <div><span id="hrs" className="label">Study hours on a normal day</span>
          <div role="group" aria-labelledby="hrs" className="flex flex-wrap gap-2">{[4, 6, 8, 10].map(h => <button key={h} type="button" className="chip" aria-pressed={profile.daily_hours === h} onClick={() => save({ daily_hours: h })}>{h} hours</button>)}</div></div>
        <div><label htmlFor="ds" className="label">Usual start time</label>
          <input id="ds" type="time" className="input w-40" defaultValue={profile.day_start} onBlur={e => e.target.value && e.target.value !== profile.day_start && save({ day_start: e.target.value })} />
          <p className="hint mt-1.5">The daily schedule's times count from here. You can change any single day in the Planner.</p></div>
        <div><span id="wg" className="label">Daily water goal</span>
          <div role="group" aria-labelledby="wg" className="flex flex-wrap gap-2">
            {[2000, 2500, 3000].map(w => <button key={w} type="button" className="chip" aria-pressed={profile.water_goal_ml === w} onClick={() => save({ water_goal_ml: w })}>{w.toLocaleString()} mL</button>)}
            <button type="button" className="chip" aria-pressed={profile.water_goal_ml === null} onClick={() => save({ water_goal_ml: null })}>No goal</button></div>
          <p className="hint mt-2">Your choice, not medical advice.</p></div>
        <label className="flex min-h-12 items-center justify-between gap-3"><span>Ask {catName} (AI answers)</span>
          <input type="checkbox" className="size-6 accent-rose" checked={profile.ai_enabled} onChange={e => save({ ai_enabled: e.target.checked })} /></label>
        <Link to="/buddy" className="btn-text self-start px-0">Buddy name and chattiness</Link>
      </section>

      <section className="card flex flex-col gap-4">
        <h2 className="h2 m-0">People following along</h2>
        <p className="m-0 text-muted">They can look but never change anything. Mood, notes, exam scores and water are never shared.</p>
        <form onSubmit={doInvite} className="flex gap-2">
          <label htmlFor="iv" className="sr-only">Who is this invite for?</label>
          <input id="iv" required maxLength={40} className="input flex-1" placeholder="Their name, e.g. Mum" value={label} onChange={e => setLabel(e.target.value)} />
          <button className="btn-primary">Create invite</button>
        </form>
        {fresh && <InviteLink g={fresh} />}
        {grants.length === 0 && <p className="hint m-0">Nobody yet.</p>}
        {grants.map(g => <GrantRow key={g.id} g={g} onPerm={(k, v) => setGrant(g.id, { permissions: { ...g.permissions, [k]: v } })}
          onRevoke={() => setGrant(g.id, { status: g.status === 'revoked' ? 'active' : 'revoked' })} onRemove={() => removeGrant(g.id)} />)}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="h2 m-0">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={exportData}>Download my data</button>
          <button type="button" className="btn-secondary" onClick={signOut}>Sign out</button>
          <button type="button" className="btn-secondary text-rose-dark" onClick={() => setDelOpen(true)}>Delete everything</button>
        </div>
        <p className="hint m-0">Signed in as {session?.user.email}. <Link to="/debug">Debug info</Link></p>
      </section>

      <Sheet open={examOpen} onClose={() => setExamOpen(false)} title="Change exam date">
        <p className="m-0">Now: <b>{profile.exam_date ?? 'not set'}</b>. Your plan stays as it is; this only changes the countdown. Practice exam dates never move on their own.</p>
        <div><label htmlFor="ne" className="label">New date</label><input id="ne" type="date" className="input" value={newExam} onChange={e => setNewExam(e.target.value)} /></div>
        <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="size-6 accent-rose" defaultChecked={profile.exam_confirmed} id="bk" />The date is booked</label>
        <button className="btn-primary" onClick={async () => { const booked = (document.getElementById('bk') as HTMLInputElement).checked; if (await saveProfile({ exam_date: newExam, exam_confirmed: booked })) { setExamOpen(false); flash('Exam date updated') } }}>Confirm change</button>
      </Sheet>
      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title="Delete everything?">
        <p className="m-0">This removes your plan, logs, notes and sharing for good. Download your data first if you might want it.</p>
        <div><label htmlFor="cd" className="label">Type DELETE to confirm</label><input id="cd" className="input" value={confirmDel} onChange={e => setConfirmDel(e.target.value)} /></div>
        <button className="btn-primary" disabled={confirmDel !== 'DELETE'} onClick={deleteAll}>Delete everything</button>
      </Sheet>
    </div>
  )
}

function GrantRow({ g, onPerm, onRevoke, onRemove }: { g: Grant; onPerm: (k: keyof SharePermissions, v: boolean) => void; onRevoke: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const status = g.status === 'pending' ? 'Invite link not used yet' : g.status === 'active' ? 'Can view' : 'Access paused'
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="m-0 font-semibold">{g.label || g.invite_email || "Guest"}</p><p className="hint m-0">{status}</p></div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary min-h-11 px-3.5 text-sm" aria-expanded={open} onClick={() => setOpen(o => !o)}>What they see</button>
          {g.status !== 'pending' && <button type="button" className="btn-secondary min-h-11 px-3.5 text-sm" onClick={onRevoke}>{g.status === 'revoked' ? 'Resume' : 'Pause'}</button>}
          <button type="button" className="btn-secondary min-h-11 px-3.5 text-sm" onClick={onRemove}>Remove</button>
        </div>
      </div>
      {g.status === 'pending' && <InviteLink g={g} />}
      {open && SHARE_LABELS.map(([k, label]) => (
        <label key={k} className="flex min-h-12 items-center justify-between gap-3"><span>{label}</span>
          <input type="checkbox" className="size-6 accent-rose" checked={!!g.permissions[k]} onChange={e => onPerm(k, e.target.checked)} /></label>))}
    </div>
  )
}

export const inviteUrl = (code: string) => `${window.location.origin}${window.location.pathname}#/join/${code}`

function InviteLink({ g }: { g: Grant }) {
  const [copied, setCopied] = useState(false)
  const url = inviteUrl(g.invite_code)
  const msg = `Hi${g.label ? ' ' + g.label : ''}! Follow my Step 1 progress here: ${url}  (create an account, it's free)`
  const copy = async () => { try { await navigator.clipboard.writeText(msg); setCopied(true) } catch { setCopied(false) } }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-rose-soft p-3.5">
      <p className="m-0 text-[15px]">Send this private link to {g.label || 'them'}. It works once, for one person.</p>
      <p className="m-0 break-all rounded-lg bg-surface px-3 py-2 font-mono text-sm">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary min-h-11" onClick={copy}>{copied ? 'Copied' : 'Copy message'}</button>
        <a className="btn-secondary min-h-11" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Send on WhatsApp</a>
      </div>
    </div>
  )
}
