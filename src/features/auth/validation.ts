export type LoginForm = {
  email: string
  password: string
}

export type LoginErrors = Partial<Record<keyof LoginForm, string>>

export function validateLoginForm(form: LoginForm): LoginErrors {
  const errors: LoginErrors = {}
  const email = form.email.trim()

  if (!email) errors.email = '请输入邮箱'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = '请输入有效的邮箱地址'

  if (!form.password) errors.password = '请输入密码'
  else if (form.password.length < 8) errors.password = '密码至少需要 8 位'

  return errors
}
