# AI Studio OS 自适应三栏窗口实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 移除固定 Figma 画布的整体缩放与裁切，使首页在 `1440 × 1024` 保持节点 `26:773` 的 1:1 基准，并在 `1024 × 720` 以上采用真实三栏响应式布局和独立滚动。

**架构：** 用无变换的 `ResponsiveShell` 取代 `DesignViewport`，让窗口内容直接填满可用空间。首页根节点使用 CSS Grid 管理侧栏、中心工作区和任务中心；默认尺寸保留 Figma 测量值，紧凑断点折叠左栏、重排中心卡片，并让中心区和任务区独立纵向滚动。窗口圆角只由最外层内容容器负责。

**技术栈：** React 19、TypeScript、CSS Grid/Flex、Vitest、Testing Library、Vite、Tauri 2

---

## 文件结构

- 创建 `src/components/ResponsiveShell.tsx`：仅负责让业务页面填满窗口内容区，不测量尺寸、不变换坐标。
- 创建 `src/components/ResponsiveShell.test.tsx`：验证响应式外壳没有固定画布和内联缩放。
- 修改 `src/App.tsx`：接入 `ResponsiveShell`，为紧凑侧栏提供可隐藏的标签和原生提示，并标记两个独立滚动区域。
- 修改 `src/App.test.tsx`：把固定画布断言替换为响应式三栏、独立滚动和单层圆角断言。
- 修改 `src/styles/app.css`：删除根级固定画布/绝对坐标覆盖，建立默认与紧凑断点布局，统一透明窗口背景和裁切。
- 修改 `src/tauri-window-config.test.ts`：继续锁定最小尺寸、透明窗口和关闭阴影，防止 Windows 白色边框回归。
- 删除 `src/components/DesignViewport.tsx`：移除 `ResizeObserver`、`scale` 与 `translate` 逻辑。
- 删除 `src/components/DesignViewport.test.tsx`：由新的响应式外壳测试取代。
- 删除 `src/windowLayout.ts`：不再计算固定 Figma 画布缩放比例。
- 删除 `src/windowLayout.test.ts`：不再认可覆盖式缩放和裁切行为。
- 修改 `design-qa.md`：记录同视口 Figma 对比、紧凑窗口检查和最终 QA 结果。
- 生成 `artifacts/windows/AI-Studio-OS-0.1.0-x64-portable.exe` 与 `artifacts/windows/AI-Studio-OS-0.1.0-x64-setup.exe`：覆盖旧的错误构建。

> 当前工作区没有 `.git` 目录，因此本计划无法执行 commit 步骤。每个任务仍保持独立验证，并在计划复选框中记录进度。

### 任务 1：用失败测试锁定“无整体缩放”的窗口外壳

**文件：**
- 创建：`src/components/ResponsiveShell.test.tsx`
- 修改：`src/App.test.tsx`
- 参考：`src/components/DesignViewport.tsx`
- 参考：`src/windowLayout.ts`

- [ ] **步骤 1：创建响应式外壳失败测试**

```tsx
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ResponsiveShell } from './ResponsiveShell'

describe('ResponsiveShell', () => {
  afterEach(cleanup)

  it('fills the window without a fixed Figma canvas transform', () => {
    const { container } = render(<ResponsiveShell><div>content</div></ResponsiveShell>)
    const shell = container.querySelector('.responsive-shell')

    expect(shell).toBeInTheDocument()
    expect(shell).not.toHaveAttribute('style')
    expect(container.querySelector('.design-canvas')).not.toBeInTheDocument()
  })
})
```

- [ ] **步骤 2：将 `src/App.test.tsx` 的固定画布测试替换为响应式结构测试**

```tsx
it('uses a responsive three-column dashboard instead of a fixed transformed canvas', () => {
  render(<App />)

  expect(document.querySelector('.responsive-shell')).toBeInTheDocument()
  expect(document.querySelector('.design-canvas')).not.toBeInTheDocument()
  expect(screen.getByTestId('dashboard-scroll-region')).toHaveClass('figma-main')
  expect(screen.getByTestId('task-scroll-region')).toHaveClass('figma-tasks')
})
```

- [ ] **步骤 3：运行目标测试并确认因组件和标记尚不存在而失败**

运行：

