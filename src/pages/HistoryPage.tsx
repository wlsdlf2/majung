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

  if (loading) return <div className="p-6 text-center text-gray-500">불러오는 중...</div>

  const selected = contents.find((c) => c.id === selectedId)
  const sortedQuestions = [...(selected?.questions ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-lg font-semibold text-gray-900">지난 기록</h1>

      {contents.length === 0 && (
        <p className="text-sm text-gray-400">등록된 기록이 없습니다.</p>
      )}

      <div className="flex flex-col gap-2">
        {contents.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
            className={`rounded-xl border p-3 text-left text-sm shadow-sm ${
              selectedId === c.id
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-transparent bg-white hover:border-gray-200'
            }`}
          >
            <span className="font-medium text-gray-900">{c.service_date}</span>
            <p className="mt-1 line-clamp-1 text-xs text-gray-500">
              {c.passage_text || '본문 없음'}
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-6 space-y-4">
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-gray-500">나의 묵상</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-800">
              {reflection?.meditation_note || '작성한 묵상이 없습니다.'}
            </p>
          </section>

          {sortedQuestions.map((q, i) => {
            const answer = reflection?.answers?.find((a) => a.question_id === q.id)
            return (
              <section key={q.id} className="rounded-xl bg-white p-4 shadow-sm">
                <p className="mb-2 text-sm font-medium text-gray-900">
                  {i + 1}. {q.question_text}
                </p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {answer?.answer_text || '작성한 답변이 없습니다.'}
                </p>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
