import type { ReactNode } from 'react'
import { useAuth } from '../state/AuthContext'
import { LoginPage } from '../pages/LoginPage'

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return <main className="auth-loading" aria-live="polite">正在恢复登录状态…</main>
  }

  if (status === 'unauthenticated') return <LoginPage />

  return <>{children}</>
}
