import { useState, type FormEvent } from 'react'
import { useAuth } from '../state/AuthContext'
import { validateLoginForm, type LoginErrors } from '../features/auth/validation'

type FormState = {
  email: string
  password: string
}

function TechVisual() {
  return (
    <section className="auth-tech-panel" aria-hidden="true">
      <div className="auth-tech-copy">
        <p className="auth-eyebrow">AI CREATIVE SYSTEM</p>
        <h2>让想法<br /><span>进入下一层。</span></h2>
        <p className="auth-tech-description">连接你的创作空间，探索图像、视频、音乐与智能对话的无限可能。</p>
        <div className="auth-tech-status"><i />SYSTEM READY <span>01 / 04</span></div>
      </div>
      <div className="auth-tech-stage">
        <span className="auth-tech-grid" />
        <span className="auth-tech-orbit auth-tech-orbit-one" />
        <span className="auth-tech-orbit auth-tech-orbit-two" />
        <span className="auth-tech-core"><i /><b /></span>
        <span className="auth-tech-ray auth-tech-ray-one" />
        <span className="auth-tech-ray auth-tech-ray-two" />
        <span className="auth-tech-ray auth-tech-ray-three" />
        <span className="auth-tech-particle auth-tech-particle-one" />
        <span className="auth-tech-particle auth-tech-particle-two" />
        <span className="auth-tech-particle auth-tech-particle-three" />
      </div>
    </section>
  )
}

export function LoginPage() {
  const { error, login, previewLogin, clearError } = useAuth()
  const [form, setForm] = useState<FormState>({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    if (error) clearError()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors = validateLoginForm(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      await login({ email: form.email, password: form.password })
    } finally {
      setSubmitting(false)
    }
  }

  const fieldError = (key: keyof FormState) => fieldErrors[key]

  return (
    <main className="auth-page">
      <TechVisual />
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-brand"><span className="auth-brand-mark">✦</span><span>AI Studio OS</span></div>
        <div className="auth-heading">
          <p className="auth-eyebrow">PERSONAL CREATIVE WORKSPACE</p>
          <h1 id="login-title">登录 AI Studio OS</h1>
          <p>登录后继续使用你的创作工作区与 AI 对话。</p>
        </div>

        <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
          <label>
            <span>邮箱</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={Boolean(fieldError('email'))}
              aria-describedby={fieldError('email') ? 'login-email-error' : undefined}
              disabled={submitting}
            />
            {fieldError('email') && <small id="login-email-error" className="auth-field-error">{fieldError('email')}</small>}
          </label>

          <label>
            <span>密码</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="至少 8 位"
              autoComplete="current-password"
              aria-invalid={Boolean(fieldError('password'))}
              aria-describedby={fieldError('password') ? 'login-password-error' : undefined}
              disabled={submitting}
            />
            {fieldError('password') && <small id="login-password-error" className="auth-field-error">{fieldError('password')}</small>}
          </label>

          {error && <div className="auth-error" role="alert">{error.message}</div>}
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? '登录中…' : '登录并进入工作区'}
          </button>
          {error?.code === 'network_error' && (
            <div className="auth-preview-option">
              <p>当前未连接登录服务，可以先进入本地预览查看工作区。</p>
              <button className="auth-preview-button" type="button" onClick={() => previewLogin(form.email)} disabled={submitting}>进入本地预览</button>
            </div>
          )}
        </form>
      </section>
    </main>
  )
}
