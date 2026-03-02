# SOAP System 全面性能优化计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不换技术栈的前提下（Express + Vue + Docker），将 SOAP System 从单用户单线程架构优化为支持多用户并发 + 大批量高效处理的生产级系统。

**Architecture:** 六个方向并行优化：(1) 后端异步化 + Worker Thread 卸载 CPU 密集任务 (2) 存储层并发安全 + 异步 I/O (3) Nginx 全面加固 (4) Docker 资源治理 (5) 前端 Web Worker + 虚拟滚动 (6) Bug 修复 + 安全加固。稳中求快，每步可独立部署验证。

**Tech Stack:** Node.js worker_threads, fs.promises, nginx gzip/proxy tuning, Docker deploy limits, Web Worker API

**审计依据:** `docs/architecture-audit.json` (2026-02-28, 3 Opus agents, 8/8 cross-validated)

**约束:**
- 不换技术栈，Express + Vue + Docker 框架内优化
- ARM A1 免费层 (4 OCPU / 24GB RAM) 单机
- 30 个 fixture snapshot 必须全部通过
- tx-sequence-engine PRNG 序列不可打乱

---

## 方向一：后端异步化 + CPU 卸载（架构师 + 性能工程师视角）

### 问题
- `generateMixedBatch` 同步阻塞事件循环，50患者×12visits 期间所有请求排队
- `batch-store` 全部 `fs.*Sync` 阻塞事件循环
- `automation-runner` 6 处同步文件 I/O
- AI 生成每次冷启动 Python 子进程

### Task 1: batch-store 异步化

**Files:**
- Modify: `server/store/batch-store.ts`
- Create: `server/store/__tests__/batch-store.test.ts`

**改动要点:**
1. `fs.writeFileSync` → `fs.promises.writeFile`
2. `fs.readFileSync` → `fs.promises.readFile`
3. `fs.existsSync` (getBatch) → try/catch `fs.promises.readFile`
4. 所有导出函数签名从 sync 改 async: `saveBatch → Promise<void>`, `getBatch → Promise<BatchData|undefined>`, `confirmBatch → Promise<boolean>`
5. 加写入锁: `Map<string, Promise<void>>` 防止同一 batchId 并发写入冲突
6. `ensureStoreDir()` 保持同步（模块加载时调用一次）

**调用方连锁更新:**
- `server/routes/batch.ts`: 所有 `saveBatch/getBatch/confirmBatch` 加 `await`
- `server/routes/automate.ts`: `getBatch` 加 `await`

**测试:** 基本 CRUD round-trip + 并发写入不冲突
**验证:** `npm test` 全量通过
**Commit:** `perf: async batch-store with write locks and fs.promises`

### Task 2: automation-runner 异步化

**Files:**
- Modify: `server/services/automation-runner.ts`

**改动要点:**
1. `hasCookies()`: `fs.existsSync` → `async` + `fs.promises.access`
2. `saveCookies()`: `fs.mkdirSync + fs.writeFileSync` → `fs.promises.mkdir + fs.promises.writeFile`
3. `loadCookies()`: `fs.readFileSync` → `fs.promises.readFile`
4. `decryptCookiesToTempFile()`: `fs.writeFileSync` → `fs.promises.writeFile`
5. `cleanupTempCookies()`: `fs.unlinkSync` → `fs.promises.unlink`
6. `getCookiesInfo()`: `fs.existsSync + fs.statSync` → `fs.promises.stat` + try/catch

**调用方连锁更新:**
- `server/routes/automate.ts`: 所有调用加 `await`

**测试:** 现有 automate 路由测试通过
**验证:** `npm test`
**Commit:** `perf: async automation-runner file I/O`

### Task 3: SOAP 生成卸载到 Worker Thread

**Files:**
- Create: `server/workers/soap-worker.ts`
- Create: `server/services/soap-worker-pool.ts`
- Modify: `server/services/batch-generator.ts`
- Modify: `server/routes/batch.ts`
- Create: `server/workers/__tests__/soap-worker.test.ts`

**改动要点:**

