# SOAP 重构计划：Tier A + Tier B step 1 (修订版 v4，应对 Codex Phase 2 round 3 发现)

> 预算估算: ~240 次 tool calls
> ⏸ COMPACT CHECKPOINT（Tier A 全部完成并 commit 后执行 /compact）

---

## 修订记录

### v4（round 3 Codex 审查后）

| # | Codex 发现 | 本版处理 |
|---|-----------|----------|
| high | B1.1 signoff 不约束 B1.4 extraction contract — stage signature 仍用 loose `prevState`；`VisitAccumulator` 是 placeholder | **新 Phase B1.1.5**：B1.1 signoff 后必须先在 `src/generator/sub-engines/types.ts` 产出 concrete `EngineState` + `VisitAccumulator`（含所有 true/display 字段）+ 6 个 stage signature；用户再次签字后才进 B1.4 |
| high | Snapshot signoff 不阻止 REJECT 合并 | **硬 gate**：AC-B5 要求 16 全 APPROVE；任一 REJECT → HALT 回 B1.4/B1.5 修 → regenerate → 重 review。B1.8 merge 前强制校验 `pipeline-state.json::snapshot_rebaseline_signoff.status == approved` |
| medium | manual_gates 静态 checklist 无 transition | **显式 transition 协议**：每 gate 签字后，写 pipeline-state.json 对应 gate.status 从 pending → approved/rejected；B1.2 / B1.4 / B1.8 首步先读 status，pending 则 HALT |

### v3（round 2 Codex 审查后）

| # | Codex 发现 | 本版处理 |
|---|-----------|----------|
| high | Tier B 状态契约仍不完整：B1.1 映射范围太窄（缺 834-1002）、漏 cross-visit state（reason shuffle bag/lastUsedReason、inherited needle groups）、true/display 字段未建模 | **显式接受 + 深化 B1.1 spec**：B1.1 扩展为 `834-2173` **全段** map；必列出 7 类 cross-visit state 字段；显式约定 true/display 双存储；state model 在 B1.1 产出并 HALT 用户审查 |
| high | `pipeline-state.json` 仍描述旧 7-sub-engine 设计 + 无 manual gates | **同步 pipeline-state.json**：scope 字段改 6 阶段；新增 `manual_gates[]` 枚举（state_flow_signoff、pdf_smoke_signoff、snapshot_rebaseline_signoff、canonicalize_signoff） |
| medium | AC-B5 16 样本可双重计数，"random sample" 模糊 | **fixed 16 unique fixtures**：列出 7 core picks + 9 edge names；7 core picks disjoint from edge 9 |
| medium | A1 无 "promote duplicate to canonical" 分支 | **A1 加 promote 分支**：`保留正 / 保留 2.（git mv promote）/ 合并 / 删除` 四选项 |

### v2（round 1 Codex 审查后）

| # | Codex 发现 | 本版处理 |
|---|-----------|----------|
| P1 critical | B1 sub-engine 与现状状态流不兼容 | **重设计为 6 阶段 staged pipeline**；不再 claim 7 个独立 pure sub-engine |
| P2 high A1 | 9 个孤立 `* 2.*` 无原件 + 2 对内容不同 | **A1 改为 canonicalize 流程**：inventory → 字节相同 auto-delete / 孤立/差异 HALT |
| P2 high A6 | pdfjs worker `/ac/` 路径 + 版本漂移 | **Vite `?url`** import from `pdfjs-dist/legacy/build/pdf.worker.min.mjs` + PDF smoke test |
| P2 high AC-B5 | 5 样本太弱 | stratified 16 样本 |
| P2 high B1 rollback | commit known-bad 无 rollback | disposable branch + `refactor-tier-a-complete` tag |

---

## 冻结区块（批准后不可自行修改）

### Goal
1. **Tier A**：清理 6 类低风险债务，snapshot 全绿、行为零变化
2. **Tier B step 1**：把 `src/generator/tx-sequence-engine.ts::generateTXSequenceStates` (1200 LOC 单函数) 重构为 6 阶段 staged pipeline + 命名子模块；通过 sub-seed 派生减少 PRNG 耦合；一次 stratified 定向 snapshot 重录；新增 fuzz 测试骨架

