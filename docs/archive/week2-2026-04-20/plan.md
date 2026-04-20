# Week 2 Plan v4 (per-stage isolation) — Tier B step 2 sub-seed runtime wiring

> Revision v3→v4: Codex v3 REJECT 1C+2H+1M (P14 broken, snapshot window 不够, 无实现层 assertion, inventory schema 松)
> Codex v3 提供了完整 39-site rng inventory（见 Step 3.0）
> 预算估算: ~95 tool calls + 用户 1 hr snapshot 人审
> Lane: standard
> 起点 HEAD: b118b53

---

## Goal
让每个 **stage** 在每 visit 内从独立 PRNG 流取随机数（通过 `deriveSubSeed(consts.mainSeed, kind, visitIndex)`，其中 kind 为 stage 映射：stage1→pain, stage2→symptom, stage3→reason, stage4→muscles）。改一个 **stage 函数**内代码不影响其他 stage 的 rng 流。stage5/6 无 rng，不改。

## Why per-stage (not per-kind)
Codex v2 review 发现 per-kind 粒度遇到三个结构性问题：
1. stage4:229 `if (rng() > 0.5)` 决定 strengthTrend 或 romTrend（cross-kind roll），任何 kind 归属都破坏独立性
2. `pickSingle/pickMultiple` helper pass-through 让 rng inventory 超 36 → 40+
3. sideProgress 等输出依赖多 kind 输入，P14 NON_K_FIELDS 矩阵复杂且易漏

per-stage 让所有 stage4 rng（含 line 229 cross-kind roll 和 needle pickMultiple）进同一流，**stage 内部 cross-kind 是合法的**；验证的边界是 stage 之间。

## Known Limitation（保持 v2 声明）
Init-time `computeGoalPaths(..., rng)` 仍用 main rng 跨 kind 耦合。本 run 不动。ADR D42 记录。

## Non-Goals
- Init-time rng 拆分
- `soap-generator.ts`, renderer（W3）
- note-checker（W4）
- 改 rng 调用**次数**（只换 source）
- 清理 `_painRng/_adlRng` preserve 占位
- 改 `sub-seed.ts`, `seeded-rng.ts`, `deriveSubSeed` 原语
- 改 stage 函数**逻辑**（如拆 stage4:229）
- 改 `fixture-data.ts`, `fixture-snapshots.test.ts` harness
- 加额外 kind（新增 `StageKind` type）；直接复用现有 `SubEngineKind` 的 4 个值

## Acceptance Criteria

