/**
 * Day timelines, ticks, the pending list and duplicate-topic checks.
 * Pure functions: no database, easy to test.
 */
import type { AppEvent, PlanTask, StudyDay } from './types'
import { templateTasks } from '../content/tasks'
import { live } from './progress'

export const tasksOf = (d: StudyDay): PlanTask[] => d.tasks ?? templateTasks(d.mode, d.q_core || 60)

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
export const fromMin = (n: number) => `${String(Math.floor(((n % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((n % 60) + 60) % 60).padStart(2, '0')}`
export const pretty = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
export const hours = (min: number) => (min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min / 60} h`)

export type Timed = PlanTask & { start: string; end: string }

/** Tasks run back to back from the day's start; a task with a fixed time resets the clock. */
export function timeline(tasks: PlanTask[], dayStart: string): Timed[] {
  let clock = toMin(dayStart)
  return tasks.filter(t => !t.moved_to).map(t => {
    if (t.at) clock = toMin(t.at)
    const start = clock; clock += Math.max(0, t.minutes)
    return { ...t, start: fromMin(start), end: fromMin(clock) }
  })
}

/** Ticks are 'step' events: { day, task }. The newest non-voided state wins. */
export function ticked(events: AppEvent[], day: string): Set<string> {
  const s = new Set<string>()
  for (const e of live(events)) if (e.kind === 'step' && e.payload.day === day && e.payload.task) s.add(String(e.payload.task))
  return s
}

export const needsTick = (t: PlanTask) => t.kind !== 'break' && !t.optional && !t.moved_to && !t.dismissed

export interface PendingItem { day: StudyDay; task: PlanTask }
/** Unticked, required tasks from past days (from the day Azka joined). */
export function pending(days: StudyDay[], events: AppEvent[], today: string, since: string): PendingItem[] {
  const out: PendingItem[] = []
  for (const d of days) {
    if (d.day >= today || d.day < since) continue
    const done = ticked(events, d.day)
    for (const t of tasksOf(d)) if (needsTick(t) && !done.has(t.id)) out.push({ day: d, task: t })
  }
  return out
}

export function dayProgress(d: StudyDay, events: AppEvent[]) {
  const req = tasksOf(d).filter(needsTick)
  const done = ticked(events, d.day)
  const n = req.filter(t => done.has(t.id)).length
  return { done: n, total: req.length }
}

// ---- duplicate / similar topics ----
const STOP = new Set(['and', 'the', 'of', 'a', 'to', 'in', 'for', 'with', 'day', 'review', 'practice', 'application', 'full', 'i', 'ii', '1', '2', '3'])
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
  .filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/(ies|es|s)$/, ''))

export function similarDays(topic: string, days: StudyDay[], exceptDay?: string): StudyDay[] {
  const a = new Set(words(topic)); if (!a.size) return []
  return days.filter(d => d.day !== exceptDay).filter(d => {
    const b = new Set(words(d.topic)); if (!b.size) return false
    const same = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 5 && (x.startsWith(y) || y.startsWith(x)))
    const common = [...a].filter(w => [...b].some(v => same(w, v))).length
    return common / Math.min(a.size, b.size) >= 0.5
  })
}

/** Search topic, notes and task titles. */
export function searchDays(q: string, days: StudyDay[]): StudyDay[] {
  const needle = q.trim().toLowerCase(); if (!needle) return days
  return days.filter(d => [d.topic, d.instructions, ...tasksOf(d).map(t => `${t.title} ${t.detail ?? ''}`)].join(' ').toLowerCase().includes(needle))
}
