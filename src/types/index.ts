export type Role = 'MEMBER' | 'CONTENT_MANAGER'

export type SermonNoteRegistrationType = 'TEXT' | 'IMAGE'

export type WeeklyContentStatus = 'PASSAGE_ONLY' | 'PENDING_REVIEW' | 'COMPLETED'

export interface AppUser {
  id: string
  username: string
  role: Role
  created_at: string
}

export interface WeeklyContentQuestion {
  id: string
  weekly_content_id: string
  question_text: string
  guide_text: string | null
  sort_order: number
}

export interface WeeklyContentImage {
  id: string
  weekly_content_id: string
  image_url: string
  sort_order: number
}

export interface WeeklyContent {
  id: string
  service_date: string
  passage_text: string | null
  sermon_note_registration_type: SermonNoteRegistrationType | null
  sermon_note_text: string | null
  raw_extracted_text: string | null
  status: WeeklyContentStatus
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  questions?: WeeklyContentQuestion[]
  images?: WeeklyContentImage[]
}

export interface ReflectionAnswer {
  id: string
  reflection_id: string
  question_id: string
  answer_text: string | null
}

export interface Reflection {
  id: string
  user_id: string
  weekly_content_id: string
  meditation_note: string | null
  created_at: string
  updated_at: string
  answers?: ReflectionAnswer[]
}
