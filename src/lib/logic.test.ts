import { describe, expect, it } from 'vitest'
import { chapterStatus, questionsStatus, recommendToday, proposeBookCatchUp } from './planner'
import { questionTotals, bookPercents, waterOn, goalFor, live } from './progress'
import { pointsByDay, stageFor, drName } from './growth'
import type { AppEvent, StudyDay } from './types'

let n = 0
const ev = (kind: AppEvent['kind'], payload: AppEvent['payload'], date = '2026-11-20', extra: Partial<AppEvent> = {}): AppEvent => ({
  id: `e${++n}`, client_request_id: `r${n}`, local_date: date, kind, payload, voided: false,
  created_at: `${date}T10:${String(n % 60).padStart(2, '0')}:00Z`, ...extra,
})

describe('handoff reference assertions (planner_reference.test.ts)', () => {
  it('book shortfall: 60/120 pages with 75% target', () => {
    const b = chapterStatus({ subjectId: 'biochemistry', absolutePages: 60, totalPages: 120, targetCumulativePercent: 75 })
    expect(b.percentComplete).toBe(50); expect(b.pagesBehindTarget).toBe(30)
    expect(b.chapterPagesRemaining).toBe(60); expect(b.behindTargetPercentPoints).toBe(25)
  })
  it('retried question session does not double count', () => {
    const s = { id: 'q1', freshAnswered: 50, flaggedForReview: 30, flaggedReviewed: 20 }
    expect(questionsStatus(2600, [s, s])).toEqual({ freshAnswered: 50, flagged: 30, reviewed: 20, reviewPending: 10, qbankRemaining: 2550 })
  })
  it('mood changes size, never day type', () => {
    const d = recommendToday({ mode: 'BOOK', mood: 'distracted', availableWindowMinutes: 480, defaultCoreFresh: 60, stretchCeilingFresh: 80, pendingFlaggedReviews: 10 })
    expect(d.recommendedFresh).toBe(0); expect(d.firstSprintMinutes).toBe(25)
    expect(recommendToday({ mode: 'QUESTION', mood: 'motivated', availableWindowMinutes: 480, defaultCoreFresh: 60, stretchCeilingFresh: 80, pendingFlaggedReviews: 0 }).recommendedFresh).toBe(60)
    const o = recommendToday({ mode: 'QUESTION', mood: 'overwhelmed', availableWindowMinutes: 480, defaultCoreFresh: 60, stretchCeilingFresh: 80, pendingFlaggedReviews: 10 })
    expect(o.recommendedFresh).toBeLessThanOrEqual(30); expect(o.firstSprintMinutes).toBe(10)
  })
  it('catch-up only lands on future reading days with room', () => {
    const p = proposeBookCatchUp({ todayDate: '2026-11-19', observedMinutesPerPage: 3,
      progress: { subjectId: 'biochemistry', totalPages: 120, absolutePages: 60, targetCumulativePercent: 75 },
      futureDays: [
        { date: '2026-11-20', mode: 'QUESTION', protected: false, availableFocusMinutes: 390, allocatedFocusMinutes: 0 },
        { date: '2026-11-25', mode: 'BOOK', protected: false, availableFocusMinutes: 390, allocatedFocusMinutes: 300 },
        { date: '2026-12-17', mode: 'NBME', protected: true, availableFocusMinutes: 390, allocatedFocusMinutes: 0 }] })
    expect(p.proposedMoves).toHaveLength(1); expect(p.proposedMoves[0].toDate).toBe('2026-11-25'); expect(p.proposedMoves[0].units).toBe(30)
  })
  it('no room means honest unplaced warning', () => {
    const p = proposeBookCatchUp({ todayDate: '2026-11-19', observedMinutesPerPage: 3,
      progress: { subjectId: 'b', totalPages: 120, absolutePages: 60, targetCumulativePercent: 75 },
      futureDays: [{ date: '2026-11-25', mode: 'BOOK', protected: false, availableFocusMinutes: 390, allocatedFocusMinutes: 390 }] })
    expect(p.proposedMoves).toHaveLength(0); expect(p.unplaced[0].units).toBe(30); expect(p.warnings.length).toBeGreaterThan(0)
  })
  it('unknown pace refuses to invent a slot', () => {
    const p = proposeBookCatchUp({ todayDate: '2026-11-19', progress: { subjectId: 'b', absolutePercent: 50, targetCumulativePercent: 75 },
      futureDays: [{ date: '2026-11-25', mode: 'BOOK', protected: false, availableFocusMinutes: 390, allocatedFocusMinutes: 0 }] })
    expect(p.unplaced[0].units).toBe(25); expect(p.warnings).toContain('pace-unknown')
  })
})

