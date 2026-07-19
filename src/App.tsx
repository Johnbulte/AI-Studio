import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { AppSidebar } from './components/AppSidebar'
import { ResponsiveShell } from './components/ResponsiveShell'
import { AuthGate } from './components/AuthGate'
import { pageForLabel, type AppPage } from './app/navigation'
import { initialProjects, MembershipPage, MusicPage, ProjectsPage, VideoPage, type Project } from './pages/StudioPages'
import { SettingsPage } from './pages/SettingsPage'
import { AuthProvider, useAuth } from './state/AuthContext'
import ChatWorkspace from './features/chat/ChatWorkspace'
import { ReferenceImagePicker, type ReferenceImage } from './components/ReferenceImagePicker'
import client, { isTauriRuntime, type AppError, type ImageGenerationArgs, type MediaEvent } from './bridge/tauriClient'

const isTauri = () => '__TAURI_INTERNALS__' in window
const reportWindowError = (operation: string, error: unknown) => console.error(`窗口操作失败：${operation}`, error)

function WindowChrome({ children }: { children: ReactNode }) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isTauri()) return

    const appWindow = getCurrentWindow()
    let active = true
    const syncWindowState = () => {
      void appWindow.isMaximized()
        .then((value) => { if (active) setMaximized(value) })
        .catch((error: unknown) => reportWindowError('isMaximized', error))
    }
    syncWindowState()
    window.addEventListener('resize', syncWindowState)
    return () => {
      active = false
      window.removeEventListener('resize', syncWindowState)
    }
  }, [])

  const runWindowCommand = async (command: 'minimize' | 'toggleMaximize' | 'close') => {
    if (!isTauri()) return
    try {
      const appWindow = getCurrentWindow()
      await appWindow[command]()
      if (command === 'toggleMaximize') setMaximized(await appWindow.isMaximized())
    } catch (error) {
      reportWindowError(command, error)
    }
  }

  const startDragging = () => {
    if (!isTauri()) return
    try {
      void getCurrentWindow().startDragging().catch((error: unknown) => reportWindowError('startDragging', error))
    } catch (error) {
      reportWindowError('startDragging', error)
    }
  }

  return (
    <div className={`window-frame ${maximized ? 'is-maximized' : ''}`}>
      <div
        className="window-drag-region"
        data-tauri-drag-region
        onDoubleClick={() => void runWindowCommand('toggleMaximize')}
        onMouseDown={(event) => event.button === 0 && event.detail === 1 && startDragging()}
        aria-hidden="true"
      />
      <div className="window-controls" aria-label="窗口控制">
        <button className="window-control" type="button" aria-label="最小化" title="最小化" onClick={() => void runWindowCommand('minimize')}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 8.5h8" /></svg>
        </button>
        <button className="window-control" type="button" aria-label={maximized ? '还原窗口' : '最大化窗口'} title={maximized ? '还原' : '最大化'} onClick={() => void runWindowCommand('toggleMaximize')}>
          {maximized
            ? <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 4V2.5h5.5V8H8M2.5 4.5H8V10H2.5z" /></svg>
            : <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" /></svg>}
        </button>
        <button className="window-control window-close" type="button" aria-label="关闭" title="关闭" onClick={() => void runWindowCommand('close')}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7" /></svg>
        </button>
      </div>
      <div className="window-content"><ResponsiveShell>{children}</ResponsiveShell></div>
    </div>
  )
}

const works = [
  ['thumb-1.jpg', '赛博城市·黄昏之光', '图像', '2048 × 1152', '2 小时前'],
  ['thumb-2.jpg', '未来叙事短片·片段 01', '视频', '00:32', '昨天 18:42'],
  ['thumb-3.jpg', '深空回响 (氛围音乐)', '音乐', '03:45', '昨天 11:07'],
  ['thumb-4.jpg', '山海之间', '图片', '1536 × 1024', '05-16'],
]

