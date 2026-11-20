# 扫雷经典版 Classic Minesweeper ZH

经典 Windows 风格的中文扫雷，配有简洁的响应式外层界面。保留像素棋盘、表情按钮和数字计数器；电脑使用鼠标交互，手机提供明确的触摸模式。

## 功能

- 初级、中级、高级、自定义和满屏棋盘，首次翻开不会踩雷。
- 电脑：左键翻开、右键循环标记；点击已翻开的数字，周围旗数吻合才展开。错误旗会导致踩雷，插旗本身不展开。
- 手机：翻开、插旗、问号三个模式；当前模式高亮。同一标记再次点按可清除，点击已翻开的数字可以展开周围。
- 按屏幕宽度与指针/悬停能力区分交互，缩小电脑窗口不会显示手机按钮。
- 保留经典棋盘；大棋盘仅在棋盘区域内横向滚动。声音、彩色/黑白、问号设置可切换。
- 不设排行榜。可选接入现有平台账号，保存每个用户自己的通关记录。

## 独立运行

需要 Node.js 24、pnpm 10.34.9：

```sh
pnpm install
pnpm dev
```

打开终端显示的本地地址，默认端口 5175。默认是纯前端单机版，不需要数据库、登录服务或公网服务器；不会尝试保存账号通关记录。

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

`dist/` 是可部署到静态服务器的构建结果。请将它部署在站点根路径，或为 `/classic-minesweeper/` 配置对应静态资源路径。它不是无需构建、双击根目录 index.html 即可运行的发行包。

## 可选账号记录接入

复制 `.env.example` 为 `.env`，设置 `VITE_ACCOUNT_RECORDS=true`，并将 `API_TARGET` 指向自己的开发后端。生产环境由同源 HTTPS 后端处理 `/api`，构建时启用上述开关。

前端期望的接口：

| 接口 | 用途 |
| --- | --- |
| `GET /api/auth/status` | `{ enabled: boolean }` |
| `GET /api/auth/me` | `{ user: { id, username, nickname, role } }` 或 401 |
| `POST /api/auth/register` | 接收 username、password，返回 user 并设置会话 Cookie |
| `POST /api/auth/login` | 登录并设置会话 Cookie |
| `POST /api/auth/logout` | 使会话失效 |
| `POST /api/me/minesweeper/runs` | 开局时关联当前账号 |
| `POST /api/me/minesweeper/runs/:runId/complete` | 通关后幂等保存 |
| `GET /api/me/minesweeper/records?before=游标` | 本人的通关历史 |

`examples/server/` 提供 Fastify、Zod、better-sqlite3 的记录路由、会话读取和建表示例，用于嵌入已有账号系统；它不是可以直接启动的完整后端。需要宿主自行提供注册登录、users/sessions 表及迁移管理，并安装上述依赖。会话示例要求 `board_session` Cookie，sessions 表保存令牌的 SHA-256 摘要、user_id 和毫秒级 expires_at；users 表需有 id、username、nickname、role、status 字段。

调用 `registerMinesweeperRecords(app, database, origin, production)` 注册记录接口；origin 必须与浏览器访问来源完全相同。示例会从服务端会话确定用户，拒绝客户端指定 userId，防止跨账号写入；重复提交不会创建多条。生产 HTTP 写入默认拒绝，正式账号服务需使用 HTTPS。

这些是由客户端上报的个人单机记录，不是服务端验证的竞技成绩。使用彩蛋或停表会标注辅助；不用于排行榜。保存失败可在当前页面重试，关闭页面后不保证补传。

## 目录

```text
src/                         响应式页面、模式判定、可选账号入口
public/classic-minesweeper/   经典游戏脚本、样式、图片和音效
tests/                       游戏规则与交互判定测试
examples/server/             可选账号记录接口示例
```

## 来源与许可证

基于 [BrandonDusseau/minesweeper-classic](https://github.com/BrandonDusseau/minesweeper-classic) 的中文修改版本继续开发，保留 Copyright (c) 2015–2024 Brandon Dusseau 及原 MIT 许可证。jQuery 的版权与 MIT 声明保留在其源码头部。

本项目是经典扫雷的爱好者复刻，与 Microsoft 没有关联或背书。新增部分同样按 MIT 开源，详见 LICENSE 和 THIRD_PARTY_NOTICES.md。

本仓库不含生产服务器配置、真实账号、数据库、会话令牌或私人部署记录。移动浏览器尺寸与逻辑已经检查，真实设备的触摸体验仍欢迎反馈。