### Non-goals（本次不做）
- 不拆 `soap-generator.ts`（留给 Tier B step 2）
- 不重写 `parsers/optum-note/checker/note-checker.ts`（Tier C）
- 不引入数据库（Tier C）
- 不迁移前端 `.js` → `.ts`（Tier C）
- 不替换手写 CSRF（Tier B step 2）
- 不拆 `BatchView.vue` / `WriterPanel.vue`（Tier B step 3）
- 不新增业务功能
- **不把 sub-engines 重构为 7 个 pure 独立函数**（Codex 证明不可行）

### 验收标准（pass/fail）

**Tier A 验收**：
- AC-A1（修订）: 所有 `git ls-files | grep " 2\."` 列出的文件完成 canonicalize（字节相同→删重复；孤立/差异→用户决策记录到 `.claude-state/canonicalize-log.md`）
- AC-A2: `.gitignore` 新增规则阻止 macOS 重复文件（模式 ` 2.*`）
- AC-A3: `src/auditor/layer1/index.ts` 顶层 `fs.readFileSync` 移除；改用 `path.join(__dirname, '../baselines/...')` + 懒加载；任意 cwd 启动可工作
- AC-A4: `src/shared/body-part-constants.ts` 新增 export：`BODY_PART_NAMES`、`SUPPORTED_IE_BODY_PARTS`、`SUPPORTED_TX_BODY_PARTS`、`BODY_PART_AREA_NAMES`
- AC-A5: `src/generator/soap-generator.ts` 改为 `import` + `export` re-export 保持对外路径兼容
- AC-A6: `src/generator/__fixtures__/fixture-data.ts:32` 和 `__fixtures__/parity-diff.test.ts:33` 的本地 `severity()` 改为 import `severityFromPain`（前提：字面等价；否则 defer 到 verify-log）
- AC-A7: `docs/ARCHITECTURE.md` §3.2 新增 `template-options.ts`、`bill-matcher.ts`、`bill-list-parser.ts`；标注 `tx-sequence ↔ soap-generator` 循环
- AC-A8: `CLAUDE.md` 修正 `tx-sequence-engine.ts` LOC（1221 → 2173）
- AC-A9（修订）: `frontend/src/services/pdf-extractor.js` 改为 `import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'` + `pdfjs.GlobalWorkerOptions.workerSrc = workerUrl`；`frontend/nginx.conf` 和 `nginx-ssl.conf` CSP 移除 `https://cdn.jsdelivr.net`；`docs/ARCHITECTURE.md:331` CSP 示例同步
- AC-A10（修订）: 加一个 PDF smoke test（用户本地手动验证 `/ac/` dev + prod build 都能解析 PDF）— 作为人工 gate，不入自动化 CI
- AC-A11: 跑 `npm test`，**snapshot 测试 0 diff**（`git diff HEAD -- src/generator/__fixtures__/__snapshots__/` 为空）
- AC-A12: 跑 `npm run build` + `cd frontend && npm run build` 通过
- AC-A13: `git ls-files | grep " 2\."` 剩余文件全部为用户决策保留（有 canonicalize-log 记录）
- AC-A14: `grep -rn "cdn.jsdelivr" frontend/src frontend/nginx*.conf` 无结果（除文档引用）

**Tier B step 1 验收（修订）**：
- AC-B1: `generateTXSequenceStates` 函数体拆为 **6 阶段 staged pipeline**：
  ```
  Stage 1: baseVisitState      — 派生 pain/frequency/painTypes 等根状态
  Stage 2: subjectiveDerived    — severity/ADL/muscle counts（基于 Stage 1 pain）
  Stage 3: subjectiveNarrative  — symptom trend/reason（依赖 Stage 1+2 + prev objective）
  Stage 4: objectiveState       — tightness/tenderness/spasm/ROM/strength
  Stage 5: displayReconciliation — output-cap 回退显示值（可修改 Stage 2-4 的显示副本）
  Stage 6: finalAssessment      — 基于 Stage 5 显示状态合成 assessment 片段
  ```
