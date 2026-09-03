import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  createImageWeeklyContent,
  createTextWeeklyContent,
  extractSermonNote,
  getWeeklyContentById,
  updateWeeklyContent,
  uploadSermonNoteImages,
} from '../lib/api'
import { getCurrentWeekRange } from '../lib/date'
import type { WeeklyContentImage } from '../types'

interface QuestionDraft {
  questionText: string
  guideText: string
}

function QuestionEditor({
  questions,
  onUpdate,
  onAdd,
  onRemove,
}: {
  questions: QuestionDraft[]
  onUpdate: (index: number, field: keyof QuestionDraft, value: string) => void
  onAdd: () => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-ink-soft">나눔 질문</label>
      {questions.map((q, i) => (
        <div key={i} className="card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-faint">질문 {i + 1}</span>
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-xs text-red-700 hover:underline"
              >
                삭제
              </button>
            )}
          </div>
          <input
            value={q.questionText}
            onChange={(e) => onUpdate(i, 'questionText', e.target.value)}
            placeholder="질문 내용"
            className="field w-full"
          />
          <input
            value={q.guideText}
            onChange={(e) => onUpdate(i, 'guideText', e.target.value)}
            placeholder="해설/예시답변 (선택)"
            className="field w-full"
          />
        </div>
      ))}
      <button type="button" onClick={onAdd} className="text-sm font-bold text-accent hover:text-accent-hover">
        + 질문 추가
      </button>
    </div>
  )
}

