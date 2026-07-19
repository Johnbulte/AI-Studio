import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ChatWorkspace from './ChatWorkspace'

const { handlers, startChat, cancelChat } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown) => void>(),
  startChat: vi.fn().mockResolvedValue({ requestId: 'request-1', conversationId: 'conversation-1', messageId: 'message-2' }),
  cancelChat: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../bridge/tauriClient', () => ({
  isTauriRuntime: () => true,
  default: {
    listConversations: vi.fn().mockResolvedValue([]),
    loadConversation: vi.fn().mockResolvedValue([]),
    createConversation: vi.fn().mockResolvedValue('conversation-1'),
    startChat,
    cancelChat,
    listenChatEvent: vi.fn((eventName: string, handler: (event: unknown) => void) => {
      handlers.set(eventName, handler)
      return Promise.resolve(() => handlers.delete(eventName))
    }),
  },
}))

describe('ChatWorkspace', () => {
  beforeEach(() => {
    cleanup()
    handlers.clear()
    startChat.mockClear()
    startChat.mockImplementation(() => Promise.resolve({ requestId: `request-${startChat.mock.calls.length}`, conversationId: 'conversation-1', messageId: `message-${startChat.mock.calls.length + 1}` }))
    cancelChat.mockClear()
  })

  afterEach(cleanup)

  it('renders SSE deltas into the assistant message and marks it complete', async () => {
    render(<ChatWorkspace />)
    const input = await screen.findByRole('textbox', { name: '输入你的想法' })
    fireEvent.change(input, { target: { value: '写一段品牌文案' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(startChat).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument())
    handlers.get('delta')?.({ requestId: 'request-1', conversationId: 'conversation-1', messageId: 'message-2', delta: '你好', cancelled: false, error: null })
    handlers.get('delta')?.({ requestId: 'request-1', conversationId: 'conversation-1', messageId: 'message-2', delta: '，世界', cancelled: false, error: null })
    handlers.get('completed')?.({ requestId: 'request-1', conversationId: 'conversation-1', messageId: 'message-2', delta: null, cancelled: false, error: null })

    expect(await screen.findByText('你好，世界')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止生成' })).not.toBeInTheDocument()
  })

  it('cancels an active request', async () => {
    render(<ChatWorkspace />)
    const input = await screen.findByRole('textbox', { name: '输入你的想法' })
    fireEvent.change(input, { target: { value: '继续生成' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '停止生成' }))
    await waitFor(() => expect(cancelChat).toHaveBeenCalledWith('request-1'))
  })

  it('preserves partial output and exposes a retry action after failure', async () => {
    render(<ChatWorkspace />)
    const input = await screen.findByRole('textbox', { name: '输入你的想法' })
    fireEvent.change(input, { target: { value: '生成活动标题' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument())
    handlers.get('delta')?.({ requestId: 'request-1', conversationId: 'conversation-1', messageId: 'message-2', delta: '部分内容', cancelled: false, error: null })
    handlers.get('failed')?.({ requestId: 'request-1', conversationId: 'conversation-1', messageId: 'message-2', delta: null, cancelled: false, error: { code: 'network_error', message: '网络中断', retryable: true } })
    expect(await screen.findByText('部分内容')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('网络中断')
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(startChat).toHaveBeenCalledTimes(2))
  })

  it('keeps chat usable in explicit local preview mode', async () => {
    render(<ChatWorkspace previewMode />)
    const input = await screen.findByRole('textbox', { name: '输入你的想法' })
    fireEvent.change(input, { target: { value: '预览一条消息' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(await screen.findByText('预览一条消息')).toBeInTheDocument()
    expect(startChat).not.toHaveBeenCalled()
  })
})
