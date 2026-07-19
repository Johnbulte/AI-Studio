import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { useAuth } from '../state/AuthContext'

vi.mock('../state/AuthContext', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

function setup(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  const value = {
    status: 'authenticated' as const,
    user: { id: 'u1', email: 'user@example.com', displayName: '测试用户' },
    isPreviewMode: false,
    error: null,
    serverConfig: { baseUrl: 'https://gateway.example.com', chatModel: 'gpt-4o-mini' },
    login: vi.fn(),
    previewLogin: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    saveServerConfig: vi.fn(),
    testConnection: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
    ...overrides,
  }
  mockedUseAuth.mockReturnValue(value)
  return value
}

describe('SettingsPage', () => {
  beforeEach(() => {
    cleanup()
    window.localStorage.clear()
    mockedUseAuth.mockReset()
  })

  it('uses generic settings copy without exposing provider details', () => {
    setup()
    render(<SettingsPage onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 工作区' })).toBeInTheDocument()
    expect(screen.queryByText(/多米|API/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/API|服务地址|聊天模型/)).not.toBeInTheDocument()
  })

  it('checks the hidden connection and shows generic success feedback', async () => {
    const auth = setup()
    render(<SettingsPage onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '检查连接' }))
    await waitFor(() => expect(auth.testConnection).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent('连接正常')
  })

  it('keeps provider error details out of the visible feedback', async () => {
    const auth = setup({ testConnection: vi.fn().mockRejectedValue({ code: 'rate_limited', message: 'provider.example.com: too many requests', retryable: true }) })
    render(<SettingsPage onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '检查连接' }))
    await waitFor(() => expect(auth.testConnection).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toHaveTextContent('服务繁忙，请稍后重试')
    expect(screen.queryByText(/provider\.example\.com|too many requests/)).not.toBeInTheDocument()
  })

  it('toggles preferences and saves them locally', async () => {
    setup()
    render(<SettingsPage onBack={vi.fn()} />)
    const toggle = await screen.findByRole('switch', { name: /恢复上次工作区/ })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(await screen.findByRole('status')).toHaveTextContent('偏好已更新')
    expect(window.localStorage.getItem('ai-studio-preferences')).toContain('"restoreWorkspace":false')
  })
})
