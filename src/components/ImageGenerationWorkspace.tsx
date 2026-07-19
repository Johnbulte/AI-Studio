import { useState } from 'react'
import { usePrototype } from '../state/PrototypeContext'

type ImageGenerationWorkspaceProps = {
  onBack: () => void
}

export function ImageGenerationWorkspace({ onBack }: ImageGenerationWorkspaceProps) {
  const { saveGeneratedImage } = usePrototype()
  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'saved'>('idle')

  const startGeneration = () => {
    if (!prompt.trim()) return
    setStatus('generating')
    window.setTimeout(() => setStatus('completed'), 800)
  }

  const saveResult = () => {
    saveGeneratedImage(prompt)
    setStatus('saved')
  }

  return <main className="generation-workspace" data-testid="generation-workspace">
    <header className="generation-header">
      <div><p className="eyebrow">AI 创作 / 图像生成</p><h1>AI 图像创作</h1></div>
      <button className="text-button" onClick={onBack} type="button">返回工作台</button>
    </header>
    <section className="generation-grid" aria-label="图像生成工作区">
      <section className="generation-stage" aria-labelledby="generation-preview-title">
        <p className="eyebrow">生成预览</p>
        <h2 id="generation-preview-title">{status === 'idle' ? '从一个创意开始' : status === 'generating' ? '正在构建视觉草案' : '极光玻璃质感视觉'}</h2>
        <div className={`generation-artwork ${status}`} role="img" aria-label="生成结果预览"><span /></div>
        <p role="status" className="generation-status">
          {status === 'generating' ? '正在生成图片' : status === 'completed' ? '图片生成完成' : status === 'saved' ? '已保存到项目素材' : '填写提示词后开始生成'}
        </p>
        {status === 'completed' && <button className="action-button save-result" onClick={saveResult} type="button">保存到项目</button>}
      </section>
      <aside className="generation-controls" aria-label="图像生成参数">
        <label htmlFor="prompt">创作提示词</label>
        <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="描述你想生成的画面…" rows={6} />
        <label htmlFor="style">视觉风格</label>
        <select id="style" defaultValue="科技流光"><option>科技流光</option><option>极简产品</option><option>电影质感</option></select>
        <label htmlFor="ratio">画布比例</label>
        <select id="ratio" defaultValue="16:9"><option>16:9</option><option>1:1</option><option>9:16</option></select>
        <button className="action-button" disabled={!prompt.trim() || status === 'generating'} onClick={startGeneration} type="button">{status === 'generating' ? '生成中…' : '开始生成'}</button>
      </aside>
    </section>
  </main>
}
