// The ordered to-do list for each type of day. Edit the wording or minutes here.
// "kind" decides what happens when a step is finished:
//   review   -> asks how many flagged explanations were reviewed
//   block    -> asks how many new questions, how many wrong or unsure
//   read     -> asks where you are in the chapter (percent)
//   notes    -> opens a quick mistake note
//   score    -> asks for the practice exam score
//   plain    -> just ticks it off
import type { Mode } from '../lib/types'

export type TaskKind = 'review' | 'block' | 'read' | 'notes' | 'score' | 'plain'
export interface TaskTemplate { title: string; detail: string; minutes: number; kind: TaskKind; optional?: boolean }

export function tasksFor(mode: Mode, opts: { pendingReviews?: number; blocks?: number; topic?: string } = {}): TaskTemplate[] {
  const blocks = Math.max(0, opts.blocks ?? 3)
  switch (mode) {
    case 'QUESTION': {
      const list: TaskTemplate[] = []
      if ((opts.pendingReviews ?? 0) > 0)
        list.push({ title: `Review ${opts.pendingReviews} flagged explanations`, detail: 'From earlier blocks. Do these first.', minutes: Math.min(60, opts.pendingReviews! * 3), kind: 'review' })
      for (let i = 1; i <= blocks; i++)
        list.push({ title: `Block ${i}: 20 questions, timed`, detail: i === 1 ? '30 min, then review what you missed' : 'Take a 15-min break first', minutes: 30, kind: 'block' })
      if (blocks === 0) list.push({ title: 'One block of 10 questions', detail: 'Only if it feels okay. Stopping is fine.', minutes: 15, kind: 'block', optional: true })
      list.push({ title: 'Review your misses and write mistake notes', detail: '10 seconds per note', minutes: 60, kind: 'notes' })
      return list
    }
    case 'BOOK':
      return [
        { title: 'First Aid: first section', detail: '90 min, then a 15-min break', minutes: 90, kind: 'plain' },
        { title: 'First Aid: second section', detail: '90 min, then lunch', minutes: 90, kind: 'plain' },
        { title: 'First Aid: third section', detail: '90 min', minutes: 90, kind: 'plain' },
        { title: 'Close the book and recall', detail: 'Write or say what you remember. 60 min.', minutes: 60, kind: 'plain' },
        { title: 'Log where you got to', detail: 'Percent of the chapter, not pages added', minutes: 2, kind: 'read' },
        { title: 'Pathoma, Mehlman or Anki if useful', detail: 'Optional, about 15 min', minutes: 15, kind: 'plain', optional: true },
      ]
    case 'NBME':
    case 'FREE 120':
      return [
        { title: 'Set up: quiet room, water, snacks', detail: 'Phone away', minutes: 10, kind: 'plain' },
        { title: mode === 'NBME' ? 'Take the practice exam, timed' : 'Take the Free 120, timed', detail: 'One sitting. No checking answers.', minutes: 300, kind: 'plain' },
        { title: 'Log your score', detail: 'From the official report. Private by default.', minutes: 5, kind: 'score' },
        { title: 'Rest', detail: 'Reviewing is tomorrow', minutes: 0, kind: 'plain' },
      ]
    case 'NBME REVIEW':
    case 'FREE 120 REVIEW':
      return [
        { title: 'Go through the explanations', detail: 'Wrong and guessed ones first', minutes: 180, kind: 'plain' },
        { title: 'Write mistake notes', detail: 'One line per lesson, in your own words', minutes: 60, kind: 'notes' },
        { title: 'Pick your 3 weakest areas', detail: 'They shape the next practice days', minutes: 15, kind: 'plain' },
      ]
    case 'RECOVERY':
      return [
        { title: 'Rest', detail: 'Sleep, a walk, something nice', minutes: 0, kind: 'plain' },
        { title: 'Review due mistake notes', detail: 'Optional, a few minutes', minutes: 10, kind: 'notes', optional: true },
        { title: '20 questions, only if you feel fresh', detail: 'Optional', minutes: 30, kind: 'block', optional: true },
      ]
    case 'TAPER':
      return [
        { title: 'Confirm permit, ID and test centre', detail: 'And how you will get there', minutes: 20, kind: 'plain' },
        { title: 'Plan sleep, food and breaks', detail: 'No new material today', minutes: 15, kind: 'plain' },
        { title: 'Rest', detail: 'You have done the work', minutes: 0, kind: 'plain' },
      ]
    case 'EXAM':
      return [{ title: 'Exam day', detail: 'Breathe. Eat. You know more than you think.', minutes: 0, kind: 'plain' }]
  }
}
