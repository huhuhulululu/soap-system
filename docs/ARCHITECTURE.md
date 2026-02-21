# SOAP System 系统架构手册 v2.3.0

> 本文档是 SOAP System 的唯一正确数据参考源（Single Source of Truth）。
> 所有系统优化、检修、重建、AI Agent 训练均以本文档为准。
>
> 最后更新: 2026-02-21 | 分支: clean-release

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
| 质量检查 (Checker) | 校验 SOAP 笔记的医学逻辑一致性，输出评分报告（含历史记录） |
| 笔记生成 (Composer) | 根据参数自动生成符合保险规范的 SOAP 笔记（Writer + Continue 模式） |
| 批量处理 (Batch) | Excel 上传 / JSON 提交 → 批量生成 SOAP，支持 full/soap-only/continue 三种模式 |
| MDLand 自动化 (Automate) | Playwright 无头浏览器自动将 SOAP 笔记填入 MDLand EHR 系统 |
| 批量导出 (Batch Export) | 将多份笔记导出为 CSV 下载 |

### 1.2 技术栈

```
前端: Vue 3 + Vite + Tailwind CSS + Pinia + pdf.js + Vue Router
后端: Express 5 + TypeScript (tsx) + multer + exceljs + Playwright
共享引擎: TypeScript（src/ 目录，前端 import + 后端 require）
认证: jsonwebtoken + cookie-parser（JWT Cookie 共享认证）
安全: express-rate-limit + cors + AES-256-GCM cookie 加密
部署: Docker Compose（frontend: Nginx + backend: Node 20）
```

### 1.3 部署架构

```
用户浏览器 (https://rbmeds.com/ac/)
    │
    ▼
┌──────────────────────────────────────┐
│  Host Nginx (rbmeds.com)             │
│  /ac/ → localhost:9090 (strip /ac/)  │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│  frontend 容器 (Nginx, 9090:8080)    │
│  ├── /        → 静态文件 (SPA)       │
│  └── /api/*   → proxy backend:3001   │
└──────────────────────────────────────┘
    │ /api/*
    ▼
┌──────────────────────────────────────┐
│  backend 容器 (Node 20, port 3001)   │
│  ├── /api/health      (无需认证)     │
│  ├── /api/auth/me     (无需认证)     │
│  ├── /api/batch/*     (requireAuth)  │
│  └── /api/automate/*  (requireAuth)  │
│  Volume: batch-data → /app/data      │
└──────────────────────────────────────┘
```

- 服务器: `ubuntu@150.136.150.184`
- 项目路径: `/home/ubuntu/soap-system`
- 域名: `https://rbmeds.com/ac/`（Host Nginx strip `/ac/` 前缀后转发至 Docker）
- 部署命令: `ssh ubuntu@150.136.150.184 "cd /home/ubuntu/soap-system && git pull origin clean-release && docker compose up -d --build"`
- 端口映射: 9090 → 8080 (frontend nginx), 3001 内部暴露 (backend)
- Docker Volume: `batch-data` 持久化批量数据至 `/app/data`

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

## 第二章：后端 API

### 2.1 入口与中间件

服务入口: `server/index.ts` → `createApp()` 工厂函数

中间件链: CORS → JSON body (1mb) → cookie-parser → rate limiting → 路由

### 2.2 Rate Limiting

| 规则 | 窗口 | 上限 | 路径 |
|------|------|------|------|
| API 通用 | 60s | 60 次 | `/api/*` |
| 登录限流 | 15min | 5 次 | `/api/automate/login` |

### 2.3 API 端点

**公开端点（无需认证）:**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/auth/me` | 返回当前 JWT 用户信息 |

**Batch 端点（requireAuth）— `server/routes/batch.ts`:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batch` | 上传 Excel → 解析+生成 SOAP |
| POST | `/api/batch/json` | JSON 提交患者数据（网页表单） |
| GET | `/api/batch/:id` | 获取 batch 详情 |
| PUT | `/api/batch/:batchId/visit/:patientIdx/:visitIdx` | 重新生成单个 visit |
| POST | `/api/batch/:batchId/generate` | 生成所有 SOAP（soap-only 模式） |
| POST | `/api/batch/:batchId/confirm` | 确认 batch（标记可执行） |
| GET | `/api/batch/template/download` | 下载 Excel 模板 |

