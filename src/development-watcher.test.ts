import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const viteConfig = readFileSync('vite.config.ts', 'utf8')

describe('Vite development watcher', () => {
  it('ignores generated QA artifacts', () => {
    expect(viteConfig).toContain("ignored: ['**/src-tauri/target/**', '**/artifacts/**']")
  })
})