function Dashboard({ onNavigate, onSubmitPrompt, onCreateProject }: { onNavigate: (label: string) => void; onSubmitPrompt: (prompt: string) => void; onCreateProject: () => void }) {
  const [prompt, setPrompt] = useState('')

  const submitPrompt = () => {
    const message = prompt.trim()
    if (message) onSubmitPrompt(message)
  }

  return (
    <main className="figma-app page-workspace" data-testid="workspace" data-node-id="26:773" onContextMenu={(event) => event.preventDefault()}>
      <span data-testid="page-workspace" data-node-id="26:773" className="workspace-test-anchor" aria-hidden="true" />
      <section className="figma-main" data-testid="dashboard-scroll-region">
        <header className="figma-hero"><h1>创作工作台</h1><p>释放你的想象力，AI 与你共创无限可能</p></header>
        <form className="prompt-card" aria-label="创作提示" onSubmit={(event) => { event.preventDefault(); submitPrompt() }}><textarea aria-label="今天想创作什么？" placeholder="今天想创作什么？" value={prompt} onChange={(event) => setPrompt(event.target.value)} /><button type="button" aria-label="创意灵感" onClick={() => setPrompt('为我的新产品设计一个有故事感的创意方案')}><img src="/figma/dashboard/idea.svg" alt="" /></button><button className="prompt-send" type="submit" aria-label="开始生成" disabled={!prompt.trim()}><img src="/figma/dashboard/send.svg" alt="" /></button></form>
        <section className="quick-actions" aria-label="创作快捷入口">
          <button type="button" onClick={() => onNavigate('AI 对话')}><img src="/figma/dashboard/nav-chat.svg" alt="" />AI 对话</button>
          <button type="button" onClick={() => onNavigate('AI 图片')}><img src="/figma/dashboard/nav-image.svg" alt="" />生成图片</button>
          <button type="button" onClick={() => onNavigate('AI 视频')}><img src="/figma/dashboard/nav-video.svg" alt="" />生成视频</button>
          <button type="button" onClick={() => onNavigate('AI 音乐')}><img src="/figma/dashboard/nav-music.svg" alt="" />生成音乐</button>
        </section>
        <section className="dashboard-grid">
          <section className="figma-panel recent-panel">
            <header><h2>最近创作</h2><button type="button">查看全部<img src="/figma/dashboard/arrow-right.svg" alt="" /></button></header>
            {works.map(([image, title, type, detail, time]) => (
              <article className="work-row" key={title}>
                <img src={`/figma/dashboard/${image}`} alt="" />
                <div><strong>{title}</strong><small><b>{type}</b>{detail}</small></div>
                <time>{time}</time>
              </article>
            ))}
          </section>
          <section className="figma-panel project-panel">
            <header><h2>当前项目</h2><button type="button" onClick={() => onNavigate('项目')}><img src="/figma/dashboard/manage.svg" alt="" />管理项目</button></header>
            <img className="project-cover" src="/figma/dashboard/project.jpg" alt="未来幻想短片项目封面" />
            <h3>未来幻想短片 <img src="/figma/dashboard/edit.svg" alt="" /></h3>
            <p>一个关于未来世界的视觉叙事项目，包含短片、概念图、音乐等多种内容。</p>
            <dl><div><dt>12</dt><dd>素材</dd></div><div><dt>3</dt><dd>版本</dd></div><div><dt>8</dt><dd>成员</dd></div><div><dt>67%</dt><dd>进度</dd></div></dl>
            <button className="new-project" type="button" onClick={onCreateProject}><img src="/figma/dashboard/plus.svg" alt="" />新建项目</button>
          </section>
        </section>
      </section>
      <aside className="figma-tasks" data-testid="task-scroll-region" aria-label="任务中心">
        <h2>任务中心</h2>
        <div className="task-list">
          <Task icon="task-image.svg" title="生成图片任务" detail="赛博城市·黄昏之光" progress="80%" />
          <Task icon="task-video.svg" title="视频生成任务" detail="未来叙事短片·片段 02" progress="45%" />
          <Task icon="task-music.svg" title="音乐生成任务" detail="深空回响 (变奏版)" progress="20%" />
        </div>
        <button className="all-tasks" type="button">查看全部任务 <img src="/figma/dashboard/arrow-right.svg" alt="" /></button>
        <section className="credits-card"><h2>本月积分</h2><div className="credit-ring"><img src="/figma/dashboard/credit-ring.svg" alt="" /><div><strong>8,620</strong><small>/ 12,000</small></div></div><p>剩余 <b>3,380</b> 积分</p><small>重置时间: 2025-06-01</small><button type="button" onClick={() => onNavigate('会员')}><img src="/figma/dashboard/membership.svg" alt="" />会员中心</button></section>
      </aside>
    </main>
  )
}

