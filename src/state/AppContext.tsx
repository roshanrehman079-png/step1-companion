/**
 * App state and every database write. Screens call these actions; they never talk to
 * Supabase directly, so debugging starts here. Each write waits for the server before
 * the UI shows it as saved.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, newId } from '../lib/supabase'
import type { AppEvent, EventKind, Grant, Note, Profile, SharePermissions, StudyDay } from '../lib/types'
import { DEFAULT_PERMISSIONS } from '../lib/types'
import { addDays, localDate, weekOf } from '../lib/dates'
import { bookPercents, goalMet, moodOn, onDate } from '../lib/progress'
import { pointsByDay, stageFor, drName } from '../lib/growth'
import { line, type MochiMoment } from '../content/mochi'
import type { CatMood } from '../components/catArt'
import plan from '../data/plan.json'

export interface Bubble { text: string; mood: CatMood; key: number }
export interface Cheer { id: string; from_name: string; message: string; created_at: string; seen: boolean }
type Owner = { owner_id: string; name: string }

interface Ctx {
  session: Session | null
  ready: boolean
  error: string | null
  setError: (e: string | null) => void
  profile: Profile | null
  days: StudyDay[]
  events: AppEvent[]
  notes: Note[]
  grants: Grant[]
  cheers: Cheer[]
  owners: Owner[]
  today: string
  focusMode: boolean
  setFocusMode: (b: boolean) => void
  bubble: Bubble | null
  say: (m: MochiMoment, mood?: CatMood, vars?: Record<string, string>, force?: boolean) => void
  catName: string
  growth: ReturnType<typeof computeGrowth>
  logEvent: (kind: EventKind, payload?: AppEvent['payload'], date?: string) => Promise<AppEvent | null>
  voidEvent: (id: string) => Promise<void>
  saveProfile: (patch: Partial<Profile>) => Promise<boolean>
  completeOnboarding: (p: Partial<Profile>) => Promise<boolean>
  addNote: (n: Pick<Note, 'body'> & Partial<Note>) => Promise<boolean>
  reviewNote: (n: Note, remembered: boolean) => Promise<void>
  archiveNote: (id: string) => Promise<void>
  invite: (email: string) => Promise<boolean>
  setGrant: (id: string, patch: Partial<Pick<Grant, 'status' | 'permissions'>>) => Promise<void>
  removeGrant: (id: string) => Promise<void>
  markCheersSeen: () => Promise<void>
  addCarry: (target: StudyDay, carry: { subject: string; pct: number; from: string }) => Promise<boolean>
  restoreVersion: (id: string) => Promise<boolean>
  versions: { id: string; created_at: string; reason: string }[]
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('useApp outside provider'); return c }

function computeGrowth(events: AppEvent[], days: StudyDay[], profile: Profile | null) {
  const goalDates = new Set<string>()
  if (profile) for (const d of days) {
    const mood = moodOn(events, d.day)
    if (onDate(events, d.day).length && goalMet(d, mood, events, profile.daily_hours, profile.qbank_start)) goalDates.add(d.day)
  }
  const byDay = pointsByDay(events, goalDates)
  const total = byDay.reduce((a, d) => a + d.total, 0)
  return { byDay, total, ...stageFor(total), goalDates }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [days, setDays] = useState<StudyDay[]>([])
  const [events, setEvents] = useState<AppEvent[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [cheers, setCheers] = useState<Cheer[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [versions, setVersions] = useState<Ctx['versions']>([])
  const [focusMode, setFocusMode] = useState(false)
  const [bubble, setBubble] = useState<Bubble | null>(null)
  const [today, setToday] = useState(localDate())
  const uid = session?.user.id

  // Keep "today" correct if the app stays open past midnight.
  useEffect(() => { const t = setInterval(() => setToday(localDate()), 60_000); return () => clearInterval(t) }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const fail = (msg: string, e?: unknown) => { console.error(msg, e); setError(`${msg}. Please try again.`) }

  const refresh = useCallback(async () => {
    if (!uid) return
    try {
      await supabase.rpc('claim_invites')
      const [p, d, e, n, g, c, o, v] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('study_days').select('*').order('day'),
        supabase.from('events').select('*').order('created_at'),
        supabase.from('notes').select('*').eq('archived', false).order('due_date'),
        supabase.from('grants').select('*').eq('owner_id', uid).order('created_at'),
        supabase.from('cheers').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.rpc('my_owners'),
        supabase.from('plan_versions').select('id, created_at, reason').order('created_at', { ascending: false }).limit(20),
      ])
      const firstErr = [p, d, e, n, g, c, o, v].find(r => r.error)?.error
      if (firstErr) throw firstErr
      setProfile((p.data as Profile) ?? null)
      setDays((d.data as StudyDay[]) ?? [])
      setEvents((e.data as AppEvent[]) ?? [])
      setNotes((n.data as Note[]) ?? [])
      setGrants((g.data as Grant[]) ?? [])
      setCheers((c.data as Cheer[]) ?? [])
      setOwners((o.data as Owner[]) ?? [])
      setVersions((v.data as Ctx['versions']) ?? [])
    } catch (err) { fail('Could not load your data', err) }
    finally { setReady(true) }
  }, [uid])

  useEffect(() => { if (uid) { setReady(false); refresh() } }, [uid, refresh])

  const catName = drName(profile?.cat_name ?? 'Mochi')
  const growth = useMemo(() => computeGrowth(events, days, profile), [events, days, profile])

  // ---- Dr. Mochi speaking: quiet during focus; "quiet" setting only allows important moments.
  const bubbleTimer = useRef<number | undefined>(undefined)
  const say: Ctx['say'] = useCallback((m, mood = 'content', vars = {}, force = false) => {
    if (focusMode && !force) return
    const important: MochiMoment[] = ['morning', 'levelUp', 'goalMet', 'cheer', 'overwhelmed', 'rest', 'welcomeBack']
    if (profile?.chat_level === 'quiet' && !important.includes(m) && !force) return
    setBubble({ text: line(m, { name: profile?.display_name || 'Azka', cat: catName, ...vars }, Date.now()), mood, key: Date.now() })
    window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 6000)
  }, [focusMode, profile, catName])

  // ---- writes
  const logEvent: Ctx['logEvent'] = async (kind, payload = {}, date = today) => {
    const row = { client_request_id: newId(), local_date: date, kind, payload }
    const { data, error: err } = await supabase.from('events').insert(row).select().single()
    if (err) { fail('Could not save', err); return null }
    setEvents(prev => [...prev, data as AppEvent])
    return data as AppEvent
  }
  const voidEvent: Ctx['voidEvent'] = async (id) => {
    const { error: err } = await supabase.from('events').update({ voided: true }).eq('id', id)
    if (err) return fail('Could not undo', err)
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, voided: true } : e)))
  }
  const saveProfile: Ctx['saveProfile'] = async (patch) => {
    if (!uid) return false
    const { data, error: err } = await supabase.from('profiles').update(patch).eq('user_id', uid).select().single()
    if (err) { fail('Could not save settings', err); return false }
    setProfile(data as Profile); return true
  }
  const completeOnboarding: Ctx['completeOnboarding'] = async (p) => {
    if (!uid) return false
    const { data, error: err } = await supabase.from('profiles').upsert({ ...p, user_id: uid, role: 'learner', onboarded_at: new Date().toISOString() }).select().single()
    if (err) { fail('Could not save your setup', err); return false }
    const { count } = await supabase.from('study_days').select('id', { count: 'exact', head: true })
    if (!count) {
      const rows = plan.days.map(d => ({ day: d.date, mode: d.mode, topic: d.topic, instructions: d.instructions,
        book_subject: d.bookSubject, book_target_pct: d.bookTargetPct, q_core: d.qCore, q_stretch: d.qStretch,
        locked: d.locked, rest_protected: d.restProtected, extra: {} }))
      const ins = await supabase.from('study_days').insert(rows).select()
      if (ins.error) { fail('Could not create your plan', ins.error); return false }
      await supabase.from('plan_versions').insert({ reason: 'Starting plan', snapshot: ins.data })
    }
    setProfile(data as Profile); await refresh(); return true
  }
  const addNote: Ctx['addNote'] = async (n) => {
    const { data, error: err } = await supabase.from('notes').insert({ due_date: addDays(today, 1), ...n }).select().single()
    if (err) { fail('Could not save the note', err); return false }
    setNotes(prev => [...prev, data as Note]); return true
  }
  const INTERVALS = [1, 3, 7, 14]
  const reviewNote: Ctx['reviewNote'] = async (n, remembered) => {
    const step = remembered ? Math.min(n.step + 1, INTERVALS.length - 1) : 0
    const patch = { step, due_date: addDays(today, remembered ? INTERVALS[step] : 1) }
    const { error: err } = await supabase.from('notes').update(patch).eq('id', n.id)
    if (err) return fail('Could not update the note', err)
    setNotes(prev => prev.map(x => (x.id === n.id ? { ...x, ...patch } : x)))
    await logEvent('note_review', { note: n.id, remembered })
  }
  const archiveNote: Ctx['archiveNote'] = async (id) => {
    const { error: err } = await supabase.from('notes').update({ archived: true }).eq('id', id)
    if (err) return fail('Could not archive', err)
    setNotes(prev => prev.filter(x => x.id !== id))
  }
  const invite: Ctx['invite'] = async (email) => {
    const { data, error: err } = await supabase.from('grants').insert({ invite_email: email.trim().toLowerCase(), permissions: DEFAULT_PERMISSIONS }).select().single()
    if (err) { fail(err.code === '23505' ? 'That email is already invited' : 'Could not send the invite', err); return false }
    setGrants(prev => [...prev, data as Grant]); return true
  }
  const setGrant: Ctx['setGrant'] = async (id, patch) => {
    const full = { ...patch, ...(patch.status === 'revoked' ? { revoked_at: new Date().toISOString() } : {}) }
    const { error: err } = await supabase.from('grants').update(full).eq('id', id)
    if (err) return fail('Could not update sharing', err)
    setGrants(prev => prev.map(g => (g.id === id ? { ...g, ...patch } as Grant : g)))
  }
  const removeGrant: Ctx['removeGrant'] = async (id) => {
    const { error: err } = await supabase.from('grants').delete().eq('id', id)
    if (err) return fail('Could not remove', err)
    setGrants(prev => prev.filter(g => g.id !== id))
  }
  const markCheersSeen = async () => {
    const ids = cheers.filter(c => !c.seen).map(c => c.id)
    if (!ids.length) return
    await supabase.from('cheers').update({ seen: true }).in('id', ids)
    setCheers(prev => prev.map(c => ({ ...c, seen: true })))
  }
  const snapshot = async (reason: string) => {
    const { error: err } = await supabase.from('plan_versions').insert({ reason, snapshot: days })
    if (err) throw err
  }
  const addCarry: Ctx['addCarry'] = async (target, carry) => {
    try {
      await snapshot(`Before adding ${carry.pct}% ${carry.subject} to ${target.day}`)
      const extra = { ...target.extra, carry: [...(target.extra.carry ?? []), carry] }
      const { error: err } = await supabase.from('study_days').update({ extra }).eq('id', target.id)
      if (err) throw err
      await refresh(); return true
    } catch (e) { fail('Could not change the plan', e); return false }
  }
  const restoreVersion: Ctx['restoreVersion'] = async (id) => {
    try {
      const { data, error: err } = await supabase.from('plan_versions').select('snapshot').eq('id', id).single()
      if (err) throw err
      await snapshot('Before undo')
      const rows = (data.snapshot as StudyDay[]).map(({ id: _id, ...r }) => r)
      const up = await supabase.from('study_days').upsert(rows, { onConflict: 'owner_id,day' })
      if (up.error) throw up.error
      await refresh(); return true
    } catch (e) { fail('Could not restore that version', e); return false }
  }

  // ---- shareable summary: only whitelisted fields, refreshed when progress changes.
  useEffect(() => {
    if (!uid || profile?.role !== 'learner' || !days.length) return
    const t = window.setTimeout(async () => {
      const week = weekOf(today)
      const planWeek = days.filter(d => week.includes(d.day)).map(d => ({ day: d.day, mode: d.mode, topic: d.topic,
        done: d.day < today ? onDate(events, d.day).some(e => ['wrap', 'step', 'qblock', 'book', 'rest'].includes(e.kind)) : null }))
      const studied = planWeek.filter(d => d.done && d.day <= today).length
      const planned = planWeek.filter(d => d.day <= today).length
      const pct = bookPercents(events)
      const subjects = (plan.subjects as { id: string; name: string }[]).map(s => ({ name: s.name, pct: pct[s.id] ?? 0 }))
      const exam = profile.exam_date
      const data = {
        name: profile.display_name || 'Azka', cat_name: catName, updated_at: new Date().toISOString(),
        plan: planWeek, days: { studied, planned }, topics: subjects,
        mochi: { stage: growth.stage.key, title: growth.stage.title },
        countdown: exam ? { exam, confirmed: profile.exam_confirmed, daysLeft: Math.max(0, Math.round((new Date(exam).getTime() - new Date(today).getTime()) / 86400000)) } : null,
      }
      await supabase.from('public_summary').upsert({ owner_id: uid, data, updated_at: new Date().toISOString() })
    }, 1500)
    return () => window.clearTimeout(t)
  }, [uid, profile, days, events, today, catName, growth.stage.key, growth.stage.title])

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); setEvents([]); setDays([]); setNotes([]) }

  const value: Ctx = { session, ready, error, setError, profile, days, events, notes, grants, cheers, owners, today,
    focusMode, setFocusMode, bubble, say, catName, growth, logEvent, voidEvent, saveProfile, completeOnboarding,
    addNote, reviewNote, archiveNote, invite, setGrant, removeGrant, markCheersSeen, addCarry, restoreVersion,
    versions, refresh, signOut }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export type { SharePermissions }
