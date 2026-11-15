/**
 * Derived numbers, always computed from the event log. Nothing here is stored,
 * so a fix to an event instantly fixes every total.
 */
import type { AppEvent, Mood, StudyDay } from './types'
import { MOOD_MULTIPLIER, questionsStatus, recommendToday } from './planner'

export const live = (events: AppEvent[]) => {
  // De-duplicate by request id (a retried save never counts twice), drop voided events.
  const seen = new Map<string, AppEvent>()
  for (const e of events) if (!e.voided) seen.set(e.client_request_id, e)
  return [...seen.values()]
}
export const onDate = (events: AppEvent[], date: string) => live(events).filter(e => e.local_date === date)
export const ofKind = (events: AppEvent[], kind: AppEvent['kind']) => live(events).filter(e => e.kind === kind)

export function questionTotals(events: AppEvent[], bankStart: number) {
  const blocks = ofKind(events, 'qblock').map(e => ({
    id: e.client_request_id, freshAnswered: Number(e.payload.fresh) || 0,
    flaggedForReview: Number(e.payload.wrong) || 0, flaggedReviewed: 0,
  }))
  const base = questionsStatus(bankStart, blocks)
  const reviewed = ofKind(events, 'qreview').reduce((a, e) => a + (Number(e.payload.reviewed) || 0), 0)
  const r = Math.min(reviewed, base.flagged)
  return { ...base, reviewed: r, reviewPending: Math.max(0, base.flagged - r) }
}

/** Latest absolute chapter percent per subject (the newest entry wins, it never adds). */
export function bookPercents(events: AppEvent[]): Record<string, number> {
  const out: Record<string, number> = {}
  const sorted = ofKind(events, 'book').sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const e of sorted) out[e.payload.subject] = Math.max(0, Math.min(100, Number(e.payload.pct) || 0))
  return out
}

export function waterOn(events: AppEvent[], date: string): number {
  return onDate(events, date).filter(e => e.kind === 'water').reduce((a, e) => a + (Number(e.payload.ml) || 0), 0)
}

export function moodOn(events: AppEvent[], date: string): Mood | 'rest' | null {
  const today = onDate(events, date)
  if (today.some(e => e.kind === 'rest')) return 'rest'
  const c = today.filter(e => e.kind === 'checkin').at(-1)
  return (c?.payload.mood as Mood) ?? null
}

export function freshOn(events: AppEvent[], date: string) {
  return onDate(events, date).filter(e => e.kind === 'qblock').reduce((a, e) => a + (Number(e.payload.fresh) || 0), 0)
}

/** Today's goal, sized by mood. Type of day never changes. */
export function goalFor(day: StudyDay, mood: Mood | 'rest' | null, events: AppEvent[], dailyHours: number, bankStart: number) {
  const m: Mood = mood && mood !== 'rest' ? mood : 'okay'
  if (mood === 'rest') return { kind: 'rest' as const, target: 0, sprint: 0 }
  if (day.mode === 'QUESTION') {
    const pending = questionTotals(events.filter(e => e.local_date < day.day), bankStart).reviewPending
    const rec = recommendToday({ mode: 'QUESTION', mood: m, availableWindowMinutes: dailyHours * 60,
      defaultCoreFresh: day.q_core, stretchCeilingFresh: day.q_stretch, pendingFlaggedReviews: pending })
    return { kind: 'questions' as const, target: rec.recommendedFresh, stretch: rec.optionalFreshStretch, pending, sprint: rec.firstSprintMinutes }
  }
  if (day.mode === 'BOOK' && day.book_subject) {
    const prev = bookPercents(events.filter(e => e.local_date < day.day))[day.book_subject] ?? 0
    const full = day.book_target_pct ?? 100
    const target = Math.round(prev + (Math.max(0, full - prev)) * MOOD_MULTIPLIER[m])
    return { kind: 'book' as const, target, full, start: prev, sprint: recommendToday({ mode: 'BOOK', mood: m,
      availableWindowMinutes: dailyHours * 60, defaultCoreFresh: 0, stretchCeilingFresh: 0, pendingFlaggedReviews: 0 }).firstSprintMinutes }
  }
  return { kind: 'other' as const, target: 0, sprint: 45 }
}

export function goalMet(day: StudyDay, mood: Mood | 'rest' | null, events: AppEvent[], dailyHours: number, bankStart: number): boolean {
  const g = goalFor(day, mood, events, dailyHours, bankStart)
  if (g.kind === 'rest') return true
  if (g.kind === 'questions') return g.target > 0 && freshOn(events, day.day) >= g.target
  if (g.kind === 'book') return (bookPercents(events.filter(e => e.local_date <= day.day))[day.book_subject!] ?? 0) >= g.target
  return onDate(events, day.day).some(e => e.kind === 'wrap')
}
