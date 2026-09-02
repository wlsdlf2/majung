import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import logoMark from '../assets/logo-mark.svg'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        await signIn(username, password)
      } else {
        await signUp(username, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="card w-full max-w-sm p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-paper">
            <img src={logoMark} alt="마중 로고" className="h-9 w-9" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-ink">마중</h1>
          <p className="mt-1 text-xs text-ink-faint">말씀을 먼저 만나는 시간</p>
        </div>

        <p className="mb-7 text-center text-sm leading-relaxed text-ink-muted">
          {mode === 'signin' ? '로그인해서 이번 주 나눔을 준비해요.' : '새 계정을 만들어요.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-ink-soft">아이디</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="field w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-ink-soft">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="field w-full"
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {mode === 'signin' ? '로그인' : '회원가입'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-5 w-full text-center text-sm text-ink-muted hover:text-accent"
        >
          {mode === 'signin' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
        </button>
      </div>
    </div>
  )
}
