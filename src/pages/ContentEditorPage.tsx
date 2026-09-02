import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { createTextWeeklyContent } from '../lib/api'

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
    setSubmitting(true)
    setError(null)
    setSuccess(false)
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
    <div className="mx-auto max-w-2xl p-4 pb-16">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">콘텐츠 등록</h1>

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setMode('TEXT')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === 'TEXT' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          텍스트로 등록
        </button>
        <button
          onClick={() => setMode('IMAGE')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === 'IMAGE' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          이미지로 등록
        </button>
      </div>

      {mode === 'IMAGE' ? (
        <p className="rounded-xl bg-white p-4 text-sm text-gray-500 shadow-sm">
          이미지 업로드 + AI 추출 기능은 Edge Function 프롬프트 설계 이후 연결될 예정입니다. (기획문서 9절)
          지금은 텍스트 등록을 이용해주세요.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">예배일자</label>
            <input
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">본문 말씀</label>
            <textarea
              value={passageText}
              onChange={(e) => setPassageText(e.target.value)}
              rows={4}
              required
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">설교노트 (마크다운 지원)</label>
            <textarea
              value={sermonNoteText}
              onChange={(e) => setSermonNoteText(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">나눔 질문</label>
            {questions.map((q, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">질문 {i + 1}</span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(i)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <input
                  value={q.questionText}
                  onChange={(e) => updateQuestion(i, 'questionText', e.target.value)}
                  placeholder="질문 내용"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <input
                  value={q.guideText}
                  onChange={(e) => updateQuestion(i, 'guideText', e.target.value)}
                  placeholder="해설/예시답변 (선택)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addQuestion}
              className="text-sm text-indigo-600 hover:underline"
            >
              + 질문 추가
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">등록되었습니다.</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
        </form>
      )}
    </div>
  )
}
