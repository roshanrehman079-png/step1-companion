// Shared data shapes. Database columns are snake_case; these mirror them.

export type Mode = 'BOOK' | 'QUESTION' | 'NBME' | 'NBME REVIEW' | 'RECOVERY' |
  'FREE 120' | 'FREE 120 REVIEW' | 'TAPER' | 'EXAM'
export type Mood = 'motivated' | 'okay' | 'bored' | 'distracted' | 'overwhelmed' | 'tired'
export type ChatLevel = 'quiet' | 'normal'

export interface Profile {
  user_id: string
  role: 'learner' | 'supporter'
  display_name: string
  cat_name: string
  exam_date: string | null
  exam_confirmed: boolean
  daily_hours: number
  qbank_start: number
  track_mode: 'percent' | 'pages'
  water_goal_ml: number | null
  chat_level: ChatLevel
  ai_enabled: boolean
  onboarded_at: string | null
}

export interface StudyDay {
  id: string
  day: string            // YYYY-MM-DD
  mode: Mode
  topic: string
  instructions: string
  book_subject: string | null
  book_target_pct: number | null
  q_core: number
  q_stretch: number
  locked: boolean
  rest_protected: boolean
  extra: { carry?: { subject: string; pct: number; from: string }[] }
}

export type EventKind = 'checkin' | 'rest' | 'step' | 'book' | 'qblock' | 'qreview' | 'water' |
  'pet' | 'focus' | 'note_review' | 'assessment' | 'wrap'

export interface AppEvent {
  id: string
  client_request_id: string
  local_date: string
  kind: EventKind
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>
  voided: boolean
  created_at: string
}

export interface Note {
  id: string
  body: string
  subject: string | null
  why: string | null
  source: string | null
  created_at: string
  due_date: string
  step: number
  archived: boolean
}

export interface Grant {
  id: string
  invite_email: string
  supporter_id: string | null
  status: 'pending' | 'active' | 'revoked'
  permissions: SharePermissions
  created_at: string
}

export interface SharePermissions {
  plan: boolean       // this week's plan
  days: boolean       // days studied this week
  topics: boolean     // chapters covered
  mochi: boolean      // Mochi's stage
  countdown: boolean  // days to exam
  cheers: boolean     // allow cheers
}

export const DEFAULT_PERMISSIONS: SharePermissions = {
  plan: true, days: true, topics: true, mochi: true, countdown: true, cheers: true,
}
