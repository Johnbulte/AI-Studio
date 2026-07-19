import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { useAuth } from '../state/AuthContext'

vi.mock('../state/AuthContext', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

function setup() {
  const auth = {
    status: 'unauthenticated' as const,
    user: null,
    isPreviewMode: false,
    error: null as { code: string; message: string; retryable: boolean } | null,
    serverConfig: { baseUrl: '', chatModel: 'gpt-4o-mini' },
    login: vi.fn().mockResolvedValue(undefined),
    previewLogin: vi.fn(),
    logout: vi.fn(),
    saveServerConfig: vi.fn(),
    testConnection: vi.fn(),
    clearError: vi.fn(),
  }
  mockedUseAuth.mockReturnValue(auth)
  return auth
}

describe('LoginPage', () => {
  beforeEach(() => {
    cleanup()
    mockedUseAuth.mockReset()
  })

  it('does not call login when email or password validation fails', () => {
    const auth = setup()
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: '登录并进入工作区' }))
    expect(auth.login).not.toHaveBeenCalled()
    expect(screen.getByText('请输入邮箱')).toBeInTheDocument()
    expect(screen.getByText('请输入密码')).toBeInTheDocument()
  })

  it('submits credentials without a registration or service setup panel', async () => {
    const auth = setup()
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: '登录并进入工作区' }))
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password123' }))
    expect(screen.queryByText('服务配置')).not.toBeInTheDocument()
    expect(screen.queryByText('注册')).not.toBeInTheDocument()
  })

  it('offers local preview after the gateway cannot be reached', () => {
    const auth = setup()
    auth.error = { code: 'network_error', message: '无法连接服务', retryable: true }
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'preview@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '进入本地预览' }))
    expect(auth.previewLogin).toHaveBeenCalledWith('preview@example.com')
  })
})
