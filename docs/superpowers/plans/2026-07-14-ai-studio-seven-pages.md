# AI Studio OS 七页面统一还原实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 React + Tauri 应用中按 Figma 1:1 实现七个可切换、字体统一、响应式且可打包的桌面页面。

**架构：** 把当前单文件页面拆成共享窗口框架、共享侧栏和七个页面工作区。视觉基础统一由令牌控制，页面 CSS 只维护节点特有布局；桌面按 1440 × 1024 几何实现，较窄窗口切换紧凑侧栏和可滚动/重排布局。

**技术栈：** React 19、TypeScript 5.9、CSS Grid/Flex、Vitest、Testing Library、Tauri 2。

---

## 文件结构

- 创建 `src/app/navigation.ts`：页面键、Figma 节点、导航文案和共享资源映射。
- 创建 `src/components/shell/WindowChrome.tsx`：Tauri 窗口拖动与三按钮控制。
- 创建 `src/components/shell/AppSidebar.tsx`：统一品牌、导航和账户卡片。
- 创建 `src/components/shell/AppShell.tsx`：组合窗口、侧栏和当前页面。
- 创建 `src/pages/*.tsx`：七个独立页面工作区。
- 创建 `src/styles/shell.css` 与 `src/styles/pages/*.css`：共享框架和页面布局。
- 修改 `src/styles/tokens.css`：统一颜色、字体、圆角、间距和布局令牌。
- 修改 `src/App.tsx`：只保留页面状态与路由组合。
- 修改 `src/App.test.tsx`：覆盖七页面导航、节点映射、共享窗口控制与关键交互。
- 创建 `src/styles/typography.test.ts`：防止相同语义字号再次分裂。
- 新增 `public/figma/{video,music,membership,projects}/`：保存 Figma 原始可见资产。

### 任务 1：建立七页面导航契约

**文件：**
- 创建：`src/app/navigation.ts`
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：编写失败测试**

在 `src/App.test.tsx` 增加参数化测试：

```tsx
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
```

- [ ] **步骤 2：运行测试并确认失败**

运行：`npm test -- src/App.test.tsx`

预期：视频、音乐、会员、项目缺少对应工作区而失败。

- [ ] **步骤 3：实现导航数据类型**

```ts
export type AppPage = 'dashboard' | 'chat' | 'image' | 'video' | 'music' | 'membership' | 'projects'

export const navigationItems = [
  { page: 'dashboard', label: '创作工作台', nodeId: '26:773', icon: 'nav-workspace.svg' },
  { page: 'chat', label: 'AI 对话', nodeId: '27:2094', icon: 'nav-chat.svg' },
  { page: 'image', label: 'AI 图片', nodeId: '29:2557', icon: 'nav-image.svg' },
  { page: 'video', label: 'AI 视频', nodeId: '30:3867', icon: 'nav-video.svg' },
  { page: 'music', label: 'AI 音乐', nodeId: '32:4671', icon: 'nav-music.svg' },
  { page: 'membership', label: '会员', nodeId: '34:6875', icon: 'nav-membership.svg' },
  { page: 'projects', label: '项目', nodeId: '35:7974', icon: 'nav-projects.svg' },
] as const satisfies readonly { page: AppPage; label: string; nodeId: string; icon: string }[]
```

- [ ] **步骤 4：运行定向测试**

运行：`npm test -- src/App.test.tsx`

预期：导航契约测试进入页面实现缺失阶段，类型定义通过。

### 任务 2：统一窗口、侧栏和字体令牌

**文件：**
- 创建：`src/components/shell/WindowChrome.tsx`
- 创建：`src/components/shell/AppSidebar.tsx`
- 创建：`src/components/shell/AppShell.tsx`
- 创建：`src/styles/shell.css`
- 创建：`src/styles/typography.test.ts`
- 修改：`src/styles/tokens.css`
- 修改：`src/App.tsx`

- [ ] **步骤 1：编写共享框架失败测试**

```tsx
it('keeps one sidebar and one set of window controls on every page', () => {
  render(<App />)
  for (const label of ['创作工作台', 'AI 对话', 'AI 图片', 'AI 视频', 'AI 音乐', '会员', '项目']) {
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.getAllByRole('navigation', { name: '主导航' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(1)
  }
})
```

并在 `src/styles/typography.test.ts` 断言品牌、导航、页面标题、区块标题、正文、辅助文字六组令牌存在。

- [ ] **步骤 2：运行测试并确认失败**

运行：`npm test -- src/App.test.tsx src/styles/typography.test.ts`

预期：共享侧栏或字体令牌断言失败。

- [ ] **步骤 3：实现共享框架**