**Automate 端点（requireAuth）— `server/routes/automate.ts`:**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/automate/cookies` | 上传 MDLand storage state |
| GET | `/api/automate/cookies` | 检查 cookies 状态 |
| POST | `/api/automate/:batchId` | 触发 Playwright 自动化 |
| GET | `/api/automate/:batchId` | 获取自动化状态+日志 |
| POST | `/api/automate/:batchId/stop` | 停止运行中的自动化 |

---

## 第三章：共享引擎模块 (`src/`)

前后端共享的 TypeScript 引擎，前端通过 Vite import、后端通过 tsx require。

### 3.1 模块依赖图

```
types ──→ knowledge ──→ shared (tcm-mappings)
  │            │
  ├──→ shared  │
  │            ▼
  ├──→ parser ←┘
  │       │
  ▼       ▼
generator (← types + knowledge + parser + shared)

auditor (独立，无 src/ 外部依赖)
validator (依赖 parsers/optum-note/，不在 src/ 依赖链内)
```

### 3.2 模块职责

| 模块 | 路径 | 职责 |
|------|------|------|
| types | `src/types/index.ts` | 核心类型定义（SOAPNote, NoteHeader, GenerationContext, BodyPart 等） |
| knowledge | `src/knowledge/` | 医学知识库：TCM 模式 (`tcm-patterns.ts`)、病史引擎 (`medical-history-engine.ts`) |
| shared | `src/shared/` | 共享常量/映射：ICD 目录、CPT 目录、ADL 映射、体部位常量、严重度、SOAP 约束、TCM 映射 (`tcm-mappings.ts`)、字段解析 (`field-parsers.ts`) |
| parser | `src/parser/` | 规则引擎：下拉解析、逻辑规则 (`rule-engine.ts`, `logic-rules.ts`, `template-logic-rules.ts`)、TX 提取、权重系统、模板白名单 (`template-rule-whitelist.ts`, `template-rule-whitelist.browser.ts`) |
| generator | `src/generator/` | SOAP 生成：主入口 (`soap-generator.ts`)、目标计算、客观补丁、TX 序列引擎、权重整合 |
| auditor | `src/auditor/` | 三层审计：Layer1 基础校验 → Layer2 逻辑一致性 → Layer3 高级规则 |
| validator | `src/validator/` | 输出验证：`output-validator.ts` 最终校验生成结果 |

---

## 第四章：前端架构

### 4.1 路由 (`frontend/src/router/index.js`)

| 路径 | 视图 | 说明 |
|------|------|------|
| `/` | CheckerView | PDF 解析 + 质量检查（含历史记录） |
| `/composer` | ComposerView | SOAP 笔记生成（Writer + Continue 模式） |
| `/batch` | BatchView | 批量处理界面 |
| `/writer` | → `/composer` | 重定向 |
| `/continue` | → `/composer?mode=continue` | 重定向 |
| `/history` | → `/` | 重定向（历史功能已内嵌 CheckerView） |

### 4.2 认证守卫

`router.beforeEach` 调用 `/api/auth/me` 检查认证状态。未认证时跳转 PT 登录页:
`/pt/login?redirect=/ac{当前路径}`

### 4.3 前端分层

```
views/          — 3 个活跃视图 (Checker, Composer, Batch) + 1 个遗留 (HistoryView)
components/     — 13 个通用组件 + composer/ 子目录 (WriterPanel, ContinuePanel)
services/       — 6 个服务 (checker, generator, normalizer, pdf-extractor, exporter, batch-exporter)
composables/    — 5 个组合函数 (useHistory, useKeyboardNav, useSOAPGeneration, useWriterFields, useDiffHighlight)
stores/         — Pinia store (files.js)
```

---

## 第五章：批量处理架构

### 5.1 存储机制 (`server/store/batch-store.ts`)

双层存储: LRU 内存缓存 + JSON 文件持久化

- 内存缓存: `Map<string, BatchData>`，最大 50 条 (`MAX_CACHE_SIZE=50`)，LRU 淘汰
- 文件持久化: `DATA_DIR/batches/{batchId}.json`（`DATA_DIR` 环境变量，Docker 默认 `/app/data`，本地默认 `.batch-data`）
- 读取策略: 先查缓存 → 缓存未命中则读文件 → 回填缓存
- Batch ID 格式: `batch_YYYYMMDD_HHmmss`

### 5.2 三种 Batch 模式

| 模式 | 说明 |
|------|------|
| `full` | 解析 Excel + 生成完整 SOAP（默认） |
| `soap-only` | 仅解析，稍后手动触发生成 |
| `continue` | 基于已有 IE+TX 续写后续 TX |

### 5.3 批量处理流程

```
Excel 上传 / JSON 提交
    → parseExcelBuffer() / buildPatientsFromRows()
    → generateMixedBatch() (支持 per-patient 混合模式)
    → saveBatch() (缓存+持久化)
    → confirm → startAutomation() (Playwright 填入 MDLand)