- AC-B2: 每个 stage 放在 `src/generator/sub-engines/` 下独立文件，export 命名清晰的函数（如 `deriveBaseVisitState`、`applyDisplayCaps` 等）；每个 stage 接收只读 context + 可变 `VisitAccumulator`（当前 visit 累积状态）
- AC-B3（**v5 修订 — 精确语义**）: `src/shared/sub-seed.ts` 提供 `deriveSubSeed(mainSeed, kind, visitIndex)` 基础设施 + collision 测试 + 5 sub-engine kind 常量（pain/muscles/rom/reason/symptom），**作为 Tier B step 2 运行时接入的预埋**。本 step 1 保留主 rng 透传以维持 snapshot 字节等价，不做运行时 rng 替换（原 plan "运行时派生" 的激进解读推迟到 step 2，避免一次定向 snapshot 重录的验证成本）。fuzz 测试（AC-B6）可直接使用 `deriveSubSeed` 为每个 property 注入独立 seed 以证明基础设施正确性。
- AC-B4: 循环依赖断开 — `objectiveMuscleSeed` 从 `soap-generator.ts:496` 移到 `src/shared/muscle-seed.ts`；`tx-sequence-engine.ts:17` 不再 `import from "./soap-generator"`
- AC-B5（v3 修订）: Snapshot stratified 定向重录，**固定 16 unique fixture 名单**：
  - 所有 30 fixture 重录；**必须人工 review 下列 16 个**（7 core picks 与 9 edge 不重叠）：
    - **Core picks (7)**：
      1. `LBP-bilateral-early-3tx` (seed 100001)
      2. `SHOULDER-left-late-20tx` (seed 100006)
      3. `SHOULDER-bilateral-mid-12tx` (seed 100017)
      4. `KNEE-right-late-18tx` (seed 100009)
      5. `NECK-bilateral-late-20tx` (seed 100012)
      6. `ELBOW-left-late-20tx` (seed 100015)
      7. `MID_LOW_BACK-bilateral-late-20tx` (seed 100021)
    - **Edge (9，全 review)**：seed 100022 至 100030（含 MIDDLE_BACK）
  - review 后由用户（ping）在 `.claude-state/snapshot-rebaseline-signoff.md` 签字（每条标 APPROVE / REJECT + 备注）
  - **前置**：AC-B6 fuzz 全绿后才允许进入 review
- AC-B6（修订，前置）: 新增 `src/generator/sub-engines/__tests__/*.fuzz.test.ts` 至少 5 个 property tests：
  - `pain` 单调非增（跨 visit）
  - `muscles.spasm ⊆ tenderness ⊆ tightness`
  - `rom floor` 跨 visit 单调非减（朝 goal）
  - `reason` 每条来自 template whitelist
  - `symptom chain` — 后续 visit associated symptoms 是前 visit 的子集或等集
  - fast-check runs=50 + seed 固定
- AC-B7: 全量 `npm test` 通过（含新 fuzz + rebaseline snapshot）
- AC-B8: build 通过
- AC-B9（新）: Tier B step 1 在 disposable branch `refactor/tier-b-step-1` 开发；只有 AC-B5 签字 + AC-B6/B7/B8 全绿后才 merge 回 `clean-release`；失败直接弃分支回到 tag `refactor-tier-a-complete`

### 冻结 — 写入范围

**allowed_writes**：
```
src/auditor/layer1/index.ts
src/shared/body-part-constants.ts
src/shared/muscle-seed.ts              (新建)
src/shared/sub-seed.ts                 (新建)
src/shared/severity.ts                 (如需扩展)
src/generator/soap-generator.ts        (仅限 import/re-export/移除被抽走的常量和 objectiveMuscleSeed 定义，不动 generate* 主函数体)
src/generator/tx-sequence-engine.ts
src/generator/sub-engines/**           (新建目录)
src/generator/__fixtures__/fixture-data.ts
src/generator/__fixtures__/parity-diff.test.ts
src/generator/__fixtures__/__snapshots__/** (仅 Tier B step 1 允许定向重录)
frontend/nginx.conf
frontend/nginx-ssl.conf
frontend/src/services/pdf-extractor.js
frontend/package.json                  (如需新增 fast-check 或调整 pdfjs)
frontend/vite.config.js                (如需 pdfjs asset 配置)
docs/ARCHITECTURE.md
.gitignore
CLAUDE.md
package.json                           (如需加 fast-check)
.claude-state/canonicalize-log.md      (A1 决策记录)
.claude-state/snapshot-rebaseline-signoff.md (B5 人工签字)
```

