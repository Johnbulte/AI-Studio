import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import client, { isTauriRuntime, type AppError, type ServerConfig, type SessionSnapshot, type UserSummary } from '../bridge/tauriClient'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type LoginInput = {
  email: string
  password: string
  config?: ServerConfig
}

type AuthContextValue = {
  status: AuthStatus
  user: UserSummary | null
  isPreviewMode: boolean
  error: AppError | null
  serverConfig: ServerConfig
  login: (input: LoginInput) => Promise<void>
  previewLogin: (email?: string) => void
  logout: () => Promise<void>
  saveServerConfig: (config: ServerConfig) => Promise<ServerConfig>
  testConnection: () => Promise<void>
  clearError: () => void
}

const previewUser: UserSummary = {
  id: 'preview-user',
  email: 'preview@local',
  displayName: '预览用户',
}

const defaultServerConfig: ServerConfig = {
  baseUrl: import.meta.env.VITE_AI_STUDIO_BASE_URL || 'http://localhost:8787',
  chatModel: 'gpt-4o-mini',
}
const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeServerConfig(config: ServerConfig): ServerConfig {
  return {
    baseUrl: config.baseUrl.trim() || defaultServerConfig.baseUrl,
    chatModel: config.chatModel.trim() || defaultServerConfig.chatModel,
  }
}

function toAppError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    const candidate = error as Partial<AppError>
    return {
      code: String(candidate.code),
      message: String(candidate.message),
      retryable: Boolean(candidate.retryable),
    }
  }
  return { code: 'unknown', message: '操作失败，请稍后重试', retryable: true }
}

function applySnapshot(snapshot: SessionSnapshot): { status: AuthStatus; user: UserSummary | null } {
  return snapshot.authenticated && snapshot.user
    ? { status: 'authenticated', user: snapshot.user }
    : { status: 'unauthenticated', user: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<UserSummary | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const [serverConfig, setServerConfig] = useState<ServerConfig>(defaultServerConfig)

  useEffect(() => {
    let active = true
    const restore = async () => {
      if (!isTauriRuntime()) {
        if (active) {
          setUser(previewUser)
          setIsPreviewMode(true)
          setStatus('authenticated')
        }
        return
      }
      try {
        const config = normalizeServerConfig(await client.loadServerConfig())
        if (active) setServerConfig(config)
        const snapshot = await client.restoreSession()
        if (!active) return
        const next = applySnapshot(snapshot)
        setStatus(next.status)
        setUser(next.user)
        setIsPreviewMode(false)
      } catch (cause) {
        if (!active) return
        setError(toAppError(cause))
        setStatus('unauthenticated')
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  const saveServerConfig = useCallback(async (config: ServerConfig) => {
    try {
      const saved = isTauriRuntime() ? await client.saveServerConfig(config) : config
      setServerConfig(saved)
      setError(null)
      return saved
    } catch (cause) {
      const appError = toAppError(cause)
      setError(appError)
      throw appError
    }
  }, [])

  const login = useCallback(async ({ email, password, config }: LoginInput) => {
    setError(null)
    try {
      const effectiveConfig = normalizeServerConfig(config || serverConfig)
      if (isTauriRuntime()) await saveServerConfig(effectiveConfig)
      const snapshot = isTauriRuntime()
        ? await client.login(email.trim(), password)
        : { authenticated: true, user: { ...previewUser, email: email.trim() } }
      const next = applySnapshot(snapshot)
      setUser(next.user)
      setIsPreviewMode(false)
      setStatus(next.status)
    } catch (cause) {
      const appError = toAppError(cause)
      setError(appError)
      setStatus('unauthenticated')
      throw appError
    }
  }, [saveServerConfig, serverConfig])

  const previewLogin = useCallback((email?: string) => {
    setError(null)
    setUser({ ...previewUser, email: email?.trim() || previewUser.email })
    setIsPreviewMode(true)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    try {
      if (isTauriRuntime()) await client.logout()
      setUser(null)
      setIsPreviewMode(false)
      setStatus('unauthenticated')
    } catch (cause) {
      const appError = toAppError(cause)
      setError(appError)
      throw appError
    }
  }, [])

  const testConnection = useCallback(async () => {
    try {
      if (isTauriRuntime()) await client.testConnection()
      setError(null)
    } catch (cause) {
      const appError = toAppError(cause)
      setError(appError)
      throw appError
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    isPreviewMode,
    error,
    serverConfig,
    login,
    previewLogin,
    logout,
    saveServerConfig,
    testConnection,
    clearError: () => setError(null),
  }), [status, user, isPreviewMode, error, serverConfig, login, previewLogin, logout, saveServerConfig, testConnection])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}
