import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type AppError = {
  code: string
  message: string
  retryable: boolean
}

export type UserSummary = {
  id: string
  email: string
  displayName: string
}

export type SessionSnapshot = {
  authenticated: boolean
  user: UserSummary | null
}

export type ServerConfig = {
  baseUrl: string
  chatModel: string
}

export type MediaConfig = {
  baseUrl: string
  imageModel: string
  videoModel: string
  apiKeyConfigured: boolean
}

export type ImageGenerationArgs = {
  prompt: string
  aspectRatio: string
  count: number
  references: string[]
}

export type VideoGenerationArgs = {
  prompt: string
  mode: string
  aspectRatio: string
  duration: number
  resolution: string
  references: string[]
}

export type MediaStartResult = {
  requestId: string
  taskId: string
  kind: 'image' | 'video'
}

export type MediaRunSummary = {
  requestId: string
  kind: 'image' | 'video'
  status: string
  resultUrl: string | null
  startedAt: string
  finishedAt: string | null
}

export type MediaEvent = {
  requestId: string
  taskId: string
  kind: 'image' | 'video'
  status: 'submitted' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number | null
  resultUrl: string | null
  error: AppError | null
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ConversationSummary = {
  id: string
  title: string
  updatedAt: string
}

export type MessageRecord = {
  id: string
  role: ChatMessage['role']
  content: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  error: AppError | null
  createdAt: string
}

export type ChatStartResult = {
  requestId: string
  conversationId: string
  messageId: string
}

export type ChatEvent = {
  requestId: string
  conversationId: string
  messageId: string
  delta: string | null
  cancelled: boolean
  error: AppError | null
}

export type TauriClient = {
  loadServerConfig: () => Promise<ServerConfig>
  saveServerConfig: (config: ServerConfig) => Promise<ServerConfig>
  loadMediaConfig: () => Promise<MediaConfig>
  saveMediaConfig: (config: Omit<MediaConfig, 'apiKeyConfigured'>, apiKey?: string) => Promise<MediaConfig>
  login: (email: string, password: string) => Promise<SessionSnapshot>
  restoreSession: () => Promise<SessionSnapshot>
  logout: () => Promise<void>
  testConnection: () => Promise<void>
  listConversations: () => Promise<ConversationSummary[]>
  loadConversation: (conversationId: string) => Promise<MessageRecord[]>
  createConversation: (title: string) => Promise<string>
  listMediaRuns: () => Promise<MediaRunSummary[]>
  startChat: (conversationId: string | null, messages: ChatMessage[]) => Promise<ChatStartResult>
  cancelChat: (requestId: string) => Promise<void>
  listenChatEvent: (eventName: 'delta' | 'completed' | 'failed', handler: (event: ChatEvent) => void) => Promise<UnlistenFn>
  startImageGeneration: (args: ImageGenerationArgs) => Promise<MediaStartResult>
  startVideoGeneration: (args: VideoGenerationArgs) => Promise<MediaStartResult>
  cancelMediaGeneration: (requestId: string) => Promise<void>
  listenMediaEvent: (eventName: 'updated' | 'completed' | 'failed', handler: (event: MediaEvent) => void) => Promise<UnlistenFn>
}

export const isTauriRuntime = () => '__TAURI_INTERNALS__' in window

function unavailable(): never {
  throw {
    code: 'tauri_unavailable',
    message: '当前预览环境没有连接桌面服务',
    retryable: false,
  } satisfies AppError
}

const client: TauriClient = {
  loadServerConfig: () => isTauriRuntime() ? invoke<ServerConfig>('load_server_config') : unavailable(),
  saveServerConfig: (config) => isTauriRuntime() ? invoke<ServerConfig>('save_server_config', { config }) : unavailable(),
  loadMediaConfig: () => isTauriRuntime() ? invoke<MediaConfig>('load_media_config') : unavailable(),
  saveMediaConfig: (config, apiKey) => isTauriRuntime() ? invoke<MediaConfig>('save_media_config', { args: { config, apiKey: apiKey || null } }) : unavailable(),
  login: (email, password) => isTauriRuntime() ? invoke<SessionSnapshot>('login', { args: { email, password } }) : unavailable(),
  restoreSession: () => isTauriRuntime() ? invoke<SessionSnapshot>('restore_session') : unavailable(),
  logout: () => isTauriRuntime() ? invoke<void>('logout') : unavailable(),
  testConnection: () => isTauriRuntime() ? invoke<void>('test_connection') : unavailable(),
  listConversations: () => isTauriRuntime() ? invoke<ConversationSummary[]>('list_conversations') : unavailable(),
  loadConversation: (conversationId) => isTauriRuntime() ? invoke<MessageRecord[]>('load_conversation', { conversationId }) : unavailable(),
  createConversation: (title) => isTauriRuntime() ? invoke<string>('create_conversation', { title }) : unavailable(),
  listMediaRuns: () => isTauriRuntime() ? invoke<MediaRunSummary[]>('list_media_runs') : unavailable(),
  startChat: (conversationId, messages) => isTauriRuntime()
    ? invoke<ChatStartResult>('start_chat', { args: { conversationId, messages } })
    : unavailable(),
  cancelChat: (requestId) => isTauriRuntime() ? invoke<void>('cancel_chat', { requestId }) : unavailable(),
  listenChatEvent: (eventName, handler) => {
    if (!isTauriRuntime()) return Promise.reject({ code: 'tauri_unavailable', message: '当前预览环境没有连接桌面服务', retryable: false } satisfies AppError)
    return listen<ChatEvent>(`ai://chat/${eventName}`, (event) => handler(event.payload))
  },
  startImageGeneration: (args) => isTauriRuntime() ? invoke<MediaStartResult>('start_image_generation', { args }) : unavailable(),
  startVideoGeneration: (args) => isTauriRuntime() ? invoke<MediaStartResult>('start_video_generation', { args }) : unavailable(),
  cancelMediaGeneration: (requestId) => isTauriRuntime() ? invoke<void>('cancel_media_generation', { requestId }) : unavailable(),
  listenMediaEvent: (eventName, handler) => {
    if (!isTauriRuntime()) return Promise.reject({ code: 'tauri_unavailable', message: '当前预览环境没有连接桌面服务', retryable: false } satisfies AppError)
    return listen<MediaEvent>(`ai://media/${eventName}`, (event) => handler(event.payload))
  },
}

export default client