```powershell
npm test -- src/components/ResponsiveShell.test.tsx src/App.test.tsx
```

预期：FAIL；`ResponsiveShell` 模块不存在，且现有页面仍渲染 `.design-canvas`。

### 任务 2：实现无变换外壳并删除覆盖式缩放算法

**文件：**
- 创建：`src/components/ResponsiveShell.tsx`
- 修改：`src/App.tsx`
- 删除：`src/components/DesignViewport.tsx`
- 删除：`src/components/DesignViewport.test.tsx`
- 删除：`src/windowLayout.ts`
- 删除：`src/windowLayout.test.ts`
- 测试：`src/components/ResponsiveShell.test.tsx`

- [ ] **步骤 1：实现最小的 `ResponsiveShell`**

```tsx
import type { ReactNode } from 'react'

export function ResponsiveShell({ children }: { children: ReactNode }) {
  return <div className="responsive-shell">{children}</div>
}
```

- [ ] **步骤 2：在 `src/App.tsx` 中替换窗口内容包装器**

```tsx
import { ResponsiveShell } from './components/ResponsiveShell'

// WindowChrome 返回值内部：
<div className="window-content"><ResponsiveShell>{children}</ResponsiveShell></div>
```

- [ ] **步骤 3：删除旧固定画布文件**

删除：

```text
src/components/DesignViewport.tsx
src/components/DesignViewport.test.tsx
src/windowLayout.ts
src/windowLayout.test.ts
```

- [ ] **步骤 4：运行外壳测试并确认通过**

运行：

```powershell
npm test -- src/components/ResponsiveShell.test.tsx
```

预期：PASS，1 个测试通过。

### 任务 3：用失败测试锁定三栏断点、侧栏折叠和独立滚动

**文件：**
- 修改：`src/App.test.tsx`
- 修改：`src/App.tsx`
- 修改：`src/styles/app.css`

- [ ] **步骤 1：添加响应式 CSS 源码断言**

```tsx
it('defines the approved desktop and compact dashboard columns', () => {
  expect(appStyles).toMatch(/\.figma-app\s*\{[^}]*grid-template-columns:\s*240px minmax\(0, 1fr\) 340px/)
  expect(appStyles).toMatch(/@media\s*\(max-width:\s*1279px\)[\s\S]*?\.figma-app\s*\{[^}]*grid-template-columns:\s*72px minmax\(0, 1fr\) 280px/)
  expect(appStyles).toMatch(/@media\s*\(max-width:\s*1100px\)[\s\S]*?\.quick-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  expect(appStyles).toMatch(/@media\s*\(max-width:\s*1100px\)[\s\S]*?\.dashboard-grid\s*\{[^}]*grid-template-columns:\s*1fr/)
})

it('keeps the center and task regions independently scrollable', () => {
  expect(appStyles).toMatch(/\.figma-main\s*\{[^}]*overflow-y:\s*auto/)
  expect(appStyles).toMatch(/\.figma-tasks\s*\{[^}]*overflow-y:\s*auto/)
})

it('removes root-level fixed canvas dimensions and transforms', () => {
  expect(appStyles).not.toMatch(/\.figma-app\s*\{[^}]*min-width:\s*1440px/)
  expect(appStyles).not.toContain('transform-origin: top left')
  expect(appStyles).not.toMatch(/\.figma-main\s*\{[^}]*left:\s*240px/)
  expect(appStyles).not.toMatch(/\.figma-tasks\s*\{[^}]*left:\s*1100px/)
})
```

- [ ] **步骤 2：添加侧栏紧凑模式可访问性断言**

```tsx
it('keeps compact navigation labels available as accessible tooltips', () => {
  render(<App />)
  const navigation = within(screen.getByRole('navigation', { name: '主导航' }))
  expect(navigation.getByRole('button', { name: 'AI 对话' })).toHaveAttribute('title', 'AI 对话')
  expect(navigation.getByRole('button', { name: 'AI 图片' })).toHaveAttribute('title', 'AI 图片')
})
```

- [ ] **步骤 3：运行目标测试并确认响应式要求尚未满足**

运行：

```powershell
npm test -- src/App.test.tsx
```

预期：FAIL；旧 CSS 仍含固定 `1440px`、绝对列坐标和缺失的紧凑断点。

