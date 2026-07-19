import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const { runtime, api } = vi.hoisted(() => ({
  runtime: { value: true },
  api: {
    loadServerConfig: vi.fn(),
    saveServerConfig: vi.fn(),
    login: vi.fn(),
    restoreSession: vi.fn(),
    logout: vi.fn(),
    testConnection: vi.fn(),
  },
}))

vi.mock('../bridge/tauriClient', () => ({
  isTauriRuntime: () => runtime.value,
  default: api,
}))

function Probe() {
  const auth = useAuth()
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user">{auth.user?.email || ''}</span>
      <span data-testid="error">{auth.error?.message || ''}</span>
      <button type="button" onClick={() => void auth.login({ email: 'login@example.com', password: 'password123', config: { baseUrl: 'https://gateway.example.com', chatModel: 'gpt-4o-mini' } }).catch(() => undefined)}>登录</button>
      <button type="button" onClick={() => void auth.logout()}>退出</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    cleanup()
    runtime.value = true
    api.loadServerConfig.mockReset().mockResolvedValue({ baseUrl: 'https://gateway.example.com', chatModel: 'gpt-4o-mini' })
    api.restoreSession.mockReset().mockResolvedValue({ authenticated: false, user: null })
    api.saveServerConfig.mockReset().mockResolvedValue({ baseUrl: 'https://gateway.example.com', chatModel: 'gpt-4o-mini' })
    api.login.mockReset().mockResolvedValue({ authenticated: true, user: { id: 'u1', email: 'login@example.com', displayName: '登录用户' } })
    api.logout.mockReset().mockResolvedValue(undefined)
  })

  it('restores a valid desktop session on startup', async () => {
    api.restoreSession.mockResolvedValue({ authenticated: true, user: { id: 'u1', email: 'saved@example.com', displayName: '已保存用户' } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('user')).toHaveTextContent('saved@example.com')
  })

  it('updates auth state after login and logout', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(api.saveServerConfig).toHaveBeenCalled()
    expect(api.login).toHaveBeenCalledWith('login@example.com', 'password123')
    fireEvent.click(screen.getByRole('button', { name: '退出' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(api.logout).toHaveBeenCalled()
  })

  it('exposes gateway errors without leaving a fake authenticated state', async () => {
    api.login.mockRejectedValue({ code: 'unauthorized', message: '邮箱或密码错误', retryable: false })
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('邮箱或密码错误'))
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
  })
})