| # | 标准 | 验证 |
|---|------|------|
| **AC1** | stages 目录下 stage1-4 所有**裸** `rng()` 调用 + helper pass-through（`pickSingle/pickMultiple`）的 rng 参数都改为 `stageRng()`；stage5/6 不改；**实现层 assertion**: `grep -E "consts\.rng\|[^a-zA-Z]rng\b" src/generator/sub-engines/stages/stage{1,2,3,4}*.ts` 应**仅**匹配注释或已改为 stageRng 的行（无裸 `consts.rng` 或未改 `rng()`） | 跑 grep 验证 + `rng-inventory.md` 39 行 schema（见下）逐条 before→after + 运行时 `consts.rng` throw-guard 单元测试（见 Step 6b） |
| **AC2** | Stage 到 kind 的映射冻结（复用现有 SubEngineKind 4 个值，`rom` 不用）：<br>- stage1 → `pain`<br>- stage2 → `symptom`<br>- stage3 → `reason`<br>- stage4（含所有内部 rng：bounce、rom、strength、needle pickMultiple、line 229 cross-kind roll、sideProgress 的 rng）→ `muscles`<br>- stage5/6 不取 rng | 读 diff 核对 stage 到 kind 映射；每个 stage 只见一种 stageRng |
| **AC3** | 主循环每 visit 构造 `stageSeeds: Record<'stage1'\|'stage2'\|'stage3'\|'stage4', () => number>`，通过映射表（stage1→pain 等）调用 `createSeededRng(deriveSubSeed(consts.mainSeed, kind, visitIndex)).rng`；**5 个 SubEngineKind 中 4 个用**（pain/symptom/reason/muscles）；rom 不用但 deriveSubSeed 原语不变 | 读 `generateTXSequenceStates` |
| **AC4** | snapshot 重录：<br>- **51 TX fixture** snapshot 全变<br>- **4 IE/RE fixture**（LBP-IE-new-patient, KNEE-IE-existing-patient, SHOULDER-RE-midcourse, NECK-RE-latecourse）保持 **0-diff**（不走 tx-sequence-engine）<br>- 55 全绿 | 对 4 IE/RE fixture 逐个**提取整块** `exports[...] = \`...\`;`（从 `exports[\`Fixture Snapshots snapshot: <NAME> 1\`] = \`` 到下一个 `exports[` 或 EOF），对 pre-Phase4 版本和 current 版本计算 sha256，**4 hash 全一致**；51 TX fixture 的 git diff --stat 显示 53 blocks changed（55 total - 4 IE/RE 不变 = 51 变 + 元数据变化 contribution） |
| **AC5** | **20 条**人审 gate：<br>**tier-b-step-1 approved 16 条**（7 core + 9 edge）<br>**+ W1 新 4 条代表**（covering 4 of 5 new TX branch types）：LBP+NECK-bilateral-mid-10tx（multi-bodypart）、LBP-continue-from-tx8-10tx（continue-mode）、KNEE-weakness-right-10tx（assoc-symptom）、SHOULDER-young-female-25yo-8tx（demographics） | `.claude-state/signoff-week2.md` 20 条表格；全 APPROVE 才解除 HALT |
| **AC6** | 新 fuzz property **P14 stage-level isolation**（两部分，都 runnable）：<br>**P14a — deriveSubSeed derivation isolation**：构造 full StageSeedBag_A（5 kinds from seedA）和 StageSeedBag_B-pert-N（只对 pert stage 用 seedB，其他 stage 仍用 seedA）；对每个 (seedA, seedB, visitIndex, pertStage) 组合：对每个 otherStage ≠ pertStage，assert `A[otherStage]` 前 32 个 rng() 值 === `B_pert_N[otherStage]` 前 32 个 rng() 值。**必须真正应用 seedB**（v3 的 bug 是两侧都用 seedA，修复）。<br>**P14b — runtime guard**：构造测试 context + options，call `generateTXSequenceStates` with a `consts.rng` that throws on call；assert 正常返回（说明 stage1-4 绕过 main rng）。此 test 直接测实现层："stage 真的用了 stageRng 而不是 consts.rng"。 | `npm test -- pipeline.fuzz` 全绿；两个 test：`P14a stage isolation via deriveSubSeed` + `P14b runtime guard: stages do not read consts.rng` |
| **AC7** | 文档：<br>- `docs/ARCHITECTURE.md` 新增 "## Sub-seed runtime wiring (Tier B step 2, 2026-04-20)" 节<br>- `docs/decisions.md` ADR D42 包含：**decision / consequences / known limitation / future work / alternatives rejected** 五段 | git diff 查结构；alternatives 段必须列至少 2 方案（per-kind 被否 + per-stage 被采纳的理由） |
| **AC8** | `npm test` failing 集合 ⊆ W1 baseline（9 FAIL / 7 FAIL tests） | diff |
| **AC9** | `tsc --noEmit` errors ≤ 25 | 计数 |
| **AC10** | `verify-log.md` 逐条 evidence | 齐全 |

## allowed_writes
- `src/generator/tx-sequence-engine.ts`
- `src/generator/sub-engines/types.ts`
- `src/generator/sub-engines/stages/stage1-base-visit-state.ts`
- `src/generator/sub-engines/stages/stage2-subjective-derived.ts`
- `src/generator/sub-engines/stages/stage3-subjective-narrative.ts`
- `src/generator/sub-engines/stages/stage4-objective-state.ts`
- `src/generator/sub-engines/__tests__/pipeline.fuzz.test.ts`
- `src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap`
- `docs/ARCHITECTURE.md`
- `docs/decisions.md`
- `.claude-state/**`

