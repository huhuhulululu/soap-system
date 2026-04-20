# SOAP System — Architecture Diagnosis

> Generated 2026-04-19 by architect agent. Source of decisions for the upcoming refactor.

## 1. Hot Spots (TOP 20 by LOC)

| # | File | LOC | Flag |
|---|------|----|------|
| 1 | `src/generator/soap-generator.ts` | **3120+** (实测 2885) | 🔴 |
| 2 | `src/generator/tx-sequence-engine.ts` | **2029** | 🔴 CLAUDE.md 声称 1221，偏差 66% |
| 3 | `parsers/optum-note/checker/note-checker.ts` | **1962** | 🔴 |
| 4 | `src/shared/template-options.ts` | **1932** | 🔴 ARCHITECTURE.md §3.2 未列 |
| 5 | `frontend/src/views/BatchView.vue` | **1673** | 🔴 单 SFC 115 个顶层声明 |
| 6 | `scripts/playwright/mdland-automation.ts` | **1203** | 🔴 生产代码藏在 scripts/ |
| 7 | `src/generator/objective-patch.ts` | **1094** | 🔴 |
| 8 | `frontend/src/components/composer/WriterPanel.vue` | **1035** | 🔴 |
| 9 | `parsers/optum-note/parser.ts` | **948** | 🔴 |
| 10 | `src/shared/soap-constraints.ts` | 520 | 🟡 |
| 11 | `src/generator/goal-path-calculator.ts` | 503 | 🟡 |
| 12 | `frontend/src/components/ReportPanel.vue` | 473 | 🟡 |
| 13 | `server/services/batch-generator.ts` | 457 | 🟡 |
| 14 | `server/services/excel-parser.ts` | 445 | 🟡 |
| 15 | `frontend/src/components/TrendChart.vue` | 434 | 🟡 |
| 16 | `src/knowledge/tcm-patterns.ts` | 432 | 🟡 |
| 17 | `src/parser/rule-engine.ts` | 419 | 🟡 |
| 18 | `server/routes/batch.ts` | 406 | 🟡 |
| 19 | `src/auditor/layer1/index.ts` | 399 | 🟡 |
| 20 | `src/generator/weight-integration.ts` | 390 | 🟡 |

**复杂度热点**：
- `tx-sequence-engine.ts::generateTXSequenceStates` 行 834–2029 = 单函数 **~1200 LOC**，163 个分支 token。CLAUDE.md 警告的 PRNG 敏感区。
- `soap-generator.ts::generateObjective` 530 LOC、`generateNeedleProtocol` 430 LOC、`generateSubjectiveTX` 257 LOC。
- `BatchView.vue` — 单 SFC 115 个声明（ref/computed/function/watcher）。

## 2. 文档/代码偏差（ARCHITECTURE.md v2.4.0 vs 实际）

1. **`src/shared/template-options.ts` (1932 LOC) 未在 §3.2 列出** — 是最大的 shared 文件，被 `soap-generator`/`tx-sequence-engine` 依赖。
2. **`src/auditor/layer1/index.ts:31-36` 顶层 `fs.readFileSync` 用 cwd-相对路径** — 文档称 auditor "独立"，实际不是 browser-safe 且 cwd 变动即崩。
3. **CLAUDE.md 说 `tx-sequence-engine.ts` 1221 LOC，实际 2029 LOC**（偏差 66%）。
4. **新增文件未入文档**：`server/services/bill-matcher.ts`、`server/services/bill-list-parser.ts`（近期 Bill reconciliation feature）。
5. **手写 CSRF** (`server/index.ts:75-98`) — 用 `===` 字符串比较非 `timingSafeEqual`，文档未提及 custom 实现。
6. **已确认循环依赖**：`tx-sequence-engine.ts:17` 从 `./soap-generator` 导入 `objectiveMuscleSeed`；`soap-generator.ts:24-27` 从 `./tx-sequence-engine` 导入 `generateTXSequenceStates` 等。文档依赖图未标。

## 3. 技术债 TOP 10

