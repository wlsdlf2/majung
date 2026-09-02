import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function NavBar() {
  const { profile, signOut } = useAuth()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center border-b-2 px-1 py-3 text-sm ${
      isActive
        ? 'border-accent font-bold text-accent'
        : 'border-transparent text-ink-muted hover:text-ink-soft'
    }`

  return (
    <nav className="flex items-center justify-between border-b border-hairline bg-paper px-4">
      <div className="flex items-stretch gap-4">
        <NavLink to="/" className={linkClass} end>
          이번 주
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          지난 기록
        </NavLink>
        {profile?.role === 'CONTENT_MANAGER' && (
          <NavLink to="/manage" className={linkClass}>
            콘텐츠 등록
          </NavLink>
        )}
      </div>
      <button
        onClick={() => void signOut()}
        className="px-1 py-3 text-sm text-ink-faint hover:text-ink-muted"
      >
        로그아웃
      </button>
    </nav>
  )
}