function Task({ icon, title, detail, progress }: { icon: string; title: string; detail: string; progress: string }) {
  return (
    <article className="task">
      <img src={`/figma/dashboard/${icon}`} alt="" />
      <div><header><strong>{title}</strong><span>{progress}</span></header><small>{detail}</small><div className="task-progress"><i style={{ width: progress }} /></div></div>
    </article>
  )
}

function PreviewAwareChat({ previewMessages, onPreviewSend }: { previewMessages: string[]; onPreviewSend: (content: string) => void }) {
  const { isPreviewMode } = useAuth()
  return <ChatWorkspace previewMode={isPreviewMode} previewMessages={previewMessages} onPreviewSend={onPreviewSend} />
}

const imageAsset = (name: string) => `/figma/image/${name}`

const imageHistory = [
  { image: 'history-city.png', title: '赛博朋克风格的未来城市，霓虹灯光...', meta: '文生图 | 16:9 | 4张', time: '今天 15:42' },
  { image: 'history-rose.png', title: '唯美插画，春日花园里的少女...', meta: '文生图 | 3:4 | 4张', time: '今天 14:20' },
  { image: 'history-architecture.png', title: '极简风格，黑白建筑几何摄影...', meta: '图生图 | 1:1 | 2张', time: '今天 11:15' },
  { image: 'history-perfume.png', title: '产品主图，高端香水瓶，水面倒影...', meta: '文生图 | 16:9 | 4张', time: '昨天 16:30' },
  { image: 'history-leaf.png', title: '微距摄影，叶片上的清晨露珠...', meta: '文生图 | 4:3 | 4张', time: '昨天 09:45' },
] as const

type ImageControlsProps = {
  busy: boolean
  message: string
  error: AppError | null
  onGenerate: (args: ImageGenerationArgs) => void
  onCancel: () => void
  onRetry: () => void
}

