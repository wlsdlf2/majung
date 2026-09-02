import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getReflection, listPastContents } from '../lib/api'
import type { Reflection, WeeklyContent } from '../types'

export function HistoryPage() {
  const { profile } = useAuth()
  const [contents, setContents] = useState<WeeklyContent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reflection, setReflection] = useState<Reflection | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPastContents()
      .then(setContents)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!profile || !selectedId) {
      setReflection(null)
      return
    }
    getReflection(profile.id, selectedId).then(setReflection)
  }, [profile, selectedId])

  if (loading) return <div className="p-6 text-center text-sm text-ink-muted">불러오는 중...</div>

  return (
    <div className="mx-auto max-w-2xl p-5">
      <h1 className="mb-5 font-serif text-xl font-bold text-ink">지난 기록</h1>

      {contents.length === 0 && <p className="text-sm text-ink-muted">등록된 기록이 없습니다.</p>}

      <div className="flex flex-col gap-2">
        {contents.map((c) => {
          const isSelected = selectedId === c.id
          const sortedQuestions = isSelected
            ? [...(c.questions ?? [])].sort((a, b) => a.sort_order - b.sort_order)
            : []

          return (
            <div
              key={c.id}
              className={`overflow-hidden rounded-2xl border transition-colors ${
                isSelected
                  ? 'border-accent bg-card shadow-[0_1px_2px_rgba(58,47,40,0.04),0_6px_16px_rgba(58,47,40,0.05)]'
                  : 'border-hairline bg-card hover:border-ink-faint'
              }`}
            >
              <button
                onClick={() => setSelectedId(isSelected ? null : c.id)}
                className="w-full p-4 text-left text-sm"
              >
                <span className="font-bold text-ink">{c.service_date}</span>
                <p className="mt-1 line-clamp-1 text-xs text-ink-muted">
                  {c.passage_text || '본문 없음'}
                </p>
              </button>

              {isSelected && (
                <div className="space-y-4 border-t border-hairline p-4">
                  <section>
                    <h2 className="mb-2 text-xs font-bold tracking-wide text-sage">나의 묵상</h2>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                      {reflection?.meditation_note || '작성한 묵상이 없습니다.'}
                    </p>
                  </section>

                  {sortedQuestions.map((q, i) => {
                    const answer = reflection?.answers?.find((a) => a.question_id === q.id)
                    return (
                      <section key={q.id}>
                        <p className="mb-2 text-sm font-bold leading-snug text-ink">
                          {i + 1}. {q.question_text}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                          {answer?.answer_text || '작성한 답변이 없습니다.'}
                        </p>
                      </section>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