- [ ] **步骤 4：为首页滚动区和导航提示添加最小标记**

```tsx
<button title={label} className="figma-nav-item" type="button">
  <img src={`/figma/dashboard/${icon}`} alt="" />
  <span className="figma-nav-label">{label}</span>
</button>

<section className="figma-main" data-testid="dashboard-scroll-region">
  {/* 现有内容不变 */}
</section>

<aside className="figma-tasks" data-testid="task-scroll-region" aria-label="任务中心">
  {/* 现有内容不变 */}
</aside>
```

- [ ] **步骤 5：将首页根布局改为真实 Grid**

在 `src/styles/app.css` 中使用以下核心规则，并删除文件末尾把三栏改回绝对定位的覆盖块：

```css
.responsive-shell {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #0a0a0b;
}

.figma-app {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 340px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #0a0a0a;
}

.figma-sidebar {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.figma-main {
  width: auto;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 40px;
  overflow-x: hidden;
  overflow-y: auto;
}

.figma-tasks {
  width: auto;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 24px;
  overflow-x: hidden;
  overflow-y: auto;
}
```

- [ ] **步骤 6：让默认尺寸内部布局保持 Figma 测量值但可收缩**

```css
.figma-hero,
.prompt-card,
.quick-actions,
.dashboard-grid {
  width: 100%;
}

.quick-actions {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 444.661fr) minmax(0, 310.759fr);
  gap: 24px;
}

.recent-panel,
.project-panel,
.task,
.task > div,
.task-progress,
.credits-card {
  width: 100%;
}
```

- [ ] **步骤 7：添加紧凑断点**

```css
@media (max-width: 1279px) {
  .figma-app { grid-template-columns: 72px minmax(0, 1fr) 280px; }
  .figma-sidebar { width: 72px; }
  .figma-brand { width: 72px; justify-content: center; padding: 0; }
  .figma-brand > strong, .figma-nav-label { display: none; }
  .figma-nav { width: 72px; padding-inline: 12px; }
  .figma-nav-item { width: 48px; padding: 0; justify-content: center; gap: 0; }
  .account-card { right: 12px; bottom: 16px; left: 12px; width: 48px; height: 48px; padding: 8px; }
  .account-top { width: 32px; height: 32px; }
  .account-top span, .account-chevron, .account-score, .account-progress, .account-footer { display: none; }
  .figma-tasks { padding-inline: 20px; }
}

@media (max-width: 1100px) {
  .figma-main { padding-inline: 32px; }
  .quick-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-grid { grid-template-columns: 1fr; }
}
```

- [ ] **步骤 8：运行目标测试并确认通过**

运行：

```powershell
npm test -- src/App.test.tsx src/components/ResponsiveShell.test.tsx
```

预期：PASS；响应式外壳、断点、导航提示和滚动区断言全部通过。

### 任务 4：修复窗口背景、单层圆角和 Windows 白边回归

**文件：**
- 修改：`src/App.test.tsx`
- 修改：`src/styles/app.css`
- 修改：`src/tauri-window-config.test.ts`
- 检查：`src-tauri/tauri.conf.json`

- [ ] **步骤 1：添加窗口边缘失败测试**

```tsx
it('uses one clipped dark surface for the rounded window', () => {
  expect(appStyles).toMatch(/html, body, #root\s*\{[^}]*background:\s*transparent/)
  expect(appStyles).toMatch(/\.window-frame\s*\{[^}]*background:\s*transparent/)
  expect(appStyles).toMatch(/\.window-content\s*\{[^}]*border-radius:\s*14px[^}]*background:\s*#0a0a0b[^}]*overflow:\s*hidden/)
  expect(appStyles).toContain('.window-frame.is-maximized .window-content')
  expect(appStyles).toMatch(/\.window-frame\.is-maximized \.window-content\s*\{[^}]*border-radius:\s*0/)
})
```

在 `src/tauri-window-config.test.ts` 中保留并强化：

```tsx
expect(config.app.windows[0]).toMatchObject({
  decorations: false,
  transparent: true,
  shadow: false,
})
```

- [ ] **步骤 2：运行窗口边缘测试并确认属性顺序或缺失规则导致失败**

运行：

```powershell
npm test -- src/App.test.tsx src/tauri-window-config.test.ts
```