function ImageControls({ busy, message, error, onGenerate, onCancel, onRetry }: ImageControlsProps) {
  const [mode, setMode] = useState('文生图')
  const [prompt, setPrompt] = useState('')
  const [ratio, setRatio] = useState('1:1')
  const [count, setCount] = useState(4)
  const [localMessage, setLocalMessage] = useState('')
  const [references, setReferences] = useState<ReferenceImage[]>([])
  const ratios = [
    ['1:1', 'square'], ['4:3', 'landscape'], ['3:4', 'portrait'], ['16:9', 'wide'], ['9:16', 'tall'],
  ] as const

  const updatePrompt = (value: string) => {
    setPrompt(value)
    setLocalMessage('')
  }
  const optimizePrompt = () => {
    if (!prompt.trim()) return
    updatePrompt(`${prompt.trim()}，电影级构图，高质量细节，协调色彩与光影`.slice(0, 1000))
  }

  return (
    <section className="image-controls" aria-label="图片生成设置">
      <div className="image-control-group image-mode-group">
        <label>创作模式</label>
        <div className="image-mode-select">
          {['文生图', '图生图'].map((item) => <button aria-pressed={mode === item} className={mode === item ? 'selected' : ''} onClick={() => setMode(item)} type="button" key={item}>{item}</button>)}
        </div>
      </div>
      <div className="image-control-group image-prompt-group">
        <div className="image-label-row"><label htmlFor="image-prompt">提示词</label><span><button type="button" disabled={!prompt.trim()} onClick={optimizePrompt}><img src={imageAsset('optimize.svg')} alt="" />优化</button><button disabled={!prompt} onClick={() => updatePrompt('')} type="button">清空</button></span></div>
        <div className="image-prompt-box"><textarea id="image-prompt" maxLength={1000} value={prompt} onChange={(event) => updatePrompt(event.target.value)} placeholder="描述你想要的画面..." /><small>{prompt.length} / 1000</small></div>
      </div>
      <ReferenceImagePicker addLabel="添加参考图" fileLabel="添加参考图文件" removeLabel="移除参考图" heading="参考图（可选）" helper="最多 3 张 · 单张不超过 10MB" onChange={setReferences} />
      <div className="image-control-group image-ratio-group">
        <label>画面比例</label>
        <div className="image-ratios">
          {ratios.map(([item, shape]) => <button aria-pressed={ratio === item} className={ratio === item ? 'selected' : ''} onClick={() => setRatio(item)} type="button" key={item}><i className={shape} />{item}</button>)}
        </div>
      </div>
      <div className="image-control-group image-count-group">
        <label>生成数量</label>
        <div className="image-counts">{[1, 2, 3, 4].map((item) => <button aria-pressed={count === item} className={count === item ? 'selected' : ''} onClick={() => setCount(item)} type="button" key={item}>{item}</button>)}</div>
      </div>
      <div className="image-advanced"><label>高级设置</label><button type="button">展开<img src={imageAsset('chevron-down.svg')} alt="" /></button></div>
      <button className="image-generate-button" disabled={!prompt.trim() || busy} onClick={() => {
        if (mode === '图生图' && references.length === 0) {
          setLocalMessage('图生图至少添加 1 张参考图')
          return
        }
        setLocalMessage('')
        onGenerate({ prompt: prompt.trim(), aspectRatio: ratio, count, references: references.map((reference) => reference.src) })
      }} type="button">{busy ? '生成中…' : '生成图片'}</button>
      {busy && <button className="image-cancel-button" type="button" onClick={onCancel}>取消生成</button>}
      {(message || localMessage) && <p className="image-generation-status" role="status">{message || localMessage}</p>}
      {error && <div className="image-generation-error" role="alert"><span>{error.message}{error.retryable ? '（可以重试）' : ''}</span>{error.retryable && <button type="button" onClick={onRetry}>重试</button>}</div>}
    </section>
  )
}

function ImagePreview({ resultUrl, busy, progress }: { resultUrl: string; busy: boolean; progress: number | null }) {
  return (
    <section className="image-preview" aria-label="当前生成结果">
      <header><h2>当前生成</h2><div><button className="image-expand" aria-label="放大预览" type="button"><img src={imageAsset('expand.svg')} alt="" /></button><button className="image-download" type="button"><img src={imageAsset('download.svg')} alt="" />下载图片</button></div></header>
      <div className={`image-main-preview ${busy ? 'is-generating' : ''}`}><img src={resultUrl} alt="紫色与青色抽象渐变生成图" />{busy && <div className="image-generation-overlay"><strong>正在生成图片</strong><span>{progress === null ? '任务已提交，等待结果…' : `${progress}%`}</span></div>}</div>
      <div className="image-variants">{[1, 2, 3, 4].map((item) => <button className={item === 1 ? 'selected' : ''} type="button" key={item}><img src={imageAsset('generated-thumb.png')} alt={`生成结果 ${item}`} /></button>)}</div>
      <footer><img src={imageAsset('success.svg')} alt="" /><strong>生成完成</strong><span>用时 00:08</span></footer>
    </section>
  )
}