`server/workers/soap-worker.ts` — Worker Thread 入口:
```
parentPort.on('message', ({ patient, batchMode, realisticPatch, disableChronicCaps }) => {
  // 在独立线程中执行 SOAP 生成
  const result = generatePatientVisits(patient, batchMode, realisticPatch, disableChronicCaps)
  parentPort.postMessage(result)
})
```

`server/services/soap-worker-pool.ts` — 池管理:
- 维护 1 个 Worker Thread（稳妥起步，避免 PRNG 并发问题）
- 暴露 `generateBatchAsync(batch, options) → Promise<BatchGenerationResult>`
- 内部将整个 batch 序列化发给 Worker，Worker 执行完返回结果
- 超时保护: 60s 无响应则 terminate + reject

`server/routes/batch.ts` 改动:
- `POST /api/batch`: `generateMixedBatch(batch)` → `await generateBatchAsync(batch)`
- `POST /api/batch/json`: 同上
- `POST /api/batch/:batchId/generate`: 同上
- `PUT /api/batch/:batchId/visit/:patientIdx/:visitIdx`: 保持同步（单次生成，轻量）

**效果:** 生成期间事件循环畅通，GET 请求/状态查询不受影响
**测试:** Worker 生成结果与直接调用一致（snapshot 对比）
**验证:** 30 个 fixture snapshot 全部通过
**Commit:** `perf: offload SOAP generation to worker thread`

### Task 4: 请求队列 + 限流

**Files:**
- Create: `server/services/batch-queue.ts`
- Modify: `server/routes/batch.ts`
- Create: `server/services/__tests__/batch-queue.test.ts`

**改动要点:**

`server/services/batch-queue.ts`:
- 内存队列，最大并发 2 个生成任务（1 执行 + 1 排队）
- `enqueue(task) → Promise<Result>`: 排队等待执行
- 超出队列容量 → reject with 429 状态
- 每个任务带 batchId 标识，防止重复提交

路由层:
```typescript
router.post('/', upload.single('file'), async (req, res) => {
  // ... 解析逻辑不变 ...
  try {
    const result = await batchQueue.enqueue(() => generateBatchAsync(batchData, options))
    await saveBatch({ ...batchData, patients: result.patients })
    res.json({ success: true, data: { ... } })
  } catch (err) {
    if (err.code === 'QUEUE_FULL') {
      res.status(429).json({ success: false, error: 'Server busy, please retry later' })
      return
    }
    throw err
  }
})
```

**测试:** 并发 3 个请求 → 2 个执行 + 1 个 429
**验证:** `npm test`
**Commit:** `perf: add batch generation queue with concurrency limit`

### Task 5: AI 生成 Python 进程池

**Files:**
- Modify: `server/services/ai-generator.ts`

**改动要点:**
- 启动时预热 1 个 Python 子进程（stdin/stdout 通信，不是每次 spawn）
- 进程空闲 5 分钟后自动回收，下次请求时重新启动
- 超时 120s 不变
- fallback: 进程池失败时降级为当前的 per-request spawn

**测试:** AI 生成功能不变，第二次调用延迟显著降低
**Commit:** `perf: persistent Python process for AI generation`


---

## 方向二：Nginx 全面加固（运维工程师视角）

### 问题
- 无 gzip 压缩 — JSON 响应和 JS/CSS 未压缩，浪费带宽
- 安全 headers 在子 location 丢失 — `add_header` 在 `location = /` 和 `location /assets/` 中覆盖了 server 级 headers
- 无 proxy 超时 — Playwright 长任务可能导致 504
- 无 proxy buffer — 大 batch 响应可能超时
- 无 CSP header

### Task 6: Nginx 压缩 + 安全 headers 修复

**Files:**
- Modify: `frontend/nginx.conf`

