# SOAP System — 1 Month Roadmap

> 制定日期: 2026-04-20
> 约束: 1 个月工期，兼顾可维护性
> 首要目标: 让 SOAP 引擎随时可改不痛
>
> 基于: `docs/archive/tier-b-step-1-refactor-2026-04-19/architecture-diagnosis.md`
> 既有交付: Tier A + Tier B step 1（2026-04-19，`clean-release` branch, commits c961766..317d07a）

---

## 设计原则

围绕"**改引擎不痛**"重排优先级。以下三个属性是"改一次引擎"的真正成本：

1. **改一个 sub-engine 不会影响其他 sub-engine 的 PRNG 流** → sub-seed 运行时接入（Tier B step 2）
2. **改一个渲染分支不会牵动其他分支** → 拆 `soap-generator.ts`（Tier B step 3）
3. **改一条规则不会牵动其他规则** → `note-checker.ts` 规则注册表（Phase 4）

其他工作（前端拆分、基础设施、CI/CD）**本月不做** — 不在引擎迭代路径上。

---

## Week 1：部署 + 安全网扩容

**目标**: Tier A + B1 成果上生产；snapshot + fuzz 安全网扩到支撑频繁改动。

**预算**: ~85 tool calls + 30 min 你部署操作

| # | 任务 | tc | 备注 |
|---|------|----|------|
| W1.1 | Playwright PDF smoke 自动化 → 关 `pdf_smoke_signoff` gate | 20 | dev + preview 两环境 |
| W1.2 | `git push origin clean-release` + Oracle Cloud docker compose 部署 | 2 + 你 30 min | 生产变更，需你确认 |
| W1.3 | snapshot 盲区补齐：IE 笔记、RE note、continue 模式、multi-bodypart、demographics (age/gender)、HF/WC/VC/ELDERPLAN 保险 — 从 30 fixture 扩到 ~55 | 30 | 定向扩展，非重录 |
| W1.4 | fuzz property 从 6 条扩到 15 条：sub-engine 独立性、reason 轮换覆盖、needle group 首访冻结、ADL 单调、strength ladder 严格增等 | 15 | 为 W2 做准备 |
| W1.5 | 补 `normalize-generation-context.ts` 单测（195 LOC, 0 直接测试） | 10 | parity 核心，必测 |
| W1.6 | 补 `output-validator.ts` 规则分支测试 | 8 | |

### 退出条件
- 生产可用 `/ac/` + batch 全流程测通
- 安全网密度: 改任意 rng() 位置必然至少触发 1 个 snapshot 或 fuzz 失败
- 「要频繁改」的模块（tx-sequence stages / normalize / validator）都有单测

---

## Week 2：Tier B step 2 — sub-seed 运行时接入

**这是可维护性的关键基石**。完成后，改 pain 算法不会影响 muscles/rom/reason/symptom 的 PRNG。

**预算**: ~120 tc + 你 1 hr snapshot 人审

| # | 任务 | tc | 备注 |
|---|------|----|------|
| W2.1 | 每个 stage 在起始用 `deriveSubSeed(mainSeed, kind, visitIndex)` 创建独立 rng | 40 | 基础接入 |
| W2.2 | 原 `consts.rng` 调用点改为对应 stage 的 sub-rng；保留必要的占位 `rng()` 以便未来小改动不再牵动整体 | 30 | 细节调整 |
| W2.3 | 一次定向 snapshot 重录（30 → 55 fixture 全变） | 3 | 预期行为变 |
| W2.4 | 16 固定 fixture 人审签字 | 3 + 你 1 hr | 硬 APPROVE gate |
| W2.5 | 新增 property：每 sub-engine 独立 seed 空间 collision-free；换一个 sub-engine 的 seed 不影响其他 sub-engine 输出 | 20 | 证明独立性 |
| W2.6 | 更新 `docs/archive/tier-b-step-1-refactor-2026-04-19/tx-engine-state-flow.md` 标注 sub-seed 接入位置；新增 ADR（D42+）到 `docs/decisions.md` | 10 | 文档同步 |
| W2.7 | 回归：snapshot 对照 + 全测试套 + 手动 batch 生成对比样本 | 10 | 尾巴验证 |

