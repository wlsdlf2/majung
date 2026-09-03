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
    .is('deleted_at', null)
    .gte('service_date', start)
    .lte('service_date', end)
    .order('service_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as WeeklyContent | null
}

export async function listPastContents(): Promise<WeeklyContent[]> {
  const { end } = getCurrentWeekRange()

  const { data, error } = await supabase
    .from('weekly_contents')
    .select(WEEKLY_CONTENT_SELECT)
    .is('deleted_at', null)
    .lte('service_date', end)
    .order('service_date', { ascending: false })

  if (error) throw error
  return (data ?? []) as WeeklyContent[]
}

export async function listDeletedContents(): Promise<WeeklyContent[]> {
  const { data, error } = await supabase
    .from('weekly_contents')
    .select(WEEKLY_CONTENT_SELECT)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as WeeklyContent[]
}

// 실제로 행을 지우지 않고 deleted_at만 세운다 — CONTENT_MANAGER의 삭제는 즉시 모든
// 사용자에게 영향을 주는 공용 자산 삭제라 실수해도 휴지통에서 되돌릴 수 있어야 한다.
export async function softDeleteWeeklyContent(id: string): Promise<void> {
  const { error } = await supabase
    .from('weekly_contents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function restoreWeeklyContent(id: string): Promise<void> {
  const { error } = await supabase
    .from('weekly_contents')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function getWeeklyContentById(id: string): Promise<WeeklyContent> {
  const { data, error } = await supabase
    .from('weekly_contents')
    .select(WEEKLY_CONTENT_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as WeeklyContent
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

async function insertQuestions(
  weeklyContentId: string,
  questions: { questionText: string; guideText: string | null }[],
): Promise<void> {
  if (questions.length === 0) return

  const rows = questions.map((q, i) => ({
    weekly_content_id: weeklyContentId,
    question_text: q.questionText,
    guide_text: q.guideText,
    sort_order: i,
  }))
  const { error } = await supabase.from('weekly_content_questions').insert(rows)
  if (error) throw error
}

// 예배일자는 등록의 고유 식별자라 수정 대상에서 제외한다. 이미지를 재업로드하면
// 원본 이미지 목록과 raw_extracted_text, 등록 유형을 함께 교체한다.
export async function updateWeeklyContent(params: {
  id: string
  passageText: string
  sermonNoteText: string
  questions: { questionText: string; guideText: string | null }[]
  images?: { rawExtractedText: string; imageUrls: string[] }
}): Promise<WeeklyContent> {
  const { id, passageText, sermonNoteText, questions, images } = params

  const { data: content, error: updateError } = await supabase
    .from('weekly_contents')
    .update({
      passage_text: passageText,
      sermon_note_text: sermonNoteText,
      ...(images
        ? { raw_extracted_text: images.rawExtractedText, sermon_note_registration_type: 'IMAGE' }
        : {}),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) throw updateError

  const { error: deleteError } = await supabase
    .from('weekly_content_questions')
    .delete()
    .eq('weekly_content_id', id)
  if (deleteError) throw deleteError

  await insertQuestions(id, questions)

  if (images) {
    const { error: deleteImagesError } = await supabase
      .from('weekly_content_images')
      .delete()
      .eq('weekly_content_id', id)
    if (deleteImagesError) throw deleteImagesError

    if (images.imageUrls.length > 0) {
      const imageRows = images.imageUrls.map((url, i) => ({
        weekly_content_id: id,
        image_url: url,
        sort_order: i,
      }))
      const { error: insertImagesError } = await supabase
        .from('weekly_content_images')
        .insert(imageRows)
      if (insertImagesError) throw insertImagesError
    }
  }

  return content as WeeklyContent
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

  await insertQuestions(content.id, questions)

  return content as WeeklyContent
}

// base64로 인코딩된 원본 이미지를 그대로 비전 LLM에 보내면 페이로드가 너무 커져
// Gemini가 503(과부하)을 반환하는 걸 확인했다. 업로드 전에 긴 변 1200px,
// JPEG 85%로 리사이즈해 페이로드를 줄인다.
async function resizeImageFile(file: File, maxDim = 1200, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  if (!blob) throw new Error('이미지를 처리할 수 없습니다.')
  return blob
}

// 설교노트 원본 이미지를 Storage에 올리고 공개 URL 목록을 순서대로 반환한다.
export async function uploadSermonNoteImages(
  serviceDate: string,
  files: File[],
): Promise<string[]> {
  const urls: string[] = []

  for (const file of files) {
    const resized = await resizeImageFile(file)
    const path = `${serviceDate}/${crypto.randomUUID()}.jpg`

    const { error } = await supabase.storage
      .from('sermon-note-images')
      .upload(path, resized, { contentType: 'image/jpeg' })
    if (error) throw error

    const { data } = supabase.storage.from('sermon-note-images').getPublicUrl(path)
    urls.push(data.publicUrl)
  }

  return urls
}

export interface ExtractedSermonNote {
  raw_extracted_text: string
  sermon_note_text: string
  questions: { question: string; guide_text: string | null }[]
}

// 업로드된 이미지 URL을 Edge Function에 전달해 비전 LLM으로 구조화한 결과를 받는다.
export async function extractSermonNote(imageUrls: string[]): Promise<ExtractedSermonNote> {
  const { data, error } = await supabase.functions.invoke<
    ExtractedSermonNote & { error?: string }
  >('extract-sermon-note', { body: { imageUrls } })

  if (error) throw error
  if (!data) throw new Error('추출 결과를 받지 못했습니다.')
  if (data.error) throw new Error(data.error)

  return data
}

export async function createImageWeeklyContent(params: {
  serviceDate: string
  passageText: string
  sermonNoteText: string
  rawExtractedText: string
  imageUrls: string[]
  questions: { questionText: string; guideText: string | null }[]
  createdBy: string
}): Promise<WeeklyContent> {
  const {
    serviceDate,
    passageText,
    sermonNoteText,
    rawExtractedText,
    imageUrls,
    questions,
    createdBy,
  } = params

  const { data: content, error: contentError } = await supabase
    .from('weekly_contents')
    .insert({
      service_date: serviceDate,
      passage_text: passageText,
      sermon_note_registration_type: 'IMAGE',
      sermon_note_text: sermonNoteText,
      raw_extracted_text: rawExtractedText,
      status: 'COMPLETED',
      created_by: createdBy,
    })
    .select()
    .single()

  if (contentError) throw contentError

  if (imageUrls.length > 0) {
    const imageRows = imageUrls.map((url, i) => ({
      weekly_content_id: content.id,
      image_url: url,
      sort_order: i,
    }))
    const { error: imagesError } = await supabase.from('weekly_content_images').insert(imageRows)
    if (imagesError) throw imagesError
  }

  await insertQuestions(content.id, questions)

  return content as WeeklyContent
}
