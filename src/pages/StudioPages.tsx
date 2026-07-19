import { useMemo, useState } from 'react'
import { useEffect, useRef } from 'react'
import { ReferenceImagePicker, type ReferenceImage } from '../components/ReferenceImagePicker'
import client, { isTauriRuntime, type AppError, type MediaEvent, type VideoGenerationArgs } from '../bridge/tauriClient'

const videoHistory = [
  ['image-3.jpg', '春季香水广告·花海...', '文生视频 | 16:9 | 1080P', '今天 14:35', '00:06'],
  ['image-4.jpg', '春日花田人像短片', '文生视频 | 16:9 | 1080P', '今天 13:22', '00:08'],
  ['image-5.jpg', '紫色丝绸飘动特写', '文生视频 | 9:16 | 1080P', '今天 11:47', '00:05'],
  ['image-6.jpg', '花海放延时摄影', '文生视频 | 16:9 | 4K', '昨天 18:20', '00:07'],
  ['image-7.jpg', '水面涟漪与花瓣', '图生视频 | 1:1 | 1080P', '昨天 16:08', '00:06'],
] as const

const initialVideoPrompt = '香水瓶置于盛开的红色花朵前，镜头缓慢推进，柔和光影，高级产品广告质感'
const initialVideoReference: ReferenceImage = { id: 'video-sample-reference', name: '香水参考图', src: '/figma/video/image-3.jpg' }