**改动要点:**

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    # ── 压缩 ──
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # ── 安全 headers (用 map 或 include 确保所有 location 继承) ──
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self';" always;

    # HTML — no cache (注意: 不再用 add_header 覆盖安全 headers)
    location = / {
        expires -1;
        try_files /index.html =404;
    }

    # Assets — immutable cache
    location /assets/ {
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        # 重复安全 headers（nginx 子 location 覆盖问题）
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        try_files $uri =404;
    }

    # API proxy
    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        client_max_body_size 10m;

        # 超时: Playwright 自动化可能跑很久
        proxy_connect_timeout 10s;
        proxy_read_timeout 300s;
        proxy_send_timeout 60s;

        # Buffer: 大 batch 响应
        proxy_buffering on;
        proxy_buffer_size 16k;
        proxy_buffers 8 32k;
        proxy_busy_buffers_size 64k;
    }

    # SPA fallback
    location / {
        expires -1;
        try_files $uri $uri/ /index.html;
    }
}
```

**关键修复:**
1. 加 gzip — JSON/JS/CSS 压缩率 60-80%
2. 安全 headers 在 `/assets/` location 中重复声明（nginx 的 `add_header` 继承规则要求这样做）
3. HTML 缓存用 `expires -1` 替代 `add_header Cache-Control`，避免覆盖安全 headers
4. API proxy 加超时（read 300s 给 Playwright，connect 10s 快速失败）
5. API proxy 加 buffer 配置
6. 加 CSP header

**测试:** `docker compose up -d --build` 后:
- `curl -I https://rbmeds.com/ac/` 检查 gzip + 安全 headers
- `curl -I https://rbmeds.com/ac/assets/xxx.js` 检查 immutable + 安全 headers
- 大 batch 生成不超时

**Commit:** `perf: nginx gzip, security headers fix, proxy tuning`

---

## 方向三：Docker 资源治理（SRE 视角）

### 问题
- 无 CPU/内存限制 — Playwright 可能吃光 4 OCPU + 24GB
- 无日志轮转 — 日志无限增长
- 后端镜像 ~1GB 偏大
- entrypoint.sh 每次启动 chown -R

### Task 7: docker-compose 资源限制 + 日志

**Files:**
- Modify: `docker-compose.yml`

**改动要点:**

```yaml
services:
  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "9090:8080"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  backend:
    build:
      context: .
      dockerfile: server/Dockerfile
    expose:
      - "3001"
    volumes:
      - batch-data:/app/data
      - /home/ubuntu/vertex-sa-key.json:/app/vertex-sa-key.json:ro
    environment:
      - PORT=3001
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - API_KEY=${API_KEY:-}
      - COOKIE_ENCRYPTION_KEY=${COOKIE_ENCRYPTION_KEY:-}
      - CORS_ORIGIN=https://rbmeds.com
      - SHARED_JWT_SECRET=${SHARED_JWT_SECRET:-}
      - GOOGLE_APPLICATION_CREDENTIALS=/app/vertex-sa-key.json
      - VERTEX_PROJECT=tenfu-data-sync
      - VERTEX_LOCATION=us-central1
      - VERTEX_ENDPOINT=projects/625662508139/locations/us-central1/endpoints/4778460491884265472
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '3.0'
          memory: 8G
        reservations:
          cpus: '1.0'
          memory: 2G
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "5"

volumes:
  batch-data:
```

**资源分配逻辑 (4 OCPU / 24GB):**
- frontend (Nginx): 0.5 CPU / 512MB — 静态文件服务，极轻量
- backend (Node + Playwright + Python): 3.0 CPU / 8GB — 主力
- OS + Docker daemon: 0.5 CPU / ~15GB 剩余（含文件缓存）

**测试:** `docker compose up -d --build` → `docker stats` 确认限制生效
**Commit:** `ops: docker resource limits and log rotation`

### Task 8: 后端 Dockerfile 优化

**Files:**
- Modify: `server/Dockerfile`
- Create: `.dockerignore`

**改动要点:**

`.dockerignore`:
```
node_modules
.git
.worktrees
.claude-state
coverage
frontend/node_modules
frontend/dist
*.md
docs/
tests/
scripts/run-*
scripts/debug-*
scripts/stress-*
```

`server/Dockerfile` 优化:
1. 分离 COPY 层: 先 `COPY package*.json` → `npm ci` → 再 COPY 源码（利用层缓存）
2. entrypoint.sh: 去掉 `chown -R`，在 Dockerfile 中一次性设置好权限
3. 多阶段构建: 编译阶段装 devDependencies，运行阶段只保留 production

