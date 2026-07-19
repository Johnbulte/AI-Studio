import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('compact desktop workspaces', () => {
  const css = readFileSync('src/styles/app.css', 'utf8')

  it('reflows chat inside the shared compact sidebar', () => {
    expect(css).toContain('grid-template-columns: 200px minmax(420px, 1fr) 240px')
    expect(css).toContain('.chat-thread { width: 100%; min-width: 0; height: 100%; }')
  })

  it('reflows image generation without owning another sidebar track', () => {
    expect(css).toContain('.image-app { grid-template-columns: minmax(0, 1fr);')
    expect(css).toContain('grid-template-columns: 240px minmax(350px, 1fr) 230px')
  })
})
