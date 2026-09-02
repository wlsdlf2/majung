import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function NavBar() {
  const { profile, signOut } = useAuth()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded-md ${
      isActive ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1">
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
        className="text-sm text-gray-400 hover:text-gray-700"
      >
        로그아웃
      </button>
    </nav>
  )
}