**测试:** `docker build` 成功 + `docker compose up` 正常运行
**Commit:** `ops: optimize backend Dockerfile layers and .dockerignore`

### Task 9: entrypoint.sh 优化

**Files:**
- Modify: `server/entrypoint.sh`

**改动:**
```sh
#!/bin/sh
# 只检查 data 目录权限，不递归 chown
if [ ! -w /app/data ]; then
  chown appuser:appgroup /app/data
fi
exec su -s /bin/sh appuser -c "node --max-old-space-size=4096 -r tsx/esm server/index.ts"
```

改动点:
1. 去掉 `chown -R`（Dockerfile 已设置权限），只检查顶层目录
2. `npx tsx` → `node -r tsx/esm`（省去 npx 查找开销）
3. 加 `--max-old-space-size=4096`（给 Node 4GB 堆内存，匹配 Docker 8GB 限制）

**Commit:** `ops: optimize entrypoint startup`

---

## 方向四：前端性能优化（前端工程师视角）

### 问题
- 3 个 CPU 密集引擎函数在浏览器主线程同步执行，无 Web Worker
- BatchView.vue 1827 行，大量 DOM 渲染
- WriterPanel.vue 1113 行，12 个笔记 × SOAP 4 section × diff 高亮
- 无虚拟滚动，大批量结果一次性渲染

### Task 10: SOAP 生成引擎 Web Worker 化

**Files:**
- Create: `frontend/src/workers/soap-engine.worker.ts`
- Create: `frontend/src/services/soap-worker-bridge.ts`
- Modify: `frontend/src/composables/useSOAPGeneration.ts`

**改动要点:**

`frontend/src/workers/soap-engine.worker.ts`:
```typescript
// Web Worker 入口 — 在独立线程中执行 SOAP 生成
import { generateTXSequenceStates } from '../../../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../../../src/generator/soap-generator'
import { patchSOAPText } from '../../../src/generator/objective-patch'
import { normalizeGenerationContext } from '../../../src/shared/normalize-generation-context'

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data
  if (type === 'generate') {
    const { input, txCount, seed, realisticPatch } = payload
    const { context, initialState } = normalizeGenerationContext(input)
    const states = generateTXSequenceStates(context, { txCount, seed, initialState })
    const notes = states.map(state => {
      let text = exportSOAPAsText(context)
      if (realisticPatch) text = patchSOAPText(text, context, state)
      return { text, state }
    })
    self.postMessage({ type: 'result', notes })
  }
}
```

`frontend/src/services/soap-worker-bridge.ts`:
```typescript
// 主线程桥接 — 封装 Worker 通信为 Promise
let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/soap-engine.worker.ts', import.meta.url),
      { type: 'module' }
    )
  }
  return worker
}

export function generateInWorker(payload: GeneratePayload): Promise<GenerateResult> {
  return new Promise((resolve, reject) => {
    const w = getWorker()
    const timeout = setTimeout(() => reject(new Error('Worker timeout')), 30000)
    w.onmessage = (e) => {
      clearTimeout(timeout)
      resolve(e.data.notes)
    }
    w.onerror = (e) => {
      clearTimeout(timeout)
      reject(e)
    }
    w.postMessage({ type: 'generate', payload })
  })
}

export function terminateWorker(): void {
  worker?.terminate()
  worker = null
}
```

`useSOAPGeneration.ts` 改动:
- `generate()` 从同步改异步: `async generate()`
- 内部调用 `await generateInWorker(payload)` 替代直接调用引擎
- 加 `isGenerating` ref 状态 + loading UI
- fallback: Worker 失败时降级为主线程同步执行

**效果:** 生成期间 UI 不卡顿，用户可以继续操作
**测试:** 生成结果与主线程一致（snapshot 对比）
**Commit:** `perf: offload SOAP generation to Web Worker`

### Task 11: PDF 解析 Web Worker 化

**Files:**
- Create: `frontend/src/workers/checker.worker.ts`
- Modify: `frontend/src/services/checker.js`