### 退出条件
- 改 pain sub-engine 算法后，muscles/rom/reason/symptom 的 snapshot 不变（可通过 mutation test 证明）
- fuzz property 能直接证明 sub-engine 独立
- 所有 manual gates approved
- `ARCHITECTURE.md` 新增一条 "已知技术债已消除" 记录

---

## Week 3：Tier B step 3 — 拆 `soap-generator.ts`

3156 LOC 巨怪拆成 `src/generator/renderers/*.ts`。每个 renderer 独立文件独立测试。

**预算**: ~170 tc + 你 30 min 定向 review

| # | 任务 | tc | 备注 |
|---|------|----|------|
| W3.1 | 扫描 `soap-generator.ts` 结构，写 `renderer-layout.md`（类似 B1.1 state map）；识别 renderer 边界 | 20 | B1.1 同样的方法论 |
| W3.2 | 抽 `LATERALITY_NAMES`、`TONE_MAP`、`ASSOCIATED_SYMPTOMS_MAP`、`SYMPTOM_SCALE_MAP`、`CAUSATIVE_CONNECTOR_MAP`、`NOT_IMPROVED_MAP`、`TENDERNESS_LABEL_MAP`、`INSPECTION_DEFAULT_MAP` 到 `src/shared/soap-narrative-maps.ts` | 15 | 消除重复 |
| W3.3 | `renderers/subjective-ie.ts` — 提取 `generateSubjective`（IE） | 25 | |
| W3.4 | `renderers/subjective-tx.ts` — 提取 `generateSubjectiveTX` | 20 | |
| W3.5 | `renderers/objective.ts` — 提取 `generateObjective`（530 LOC） | 30 | 最大块 |
| W3.6 | `renderers/assessment.ts` + `renderers/plan.ts` | 20 | |
| W3.7 | `renderers/needle-protocol.ts`（430 LOC） | 20 | |
| W3.8 | `renderers/export.ts` — `exportSOAP` 编排器 | 15 | |
| W3.9 | `soap-generator.ts` 瘦身到 ≤300 LOC（仅 re-export + 外部契约 + 类型） | 5 | |

### 退出条件
- 没有 800+ LOC 文件（除 `template-options.ts` 数据文件）
- 每个 renderer 可独立读，修改范围 ≤1 文件
- snapshot 0 diff 或定向 diff（根据是否改动实际输出；按计划是结构切分，应 0 diff）
- 每个 renderer 至少 1 个单测覆盖快速 path

---

## Week 4：note-checker 规则注册表 + 稳定性尾单

让**加规则 = 加一个文件**。

**预算**: ~180 tc + 你 30 min review

| # | 任务 | tc | 备注 |
|---|------|----|------|
| W4.1 | `parsers/optum-note/checker/rules/` 目录结构；设计 `Rule` 接口 + registry | 10 | |
| W4.2 | 拆 `note-checker.ts` 1962 LOC → 逐规则迁到 `rules/*.ts`（~40 规则文件 × ≤80 LOC） | 90 | 最大块 |
| W4.3 | `note-checker.ts` 瘦身为 registry + orchestrator（≤200 LOC） | 15 | |
| W4.4 | 每规则加单测 | 40 | TDD 纪律 |
| W4.5 | 替换手写 CSRF → `csrf-csrf` 库（HMAC + double-submit） | 15 | `server/index.ts:75-98` |
| W4.6 | `correction-generator.ts` smoke tests（383 LOC, 0 coverage） | 10 | |

### 退出条件
- `parsers/optum-note/checker/` 没有 500+ LOC 文件
- 加一条规则 = 新建 `rules/new-rule.ts` + `__tests__/new-rule.test.ts` + 在 `rules/index.ts` 注册一行
- 所有现有 checker smoke test 不变
- 生产无手写 CSRF 比较

---

## 长期迭代工作流（本月之后）

### 改引擎算法（最常见）
1. 读对应 `stages/stageN-*.ts` 或 `renderers/xxx.ts` — 只 1-2 文件
2. 写/改对应 fuzz property 捕获新不变量（TDD RED）
3. 改代码（GREEN）
4. 跑测试：snapshot 要么不动要么 1-2 个定向变化
5. 若 snapshot 变，用户审相关 1-2 个样本
6. commit，自动跑 CI（若后续建设）

