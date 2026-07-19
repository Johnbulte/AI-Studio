import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

const appStyles = readFileSync('src/styles/app.css', 'utf8')

describe('AI Studio OS Figma 26:773 creation dashboard', () => {
  afterEach(cleanup)

  it('opens the creation dashboard by default', () => {
    render(<App />)
    const workspace = screen.getByTestId('workspace')
    expect(within(workspace).getByRole('heading', { name: '创作工作台' })).toBeInTheDocument()
    expect(within(workspace).getByRole('heading', { name: '任务中心' })).toBeInTheDocument()
    expect(within(workspace).getByRole('heading', { name: '本月积分' })).toBeInTheDocument()
  })

  it('uses node-specific Figma assets', () => {
    render(<App />)
    const workspace = screen.getByTestId('workspace')
    const credits = screen.getByRole('heading', { name: '本月积分' }).closest('section')

    expect(workspace).toHaveAttribute('data-node-id', '26:773')
    expect(screen.getByRole('button', { name: '开始生成' }).querySelector('img')).toHaveAttribute('src', '/figma/dashboard/send.svg')
    expect(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '会员' }).querySelector('img')).toHaveAttribute('src', '/figma/dashboard/nav-membership.svg')
    expect(screen.getByAltText('未来幻想短片项目封面')).toHaveAttribute('src', '/figma/dashboard/project.jpg')
    expect(screen.getByRole('button', { name: '充值积分' }).querySelector('img')).toHaveAttribute('src', '/figma/dashboard/plus-small.svg')
    expect(within(credits as HTMLElement).getByRole('button', { name: '会员中心' }).querySelector('img')).toHaveAttribute('src', '/figma/dashboard/membership.svg')
    expect(screen.getByAltText('创意无限头像')).toHaveAttribute('src', '/figma/dashboard/avatar.jpg')
  })

  it('renders the exact creation and task copy', () => {
    render(<App />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))

    expect(navigation.getByRole('button', { name: 'AI 图片' })).toBeInTheDocument()
    expect(navigation.getByRole('button', { name: 'AI 视频' })).toBeInTheDocument()
    expect(navigation.getByRole('button', { name: 'AI 音乐' })).toBeInTheDocument()
    expect(navigation.getByRole('button', { name: '会员' })).toBeInTheDocument()
    expect(screen.getAllByText('赛博城市·黄昏之光')).toHaveLength(2)
    expect(screen.getByText('深空回响 (氛围音乐)')).toBeInTheDocument()
    expect(screen.getByText('未来叙事短片·片段 02')).toBeInTheDocument()
    expect(screen.getByText('2450 / 5000')).toBeInTheDocument()
  })

  it('keeps AI chat reachable from the dashboard', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 对话' }))
    expect(screen.getByTestId('ai-chat-workspace')).toBeInTheDocument()
  })

  it('opens settings from the primary navigation', () => {
    render(<App />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))
    fireEvent.click(navigation.getByRole('button', { name: '设置' }))
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument()
  })

  it('starts a conversation from the dashboard prompt', () => {
    render(<App />)
    const prompt = screen.getByRole('textbox', { name: '今天想创作什么？' })
    const submit = screen.getByRole('button', { name: '开始生成' })

    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '创意灵感' }))
    expect(prompt).not.toHaveValue('')
    expect(submit).toBeEnabled()

    fireEvent.change(prompt, { target: { value: '设计一套夏日新品传播创意' } })
    fireEvent.click(submit)
    expect(screen.getByTestId('ai-chat-workspace')).toBeInTheDocument()
    expect(screen.getByText('设计一套夏日新品传播创意')).toBeInTheDocument()
  })

  it('connects the dashboard project and membership actions', () => {
    render(<App />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))

    fireEvent.click(screen.getByRole('button', { name: '管理项目' }))
    expect(screen.getByRole('heading', { name: '项目管理' })).toBeInTheDocument()

    fireEvent.click(navigation.getByRole('button', { name: '创作工作台' }))
    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    expect(screen.getByRole('heading', { name: '项目管理' })).toBeInTheDocument()
    expect(screen.getByText('未命名新项目')).toBeInTheDocument()

    fireEvent.click(navigation.getByRole('button', { name: '创作工作台' }))
    fireEvent.click(screen.getByRole('button', { name: '会员中心' }))
    expect(screen.getByRole('heading', { name: '会员中心' })).toBeInTheDocument()
  })

  it('sends non-empty chat messages and keeps them across navigation', () => {
    render(<App />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))
    fireEvent.click(navigation.getByRole('button', { name: 'AI 对话' }))

    const thread = within(screen.getByRole('region', { name: 'AI 对话' }))
    const input = thread.getByRole('textbox', { name: '输入你的想法' })
    const send = thread.getByRole('button', { name: '发送' })

    expect(send).toBeDisabled()
    fireEvent.change(input, { target: { value: '请生成一份夏季活动提纲' } })
    expect(send).toBeEnabled()
    fireEvent.click(send)
    expect(input).toHaveValue('')
    expect(thread.getByText('请生成一份夏季活动提纲')).toBeInTheDocument()

    fireEvent.click(navigation.getByRole('button', { name: 'AI 图片' }))
    fireEvent.click(navigation.getByRole('button', { name: 'AI 对话' }))
    expect(screen.getByText('请生成一份夏季活动提纲')).toBeInTheDocument()
  })

  it('validates and submits the image generation prompt', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 图片' }))

    const controls = within(screen.getByRole('region', { name: '图片生成设置' }))
    const prompt = controls.getByRole('textbox', { name: '提示词' })
    const generate = controls.getByRole('button', { name: '生成图片' })

    expect(controls.getByText('0 / 1000')).toBeInTheDocument()
    expect(generate).toBeDisabled()

    fireEvent.change(prompt, { target: { value: '雨夜中的霓虹城市' } })
    expect(controls.getByText('8 / 1000')).toBeInTheDocument()
    expect(generate).toBeEnabled()

    fireEvent.click(controls.getByRole('button', { name: '优化' }))
    expect((prompt as HTMLTextAreaElement).value).toContain('电影级构图')

    fireEvent.click(controls.getByRole('button', { name: '清空' }))
    expect(prompt).toHaveValue('')
    expect(controls.getByText('0 / 1000')).toBeInTheDocument()
    expect(generate).toBeDisabled()

    fireEvent.change(prompt, { target: { value: '雨夜中的霓虹城市' } })
    fireEvent.click(generate)
    expect(controls.getByRole('status')).toHaveTextContent('已生成 4 张图片')
  })

  it('supports up to three reference images in both image modes', async () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 图片' }))

    const controls = within(screen.getByRole('region', { name: '图片生成设置' }))
    const upload = controls.getByLabelText('添加参考图文件') as HTMLInputElement
    const files = ['one.png', 'two.png', 'three.png', 'four.png'].map((name) => new File(['image'], name, { type: 'image/png' }))

    expect(controls.getByRole('button', { name: '添加参考图' })).toBeInTheDocument()
    fireEvent.change(upload, { target: { files: [files[0]] } })
    await waitFor(() => expect(controls.getByAltText('参考图 one.png')).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/)))
    fireEvent.change(upload, { target: { files: [files[1], files[2], files[3]] } })
    await waitFor(() => expect(controls.getAllByRole('button', { name: /移除参考图/ })).toHaveLength(3))
    expect(controls.getAllByRole('button', { name: /移除参考图/ })).toHaveLength(3)
    expect(controls.getByRole('status')).toHaveTextContent('最多添加 3 张参考图')

    fireEvent.click(controls.getByRole('button', { name: '图生图' }))
    expect(controls.getByRole('button', { name: '添加参考图' })).toBeInTheDocument()
  })

  it('rejects reference images larger than 10MB', async () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 图片' }))

    const oversized = new File(['image'], 'oversized.png', { type: 'image/png' })
    Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 })
    const upload = within(screen.getByRole('region', { name: '图片生成设置' })).getByLabelText('添加参考图文件')
    fireEvent.change(upload, { target: { files: [oversized] } })

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('oversized.png 超过 10MB'))
    expect(screen.queryByRole('button', { name: /移除参考图/ })).not.toBeInTheDocument()
  })

  it('shows the complete desktop window controls on the dashboard', () => {
    render(<App />)
    expect(document.querySelector('.window-frame')).not.toHaveClass('design-only')
    expect(screen.getByRole('button', { name: '最小化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最大化窗口' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
  })

  it('keeps one shared set of desktop window controls after navigation', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 对话' }))
    expect(screen.getAllByRole('button', { name: '最小化' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: '最大化窗口' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(1)
    expect(document.querySelector('.window-frame')).not.toHaveClass('design-only')
  })

  it('delegates the outer corner radius to one shared window frame', () => {
    expect(appStyles).toMatch(/\.window-content\s*\{[^}]*border-radius:\s*var\(--window-radius\)/)
    expect(appStyles).toMatch(/^\.window-content\s*\{[^}]*box-shadow:\s*none/m)
    expect(appStyles).toMatch(/\.page-workspace\s*\{[^}]*border-radius:\s*0/)
  })

  it('clips the transparent window through one compositor-safe dark surface', () => {
    expect(appStyles).toMatch(/\.window-content\s*\{[^}]*clip-path:\s*inset\(0 round var\(--window-radius\)\)/)
    expect(appStyles).toMatch(/\.window-content\s*\{[^}]*isolation:\s*isolate/)
    expect(appStyles).toMatch(/\.window-frame\.is-maximized \.window-content\s*\{[^}]*clip-path:\s*inset\(0\)/)
  })

  it('uses a responsive window shell instead of a fixed transformed canvas', () => {
    render(<App />)

    expect(document.querySelector('.responsive-shell')).toBeInTheDocument()
    expect(document.querySelector('.design-canvas')).not.toBeInTheDocument()
    expect(screen.getByTestId('dashboard-scroll-region')).toHaveClass('figma-main')
    expect(screen.getByTestId('task-scroll-region')).toHaveClass('figma-tasks')
  })

  it('defines the approved desktop and compact dashboard columns', () => {
    expect(appStyles).toMatch(/\.workspace-shell\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-width\) minmax\(0,\s*1fr\)/)
    expect(appStyles).toMatch(/\.figma-app\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 340px/)
    expect(appStyles).toMatch(/@media\s*\(max-width:\s*1439px\)[\s\S]*?\.workspace-shell\s*\{[^}]*grid-template-columns:\s*var\(--sidebar-compact-width\) minmax\(0,\s*1fr\)/)
    expect(appStyles).toMatch(/@media\s*\(max-width:\s*1439px\)[\s\S]*?\.figma-app\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 280px/)
    expect(appStyles).toMatch(/@media\s*\(max-width:\s*1100px\)[\s\S]*?\.quick-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
    expect(appStyles).toMatch(/@media\s*\(max-width:\s*1100px\)[\s\S]*?\.dashboard-grid\s*\{[^}]*grid-template-columns:\s*1fr/)
  })

  it('keeps the center and task regions independently scrollable', () => {
    expect(appStyles).toMatch(/\.figma-main\s*\{[^}]*overflow-y:\s*auto/)
    expect(appStyles).toMatch(/\.figma-tasks\s*\{[^}]*overflow-y:\s*auto/)
  })

  it('removes root-level fixed canvas dimensions and coordinate transforms', () => {
    expect(appStyles).not.toMatch(/\.figma-app\s*\{[^}]*min-width:\s*1440px/)
    expect(appStyles).not.toContain('transform-origin: top left')
    expect(appStyles).not.toMatch(/\.figma-main\s*\{[^}]*left:\s*240px/)
    expect(appStyles).not.toMatch(/\.figma-tasks\s*\{[^}]*left:\s*1100px/)
  })

  it('keeps compact navigation labels available as native tooltips', () => {
    render(<App />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))

    expect(navigation.getByRole('button', { name: 'AI 对话' })).toHaveAttribute('title', 'AI 对话')
    expect(navigation.getByRole('button', { name: 'AI 图片' })).toHaveAttribute('title', 'AI 图片')
  })

  it.each([
    ['创作工作台', '26:773'],
    ['AI 对话', '27:2094'],
    ['AI 图片', '29:2557'],
    ['AI 视频', '30:3867'],
    ['AI 音乐', '32:4671'],
    ['会员', '34:6875'],
    ['项目', '35:7974'],
  ])('opens %s with the correct Figma node', (label, nodeId) => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: label }))
    expect(screen.getByTestId('page-workspace')).toHaveAttribute('data-node-id', nodeId)
  })

  it('keeps one shared sidebar and one set of window controls on every page', () => {
    render(<App />)
    const labels = ['创作工作台', 'AI 对话', 'AI 图片', 'AI 视频', 'AI 音乐', '会员', '项目']

    for (const label of labels) {
      fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: label }))
      expect(screen.getAllByRole('navigation', { name: '主导航' })).toHaveLength(1)
      expect(screen.getAllByRole('button', { name: '最小化' })).toHaveLength(1)
      expect(screen.getAllByRole('button', { name: '最大化窗口' })).toHaveLength(1)
      expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(1)
    }
  })

  it('supports the main video creation path', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 视频' }))
    expect(screen.getByRole('heading', { name: 'AI 视频' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '图生视频' }))
    fireEvent.click(screen.getByRole('button', { name: '创建视频' }))
    expect(screen.getByText('生成完成')).toBeInTheDocument()
  })

  it('keeps the video prompt controls and validation in sync', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 视频' }))

    const controls = within(screen.getByRole('region', { name: '视频生成设置' }))
    const prompt = controls.getByRole('textbox', { name: '提示词' }) as HTMLTextAreaElement
    const generate = controls.getByRole('button', { name: '创建视频' })

    expect(controls.getByText(`${prompt.value.length} / 500`)).toBeInTheDocument()
    expect(generate).toBeEnabled()

    fireEvent.click(controls.getByRole('button', { name: '清空' }))
    expect(prompt).toHaveValue('')
    expect(controls.getByText('0 / 500')).toBeInTheDocument()
    expect(generate).toBeDisabled()

    fireEvent.change(prompt, { target: { value: '云层上方的日出延时摄影' } })
    expect(controls.getByText('11 / 500')).toBeInTheDocument()
    expect(generate).toBeEnabled()

    fireEvent.click(controls.getByRole('button', { name: '优化' }))
    expect(prompt.value).toContain('电影级光影')
    expect(controls.getByText(`${prompt.value.length} / 500`)).toBeInTheDocument()
  })

  it('adds and removes video reference images with the same upload limits', async () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 视频' }))

    const controls = within(screen.getByRole('region', { name: '视频生成设置' }))
    const upload = controls.getByLabelText('添加参考图片文件') as HTMLInputElement
    const files = ['video-one.png', 'video-two.png', 'video-three.png', 'video-four.png'].map((name) => new File(['image'], name, { type: 'image/png' }))

    fireEvent.click(controls.getByRole('button', { name: '移除参考图片 香水参考图' }))
    fireEvent.change(upload, { target: { files } })
    await waitFor(() => expect(controls.getAllByRole('button', { name: /移除参考图片/ })).toHaveLength(3))
    expect(controls.getByRole('status')).toHaveTextContent('最多添加 3 张参考图片')

    fireEvent.click(controls.getByRole('button', { name: '移除参考图片 video-one.png' }))
    expect(controls.getAllByRole('button', { name: /移除参考图片/ })).toHaveLength(2)
  })

  it('supports the main music creation path', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: 'AI 音乐' }))
    expect(screen.getByRole('heading', { name: 'AI 音乐' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '快速' }))
    fireEvent.click(screen.getByRole('button', { name: '3:00' }))
    fireEvent.click(screen.getByRole('button', { name: '生成音乐' }))
    expect(screen.getByText('音乐已生成')).toBeInTheDocument()
  })

  it('selects membership plans', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '会员' }))
    expect(screen.getByRole('heading', { name: '会员中心' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '选择基础版' }))
    expect(screen.getByRole('button', { name: '选择基础版' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters and switches the project collection view', () => {
    render(<App />)
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '项目' }))
    expect(screen.getByRole('heading', { name: '项目管理' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), { target: { value: '赛博' } })
    expect(screen.getByText('赛博城市概念设计')).toBeInTheDocument()
    expect(screen.queryByText('春季新品传播计划')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '列表视图' }))
    expect(screen.getByTestId('project-collection')).toHaveAttribute('data-view', 'list')
    expect(screen.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(screen.getByRole('searchbox', { name: '搜索项目' }), { target: { value: '不存在的项目' } })
    expect(screen.getByRole('status')).toHaveTextContent('没有找到匹配的项目')
  })

  it('keeps newly created projects when navigating between pages', () => {
    render(<App />)
    const navigation = within(screen.getByRole('navigation', { name: '主导航' }))

    fireEvent.click(navigation.getByRole('button', { name: '项目' }))
    fireEvent.click(screen.getByRole('button', { name: '新建项目' }))
    expect(screen.getByText('未命名新项目')).toBeInTheDocument()

    fireEvent.click(navigation.getByRole('button', { name: '创作工作台' }))
    fireEvent.click(navigation.getByRole('button', { name: '项目' }))
    expect(screen.getByText('未命名新项目')).toBeInTheDocument()
  })
})
