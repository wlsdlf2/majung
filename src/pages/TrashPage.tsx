import { useEffect, useState } from 'react'
import { listDeletedContents, restoreWeeklyContent } from '../lib/api'
import type { WeeklyContent } from '../types'

export function TrashPage() {
  const [contents, setContents] = useState<WeeklyContent[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setContents(await listDeletedContents())
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleRestore(id: string) {
    setError(null)
    setRestoringId(id)
    try {
      await restoreWeeklyContent(id)
      setContents((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      setError(
        code === '23505'
          ? '같은 예배일자로 이미 등록된 콘텐츠가 있어 복구할 수 없습니다. 먼저 그 콘텐츠를 정리해주세요.'
          : err instanceof Error
            ? err.message
            : '복구에 실패했습니다.',
      )
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) return <div className="p-6 text-center text-sm text-ink-muted">불러오는 중...</div>

  return (
    <div className="mx-auto max-w-2xl p-5">
      <h1 className="mb-5 font-serif text-xl font-bold text-ink">휴지통</h1>

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      {contents.length === 0 && (
        <p className="text-sm text-ink-muted">삭제된 콘텐츠가 없습니다.</p>
      )}

      <div className="flex flex-col gap-2">
        {contents.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-card p-4"
          >
            <div className="min-w-0">
              <span className="font-bold text-ink">{c.service_date}</span>
              <p className="mt-1 line-clamp-1 text-xs text-ink-muted">{c.passage_text || '본문 없음'}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRestore(c.id)}
              disabled={restoringId === c.id}
              className="shrink-0 text-sm font-bold text-accent hover:text-accent-hover"
            >
              {restoringId === c.id ? '복구 중...' : '복구'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
