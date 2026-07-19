import { describe, expect, it } from 'vitest'
import { validateLoginForm } from './validation'

describe('validateLoginForm', () => {
  it('rejects an empty email and password', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: '请输入邮箱',
      password: '请输入密码',
    })
  })

  it('rejects malformed emails and short passwords', () => {
    expect(validateLoginForm({ email: 'not-an-email', password: '1234567' })).toEqual({
      email: '请输入有效的邮箱地址',
      password: '密码至少需要 8 位',
    })
  })

  it('accepts a valid login form', () => {
    expect(validateLoginForm({ email: 'user@example.com', password: 'password123' })).toEqual({})
  })
})
