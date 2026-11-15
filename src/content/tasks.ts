// The starting to-do list for each type of day, with durations in minutes.
// Azka can change any day in the Planner; these are only the defaults.
// kind decides what happens when a task is ticked:
//   block -> asks how many questions / wrong     read  -> asks chapter percent
//   review -> asks explanations reviewed          notes -> opens a mistake note
//   score -> asks practice exam score             plain -> just ticks
//   break -> shown in the timeline, never needs ticking
import type { Mode, PlanTask, TaskKind } from '../lib/types'

type T = Omit<PlanTask, 'id'>
const t = (title: string, minutes: number, kind: TaskKind = 'plain', extra: Partial<T> = {}): T => ({ title, minutes, kind, ...extra })
const brk = (minutes = 15, title = 'Break') => t(title, minutes, 'break')

/** Ready-made tasks for the "Add" buttons in the day editor. */
export const QUICK_ADD: { label: string; task: T }[] = [
  { label: '20 questions', task: t('20 UWorld questions, timed', 35, 'block', { detail: 'Then review what you missed' }) },
  { label: 'Anki flashcards', task: t('Anki flashcards', 30, 'plain', { detail: 'Due cards for this topic' }) },
  { label: 'Mehlman PDF', task: t('Mehlman PDF for this topic', 45, 'plain', { detail: 'High-yield arrows and buzzwords' }) },
  { label: 'Pathoma', task: t('Pathoma chapter', 60, 'plain') },
  { label: 'Mistake notes', task: t('Write mistake notes', 30, 'notes') },
  { label: 'Break', task: brk(15) },
  { label: 'Custom task', task: t('New task', 30, 'plain') },
]

function template(mode: Mode, qCore: number): T[] {
  const blocks = Math.max(1, Math.round(qCore / 20))
  switch (mode) {
    case 'QUESTION': {
      const list: T[] = [t('Anki flashcards', 30, 'plain', { detail: 'Due cards first' }),
        t('Review flagged explanations', 30, 'review', { detail: 'From earlier blocks' })]
      for (let i = 1; i <= blocks; i++) {
        list.push(t(`Block ${i}: 20 questions, timed, then review`, 60, 'block'))
        list.push(i === 2 ? brk(45, 'Lunch') : brk(15))
      }
      list.push(t('Write mistake notes', 30, 'notes', { detail: '10 seconds per note' }),
        t('Mehlman PDF for weak areas', 30, 'plain', { optional: true }))
      return list
    }
    case 'BOOK':
      return [t('First Aid: first section', 90), brk(15), t('First Aid: second section', 90), brk(45, 'Lunch'),
        t('First Aid: third section', 90), brk(15), t('Mehlman PDF for this topic', 45, 'plain', { detail: 'High-yield summary' }),
        t('Close the book and recall', 45, 'plain', { detail: 'Write or say what you remember' }),
        t('Anki flashcards', 30, 'plain', { detail: 'Cards for this topic' }), t('Log where you got to', 5, 'read', { detail: 'Percent of the chapter' })]
    case 'NBME':
    case 'FREE 120':
      return [t('Set up: quiet room, water, snacks', 15), t(mode === 'NBME' ? 'Practice exam, timed, one sitting' : 'Free 120, timed', 300),
        t('Log your score', 5, 'score', { detail: 'Private by default' }), t('Rest', 60, 'plain', { detail: 'Reviewing is tomorrow' })]
    case 'NBME REVIEW':
    case 'FREE 120 REVIEW':
      return [t('Go through wrong and guessed explanations', 180), brk(45, 'Lunch'), t('Write mistake notes', 60, 'notes'),
        t('Pick your 3 weakest areas', 15), t('Anki flashcards', 30)]
    case 'RECOVERY':
      return [t('Rest, sleep, a walk', 120), t('Anki flashcards', 30, 'plain', { optional: true }),
        t('Review due mistake notes', 20, 'notes', { optional: true }), t('20 questions if you feel fresh', 35, 'block', { optional: true })]
    case 'TAPER':
      return [t('Confirm permit, ID and test centre', 20), t('Plan sleep, food and breaks', 15), t('Light Anki only', 30, 'plain', { optional: true }), t('Rest', 120)]
    case 'EXAM':
      return [t('Exam day. Breathe, eat, you know more than you think.', 480)]
  }
}

/** Template tasks get stable ids (t1, t2, ...) so ticks survive until the day is edited. */
export function templateTasks(mode: Mode, qCore = 60): PlanTask[] {
  return template(mode, qCore).map((x, i) => ({ id: `t${i + 1}`, ...x }))
}

export const newTaskId = () => `u${Math.random().toString(36).slice(2, 9)}`