## forbidden_writes
- `src/generator/sub-engines/engine-init.ts`（init-time rng 保持 known limitation）
- `src/generator/sub-engines/stages/stage5-apply-display-caps.ts`, `stage6-build-final-assessment.ts`
- `src/generator/sub-engines/shared-helpers.ts`（helper 签名不变）
- `src/generator/soap-generator.ts`, `objective-patch.ts`, `goal-path-calculator.ts`, `muscle-selector.ts`, `spasm-model.ts`, `weight-integration.ts`, `parser.ts`
- `parsers/**`, `server/**`, `frontend/**`
- `src/generator/__fixtures__/fixture-data.ts`
- `src/generator/__fixtures__/fixture-snapshots.test.ts`
- `src/shared/sub-seed.ts`, `src/shared/seeded-rng.ts`

## verify_commands
```bash
npm test 2>&1 | tee /tmp/week2-final.log
npx tsc --noEmit 2>&1 | tee /tmp/week2-tsc-final.log
npm test -- pipeline.fuzz
npm test -- fixture-snapshots
```

---

## Codex v1+v2+v3 Findings 最终处理

| Finding | 处理（v3 per-stage 模式） |
|---------|--------------------------|
| C1 55/55 错 | 修（AC4）：51 TX + 4 IE/RE 0-diff |
| H2 init-time 耦合 | 声明 Known Limitation，ADR D42 |
| H3 needle 无 kind | 修：所有 stage4 rng 归 stage4→muscles，needle 也是 |
| H4 P14 engine-level | 修：P14 明标 stage-level，简化为 rng 流 identity 检查 |
| M5 计数错 + helper pass-through | **per-stage 消解**：stage 内部 helper pass-through 都传 stageRng；不再逐 call 分类 |
| M6 mainSeed | 修：consts.mainSeed |
| M7 signoff 欠覆盖 | 修：16 → 20（+4 W1 代表） |
| L8 stage1 rationale | 修 |
| v2-H-new-1 AC1 grep 不可靠 | 修（AC1）：用 `rng-inventory.md` 逐 call 列表，不用 grep 数 |
| v2-H-new-2 stage4:229 cross-kind | **per-stage 消解**：stage4 内部 cross-kind roll 本就在同一 stream |
| v2-M-new-1 AC2 未冻结 stage4 sites | **per-stage 消解**：所有 stage4 rng 都归 stage4，无选择题 |
| v2-M-new-2 P14 NON_K_FIELDS | 修：P14 改为 rng 流 identity（不做 stage 输出断言） |
| v2-M-new-3 signoff 18/51 低 | 修：升到 20/51 ≈ 39% |
| v2-L-new ADR 太薄 | 修（AC7）：5 段含 alternatives rejected |
| **v3-F4 CRITICAL P14 vacuous**（两侧都用 seedA） | **修**：v4 P14a 明确构造 buildBag(pertLabel, seedA, seedB, ...)，seedB 实际用到；采样升到 32 |
| **v3-F5 HIGH snapshot 30-line window** | **修**：AC4 改为整块 awk 切片 + sha256 对 4 IE/RE 比较 |
| **v3-F6 HIGH P14 无实现层 assertion** | **修**：AC6 拆为 P14a (derivation isolation) + P14b (runtime guard)；AC1 加实现层 grep assertion (Step 3.2) |
| **v3-F7 MEDIUM inventory schema 松** | **修**：Step 3.1 给出 13-field schema |
| v3-F1/F2/F3/F8 LOW (check passed) | 采纳 Codex 的 39-site inventory + helper pass-through table 作为 Step 3.0 事实基础 |

---

## 实现步骤

### Step 0 — Baseline（~2 tc）
```bash
npm test 2>&1 | tee /tmp/week2-baseline.log
npx tsc --noEmit 2>&1 | tee /tmp/week2-tsc-baseline.log
```

### Step 1 — 类型 + inventory（~8 tc）

