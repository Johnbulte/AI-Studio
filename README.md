# AI Studio OS

AI Studio OS 是一个基于 React + Tauri 的桌面端 AI 创作工作台。

## 当前能力

- 登录与本地会话恢复
- AI 对话与本地会话历史
- 多米 API 图片生成：文生图、图生图
- 多米 API 视频生成：文生视频、图生视频
- 参考图添加、删除与校验：最多 3 张，单张不超过 10MB
- 生成任务进度、取消、失败重试和历史记录

## 本地开发

```bash
npm install
npm run tauri:dev
```

## 验证与打包

```bash
npm test
npm run typecheck
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

Windows 安装包输出在：

```text
src-tauri/target/release/bundle/nsis/
```

## 配置多米 API

启动应用后进入左下角账户区的“设置”，填写：

- 多米 API 地址
- 图片模型
- 视频模型
- 多米 API Key

API Key 只保存到系统安全存储，不会写入 SQLite 或 Git 仓库。

## Git

默认分支为 `main`。当前仓库已配置忽略依赖、构建产物、测试产物、本地数据库和环境变量文件。

如需绑定远程仓库：

```bash
git remote add origin <你的远程仓库地址>
git push -u origin main
```