预期：FAIL；`window-content` 尚未以同一规则明确同时承担深色背景、圆角和裁切。

- [ ] **步骤 3：实现单层圆角和透明外层**

```css
html, body, #root {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: transparent;
}

.window-frame {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

.window-content {
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 14px;
  background: #0a0a0b;
  box-shadow: none;
}

.figma-app,
.chat-app,
.image-app {
  border-radius: 0;
  box-shadow: none;
}

.window-frame.is-maximized .window-content {
  border-radius: 0;
}
```

- [ ] **步骤 4：运行窗口边缘测试并确认通过**

运行：

```powershell
npm test -- src/App.test.tsx src/tauri-window-config.test.ts
```

预期：PASS；透明外层、单个深色裁切面和 `shadow: false` 均被锁定。

### 任务 5：全量验证、视觉 QA 与 Windows 重新打包

**文件：**
- 修改：`design-qa.md`
- 生成：`artifacts/dashboard-1440x1024.png`
- 生成：`artifacts/dashboard-1280x800.png`
- 生成：`artifacts/dashboard-1180x720.png`
- 生成：`artifacts/dashboard-1024x720.png`
- 生成：`artifacts/windows/AI-Studio-OS-0.1.0-x64-portable.exe`
- 生成：`artifacts/windows/AI-Studio-OS-0.1.0-x64-setup.exe`

- [ ] **步骤 1：运行全量自动化验证**

运行：

```powershell
npm test
npm run typecheck
npm run build
```

预期：所有 Vitest 测试通过，TypeScript 退出码为 `0`，Vite 生产构建退出码为 `0`。

- [ ] **步骤 2：启动本地开发服务器并在所选浏览器检查页面**

运行：

```powershell
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

在 `1440 × 1024`、`1280 × 800`、`1180 × 720`、`1024 × 720` 检查：

```text
1. 1440 × 1024 三栏边界为 240 / 860 / 340。
2. 1024–1279 左侧栏折叠为 72px，任务中心保持 280px。
3. 中心区和任务中心可分别滚动，页面没有整体 scale 或 translate。
4. 没有横向裁切、缩放空白或突然消失的卡片。
5. 非最大化四角无白底，最大化无圆角缝隙。
6. 最小化、最大化/还原和关闭按钮始终可见。
```

- [ ] **步骤 3：执行 Figma 同视口设计 QA**

将 `artifacts/figma-26-773-reference-responsive.png` 与 `artifacts/dashboard-1440x1024.png` 并排比较，并在 `design-qa.md` 记录：

```markdown
# Design QA

- source: Figma `26:773`, 1440 × 1024
- implementation: dashboard, 1440 × 1024
- responsive checks: 1280 × 800, 1180 × 720, 1024 × 720
- P0/P1/P2 findings: none
- P3 follow-ups: 仅记录不阻断的字体抗锯齿差异
- final result: passed
```

若无法取得任一同尺寸截图，写入 `final result: blocked`，不得宣称视觉验收完成。

- [ ] **步骤 4：构建 Tauri Windows 安装包**

运行：

```powershell
npm run tauri:build
```

预期：退出码为 `0`，生成 NSIS 安装程序和 release 可执行文件。

- [ ] **步骤 5：更新交付文件**

从以下构建结果复制：

```text
src-tauri/target/release/ai-studio.exe
src-tauri/target/release/bundle/nsis/AI Studio OS_0.1.0_x64-setup.exe
```

覆盖：

```text
artifacts/windows/AI-Studio-OS-0.1.0-x64-portable.exe
artifacts/windows/AI-Studio-OS-0.1.0-x64-setup.exe
```

- [ ] **步骤 6：启动便携版进行桌面端复验**

运行：

```powershell
Start-Process -WindowStyle Hidden 'artifacts\windows\AI-Studio-OS-0.1.0-x64-portable.exe'
```

检查原生最小尺寸、拖动缩放、最大化/还原、圆角和三个窗口按钮；完成后正常关闭应用。

- [ ] **步骤 7：重新运行最终验证命令**

运行：

```powershell
npm test
npm run typecheck
npm run build
```

预期：全部退出码为 `0`，`design-qa.md` 包含 `final result: passed`，两个 Windows 交付文件存在且修改时间晚于本次实施开始时间。

