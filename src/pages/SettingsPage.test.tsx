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
    logout: vi.fn(),
    saveServerConfig: vi.fn().mockResolvedValue({ baseUrl: 'https://gateway.example.com', chatModel: 'gpt-4o-mini' }),
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
    mockedUseAuth.mockReset()
  })

  it('saves the service configuration and shows success feedback', async () => {
    const auth = setup()
    render(<SettingsPage onBack={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('服务地址'), { target: { value: 'https://new-gateway.example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }))
    await waitFor(() => expect(auth.saveServerConfig).toHaveBeenCalledWith({ baseUrl: 'https://new-gateway.example.com', chatModel: 'gpt-4o-mini' }))
    expect(await screen.findByRole('status')).toHaveTextContent('配置已保存')
  })

  it('keeps connection errors separate from save feedback', async () => {
    const auth = setup({ testConnection: vi.fn().mockRejectedValue({ code: 'rate_limited', message: '请求太频繁，请稍后再试', retryable: true }) })
    render(<SettingsPage onBack={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))
    await waitFor(() => expect(auth.testConnection).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toHaveTextContent('请求太频繁，请稍后再试')
  })

  it('shows the Duomi media API configuration form and keeps the key out of feedback', async () => {
    setup()
    render(<SettingsPage onBack={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('多米 API Key'), { target: { value: 'duomi-secret' } })
    fireEvent.click(screen.getByRole('button', { name: '保存多米配置' }))
    expect(await screen.findByRole('status')).toHaveTextContent('多米 API 配置已保存')
    expect(screen.queryByText('duomi-secret')).not.toBeInTheDocument()
    expect(screen.getByLabelText('多米 API Key')).toHaveValue('')
  })
})
