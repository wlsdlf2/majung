import { getCurrentWeekRange } from './date'
import { supabase } from './supabase'
import type { Reflection, WeeklyContent } from '../types'

const WEEKLY_CONTENT_SELECT = `
  *,
  questions:weekly_content_questions(*),
  images:weekly_content_images(*)
`

export async function getThisWeekContent(): Promise<WeeklyContent | null> {
  const { start, end } = getCurrentWeekRange()

  const { data, error } = await supabase
    .from('weekly_contents')
    .select(WEEKLY_CONTENT_SELECT)
    .gte('service_date', start)
    .lte('service_date', end)
    .order('service_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as WeeklyContent | null
}

export async function listPastContents(): Promise<WeeklyContent[]> {
  const { data, error } = await supabase
    .from('weekly_contents')
    .select(WEEKLY_CONTENT_SELECT)
    .order('service_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as WeeklyContent[]
}

export async function getReflection(
  userId: string,
  weeklyContentId: string,
): Promise<Reflection | null> {
  const { data, error } = await supabase
    .from('reflections')
    .select('*, answers:reflection_answers(*)')
    .eq('user_id', userId)
    .eq('weekly_content_id', weeklyContentId)
    .maybeSingle()

  if (error) throw error
  return data as Reflection | null
}

export async function saveReflection(params: {
  userId: string
  weeklyContentId: string
  meditationNote: string
  answers: { questionId: string; answerText: string }[]
}): Promise<void> {
  const { userId, weeklyContentId, meditationNote, answers } = params

  const { data: reflection, error: upsertError } = await supabase
    .from('reflections')
    .upsert(
      { user_id: userId, weekly_content_id: weeklyContentId, meditation_note: meditationNote },
      { onConflict: 'user_id,weekly_content_id' },
    )
    .select()
    .single()

  if (upsertError) throw upsertError

  const rows = answers.map((a) => ({
    reflection_id: reflection.id,
    question_id: a.questionId,
    answer_text: a.answerText,
  }))

  if (rows.length > 0) {
    const { error: answersError } = await supabase
      .from('reflection_answers')
      .upsert(rows, { onConflict: 'reflection_id,question_id' })
    if (answersError) throw answersError
  }
}

export async function createTextWeeklyContent(params: {
  serviceDate: string
  passageText: string
  sermonNoteText: string
  questions: { questionText: string; guideText: string | null }[]
  createdBy: string
}): Promise<WeeklyContent> {
  const { serviceDate, passageText, sermonNoteText, questions, createdBy } = params

  const { data: content, error: contentError } = await supabase
    .from('weekly_contents')
    .insert({
      service_date: serviceDate,
      passage_text: passageText,
      sermon_note_registration_type: 'TEXT',
      sermon_note_text: sermonNoteText,
      status: 'COMPLETED',
      created_by: createdBy,
    })
    .select()
    .single()

  if (contentError) throw contentError

  if (questions.length > 0) {
    const rows = questions.map((q, i) => ({
      weekly_content_id: content.id,
      question_text: q.questionText,
      guide_text: q.guideText,
      sort_order: i,
    }))
    const { error: questionsError } = await supabase.from('weekly_content_questions').insert(rows)
    if (questionsError) throw questionsError
  }

  return content as WeeklyContent
}