`AppShell` 接口固定为：

```tsx
type AppShellProps = {
  page: AppPage
  onNavigate: (page: AppPage) => void
  children: ReactNode
}
```

`AppSidebar` 使用 `navigationItems` 渲染所有入口，品牌、账户卡片和图标来源保持唯一；`WindowChrome` 复用现有 Tauri 命令逻辑。

- [ ] **步骤 4：实现字体与布局令牌**

```css
:root {
  --font-ui: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  --type-brand: 600 17px/24px var(--font-ui);
  --type-nav: 500 14px/20px var(--font-ui);
  --type-page-title: 600 20px/28px var(--font-ui);
  --type-section-title: 600 16px/24px var(--font-ui);
  --type-body: 400 14px/22px var(--font-ui);
  --type-caption: 400 12px/18px var(--font-ui);
  --sidebar-width: 240px;
  --sidebar-compact-width: 72px;
  --window-radius: 14px;
}
```

- [ ] **步骤 5：运行测试**

运行：`npm test -- src/App.test.tsx src/styles/typography.test.ts`

预期：共享框架、单一窗口控制和字体令牌测试通过。

### 任务 3：迁移创作工作台、AI 对话、AI 图片

**文件：**
- 创建：`src/pages/DashboardPage.tsx`
- 创建：`src/pages/ChatPage.tsx`
- 创建：`src/pages/ImagePage.tsx`
- 创建：`src/styles/pages/dashboard.css`
- 创建：`src/styles/pages/chat.css`
- 创建：`src/styles/pages/image.css`
- 修改：`src/App.tsx`
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：增加三页回归测试**

验证每页的根节点、主标题、关键 Figma 图片路径和主要按钮，聊天输入和图片选项点击后必须显示活动状态。

- [ ] **步骤 2：运行测试并确认失败**

运行：`npm test -- src/App.test.tsx`

预期：拆分前的页面组件或新测试标记缺失。

- [ ] **步骤 3：迁移组件并删除重复侧栏**

每个页面根节点统一：

```tsx
<main className="page-workspace dashboard-page" data-testid="page-workspace" data-node-id="26:773">
  {/* 仅 Figma 主内容与右侧内容 */}
</main>
```

聊天和图片页使用同一结构，仅替换节点 ID 与页面级内容；不再渲染自己的品牌、账户卡片或窗口控制。

- [ ] **步骤 4：迁移页面 CSS 并应用语义字体**

把 `app.css` 中三页规则移入独立文件，同语义文本全部使用任务 2 的字体令牌。

- [ ] **步骤 5：运行测试与类型检查**

运行：`npm test -- src/App.test.tsx && npm run typecheck`

预期：三页回归测试和类型检查通过。

### 任务 4：实现 AI 视频页面 `30:3867`

**文件：**
- 创建：`src/pages/VideoPage.tsx`
- 创建：`src/styles/pages/video.css`
- 创建：`public/figma/video/*`
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：下载并登记 Figma 视频资源**

保存香水视频主画面、参考图、历史缩略图和 Figma 图标到 `public/figma/video/`，禁止用字符或 CSS 图形代替。

- [ ] **步骤 2：编写失败测试**

```tsx
it('supports the Figma video creation controls', () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'AI 视频' }))
  expect(screen.getByRole('heading', { name: 'AI 视频' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '图生视频' }))
  fireEvent.click(screen.getByRole('button', { name: '创建视频' }))
  expect(screen.getByText('生成完成')).toBeInTheDocument()
})
```

- [ ] **步骤 3：运行测试并确认失败**

运行：`npm test -- src/App.test.tsx -t "video"`

预期：视频页面不存在而失败。

- [ ] **步骤 4：实现页面与响应式布局**

实现 320px 左控件、408px 中央预览、360px 右记录的 Figma 比例；窄屏时右记录保持可滚动，中央预览不做整体缩放。

- [ ] **步骤 5：运行定向测试**

运行：`npm test -- src/App.test.tsx -t "video"`

预期：通过。

### 任务 5：实现 AI 音乐页面 `32:4671`

**文件：**
- 创建：`src/pages/MusicPage.tsx`
- 创建：`src/styles/pages/music.css`
- 创建：`public/figma/music/*`
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：下载并登记 Figma 音乐资源**

保存玫瑰封面、渐变封面、抽象封面、花卉与硬件图等曲目缩略图，以及播放器图标。

- [ ] **步骤 2：编写失败测试**

测试情绪标签、节奏、人声、时长可以切换，点击“生成音乐”后当前曲目保持“春日微光”并出现完成反馈。

- [ ] **步骤 3：运行测试并确认失败**