### 加新规则
1. 新建 `parsers/optum-note/checker/rules/new-rule.ts`
2. 新建 `__tests__/new-rule.test.ts`
3. `rules/index.ts` 注册一行
4. 其他文件**不动**

### 加新渲染分支（保险类型 / 新 body part / 新诊断模式）
1. 改对应 `renderers/xxx.ts` 一个文件
2. 加对应 fixture 到 `fixture-data.ts`
3. snapshot 生成新分支

### 调 sub-engine 内部算法（pain 曲线 / tightness 节奏）
1. 改对应 `stages/stageN-*.ts` 一个文件
2. 该 sub-engine 的 snapshot 变、其他 sub-engine 不动（W2 后的保证）
3. 人审变动样本

---

## 明确**不做**的（本月内）

| 方案 | 理由 |
|------|------|
| 拆 `BatchView.vue` / `WriterPanel.vue` | 前端可维护性 ≠ 引擎可维护性；你要频繁改的是引擎 |
| SQLite 替 JSON | 当前规模 LRU + JSON 能撑；引入 DB 是工程分散 |
| 迁 `scripts/playwright/mdland-automation.ts` 到 `server/automation/` | 不影响引擎迭代 |
| CI/CD 建设（GitHub Actions） | 单人开发，本地 `npm test` 够用；团队扩展时再做 |
| 前端 `.js` → `.ts` 全迁移 | 边际；只在改 `.js` 时顺带迁 |
| 结构化日志 / 监控 / metrics | 单服务器，`docker logs` 够；不是瓶颈 |
| OpenAPI / API 文档生成 | 11 个端点手工维护够 |
| 微服务拆分 | 规模不够 |
| 独立用户系统 | PT 系统 JWT 足够 |
| LLM 生成 Assessment | 非幂等不可复现合规风险（ADR 已定） |

---

## 预算汇总

| Week | Tool calls | 你的时间 | 里程碑 |
|------|-----------|---------|--------|
| 1 | ~85 | 30 min 部署 | **生产上线** + 安全网扩大 55 snapshot / 15 property |
| 2 | ~120 | 1 hr 签字 | **sub-engine 独立** — 改 pain 不影响其他 |
| 3 | ~170 | 30 min review | **renderers 拆分** — 改 subjective 不影响 objective |
| 4 | ~180 | 30 min review | **规则注册表** — 加规则 = 加文件 |
| **Total** | **~555 tc** | **~2.5 hr** | 引擎完整可维护 |

**剩 ~245 tc 作为 buffer** — 调试、snapshot 重录迭代、未预见问题。

---

## 决策点汇总（需用户确认的节点）

| 节点 | 阶段 | 操作 |
|------|------|------|
| 部署生产 | W1.2 | ssh + docker compose up 前确认 |
| snapshot 16 样本人审 | W2.4 | 逐样本 APPROVE/REJECT 签字 |
| renderer 拆分后回归 review | W3.9 | 确认 snapshot 行为等价 |
| note-checker 拆分后 smoke | W4.3 | 确认规则覆盖率 |
| CSRF 认证层改动 | W4.5 | 全链路测试确认 |

---

## 1 个月后的验收

本计划交付的**能力承诺**：

- ✅ 改一个 sub-engine（如 pain 算法）：< 30 min 的改动，snapshot 可预测地变 1-5 个
- ✅ 加一个 note-checker 规则：新增 1 个文件 + 测试，主 checker 不动
- ✅ 加一个 SOAP 渲染分支：改 1 个 renderer 文件
- ✅ 回归安全网：≥55 snapshot + ≥15 property + 规则单测 + auditor smoke + normalize/validator 单测
- ✅ 生产部署有 Playwright PDF smoke gate 保护
- ✅ 所有 800+ LOC monolith 文件消除（除数据文件 `template-options.ts`）

---

## 执行策略

- **按周串行**，不跨周并行（避免 context 分裂）
- **每周第一个 task 前**：`git pull` + `npm test` 确认起点干净
- **每个 commit 独立**：bisect-friendly，单次 PR 可拆可合
- **每周结束**：更新本文档进度表 + 记 ADR（如有）
- **遇 HALT 条件**：请示用户，不自行扩大 scope

---

## 进度跟踪（待填）

| Week | Start | End | Tool calls | Delta | Notes |
|------|-------|-----|-----------|-------|-------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
