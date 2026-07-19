import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../state/AuthContext'
import type { AppError } from '../bridge/tauriClient'

type SettingsPageProps = { onBack: () => void }
type PreferenceKey = 'restoreWorkspace' | 'notifyGeneration' | 'reduceMotion'
type Preferences = Record<PreferenceKey, boolean>

const preferenceStorageKey = 'ai-studio-preferences'
const defaultPreferences: Preferences = {
  restoreWorkspace: true,
  notifyGeneration: true,
  reduceMotion: false,
}

function asError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const candidate = error as Partial<AppError>
    return { code: String(candidate.code || 'unknown'), message: String(candidate.message), retryable: Boolean(candidate.retryable) }
  }
  return { code: 'unknown', message: '操作失败，请稍后重试', retryable: true }
}

function getPublicError(error: AppError | null) {
  if (!error) return ''
  if (error.code === 'rate_limited') return '服务繁忙，请稍后重试'
  if (error.code === 'unauthorized' || error.code === 'forbidden') return '连接凭证无效，请联系管理员'
  if (error.code === 'network_error' || error.code === 'request_failed') return '暂时无法连接服务，请检查网络'
  return '服务暂时不可用，请稍后重试'
}

function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(preferenceStorageKey)
    if (!raw) return defaultPreferences
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return { ...defaultPreferences, ...parsed }
  } catch {
    return defaultPreferences
  }
}

function PreferenceSwitch({ checked }: { checked: boolean }) {
  return <span className={`settings-switch ${checked ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { user, error, testConnection, logout, clearError } = useAuth()
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)
  const [localError, setLocalError] = useState<AppError | null>(null)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState<'test' | 'logout' | null>(null)

  useEffect(() => setPreferences(loadPreferences()), [])

  const updatePreference = (key: PreferenceKey) => {
    const next = { ...preferences, [key]: !preferences[key] }
    setPreferences(next)
    setFeedback('偏好已更新')
    setLocalError(null)
    try {
      window.localStorage.setItem(preferenceStorageKey, JSON.stringify(next))
    } catch {
      // Preferences remain available for this session when storage is unavailable.
    }
  }

  const test = async (event?: FormEvent) => {
    event?.preventDefault()
    setBusy('test')
    setLocalError(null)
    setFeedback('')
    clearError()
    try {
      await testConnection()
      setFeedback('连接正常')
    } catch (cause) {
      setLocalError(asError(cause))
    } finally {
      setBusy(null)
    }
  }

  const signOut = async () => {
    setBusy('logout')
    setLocalError(null)
    try {
      await logout()
    } catch (cause) {
      setLocalError(asError(cause))
    } finally {
      setBusy(null)
    }
  }

  const visibleError = localError || error
  const publicError = getPublicError(visibleError)

  return (
    <main className="settings-page page-workspace" data-testid="page-workspace">
      <header className="settings-header">
        <div>
          <button className="settings-back" type="button" onClick={onBack}>← 返回工作区</button>
          <p className="auth-eyebrow">ACCOUNT &amp; PREFERENCES</p>
          <h1>设置</h1>
          <p>管理账户、工作区与创作体验。连接信息由系统安全存储管理。</p>
        </div>
      </header>

      <div className="settings-layout">
        <section className="settings-card settings-workspace-card" aria-labelledby="workspace-settings-title">
          <div className="settings-card-heading">
            <div>
              <h2 id="workspace-settings-title">AI 工作区</h2>
              <p>创作环境已准备就绪，连接配置由工作区自动管理。</p>
            </div>
            <span className="settings-status-dot is-ready" />
          </div>

          <div className="settings-status-list" aria-label="工作区状态">
            <div className="settings-status-row"><span>连接状态</span><strong className="is-positive">已就绪</strong></div>
            <div className="settings-status-row"><span>本地工作记录</span><strong>已启用</strong></div>
            <div className="settings-status-row"><span>安全存储</span><strong>已保护</strong></div>
          </div>

          <div className="settings-card-footer">
            <p className="settings-card-note">登录、对话和生成任务会在当前设备上继续保留。</p>
            <button className="settings-secondary" type="button" onClick={() => void test()} disabled={busy !== null}>
              {busy === 'test' ? '检查中…' : '检查连接'}
            </button>
          </div>
          {feedback && <p className="settings-feedback" role="status">{feedback}</p>}
          {publicError && <p className="settings-error" role="alert">{publicError}{visibleError?.retryable ? '（可以重试）' : ''}</p>}
        </section>

        <section className="settings-card settings-preferences-card" aria-labelledby="preference-settings-title">
          <div className="settings-card-heading">
            <div>
              <h2 id="preference-settings-title">偏好设置</h2>
              <p>调整工作区的默认行为。</p>
            </div>
          </div>
          <div className="settings-preference-list">
            <button className="settings-preference-row" type="button" role="switch" aria-checked={preferences.restoreWorkspace} onClick={() => updatePreference('restoreWorkspace')}>
              <span><strong>恢复上次工作区</strong><small>启动时回到上次打开的位置</small></span>
              <PreferenceSwitch checked={preferences.restoreWorkspace} />
            </button>
            <button className="settings-preference-row" type="button" role="switch" aria-checked={preferences.notifyGeneration} onClick={() => updatePreference('notifyGeneration')}>
              <span><strong>生成完成提醒</strong><small>任务完成后显示桌面提醒</small></span>
              <PreferenceSwitch checked={preferences.notifyGeneration} />
            </button>
            <button className="settings-preference-row" type="button" role="switch" aria-checked={preferences.reduceMotion} onClick={() => updatePreference('reduceMotion')}>
              <span><strong>减少界面动效</strong><small>降低过渡和环境光动画</small></span>
              <PreferenceSwitch checked={preferences.reduceMotion} />
            </button>
          </div>
        </section>

        <section className="settings-card settings-account-card" aria-labelledby="account-settings-title">
          <div className="settings-card-heading">
            <div>
              <h2 id="account-settings-title">账户</h2>
              <p>当前登录身份与本地会话。</p>
            </div>
          </div>
          <div className="settings-account">
            <img src="/figma/dashboard/avatar.jpg" alt="" />
            <div><strong>{user?.displayName || '当前用户'}</strong><span>{user?.email || '未提供邮箱'}</span></div>
          </div>
          <button className="settings-logout" type="button" onClick={() => void signOut()} disabled={busy !== null}>
            {busy === 'logout' ? '退出中…' : '退出登录'}
          </button>
        </section>
      </div>
    </main>
  )
}
