import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getReflection, getThisWeekContent, saveReflection } from '../lib/api'
import type { WeeklyContent } from '../types'

export function ThisWeekPage() {
  const { profile } = useAuth()
  const [content, setContent] = useState<WeeklyContent | null>(null)
  const [meditationNote, setMeditationNote] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showRawImages, setShowRawImages] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const weekly = await getThisWeekContent()
        if (cancelled) return
        setContent(weekly)

        if (weekly) {
          const reflection = await getReflection(profile!.id, weekly.id)
          if (cancelled) return
          setMeditationNote(reflection?.meditation_note ?? '')
          const answerMap: Record<string, string> = {}
          for (const a of reflection?.answers ?? []) {
            answerMap[a.question_id] = a.answer_text ?? ''
          }
          setAnswers(answerMap)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '불러오기에 실패했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [profile])

  async function handleSave() {
    if (!profile || !content) return
    setSaving(true)
    setError(null)
    try {
      await saveReflection({
        userId: profile.id,
        weeklyContentId: content.id,
        meditationNote,
        answers: Object.entries(answers).map(([questionId, answerText]) => ({
          questionId,
          answerText,
        })),
      })
      setSavedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">불러오는 중...</div>

  if (!content) {
    return (
      <div className="p-6 text-center text-gray-500">
        아직 이번 주 본문이 등록되지 않았어요.
      </div>
    )
  }

  const sortedQuestions = [...(content.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
      <header>
        <p className="text-xs text-gray-400">{content.service_date}</p>
        <h1 className="text-lg font-semibold text-gray-900">이번 주 나눔 준비</h1>
      </header>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">본문 말씀</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
          {content.passage_text || '등록된 본문이 없습니다.'}
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">나의 묵상</h2>
        <textarea
          value={meditationNote}
          onChange={(e) => setMeditationNote(e.target.value)}
          rows={4}
          placeholder="본문을 읽고 떠오른 생각을 자유롭게 적어보세요."
          className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500">설교노트</h2>
          {(content.images?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowRawImages((v) => !v)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {showRawImages ? '정리된 내용 보기' : '원본 보기'}
            </button>
          )}
        </div>
        {showRawImages ? (
          <div className="space-y-2">
            {content.images?.map((img) => (
              <img key={img.id} src={img.image_url} alt="설교노트 원본" className="w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {content.sermon_note_text || '등록된 설교노트가 없습니다.'}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500">나눔 질문</h2>
        {sortedQuestions.length === 0 && (
          <p className="text-sm text-gray-400">아직 등록된 질문이 없습니다.</p>
        )}
        {sortedQuestions.map((q, i) => (
          <div key={q.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm font-medium text-gray-900">
              {i + 1}. {q.question_text}
            </p>
            {q.guide_text && (
              <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs text-gray-500">
                {q.guide_text}
              </p>
            )}
            <textarea
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              rows={3}
              placeholder="내 답변을 적어보세요."
              className="w-full resize-none rounded-lg border border-gray-200 p-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        ))}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-xs text-gray-400">
            {savedAt ? `${savedAt.toLocaleTimeString()}에 저장됨` : ''}
          </span>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
