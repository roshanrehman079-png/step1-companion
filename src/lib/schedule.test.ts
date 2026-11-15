import { describe, expect, it } from 'vitest'
import { timeline, ticked, pending, similarDays, searchDays, tasksOf, pretty, hours, dayProgress } from './schedule'
import type { AppEvent, StudyDay } from './types'

const day = (d: string, mode: StudyDay['mode'], topic: string, extra: Partial<StudyDay> = {}): StudyDay => ({
  id: d, day: d, mode, topic, instructions: '', book_subject: null, book_target_pct: null, q_core: 60, q_stretch: 80,
  locked: false, rest_protected: false, extra: {}, tasks: null, start_time: null, ...extra })
let n = 0
const tick = (d: string, task: string, voided = false): AppEvent => ({ id: `e${++n}`, client_request_id: `r${n}`, local_date: d, kind: 'step',
  payload: { day: d, task }, voided, created_at: '2026-11-20T10:00:00Z' })

describe('timeline', () => {
  it('runs tasks back to back from the start time', () => {
    const tl = timeline([{ id: 'a', title: 'A', minutes: 90, kind: 'plain' }, { id: 'b', title: 'B', minutes: 15, kind: 'break' }, { id: 'c', title: 'C', minutes: 60, kind: 'plain' }], '08:00')
    expect(tl.map(t => `${t.start}-${t.end}`)).toEqual(['08:00-09:30', '09:30-09:45', '09:45-10:45'])
  })
  it('a fixed time moves the following tasks', () => {
    const tl = timeline([{ id: 'a', title: 'A', minutes: 60, kind: 'plain' }, { id: 'b', title: 'B', minutes: 30, kind: 'plain', at: '14:00' }, { id: 'c', title: 'C', minutes: 30, kind: 'plain' }], '09:00')
    expect(tl.map(t => t.start)).toEqual(['09:00', '14:00', '14:30'])
  })
  it('formats', () => { expect(pretty('13:05')).toBe('1:05 pm'); expect(pretty('00:30')).toBe('12:30 am'); expect(hours(90)).toBe('1 h 30 min') })
})

describe('templates include Anki and Mehlman', () => {
  it('reading day', () => { const t = tasksOf(day('2026-11-19', 'BOOK', 'Biochemistry')).map(x => x.title).join('|'); expect(t).toMatch(/Anki/); expect(t).toMatch(/Mehlman/) })
  it('practice day blocks follow the question target', () => { expect(tasksOf(day('2026-11-20', 'QUESTION', 'x', { q_core: 40 })).filter(t => t.kind === 'block')).toHaveLength(2) })
})

describe('ticks and pending', () => {
  const d1 = day('2026-11-18', 'BOOK', 'Biochemistry'), d2 = day('2026-11-19', 'QUESTION', 'Biochemistry practice'), d3 = day('2026-11-20', 'BOOK', 'Immunology')
  it('untick (voided) removes the tick', () => {
    expect(ticked([tick('2026-11-18', 't1'), tick('2026-11-18', 't3', true)], '2026-11-18')).toEqual(new Set(['t1']))
  })
  it('pending lists unticked required tasks from past days only, from the join date', () => {
    const p = pending([d1, d2, d3], [tick('2026-11-19', 't1')], '2026-11-20', '2026-11-19')
    expect(p.every(i => i.day.day === '2026-11-19')).toBe(true)
    expect(p.some(i => i.task.id === 't1')).toBe(false)
    expect(p.some(i => i.task.kind === 'break' || i.task.optional)).toBe(false)
  })
  it('moved and dismissed tasks leave the pending list', () => {
    const custom = day('2026-11-19', 'BOOK', 'x', { tasks: [{ id: 'a', title: 'A', minutes: 30, kind: 'plain', moved_to: '2026-11-22' }, { id: 'b', title: 'B', minutes: 30, kind: 'plain', dismissed: true }, { id: 'c', title: 'C', minutes: 30, kind: 'plain' }] })
    expect(pending([custom], [], '2026-11-20', '2026-11-01').map(i => i.task.id)).toEqual(['c'])
    expect(dayProgress(custom, [tick('2026-11-19', 'c')])).toEqual({ done: 1, total: 1 })
  })
})

describe('similar topics and search', () => {
  const days = [day('2026-11-19', 'BOOK', 'Biochemistry'), day('2026-11-20', 'QUESTION', 'Biochemistry application'), day('2026-11-23', 'BOOK', 'Immunology'), day('2026-11-28', 'BOOK', 'General Pathology I')]
  it('finds the same subject under a different wording', () => {
    expect(similarDays('biochem pathways', days).length).toBe(2)
    expect(similarDays('Biochemistry vitamins', days).map(d => d.day)).toEqual(['2026-11-19', '2026-11-20'])
    expect(similarDays('Pathology', days).map(d => d.day)).toEqual(['2026-11-28'])
  })
  it('ignores the day being edited', () => { expect(similarDays('Immunology', days, '2026-11-23')).toHaveLength(0) })
  it('search reaches task titles', () => { expect(searchDays('mehlman', days).length).toBe(4); expect(searchDays('immuno', days).map(d => d.day)).toEqual(['2026-11-23']) })
})