**forbidden_writes**：
```
server/**                              (范围外)
frontend/src/views/**
frontend/src/components/**             (包括 composer/)
parsers/**                             (note-checker 留给 Tier C)
scripts/playwright/**
src/generator/soap-generator.ts 的 generate* 主函数体
src/generator/objective-patch.ts
src/generator/goal-path-calculator.ts  (范围外)
src/generator/weight-integration.ts    (范围外)
scripts/**                             (Tier A 的 A1 canonicalize 需要在此写 log，但不动代码；若决策保留则按原样 keep)
```

**verify_commands**：
```bash
# Tier A
npm test -- --runInBand src/generator/__fixtures__/fixture-snapshots.test.ts
npm test
npm run build
cd frontend && npm run build
git diff HEAD -- src/generator/__fixtures__/__snapshots__/   # 应空
grep -rn "cdn.jsdelivr" frontend/src frontend/nginx*.conf    # 应空

# Tier B step 1 (在 refactor/tier-b-step-1 branch)
npm test -- --runInBand -u src/generator/__fixtures__/fixture-snapshots.test.ts   # 定向重录
npm test
npm run build
```

---

## 实现步骤

### Phase A1（v3 修订）— Canonicalize `* 2.*`（~15 tool calls）

1. `git ls-files | grep " 2\."` 输出完整列表
2. 对每个文件分类：
   - 有原件 (`foo.ts` + `foo 2.ts`)：跑 `diff`
     - 字节相同 → 加入自动删除集
     - 字节不同 → 加入人工决策集
   - 无原件（孤立 `foo 2.ts`）：加入人工决策集（用 `git log --follow` 列出首次提交）
3. 写 `.claude-state/canonicalize-log.md` 列出 3 组 + 每项有 4 选项：
   - **选项**：
     - `A. keep-original`（删 ` 2.*`）
     - `B. promote-duplicate`（`git mv " 2.*" → 原名`，相当于保留 ` 2.*` 内容为 canonical）
     - `C. merge`（人工合并 → HALT，用户必须指定合并方向）
     - `D. delete-both`（两个都删）
   - 自动可删的字节相同文件默认 A
   - 孤立文件默认标 `ORPHAN_NEEDS_DECISION`
   - 差异对必须显式标 A/B/C
4. **HALT** — 列表给用户，要求每行标选项
5. 执行决策：
   - A → `git rm " 2.*"`
   - B → `git rm <orig>` + `git mv " 2.*" <orig>`
   - C → HALT 等合并完成后 `git rm " 2.*"`
   - D → `git rm <orig>` + `git rm " 2.*"`
6. `.gitignore` 追加：
   ```
   # macOS Finder duplicates
   * 2.*
   */* 2.*
   ```
7. commit：`chore: canonicalize macOS duplicate files per user decisions`

### Phase A2 — 修 auditor fs.readFileSync（~8 tool calls）

1. 读完整 `src/auditor/layer1/index.ts`
2. 顶层常量改懒加载 + `path.join(__dirname, '../baselines/...')`
3. 加 try/catch 给清晰错误
4. 写一个冒烟测试验证从非根 cwd 启动能加载
5. commit：`fix(auditor): lazy-load baselines via __dirname to fix cwd dependency`

### Phase A3 — 抽 body-part 常量（~12 tool calls）

1. 从 `src/generator/soap-generator.ts` 摘出：114、134、144、445 四处常量定义
2. 在 `src/shared/body-part-constants.ts` 新增 export
3. soap-generator.ts 改为 import + re-export 保对外兼容
4. `npm run build` + snapshot 测试验证 0 变化
5. commit：`refactor(shared): extract body-part constants from soap-generator`