运行：`npm test -- src/App.test.tsx -t "music"`

预期：音乐页面不存在而失败。

- [ ] **步骤 4：实现页面与可见交互**

按 Figma 实现左侧生成器、中央播放器和音轨分层、右侧曲目列表；波形必须使用 Figma 资源或图标库资产，不能手绘内联 SVG。

- [ ] **步骤 5：运行定向测试**

运行：`npm test -- src/App.test.tsx -t "music"`

预期：通过。

### 任务 6：实现会员中心 `34:6875`

**文件：**
- 创建：`src/pages/MembershipPage.tsx`
- 创建：`src/styles/pages/membership.css`
- 创建：`public/figma/membership/*`
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：编写失败测试**

验证专业版、基础版、团队版三张方案卡，权益说明、消费记录、立即升级和充值积分按钮都存在；切换方案后 `aria-pressed` 更新。

- [ ] **步骤 2：运行测试并确认失败**

运行：`npm test -- src/App.test.tsx -t "membership"`

预期：会员页面不存在而失败。

- [ ] **步骤 3：实现页面**

按 Figma 的三列方案卡、右侧权益说明与底部消费表格实现；专业版默认选中，升级与充值显示短暂反馈文案。

- [ ] **步骤 4：运行定向测试**

运行：`npm test -- src/App.test.tsx -t "membership"`

预期：通过。

### 任务 7：实现项目管理 `35:7974`

**文件：**
- 创建：`src/pages/ProjectsPage.tsx`
- 创建：`src/styles/pages/projects.css`
- 创建：`public/figma/projects/*`
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：下载项目封面与头像资源**

保存八张项目封面、成员头像与状态图标，图片裁切使用 `object-fit: cover` 对齐 Figma。

- [ ] **步骤 2：编写失败测试**

测试所有项目/我创建的/与我共享标签、搜索、最近编辑排序、网格/列表切换和新建项目按钮。

- [ ] **步骤 3：运行测试并确认失败**

运行：`npm test -- src/App.test.tsx -t "projects"`

预期：项目页面不存在而失败。

- [ ] **步骤 4：实现项目页**

按 4 列卡片网格实现 8 个项目；搜索与标签实时过滤，视图切换改变 `data-view` 与布局，新建项目在顶部插入可见项目卡。

- [ ] **步骤 5：运行定向测试**

运行：`npm test -- src/App.test.tsx -t "projects"`

预期：通过。

### 任务 8：响应式、窗口边缘与完整视觉 QA

**文件：**
- 修改：`src/styles/shell.css`
- 修改：`src/styles/pages/*.css`
- 修改：`src/App.test.tsx`
- 创建：`artifacts/qa/design-qa.md`

- [ ] **步骤 1：增加响应式回归断言**

断言根页面没有固定 `min-width: 1440px`、没有整页 `transform: scale()`；窗口内容保留 `clip-path: inset(0 round 14px)` 和深色背景。

- [ ] **步骤 2：运行回归测试**

运行：`npm test`

预期：全部通过。

- [ ] **步骤 3：生成同尺寸实现截图**

在 1440 × 1024 下逐页截图，并在 `artifacts/qa/design-qa.md` 中逐项记录对应 Figma 原图、实现截图和差异修复结果。

- [ ] **步骤 4：同屏比较并迭代**

每一页把 `artifacts/figma/source-*.png` 与实现截图放进同一比较输入，逐轮修复字体、间距、图片裁切、边框、圆角和滚动差异，直到没有显著视觉偏差。

- [ ] **步骤 5：验证三种窗口尺寸**

验证 1024 × 720、1280 × 800、1440 × 1024：无白色空白区域、无白色圆角底色、内容不会因整页缩放消失。

### 任务 9：完整构建与桌面打包

**文件：**
- 修改：`src-tauri/tauri.conf.json`（仅当 QA 发现窗口参数仍不一致）

- [ ] **步骤 1：运行完整测试**

运行：`npm test`

预期：所有测试通过。

- [ ] **步骤 2：运行类型检查**

运行：`npm run typecheck`

预期：退出码 0。

- [ ] **步骤 3：构建前端**

运行：`npm run build`

预期：Vite 构建成功并生成 `dist/`。

- [ ] **步骤 4：打包 Windows 安装程序**

运行：`npm run tauri:build`

预期：生成新的 NSIS 安装包和桌面可执行文件。

- [ ] **步骤 5：记录最终证据**

在交付消息中列出测试数量、构建结果、安装包绝对路径、七张实现截图目录和仍存在的非阻塞差异；当前目录没有 Git 仓库，因此不执行 commit 步骤。
