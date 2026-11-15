// UI wording that appears in more than one place. Screen-specific text sits in each screen file.
import type { Mode, Mood } from '../lib/types'

export const APP_NAME = 'Study Space'

export const DAY_TYPE: Record<Mode, { label: string; tone: 'read' | 'q' | 'exam' | 'rest' | 'real' }> = {
  BOOK: { label: 'Reading day', tone: 'read' },
  QUESTION: { label: 'Practice day', tone: 'q' },
  NBME: { label: 'Practice exam', tone: 'exam' },
  'NBME REVIEW': { label: 'Exam review', tone: 'exam' },
  'FREE 120': { label: 'Free 120', tone: 'exam' },
  'FREE 120 REVIEW': { label: 'Free 120 review', tone: 'exam' },
  RECOVERY: { label: 'Recovery', tone: 'rest' },
  TAPER: { label: 'Rest', tone: 'rest' },
  EXAM: { label: 'Exam day', tone: 'real' },
}
export const DAY_SOURCE: Partial<Record<Mode, string>> = { BOOK: 'First Aid', QUESTION: 'UWorld', NBME: 'NBME', 'NBME REVIEW': 'NBME' }

export const MOODS: { id: Mood; label: string; hint: string }[] = [
  { id: 'motivated', label: 'Motivated', hint: 'Full plan' },
  { id: 'okay', label: 'Okay', hint: 'Full plan' },
  { id: 'bored', label: 'Bored', hint: 'Shorter chunks' },
  { id: 'distracted', label: 'Distracted', hint: 'One 25-min step at a time' },
  { id: 'overwhelmed', label: 'Overwhelmed', hint: 'Start with 10 minutes' },
  { id: 'tired', label: 'Tired', hint: 'Light day or rest' },
]

export const CHEERS = ['Proud of you', "You've got this", 'Drink some water', 'Take a break', 'Thinking of you']

export const RULES = [
  { title: 'Each day has one job', body: 'Reading days are First Aid. Practice days are UWorld questions. Never both on the same day.' },
  { title: 'Nothing piles up', body: "Missed a goal or a day? It isn't added to tomorrow. The app suggests where it could fit and you decide." },
  { title: 'Your buddy grows when you look after yourself', body: "Checking in, reviewing mistakes and resting all count. Rushing through questions doesn't." },
]
