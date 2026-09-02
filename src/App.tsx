import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { ContentEditorPage } from './pages/ContentEditorPage'
import { HistoryPage } from './pages/HistoryPage'
import { LoginPage } from './pages/LoginPage'
import { ThisWeekPage } from './pages/ThisWeekPage'

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      {children}
    </div>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (loading) return <div className="p-6 text-center text-sm text-ink-muted">불러오는 중...</div>

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ThisWeekPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppLayout>
              <HistoryPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/manage"
        element={
          <ProtectedRoute requireContentManager>
            <AppLayout>
              <ContentEditorPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
