import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync('src/styles/tokens.css', 'utf8')

describe('shared AI Studio typography', () => {
  it.each([
    ['brand', '600 17px/24px'],
    ['nav', '500 14px/20px'],
    ['page-title', '600 20px/28px'],
    ['view-title', '600 28px/40px'],
    ['section-title', '600 16px/24px'],
    ['body', '400 14px/22px'],
    ['caption', '400 12px/18px'],
  ])('defines the %s semantic type token', (name, value) => {
    expect(tokens).toContain(`--type-${name}: ${value}`)
  })
})
