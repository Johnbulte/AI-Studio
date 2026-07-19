import { useEffect, useRef, useState } from 'react'
import client, { isTauriRuntime, type AppError, type ChatEvent, type ChatMessage, type ConversationSummary, type MessageRecord } from '../../bridge/tauriClient'

const chatAsset = (name: string) => `/figma/chat/${name}`

const previewMessages: MessageRecord[] = [
  { id: 'preview-user', role: 'user', content: '帮我制定一份春季新品的传播计划，包含创意方向、内容建议和传播节奏。', status: 'completed', error: null, createdAt: '14:29' },
  { id: 'preview-assistant', role: 'assistant', content: '好的，先从目标受众、核心卖点和传播节奏三个层面拆解。登录桌面端并配置真实网关后，这里会显示实时生成的完整回复。', status: 'completed', error: null, createdAt: '14:30' },
]

function errorFrom(cause: unknown): AppError {
  if (typeof cause === 'object' && cause !== null && 'message' in cause) {
    const candidate = cause as Partial<AppError>
    return { code: String(candidate.code || 'unknown'), message: String(candidate.message), retryable: Boolean(candidate.retryable) }
  }
  return { code: 'unknown', message: '请求失败，请稍后重试', retryable: true }
}

function AssistantAvatar() {
  return <span className="chat-assistant-avatar" aria-hidden="true"><span /></span>
}

function ChatHistory({ conversations, selectedId, onSelect, onCreate }: { conversations: ConversationSummary[]; selectedId: string | null; onSelect: (id: string) => void; onCreate: () => void }) {
  return (
    <aside className="chat-history-panel" aria-label="最近对话">
      <header className="chat-history-header">
        <h2>最近对话</h2>
        <button className="chat-new-button" type="button" onClick={onCreate}><img src={chatAsset('new-chat-plus.svg')} alt="" />新建对话</button>
      </header>
      <div className="chat-history-scroll" aria-label="最近对话列表">
        {conversations.length === 0 && <p className="chat-history-empty">还没有对话，发送第一条消息吧。</p>}
        {conversations.map((conversation) => (
          <section className="chat-history-group" key={conversation.id}>
            <h3>本地会话</h3>
            <button className={`chat-history-item ${selectedId === conversation.id ? 'is-selected' : ''}`} type="button" onClick={() => onSelect(conversation.id)}>
              <span className="chat-history-title"><img src={chatAsset(selectedId === conversation.id ? 'history-chat-active.svg' : 'history-chat.svg')} alt="" />{conversation.title}</span>
              <time>{conversation.updatedAt}</time>
            </button>
          </section>
        ))}
      </div>
    </aside>
  )
}

function ChatMessageView({ message, onRetry }: { message: MessageRecord; onRetry: (message: MessageRecord) => void }) {
  if (message.role === 'user') {
    return (
      <article className="chat-user-block is-new-message">
        <div className="chat-user-row"><p className="chat-user-bubble">{message.content}</p><span className="chat-user-avatar"><img src={chatAsset('chat-user-avatar.jpg')} alt="用户头像" /></span></div>
        <time>{message.createdAt || '刚刚'} {message.status === 'completed' ? '✓' : ''}</time>
      </article>
    )
  }

  return (
    <article className="chat-assistant-block chat-live-assistant">
      <AssistantAvatar />
      <div className="chat-assistant-content">
        <div className="chat-assistant-intro"><p className={message.status === 'pending' ? 'is-generating' : ''}>{message.content || (message.status === 'pending' ? '正在生成…' : '')}</p><time>{message.createdAt || '刚刚'}</time></div>
        {message.error && <div className="chat-message-error" role="alert">{message.error.message}<button type="button" onClick={() => onRetry(message)}>重试</button></div>}
        {message.status === 'completed' && <footer className="chat-response-actions"><button type="button" aria-label="复制回复" onClick={() => void navigator.clipboard?.writeText(message.content)}><img src={chatAsset('copy.svg')} alt="" /></button><button type="button" aria-label="赞同回复"><img src={chatAsset('thumb-up.svg')} alt="" /></button><button type="button" aria-label="不赞同回复"><img src={chatAsset('thumb-down.svg')} alt="" /></button><button type="button" aria-label="更多回复操作"><img src={chatAsset('more.svg')} alt="" /></button></footer>}
      </div>
    </article>
  )
}