**改动要点:**
- `parseOptumNote` + `checkDocument` 移入 Web Worker
- checker.js 改为 Worker 桥接模式
- 与 Task 10 相同的 Promise 封装模式

**Commit:** `perf: offload PDF parsing to Web Worker`

### Task 12: BatchView 组件拆分

**Files:**
- Create: `frontend/src/components/batch/BatchUploader.vue`
- Create: `frontend/src/components/batch/PatientEditor.vue`
- Create: `frontend/src/components/batch/BatchResults.vue`
- Create: `frontend/src/components/batch/AutomationPanel.vue`
- Create: `frontend/src/composables/useBatchState.ts`
- Modify: `frontend/src/views/BatchView.vue`

**拆分策略:**
1. `BatchUploader.vue` — Excel 上传 + 粘贴解析 (~200 行)
2. `PatientEditor.vue` — 单患者编辑表单 (~300 行)
3. `BatchResults.vue` — SOAP 结果预览 + diff (~400 行)
4. `AutomationPanel.vue` — MDLand 提交 + 状态轮询 (~300 行)
5. `useBatchState.ts` — 共享状态 composable (~200 行)
6. `BatchView.vue` — 容器组件，组装以上子组件 (~200 行)

**每个子组件 < 400 行，总计 ~1600 行（功能不变，结构清晰）**

**测试:** 前端 vitest 通过 + 手动验证所有功能
**Commit:** `refactor: split BatchView into focused sub-components`

### Task 13: WriterPanel 组件拆分

**Files:**
- Create: `frontend/src/components/composer/FieldEditor.vue`
- Create: `frontend/src/components/composer/NotePreview.vue`
- Create: `frontend/src/components/composer/NoteList.vue`
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**拆分策略:**
1. `FieldEditor.vue` — 字段编辑区域 (~350 行)
2. `NotePreview.vue` — 单个 SOAP 笔记预览 + 复制 (~250 行)
3. `NoteList.vue` — 笔记列表 + diff 高亮 (~300 行)
4. `WriterPanel.vue` — 容器 (~200 行)

**Commit:** `refactor: split WriterPanel into focused sub-components`

### Task 14: 大列表虚拟滚动

**Files:**
- Modify: `frontend/src/components/batch/BatchResults.vue` (Task 12 产出)

**改动要点:**
- 批量结果列表（可能 50+ 患者 × 12 visits = 600 条）使用 CSS `content-visibility: auto` + `contain-intrinsic-size`
- 不引入第三方虚拟滚动库（YAGNI），用原生 CSS containment
- 折叠默认关闭，只展开当前查看的患者

```css
.patient-card {
  content-visibility: auto;
  contain-intrinsic-size: 0 200px;
}
```

**效果:** 600 条结果页面不卡顿
**Commit:** `perf: CSS containment for batch results list`

---

## 方向五：Bug 修复 + 安全加固（安全工程师 + QA 视角）

### 问题
- generateContinueBatch totalGenerated 双倍计数 (BUG-001)
- requireAuth 在 API_KEY 未设置时放行 (SEC-001)
- nginx 安全 headers 子 location 丢失 (SEC-002, 已在 Task 6 修复)
- 无 CSP header (SEC-003, 已在 Task 6 修复)
- 4 处 console.error 残留
- 死代码: normalizer.js, HistoryView.vue, @vueuse/core

### Task 15: 修复 generateContinueBatch 双倍计数

**Files:**
- Modify: `server/services/batch-generator.ts:231-250`
- Create: `server/services/__tests__/batch-generator-count.test.ts`

**改动要点:**

删除第 247-250 行的二次计数循环:
```typescript
// 删除这段:
// for (const v of updatedVisits) {
//   if (v.status === 'done') totalGenerated++
//   else if (v.status === 'failed') totalFailed++
// }
```

只保留 `txVisits.map` 内的计数（第 234-237 行）。

**测试:**
```typescript
test('generateContinueBatch counts correctly', () => {
  const batch = createMockContinueBatch(3) // 3 TX visits
  const result = generateContinueBatch(batch)
  expect(result.totalGenerated).toBe(3) // 不是 6
})
```