**1a** 在 `types.ts` 加：
```typescript
import type { SubEngineKind } from '../../shared/sub-seed'

export type StageLabel = 'stage1' | 'stage2' | 'stage3' | 'stage4'

/** Stage 到 SubEngineKind 的映射（stage5/6 无 rng） */
export const STAGE_TO_KIND: Record<StageLabel, SubEngineKind> = {
  stage1: 'pain',
  stage2: 'symptom',
  stage3: 'reason',
  stage4: 'muscles',
}

export type StageSeedBag = Readonly<Record<StageLabel, () => number>>
```

**1b** 每个 stage1-4 的 args interface 增加 `stageRng: () => number` 字段。stage5/6 不加。

**1c** 写 `.claude-state/rng-inventory.md` 初版，列 Step 3 将触及的所有 call sites（Claude 实际读代码逐行填）。

### Step 2 — 主循环注入（~6 tc）

`tx-sequence-engine.ts`:
```typescript
import { deriveSubSeed } from '../shared/sub-seed'
import { STAGE_TO_KIND, type StageSeedBag } from './sub-engines/types'
import { createSeededRng } from '../shared/seeded-rng'

// 在 generateTXSequenceStates 循环内：
for (let i = consts.startIdx; i <= consts.txCount; i++) {
  const stageSeeds: StageSeedBag = {
    stage1: createSeededRng(deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage1, i)).rng,
    stage2: createSeededRng(deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage2, i)).rng,
    stage3: createSeededRng(deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage3, i)).rng,
    stage4: createSeededRng(deriveSubSeed(consts.mainSeed, STAGE_TO_KIND.stage4, i)).rng,
  }
  const s1 = deriveBaseVisitState({ engineState, consts, stageRng: stageSeeds.stage1, visitIndex: i })
  const s2 = deriveSubjectiveDerived({ acc: s1, engineState, consts, stageRng: stageSeeds.stage2 })
  const s4a = deriveObjectiveNumeric({ acc: { ...s1, ...s2 }, engineState, consts, stageRng: stageSeeds.stage4 })
  const s3 = buildSubjectiveNarrative({ acc: { ...s1, ...s2, ...s4a }, engineState, consts, stageRng: stageSeeds.stage3 })
  const s4b = buildObjectiveGrading({ acc: { ...s1, ...s2, ...s4a, ...s3 }, engineState, consts, stageRng: stageSeeds.stage4 })
  // stage5/6 不传 stageRng
}
```

### Step 3.0 — 锁定 rng site inventory（Codex v3 提供，~2 tc 拷贝核对）

Codex v3 审 plan 时读完 stage1-4 源文件，给出了完整 inventory。锁定如下（实现时逐行对照）：

**stage1-base-visit-state.ts (7 sites, all direct rng())**:
- L38 progressNoise
- L49 objectiveFactors.sessionGapDays
- L50 objectiveFactors.sleepLoad
- L51 objectiveFactors.workloadLoad
- L52 objectiveFactors.weatherExposureLoad
- L53 objectiveFactors.adherenceLoad
- L64 _painRng

**stage2-subjective-derived.ts (3 sites, all direct rng())**:
- L46 _adlRng1
- L47 _adlRng2
- L111 _freqRng

**stage3-subjective-narrative.ts (16 sites, mix direct + helper pass-through)**:
- L60 pickSingle(..., rng, ...) initial symptomChange
- L79 direct rng() negative-event gate
- L133 pickSingle reasonConnector
- L140 pickSingle initial reason
- L232 direct rng() positiveShuffleBag pick index
- L239 direct rng() compatibility consume for second reason pick
- L244 direct rng() improvement connector pick
- L252, L253, L254 direct rng() placeholder consumes (exacerbate branch)
- L264 direct rng() cameBackShuffleBag pick index
- L271, L274 direct rng() compatibility consumes (came-back branch)
- L287 direct rng() compatibility consume (assoc-symptom rank)
- L299 pickSingle painFrequency
- L307 pickSingle treatmentFocus

