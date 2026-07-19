import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

const appSource = readFileSync('src/App.tsx', 'utf8')
const studioPagesSource = readFileSync('src/pages/StudioPages.tsx', 'utf8')
const appStyles = readFileSync('src/styles/app.css', 'utf8')
const studioStyles = readFileSync('src/styles/studio-pages.css', 'utf8')
const tokens = readFileSync('src/styles/tokens.css', 'utf8')

describe('shared application workspace shell', () => {
  afterEach(cleanup)

  it('renders one persistent sidebar outside every page workspace', () => {
    render(<App />)

    const shell = document.querySelector('.workspace-shell')
    expect(shell).not.toBeNull()
    expect(shell?.querySelectorAll('.app-sidebar')).toHaveLength(1)

    for (const label of ['AI 对话', 'AI 图片', 'AI 视频', 'AI 音乐', '会员', '项目', '创作工作台']) {
      fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: label }))
      expect(shell?.querySelectorAll('.app-sidebar')).toHaveLength(1)
      expect(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('marks the current page and exposes unavailable navigation honestly', () => {
    render(<App />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))

    expect(navigation.getByRole('button', { name: '创作工作台' })).toHaveAttribute('aria-current', 'page')
    expect(navigation.getByRole('button', { name: '素材库' })).toBeDisabled()
    expect(navigation.getByRole('button', { name: '素材库' })).toHaveAttribute('title', '素材库（即将开放）')
  })

  it('resets native button chrome inside the persistent sidebar', () => {
    expect(appStyles).toMatch(/\.app-sidebar button\s*\{[^}]*border:\s*0[^}]*background:\s*transparent[^}]*color:\s*inherit/)
  })

  it('keeps editable controls selectable and typographically consistent', () => {
    expect(appStyles).toMatch(/button,\s*input,\s*select,\s*textarea\s*\{[^}]*font:\s*inherit/)
    expect(appStyles).toMatch(/input,\s*textarea,\s*\[contenteditable="true"\]\s*\{[^}]*user-select:\s*text/)
  })

  it('does not keep page-specific sidebar implementations', () => {
    expect(appSource).not.toContain('function ChatNavigation')
    expect(appSource).not.toContain('className="figma-sidebar"')
    expect(studioPagesSource).not.toContain('function StudioSidebar')
    expect(studioPagesSource).not.toContain('<StudioSidebar')
  })

  it('uses one compact breakpoint for the shared sidebar and all page layouts', () => {
    expect(appStyles).toMatch(/\.workspace-shell\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-width\) minmax\(0,\s*1fr\)/)
    expect(appStyles).toMatch(/@media\s*\(max-width:\s*1439px\)[\s\S]*?\.workspace-shell\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-compact-width\) minmax\(0,\s*1fr\)/)
    expect(appStyles).not.toMatch(/\.figma-app\s*\{[^}]*grid-template-columns:\s*(?:240px|72px) minmax/)
    expect(appStyles).not.toMatch(/\.chat-app\s*\{[^}]*grid-template-columns:\s*(?:240px|72px)/)
    expect(appStyles).not.toMatch(/\.image-app\s*\{[^}]*grid-template-columns:\s*(?:240px|72px)/)
    expect(studioStyles).not.toMatch(/\.studio-tool-app\s*\{[^}]*grid-template-columns:\s*(?:240px|72px)/)
  })

  it('lets AI Image share the same outer sizing model as the other tools', () => {
    expect(appStyles).toMatch(/\.image-app\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/)
    expect(appStyles).not.toMatch(/\.image-app\s*\{[^}]*width:\s*1440px/)
    expect(appStyles).not.toMatch(/\.image-app\s*\{[^}]*min-width:\s*1440px/)
    expect(appStyles).toMatch(/@media\s*\(max-width:\s*1439px\)[\s\S]*?\.image-workspace\s*\{[^}]*grid-template-columns:\s*240px minmax\(350px,\s*1fr\) 230px/)
  })

  it('distributes extra width inside chat and image instead of leaving an outer blank strip', () => {
    expect(appStyles).toMatch(/\.chat-app\s*\{[^}]*grid-template-columns:\s*280px minmax\(600px,\s*1fr\) 320px/)
    expect(appStyles).toMatch(/\.image-workspace\s*\{[^}]*grid-template-columns:\s*320px minmax\(448px,\s*1fr\) 320px/)
    expect(appStyles).toMatch(/\.image-main\s*\{[^}]*width:\s*100%/)
  })

  it('keeps responsive chat scrolling functional without exposing nested scrollbar chrome', () => {
    expect(appStyles).toMatch(/\.chat-messages\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto[^}]*scrollbar-width:\s*none/)
    expect(appStyles).toMatch(/\.chat-messages::-webkit-scrollbar\s*\{[^}]*width:\s*0/)
  })

  it('has one tokenized owner for all four outer corners', () => {
    expect(tokens).toContain('--window-radius: 12px')
    expect(appStyles).toMatch(/\.window-content\s*\{[^}]*border-radius:\s*var\(--window-radius\)/)
    expect(appStyles).toMatch(/\.window-content\s*\{[^}]*clip-path:\s*inset\(0 round var\(--window-radius\)\)/)
    expect(appStyles).toMatch(/\.window-controls\s*\{[^}]*border-radius:\s*0 var\(--window-radius\) 0 10px/)
    expect(appStyles).toMatch(/\.page-workspace\s*\{[^}]*border-radius:\s*0/)
  })

  it('keeps top-right page actions outside the native window control hit area', () => {
    expect(tokens).toContain('--window-controls-width: 138px')
    expect(tokens).toContain('--window-action-gap: 16px')
    expect(appStyles).toMatch(/\.image-header\s*\{[^}]*padding-right:\s*calc\(var\(--window-controls-width\) \+ var\(--window-action-gap\)\)/)
    expect(studioStyles).toMatch(/\.tool-header\s*\{[^}]*padding-right:\s*calc\(var\(--window-controls-width\) \+ var\(--window-action-gap\)\)/)
    expect(studioStyles).toMatch(/\.tool-header > div\s*\{[^}]*padding-right:\s*0/)
  })
})