export function VideoPage() {
  const [mode, setMode] = useState('文生视频')
  const [prompt, setPrompt] = useState(initialVideoPrompt)
  const [motion, setMotion] = useState('轻微推进')
  const [duration, setDuration] = useState('6 秒')
  const [ratio, setRatio] = useState('16:9 (横屏)')
  const [quality, setQuality] = useState('1080P')
  const [generated, setGenerated] = useState(false)
  const [references, setReferences] = useState<ReferenceImage[]>([initialVideoReference])
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'completed' | 'failed' | 'cancelled'>('idle')
  const [progress, setProgress] = useState<number | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [lastArgs, setLastArgs] = useState<VideoGenerationArgs | null>(null)
  const requestIdRef = useRef<string | null>(null)

  const updatePrompt = (value: string) => {
    setPrompt(value)
    setGenerated(false)
  }

  const optimizePrompt = () => {
    if (!prompt.trim()) return
    updatePrompt(`${prompt.trim()}，电影级光影，流畅镜头运动，细节清晰`.slice(0, 500))
  }

  useEffect(() => {
    if (!isTauriRuntime()) return
    let active = true
    void client.listMediaRuns().then((runs) => {
      if (!active) return
      const latest = runs.find((run) => run.kind === 'video' && run.status === 'completed' && run.resultUrl)
      if (latest?.resultUrl) {
        setResultUrl(latest.resultUrl)
        setGenerated(true)
        setGenerationStatus('completed')
      }
    }).catch(() => undefined)
    const handleEvent = (event: MediaEvent) => {
      if (!active || event.kind !== 'video' || event.requestId !== requestIdRef.current) return
      setProgress(event.progress)
      if (event.status === 'running') setGenerationStatus('generating')
      if (event.status === 'completed' && event.resultUrl) {
        setResultUrl(event.resultUrl)
        setGenerated(true)
        setGenerationStatus('completed')
      }
      if (event.status === 'cancelled') setGenerationStatus('cancelled')
      if (event.status === 'failed') {
        setError(event.error)
        setGenerationStatus('failed')
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

  const startGeneration = async (args: VideoGenerationArgs) => {
    setLastArgs(args)
    setError(null)
    setProgress(null)
    setGenerationStatus('generating')
    setGenerated(false)
    if (!isTauriRuntime()) {
      setGenerated(true)
      setGenerationStatus('completed')
      return
    }
    try {
      const started = await client.startVideoGeneration(args)
      requestIdRef.current = started.requestId
    } catch (cause) {
      const appError = typeof cause === 'object' && cause !== null && 'message' in cause
        ? { code: String((cause as Partial<AppError>).code || 'media_error'), message: String((cause as Partial<AppError>).message), retryable: Boolean((cause as Partial<AppError>).retryable) }
        : { code: 'media_error', message: '视频生成请求失败', retryable: true }
      setError(appError)
      setGenerationStatus('failed')
    }
  }

  const createVideo = () => {
    const apiReferences = mode === '图生视频' ? references.filter((reference) => reference.src.startsWith('data:')).map((reference) => reference.src) : []
    if (isTauriRuntime() && mode === '图生视频' && apiReferences.length === 0) {
      setError({ code: 'invalid_request', message: '图生视频至少添加 1 张参考图片', retryable: false })
      setGenerationStatus('failed')
      return
    }
    void startGeneration({
      prompt: prompt.trim(),
      mode,
      aspectRatio: ratio,
      duration: Number.parseInt(duration, 10),
      resolution: quality,
      references: apiReferences,
    })
  }

  const cancelGeneration = () => {
    if (!requestIdRef.current || !isTauriRuntime()) {
      setGenerationStatus('cancelled')
      return
    }
    void client.cancelMediaGeneration(requestIdRef.current).catch((cause) => setError(typeof cause === 'object' && cause !== null && 'message' in cause ? cause as AppError : { code: 'cancel_error', message: '取消生成失败', retryable: true }))
  }

  const busy = generationStatus === 'generating'

  return (
    <main className="studio-tool-app page-workspace" data-testid="page-workspace" data-node-id="30:3867">
      <section className="studio-tool-main video-page">
        <header className="tool-header"><h1>AI 视频</h1><div><button type="button"><img src="/figma/image/overview.svg" alt="" />项目概览</button><button className="primary" type="button"><img src="/figma/image/continue.svg" alt="" />继续创作</button></div></header>
        <div className="tool-grid video-grid">
          <section className="tool-controls video-controls" aria-label="视频生成设置">
            <label>创作模式</label>
            <div className="segmented">{['文生视频', '图生视频'].map((item) => <button type="button" className={mode === item ? 'selected' : ''} aria-pressed={mode === item} onClick={() => setMode(item)} key={item}>{item}</button>)}</div>
            <div className="field-title"><label htmlFor="video-prompt">提示词</label><button type="button" disabled={!prompt.trim()} onClick={optimizePrompt}>优化</button><button type="button" disabled={!prompt} onClick={() => updatePrompt('')}>清空</button></div>
            <textarea id="video-prompt" maxLength={500} value={prompt} onChange={(event) => updatePrompt(event.target.value)} />
            <span className="counter">{prompt.length} / 500</span>
            <ReferenceImagePicker
              className="video-reference-group"
              addLabel="添加参考图片"
              fileLabel="添加参考图片文件"
              removeLabel="移除参考图片"
              heading="参考图片"
              helper="最多 3 张 · 单张不超过 10MB"
              initialImages={[initialVideoReference]}
              onChange={setReferences}
            />
            <label>镜头运动</label><select aria-label="镜头运动" value={motion} onChange={(event) => setMotion(event.target.value)}><option>轻微推进</option><option>环绕镜头</option><option>静态镜头</option></select>
            <label>视频时长</label><select aria-label="视频时长" value={duration} onChange={(event) => setDuration(event.target.value)}><option>6 秒</option><option>8 秒</option><option>10 秒</option></select>
            <label>画面比例</label><select aria-label="画面比例" value={ratio} onChange={(event) => setRatio(event.target.value)}><option>16:9 (横屏)</option><option>9:16 (竖屏)</option><option>1:1 (方形)</option></select>
            <label>清晰度</label><select aria-label="清晰度" value={quality} onChange={(event) => setQuality(event.target.value)}><option>1080P</option><option>4K</option></select>
            <button className="tool-generate" type="button" disabled={!prompt.trim() || busy} onClick={createVideo}>{busy ? '生成中…' : '创建视频'}</button>
            {busy && <button className="media-cancel-button" type="button" onClick={cancelGeneration}>取消生成</button>}
            {busy && <p className="media-progress" role="status">正在生成{progress === null ? '…' : ` ${progress}%`}</p>}
            {generationStatus === 'cancelled' && <p className="media-progress" role="status">已取消生成</p>}
            {error && <div className="media-generation-error" role="alert"><span>{error.message}{error.retryable ? '（可以重试）' : ''}</span>{error.retryable && <button type="button" onClick={() => lastArgs && void startGeneration(lastArgs)}>重试</button>}</div>}
          </section>
          <section className="video-preview-card" aria-label="视频预览">
            <div className="video-frame">{resultUrl ? <video src={resultUrl} controls aria-label="多米 API 生成视频" /> : <img src="/figma/video/image-3.jpg" alt="香水视频预览" />}<div className="video-player"><button type="button">播放</button><span>00:02 / 00:06</span><i><span /></i><b>1080P</b></div></div>
            <div className="video-variants">{[3, 4, 5, 6, 7].map((item, index) => <button className={index === 0 ? 'selected' : ''} type="button" key={item}><img src={`/figma/video/image-${item}.jpg`} alt={`视频方案 ${index + 1}`} /></button>)}</div>
            <footer><strong>{generated ? '生成完成' : busy ? '正在生成' : '生成完成状态'}</strong><span>{resultUrl ? '多米 API' : '用时 00:24'}</span></footer>
          </section>
          <section className="tool-history" aria-label="生成记录">
            <h2>生成记录</h2>
            <div>{videoHistory.map(([image, title, meta, time, length], index) => <article className={index === 0 ? 'selected' : ''} key={title}><div className="history-thumb"><img src={`/figma/video/${image}`} alt="" /><time>{length}</time></div><div><h3>{title}</h3><p>{meta}</p><footer><time>{time}</time><span>已完成</span></footer></div></article>)}</div>
            <button className="view-all" type="button">查看全部记录</button>
          </section>
        </div>
      </section>
    </main>
  )
}

const tracks = [
  ['cover-1.jpg', '春日微光', '流行 · 温暖 · 中速', '02:00'],
  ['cover-2.jpg', '星夜漫步', '轻音乐 · 放松 · 慢速', '01:45'],
  ['cover-3.jpg', '城市回响', '电子 · 动感 · 快速', '02:30'],
  ['cover-4.jpg', '午后咖啡馆', '爵士 · 慵懒 · 中速', '01:58'],
  ['cover-5.jpg', '风之旅人', '轻音乐 · 治愈 · 慢速', '02:15'],
  ['cover-6.jpg', '霓虹心跳', '电子 · 活力 · 快速', '02:42'],
  ['cover-7.jpg', '时光剪影', '钢琴 · 怀旧 · 慢速', '01:50'],
  ['cover-8.jpg', '远方的你', '流行 · 思念 · 中速', '02:05'],
] as const

export function MusicPage() {
  const [tempo, setTempo] = useState('中速')
  const [voice, setVoice] = useState('纯音乐')
  const [duration, setDuration] = useState('2:00')
  const [generated, setGenerated] = useState(false)

  return (
    <main className="studio-tool-app page-workspace" data-testid="page-workspace" data-node-id="32:4671">
      <section className="studio-tool-main music-page">
        <header className="tool-header"><h1>AI 音乐</h1></header>
        <div className="tool-grid music-grid">
          <section className="tool-controls music-controls" aria-label="音乐生成设置">
            <label>音乐类型</label><select aria-label="音乐类型"><option>流行</option><option>电子</option><option>轻音乐</option></select>
            <label>情绪</label><div className="tag-select"><button type="button">温暖 ×</button></div>
            <label>节奏</label><div className="segmented three">{['慢速', '中速', '快速'].map((item) => <button type="button" className={tempo === item ? 'selected' : ''} aria-pressed={tempo === item} onClick={() => setTempo(item)} key={item}>{item}</button>)}</div>
            <label>乐器</label><select aria-label="乐器"><option>钢琴, 吉他, 弦乐</option><option>合成器, 鼓机</option></select>
            <label>人声</label><div className="segmented">{['纯音乐', '有人声'].map((item) => <button type="button" className={voice === item ? 'selected' : ''} aria-pressed={voice === item} onClick={() => setVoice(item)} key={item}>{item}</button>)}</div>
            <label>时长</label><div className="segmented four">{['1:00', '2:00', '3:00', '4:00'].map((item) => <button type="button" className={duration === item ? 'selected' : ''} aria-pressed={duration === item} onClick={() => setDuration(item)} key={item}>{item}</button>)}</div>
            <button className="tool-generate" type="button" onClick={() => setGenerated(true)}><img src="/figma/image/continue.svg" alt="" />生成音乐</button>
            {generated && <p className="success-message">音乐已生成</p>}
          </section>
          <section className="music-studio" aria-label="当前曲目">
            <article className="music-player">
              <img src="/figma/music/cover-0.jpg" alt="春日微光封面" />
              <div className="music-meta"><h2>春日微光</h2><p>AI Studio</p><span>流行 · 温暖 · {tempo}</span></div>
              <div className="music-player-tools"><button type="button" aria-label="收藏"><img src="/figma/music/icons/heart.svg" alt="" /></button><button type="button" aria-label="更多操作"><img src="/figma/music/icons/more.svg" alt="" /></button></div>
              <div className="track-progress"><time>00:45</time><i><span /></i><time>{duration}</time></div>
              <div className="player-actions">
                <button type="button" aria-label="循环播放"><img src="/figma/music/icons/repeat.svg" alt="" /></button>
                <button type="button" aria-label="上一首"><img src="/figma/music/icons/previous.svg" alt="" /></button>
                <button className="pause" type="button" aria-label="暂停"><img src="/figma/music/icons/pause.svg" alt="" /></button>
                <button type="button" aria-label="下一首"><img src="/figma/music/icons/next.svg" alt="" /></button>
                <button type="button" aria-label="随机播放"><img src="/figma/music/icons/shuffle.svg" alt="" /></button>
              </div>
            </article>
            <section className="music-layers"><h2>音轨分层</h2>{['钢琴', '吉他', '弦乐', '氛围音效'].map((name, index) => <div className="layer-row" key={name}><span className="layer-name"><img src="/figma/music/icons/note.svg" alt="" />{name}</span><img className="wave" src={`/figma/music/wave-${index}.png`} alt="" /><input aria-label={`${name}音量`} type="range" defaultValue={index === 3 ? 74 : 68} /><button type="button">S</button><button className="layer-more" type="button" aria-label={`${name}更多操作`}><img src="/figma/music/icons/more-small.svg" alt="" /></button></div>)}</section>
          </section>
          <section className="music-library" aria-label="我的曲目"><header><h2>我的曲目</h2><button type="button">新建</button></header><button className="sort-button" type="button">最近编辑</button><div>{tracks.map(([image, title, meta, time], index) => <article className={index === 0 ? 'selected' : ''} key={title}><img src={`/figma/music/${image}`} alt="" /><div><h3>{title}</h3><p>{meta}</p><time>{time}</time></div></article>)}</div><footer>共 18 首 <span>1　2　3</span></footer></section>
        </div>
      </section>
    </main>
  )
}

const plans = [
  { name: '专业版', price: '59', subtitle: '适合个人创作者和高频使用者', points: '600 积分 / 月', features: ['高速生成配额', '解锁全部高级模型', '商用版权许可', '100GB 云存储空间', '优先客服支持'] },
  { name: '基础版', price: '19', subtitle: '适合轻度使用者', points: '200 积分 / 月', features: ['基础生成配额', '部分模型使用', '个人非商用授权', '20GB 云存储空间', '客服支持'] },
  { name: '团队版', price: '199', subtitle: '适合团队协作与管理', points: '1800 积分 / 月', features: ['高速生成配额', '全部高级模型', '商用版权许可', '团队协作管理', '1TB 云存储空间', '专属客服支持'] },
] as const

const records = [
  ['2024-05-17 14:30', '模型消耗', '文本生成', '- 20', '420'],
  ['2024-05-17 13:12', '模型消耗', '图像生成', '- 30', '440'],
  ['2024-05-16 18:45', '积分赠送', '活动奖励', '+ 10', '470'],
  ['2024-05-16 10:22', '充值', '购买 600 积分', '+ 600', '460'],
  ['2024-05-15 09:15', '模型消耗', '视频生成', '- 40', '-140'],
] as const

export function MembershipPage() {
  const [selected, setSelected] = useState('专业版')
  const [feedback, setFeedback] = useState('')
  return (
    <main className="studio-tool-app page-workspace" data-testid="page-workspace" data-node-id="34:6875">
      <section className="membership-page">
        <h1>会员中心</h1>
        <div className="membership-layout">
          <section className="plan-column"><div className="plan-grid">{plans.map((plan) => <button type="button" aria-label={`选择${plan.name}`} aria-pressed={selected === plan.name} onClick={() => setSelected(plan.name)} className={`plan-card ${selected === plan.name ? 'selected' : ''}`} key={plan.name}><header><h2>{plan.name}</h2>{plan.name === '专业版' && <span>当前版本</span>}</header><p>{plan.subtitle}</p><strong><small>¥</small>{plan.price}<em>/ 月{plan.name === '团队版' ? '起' : ''}</em></strong><b>{plan.points}</b><ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul></button>)}</div>
            <section className="billing-history"><header><h2>消费记录</h2><button type="button">查看全部</button></header><div className="billing-row billing-head"><span>时间</span><span>类型</span><span>详情</span><span>积分变化</span><span>余额</span></div>{records.map((row) => <div className="billing-row" key={row[0]}>{row.map((cell, index) => <span className={index === 0 ? 'date' : ''} key={`${cell}-${index}`}>{cell}</span>)}</div>)}</section>
          </section>
          <aside className="benefits"><h2>权益说明</h2>{[['模型加速', '享受高速通道，优先使用最新最强大的 AI 模型。'], ['商用授权', '支持生成内容的商用用途，保障您的创作权益。'], ['云存储空间', '提供大容量云存储，安全保存您的作品与素材。'], ['团队协作', '团队成员管理、权限分配，提升协作效率。']].map(([title, copy], index) => <article key={title}><span><img src={`/figma/dashboard/${['nav-workspace.svg', 'nav-membership.svg', 'nav-library.svg', 'nav-projects.svg'][index]}`} alt="" /></span><div><h3>{title}</h3><p>{copy}</p></div></article>)}<button className="upgrade" type="button" onClick={() => setFeedback(`已选择${selected}`)}>立即升级</button><button className="recharge" type="button" onClick={() => setFeedback('积分充值已打开')}>充值积分</button><button className="coupon" type="button">兑换会员卡券</button>{feedback && <p className="membership-feedback">{feedback}</p>}</aside>
        </div>
      </section>
    </main>
  )
}

export type Project = { id: string; title: string; image: string; kind: string; meta: string; status: string; scope: 'mine' | 'shared' }
export const initialProjects: Project[] = [
  { id: 'spring-launch', title: '春季新品传播计划', image: 'asset-0.jpg', kind: '视频', meta: '包含 12 个素材 · 最后更新于 2 小时前', status: '进行中', scope: 'mine' },
  { id: 'cyber-city', title: '赛博城市概念设计', image: 'asset-4.jpg', kind: '图像', meta: '包含 45 个素材 · 最后更新于 昨天', status: '已完成', scope: 'mine' },
  { id: 'deep-space', title: '深空回响原声带', image: 'asset-5.jpg', kind: '音乐', meta: '包含 8 个素材 · 最后更新于 3 天前', status: '进行中', scope: 'shared' },
  { id: 'future-story', title: '未来叙事短片', image: 'asset-6.jpg', kind: '混合', meta: '包含 24 个素材 · 最后更新于 上周', status: '进行中', scope: 'shared' },
  { id: 'brand-kv', title: '新品牌KV', image: 'asset-8.jpg', kind: '图像', meta: '包含 15 个素材 · 最后更新于 05-12', status: '已完成', scope: 'mine' },
  { id: 'healing-music', title: '治愈系轻音乐', image: 'asset-9.jpg', kind: '音乐', meta: '包含 6 个素材 · 最后更新于 05-10', status: '已完成', scope: 'shared' },
  { id: 'product-demo', title: '产品功能演示', image: 'asset-10.jpg', kind: '视频', meta: '包含 32 个素材 · 最后更新于 05-08', status: '进行中', scope: 'mine' },
  { id: 'social-assets', title: '社媒运营素材库', image: 'asset-11.jpg', kind: '混合', meta: '包含 128 个素材 · 最后更新于 05-01', status: '进行中', scope: 'shared' },
]

export function ProjectsPage({ projects, onCreateProject }: { projects: Project[]; onCreateProject: () => void }) {
  const [tab, setTab] = useState('所有项目')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const filtered = useMemo(() => projects.filter((project) => (tab === '所有项目' || (tab === '我创建的' ? project.scope === 'mine' : project.scope === 'shared')) && project.title.includes(query.trim())), [projects, query, tab])

  return (
    <main className="studio-tool-app page-workspace" data-testid="page-workspace" data-node-id="35:7974">
      <section className="projects-page">
        <header className="projects-header"><h1>项目管理</h1><nav aria-label="项目分类">{['所有项目', '我创建的', '与我共享'].map((item) => <button className={tab === item ? 'selected' : ''} aria-pressed={tab === item} onClick={() => setTab(item)} type="button" key={item}>{item}</button>)}</nav><input type="search" aria-label="搜索项目" placeholder="搜索项目..." value={query} onChange={(event) => setQuery(event.target.value)} /></header>
        <div className="projects-content"><div className="projects-toolbar"><h2>{tab}</h2><div><select aria-label="项目排序"><option>最近编辑</option><option>最早创建</option></select><span className="view-switch"><button type="button" className={view === 'grid' ? 'selected' : ''} aria-label="网格视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>网格</button><button type="button" className={view === 'list' ? 'selected' : ''} aria-label="列表视图" aria-pressed={view === 'list'} onClick={() => setView('list')}>列表</button></span><button className="new-project-button" type="button" onClick={onCreateProject}>新建项目</button></div></div>
          <section className={`project-collection ${view}`} data-testid="project-collection" data-view={view}>{filtered.length > 0 ? filtered.map((project, index) => <article className="project-card" key={project.id}><img src={`/figma/projects/${project.image}`} alt="" /><span className="project-kind">{project.kind}</span><div className="project-card-copy"><h3>{project.title}</h3><p>{project.meta}</p><footer><span className="project-avatars"><img src="/figma/dashboard/avatar.jpg" alt="" />{index % 2 === 0 && <img src="/figma/chat/chat-user-avatar.jpg" alt="" />}</span><b className={project.status === '已完成' ? 'done' : ''}>{project.status}</b></footer></div></article>) : <p className="project-empty" role="status">没有找到匹配的项目</p>}</section>
        </div>
      </section>
    </main>
  )
}
