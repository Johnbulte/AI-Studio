# AI Studio OS 桌面窗口一致性与缩放实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 统一所有功能页的窗口圆角和控制按钮，在保留 `1440 × 1024` Figma 坐标的同时让画布随窗口等比缩放，并限制 Windows 窗口最小尺寸为 `1024 × 720`。

**架构：** 将缩放数学放进无副作用的 `windowLayout` 模块，公共 `DesignViewport` 用 `ResizeObserver` 测量内容区并应用缩放和居中偏移。`WindowChrome` 始终渲染窗口控件并包裹 `DesignViewport`；各业务页面维持原有固定 Figma 画布，只移除互相冲突的顶层圆角和阴影。

**技术栈：** React 19、TypeScript、CSS、Vitest、Testing Library、Tauri 2。

---

## 文件结构

- 创建 `src/windowLayout.ts`：定义 Figma 画布尺寸与缩放、居中纯计算函数。
- 创建 `src/windowLayout.test.ts`：覆盖默认、按宽度缩放、按高度缩放和无效尺寸保护。
- 创建 `src/components/DesignViewport.tsx`：观察容器尺寸并承载固定 Figma 画布。
- 创建 `src/components/DesignViewport.test.tsx`：验证尺寸变化会更新画布变换。
- 修改 `src/App.tsx`：让 `WindowChrome` 始终显示控件并统一包裹设计画布。
- 修改 `src/App.test.tsx`：覆盖所有已可达页面的公共窗口控件与统一外框行为。
- 修改 `src/styles/app.css`：统一窗口圆角，新增缩放容器样式，移除页面顶层圆角冲突。
- 创建 `src/tauri-window-config.test.ts`：验证主窗口最小尺寸配置。
- 修改 `src-tauri/tauri.conf.json`：声明 `1024 × 720` 最小窗口尺寸。
- 修改 `src-tauri/src/lib.rs`：让 Rust 配置回归测试验证新的最小尺寸约束。
- 更新 `artifacts/windows/*.exe`：重新构建并整理最新安装版和便携版。

### 任务 1：实现可测试的 Figma 画布布局计算

**文件：**
- 创建：`src/windowLayout.ts`
- 创建：`src/windowLayout.test.ts`

- [x] **步骤 1：编写失败的布局计算测试**

```ts
import { describe, expect, it } from 'vitest'
import { calculateDesignViewportLayout } from './windowLayout'

describe('calculateDesignViewportLayout', () => {
  it('keeps the Figma canvas at 1:1 in the default window', () => {
    expect(calculateDesignViewportLayout(1440, 1024)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })

  it('scales by width and centers vertically in a narrow window', () => {
    expect(calculateDesignViewportLayout(1024, 800)).toEqual({
      scale: 1024 / 1440,
      offsetX: 0,
      offsetY: (800 - 1024 * (1024 / 1440)) / 2,
    })
  })

  it('scales by height and centers horizontally in a short window', () => {
    expect(calculateDesignViewportLayout(1200, 720)).toEqual({
      scale: 720 / 1024,
      offsetX: (1200 - 1440 * (720 / 1024)) / 2,
      offsetY: 0,
    })
  })

  it('returns a valid fallback before the container has a size', () => {
    expect(calculateDesignViewportLayout(0, 0)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
  })
})
```

- [x] **步骤 2：运行测试并确认因模块不存在而失败**

运行：`npm test -- src/windowLayout.test.ts`

预期：FAIL，提示无法解析 `./windowLayout`。

- [x] **步骤 3：编写最少布局计算实现**

```ts
export const DESIGN_WIDTH = 1440
export const DESIGN_HEIGHT = 1024

export type DesignViewportLayout = {
  scale: number
  offsetX: number
  offsetY: number
}

export function calculateDesignViewportLayout(width: number, height: number): DesignViewportLayout {
  if (width <= 0 || height <= 0) return { scale: 1, offsetX: 0, offsetY: 0 }

  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT)
  return {
    scale,
    offsetX: (width - DESIGN_WIDTH * scale) / 2,
    offsetY: (height - DESIGN_HEIGHT * scale) / 2,
  }
}
```

- [x] **步骤 4：运行测试并确认四个布局场景通过**

运行：`npm test -- src/windowLayout.test.ts`

预期：1 个测试文件、4 个测试全部 PASS。

### 任务 2：让公共设计画布观察并响应窗口尺寸

**文件：**
- 创建：`src/components/DesignViewport.tsx`
- 创建：`src/components/DesignViewport.test.tsx`
- 修改：`src/styles/app.css:13-30`

- [x] **步骤 1：编写失败的尺寸观察测试**

测试提供一个可控的 `ResizeObserver`，渲染 `DesignViewport` 后触发 `1024 × 720`，并断言 `.design-canvas` 的行内样式包含 `translate(5.75px, 0px) scale(0.703125)`。

```tsx
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesignViewport } from './DesignViewport'

describe('DesignViewport', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('updates the fixed Figma canvas when its container changes size', () => {
    let notify: ResizeObserverCallback = () => undefined
    class ResizeObserverStub {
      constructor(callback: ResizeObserverCallback) { notify = callback }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const { container } = render(<DesignViewport><div>content</div></DesignViewport>)

    act(() => notify([{ contentRect: { width: 1024, height: 720 } } as ResizeObserverEntry], {} as ResizeObserver))

    expect(container.querySelector('.design-canvas')).toHaveStyle({
      transform: 'translate(5.75px, 0px) scale(0.703125)',
    })
  })
})
```