```

---

## 第六章：安全

### 6.1 Docker 安全

- **frontend**: `nginx` 用户运行（非 root），`nginx:alpine` 基础镜像
- **backend**: `appuser:appgroup` 非 root 用户，`node:20-slim` 基础镜像
- 两个容器均配置 healthcheck（30s 间隔，5s 超时，3 次重试）
- backend 通过 `entrypoint.sh` 启动

### 6.2 Cookie 加密 (`server/services/automation-runner.ts`)

MDLand cookies 使用 AES-256-GCM 加密存储:
- 密钥: `COOKIE_ENCRYPTION_KEY` 环境变量（hex 编码）
- 格式: `[IV 12B][AuthTag 16B][Ciphertext]`
- 存储: `DATA_DIR/mdland-storage-state.enc`
- 自动化时解密到临时文件（`mode 0o600`），完成后立即清理

### 6.3 Nginx 安全头 (`frontend/nginx.conf`)

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 6.4 SSL/TLS (`docker-compose.ssl.yml` + `frontend/nginx-ssl.conf`)

可选 TLS 覆盖层: `docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d`
- 协议: TLS 1.2 / 1.3
- HSTS: `max-age=31536000; includeSubDomains`
- 证书: `./certs/fullchain.pem` + `./certs/privkey.pem`

### 6.5 环境变量 (`.env.example`)

| 变量 | 说明 |
|------|------|
| `API_KEY` | x-api-key 认证（向后兼容） |
| `COOKIE_ENCRYPTION_KEY` | AES-256-GCM 密钥（hex） |
| `SHARED_JWT_SECRET` | JWT 共享密钥（与 PT 系统相同） |
| `PORT` | 后端监听端口（docker-compose 硬编码 `3001`） |
| `NODE_ENV` | 运行环境（docker-compose 硬编码 `production`） |
| `DATA_DIR` | 批量数据存储目录（docker-compose 硬编码 `/app/data`） |
| `CORS_ORIGIN` | CORS 允许源（docker-compose 硬编码 `https://rbmeds.com`） |

---

## 第七章：测试

| 框架 | 范围 | 配置 |
|------|------|------|
| Jest (ts-jest) | `src/`, `parsers/`, `tests/`, `server/` | `package.json` jest 配置，coverage threshold 70% |
| Vitest | `frontend/` | `frontend/package.json`，Vue 组件 + 服务测试 |

运行命令:
- 后端+引擎: `npm test` / `npm run test:coverage`
- 前端: `cd frontend && npm test`

---

## 变更记录 (Changelog)

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v2.3.0 | 2026-02-21 | **架构文档全面修正**: (1) 修正功能表：合并 Writer/Continue 为 Composer，新增 Batch、Automate，移除独立 History；(2) 新增第二章后端 API（14 个端点 + rate limiting）；(3) 新增第三章共享引擎模块架构（7 模块依赖图）；(4) 新增第四章前端架构（路由、认证守卫、分层）；(5) 新增第五章批量处理（LRU 存储、3 种模式、流程）；(6) 新增第六章安全（Docker 非 root、Cookie 加密、Nginx 安全头、SSL/TLS、环境变量）；(7) 新增第七章测试（Jest + Vitest 双框架）。 |
| v2.3.0-auth | 2026-02-20 | **JWT Cookie 共享认证**: `requireAuth` 中间件新增 JWT cookie 验证，新增 `/api/auth/me` 端点，CORS 改为 `https://rbmeds.com`。 |
| v2.2.0 | 2026-02-15 | 初始架构文档 |