**Commit:** `fix: generateContinueBatch double-counting totalGenerated`

### Task 16: requireAuth 安全加固

**Files:**
- Modify: `server/index.ts:40-45`
- Create: `server/__tests__/auth.test.ts`

**改动要点:**

```typescript
// 修改前 (不安全):
const apiKey = process.env.API_KEY
if (!apiKey) {
  next()  // ⚠️ 无 API_KEY 时直接放行
  return
}

// 修改后 (安全):
const apiKey = process.env.API_KEY
if (!apiKey) {
  // 生产环境无 API_KEY 且无有效 JWT → 拒绝
  // 开发环境保持放行
  if (process.env.NODE_ENV === 'production') {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return
  }
  next()
  return
}
```

**逻辑:** 生产环境必须通过 JWT 或 API_KEY 之一认证。开发环境保持宽松。

**测试:**
```typescript
describe('requireAuth', () => {
  test('production: rejects when no JWT and no API_KEY', () => { ... })
  test('production: allows valid JWT even without API_KEY', () => { ... })
  test('development: allows without any auth', () => { ... })
})
```

**Commit:** `fix: requireAuth reject unauthenticated in production`

### Task 17: 清理 console.error + 死代码

**Files:**
- Modify: `frontend/src/stores/files.js` (2 处 console.error)
- Modify: `frontend/src/composables/useHistory.js` (1 处 console.error)
- Modify: `frontend/src/components/TrendChart.vue` (1 处 console.error)
- Delete: `frontend/src/services/normalizer.js`
- Delete: `frontend/src/views/HistoryView.vue`
- Modify: `frontend/package.json` (移除 @vueuse/core)

**改动要点:**
- `console.error` → 静默处理或 throw（视上下文）
- 删除 3 个死代码文件/依赖
- 确认无其他文件引用被删除的模块

**验证:** `cd frontend && npm test` + `npm run build` 无报错
**Commit:** `chore: remove dead code and console.error statements`

### Task 18: template-rule-whitelist 路径修复

**Files:**
- Modify: `src/parser/template-rule-whitelist.ts:11`

**改动要点:**
```typescript
// 修改前:
const TEMPLATE_ROOT = '/Users/ping/Desktop/Code/2_8/templete'

// 修改后:
const TEMPLATE_ROOT = process.env.TEMPLATE_ROOT
  || path.resolve(__dirname, '../../parsers/optum-note/templates')
```

**注意:** 此文件只在 Node.js 环境使用（测试 + 脚本），前端用 `.browser.ts` 版本。
确认 `parsers/optum-note/templates/` 目录存在且包含模板文件。

**测试:** `npm test` — 涉及 whitelist 的测试通过
**Commit:** `fix: remove hardcoded template path`

---

## 方向六：自动化稳定性（可靠性工程师视角）

### 问题
- Playwright 自动化全局单例锁，第二个用户必须等
- 无自动化任务持久化，进程重启丢失状态
- mdland-automation.ts 1421 行，难以维护
- 无重试队列

### Task 19: 自动化任务队列

**Files:**
- Create: `server/services/automation-queue.ts`
- Modify: `server/services/automation-runner.ts`
- Modify: `server/routes/automate.ts`
- Create: `server/services/__tests__/automation-queue.test.ts`

**改动要点:**

`server/services/automation-queue.ts`:
```typescript
interface QueuedJob {
  readonly batchId: string
  readonly apiBase: string
  readonly queuedAt: string
  readonly status: 'queued' | 'running' | 'done' | 'failed'
}

// 内存队列，最大 5 个排队
const queue: QueuedJob[] = []
const MAX_QUEUE = 5

export function enqueueAutomation(batchId: string, apiBase: string): QueuedJob {
  if (queue.length >= MAX_QUEUE) {
    throw Object.assign(new Error('Automation queue full'), { code: 'QUEUE_FULL' })
  }
  const job: QueuedJob = { batchId, apiBase, queuedAt: new Date().toISOString(), status: 'queued' }
  queue.push(job)
  processNext() // 如果没有正在运行的，立即开始
  return job
}

async function processNext(): Promise<void> {
  if (isRunning()) return // 已有任务在跑
  const next = queue.find(j => j.status === 'queued')
  if (!next) return
  next.status = 'running'
  startAutomation(next.batchId, next.apiBase)
  // 监听完成事件，完成后处理下一个
}

export function getQueueStatus(): readonly QueuedJob[] {
  return [...queue]
}
```