- [x] **步骤 2：运行测试并确认因组件不存在而失败**

运行：`npm test -- src/components/DesignViewport.test.tsx`

预期：FAIL，提示无法解析 `./DesignViewport`。

- [x] **步骤 3：实现尺寸观察组件**

实现要点：

```tsx
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { calculateDesignViewportLayout, DESIGN_HEIGHT, DESIGN_WIDTH } from '../windowLayout'

export function DesignViewport({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState(() => calculateDesignViewportLayout(0, 0))

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const update = (width: number, height: number) => setLayout(calculateDesignViewportLayout(width, height))
    update(viewport.clientWidth, viewport.clientHeight)
    if (typeof ResizeObserver === 'undefined') {
      const handleWindowResize = () => update(viewport.clientWidth, viewport.clientHeight)
      window.addEventListener('resize', handleWindowResize)
      return () => window.removeEventListener('resize', handleWindowResize)
    }
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="design-viewport" ref={viewportRef}>
      <div
        className="design-canvas"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `translate(${layout.offsetX}px, ${layout.offsetY}px) scale(${layout.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
```

CSS 使用 `position: relative; width: 100%; height: 100%; overflow: hidden;`，画布使用 `position: absolute; top: 0; left: 0; transform-origin: top left;`。

- [x] **步骤 4：运行组件测试并确认通过**

运行：`npm test -- src/components/DesignViewport.test.tsx src/windowLayout.test.ts`

预期：两个测试文件全部 PASS。

### 任务 3：统一窗口外框、圆角和控制按钮

**文件：**
- 修改：`src/App.tsx:1-55,508-516`
- 修改：`src/App.test.tsx`
- 修改：`src/styles/app.css:13-30,72,158-171,513-527`

- [x] **步骤 1：编写失败的公共窗口外框测试**

在 `App.test.tsx` 中新增两个独立测试：默认工作台应显示“最小化”“最大化窗口”“关闭”；进入 AI 对话后同样只存在一组窗口控制按钮。另断言源码渲染的 `.window-frame` 不含 `design-only`。

```tsx
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
```

- [x] **步骤 2：运行测试并确认工作台控件因隐藏样式而失败**

运行：`npm test -- src/App.test.tsx`

预期：新增测试 FAIL，因为工作台窗口外框带有 `design-only`。

- [x] **步骤 3：最小修改公共窗口结构**

- 删除 `WindowChrome` 的 `hideControls` 属性与 `design-only` class 分支。
- 导入并用 `DesignViewport` 包裹 `children`。
- `App` 始终返回 `<WindowChrome>{content}</WindowChrome>`。
- 将窗口边框改为不占布局空间的内阴影，使默认 `1440 × 1024` 窗口仍提供完整 `1440 × 1024` 设计画布。
- `.figma-app`、`.chat-app`、`.image-app` 的顶层 `border-radius` 和外部 `box-shadow` 统一移除，由 `.window-content` 负责裁切和圆角。
- 最大化时 `.window-content` 圆角与窗口阴影归零。

- [x] **步骤 4：运行应用测试并确认全部通过**

运行：`npm test -- src/App.test.tsx`

预期：原有 5 个测试和新增窗口控件测试全部 PASS。

### 任务 4：限制 Tauri 主窗口最小尺寸

**文件：**
- 创建：`src/tauri-window-config.test.ts`
- 修改：`src-tauri/tauri.conf.json:13-25`
- 修改：`src-tauri/src/lib.rs:8-22`

- [x] **步骤 1：编写失败的配置测试**

```ts
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
    })
  })
})
```

- [x] **步骤 2：运行测试并确认缺少最小尺寸时失败**

运行：`npm test -- src/tauri-window-config.test.ts`

预期：FAIL，收到的窗口配置没有 `minWidth` 和 `minHeight`。

- [x] **步骤 3：添加 Tauri 最小尺寸**

在主窗口对象中加入：

```json
"minWidth": 1024,
"minHeight": 720
```

- [x] **步骤 4：运行配置测试并确认通过**

运行：`npm test -- src/tauri-window-config.test.ts`

预期：1 个测试 PASS。

### 任务 5：完整验证并重新生成 Windows 程序

**文件：**
- 更新：`artifacts/windows/AI-Studio-OS-0.1.0-x64-portable.exe`
- 更新：`artifacts/windows/AI-Studio-OS-0.1.0-x64-setup.exe`

- [x] **步骤 1：运行完整自动化验证**

运行：`npm test && npm run typecheck && npm run build`

预期：所有测试、TypeScript 检查和 Vite 生产构建均以退出码 0 完成。

- [x] **步骤 2：运行桌面开发版进行交互验收**

启动 `npm run tauri:dev`，在 `1440 × 1024`、`1024 × 720` 和最大化状态下检查工作台、AI 对话与 AI 图片画布的缩放、居中、圆角和窗口按钮。验收结束后关闭开发进程。

- [x] **步骤 3：构建 NSIS 安装包**

运行：`npm run tauri:build`

预期：生成 `src-tauri/target/release/app.exe` 和 `src-tauri/target/release/bundle/nsis/AI Studio OS_0.1.0_x64-setup.exe`。

- [x] **步骤 4：整理交付文件并验证便携版启动**

将 Release 可执行文件和 NSIS 安装包复制到 `artifacts/windows`，启动便携版并确认进程保持运行，再关闭测试进程。记录两个文件的大小和 SHA-256。