### Phase A4 — 合并 fixture severity helpers（~5 tool calls）

1. 读 `src/shared/severity.ts::severityFromPain` 与 `fixture-data.ts:32`、`parity-diff.test.ts:33` 对比逻辑
2. 若等价 → 改 import；若不等价 → defer 到 verify-log，不强改
3. **tx-sequence-engine.ts:295 的 `severityFromPain` 不动**（PRNG 敏感，留 Tier B）
4. 测试确认 0 snapshot diff
5. commit：`refactor(test): dedupe severity() helpers in fixtures`

### Phase A5 — 文档同步（~8 tool calls）

1. `docs/ARCHITECTURE.md` §3.2 补 `template-options.ts`、`bill-matcher.ts`、`bill-list-parser.ts`
2. §3.1 依赖图下方加注：循环依赖（Tier B step 1 计划断开）
3. Changelog 追加 v2.4.1
4. `CLAUDE.md` 修正 LOC 数字
5. commit：`docs: sync ARCHITECTURE.md and CLAUDE.md with current code state`

### Phase A6（修订）— pdfjs 自托管（~12 tool calls）

1. `frontend/src/services/pdf-extractor.js`:10 改为：
   ```js
   import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
   pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
   ```
   （Vite 会自动把 worker 打到 `assets/`，版本始终匹配安装的 pdfjs-dist）
2. `frontend/nginx.conf:17` 和 `frontend/nginx-ssl.conf:21` CSP：
   - 移除 `https://cdn.jsdelivr.net`
   - 保留 `worker-src 'self' blob:`（Vite worker URL 是 `/ac/assets/...`，属 self）
3. `docs/ARCHITECTURE.md:331` CSP 示例同步
4. **手动 smoke test**（HALT — 用户本地操作）：
   - `cd frontend && npm run dev` → 上传 PDF → 控制台无 CSP 错误 + extract 成功
   - `cd frontend && npm run build && npm run preview` → 同上
   - 用户签字后继续
5. commit：`feat(security): self-host pdfjs worker via ?url, tighten CSP`

⏸ **Tier A 完成，打 tag `refactor-tier-a-complete`，执行 /compact**

```bash
git tag refactor-tier-a-complete
git checkout -b refactor/tier-b-step-1
```

### Phase B1.1（v3 修订）— 完整 State flow mapping（~30 tool calls）

严格遵循 Codex round 1+2 finding：先完整 map，再开工。范围必须覆盖 `tx-sequence-engine.ts:834-2173` **全段**（不只 1000-2173）。

1. Read `src/generator/tx-sequence-engine.ts` 全段，分块读取：
   - 834-1002（**cross-visit 初始化**：prevFrequency、initialMuscles、severity/ADL 基线、baseline symptoms）
   - 1002-1220（visit loop 外壳）
   - 1220-1505
   - 1505-1715
   - 1715-1950
   - 1950-2173（display reconciliation + final assessment）
2. 在 `.claude-state/tx-engine-state-flow.md` 必须产出 **5 张表**：
   - **T1. Cross-visit EngineState 字段**（跨 visit 累积的 session-level 状态）必列：
     - reason shuffle bag（行 893-898）
     - `lastUsedReason`（1674-1728）
     - inherited `needleGroups`（1048、1867-1886）
     - `prevFrequency`
     - `initialMuscles`
     - baseline symptoms / severity / ADL
     - 其他 session-level 状态
   - **T2. Per-visit VisitAccumulator 字段**（6 阶段按顺序填充）
   - **T3. True-state vs Display-state 双存储字段**（display reconciliation @1949-2007 可回退的字段）必列：
     - tightness / tenderness / spasm 真/显
     - frequency 真/显
     - symptom scale 真/显
     - 其他受 cap 影响的字段
   - **T4. Stage → 消费字段 / 产出字段 映射**（6 个 stage 各一行）
   - **T5. 漏标的 state domains**（needle protocol、side-progress、strength、patient-change copy、assessment synthesis 等）归入哪个 stage
