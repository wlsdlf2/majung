import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

  if (loading) return <div className="p-6 text-center text-sm text-ink-muted">불러오는 중...</div>

  if (!content) {
    return (
      <div className="p-6 text-center text-sm text-ink-muted">
        아직 이번 주 본문이 등록되지 않았어요.
      </div>
    )
  }

  const sortedQuestions = [...(content.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-5 pb-28">
      <header className="flex items-start justify-between pb-1">
        <div>
          <p className="mb-1 text-xs text-ink-muted">{content.service_date}</p>
          <h1 className="font-serif text-xl font-bold text-ink">이번 주 나눔 준비</h1>
        </div>
        {profile?.role === 'CONTENT_MANAGER' && (
          <Link to={`/manage/${content.id}`} className="mt-1 text-xs font-bold text-accent hover:text-accent-hover">
            수정
          </Link>
        )}
      </header>

      <section className="card">
        <h2 className="mb-3 text-xs font-bold tracking-wide text-sage">본문 말씀</h2>
        <p className="whitespace-pre-wrap font-serif text-base leading-loose text-ink">
          {content.passage_text || '등록된 본문이 없습니다.'}
        </p>
      </section>

      <section className="card">
        <h2 className="mb-3 text-xs font-bold tracking-wide text-sage">나의 묵상</h2>
        <textarea
          value={meditationNote}
          onChange={(e) => setMeditationNote(e.target.value)}
          rows={4}
          placeholder="본문을 읽고 떠오른 생각을 자유롭게 적어보세요."
          className="field w-full resize-none leading-relaxed"
        />
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-wide text-sage">설교노트</h2>
          {(content.images?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowRawImages((v) => !v)}
              className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {showRawImages ? '정리된 내용 보기' : '원본 보기'}
            </button>
          )}
        </div>
        {showRawImages ? (
          <div className="space-y-2">
            {content.images?.map((img) => (
              <img key={img.id} src={img.image_url} alt="설교노트 원본" className="w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-loose text-ink-soft">
            {content.sermon_note_text || '등록된 설교노트가 없습니다.'}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="pt-1 text-xs font-bold text-ink-muted">나눔 질문</h2>
        {sortedQuestions.length === 0 && (
          <p className="text-sm text-ink-muted">아직 등록된 질문이 없습니다.</p>
        )}
        {sortedQuestions.map((q, i) => (
          <div key={q.id} className="card">
            <p className="mb-2.5 text-[15px] font-bold leading-snug text-ink">
              {i + 1}. {q.question_text}
            </p>
            {q.guide_text && (
              <p className="mb-3 rounded-[10px] bg-guide p-2.5 text-xs leading-relaxed text-ink-muted">
                {q.guide_text}
              </p>
            )}
            <textarea
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              rows={3}
              placeholder="내 답변을 적어보세요."
              className="field w-full resize-none"
            />
          </div>
        ))}
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-paper p-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <span className="text-xs text-ink-faint">
            {savedAt ? `${savedAt.toLocaleTimeString()}에 저장됨` : ''}
          </span>
          <button onClick={() => void handleSave()} disabled={saving} className="btn-primary flex-shrink-0 px-8">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