function ChatThread({ messages, busy, onSend, onCancel, onRetry }: { messages: MessageRecord[]; busy: boolean; onSend: (content: string) => void; onCancel: () => void; onRetry: (message: MessageRecord) => void }) {
  const [draft, setDraft] = useState('')
  const sendMessage = () => {
    const content = draft.trim()
    if (!content || busy) return
    onSend(content)
    setDraft('')
  }

  return (
    <section className="chat-thread" aria-label="AI 对话">
      <header className="chat-thread-header"><h1>AI 对话</h1></header>
      <div className="chat-messages">
        {messages.length === 0 && <div className="chat-empty-state"><AssistantAvatar /><p>从一个想法开始，AI 会在这里和你一起完成创作。</p></div>}
        {messages.map((message) => <ChatMessageView key={message.id} message={message} onRetry={onRetry} />)}
      </div>
      <div className="chat-compose-layer">
        <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); sendMessage() }}>
          <textarea aria-label="输入你的想法" placeholder="输入你的想法..." value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} />
          <footer><button className="chat-attach-button" type="button" disabled={busy}><img src={chatAsset('attachment.svg')} alt="" />附件</button><div className="chat-compose-model"><span>模型:</span><button className="chat-model-select" type="button">当前配置<img src={chatAsset('chevron-down.svg')} alt="" /></button>{busy ? <button className="chat-send-button chat-cancel-button" type="button" aria-label="停止生成" onClick={onCancel}>■</button> : <button className="chat-send-button" type="submit" aria-label="发送" disabled={!draft.trim()}><img src={chatAsset('send.svg')} alt="" /></button>}</div></footer>
        </form>
      </div>
    </section>
  )
}

function ChatContext() {
  return (
    <aside className="chat-context-panel" aria-label="项目上下文">
      <section className="chat-project-summary"><h2>项目上下文</h2><div className="chat-project-card"><img className="chat-project-cover" src={chatAsset('project-cover.jpg')} alt="春季新品传播计划封面" /><div className="chat-project-meta"><h3>本地 AI 会话</h3><p>消息保存在本机 SQLite</p></div></div></section>
      <section className="chat-project-description"><h3>关于本阶段</h3><p>对话通过 Tauri 网关发送，增量内容会实时写入当前回复。</p></section>
      <section className="chat-current-model"><h3>当前模型</h3><div className="chat-model-card"><span className="chat-model-icon"><img src={chatAsset('model.svg')} alt="" /></span><div><strong>服务配置模型</strong><p>由服务设置中的聊天模型决定</p></div></div></section>
    </aside>
  )
}