export function ContentEditorPage() {
  const { profile } = useAuth()
  const { id: editingId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditMode = Boolean(editingId)

  const [mode, setMode] = useState<'TEXT' | 'IMAGE'>('TEXT')
  const [serviceDate, setServiceDate] = useState('')
  const [passageText, setPassageText] = useState('')
  const [sermonNoteText, setSermonNoteText] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ questionText: '', guideText: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 이미지 등록 전용 상태
  const [imageStep, setImageStep] = useState<'select' | 'extracting' | 'review'>('select')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [rawExtractedText, setRawExtractedText] = useState('')
  const [showRawText, setShowRawText] = useState(false)

  // 수정 모드 전용 상태
  const [loadingContent, setLoadingContent] = useState(isEditMode)
  const [originalImages, setOriginalImages] = useState<WeeklyContentImage[]>([])
  const [reuploadImages, setReuploadImages] = useState(false)

  useEffect(() => {
    if (!editingId) return
    let cancelled = false

    async function load() {
      setLoadingContent(true)
      setError(null)
      try {
        const content = await getWeeklyContentById(editingId!)
        if (cancelled) return
        setServiceDate(content.service_date)
        setPassageText(content.passage_text ?? '')
        setSermonNoteText(content.sermon_note_text ?? '')
        setOriginalImages([...(content.images ?? [])].sort((a, b) => a.sort_order - b.sort_order))
        setReuploadImages(false)
        setImageStep('select')
        setImageFiles([])
        setImageUrls([])
        setRawExtractedText('')
        const sortedQuestions = [...(content.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order)
        setQuestions(
          sortedQuestions.length > 0
            ? sortedQuestions.map((q) => ({ questionText: q.question_text, guideText: q.guide_text ?? '' }))
            : [{ questionText: '', guideText: '' }],
        )
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '불러오기에 실패했습니다.')
      } finally {
        if (!cancelled) setLoadingContent(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [editingId])

  function updateQuestion(index: number, field: keyof QuestionDraft, value: string) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)))
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { questionText: '', guideText: '' }])
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  function resetForm() {
    setServiceDate('')
    setPassageText('')
    setSermonNoteText('')
    setQuestions([{ questionText: '', guideText: '' }])
    setImageStep('select')
    setImageFiles([])
    setImageUrls([])
    setRawExtractedText('')
    setShowRawText(false)
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files) return
    setImageFiles((prev) => [...prev, ...Array.from(files)])
  }

  function removeImageFile(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleExtract() {
    if (!serviceDate) {
      setError('먼저 예배일자를 입력해주세요.')
      return
    }
    const { end } = getCurrentWeekRange()
    if (serviceDate > end) {
      setError(`예배일자는 이번 주 일요일(${end})까지만 등록할 수 있어요.`)
      return
    }
    if (imageFiles.length === 0) {
      setError('이미지를 1장 이상 선택해주세요.')
      return
    }

    setError(null)
    setImageStep('extracting')
    try {
      const urls = await uploadSermonNoteImages(serviceDate, imageFiles)
      setImageUrls(urls)

      const extracted = await extractSermonNote(urls)
      setSermonNoteText(extracted.sermon_note_text)
      setRawExtractedText(extracted.raw_extracted_text)
      setQuestions(
        extracted.questions.length > 0
          ? extracted.questions.map((q) => ({
              questionText: q.question,
              guideText: q.guide_text ?? '',
            }))
          : [{ questionText: '', guideText: '' }],
      )
      setImageStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 추출에 실패했습니다.')
      setImageStep('select')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    setSuccess(false)

    const cleanedQuestions = questions
      .filter((q) => q.questionText.trim().length > 0)
      .map((q) => ({ questionText: q.questionText, guideText: q.guideText || null }))

    if (isEditMode && reuploadImages && imageStep !== 'review') {
      setError('새 이미지 추출을 완료하거나 재업로드를 취소해주세요.')
      return
    }

    setSubmitting(true)
    try {
      if (isEditMode) {
        await updateWeeklyContent({
          id: editingId!,
          passageText,
          sermonNoteText,
          questions: cleanedQuestions,
          images: reuploadImages ? { rawExtractedText, imageUrls } : undefined,
        })
        navigate('/history')
        return
      }

      const { end } = getCurrentWeekRange()
      if (serviceDate > end) {
        setError(`예배일자는 이번 주 일요일(${end})까지만 등록할 수 있어요. 다음 주 콘텐츠는 그 주가 되면 등록해주세요.`)
        return
      }

      if (mode === 'TEXT') {
        await createTextWeeklyContent({
          serviceDate,
          passageText,
          sermonNoteText,
          questions: cleanedQuestions,
          createdBy: profile.id,
        })
      } else {
        await createImageWeeklyContent({
          serviceDate,
          passageText,
          sermonNoteText,
          rawExtractedText,
          imageUrls,
          questions: cleanedQuestions,
          createdBy: profile.id,
        })
      }
      setSuccess(true)
      resetForm()
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code === '23505') {
        setError('이미 등록된 예배일자입니다. 날짜를 다시 확인해주세요.')
      } else {
        setError(err instanceof Error ? err.message : isEditMode ? '수정에 실패했습니다.' : '등록에 실패했습니다.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingContent) {
    return <div className="p-6 text-center text-sm text-ink-muted">불러오는 중...</div>
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16">
      <h1 className="mb-5 font-serif text-xl font-bold text-ink">{isEditMode ? '말씀 수정' : '말씀 등록'}</h1>

      {!isEditMode && (
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setMode('TEXT')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              mode === 'TEXT' ? 'bg-accent text-card' : 'bg-card text-ink-muted hover:text-ink-soft'
            }`}
          >
            텍스트로 등록
          </button>
          <button
            onClick={() => setMode('IMAGE')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              mode === 'IMAGE' ? 'bg-accent text-card' : 'bg-card text-ink-muted hover:text-ink-soft'
            }`}
          >
            이미지로 등록
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-ink-soft">예배일자</label>
          {isEditMode ? (
            <p className="field w-full text-ink-soft">{serviceDate}</p>
          ) : (
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              required
              className="field w-full"
            />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-ink-soft">본문 말씀</label>
          <textarea
            value={passageText}
            onChange={(e) => setPassageText(e.target.value)}
            rows={4}
            required
            className="field w-full resize-none"
          />
        </div>

        {isEditMode ? (
          <>
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-ink-soft">
                  {reuploadImages ? '새 이미지' : '원본 이미지'}
                </label>
                {!reuploadImages && (
                  <button
                    type="button"
                    onClick={() => {
                      setReuploadImages(true)
                      setImageStep('select')
                    }}
                    className="text-xs text-accent hover:text-accent-hover"
                  >
                    이미지 재업로드
                  </button>
                )}
              </div>

              {!reuploadImages ? (
                originalImages.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto">
                    {originalImages.map((img) => (
                      <img
                        key={img.id}
                        src={img.image_url}
                        alt="설교노트 원본"
                        className="h-32 w-24 shrink-0 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ink-faint">등록된 이미지가 없습니다.</p>
                )
              ) : imageStep === 'review' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-faint">추출 완료 (아래 설교노트에서 확인·수정해주세요)</span>
                    <button
                      type="button"
                      onClick={() => setImageStep('select')}
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      다시 선택
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {imageUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`새 이미지 ${i + 1}`}
                        className="h-32 w-24 shrink-0 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-paper file:px-3 file:py-2 file:text-sm file:font-bold file:text-ink-soft"
                  />
                  {imageFiles.length > 0 && (
                    <ul className="space-y-1">
                      {imageFiles.map((f, i) => (
                        <li key={i} className="flex items-center justify-between text-xs text-ink-muted">
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            onClick={() => removeImageFile(i)}
                            className="ml-2 shrink-0 text-red-700 hover:underline"
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleExtract()}
                      disabled={imageStep === 'extracting'}
                      className="btn-primary flex-1"
                    >
                      {imageStep === 'extracting' ? 'AI가 읽는 중...' : 'AI로 추출하기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReuploadImages(false)
                        setImageFiles([])
                      }}
                      disabled={imageStep === 'extracting'}
                      className="rounded-xl px-4 py-2.5 text-sm font-bold text-ink-muted hover:text-ink-soft"
                    >
                      취소
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-ink-soft">설교노트</label>
              <textarea
                value={sermonNoteText}
                onChange={(e) => setSermonNoteText(e.target.value)}
                rows={6}
                className="field w-full resize-none"
              />
            </div>
            <QuestionEditor
              questions={questions}
              onUpdate={updateQuestion}
              onAdd={addQuestion}
              onRemove={removeQuestion}
            />
          </>
        ) : mode === 'TEXT' ? (
          <>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-ink-soft">설교노트 (마크다운 지원)</label>
              <textarea
                value={sermonNoteText}
                onChange={(e) => setSermonNoteText(e.target.value)}
                rows={6}
                className="field w-full resize-none"
              />
            </div>
            <QuestionEditor
              questions={questions}
              onUpdate={updateQuestion}
              onAdd={addQuestion}
              onRemove={removeQuestion}
            />
          </>
        ) : (
          <div className="space-y-4">
            {imageStep !== 'review' && (
              <div className="card space-y-3">
                <label className="block text-sm font-bold text-ink-soft">설교노트 이미지</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-paper file:px-3 file:py-2 file:text-sm file:font-bold file:text-ink-soft"
                />
                {imageFiles.length > 0 && (
                  <ul className="space-y-1">
                    {imageFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs text-ink-muted">
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeImageFile(i)}
                          className="ml-2 shrink-0 text-red-700 hover:underline"
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => void handleExtract()}
                  disabled={imageStep === 'extracting'}
                  className="btn-primary w-full"
                >
                  {imageStep === 'extracting' ? 'AI가 읽는 중...' : 'AI로 추출하기'}
                </button>
              </div>
            )}

            {imageStep === 'review' && (
              <>
                <div className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-ink-soft">원본 이미지</label>
                    <button
                      type="button"
                      onClick={() => setImageStep('select')}
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      다시 업로드
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {imageUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`설교노트 원본 ${i + 1}`}
                        className="h-32 w-24 shrink-0 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-ink-soft">
                      설교노트 (AI 추출 결과, 확인·수정해주세요)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowRawText((v) => !v)}
                      className="text-xs text-ink-muted hover:text-accent"
                    >
                      {showRawText ? '정리된 내용 보기' : '추출 원문 보기'}
                    </button>
                  </div>
                  {showRawText ? (
                    <p className="field w-full whitespace-pre-wrap text-ink-soft">{rawExtractedText}</p>
                  ) : (
                    <textarea
                      value={sermonNoteText}
                      onChange={(e) => setSermonNoteText(e.target.value)}
                      rows={6}
                      className="field w-full resize-none"
                    />
                  )}
                </div>

                <QuestionEditor
                  questions={questions}
                  onUpdate={updateQuestion}
                  onAdd={addQuestion}
                  onRemove={removeQuestion}
                />
              </>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-700">{error}</p>}
        {success && <p className="text-sm text-sage">등록되었습니다.</p>}

        {(isEditMode
          ? !reuploadImages || imageStep === 'review'
          : mode === 'TEXT' || imageStep === 'review') && (
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? '저장 중...' : isEditMode ? '수정 저장' : '확정 등록'}
          </button>
        )}
      </form>
    </div>
  )
}
