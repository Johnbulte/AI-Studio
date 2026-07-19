import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('desktop window surface', () => {
  it('keeps scrollbars inside the dark rounded window surface', () => {
    const css = readFileSync('src/styles/app.css', 'utf8')

    expect(css).toContain('scrollbar-color: #34343e #0a0a0b')
    expect(css).toContain('*::-webkit-scrollbar-track')
    expect(css).toContain('background: #0a0a0b')
  })
})