export default function ChatWorkspace({ previewMessages: sentMessages = [], onPreviewSend, previewMode = false }: { previewMessages?: string[]; onPreviewSend?: (content: string) => void; previewMode?: boolean }) {
  const realRuntime = isTauriRuntime()
  const localPreview = !realRuntime || previewMode
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRecord[]>(localPreview ? [...previewMessages, ...sentMessages.map((content, index) => ({ id: `preview-sent-${index}-${content}`, role: 'user' as const, content, status: 'completed' as const, error: null, createdAt: '刚刚' }))] : [])
  const [activeRequest, setActiveRequest] = useState<{ requestId: string; messageId: string } | null>(null)
  const [starting, setStarting] = useState(false)
  const messagesRef = useRef(messages)
  const activeRequestRef = useRef(activeRequest)

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { activeRequestRef.current = activeRequest }, [activeRequest])

  useEffect(() => {
    if (localPreview) return
    let disposed = false
    let unlisten: (() => void)[] = []
    const handleEvent = (event: ChatEvent, kind: 'delta' | 'completed' | 'failed') => {
      const active = activeRequestRef.current
      if (!active || active.requestId !== event.requestId) return
      if (kind === 'delta' && event.delta) {
        setMessages((current) => current.map((message) => message.id === event.messageId ? { ...message, content: `${message.content}${event.delta}` } : message))
      } else if (kind === 'completed') {
        setMessages((current) => current.map((message) => message.id === event.messageId ? { ...message, status: event.cancelled ? 'cancelled' : 'completed' } : message))
        activeRequestRef.current = null
        setActiveRequest(null)
      } else if (kind === 'failed') {
        const error = event.error || { code: 'unknown', message: '请求失败，请重试', retryable: true }
        setMessages((current) => current.map((message) => message.id === event.messageId ? { ...message, status: 'failed', error } : message))
        activeRequestRef.current = null
        setActiveRequest(null)
      }
    }
    const setup = async () => {
      unlisten = await Promise.all([
        client.listenChatEvent('delta', (event) => handleEvent(event, 'delta')),
        client.listenChatEvent('completed', (event) => handleEvent(event, 'completed')),
        client.listenChatEvent('failed', (event) => handleEvent(event, 'failed')),
      ])
      if (disposed) unlisten.forEach((dispose) => dispose())
      try {
        const loaded = await client.listConversations()
        if (disposed) return
        setConversations(loaded)
        if (loaded[0]) {
          setConversationId(loaded[0].id)
          setMessages(await client.loadConversation(loaded[0].id))
        }
      } catch {
        if (!disposed) setMessages([])
      }
    }
    void setup()
    return () => { disposed = true; unlisten.forEach((dispose) => dispose()) }
  }, [localPreview])

  const sendMessage = async (content: string) => {
    if (localPreview) {
      setMessages((current) => [...current, { id: `preview-${Date.now()}`, role: 'user', content, status: 'completed', error: null, createdAt: '刚刚' }])
      onPreviewSend?.(content)
      return
    }
    if (starting || activeRequest) return
    const userMessage: MessageRecord = { id: `local-user-${Date.now()}`, role: 'user', content, status: 'completed', error: null, createdAt: '刚刚' }
    const assistantMessage: MessageRecord = { id: `local-assistant-${Date.now()}`, role: 'assistant', content: '', status: 'pending', error: null, createdAt: '刚刚' }
    const nextMessages = [...messagesRef.current, userMessage, assistantMessage]
    setMessages(nextMessages)
    setStarting(true)
    try {
      const result = await client.startChat(conversationId, nextMessages.filter((message) => message.role === 'user' || message.role === 'assistant').map(({ role, content }) => ({ role, content } as ChatMessage)))
      setConversationId(result.conversationId)
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, id: result.messageId } : message))
      const request = { requestId: result.requestId, messageId: result.messageId }
      activeRequestRef.current = request
      setActiveRequest(request)
      setConversations((current) => current.some((item) => item.id === result.conversationId) ? current : [{ id: result.conversationId, title: content.slice(0, 30), updatedAt: '刚刚' }, ...current])
    } catch (cause) {
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, status: 'failed', error: errorFrom(cause) } : message))
    } finally {
      setStarting(false)
    }
  }

  const cancel = async () => {
    if (!activeRequest) return
    await client.cancelChat(activeRequest.requestId)
    setMessages((current) => current.map((message) => message.id === activeRequest.messageId ? { ...message, status: 'cancelled' } : message))
    activeRequestRef.current = null
    setActiveRequest(null)
  }

  const loadConversation = async (id: string) => {
    if (localPreview || id === conversationId) return
    setConversationId(id)
    setActiveRequest(null)
    setMessages(await client.loadConversation(id))
  }

  const newConversation = async () => {
    setActiveRequest(null)
    if (localPreview) {
      setConversationId(null)
      setMessages([])
      return
    }
    const id = await client.createConversation('新对话')
    setConversationId(id)
    setMessages([])
    setConversations((current) => [{ id, title: '新对话', updatedAt: '刚刚' }, ...current])
  }

  const retry = (assistant: MessageRecord) => {
    const index = messagesRef.current.findIndex((message) => message.id === assistant.id)
    const user = index > 0 ? [...messagesRef.current.slice(0, index)].reverse().find((message) => message.role === 'user') : null
    if (user) void sendMessage(user.content)
  }

  return (
    <main className="chat-app page-workspace" data-testid="page-workspace" data-node-id="27:2094">
      <span data-testid="ai-chat-workspace" className="workspace-test-anchor" aria-hidden="true" />
      <ChatHistory conversations={conversations} selectedId={conversationId} onSelect={(id) => void loadConversation(id)} onCreate={() => void newConversation()} />
      <ChatThread messages={messages} busy={starting || activeRequest !== null} onSend={(content) => void sendMessage(content)} onCancel={() => void cancel()} onRetry={retry} />
      <ChatContext />
    </main>
  )
}