**stage4-objective-state.ts (13 sites, mix direct + helper)**:
- L94 direct tightness bounceRng
- L123 direct tenderBounceRng
- L156 direct spasmBounceRng placeholder
- L173 direct compatibility consume after spasm
- L189 direct ROM numeric delta
- L195 direct _strengthRng placeholder
- L229 direct plateau cross-kind roll (strengthTrend vs romTrend) — **stays in stage4 stream**
- L269 direct bilateral sideProgress asymmetry
- L360, L361 direct compatibility consumes before tightness grading
- L403, L404 direct compatibility consumes before tenderness grading
- L443 pickMultiple legacy needle pick

**Total: 7 + 3 + 16 + 13 = 39 call sites**. Helper pass-through 6 处全在 `shared-helpers.ts`（pickSingle L348, pickMultiple L372），无外部桥接。

### Step 3.1 — stage 内部替换（~25 tc）

对 stage1-4 每个文件严格按 Step 3.0 inventory：
- 解构 args 中的 `stageRng`
- 所有裸 `rng()` 调用改为 `stageRng()`
- 所有 `pickSingle/pickMultiple(..., rng)` 改为 `pickSingle/pickMultiple(..., stageRng)`
- **不改** stage 函数的功能性逻辑（L229 cross-kind roll 保持原样，只是 rng 来源不同）
- args interface 里的 `rng` 字段删除或保留？→ **保留**（stage5/6 为了签名一致可选读，但 stage1-4 实际用 stageRng）

**rng-inventory.md schema（严格格式）**:
```markdown
| stage | half | file | line | call_type | expr_before | expr_after | helper_name | helper_location | old_source | new_source | bridge_check | notes |
|-------|------|------|------|-----------|-------------|-----------|-------------|-----------------|-----------|-----------|--------------|-------|
| 1 | — | stage1-base-visit-state.ts | 38 | direct | `rng()` | `stageRng()` | — | — | consts.rng | stageSeeds.stage1 | safe(local) | progressNoise |
| 3 | — | stage3-subjective-narrative.ts | 60 | helper | `pickSingle(..., rng, ...)` | `pickSingle(..., stageRng, ...)` | pickSingle | shared-helpers.ts:348 | consts.rng | stageSeeds.stage3 | safe(shared-helpers-only) | initial symptomChange |
```
所有 39 行一份。

**关键规则**：call 次数**逐 stage 保持不变**（仅换 source）。

### Step 3.2 — 实现层 grep assertion（~2 tc）

完成 Step 3.1 后：
```bash
# 应仅匹配 stageRng 相关行（stage args 解构、stageRng() call）
grep -nE "rng\b" src/generator/sub-engines/stages/stage{1,2,3,4}*.ts | grep -v "stageRng\|//" | wc -l
# 期望 = 0（全部 rng 引用都是 stageRng 或注释）
```
若 > 0 → 有未改的 `rng()` 或 `consts.rng` → HALT 回 Step 3.1

### Step 4 — snapshot 重录（~10 tc）
```bash
# 重录
npm test -- fixture-snapshots -u
npm test -- fixture-snapshots  # 再跑一次确认 0 diff

# 4 IE/RE 块整块 hash 对比（awk 按 exports[...] 边界切分）
awk '
  /^exports\[/ { name = $0; buf = "" }
  { buf = buf "\n" $0 }
  /^`;$/ { print name "::" buf | "sha256sum" ; close("sha256sum") }
' __snapshots__/fixture-snapshots.test.ts.snap > /tmp/snap-hash-after.txt
# pre-Phase4 版本同样处理
git show b118b53:src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap | awk '...' > /tmp/snap-hash-before.txt
# 对 4 IE/RE fixture name 逐条 hash 比较 must equal
for name in LBP-IE-new-patient KNEE-IE-existing-patient SHOULDER-RE-midcourse NECK-RE-latecourse; do
  before=$(grep "$name" /tmp/snap-hash-before.txt)
  after=$(grep "$name" /tmp/snap-hash-after.txt)
  test "$before" = "$after" || echo "HALT: $name hash changed"
