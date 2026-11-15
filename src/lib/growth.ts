/**
 * Mochi's growth. Points reward showing up, reviewing mistakes and resting.
 * Question volume never earns points. Points never go down.
 * Change the numbers in POINTS / STAGES to rebalance.
 */
import type { AppEvent } from './types'
import { live } from './progress'

export const POINTS = {
  checkin: 5,        // once a day
  goal: 10,          // once a day, whatever size the goal was
  review: 5,         // once a day, reviewed flagged explanations
  note: 3,           // per mistake note reviewed, max NOTE_CAP a day
  rest: 10,          // a planned rest day
  water: 1,          // per log, max WATER_CAP a day
  wrap: 2,           // closed the day
} as const
export const NOTE_CAP = 10
export const WATER_CAP = 3

export const STAGES = [
  { key: 'kitten', title: 'Kitten', at: 0 },
  { key: 'student', title: 'Med student', at: 100 },
  { key: 'intern', title: 'Intern', at: 250 },
  { key: 'resident', title: 'Resident', at: 450 },
  { key: 'doctor', title: 'Attending', at: 700 },
] as const
export type StageKey = typeof STAGES[number]['key']

export type DayPoints = { date: string; items: { label: string; points: number }[]; total: number }

/** goalDates: dates on which the day's goal was met (computed by the caller). */
export function pointsByDay(events: AppEvent[], goalDates: Set<string>): DayPoints[] {
  const byDate = new Map<string, AppEvent[]>()
  for (const e of live(events)) byDate.set(e.local_date, [...(byDate.get(e.local_date) ?? []), e])
  for (const d of goalDates) if (!byDate.has(d)) byDate.set(d, [])
  const out: DayPoints[] = []
  for (const [date, list] of [...byDate.entries()].sort()) {
    const items: DayPoints['items'] = []
    const has = (k: AppEvent['kind']) => list.some(e => e.kind === k)
    if (has('checkin')) items.push({ label: 'Checked in', points: POINTS.checkin })
    if (has('rest')) items.push({ label: 'Took a rest day', points: POINTS.rest })
    else if (goalDates.has(date)) items.push({ label: "Finished today's goal", points: POINTS.goal })
    if (has('qreview')) items.push({ label: 'Reviewed explanations', points: POINTS.review })
    const notes = Math.min(NOTE_CAP, list.filter(e => e.kind === 'note_review').length)
    if (notes) items.push({ label: `${notes} mistake note${notes > 1 ? 's' : ''} reviewed`, points: notes * POINTS.note })
    const water = Math.min(WATER_CAP, list.filter(e => e.kind === 'water' && Number(e.payload.ml) > 0).length)
    if (water) items.push({ label: 'Logged water', points: water * POINTS.water })
    if (has('wrap')) items.push({ label: 'Closed the day', points: POINTS.wrap })
    out.push({ date, items, total: items.reduce((a, i) => a + i.points, 0) })
  }
  return out
}

export function stageFor(points: number) {
  let i = 0
  for (let k = 0; k < STAGES.length; k++) if (points >= STAGES[k].at) i = k
  const next = STAGES[i + 1]
  const pct = next ? Math.round(((points - STAGES[i].at) / (next.at - STAGES[i].at)) * 100) : 100
  return { index: i, stage: STAGES[i], next, pct, toNext: next ? next.at - points : 0 }
}

/** "Dr. Mochi": the buddy is always a doctor, whatever Azka names it. */
export function drName(name: string) {
  const n = (name || 'Mochi').trim().replace(/^dr\.?\s+/i, '')
  return `Dr. ${n}`
}