function ImageHistory({ currentResult }: { currentResult: string | null }) {
  return (
    <section className="image-history" aria-label="生成记录">
      <header><h2>生成记录</h2><button type="button">全部<img src={imageAsset('filter.svg')} alt="" /></button></header>
      <div className="image-history-list">
        {currentResult && <article className="selected"><img className="image-history-thumb" src={currentResult} alt="本次生成结果" /><div><h3>本次多米 API 生成结果</h3><p>真实生成 · 当前任务</p><footer><time>刚刚</time><span><img src={imageAsset('success-small.svg')} alt="" />生成完成</span></footer></div></article>}
        {imageHistory.map((item, index) => (
          <article className={!currentResult && index === 0 ? 'selected' : ''} key={item.title}>
            <img className="image-history-thumb" src={imageAsset(item.image)} alt="" />
            <div><h3>{item.title}</h3><p>{item.meta}</p><footer><time>{item.time}</time><span><img src={imageAsset('success-small.svg')} alt="" />生成完成</span></footer></div>
          </article>
        ))}
      </div>
      <button className="image-history-all" type="button">查看全部记录<img src={imageAsset('arrow-right.svg')} alt="" /></button>
    </section>
  )
}

function AiImage() {
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'failed' | 'cancelled'>('idle')
  const [progress, setProgress] = useState<number | null>(null)
  const [resultUrl, setResultUrl] = useState(imageAsset('generated-main.png'))
  const [lastResultUrl, setLastResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [lastArgs, setLastArgs] = useState<ImageGenerationArgs | null>(null)
  const requestIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isTauriRuntime()) return
    let active = true
    void client.listMediaRuns().then((runs) => {
      if (!active) return
      const latest = runs.find((run) => run.kind === 'image' && run.status === 'completed' && run.resultUrl)
      if (latest?.resultUrl) {
        setResultUrl(latest.resultUrl)
        setLastResultUrl(latest.resultUrl)
        setStatus('completed')
      }
    }).catch(() => undefined)
    const handleEvent = (event: MediaEvent) => {
      if (!active || event.kind !== 'image' || event.requestId !== requestIdRef.current) return
      setProgress(event.progress)
      if (event.status === 'running') setStatus('generating')
      if (event.status === 'completed' && event.resultUrl) {
        setResultUrl(event.resultUrl)
        setLastResultUrl(event.resultUrl)
        setStatus('completed')
      }
      if (event.status === 'cancelled') setStatus('cancelled')
      if (event.status === 'failed') {
        setError(event.error)
        setStatus('failed')
      }
    }
    let unlisten: Array<() => void> = []
    void Promise.all(['updated', 'completed', 'failed'].map((eventName) => client.listenMediaEvent(eventName as 'updated' | 'completed' | 'failed', handleEvent))).then((cleanups) => {
      if (!active) cleanups.forEach((cleanup) => cleanup())
      else unlisten = cleanups
    }).catch((cause) => {
      if (active) setError({ code: 'media_listener_error', message: String((cause as Partial<AppError>).message || '无法监听媒体任务状态'), retryable: true })
    })
    return () => { active = false; unlisten.forEach((cleanup) => cleanup()) }
  }, [])

  const generate = async (args: ImageGenerationArgs) => {
    setLastArgs(args)
    setError(null)
    setProgress(null)
    setStatus('generating')
    if (!isTauriRuntime()) {
      setResultUrl(imageAsset('generated-main.png'))
      setLastResultUrl(imageAsset('generated-main.png'))
      setStatus('completed')
      return
    }
    try {
      const started = await client.startImageGeneration(args)
      requestIdRef.current = started.requestId
    } catch (cause) {
      const appError = typeof cause === 'object' && cause !== null && 'message' in cause
        ? { code: String((cause as Partial<AppError>).code || 'media_error'), message: String((cause as Partial<AppError>).message), retryable: Boolean((cause as Partial<AppError>).retryable) }
        : { code: 'media_error', message: '图片生成请求失败', retryable: true }
      setError(appError)
      setStatus('failed')
    }
  }

  const cancel = () => {
    if (!requestIdRef.current || !isTauriRuntime()) {
      setStatus('cancelled')
      return
    }
    void client.cancelMediaGeneration(requestIdRef.current).catch((cause) => setError(typeof cause === 'object' && cause !== null && 'message' in cause ? cause as AppError : { code: 'cancel_error', message: '取消生成失败', retryable: true }))
  }

  const busy = status === 'generating'
  const message = status === 'generating' ? `正在生成${progress === null ? '…' : ` ${progress}%`}` : status === 'completed' && lastArgs ? `已生成 ${lastArgs.count} 张图片` : status === 'cancelled' ? '已取消生成' : ''

  return (
    <main className="image-app page-workspace" data-testid="page-workspace" data-node-id="29:2557">
      <span data-testid="ai-image-workspace" className="workspace-test-anchor" aria-hidden="true" />
      <section className="image-main">
        <header className="image-header"><h1>AI 图片</h1><div><button type="button"><img src={imageAsset('overview.svg')} alt="" />项目概览</button><button className="primary" type="button"><img src={imageAsset('continue.svg')} alt="" />继续创作</button></div></header>
        <div className="image-workspace"><ImageControls busy={busy} message={message} error={error} onGenerate={(args) => void generate(args)} onCancel={cancel} onRetry={() => lastArgs && void generate(lastArgs)} /><ImagePreview resultUrl={resultUrl} busy={busy} progress={progress} /><ImageHistory currentResult={lastResultUrl} /></div>
      </section>
    </main>
  )
}