| # | 位置 | 问题 | 影响 | 成本 | 收益 |
|---|------|------|------|------|------|
| 1 | `tx-sequence-engine.ts:834-2029` | 单函数 ~1200 LOC，多个 rolling state 耦合 | 测试脆弱、PRNG 一动全错 | L | L |
| 2 | `soap-generator.ts` 3000+ LOC | 渲染+常量+文本辅助混合；与 tx-sequence 双向循环 | 导入循环、编译慢 | L | L |
| 3 | `src/auditor/layer1/index.ts:31-36` | 顶层 cwd-相对 fs.readFileSync | Docker/worker/非根 cwd 启动即崩 | S | M |
| 4 | 10 个 `* 2.{ts,js,vue}` 重复文件 | macOS Finder 重复已入 git；`soap-engine.worker 2.ts` 与原文件字节相同 | 构建混乱、潜在静默分叉 | S | M |
| 5 | `shared/` 单一真相源违规 | BODY_PART_* 在 ≥8 处重定义；`severity()` 多处复制 | 改一个常量要动 8 文件 | M | L |
| 6 | `server/index.ts:75-98` 手写 CSRF | 字符串 `===` 非 timing-safe，无 HMAC 无轮转 | 时间旁路理论可能 | S | M |
| 7 | `BatchView.vue` 1673 LOC | 上传/JSON/Review/Confirm/Automate/Bill 全塞一个 SFC | 难拆难测难优化 | M | L |
| 8 | `WriterPanel.vue` 1035 LOC + `../../../../src/` 四层相对导入 | 移文件即炸 | M | M |
| 9 | `note-checker.ts` 1962 LOC 单文件规则引擎 | 高变动、仅 154 LOC 冒烟测试 | M | L |
| 10 | CSP 允许 `cdn.jsdelivr.net` (pdfjs worker) | CDN 被攻破 = 医疗工具 XSS | S | M |

## 4. 耦合与重复

### 模块依赖图验证
- ✅ `types`/`knowledge`/`shared` 层仍成立
- 🔴 **确认循环**：`tx-sequence-engine.ts` ↔ `soap-generator.ts` 双向导入
- ⚠️ `shared/tcm-mappings.ts` → `knowledge/tcm-patterns.ts` 是反向依赖（shared 本应是叶）
- ⚠️ `auditor` 编译期独立，运行期依赖 `src/auditor/baselines/*.json` 文件

### 单一真相源违规（grep 证据）
| 概念 | 正源 | 重复位置 |
|------|------|----------|
| BODY_PART_* | `src/shared/body-part-constants.ts` | `soap-generator.ts` x4、`tx-extractor.ts`、`medical-history-engine.ts`、`excel-parser.ts` x2、`writer-constants.ts` x2、fixtures x4、`checker/bridge.ts` |
| `severity(pain)` | `src/shared/severity.ts` | `fixture-data.ts:32`、`parity-diff.test.ts:33`、`tx-sequence-engine.ts` 内联、`objective-patch.ts`、`tx-extractor.ts`、`correction-generator.ts`、`WriterPanel.vue` |
| 频率等级 | `src/shared/field-parsers.ts::parseFrequencyLevel` | `tx-sequence-engine.ts:907-920` 内联 4-项数组 |

## 5. 测试脆弱性

### 30 Snapshot 覆盖
- ✅ 7 部位 × 3 阶段 = 21 core + 9 edge
- ❌ **IE 笔记无 snapshot**（只测 TX 序列）
- ❌ **所有 fixture 硬编码 OPTUM** — HF/WC/VC/ELDERPLAN/NONE 分支无覆盖
- ❌ **`noteType: 'RE'` 零覆盖**
- ❌ **Multi-bodypart 组合无 snapshot**
- ❌ **`continue` 模式** (`startVisitIndex > 1`) 零 fixture
- ❌ **Demographics** (age/gender) 零 fixture，但 `filterADLByDemographics` 依赖它

### 零单元测试模块
- `src/auditor/*` — **全模块 0 测试**
- `src/shared/normalize-generation-context.ts` (195 LOC, parity 核心) 无直接测试
- `frontend/src/views/*` 无组件级测试
- `scripts/playwright/mdland-automation.ts` (1203 LOC, 生产) 无测试
- `parsers/optum-note/checker/correction-generator.ts` (383 LOC) 无测试

