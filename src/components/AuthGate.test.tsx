import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate'
import { useAuth } from '../state/AuthContext'

vi.mock('../state/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)
const baseAuth = {
  serverConfig: { baseUrl: '', chatModel: 'gpt-4o-mini' },
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  saveServerConfig: vi.fn(),
  testConnection: vi.fn(),
  clearError: vi.fn(),
}

describe('AuthGate', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset()
  })

  it('hides the workspace while the session is loading', () => {
    mockedUseAuth.mockReturnValue({ ...baseAuth, status: 'loading', user: null } as never)
    render(<AuthGate><div>工作区</div></AuthGate>)
    expect(screen.queryByText('工作区')).not.toBeInTheDocument()
    expect(screen.getByText('正在恢复登录状态…')).toBeInTheDocument()
  })

  it('shows the login page when no session exists', () => {
    mockedUseAuth.mockReturnValue({ ...baseAuth, status: 'unauthenticated', user: null } as never)
    render(<AuthGate><div>工作区</div></AuthGate>)
    expect(screen.queryByText('工作区')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '登录 AI Studio OS' })).toBeInTheDocument()
  })

  it('renders the workspace after authentication', () => {
    mockedUseAuth.mockReturnValue({ ...baseAuth, status: 'authenticated', user: { displayName: '测试用户' } } as never)
    render(<AuthGate><div>工作区</div></AuthGate>)
    expect(screen.getByText('工作区')).toBeInTheDocument()
  })
})