3. 识别 6 阶段切分点，确认无跨阶段依赖丢失（如发现新类型状态 → 重新切分）
4. 在文件末尾写"state flow signoff" 区，留给用户打勾
5. **HALT** — 文件发给用户，用户审查后在 signoff 区签字才继续 Phase B1.2

### Phase B1.1.5（v4 新增）— Concrete code types from state map（~10 tool calls）

B1.1 signoff 后，将 state map 转为 concrete TypeScript 类型。

1. 新建 `src/generator/sub-engines/types.ts`（**这是 B1.4 唯一类型来源，B1.4 禁止重定义**）：
   ```ts
   // Cross-visit session state（对应 B1.1 表 T1）
   export interface EngineState {
     reasonShuffleBag: string[]
     lastUsedReason: string | null
     inheritedNeedleGroups: NeedleGroups | null
     prevFrequency: number | null
     initialMuscles: SelectedMuscles
     baselineSeverity: SeverityLevel
     baselineAdlLevel: number
     baselineSymptoms: string[]
     // 其他 T1 中确认的字段（B1.1 state map 必须 enumerate）
   }
   
   // Per-visit accumulator（对应 B1.1 表 T2）
   export interface VisitAccumulator {
     // Stage 1: baseVisitState
     pain: number
     frequency: number
     painTypes: string[]
     
     // Stage 2: subjectiveDerived
     severity: SeverityLevel
     adlLevel: number
     muscleCounts: { tightness: number; tenderness: number; spasm: number }
     
     // Stage 3: subjectiveNarrative
     associatedSymptoms: string[]
     reason: string
     
     // Stage 4: objectiveState
     tightness: string[]
     tenderness: string[]
     spasm: string[]
     tightnessGrading: string
     tendernessGrading: string
     spasmGrading: string
     rom: ROMSnapshot
     strength: StrengthSnapshot
     needleGroups: NeedleGroups
     
     // Stage 5: display copies（对应 B1.1 表 T3 — cap 回写的字段，Stage 6 读这些）
     display: {
       tightness: string[]
       tenderness: string[]
       spasm: string[]
       tightnessGrading: string
       tendernessGrading: string
       spasmGrading: string
       chainFrequency: number
       visitSymptomScale: string
       // B1.1 表 T3 必须补全其他 cap 字段
     }
     
     // Stage 6: finalAssessment
     assessmentFragments: AssessmentFragment[]
   }
   
   // 6 stage signatures — 每个 stage 接受 EngineState + VisitAccumulator 累积物
   export type Stage1 = (input: { context: GenerationContext; prevVisit: VisitAccumulator | null; engineState: EngineState; mainSeed: number; visitIndex: number }) => Partial<VisitAccumulator>
   export type Stage2 = (input: { context: GenerationContext; acc: VisitAccumulator; engineState: EngineState; mainSeed: number; visitIndex: number }) => Partial<VisitAccumulator>
   export type Stage3 = Stage2
   export type Stage4 = Stage2
   export type Stage5 = (input: { acc: VisitAccumulator; engineState: EngineState }) => Pick<VisitAccumulator, 'display'>
   export type Stage6 = (input: { acc: VisitAccumulator; engineState: EngineState; prevAssessment: AssessmentFragment[] | null }) => Pick<VisitAccumulator, 'assessmentFragments'>
   ```
2. 将 types.ts 与 B1.1 state flow map **逐字段**对照验证（T1 全字段进 EngineState；T3 全字段进 `display`）；任何漏字段 → HALT 回 B1.1 补 map
3. 更新 `pipeline-state.json::manual_gates.state_flow_signoff.status` = `approved`（用户签 state flow map 后）
4. **HALT** — 用户检查 types.ts 与 state map 对应，签字 `types_contract_signoff`；写 `pipeline-state.json::manual_gates.types_contract_signoff.status` = `approved`
5. commit：`feat(types): add frozen EngineState + VisitAccumulator contract for sub-engine pipeline`

