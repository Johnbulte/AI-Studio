import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const appWindow = vi.hoisted(() => ({
  close: vi.fn(),
  isMaximized: vi.fn(),
  minimize: vi.fn(),
  startDragging: vi.fn(),
  toggleMaximize: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => appWindow }))

import App from './App'

describe('native window chrome', () => {
  beforeEach(() => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    appWindow.close.mockResolvedValue(undefined)
    appWindow.isMaximized.mockResolvedValue(false)
    appWindow.minimize.mockResolvedValue(undefined)
    appWindow.startDragging.mockResolvedValue(undefined)
    appWindow.toggleMaximize.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  })

  it('handles rejected native window commands without an unhandled promise', async () => {
    const failure = new Error('native minimize failed')
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    appWindow.minimize.mockRejectedValueOnce(failure)

    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '最小化' }))

    await waitFor(() => expect(error).toHaveBeenCalledWith('窗口操作失败：minimize', failure))
  })
})