function App() {
  const [page, setPage] = useState<AppPage>('dashboard')
  const [chatMessages, setChatMessages] = useState<string[]>([])
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  let content: ReactNode
  const navigate = (label: string) => {
    const nextPage = pageForLabel(label)
    if (nextPage) setPage(nextPage)
  }
  const createProject = () => setProjects((current) => [{ id: `new-${current.length + 1}`, title: '未命名新项目', image: 'asset-4.jpg', kind: '图像', meta: '包含 0 个素材 · 刚刚创建', status: '进行中', scope: 'mine' }, ...current])

  if (page === 'chat') content = <PreviewAwareChat previewMessages={chatMessages} onPreviewSend={(message) => setChatMessages((current) => [...current, message])} />
  else if (page === 'image') content = <AiImage />
  else if (page === 'video') content = <VideoPage />
  else if (page === 'music') content = <MusicPage />
  else if (page === 'membership') content = <MembershipPage />
  else if (page === 'projects') content = <ProjectsPage projects={projects} onCreateProject={createProject} />
  else if (page === 'settings') content = <SettingsPage onBack={() => setPage('dashboard')} />
  else content = <Dashboard onNavigate={navigate} onSubmitPrompt={(message) => { setChatMessages((current) => [...current, message]); setPage('chat') }} onCreateProject={() => { createProject(); setPage('projects') }} />

  const activeLabel: Record<AppPage, string> = {
    dashboard: '创作工作台',
    chat: 'AI 对话',
    image: 'AI 图片',
    video: 'AI 视频',
    music: 'AI 音乐',
    membership: '会员',
    projects: '项目',
    settings: '设置',
  }

  return (
    <AuthProvider>
      <WindowChrome>
        <AuthGate>
          <div className="workspace-shell">
            <AppSidebar active={activeLabel[page]} onNavigate={navigate} onSettings={() => setPage('settings')} />
            {content}
          </div>
        </AuthGate>
      </WindowChrome>
    </AuthProvider>
  )
}

export default App
