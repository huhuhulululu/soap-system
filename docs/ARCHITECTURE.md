# SOAP System 系统架构手册 v2.3.0

> 本文档是 SOAP System 的唯一正确数据参考源（Single Source of Truth）。
> 所有系统优化、检修、重建、AI Agent 训练均以本文档为准。
>
> 最后更新: 2026-02-20 | 分支: clean-release

---

## AI Agent 操作原则

任何 AI Agent 在使用本手册对系统进行操作时，必须遵守以下原则：

1. **不编造原则** — 只使用本文档和代码中已存在的信息，不凭空创造函数、类型、模块
2. **最小引入原则** — 修改代码时只引入必要的最小变更，不添加未被要求的功能、依赖或抽象
3. **杜绝幻觉原则** — 不假设代码中存在未验证的功能；修改前必须先读取目标文件确认现状
4. **单一真相源原则** — 共享常量/映射只在一处定义（src/shared/），其他模块引用而非复制
5. **不破坏原则** — 任何修改不得破坏现有测试；修改后必须运行 `npm test` 验证
6. **可追溯原则** — 每次修改必须说明依据（本文档章节号或具体代码行号）

---

## 第一章：系统总览

### 1.1 系统定位

SOAP System 是一个针灸诊所 SOAP 医疗笔记的自动化工具，核心功能：

| 功能 | 说明 |
|------|------|
| PDF 解析 (Parser) | 将 Optum 格式 PDF 文本解析为结构化数据 |
| 质量检查 (Checker) | 校验 SOAP 笔记的医学逻辑一致性，输出评分报告 |
| 笔记生成 (Generator/Writer) | 根据参数自动生成符合保险规范的 SOAP 笔记 |
| 续写生成 (Continue) | 基于已有 IE+TX 记录，批量续写后续 TX |
| 历史记录 (History) | 本地保存验证历史，7 天自动过期 |
| 批量导出 (Batch Export) | 将多份笔记打包为 ZIP 下载 |

### 1.2 技术栈

```
前端: Vue 3 + Vite + Tailwind CSS + Pinia + pdf.js
后端: 纯前端架构（无服务器），所有逻辑在浏览器运行
引擎: TypeScript（src/ 目录，被前端直接 import）
部署: Docker + Nginx（静态文件托管）
```

### 1.3 部署架构

```
用户浏览器
    │
    ▼
┌─────────────────────────────┐
│  Nginx (Docker, port 9090)  │
│  静态文件托管 + SPA fallback │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Vue 3 SPA (frontend/dist)  │
│  所有业务逻辑在浏览器执行     │
│  PDF解析 → 检查 → 生成       │
└─────────────────────────────┘
```

- 服务器: `ubuntu@150.136.150.184`
- 项目路径: `/home/ubuntu/soap-system`
- 部署命令: `ssh ubuntu@150.136.150.184 "cd /home/ubuntu/soap-system && git pull origin clean-release && docker compose up -d --build"`
- 端口映射: 9090 → 8080 (nginx)
- Nginx 路由: `https://rbmeds.com/ac/` → `localhost:9090`（strip `/ac/`）

### 1.4 认证架构

AC 系统通过与 PT 系统共享 JWT Cookie 实现统一认证，无需独立用户系统。

```
用户登录 PT (/pt/api/auth/login)
    │
    ▼
PT 签发 JWT Cookie (rbmeds_token)
    │  payload: { user_id, username, role, ac_access, exp }
    │  httponly, secure, samesite=Lax, path=/
    │
    ▼
用户访问 AC (/ac/)
    │
    ▼
AC 后端 requireAuth 中间件
    ├── 1. 读取 req.cookies.rbmeds_token
    ├── 2. jwt.verify(token, SHARED_JWT_SECRET)
    ├── 3. 检查 payload.ac_access === true
    ├── ✅ 通过 → req.user = payload → next()
    └── ❌ 失败 → 回退 x-api-key 验证（向后兼容）
```

关键配置:
- `SHARED_JWT_SECRET`: 必须与 PT 的 `SECRET_KEY` 相同
- `CORS_ORIGIN`: `https://rbmeds.com`（含 `credentials: true`）
- `cookie-parser`: 解析请求中的 cookie
- `/api/auth/me`: 返回当前 JWT 用户信息（username, role, ac_access）

用户 AC 访问权限由 PT Settings → 用户管理中的「AC 系统」开关控制（`ac_access` 字段）。

---

## 变更记录 (Changelog)

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v2.3.0 | 2026-02-20 | **JWT Cookie 共享认证**: (1) `requireAuth` 中间件新增 JWT cookie 验证（优先级高于 x-api-key），验证 `rbmeds_token` cookie 中的 `ac_access` 声明；(2) 新增 `cookie-parser` + `jsonwebtoken` 依赖；(3) 新增 `/api/auth/me` 端点；(4) CORS 从 `ac.aanao.cc` 改为 `https://rbmeds.com`，启用 `credentials: true`；(5) docker-compose.yml 新增 `SHARED_JWT_SECRET` 环境变量。 |
| v2.2.0 | 2026-02-15 | 初始架构文档 |
