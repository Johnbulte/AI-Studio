# AI Studio OS 主界面高保真还原实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Figma 节点 `26:773` 还原为 1440×1024 的可运行 React 主界面，不实现业务跳转。

**架构：** 保持单页 React 入口；`App.tsx` 仅渲染静态工作台结构与本地 Figma 资源，`app.css` 负责精确的画布、三栏布局和视觉层级，`tokens.css` 提供与 Figma 对齐的颜色、尺寸和圆角变量。测试只断言本阶段要求的可访问主结构，避免耦合视觉细节。

**技术栈：** React 19、TypeScript、Vite、Vitest、Testing Library、原生 CSS。

---

## 文件结构

- `src/App.tsx`：主界面的语义化 DOM、中文静态文案和本地 Figma 资源引用。
- `src/App.test.tsx`：主界面的存在性与静态交互边界测试。
- `src/styles/tokens.css`：Figma 颜色、尺寸、圆角与排版令牌。
- `src/styles/app.css`：1440×1024 画布、240px 侧栏、内容区以及组件的高保真样式。
- `public/figma/*`：已存在的 Figma 导出资源；只复用，不增加图标库。

### 任务 1：先定义主界面验收测试

**文件：**
- 修改：`src/App.test.tsx`

- [ ] **步骤 1：编写失败的主界面测试**

```tsx
it('renders the Figma 26:773 workspace without navigating away', () => {
  render(<App />)

  expect(screen.getByText('AI Studio OS')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '创作工作台' })).toBeInTheDocument()
  expect(screen.getByText('最近创作')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'AI 图像创作' })).not.toBeInTheDocument()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- --run src/App.test.tsx`

预期：FAIL，因为当前页面仍包含旧原型的任务中心和生成工作区行为。

### 任务 2：实现静态的 Figma 主界面

**文件：**
- 修改：`src/App.tsx`
- 修改：`src/styles/tokens.css`
- 修改：`src/styles/app.css`

- [ ] **步骤 1：将 App 收敛为本阶段的静态页面**

```tsx
function App() {
  return (
    <main className="figma-app" aria-label="AI Studio OS 创作工作台">
      <aside className="figma-sidebar" aria-label="主导航栏">...</aside>
      <section className="figma-main">...</section>
    </main>
  )
}
```

移除本阶段不需要的 `ImageGenerationWorkspace` 状态分支与点击跳转；保留所有图标和缩略图为 `/figma/` 本地路径。

- [ ] **步骤 2：对齐 Figma 设计令牌与布局**

```css
:root {
  --figma-canvas: #0a0a0a;
  --figma-surface: #171717;
  --figma-border: #262626;
  --figma-text: #f5f5f5;
  --figma-muted: #a3a3a3;
  --figma-accent: #7c3aed;
  --figma-sidebar-width: 240px;
  --figma-frame-height: 1024px;
  --figma-radius: 14px;
}
```

将主容器固定为 1440×1024 设计基准，设置 240px 左侧导航、72px 品牌区、深色卡片与 Figma 相同的紫色选中态；在窗口宽度不足时允许横向查看，不压缩核心比例。

- [ ] **步骤 3：运行测试验证通过**

运行：`npm test -- --run src/App.test.tsx`

预期：PASS，主界面标题、导航和最近创作可访问，且不再渲染图像创作工作区。

### 任务 3：构建与视觉回归验证

**文件：**
- 不修改文件。

- [ ] **步骤 1：运行类型检查与完整测试**

运行：`npm run typecheck; npm test -- --run`

预期：两个命令均退出为 0。

- [ ] **步骤 2：运行生产构建**

运行：`npm run build`

预期：退出为 0，生成 `dist` 目录。

- [ ] **步骤 3：在设计基准视口做视觉比对**

运行：`npm run dev -- --host 127.0.0.1`

预期：在 1440×1024 下，页面呈现 Figma `26:773` 的侧栏、创作工作台、快捷入口和最近创作区域；不将 Figma 截图用作背景图。

- [ ] **步骤 4：记录验证结果**

在交付说明中列出 `typecheck`、测试、构建及视觉检查结果，并说明尚未实现的导航与生成行为属于下一阶段。
