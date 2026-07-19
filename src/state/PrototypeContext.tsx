import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Tone = 'lilac' | 'coral' | 'cyan' | 'gold'

export type ProjectAsset = {
  name: string
  category: string
  tone: Tone
}

export type RecentWork = {
  title: string
  detail: string
  tone: Exclude<Tone, 'gold'>
}

type PrototypeState = {
  assets: ProjectAsset[]
  recentWorks: RecentWork[]
}

type PrototypeContextValue = PrototypeState & {
  saveGeneratedImage: (prompt: string) => void
}

const storageKey = 'ai-studio-prototype-state'

const initialState: PrototypeState = {
  assets: [
    { name: '产品主视觉', category: '产品素材', tone: 'lilac' },
    { name: '春季色彩灵感', category: '灵感参考', tone: 'coral' },
    { name: '包装结构草图', category: '产品素材', tone: 'cyan' },
    { name: '品牌材质参考', category: '灵感参考', tone: 'gold' },
  ],
  recentWorks: [
    { title: '春日流光 KV', detail: '今天 10:42 · 图像生成', tone: 'lilac' },
    { title: '新品预热短片', detail: '昨天 16:18 · 视频草案', tone: 'coral' },
    { title: '包装延展提案', detail: '周五 11:06 · 版式探索', tone: 'cyan' },
  ],
}

const PrototypeContext = createContext<PrototypeContextValue | null>(null)

function loadState(): PrototypeState {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return initialState
    const parsed = JSON.parse(stored) as PrototypeState
    if (!Array.isArray(parsed.assets) || !Array.isArray(parsed.recentWorks)) return initialState
    return parsed
  } catch {
    return initialState
  }
}

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PrototypeState>(loadState)

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state])

  const value = useMemo<PrototypeContextValue>(() => ({
    ...state,
    saveGeneratedImage(prompt) {
      const title = prompt.trim()
      setState((current) => ({
        assets: [{ name: title, category: '产品素材', tone: 'lilac' }, ...current.assets],
        recentWorks: [{ title, detail: '刚刚 · 图像生成', tone: 'lilac' }, ...current.recentWorks],
      }))
    },
  }), [state])

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>
}

export function usePrototype() {
  const context = useContext(PrototypeContext)
  if (!context) throw new Error('usePrototype must be used within PrototypeProvider')
  return context
}