describe('event-derived progress', () => {
  it('50 fresh, 30 flagged, 20 reviewed: 2550 left, 10 pending, not 70', () => {
    const e = [ev('qblock', { fresh: 50, wrong: 30 }), ev('qreview', { reviewed: 20 })]
    const t = questionTotals(e, 2600)
    expect(t.freshAnswered).toBe(50); expect(t.reviewPending).toBe(10); expect(t.qbankRemaining).toBe(2550)
  })
  it('same request id twice counts once', () => {
    const a = ev('qblock', { fresh: 20, wrong: 5 })
    expect(questionTotals([a, { ...a, id: 'dup' }], 2600).freshAnswered).toBe(20)
  })
  it('correction: voided entry stops counting', () => {
    const e = [ev('qblock', { fresh: 50, wrong: 0 }, '2026-11-20', { voided: true }), ev('qblock', { fresh: 40, wrong: 0 })]
    expect(questionTotals(e, 2600).freshAnswered).toBe(40)
  })
  it('book percent is absolute: latest wins', () => {
    const e = [ev('book', { subject: 'bio', pct: 40 }), ev('book', { subject: 'bio', pct: 50 })]
    expect(bookPercents(e).bio).toBe(50)
  })
  it('water 250 + 350 = 600, undo 350 = 250', () => {
    const a = ev('water', { ml: 250 }), b = ev('water', { ml: 350 })
    expect(waterOn([a, b], '2026-11-20')).toBe(600)
    expect(waterOn([a, { ...b, voided: true }], '2026-11-20')).toBe(250)
  })
  it('live() drops voided', () => { expect(live([ev('pet', {}, undefined, { voided: true })])).toHaveLength(0) })
})

const qday: StudyDay = { id: 'd', day: '2026-11-20', mode: 'QUESTION', topic: 'x', instructions: '', book_subject: null,
  book_target_pct: null, q_core: 60, q_stretch: 80, locked: false, rest_protected: false, extra: {} }
const bday: StudyDay = { ...qday, mode: 'BOOK', book_subject: 'bio', book_target_pct: 100, q_core: 0, q_stretch: 0 }

describe('goals by mood', () => {
  it('okay practice day: 60', () => { expect(goalFor(qday, 'okay', [], 8, 2600).target).toBe(60) })
  it('distracted reading day shrinks the goal but stays a reading day', () => {
    const g = goalFor(bday, 'distracted', [], 8, 2600)
    expect(g.kind).toBe('book'); expect(g.target).toBe(75)
  })
  it('rest day has no target', () => { expect(goalFor(qday, 'rest', [], 8, 2600).kind).toBe('rest') })
})

describe('growth', () => {
  it('rest earns, repeated pets and water are capped, nothing negative', () => {
    const e = [ev('rest', {}), ev('pet', {}), ev('pet', {}), ...Array.from({ length: 6 }, () => ev('water', { ml: 250 }))]
    const d = pointsByDay(e, new Set())[0]
    expect(d.total).toBe(10 + 3)
  })
  it('question volume earns nothing by itself', () => {
    expect(pointsByDay([ev('qblock', { fresh: 200, wrong: 0 })], new Set())[0].total).toBe(0)
  })
  it('stages', () => {
    expect(stageFor(0).stage.key).toBe('kitten'); expect(stageFor(260).stage.key).toBe('intern'); expect(stageFor(900).stage.key).toBe('doctor')
  })
  it('always a doctor', () => { expect(drName('Mochi')).toBe('Dr. Mochi'); expect(drName('Dr. Paws')).toBe('Dr. Paws') })
})