### PRNG 保护
- ✅ Snapshot red line + CLAUDE.md 警告 + seeded-rng 可复现
- ❌ 无 CI gate 拒绝 snapshot 变更
- ❌ 无 property-based 测试（如"pain 单调下降"）
- `muscle-selector` 已被迫用独立 seed 绕开主序列 — 说明问题真实发生过

## 6. 重构路线三档

### Tier A — 保守（1-2 周，snapshot 全绿）

**不做**：不动 `generateTXSequenceStates` 内部、不改 rng 调用顺序

**动作**：
1. 删除 10 个 `* 2.{ts,js,vue}` 重复文件 + `.gitignore` 加 ` 2.*` 规则
2. 修 `src/auditor/layer1/index.ts` 的顶层 cwd-相对 fs.readFileSync（改懒加载 + `path.join(__dirname, ...)`）
3. 从 `soap-generator.ts` 抽常量到 `src/shared/body-part-constants.ts`，re-export 保路径兼容
4. 合并重复 `severity()` helper 到 `src/shared/severity.ts`
5. 补文档：template-options.ts、bill-*、循环依赖、tx-sequence LOC 修正
6. 自托管 pdfjs worker → CSP 移除 cdn.jsdelivr.net

**风险**：低；snapshot 不变

---

### Tier B — 标准（~1 月，允许行为小改 + 新验收标准）

**不做**：不引数据库、不重写 note-checker、不迁前端状态管理

**动作**：
1. **拆 `tx-sequence-engine.ts`** 按 sub-engine（pain/tightness/tenderness/spasm/ROM/reason/symptom-chain）；每个 sub-engine 用 sub-seed 派生（muscle-selector 已验证的模式）；snapshot 故意重录一次，新验收："每个 sub-engine 可独立 fuzz 测试"
2. **拆 `soap-generator.ts`** → `renderers/{subjective,objective,assessment,plan,needle}.ts` + `export.ts`；把 `objectiveMuscleSeed` 挪到 `src/shared/` 断开双向循环
3. 手写 CSRF → `csrf-csrf` 库（HMAC + 双提交）
4. 加 property-based 测试（`fast-check`）：pain 单调、ROM floor 单调、ICD 跨 visit 稳定、pattern 一致
5. 拆 `BatchView.vue` → Upload/Review/Confirm/Automate/JSON editor 子组件
6. auditor 补冒烟测试
7. 加路径别名（`@src/*`, `@shared/*`）消灭 `../../../../`

**风险**：中；PRNG 重 seed 需一次性重录全 30 snapshot，之后严格守护

---

### Tier C — 激进（2-3 月，技术栈可变）

**不做**：不拆微服务、不换框架

**动作**：
1. 引 **SQLite (better-sqlite3)** 替 `batch-store.ts` LRU+JSON — 支持并发 batch、索引、事务、MDLand 提交 ledger（对齐非幂等约束）
2. 把 `scripts/playwright/mdland-automation.ts` 提升为 `server/automation/` 正式模块 + 单测
3. `note-checker.ts` 重写为规则注册表：1962 LOC → ~40 rule 文件 × ≤100 LOC，每条带测试
4. 前端残余 `.js` 迁 TS
5. E2E 测试框架覆盖 full/soap-only/continue（MDLand mock）
6. tsx 运行时 → esbuild 编译步骤 + CI 严格类型检查
7. 可观测性：pino 结构化日志 + 批次指标

**风险**：高；涉及 DB 迁移、worker 布局、部署脚本

## 7. 推荐

**先做 Tier A，紧接着执行 Tier B 第 1 步（拆 tx-sequence-engine）。**

理由：债务集中在两处 — (1) 两个 monolith 文件共计 ~5K LOC PRNG 敏感逻辑；(2) "单一真相源" 被违反 ≥8 处。Tier A 低风险清理重复 + 补文档偏差；Tier B 第 1 步用一次定向 snapshot 重录偿还 PRNG 脆性。Tier C 等 MDLand 提交规模化之后再做，现在过早。