**B1.4 硬约束（v5）**：禁止在 B1.4 任何子步骤重新定义 `EngineState` 或 `VisitAccumulator`。所有 stage 实现必须 `import type { ... } from '../sub-engines/types'` 引用此处的 frozen 定义。修改类型须回 B1.1.5 经用户重签。

### Phase B1.2 — 移 objectiveMuscleSeed（~5 tool calls）

1. 新建 `src/shared/muscle-seed.ts`，移入函数
2. 更新 2 处 import（`tx-sequence-engine.ts:17`、`soap-generator.ts:1169`）
3. soap-generator.ts:496 改 re-export 保对外兼容
4. 测试 — **应 0 snapshot diff**
5. commit：`refactor(shared): move objectiveMuscleSeed to shared, break cycle`

### Phase B1.3 — 定义 sub-seed 派生 + 测试（~8 tool calls）

1. 新建 `src/shared/sub-seed.ts`：
   ```ts
   export type SubEngineKind = 'pain' | 'muscles' | 'rom' | 'reason' | 'symptom'
   
   export function deriveSubSeed(mainSeed: number, kind: SubEngineKind, visitIndex: number): number {
     const k = kindToInt(kind)  // 固定映射
     // Double mixing: XOR + rotation + FNV-style
     let x = (mainSeed >>> 0) ^ (k * 0x9E3779B1)
     x = Math.imul(x ^ (x >>> 16), 0x85EBCA77)
     x = Math.imul(x ^ (x >>> 13), 0xC2B2AE3D)
     x ^= visitIndex * 0x27D4EB2F
     return (x ^ (x >>> 16)) >>> 0
   }
   ```
2. 加单测：
   - 相同输入相同输出
   - 不同 kind/visit/mainSeed 任意两个不同 → 输出不同（穷举 small space）
   - collision test: 1000 个随机 (mainSeed, kind, visit) 无重复
3. commit：`feat(shared): add sub-seed derivation for sub-engine independence`

### Phase B1.4（修订）— 实现 6 阶段 pipeline（~60 tool calls）

按阶段顺序实现，每阶段独立 commit（便于 bisect + rollback）：

#### B1.4.1 — 消费 frozen types contract（**无新代码**）
`sub-engines/types.ts` 由 B1.1.5 已产出并签字冻结。B1.4 所有子步骤 **只 import 不重写**：
```ts
import type { EngineState, VisitAccumulator, Stage1, Stage2, Stage3, Stage4, Stage5, Stage6 } from './types'
```
若发现 types.ts 字段不足 → HALT，回 B1.1.5 请求用户授权扩字段，不在 B1.4 原地改。

#### B1.4.2 — Stage 1 `deriveBaseVisitState`
输入 `{ context, prevState, mainSeed, visitIndex }` → `{ pain, frequency, painTypes }`

#### B1.4.3 — Stage 2 `deriveSubjectiveDerived`
输入 `{ context, accumulator, prevState }` → 更新 `severity, adlLevel, muscleCounts`

#### B1.4.4 — Stage 3 `buildSubjectiveNarrative`
输入 `{ context, accumulator, prevState, prevObjective }` → 更新 `associatedSymptoms, reason`（依赖 Stage 1+2 + prev objective）

#### B1.4.5 — Stage 4 `buildObjectiveState`
输入 `{ context, accumulator, prevState }` → 更新 `tightness, tenderness, spasm, rom, strength`

#### B1.4.6 — Stage 5 `applyDisplayCaps`
输入 `accumulator` → 生成 display 副本（不破坏真 state）

#### B1.4.7 — Stage 6 `buildFinalAssessment`
输入 `{ accumulator }` → `assessmentFragments`

每 stage 完成后：`npm test` 跑测试 — 若未接入主流程则只跑新测试；接入后 snapshot 会偏移（预期）。

### Phase B1.5 — 接入主函数（~15 tool calls）

1. `generateTXSequenceStates` 改为按 visit 循环调用 6 个 stage
2. 主函数缩到 ≤300 LOC
3. **snapshot 必然全变** — 这是预期
4. commit 到 disposable branch：`refactor(engine): decompose generateTXSequenceStates into 6-stage pipeline`

