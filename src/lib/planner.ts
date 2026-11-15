/**
 * Pure planning maths, ported from the handoff's tested planner_reference.ts.
 * No UI, no database. Every plan change it suggests needs the learner's OK.
 * It never predicts passing or failing.
 */
import type { Mode, Mood } from './types'

export const MOOD_MULTIPLIER: Record<Mood, number> = {
  motivated: 1, okay: 1, bored: 0.9, distracted: 0.75, overwhelmed: 0.5, tired: 0.5,
}
export const MOOD_SPRINT: Record<Mood, number> = {
  motivated: 50, okay: 45, bored: 25, distracted: 25, overwhelmed: 10, tired: 15,
}

const nonNeg = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0)
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export type BookProgress = {
  subjectId: string; absolutePages?: number; totalPages?: number; absolutePercent?: number
  targetCumulativePercent: number
}

/** Chapter progress is absolute (where you are now), never added on each save. */
export function chapterStatus(p: BookProgress) {
  const validPages = p.totalPages !== undefined && p.totalPages > 0 && p.absolutePages !== undefined
  const percent = validPages ? clamp((100 * p.absolutePages!) / p.totalPages!, 0, 100) : clamp(p.absolutePercent ?? 0, 0, 100)
  const target = clamp(p.targetCumulativePercent, 0, 100)
  return {
    percentComplete: percent,
    targetPercent: target,
    behindTargetPercentPoints: Math.max(0, target - percent),
    remainingChapterPercentPoints: Math.max(0, 100 - percent),
    chapterPagesRemaining: validPages ? Math.max(0, p.totalPages! - p.absolutePages!) : null,
    pagesBehindTarget: validPages ? Math.ceil(Math.max(0, (target / 100) * p.totalPages! - p.absolutePages!)) : null,
  }
}

export type QSession = { id: string; freshAnswered: number; flaggedForReview: number; flaggedReviewed: number }

/** Repeated syncs of the same session never inflate totals. Reviews are not new questions. */
export function questionsStatus(startBankRemaining: number, sessions: QSession[]) {
  const unique = new Map<string, QSession>()
  for (const s of sessions) unique.set(s.id, s)
  let fresh = 0, flagged = 0, reviewed = 0
  for (const s of unique.values()) {
    const f = nonNeg(s.freshAnswered)
    const g = clamp(nonNeg(s.flaggedForReview), 0, f)
    const r = clamp(nonNeg(s.flaggedReviewed), 0, g)
    fresh += f; flagged += g; reviewed += r
  }
  return {
    freshAnswered: fresh, flagged, reviewed,
    reviewPending: Math.max(0, flagged - reviewed),
    qbankRemaining: Math.max(0, startBankRemaining - fresh),
  }
}

/** Today's realistic workload. Mood changes the size, never the type of day. */
export function recommendToday(input: {
  mode: Mode; mood: Mood; availableWindowMinutes: number
  defaultCoreFresh: number; stretchCeilingFresh: number; pendingFlaggedReviews: number
  focusFraction?: number; estimatedNewQuestionMinutes?: number; estimatedExtraReviewMinutes?: number
}) {
  const focusFraction = clamp(input.focusFraction ?? 0.8125, 0, 1)
  const availableFocus = nonNeg(input.availableWindowMinutes) * focusFraction
  const moodBudget = availableFocus * MOOD_MULTIPLIER[input.mood]
  const sprint = MOOD_SPRINT[input.mood]
  if (input.mode !== 'QUESTION') {
    return { mode: input.mode, focusBudgetMinutes: Math.floor(moodBudget), firstSprintMinutes: sprint,
      recommendedFresh: 0, optionalFreshStretch: 0, priorReviewMinutes: 0 }
  }
  const extraReviewMinutes = nonNeg(input.pendingFlaggedReviews) * nonNeg(input.estimatedExtraReviewMinutes ?? 3)
  const freshBudgetMinutes = Math.max(0, moodBudget - extraReviewMinutes)
  const estimatedQMinutes = Math.max(1, input.estimatedNewQuestionMinutes ?? 6)
  const feasible = Math.floor(freshBudgetMinutes / estimatedQMinutes)
  const adjustedCore = Math.floor(nonNeg(input.defaultCoreFresh) * MOOD_MULTIPLIER[input.mood])
  const feasibleCore = Math.min(feasible, adjustedCore)
  const recommendedFresh = feasibleCore >= 20 ? Math.floor(feasibleCore / 20) * 20 : feasibleCore >= 10 ? 10 : 0
  const maxStretch = Math.min(feasible, nonNeg(input.stretchCeilingFresh))
  const optionalFreshStretch = input.mood === 'motivated' ? Math.max(recommendedFresh, Math.floor(maxStretch / 20) * 20) : recommendedFresh
  return { mode: input.mode, focusBudgetMinutes: Math.floor(moodBudget), firstSprintMinutes: sprint,
    recommendedFresh, optionalFreshStretch, priorReviewMinutes: extraReviewMinutes }
}

export type FutureDaySlot = { date: string; mode: Mode; protected: boolean; availableFocusMinutes: number; allocatedFocusMinutes: number }
export type ReplanProposal = {
  requiresConfirmation: true
  proposedMoves: { toDate: string; subjectId: string; units: number; unit: 'pages' | 'percent'; reason: string }[]
  unplaced: { subjectId: string; units: number; unit: 'pages' | 'percent' }[]
  warnings: string[]
}

/** Catch-up only goes to future reading days with real free time. Otherwise it says so honestly. */
export function proposeBookCatchUp(input: {
  todayDate: string; progress: BookProgress; futureDays: FutureDaySlot[]
  observedMinutesPerPage?: number; observedMinutesPerPercentPoint?: number
}): ReplanProposal {
  const status = chapterStatus(input.progress)
  const hasPages = status.pagesBehindTarget !== null
  const outstanding = hasPages ? status.pagesBehindTarget! : status.behindTargetPercentPoints
  const unit: 'pages' | 'percent' = hasPages ? 'pages' : 'percent'
  const pace = hasPages ? input.observedMinutesPerPage : input.observedMinutesPerPercentPoint
  const proposal: ReplanProposal = { requiresConfirmation: true, proposedMoves: [], unplaced: [], warnings: [] }
  if (outstanding <= 0) return proposal
  if (pace === undefined || !Number.isFinite(pace) || pace <= 0) {
    proposal.warnings.push('pace-unknown')
    proposal.unplaced.push({ subjectId: input.progress.subjectId, units: outstanding, unit })
    return proposal
  }
  let left = outstanding
  for (const day of [...input.futureDays].sort((a, b) => a.date.localeCompare(b.date))) {
    if (left <= 0) break
    if (day.date <= input.todayDate || day.mode !== 'BOOK' || day.protected) continue
    const free = Math.max(0, day.availableFocusMinutes - day.allocatedFocusMinutes)
    const toMove = Math.min(left, Math.floor(free / pace))
    if (toMove <= 0) continue
    proposal.proposedMoves.push({ toDate: day.date, subjectId: input.progress.subjectId, units: toMove, unit,
      reason: `${free} free minutes` })
    left -= toMove
  }
  if (left > 0) {
    proposal.unplaced.push({ subjectId: input.progress.subjectId, units: left, unit })
    proposal.warnings.push('no-capacity')
  }
  return proposal
}
