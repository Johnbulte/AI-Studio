# 多米 API 图片与视频接入设计

**目标：** 将 AI 图片和 AI 视频页面从静态演示接入多米 API 的真实异步任务接口，同时保留当前页面布局、参考图上传限制和本地历史记录。

## 选定接口

- 图片使用多米统一异步图片接口：`POST /v1/images/generations?async=true`，查询 `GET /v1/tasks/{id}`，默认模型 `gpt-image-2`。
- 视频使用 Seedance 2.0：`POST /api/v3/contents/generations/tasks`，查询 `GET /api/v3/contents/generations/tasks/{task_id}`，默认模型 `doubao-seedance-2-0-260128`。
- 多米鉴权使用 `Authorization: <api-key>`，不是当前聊天网关使用的 Bearer 形式。

## 安全与配置

设置页增加多米 API 地址、图片模型、视频模型和 API Key 输入。API Key 只通过 Tauri 写入系统 keyring；SQLite 只保存非敏感配置和任务元数据，不保存 API Key、access token 或 refresh token。返回前端的配置只包含 `apiKeyConfigured` 布尔值。

## 数据流

React 页面提交参数到 Tauri command。Rust 使用 keyring 读取 API Key，提交任务后在后台轮询。轮询状态通过 `ai://media/updated`、`ai://media/completed`、`ai://media/failed` 事件回传。成功事件携带结果 URL，前端替换预览并把任务写入本地生成记录；失败保留错误并提供重试。取消只停止客户端轮询并标记本地任务取消，多米接口没有假定存在取消端点。

## 参考图

当前上传组件继续限制最多 3 张、单张不超过 10MB。请求暂时把本地 data URL 作为接口图片输入传递；如果多米账号对某个模型只接受公网 HTTPS URL，Rust 将把上游错误转为可读的“参考图需要公网地址”提示，不伪造成功结果。纯文生图不受此限制。

## 验收标准

- 未配置 API Key 时点击生成，显示配置提示且不发起空密钥请求。
- 创建任务、轮询中、成功、失败、重试和客户端取消均有可见状态。
- 成功图片使用多米返回的 `data.images[].url`；成功视频使用 `content.video_url`。
- 重启应用后本地任务记录仍可读取，API Key 不出现在数据库查询结果中。
- Rust mock HTTP 测试覆盖请求头、请求 JSON、任务状态解析和错误映射；React 测试覆盖生成、成功、失败、重试和取消。