done
# 51 TX blocks 应 changed（git diff）
git diff --stat src/generator/__fixtures__/__snapshots__/ | grep -oE "[0-9]+ insertions" | head -1
```

**HALT 条件**: 4 IE/RE 任一 hash 变 → 回 Step 3 排查范围逸出。

### Step 5 — 20 fixture 人审 HALT（~3 tc + 用户 1 hr）

**清单（锁定，20 条）**：

| # | Name | Source |
|---|------|--------|
| 1 | LBP-bilateral-early-3tx | tier-b-step-1 Core |
| 2 | SHOULDER-left-late-20tx | tier-b-step-1 Core |
| 3 | SHOULDER-bilateral-mid-12tx | tier-b-step-1 Core |
| 4 | KNEE-right-late-18tx | tier-b-step-1 Core |
| 5 | NECK-bilateral-late-20tx | tier-b-step-1 Core |
| 6 | ELBOW-left-late-20tx | tier-b-step-1 Core |
| 7 | MID_LOW_BACK-bilateral-late-20tx | tier-b-step-1 Core |
| 8 | LBP-bilateral-maxpain-12tx | tier-b-step-1 Edge |
| 9 | SHOULDER-bilateral-minpain-12tx | tier-b-step-1 Edge |
| 10 | KNEE-bilateral-single-1tx | tier-b-step-1 Edge |
| 11 | LBP-left-unilateral-20tx | tier-b-step-1 Edge |
| 12 | SHOULDER-right-highpain-long-20tx | tier-b-step-1 Edge |
| 13 | NECK-bilateral-pacemaker-12tx | tier-b-step-1 Edge |
| 14 | LBP-bilateral-medhx-DM-HTN-12tx | tier-b-step-1 Edge |
| 15 | KNEE-left-realisticpatch-12tx | tier-b-step-1 Edge |
| 16 | MIDDLE_BACK-bilateral-mid-12tx | tier-b-step-1 Edge |
| **17** | **LBP+NECK-bilateral-mid-10tx** | W1 multi-bodypart |
| **18** | **LBP-continue-from-tx8-10tx** | W1 continue-mode |
| **19** | **KNEE-weakness-right-10tx** | W1 assoc-symptom |
| **20** | **SHOULDER-young-female-25yo-8tx** | W1 demographics |

Claude 生成每条 3-visit diff snippet 写 `.claude-state/signoff-week2.md`，HALT。

### Step 6a — P14a deriveSubSeed stage-level derivation isolation（~8 tc）

```typescript
test('P14a: stage isolation via deriveSubSeed — perturbing one stage does not shift others', () => {
  // v3 bug: 两侧都用 seedA，seedB 从未实际使用 → vacuously pass
  // v4 fix: 构造真实两套 bag，perturbed bag 中 pert stage 用 seedB，其他用 seedA
  type Pair = ['stage1'|'stage2'|'stage3'|'stage4', SubEngineKind]
  const PAIRS: Pair[] = [
    ['stage1', 'pain'], ['stage2', 'symptom'],
    ['stage3', 'reason'], ['stage4', 'muscles']
  ]
  const SAMPLE_COUNT = 32  // cover stage3/4 深度使用（v3 只 5 太浅）

  const buildBag = (pertLabel: Pair[0] | null, seedA: number, seedB: number, visitIndex: number) => {
    const bag: Record<string, () => number> = {}
    for (const [label, kind] of PAIRS) {
      const useSeed = (label === pertLabel) ? seedB : seedA
      bag[label] = createSeededRng(deriveSubSeed(useSeed, kind, visitIndex)).rng
    }
    return bag
  }
  const sample = (rng: () => number, n: number) => {
    const out: number[] = []
    for (let i = 0; i < n; i++) out.push(rng())
    return out
  }

  fc.assert(fc.property(
    fc.integer({ min: 1, max: 1_000_000 }),
    fc.integer({ min: 1, max: 1_000_000 }),
    fc.integer({ min: 0, max: 20 }),
    (seedA, seedB, visitIndex) => {
      if (seedA === seedB) return true
      const baseBag = buildBag(null, seedA, seedB, visitIndex)
      const baseSamples: Record<string, number[]> = {}
      for (const [label] of PAIRS) baseSamples[label] = sample(baseBag[label], SAMPLE_COUNT)

      for (const [pertLabel] of PAIRS) {
        const pertBag = buildBag(pertLabel, seedA, seedB, visitIndex)
        for (const [otherLabel] of PAIRS) {
          if (otherLabel === pertLabel) continue
          const perturbed = sample(pertBag[otherLabel], SAMPLE_COUNT)
          for (let k = 0; k < SAMPLE_COUNT; k++) {
            if (perturbed[k] !== baseSamples[otherLabel][k]) return false
          }
        }
      }
      return true
    }
  ), { numRuns: 50, seed: 2026 })
})
```

### Step 6b — P14b runtime guard: stage code does not read consts.rng（~6 tc）

```typescript
test('P14b: runtime guard — stage1-4 never read consts.rng', () => {
  // Build context + options + wrap consts.rng with a throwing spy.
  // If any stage function actually consumes consts.rng instead of stageRng,
  // this test throws. Pass = stage code 真的绕过 main rng.
  setWhitelist(whitelistData as Record<string, string[]>)
  const context: GenerationContext = {
    noteType: 'TX', insuranceType: 'OPTUM', primaryBodyPart: 'LBP',
    laterality: 'bilateral', painCurrent: 7,
    severityLevel: 'moderate to severe',
    chronicityLevel: 'Chronic', localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Yang Deficiency', associatedSymptoms: ['soreness'],
  }
  // Patch: monkeypatch createSeededRng temporarily? Or use module-level hook?
  // Simpler: run generateTXSequenceStates with a spy on consts.rng via
  // intercepting createSeededRng output. Since main consts.rng is created
  // inside engine-init, we can't easily inject throwing one without mocking.
  // Alternative approach: inspect stage4's output for seed-dependent fields
  // known to be determined by stage4 stream, assert mainSeed change doesn't
  // shift stage3's known outputs.
  //
  // Chosen implementation: after wiring, run two invocations of the engine:
  //   invocation A: normal
  //   invocation B: same context/options BUT mainSeed differs ONLY via a
  //     monkey-patched deriveSubSeed that changes output ONLY for kind='muscles'
  //     (leaving pain/symptom/reason derivation bit-identical)
  //   Assert: stage1/2/3 output fields bit-identical between A and B
  //           (stage4 fields legitimately differ)
  // This proves stages 1/2/3 don't read main rng indirectly.
  //
  // If monkey-patch infeasible due to ESM, fall back to a simpler check:
  // grep assertion is AC1 already; skip runtime guard and raise note in ADR.

  // IMPLEMENTATION NOTE for Phase 4: if module import immutability blocks
  // monkey-patch, fall back to AC1 grep assertion + manual inspection
  // entry in verify-log; do NOT silently skip this test.
})
```

**Phase 4 实现时**：若 monkey-patch deriveSubSeed 可行，写完整 test；若因 ESM 不可行，在 verify-log 记录 "P14b degraded to AC1 grep assertion + manual inspection"（这是 acceptable fallback，因 AC1 grep 已经能检查 `consts.rng` 未被引用）。

### Step 7 — 文档 + ADR D42（~8 tc）

**7a** `docs/ARCHITECTURE.md` 新增 "## Sub-seed runtime wiring (Tier B step 2, 2026-04-20)"，含：
- 设计：per-stage 独立 PRNG 流，SubEngineKind 复用 4 个值（rom unused）
- stage → kind 映射表
- 独立性 scope（stage-runtime only，init-time 耦合仍在）
- 验证：P14 + 51 TX snapshot rebase

**7b** `docs/decisions.md` ADR D42（5 段）：
```markdown
| D42 | Sub-seed runtime wiring at per-stage granularity (Tier B step 2) | 

