# AI Studio OS 对话页 1:1 还原实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Figma 节点 `27:2094` 还原为默认打开的 1440×1024 React/Tauri AI 对话页面，并使用设计稿导出的全部可见图标、头像与素材缩略图。

**架构：** 保留现有 React 单入口和旧工作台返回能力；把 AI 对话页拆成主导航、对话历史、消息线程、项目上下文四个语义区域，视觉实现继续使用仓库现有原生 CSS。Figma 短时资产本地化到 `public/figma/chat/`，页面不依赖远程 URL、截图背景或新图标包。

**技术栈：** React 19、TypeScript 5.9、Vite 7、Vitest、Testing Library、原生 CSS、Tauri 2。

---

## 文件结构

- `src/App.test.tsx`：目标页默认呈现、完整文案、语义结构和本地 Figma 资产契约。
- `src/App.tsx`：四栏 AI 对话页 DOM、静态数据、工作台返回入口与本地资产引用。
- `src/styles/app.css`：1440×1024 固定设计画布、四栏尺寸、排版、卡片、输入区及素材网格。
- `public/figma/chat/*`：Figma 导出的品牌图、遮罩、头像、导航图标、消息操作图标、项目图与素材缩略图。
- `docs/superpowers/plans/2026-07-14-ai-studio-chat-figma-27-2094.md`：本计划和验收检查点。

### 任务 1：定义目标页面的失败测试

**文件：**
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：编写默认页面与内容契约测试**

```tsx
it('opens the Figma 27:2094 AI chat workspace by default', () => {
  render(<App />)

  const workspace = screen.getByTestId('ai-chat-workspace')
  expect(within(workspace).getByRole('heading', { name: 'AI 对话' })).toBeInTheDocument()
  expect(within(workspace).getByRole('heading', { name: '最近对话' })).toBeInTheDocument()
  expect(within(workspace).getByRole('heading', { name: '项目上下文' })).toBeInTheDocument()
  expect(screen.getByPlaceholderText('输入你的想法...')).toBeInTheDocument()
})

it('renders the complete Figma conversation and project context', () => {
  render(<App />)

  expect(screen.getByText('核心信息：')).toBeInTheDocument()
  expect(screen.getByText('图文内容：')).toBeInTheDocument()
  expect(screen.getByText('同步准备社媒互动活动与KOL合作，扩大声量与转化')).toBeInTheDocument()
  expect(screen.getByText('擅长创意策划、内容生成与多模态创作')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '保存为 Prompt' })).toBeInTheDocument()
})
```

- [ ] **步骤 2：编写原始资产与导航文案契约测试**

```tsx
it('uses the Figma-exported local assets and exact navigation labels', () => {
  render(<App />)

  expect(screen.getByTestId('brand-art')).toHaveAttribute('src', '/figma/chat/brand-art.png')
  expect(screen.getByAltText('春季新品传播计划封面')).toHaveAttribute('src', '/figma/chat/project-cover.jpg')
  expect(screen.getByRole('button', { name: 'AI 图片' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'AI 视频' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'AI 音乐' })).toBeInTheDocument()
})
```

- [ ] **步骤 3：运行测试并确认按预期失败**

运行：`npm test -- src/App.test.tsx`

预期：FAIL；旧实现默认打开工作台，没有 `ai-chat-workspace`，缺少完整 Figma 文案且仍引用旧素材。

### 任务 2：本地化 Figma 原始资源并实现完整 DOM

**文件：**
- 创建：`public/figma/chat/brand-art.png`
- 创建：`public/figma/chat/brand-mask.svg`
- 创建：`public/figma/chat/user-avatar.jpg`
- 创建：`public/figma/chat/project-cover.jpg`
- 创建：`public/figma/chat/asset-gradient.jpg`
- 创建：`public/figma/chat/asset-rose.jpg`
- 创建：`public/figma/chat/asset-flowers.jpg`
- 创建：`public/figma/chat/asset-video.jpg`
- 创建：`public/figma/chat/asset-abstract.jpg`
- 创建：`public/figma/chat/*.svg`（设计稿导出的导航、会话、操作和快捷操作图标）
- 修改：`src/App.tsx`

- [ ] **步骤 1：复制已下载的 Figma 原始资源**

将临时目录 `AIStudio-figma-assets/{primary,history,main,context}` 中的文件复制到 `public/figma/chat/`；保留 SVG 内容及图片字节，不用字符图标、第三方图标库或占位图替换。

