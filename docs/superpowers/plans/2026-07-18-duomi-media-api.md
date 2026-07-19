# 多米 API 图片与视频接入实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 接入多米真实异步图片和视频生成 API，并将结果、状态和错误接回现有桌面工作区。

**架构：** Rust 负责 keyring、HTTP 请求、异步轮询和任务事件；React 负责表单、状态、预览和重试。非敏感的媒体配置与任务运行元数据保存在 SQLite，API Key 只在系统安全存储中保存。

**技术栈：** Tauri 2、Rust reqwest/tokio/rusqlite/keyring、React 19、Vitest Testing Library。

---

### 任务 1：配置和安全存储

**文件：**
- 修改：`src-tauri/src/models.rs`
- 修改：`src-tauri/src/auth.rs`
- 修改：`src-tauri/src/storage.rs`
- 修改：`src-tauri/src/state.rs`
- 修改：`src-tauri/src/commands.rs`
- 修改：`src-tauri/src/lib.rs`
- 修改：`src/bridge/tauriClient.ts`
- 修改：`src/pages/SettingsPage.tsx`
- 测试：`src-tauri/src/auth.rs`、`src-tauri/src/storage.rs`、`src/pages/SettingsPage.test.tsx`

- [ ] 添加 `MediaConfig`、`SaveMediaConfigArgs` 和 `apiKeyConfigured` 类型；默认地址为 `https://duomiapi.com`，默认图片模型为 `gpt-image-2`，默认视频模型为 `doubao-seedance-2-0-260128`。
- [ ] 添加 keyring 键 `duomi-api-key` 的读取、写入和清除函数；禁止将 key 写入 `app_config`。
- [ ] 为媒体配置增加 `load_media_config`、`save_media_config` Tauri commands，前端设置页增加 API Key 密码输入和已配置状态。
- [ ] 添加失败测试：保存媒体配置后 SQLite 内容不包含 API Key，加载配置只返回 `apiKeyConfigured`。
- [ ] 运行 `cargo test --manifest-path src-tauri/Cargo.toml` 和 `npm test -- --run src/pages/SettingsPage.test.tsx`。

### 任务 2：多米 API Rust 客户端

**文件：**
- 创建：`src-tauri/src/media.rs`
- 修改：`src-tauri/src/models.rs`
- 修改：`src-tauri/src/lib.rs`
- 测试：`src-tauri/src/media.rs`

- [ ] 定义图片/视频请求体和响应解析类型，映射 `code/msg/data`、`state/status`、图片 URL 和视频 URL。
- [ ] 实现图片创建与查询：发送 `Authorization` API Key，图片请求携带 `model/prompt/size/n/image`，查询 `/v1/tasks/{id}`。
- [ ] 实现 Seedance 视频创建与查询：将 prompt 转为 `content` text，将参考图转为 `image_url` content，将比例、时长、分辨率映射到官方请求字段。
- [ ] 统一映射 HTTP 错误、多米业务错误、失败状态和空结果；不把 API Key 放进错误文本。
- [ ] 添加 mock HTTP 测试，覆盖请求路径、Authorization 头、创建任务 ID、轮询成功 URL、失败状态和畸形响应。
- [ ] 运行 `cargo test --manifest-path src-tauri/Cargo.toml media`。

### 任务 3：后台任务与 Tauri 事件

**文件：**
- 修改：`src-tauri/src/state.rs`
- 修改：`src-tauri/src/commands.rs`
- 修改：`src-tauri/src/lib.rs`
- 修改：`src/bridge/tauriClient.ts`
- 测试：`src-tauri/src/commands.rs`

- [ ] 增加媒体任务参数、启动结果和事件类型，事件统一携带 `requestId/taskId/kind/status/progress/resultUrl/error`。
- [ ] 实现 `start_image_generation`、`start_video_generation` 和 `cancel_media_generation`，创建任务后使用 tokio 定时轮询，初始间隔 2 秒、最多轮询 150 次。
- [ ] 轮询成功时发出 `ai://media/completed`，服务失败或轮询耗尽时发出 `ai://media/failed`，客户端取消发出 `ai://media/updated` 的 cancelled 状态。
- [ ] 将每次任务保存到 `request_runs`，必要时扩展字段保存结果 URL、prompt 摘要和更新时间。
- [ ] 添加 command 参数校验和事件行为测试。

### 任务 4：AI 图片真实生成

**文件：**
- 修改：`src/App.tsx`
- 修改：`src/bridge/tauriClient.ts`
- 修改：`src/styles/app.css`
- 测试：`src/App.test.tsx`

- [ ] 将当前 `ImageControls` 的生成按钮接到 Tauri command；提交中禁用重复点击并显示任务状态。
- [ ] 监听媒体事件，成功后以返回 URL 替换主预览和缩略图，失败保留错误并显示重试按钮，取消恢复可生成状态。
- [ ] 生成请求携带 prompt、模式、比例、数量和参考图 data URL；图生图没有参考图时阻止提交并显示提示。
- [ ] 将成功/失败任务追加到图片生成记录，刷新页面时优先显示最近一次本地结果。
- [ ] React 测试覆盖调用参数、生成中禁用、成功 URL 渲染、失败重试和取消。

### 任务 5：AI 视频真实生成

**文件：**
- 修改：`src/pages/StudioPages.tsx`
- 修改：`src/styles/studio-pages.css`
- 测试：`src/App.test.tsx`

- [ ] 将“创建视频”接到 Seedance command，映射模式、prompt、比例、时长、清晰度和参考图。
- [ ] 监听媒体完成事件，把视频 URL 渲染为可播放的 `<video controls>`，保留静态预览作为生成前占位。
- [ ] 增加进度、失败、重试、取消和任务 ID 状态；生成期间禁用重复提交。
- [ ] 将视频成功记录插入生成记录，并在重新进入页面时恢复最近结果。
- [ ] React 测试覆盖图生视频参考图、真实提交、完成视频 URL、失败重试和取消。

### 任务 6：验证和打包

**文件：**
- 修改：`design-qa.md`（如需补充手工 smoke test）

- [ ] 运行 `npm run typecheck`。
- [ ] 运行 `npm test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `cargo test --manifest-path src-tauri/Cargo.toml`。
- [ ] 运行 `npm run tauri:build`，确认 `src-tauri/target/release/app.exe` 和 NSIS 安装包生成。
- [ ] 手工 smoke test 只在用户本地设置 API Key 后执行，不把 Key 或真实响应写入仓库。
