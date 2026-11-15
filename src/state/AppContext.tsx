/**
 * App state and every database write. Screens call these actions; they never talk to
 * Supabase directly, so debugging starts here. Each write waits for the server before
 * the UI shows it as saved.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, newId } from '../lib/supabase'
import type { AppEvent, EventKind, Grant, Note, PlanTask, Profile, SharePermissions, StudyDay } from '../lib/types'
import { tasksOf, ticked, timeline, pending as pendingList, dayProgress } from '../lib/schedule'
import { newTaskId } from '../content/tasks'
import { DEFAULT_PERMISSIONS } from '../lib/types'
import { addDays, fmtShort, localDate, weekOf } from '../lib/dates'
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
  invite: (label: string) => Promise<Grant | null>
  setGrant: (id: string, patch: Partial<Pick<Grant, 'status' | 'permissions'>>) => Promise<void>
  removeGrant: (id: string) => Promise<void>
  markCheersSeen: () => Promise<void>
  saveDay: (d: StudyDay, patch: Partial<StudyDay>, reason: string) => Promise<boolean>
  insertDayAfter: (d: StudyDay) => Promise<boolean>
  removeDay: (d: StudyDay) => Promise<boolean>
  swapDays: (a: StudyDay, b: StudyDay) => Promise<boolean>
  tickTask: (d: StudyDay, taskId: string) => Promise<boolean>
  untickTask: (d: StudyDay, taskId: string) => Promise<void>
  moveTask: (from: StudyDay, task: PlanTask, toDate: string) => Promise<boolean>
  dismissTask: (d: StudyDay, task: PlanTask, value: boolean) => Promise<boolean>
  dismissMany: (d: StudyDay, ids: string[]) => Promise<boolean>
  claimCode: (code: string) => Promise<boolean>
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
      const code = localStorage.getItem('join-code')
      if (code) { await supabase.rpc('claim_invite_code', { p_code: code }); localStorage.removeItem('join-code') }
      const [p, d, e, n, g, c, o, v] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('study_days').select('*').order('day'),
        supabase.from('events').select('*').order('created_at'),
        supabase.from('notes').select('*').eq('archived', false).order('due_date'),
        supabase.from('grants').select('*').eq('owner_id', uid).order('created_at'),
        supabase.from('cheers').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.rpc('my_owners'),
        supabase.from('plan_versions').select('id, created_at, reason').order('created_at', { ascending: false }).limit(50),
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
  const invite: Ctx['invite'] = async (label) => {
    const { data, error: err } = await supabase.from('grants').insert({ label: label.trim(), permissions: DEFAULT_PERMISSIONS }).select().single()
    if (err) { fail('Could not create the invite', err); return null }
    setGrants(prev => [...prev, data as Grant]); return data as Grant
  }
  const claimCode: Ctx['claimCode'] = async (code) => {
    const { data, error: err } = await supabase.rpc('claim_invite_code', { p_code: code })
    if (err) { fail('Could not use that invite', err); return false }
    await refresh(); return (data as number) > 0
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
  /** Every plan change saves the previous plan first, so it can be undone from Planner > Changes. */
  const edit = async (reason: string, work: () => Promise<void>) => {
    try { await snapshot(reason); await work(); await refresh(); return true }
    catch (e) { fail('Could not change the plan', e); await refresh(); return false }
  }
  const must = <T,>(r: { error: unknown; data?: T }) => { if (r.error) throw r.error; return r.data as T }
  const saveDay: Ctx['saveDay'] = (d, patch, reason) => edit(reason, async () => {
    must(await supabase.from('study_days').update(patch).eq('id', d.id))
  })
  const insertDayAfter: Ctx['insertDayAfter'] = (d) => edit(`Added a day of ${d.topic} after ${fmtShort(d.day)}`, async () => {
    const next = addDays(d.day, 1)
    must(await supabase.rpc('shift_days', { p_from: next, p_delta: 1 }))
    must(await supabase.from('study_days').insert({ day: next, mode: d.mode, topic: d.topic, instructions: d.instructions,
      book_subject: d.book_subject, book_target_pct: d.book_target_pct, q_core: d.q_core, q_stretch: d.q_stretch,
      tasks: tasksOf(d).filter(t => !t.moved_to).map(t => ({ ...t, id: newTaskId(), from: undefined, dismissed: undefined })), start_time: d.start_time }))
  })
  const removeDay: Ctx['removeDay'] = (d) => edit(`Removed ${fmtShort(d.day)} (${d.topic}); later days moved one day earlier`, async () => {
    must(await supabase.from('study_days').delete().eq('id', d.id))
    must(await supabase.rpc('shift_days', { p_from: addDays(d.day, 1), p_delta: -1 }))
  })
  const swapDays: Ctx['swapDays'] = (a, b) => edit(`Swapped ${fmtShort(a.day)} (${a.topic}) with ${fmtShort(b.day)} (${b.topic})`, async () => {
    const body = (x: StudyDay) => ({ mode: x.mode, topic: x.topic, instructions: x.instructions, book_subject: x.book_subject, book_target_pct: x.book_target_pct,
      q_core: x.q_core, q_stretch: x.q_stretch, locked: x.locked, rest_protected: x.rest_protected, extra: x.extra, tasks: tasksOf(x), start_time: x.start_time })
    must(await supabase.from('study_days').update(body(b)).eq('id', a.id))
    must(await supabase.from('study_days').update(body(a)).eq('id', b.id))
  })
  const tickTask: Ctx['tickTask'] = async (d, taskId) => !!(await logEvent('step', { day: d.day, task: taskId }, d.day))
  const untickTask: Ctx['untickTask'] = async (d, taskId) => {
    for (const e of events) if (!e.voided && e.kind === 'step' && e.payload.day === d.day && e.payload.task === taskId) await voidEvent(e.id)
  }
  const moveTask: Ctx['moveTask'] = async (from, task, toDate) => {
    const to = days.find(x => x.day === toDate)
    if (!to) { fail('That date is not in the plan'); return false }
    return edit(`Moved "${task.title}" from ${fmtShort(from.day)} to ${fmtShort(toDate)}`, async () => {
      must(await supabase.from('study_days').update({ tasks: tasksOf(from).map(t => (t.id === task.id ? { ...t, moved_to: toDate } : t)) }).eq('id', from.id))
      must(await supabase.from('study_days').update({ tasks: [...tasksOf(to), { ...task, id: newTaskId(), from: from.day, at: undefined, moved_to: undefined }] }).eq('id', to.id))
    })
  }
  const dismissTask: Ctx['dismissTask'] = (d, task, value) => edit(`${value ? 'Let go of' : 'Brought back'} "${task.title}" (${fmtShort(d.day)})`, async () => {
    must(await supabase.from('study_days').update({ tasks: tasksOf(d).map(t => (t.id === task.id ? { ...t, dismissed: value } : t)) }).eq('id', d.id))
  })
  const dismissMany: Ctx['dismissMany'] = (d, ids) => edit(`Let go of ${ids.length} pending task${ids.length > 1 ? 's' : ''} from ${fmtShort(d.day)}`, async () => {
    must(await supabase.from('study_days').update({ tasks: tasksOf(d).map(t => (ids.includes(t.id) ? { ...t, dismissed: true } : t)) }).eq('id', d.id))
  })
  const restoreVersion: Ctx['restoreVersion'] = async (id) => {
    const v = versions.find(x => x.id === id)
    return edit(`Undo: went back to before "${v?.reason ?? 'a change'}"`, async () => { must(await supabase.rpc('restore_plan', { p_version: id })) })
  }

  // ---- shareable summary: only whitelisted fields, refreshed when progress changes.
  useEffect(() => {
    if (!uid || profile?.role !== 'learner' || !days.length) return
    const t = window.setTimeout(async () => {
      const week = weekOf(today)
      const joined = profile.onboarded_at?.slice(0, 10) ?? today
      const planAll = days.map(d => {
        const done = ticked(events, d.day); const prog = dayProgress(d, events)
        return { day: d.day, mode: d.mode, topic: d.topic, done: prog.total > 0 && prog.done === prog.total, progress: prog,
          tasks: timeline(tasksOf(d), d.start_time ?? profile.day_start ?? '08:00').map(t => ({ title: t.title, start: t.start, minutes: t.minutes,
            kind: t.kind, optional: !!t.optional, done: done.has(t.id), dismissed: !!t.dismissed, from: t.from ?? null })) }
      })
      const planWeek = planAll.filter(d => week.includes(d.day))
      const studied = planWeek.filter(d => d.day <= today && d.progress.done > 0).length
      const planned = planWeek.filter(d => d.day <= today).length
      const pct = bookPercents(events)
      const subjects = (plan.subjects as { id: string; name: string }[]).map(s => ({ name: s.name, pct: pct[s.id] ?? 0 }))
      const exam = profile.exam_date
      const data = {
        name: profile.display_name || 'Azka', cat_name: catName, updated_at: new Date().toISOString(), today,
        plan: planAll, days: { studied, planned }, topics: subjects,
        pending: pendingList(days, events, today, joined).map(p => ({ day: p.day.day, title: p.task.title })),
        changes: versions.filter(v => v.reason !== 'Starting plan').map(v => ({ at: v.created_at, reason: v.reason })),
        mochi: { stage: growth.stage.key, title: growth.stage.title },
        countdown: exam ? { exam, confirmed: profile.exam_confirmed, daysLeft: Math.max(0, Math.round((new Date(exam).getTime() - new Date(today).getTime()) / 86400000)) } : null,
      }
      await supabase.from('public_summary').upsert({ owner_id: uid, data, updated_at: new Date().toISOString() })
    }, 1500)
    return () => window.clearTimeout(t)
  }, [uid, profile, days, events, versions, today, catName, growth.stage.key, growth.stage.title])

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); setEvents([]); setDays([]); setNotes([]) }

  const value: Ctx = { session, ready, error, setError, profile, days, events, notes, grants, cheers, owners, today,
    focusMode, setFocusMode, bubble, say, catName, growth, logEvent, voidEvent, saveProfile, completeOnboarding,
    addNote, reviewNote, archiveNote, invite, setGrant, removeGrant, markCheersSeen, saveDay, insertDayAfter, removeDay, swapDays,
    tickTask, untickTask, moveTask, dismissTask, dismissMany, claimCode, restoreVersion,
    versions, refresh, signOut }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export type { SharePermissions }
