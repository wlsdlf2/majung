import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({
  children,
  requireContentManager = false,
}: {
  children: ReactNode
  requireContentManager?: boolean
}) {
  const { session, profile, loading } = useAuth()

  if (loading) return <div className="p-6 text-center text-sm text-ink-muted">불러오는 중...</div>
  if (!session) return <Navigate to="/login" replace />
  if (requireContentManager && profile?.role !== 'CONTENT_MANAGER') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
