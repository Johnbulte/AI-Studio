import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Tauri desktop window constraints', () => {
  it('prevents the Figma workspace from becoming unusably small', () => {
    const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))

    expect(config.app.windows[0]).toMatchObject({
      width: 1440,
      height: 1024,
      minWidth: 1024,
      minHeight: 720,
      resizable: true,
      decorations: false,
      transparent: true,
      shadow: false,
      backgroundColor: '#0a0a0b00',
    })
  })
})