**Decision**: stage1-4 各自从独立 PRNG 流（createSeededRng(deriveSubSeed(mainSeed, kind, visitIndex))）取随机数；stage 到 kind 映射：stage1→pain, stage2→symptom, stage3→reason, stage4→muscles。stage5/6 无 rng。

**Consequences**:
- 51 TX fixture snapshot rebaseline（20 条人审签字 + 31 条自动 approve）
- 改任一 stage 函数内 rng 使用不影响其他 stage 的 rng 流（P14 证）
- Engine-init 阶段 `computeGoalPaths(..., rng)` 仍共享 main rng（known limitation）

**Known Limitation**: init-time goal-path scheduling 跨 kind 共享 main rng。改 goal-path-calculator 内算法仍牵动全部 sub-engine 输出。不在本 run scope。

**Future Work**: 独立任务将 `computeGoalPaths` 内 rng 流拆分到 per-kind 或 per-goal 流；需要对 goal-path-calculator 的 ~15 个 rng 消费点做侵入性重构 + 30-55 snapshot 再 rebaseline。

**Alternatives Rejected**:
- **Per-kind runtime wiring（5 kinds: pain/muscles/rom/reason/symptom）**: Codex v2 review 发现 stage4:229 `if (rng() > 0.5)` 决定 strengthTrend 或 romTrend 是跨 kind roll，无单 kind 归属；sideProgress 等输出依赖多 kind 输入导致 P14 NON_K_FIELDS 矩阵复杂易漏；helper pass-through 让 inventory 超 40 个 call sites 难追踪。**Rejected** 因复杂度与 W2 scope 不匹配。
- **Keep main rng, document as non-goal**: 彻底放弃独立性会让 W3/W4 的引擎改动继续产生全局 snapshot diff，roadmap "改引擎不痛" 基石不落地。**Rejected**。
|
```

### Step 8 — Verify 收口（~5 tc）
- 全套 test + tsc
- 对比 baseline 不扩大
- 填 verify-log

## 影响范围

| 模块 | 改动 | 风险 |
|------|------|------|
| `tx-sequence-engine.ts` 主循环 | stageSeeds 构造 + 传参 | 中 |
| `stages/stage1-4.ts` | rng → stageRng | 低-中：机械替换 |
| `types.ts` | +StageLabel/STAGE_TO_KIND/StageSeedBag | 低 |
| `fixture-snapshots.test.ts.snap` | 51 TX 重录 | 中：4 IE/RE 必须 0-diff |
| `pipeline.fuzz.test.ts` | +P14 | 低 |
| `ARCHITECTURE.md`, `decisions.md` | +节 +ADR | 低 |

**关键不变量**:
- rng call 次数逐 stage 不变（只换 source）
- 4 IE/RE snapshot 必须 0-diff
- helper 签名不变
- engine-init.ts 不动

## Tool Call 预算

| Step | tc |
|------|----|
| 0 baseline | 2 |
| 1 types | 6 |
| 2 loop inject | 6 |
| 3.0 inventory lock-in | 2 |
| 3.1 stages 替换 | 25 |
| 3.2 grep assertion | 2 |
| 4 snapshot rebase + 4 IE/RE hash verify | 10 |
| 5 W2.4 HALT (20 fixture) | 3 |
| 6a P14a derivation isolation | 8 |
| 6b P14b runtime guard (or degrade) | 6 |
| 7 ADR D42 + ARCHITECTURE | 8 |
| 8 verify | 5 |
| subtotal | 83 |
| Phase 5 Codex + 调试 buffer | 20 |
| **total** | **~103** |

## HALT 条件
- Step 0 baseline 失败集合扩大 → HALT
- Step 4 任一 IE/RE snapshot 有 diff → HALT（说明改动超出 tx-sequence-engine）
- Step 4 任一 TX snapshot 0-diff → HALT（说明某 stage rng 未真换流）
- Step 5 任一 fixture REJECT → 回 Step 3
- Codex Phase 5 intent_gap/bad_spec → 回 Phase 1
- 连续 5 次 verify-fix → HALT