### Phase B1.6 — fuzz 测试骨架（前置于 rebaseline）（~20 tool calls）

1. `npm i -D fast-check`
2. 新增 5 个 property tests（见 AC-B6）
3. 若 fuzz 揪出违反不变量的输入 → **HALT**，修实现而非修测试
4. 全绿后 commit：`test: add property-based fuzz tests`

### Phase B1.7（v4 修订）— Stratified rebaseline + 硬 APPROVE gate（~5-? tool calls，循环）

1. `npm test -- --runInBand -u src/generator/__fixtures__/fixture-snapshots.test.ts`
2. `git diff HEAD~ -- src/generator/__fixtures__/__snapshots__/` 打印 sample
3. 生成 `.claude-state/snapshot-rebaseline-signoff.md` 列出 **16 固定必 review 样本**（核对 AC-B5 清单）
4. **HALT** — 用户对每样本标 `APPROVE` / `REJECT` + 备注
5. 判定：
   - **16 全 APPROVE** → 更新 `pipeline-state.json::manual_gates.snapshot_rebaseline_signoff.status = approved` → commit：`test: re-baseline 30 snapshots after staged pipeline refactor`
   - **任一 REJECT** → 更新 status = `rejected`；HALT 回 Phase B1.4/B1.5 修实现（不改测试）；修完后 regenerate snapshot → 重新走 Phase B1.7
   - 超过 2 轮 REJECT 循环未收敛 → HALT 请示用户

### Phase B1.8（v4 修订）— 合并回 clean-release（~5 tool calls）

**强制前置检查**（第一步先执行）：
```bash
# 读 pipeline-state.json 验证所有 gate 已 approved
python3 -c "import json; s=json.load(open('.claude-state/pipeline-state.json')); \
  gates=s['manual_gates']; \
  missing=[g['id'] for g in gates if g['status']!='approved']; \
  assert not missing, f'Gates not approved: {missing}'; \
  print('All gates approved')"
```
若失败 → HALT，不合并。

1. 验证 AC-B5 / AC-B6 / AC-B7 / AC-B8 全绿 + 所有 gate approved
2. `git checkout clean-release && git merge --no-ff refactor/tier-b-step-1`
3. 删除 disposable branch
4. 完结

---

## 影响范围

同 v1 — 无变化。

## 风险与缓解（修订）

| R# | 风险 | 缓解 |
|----|------|------|
| R1 | 重复文件误删 | A1 改为 canonicalize + HALT 用户决策，不 auto-rm |
| R2 | 抽常量漏引用 | `npm run build` 类型兜底 + snapshot 0 变化 |
| R3 | `objectiveMuscleSeed` 非纯 | 先读完整实现确认无副作用；若有则先改造再移 |
| R4 | pdfjs Vite `?url` 在 build 或 dev 失败 | 双环境（dev + preview）smoke test；失败回退到诊断选项 B |
| R5 | B1 rebaseline 掩盖真回归 | fuzz 先行 + stratified 16 样本强制 review + 签字 |
| R6 | Stage 间漏描述状态依赖 | B1.1 的 state flow map + 用户审查后才开工 |
| R7 | fast-check flake | seed 固定 + runs 收敛 |
| R8 | B1 中途失败污染主分支 | disposable branch + `refactor-tier-a-complete` tag 回滚点 |
| R9 | sub-seed collision | B1.3 穷举测试 + 双混合函数 |

## HALT 条件（修订）

- A1 canonicalize 遇到孤立或差异文件 → 列出给用户，**等决策**
- A6 pdfjs 本地 smoke test 失败 → 查因，不强推 commit
- B1.1 state flow map 发现无法切成 6 阶段 → 回 Phase 3 重设计
- B1.2 `objectiveMuscleSeed` 非纯 → 停下来决策
- B1.4 任意 stage 接入后 snapshot 出现预期外的崩溃（非偏移，是缺字段/格式错）→ 查因
- B1.6 fuzz 发现真不变量违反 → 修代码，不修测试
- B1.7 用户 review 16 样本中任一不接受 → 查该 diff 原因
- 同一阶段循环超 2 轮未收敛 → 请示用户
