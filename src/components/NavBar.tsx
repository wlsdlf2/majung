import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FAVICON_SRC = '/favicon.png'

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
        <NavLink to="/" className="flex items-center py-2 pr-1" end>
          <img src={FAVICON_SRC} alt="마중" className="h-9 w-9 rounded-lg" />
        </NavLink>
        <NavLink to="/" className={linkClass} end>
          이번 주
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          지난 기록
        </NavLink>
        {profile?.role === 'CONTENT_MANAGER' && (
          <NavLink to="/manage" className={linkClass}>
            말씀 등록
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
