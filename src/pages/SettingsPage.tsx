import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../state/AuthContext'
import client, { isTauriRuntime, type AppError, type MediaConfig, type ServerConfig } from '../bridge/tauriClient'

type SettingsPageProps = { onBack: () => void }

function asError(error: unknown): AppError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const candidate = error as Partial<AppError>
    return { code: String(candidate.code || 'unknown'), message: String(candidate.message), retryable: Boolean(candidate.retryable) }
  }
  return { code: 'unknown', message: '操作失败，请稍后重试', retryable: true }
}

function validateConfig(config: ServerConfig) {
  if (!config.baseUrl.trim()) return '请输入服务地址'
  try {
    const url = new URL(config.baseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return '服务地址必须使用 HTTP 或 HTTPS'
  } catch {
    return '请输入有效的服务地址'
  }
  if (!config.chatModel.trim()) return '请输入聊天模型'
  return ''
}

function validateMediaConfig(config: Omit<MediaConfig, 'apiKeyConfigured'>) {
  if (!config.baseUrl.trim()) return '请输入多米 API 地址'
  try {
    const url = new URL(config.baseUrl)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return '多米 API 地址必须使用 HTTP 或 HTTPS'
  } catch {
    return '请输入有效的多米 API 地址'
  }
  if (!config.imageModel.trim()) return '请输入图片模型'
  if (!config.videoModel.trim()) return '请输入视频模型'
  return ''
}

const defaultMediaConfig: Omit<MediaConfig, 'apiKeyConfigured'> = {
  baseUrl: 'https://duomiapi.com',
  imageModel: 'gpt-image-2',
  videoModel: 'doubao-seedance-2-0-260128',
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { serverConfig, user, error, saveServerConfig, testConnection, logout, clearError } = useAuth()
  const [form, setForm] = useState<ServerConfig>(serverConfig)
  const [mediaForm, setMediaForm] = useState(defaultMediaConfig)
  const [mediaKey, setMediaKey] = useState('')
  const [mediaKeyConfigured, setMediaKeyConfigured] = useState(false)
  const [localError, setLocalError] = useState<AppError | null>(null)
  const [mediaError, setMediaError] = useState<AppError | null>(null)
  const [feedback, setFeedback] = useState('')
  const [mediaFeedback, setMediaFeedback] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'logout' | null>(null)
  const [mediaBusy, setMediaBusy] = useState(false)

  useEffect(() => setForm(serverConfig), [serverConfig])

  useEffect(() => {
    if (!isTauriRuntime()) return
    let active = true
    void client.loadMediaConfig().then((config) => {
      if (!active) return
      setMediaForm({ baseUrl: config.baseUrl, imageModel: config.imageModel, videoModel: config.videoModel })
      setMediaKeyConfigured(config.apiKeyConfigured)
    }).catch((cause) => {
      if (active) setMediaError(asError(cause))
    })
    return () => { active = false }
  }, [])

  const update = (key: keyof ServerConfig, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFeedback('')
    setLocalError(null)
    clearError()
  }

  const save = async (event?: FormEvent) => {
    event?.preventDefault()
    const validationError = validateConfig(form)
    if (validationError) {
      setLocalError({ code: 'invalid_config', message: validationError, retryable: false })
      return false
    }
    setBusy('save')
    setLocalError(null)
    setFeedback('')
    try {
      await saveServerConfig({ baseUrl: form.baseUrl.trim().replace(/\/$/, ''), chatModel: form.chatModel.trim() })
      setFeedback('配置已保存')
      return true
    } catch (cause) {
      setLocalError(asError(cause))
      return false
    } finally {
      setBusy(null)
    }
  }

  const test = async () => {
    const saved = await save()
    if (!saved) return
    setBusy('test')
    setLocalError(null)
    setFeedback('')
    try {
      await testConnection()
      setFeedback('连接成功')
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

  const updateMedia = (key: keyof typeof defaultMediaConfig, value: string) => {
    setMediaForm((current) => ({ ...current, [key]: value }))
    setMediaFeedback('')
    setMediaError(null)
  }

  const saveMedia = async (event?: FormEvent) => {
    event?.preventDefault()
    const validationError = validateMediaConfig(mediaForm)
    if (validationError) {
      setMediaError({ code: 'invalid_config', message: validationError, retryable: false })
      return
    }
    setMediaBusy(true)
    setMediaError(null)
    setMediaFeedback('')
    try {
      const saved = isTauriRuntime()
        ? await client.saveMediaConfig({ baseUrl: mediaForm.baseUrl.trim().replace(/\/$/, ''), imageModel: mediaForm.imageModel.trim(), videoModel: mediaForm.videoModel.trim() }, mediaKey.trim() || undefined)
        : { ...mediaForm, apiKeyConfigured: Boolean(mediaKey.trim()) || mediaKeyConfigured }
      setMediaForm({ baseUrl: saved.baseUrl, imageModel: saved.imageModel, videoModel: saved.videoModel })
      setMediaKeyConfigured(saved.apiKeyConfigured)
      setMediaKey('')
      setMediaFeedback(saved.apiKeyConfigured ? '多米 API 配置已保存' : '多米 API 配置已保存，请填写 API Key 后生成')
    } catch (cause) {
      setMediaError(asError(cause))
    } finally {
      setMediaBusy(false)
    }
  }

  const visibleError = localError || error

  return (
    <main className="settings-page page-workspace" data-testid="page-workspace">
      <header className="settings-header">
        <div>
          <button className="settings-back" type="button" onClick={onBack}>← 返回工作区</button>
          <p className="auth-eyebrow">ACCOUNT &amp; SERVICE</p>
          <h1>服务设置</h1>
          <p>配置登录服务与 AI 网关。访问令牌由系统安全存储管理。</p>
        </div>
      </header>

      <div className="settings-layout">
        <section className="settings-card" aria-labelledby="service-settings-title">
          <div className="settings-card-heading"><div><h2 id="service-settings-title">AI 服务</h2><p>登录服务与聊天请求共用同一个服务地址。</p></div><span className="settings-status-dot" /></div>
          <form className="settings-form" onSubmit={(event) => void save(event)}>
            <label><span>服务地址</span><input aria-label="服务地址" type="url" value={form.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} placeholder="https://your-gateway.example.com" disabled={busy !== null} /></label>
            <label><span>聊天模型</span><input aria-label="聊天模型" type="text" value={form.chatModel} onChange={(event) => update('chatModel', event.target.value)} placeholder="gpt-4o-mini" disabled={busy !== null} /></label>
            <div className="settings-actions"><button className="settings-secondary" type="button" onClick={() => void test()} disabled={busy !== null}>{busy === 'test' ? '测试中…' : '测试连接'}</button><button className="settings-primary" type="submit" disabled={busy !== null}>{busy === 'save' ? '保存中…' : '保存配置'}</button></div>
          </form>
          {feedback && <p className="settings-feedback" role="status">{feedback}</p>}
          {visibleError && <p className="settings-error" role="alert">{visibleError.message}{visibleError.retryable ? '（可以重试）' : ''}</p>}
        </section>

        <section className="settings-card" aria-labelledby="duomi-settings-title">
          <div className="settings-card-heading"><div><h2 id="duomi-settings-title">多米媒体 API</h2><p>用于 AI 图片和 AI 视频生成。API Key 只保存到系统安全存储。</p></div><span className={`settings-status-dot ${mediaKeyConfigured ? 'is-ready' : ''}`} /></div>
          <form className="settings-form" onSubmit={(event) => void saveMedia(event)}>
            <label><span>API 地址</span><input aria-label="多米 API 地址" type="url" value={mediaForm.baseUrl} onChange={(event) => updateMedia('baseUrl', event.target.value)} placeholder="https://duomiapi.com" disabled={mediaBusy} /></label>
            <label><span>图片模型</span><input aria-label="多米图片模型" type="text" value={mediaForm.imageModel} onChange={(event) => updateMedia('imageModel', event.target.value)} placeholder="gpt-image-2" disabled={mediaBusy} /></label>
            <label><span>视频模型</span><input aria-label="多米视频模型" type="text" value={mediaForm.videoModel} onChange={(event) => updateMedia('videoModel', event.target.value)} placeholder="doubao-seedance-2-0-260128" disabled={mediaBusy} /></label>
            <label><span>API Key {mediaKeyConfigured ? '（已配置，留空保持不变）' : ''}</span><input aria-label="多米 API Key" type="password" value={mediaKey} onChange={(event) => { setMediaKey(event.target.value); setMediaFeedback(''); setMediaError(null) }} placeholder={mediaKeyConfigured ? '已配置' : '在多米控制台创建 API Key'} disabled={mediaBusy} autoComplete="off" /></label>
            <div className="settings-actions"><button className="settings-primary" type="submit" disabled={mediaBusy}>{mediaBusy ? '保存中…' : '保存多米配置'}</button></div>
          </form>
          {mediaFeedback && <p className="settings-feedback" role="status">{mediaFeedback}</p>}
          {mediaError && <p className="settings-error" role="alert">{mediaError.message}{mediaError.retryable ? '（可以重试）' : ''}</p>}
        </section>

        <section className="settings-card settings-account-card" aria-labelledby="account-settings-title">
          <div className="settings-card-heading"><div><h2 id="account-settings-title">账户</h2><p>当前登录身份与本地会话。</p></div></div>
          <div className="settings-account"><img src="/figma/dashboard/avatar.jpg" alt="" /><div><strong>{user?.displayName || '当前用户'}</strong><span>{user?.email || '未提供邮箱'}</span></div></div>
          <button className="settings-logout" type="button" onClick={() => void signOut()} disabled={busy !== null}>{busy === 'logout' ? '退出中…' : '退出登录'}</button>
        </section>
      </div>
    </main>
  )
}