路由改动:
```typescript
// POST /api/automate/:batchId
// 修改前: isRunning() → 409
// 修改后: enqueueAutomation() → 返回队列位置
```

**效果:** 多用户提交自动化任务不再 409，而是排队执行
**测试:** 提交 3 个任务 → 第 1 个执行，第 2-3 个排队
**Commit:** `feat: automation job queue with sequential execution`

### Task 20: 自动化任务状态持久化

**Files:**
- Modify: `server/services/automation-runner.ts`

**改动要点:**
- `currentJob` 状态变更时写入 `DATA_DIR/automation-status.json`
- 进程重启时从文件恢复状态（标记为 failed + 原因 "process restarted"）
- 使用 async 文件 I/O（Task 2 已完成异步化基础）

**Commit:** `feat: persist automation job status across restarts`

---

## 执行顺序和依赖关系

```
Phase 1: 基础加固（零风险，可立即部署）
  Task 15: 修复双倍计数 bug
  Task 16: requireAuth 安全加固
  Task 17: 清理死代码
  Task 18: 修复硬编码路径
  Task 6:  Nginx 加固
  Task 7:  Docker 资源限制
  Task 8:  Dockerfile 优化
  Task 9:  entrypoint 优化

Phase 2: 后端异步化（低风险，接口签名变更）
  Task 1:  batch-store 异步化
  Task 2:  automation-runner 异步化
  → 依赖: 所有路由 handler 加 await

Phase 3: CPU 卸载（中风险，需要 snapshot 验证）
  Task 3:  SOAP 生成 Worker Thread
  Task 4:  请求队列 + 限流
  Task 5:  AI 生成 Python 进程池
  → 依赖: Phase 2 完成

Phase 4: 前端优化（独立于后端，可并行）
  Task 10: SOAP 生成 Web Worker
  Task 11: PDF 解析 Web Worker
  Task 12: BatchView 拆分
  Task 13: WriterPanel 拆分
  Task 14: 虚拟滚动

Phase 5: 自动化增强（依赖 Phase 2）
  Task 19: 自动化任务队列
  Task 20: 状态持久化
```

## 预期效果总结

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 大批量生成期间其他请求 | 全部排队阻塞 | 正常响应 (<100ms) |
| 50 患者 × 12 visits 生成 | ~10s 阻塞主线程 | ~10s Worker Thread (主线程畅通) |
| 并发生成请求 | 串行 | 队列管理，最多 2 并发 |
| Playwright 自动化 | 单例锁 409 | 队列排队执行 |
| 前端 SOAP 生成 | UI 冻结数百毫秒 | Web Worker 异步，UI 流畅 |
| Nginx 响应大小 | 未压缩 | gzip 压缩 60-80% |
| Docker 资源 | 无限制 | CPU/内存硬限 + 日志轮转 |
| 安全 headers | 子 location 丢失 | 全路径覆盖 + CSP |
| API 认证 | 空 API_KEY 放行 | 生产环境强制认证 |

## 风险评估

| Task | 风险 | 回滚方案 |
|------|------|---------|
| 1-2 (异步化) | 低 — 接口签名变更，编译器会捕获遗漏 | git revert |
| 3 (Worker Thread) | 中 — 序列化/反序列化开销，需验证 snapshot | 保留同步 fallback |
| 6 (Nginx) | 低 — 配置错误会导致 502 | 保留旧 nginx.conf 备份 |
| 7 (Docker limits) | 低 — 限制过紧会 OOM kill | 调整数值 |
| 10-11 (Web Worker) | 中 — Vite Worker 打包配置 | 保留主线程 fallback |
| 12-13 (组件拆分) | 低 — 纯重构，功能不变 | git revert |
| 19 (自动化队列) | 中 — 队列状态管理 | 保留单例模式 fallback |
