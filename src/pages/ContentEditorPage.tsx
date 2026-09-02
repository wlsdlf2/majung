import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { createTextWeeklyContent } from '../lib/api'
import { getCurrentWeekRange } from '../lib/date'

interface QuestionDraft {
  questionText: string
  guideText: string
}

export function ContentEditorPage() {
  const { profile } = useAuth()
  const [mode, setMode] = useState<'TEXT' | 'IMAGE'>('TEXT')
  const [serviceDate, setServiceDate] = useState('')
  const [passageText, setPassageText] = useState('')
  const [sermonNoteText, setSermonNoteText] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ questionText: '', guideText: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function updateQuestion(index: number, field: keyof QuestionDraft, value: string) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)))
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { questionText: '', guideText: '' }])
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(null)
    setSuccess(false)

    const { end } = getCurrentWeekRange()
    if (serviceDate > end) {
      setError(`예배일자는 이번 주 일요일(${end})까지만 등록할 수 있어요. 다음 주 콘텐츠는 그 주가 되면 등록해주세요.`)
      return
    }

    setSubmitting(true)
    try {
      await createTextWeeklyContent({
        serviceDate,
        passageText,
        sermonNoteText,
        questions: questions
          .filter((q) => q.questionText.trim().length > 0)
          .map((q) => ({ questionText: q.questionText, guideText: q.guideText || null })),
        createdBy: profile.id,
      })
      setSuccess(true)
      setServiceDate('')
      setPassageText('')
      setSermonNoteText('')
      setQuestions([{ questionText: '', guideText: '' }])
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-5 pb-16">
      <h1 className="mb-5 font-serif text-xl font-bold text-ink">콘텐츠 등록</h1>

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

      {mode === 'IMAGE' ? (
        <p className="card text-sm leading-relaxed text-ink-muted">
          이미지 업로드 + AI 추출 기능은 Edge Function 프롬프트 설계 이후 연결될 예정입니다. (기획문서 9절)
          지금은 텍스트 등록을 이용해주세요.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-ink-soft">예배일자</label>
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              required
              className="field w-full"
            />
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

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-ink-soft">설교노트 (마크다운 지원)</label>
            <textarea
              value={sermonNoteText}
              onChange={(e) => setSermonNoteText(e.target.value)}
              rows={6}
              className="field w-full resize-none"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-ink-soft">나눔 질문</label>
            {questions.map((q, i) => (
              <div key={i} className="card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-faint">질문 {i + 1}</span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(i)}
                      className="text-xs text-red-700 hover:underline"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <input
                  value={q.questionText}
                  onChange={(e) => updateQuestion(i, 'questionText', e.target.value)}
                  placeholder="질문 내용"
                  className="field w-full"
                />
                <input
                  value={q.guideText}
                  onChange={(e) => updateQuestion(i, 'guideText', e.target.value)}
                  placeholder="해설/예시답변 (선택)"
                  className="field w-full"
                />
              </div>
            ))}
            <button type="button" onClick={addQuestion} className="text-sm font-bold text-accent hover:text-accent-hover">
              + 질문 추가
            </button>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}
          {success && <p className="text-sm text-sage">등록되었습니다.</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? '등록 중...' : '등록'}
          </button>
        </form>
      )}
    </div>
  )
}