- [ ] **步骤 2：用静态数据定义精确文案**

```tsx
const chatHistory = {
  今天: [
    ['春季新品传播计划', '14:30'],
    ['新品TVC创意方案讨论', '11:20'],
    ['春季新品KV创意方向', '10:05'],
  ],
  昨天: [
    ['品牌故事脚本优化', '18:45'],
    ['春季主题音乐创意', '16:30'],
    ['社交平台内容规划', '15:10'],
    ['产品卖点提炼', '11:40'],
  ],
}
```

消息卡片完整呈现设计稿中的四条“创意方向”、四条“内容建议”和三条“下一步”，保留标签字重差异与设计稿标点。

- [ ] **步骤 3：实现四栏语义结构并默认打开聊天页**

```tsx
function App() {
  const [page, setPage] = useState<'dashboard' | 'chat'>('chat')
  return page === 'chat'
    ? <AiChat onBack={() => setPage('dashboard')} />
    : <Dashboard onOpenChat={() => setPage('chat')} />
}
```

`AiChat` 根节点使用 `data-testid="ai-chat-workspace"`；四栏顺序固定为 240px 主导航、280px 最近对话、600px 消息区和 320px 项目上下文。

- [ ] **步骤 4：运行目标测试并确认 DOM 契约通过**

运行：`npm test -- src/App.test.tsx`

预期：目标页、完整文案和本地资产断言 PASS；若旧工作台测试因默认页变化失败，改为先点击“创作工作台”再断言旧页面，而不是删除返回能力。

### 任务 3：按 Figma 尺寸实现 1:1 样式

**文件：**
- 修改：`src/styles/app.css`

- [ ] **步骤 1：锁定画布与四栏布局**

```css
.chat-app {
  display: grid;
  grid-template-columns: 240px 280px 600px 320px;
  width: 1440px;
  height: 1024px;
  overflow: hidden;
  background: #0a0a0b;
}
```

所有栏分隔线使用 `#1f2128`；页面不缩放设计基准，在较小窗口保留横向查看能力。

- [ ] **步骤 2：实现主导航和最近对话**

品牌区高 72px；导航左右 12px、单项高 45px、圆角 14px；选中背景 `rgba(124,58,237,.15)`。最近对话头部高 121px，新建按钮高 41px、圆角 10px；历史项高 64.5px，首项背景 `#1f2128`。

- [ ] **步骤 3：实现消息线程与输入区**

消息区头部高 72px；消息内容区高约 786.286px，左右 32px。用户气泡 `381×78`、三角不对称圆角；AI 内容卡宽 `434.393px`，前两张高 `178.143px`、第三张高 `148.143px`。输入区从 y=858.286 开始，输入卡宽 552px、高 141.714px、圆角 16px。

- [ ] **步骤 4：实现项目上下文与 3×3 素材网格**

右栏内边距 24px；素材单元 `85.143px`、间隙 8px、圆角 10px。准确实现视频时长角标、音频波形和两种无缩略图占位卡；模型卡高约 78px，快捷按钮高约 45px。

- [ ] **步骤 5：运行测试、类型检查并确认无警告**

运行：`npm test -- src/App.test.tsx; npm run typecheck`

预期：两条命令退出码均为 0，无 React key、嵌套或可访问名称警告。

### 任务 4：构建与视觉回归

**文件：**
- 不修改文件，除非截图对照发现明确偏差。

- [ ] **步骤 1：运行完整测试与生产构建**

运行：`npm test; npm run build`

预期：全部测试 0 failures，构建退出码 0。

- [ ] **步骤 2：固定 1440×1024 启动页面**

运行：`npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`

预期：固定端口启动，无资源 404；页面首次打开即显示 AI 对话页。

- [ ] **步骤 3：执行截图叠加校准**

在 1440×1024、DPR 1、100% 缩放下截图，与 `figma-reference-27-2094.png` 进行并排和 50% 透明叠加；逐项核对四栏边界、标题基线、消息卡 y 坐标、素材裁切、圆角、颜色和输入区位置。

- [ ] **步骤 4：根据证据迭代并重新验证**

每次视觉修正后重新运行 `npm test -- src/App.test.tsx`、`npm run typecheck`、`npm run build` 并重新截图。只有差异已收敛且命令均退出 0 时才报告完成。

