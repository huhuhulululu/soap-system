# SymptomChange + Assessment 一致性修复 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 TX 引擎中 symptomChange 判定过度依赖 painDelta 的问题，使 Assessment 如实反映所有 S/O 维度变化，同时修复 IE causative/relieving fallback 和 TX reason 单一问题。

**Architecture:** 分 4 层修复：(1) 引入综合维度变化评分替代 painDelta 单一锚点 (2) 修复 symptomChange guard 双向逻辑 (3) 移除 Assessment present 强制覆盖 (4) 修复前端 fallback 和 reason 多样化。所有修改保持 PRNG 序列稳定（新 rng() 调用只加在循环末尾）。

**Tech Stack:** TypeScript, Vitest, tx-sequence-engine.ts, soap-generator.ts

**关键约束:**
- 30 个 fixture snapshot 会因输出变化需要 `--update` 重新生成
- 新 rng() 调用必须追加在循环末尾，否则整个 PRNG 序列偏移
- 2720 个现有测试中，引擎相关测试可能因行为变化需要调整阈值

**当前数据（修复前基线）:**
- painDelta>0.3 但说 "similar": 26.3%
- objective 有改善但说 "similar": 36.5%
- Assessment 自相矛盾（similar + decreased/reduced）: 34.6%

---

## 修复依赖图

```
Task 1 (综合评分函数) ← 无依赖
Task 2 (symptomChange guard) ← 依赖 Task 1
Task 3 (Assessment present 覆盖) ← 依赖 Task 2
Task 4 (deriveAssessmentFromSOA 扩展) ← 依赖 Task 1
Task 5 (IE causative/relieving) ← 无依赖，可并行
Task 6 (TX reason 2 个) ← 无依赖，可并行
Task 7 (snapshot 更新 + 回归验证) ← 依赖 Task 1-6 全部完成
```

---

### Task 1: 引入综合维度变化评分函数 `computeDimensionScore`

**问题:** 当前 symptomChange 判定和 Assessment 生成都以 `painDelta` 为唯一锚点。实际上有 10 个维度，任何一个变化都代表病情在变。

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (新增函数，约 line 500 附近)
- Test: `src/generator/__tests__/dimension-score.test.ts` (新建)

**设计:**

综合评分函数，10 个维度各自贡献分数，总分决定 symptomChange 和 Assessment 语气:
- 0 分: 真正的 "similar" — 所有维度都没变
- 0.01-0.15: "slight improvement" — 有轻微变化
- 0.15+: "improvement" — 有明显变化

权重: pain 0.25(按 delta 比例), symptomScale 0.12, severity 0.12, frequency 0.15, ADL 0.10, tightness/tenderness/spasm/ROM/strength 各 0.10。slightly reduced/improved 贡献半权重。

函数签名:
```typescript
export function computeDimensionScore(input: {
  painDelta: number;
  symptomScaleChanged: boolean;
  severityChanged: boolean;
  frequencyImproved: boolean;
  adlImproved: boolean;
  tightnessTrend: "reduced" | "slightly reduced" | "stable";
  tendernessTrend: "reduced" | "slightly reduced" | "stable";
  spasmTrend: "reduced" | "slightly reduced" | "stable";
  romTrend: "improved" | "slightly improved" | "stable";
  strengthTrend: "improved" | "slightly improved" | "stable";
}): { score: number; changedDims: string[] }
```

**Step 1: 写测试** `src/generator/__tests__/dimension-score.test.ts`

6 个测试用例:
1. 全部 stable → score=0, changedDims=[]
2. 只有 painDelta=0.5 → score~0.15, changedDims=["pain"]
3. painDelta=0 但 tightness reduced + ROM improved → score>=0.15, changedDims 含 tightness+ROM
4. symptomScale + severity 变化 → score>=0.2
5. 多维度同时改善 → score>=0.7, changedDims.length>=6
6. slightly reduced/improved 贡献半权重

**Step 2: 跑测试确认失败**
Run: `npx vitest run src/generator/__tests__/dimension-score.test.ts`
Expected: FAIL — `computeDimensionScore` 不存在

**Step 3: 实现函数**
在 `tx-sequence-engine.ts` 约 line 500 (在 `buildRuleContext` 之后) 添加函数并 export。

**Step 4: 跑测试确认通过**
Run: `npx vitest run src/generator/__tests__/dimension-score.test.ts`
Expected: PASS (6/6)

**Step 5: Commit**
```bash
git add src/generator/__tests__/dimension-score.test.ts src/generator/tx-sequence-engine.ts
git commit -m "feat: add computeDimensionScore for multi-dimension change detection"
```

---

### Task 2: 修复 symptomChange guard 双向逻辑

**问题:** 当前 guard (line 1307-1340) 有两个方向的 bug:
1. 向下 guard: `painDelta<=0 && !objectiveImproved` 忽略 frequency/ADL/symptomScale 变化
2. 向上 guard: `painDelta>=0.5` 只纠正 exacerbate→improvement，不纠正 similar→improvement
3. 缺失: 当 painDelta<0.3 但其他维度有改善时，不应该强制 similar

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts:1307-1340`
- Test: `src/generator/__tests__/symptom-change-guard.test.ts` (新建)

**新增输入:** 需要在循环中计算 `symptomScaleChanged` 和 `severityChanged`:
- `symptomScaleChanged`: 当前 visit 的 symptomScale !== 上一个 visit 的 symptomScale
- `severityChanged`: 当前 visit 的 severityLevel !== 上一个 visit 的 severityLevel

这两个变量不需要新 rng() 调用，纯比较即可。

**新 guard 逻辑 (替换 line 1307-1340):**

```typescript
// --- T02/T03 硬约束守卫: symptomChange 与综合维度变化一致 ---
const dimScore = computeDimensionScore({
  painDelta,
  symptomScaleChanged,
  severityChanged,
  frequencyImproved,
  adlImproved,
  tightnessTrend,
  tendernessTrend,
  spasmTrend,
  romTrend,
  strengthTrend,
});

if (dimScore.score === 0) {
  // 所有维度都没变: 强制 similar
  if (!symptomChange.includes("similar")) {
    symptomChange = "similar symptom(s) as last visit";
  }
} else if (dimScore.score > 0 && symptomChange.includes("similar")) {
  // 有维度变化但 pickSingle 选了 similar: 纠正为 improvement
  symptomChange = dimScore.score >= 0.15
    ? "improvement of symptom(s)"
    : "improvement of symptom(s)";  // slight 由 Assessment 层表达
} else if (dimScore.score >= 0.15 && symptomChange.includes("exacerbate")) {
  // 明显改善但说 exacerbate: 纠正
  symptomChange = "improvement of symptom(s)";
}

// 后期强制改善 — 保留原逻辑但用 dimScore 替代
if (progress > 0.7 && dimScore.score > 0 && !symptomChange.includes("improvement")) {
  symptomChange = "improvement of symptom(s)";
}
```

**关键变化:**
- `objectiveImproved` 被 `dimScore.score` 替代
- "similar" 只在 score=0 时才成立
- score>0 时 "similar" 被纠正为 "improvement"
- 不再有 painDelta 单独判定的分支

**新增变量计算 (在 guard 之前):**
```typescript
// 在 line ~1260 附近，severity 和 symptomScale 计算之后
const symptomScaleChanged = visits.length > 0
  ? visitSymptomScale !== visits[visits.length - 1].symptomScale
  : false;  // TX1 vs IE 的 symptomScale 变化
const severityChanged = visits.length > 0
  ? severityLevel !== visits[visits.length - 1].severityLevel
  : severityLevel !== initSeverity;
```

注意: `visitSymptomScale` 在 line 1714 才计算，但 symptomChange guard 在 line 1307。
需要把 symptomScale 计算提前到 guard 之前，或者用 `prevSymptomDecade` 的变化来判断。

**实际方案:** 用 `symptomDrop` (goalPaths 调度) 作为 symptomScaleChanged 的信号:
```typescript
const symptomScaleChanged = goalPaths.symptomScale.changeVisits.includes(i);
```
这不需要移动代码，因为 goalPaths 在循环外已经计算好了。

同理 severity:
```typescript
const severityChanged = severityLevel !== prevSeverity;
// 注意: prevSeverity 在 line 1051 更新，但 guard 在 line 1307
// prevSeverity 此时还是上一个 visit 的值，所以比较是正确的
// 但 line 1051 已经把 prevSeverity 更新了！需要在 1051 之前保存
```

**⚠️ 陷阱:** `prevSeverity` 在 line 1051 被更新为当前 visit 的 severityLevel。
所以在 guard (line 1307) 时 `prevSeverity` 已经是当前值了。
需要在 line 1029 之前保存 `prevSeveritySnapshot = prevSeverity`，然后在 guard 中用:
```typescript
const severityChanged = severityLevel !== prevSeveritySnapshot;
```

**Step 1: 写测试** `src/generator/__tests__/symptom-change-guard.test.ts`

测试用例 (用 generateTXSequenceStates 端到端验证):
1. 20 seeds, painDelta>0.3 的 visits 中 "similar" 比例 < 5% (当前 26.3%)
2. 20 seeds, objective 有改善但 painDelta<=0.3 的 visits 中 "similar" 比例 < 10% (当前 36.5%)
3. 20 seeds, dimScore=0 的 visits 必须全部是 "similar"
4. 20 seeds, Assessment 自相矛盾比例 < 5% (当前 34.6%)

**Step 2: 跑测试确认失败**
Run: `npx vitest run src/generator/__tests__/symptom-change-guard.test.ts`
Expected: FAIL (当前比例远超阈值)

**Step 3: 实现新 guard 逻辑**
修改 `tx-sequence-engine.ts`:
1. Line ~1029 前: 添加 `const prevSeveritySnapshot = prevSeverity;`
2. Line 1307-1340: 替换为新 guard 逻辑
3. 添加 `symptomScaleChanged` 和 `severityChanged` 计算

**Step 4: 跑测试确认通过**
Run: `npx vitest run src/generator/__tests__/symptom-change-guard.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/generator/__tests__/symptom-change-guard.test.ts src/generator/tx-sequence-engine.ts
git commit -m "fix: replace pain-centric symptomChange guard with multi-dimension score"
```

---

### Task 3: 移除 Assessment present 强制覆盖

**问题:** Line 1825-1830 在 `symptomChange` 含 "similar" 时强制覆盖 `assessmentFromChain.present` 为 "similar symptom(s) as last visit."。Task 2 修复后 "similar" 只在 score=0 时出现，此时覆盖是正确的。但为了安全，改为基于 dimScore 判断。

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts:1825-1830`
- Test: 复用 Task 2 的测试 (Assessment 矛盾比例 < 5%)

**修改:**

将 line 1825-1830:
```typescript
assessment: symptomChange.includes("similar")
    ? {
        ...assessmentFromChain,
        present: "similar symptom(s) as last visit.",
      }
    : assessmentFromChain,
```

改为:
```typescript
assessment: dimScore.score === 0
    ? {
        ...assessmentFromChain,
        present: "similar symptom(s) as last visit.",
      }
    : assessmentFromChain,
```

**⚠️ 作用域问题:** `dimScore` 在 line ~1307 计算，`soaChain` 在 line ~1808 组装。
`dimScore` 是 `const`，在同一个循环迭代内，作用域没问题。

**Step 1: 确认 Task 2 的 Assessment 矛盾测试已通过**

**Step 2: 修改 line 1825-1830**

**Step 3: 跑全量引擎测试确认无新增失败**
Run: `npx vitest run src/generator/__tests__/ --reporter=verbose 2>&1 | tail -10`

**Step 4: Commit**
```bash
git add src/generator/tx-sequence-engine.ts
git commit -m "fix: base Assessment present override on dimScore instead of symptomChange text"
```

---

### Task 4: 扩展 deriveAssessmentFromSOA 输入和 whatChanged 逻辑

**问题:**
1. `deriveAssessmentFromSOA` 缺少 symptomScale/severity 输入
2. `present` 完全由 pain 决定 (cumulativePainDrop + painDelta)
3. `whatChanged` 限制最多 2 项 (`parts.length < 2`)
4. S 侧变化 (symptomScale, severity) 不在 whatChanged 也不在 findingType

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (deriveAssessmentFromSOA 函数 + 调用处)
- Modify: `src/generator/__tests__/derive-assessment.test.ts`

**修改 1: 扩展输入接口 (line 313-336)**

新增字段:
```typescript
export function deriveAssessmentFromSOA(input: {
  // ... 现有字段 ...
  dimScore: number;           // 新增: 综合维度评分
  changedDims: string[];      // 新增: 变化的维度列表
  symptomScaleChanged: boolean; // 新增
  severityChanged: boolean;     // 新增
}): { ... }
```

**修改 2: present 用 dimScore 替代 pain (line 338-345)**

```typescript
// 旧:
const strongCumulative = input.cumulativePainDrop >= 3.0 && input.progress >= 0.5;
const visitLevelStrong = input.painDelta >= 0.7;
const present = strongCumulative || visitLevelStrong
  ? "improvement of symptom(s)."
  : "slight improvement of symptom(s).";

// 新:
const strongCumulative = input.cumulativePainDrop >= 2.5 && input.progress >= 0.4;
const visitLevelStrong = input.dimScore >= 0.3;
const present = input.dimScore === 0
  ? "similar symptom(s) as last visit."
  : strongCumulative || visitLevelStrong
    ? "improvement of symptom(s)."
    : "slight improvement of symptom(s).";
```

**修改 3: whatChanged 列出所有变化维度，移除 `parts.length < 2` 限制 (line 350-393)**

```typescript
const whatChanged = (() => {
  const parts: string[] = [];

  // S 侧维度
  if (input.frequencyImproved) parts.push("pain frequency");
  if (input.painDelta > 0.3) parts.push("pain");
  if (input.adlDelta > 0.2) parts.push("difficulty in performing ADLs");
  if (input.symptomScaleChanged) parts.push("muscles soreness sensation");
  if (input.severityChanged) parts.push("severity level");

  // Fallback: 如果 S 侧没有变化但 O 侧有，用通用描述
  if (parts.length === 0 && input.dimScore > 0) {
    parts.push("pain");  // 兜底
  }

  if (parts.length === 0) return "pain";
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
})();
```

注意: 移除了 `hasStrongObjective && parts.length < 2` 的限制。O 侧变化由 `findingType` 负责，`whatChanged` 只负责 S 侧。

**修改 4: 调用处传入新参数 (line 1694-1707)**

```typescript
const assessmentFromChain = deriveAssessmentFromSOA({
  painDelta,
  adlDelta,
  frequencyImproved,
  visitIndex: i,
  objectiveTightnessTrend: tightnessTrend,
  objectiveTendernessTrend: tendernessTrend,
  objectiveSpasmTrend: spasmTrend,
  objectiveRomTrend: romTrend,
  objectiveStrengthTrend: strengthTrend,
  cumulativePainDrop,
  progress,
  bodyPart: context.primaryBodyPart || "LBP",
  // 新增:
  dimScore: dimScore.score,
  changedDims: dimScore.changedDims,
  symptomScaleChanged,
  severityChanged,
});
```

**Step 1: 更新测试** `src/generator/__tests__/derive-assessment.test.ts`

新增/修改测试:
1. dimScore=0 → present 含 "similar"
2. dimScore=0.4 → present 含 "improvement"
3. symptomScaleChanged=true → whatChanged 含 "muscles soreness sensation"
4. severityChanged=true → whatChanged 含 "severity level"
5. 多维度变化 → whatChanged 列出所有 S 侧变化

**Step 2: 跑测试确认失败**

**Step 3: 实现修改**

**Step 4: 跑测试确认通过**
Run: `npx vitest run src/generator/__tests__/derive-assessment.test.ts`

**Step 5: Commit**
```bash
git add src/generator/__tests__/derive-assessment.test.ts src/generator/tx-sequence-engine.ts
git commit -m "feat: extend deriveAssessmentFromSOA with dimScore and full S-side coverage"
```

---

### Task 5: 修复 IE causativeFactors / relievingFactors fallback

**问题:** 前端 `useSOAPGeneration.ts` line 89 的 fallback 是 `['age related/degenerative changes']`（1 项），line 90-94 的 relievingFactors fallback 是 3 项但用户可能只选了 1 项。这些非空数组被传给 `soap-generator.ts`，后者看到 `context.causativeFactors.length > 0` 就直接用了，跳过了 `selectBestOptions(weighted, 3)` 的权重选择。

**Files:**
- Modify: `frontend/src/composables/useSOAPGeneration.ts:89-94`
- Test: `frontend/src/engine.test.ts` (已有，需确认覆盖)

**修改:**

```typescript
// 旧:
causativeFactors: (fields['subjective.causativeFactors'] as string[]) || ['age related/degenerative changes'],
relievingFactors: (fields['subjective.relievingFactors'] as string[]) || [
  'Changing positions',
  'Resting',
  'Massage',
],

// 新: 空数组让权重系统运行
causativeFactors: (fields['subjective.causativeFactors'] as string[]) || [],
relievingFactors: (fields['subjective.relievingFactors'] as string[]) || [],
```

**Step 1: 写测试**

在 `frontend/src/engine.test.ts` 中确认已有测试覆盖 IE 输出包含多个 causative/relieving。
如果没有，新增:

```typescript
it('IE 输出包含 2-3 个 causativeFactors (权重系统)', () => {
  const ctx = makeContext({ noteType: 'IE' })
  // 不传 causativeFactors，让权重系统运行
  delete (ctx as any).causativeFactors
  const text = exportSOAPAsText(ctx)
  // "due to X, Y, Z" 或 "because of X, Y, Z"
  const match = text.match(/(?:due to|because of) (.+?)\./);
  expect(match).toBeTruthy()
  const factors = match![1].split(', ')
  expect(factors.length).toBeGreaterThanOrEqual(2)
})

it('IE 输出包含 2-3 个 relievingFactors (权重系统)', () => {
  const ctx = makeContext({ noteType: 'IE' })
  delete (ctx as any).relievingFactors
  const text = exportSOAPAsText(ctx)
  // "X, Y, Z can temporarily relieve"
  const match = text.match(/(.+?) can temporarily relieve/);
  expect(match).toBeTruthy()
  const factors = match![1].split(', ')
  expect(factors.length).toBeGreaterThanOrEqual(2)
})
```

**Step 2: 跑测试确认失败**
Run: `npx vitest run frontend/src/engine.test.ts`
Expected: FAIL (当前只有 1 个 factor)

**Step 3: 修改 useSOAPGeneration.ts**

**Step 4: 跑测试确认通过**

**Step 5: Commit**
```bash
git add frontend/src/composables/useSOAPGeneration.ts frontend/src/engine.test.ts
git commit -m "fix: remove hardcoded IE causative/relieving fallback, let weight system run"
```

---

### Task 6: TX reason 支持 2 个原因

**问题:** `reason` 通过 `pickSingle` 只选 1 个。Subjective 模板 line 2257 也只插入 1 个 reason。用户要求 2-3 个 reason 更真实。

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (reason 选择逻辑，line ~1453-1519)
- Modify: `src/generator/tx-sequence-engine.ts` (TXVisitState interface, line 116)
- Modify: `src/generator/soap-generator.ts:2257` (渲染模板)
- Test: `src/generator/__tests__/reason-diversity.test.ts` (已有，需扩展)

**⚠️ PRNG 约束:** 当前 reason 选择在 shuffle bag 中消耗 1 个 rng() 调用 (line 1464/1490/1511) + 1 个 connector rng() (line 1475/1500)。新增第 2 个 reason 需要额外 1 个 rng() 调用。

**方案:** 在现有 reason 选择之后，从 shuffle bag 中再取 1 个作为 `reason2`。这个额外的 rng() 调用在 reason 选择块内部，不影响后续维度的 rng 序列（因为 reason 选择本身就在循环中间，后续代码不依赖 reason 选择的 rng 调用数量——但需要验证！）

**验证 rng 调用数量影响:**
当前每个 visit 的 rng 调用序列:
1. `_adlRng1` (line 1019)
2. `_adlRng2` (line 1020)
3. `_freqRng` (line 1083)
4. `bounceRng` (line 1096)
5. `tenderBounceRng` (line 1126)
6. `spasmBounceRng` (line 1166)
7. `rng()` for spasm (line 1189)
8. `rng()` for ROM deficit (line 1207)
9. `rng()` for strength (line 1213)
10. `pickSingle("symptomChange")` → 1 rng (line 1278)
11. `pickSingle("reasonConnector")` → 1 rng (line 1347)
12. `pickSingle("reason")` → 1 rng (line 1354)
13. shuffle bag pick → 1 rng (line 1464/1490/1511)
14. connector variation → 1 rng (line 1475/1500)
15-28. 后续 rng 调用...

新增 1 个 rng() 在 step 14 之后，会偏移 step 15+ 的所有 rng 调用。这意味着所有 30 个 snapshot 都会变化，以及所有依赖 PRNG 序列的测试。

**这是可接受的** — Task 7 会统一更新 snapshot。但需要确保新增的 rng() 调用在所有 4 个分支 (improvement/exacerbate/similar/cameBack) 中都存在，保持调用数量一致。

**实现:**

1. 在 `TXVisitState` interface 中 `reason` 改为 `reason: string` 保持不变（存储 join 后的字符串）

2. 在每个 shuffle bag 分支末尾，再取 1 个 reason2:

```typescript
// improvement 分支 (line ~1465 之后):
let reason2 = "";
if (positiveShuffleBag.length > 0) {
  const pickIdx2 = Math.floor(rng() * positiveShuffleBag.length);
  reason2 = positiveShuffleBag[pickIdx2];
  positiveShuffleBag = [
    ...positiveShuffleBag.slice(0, pickIdx2),
    ...positiveShuffleBag.slice(pickIdx2 + 1),
  ];
} else {
  rng(); // 保持 rng 调用数量一致
}
finalReason = reason2 ? `${finalReason} and ${reason2}` : finalReason;
```

对 similar/exacerbate/cameBack 分支做同样处理。

3. 如果 `pickSingle` 选了 "similar" 但 guard 纠正为 "improvement"，reason 分支可能不匹配。
   但 Task 2 已经修复了 guard，所以 `isSimilar`/`isImprovement` 在 reason 选择时已经是正确的。

4. soap-generator.ts line 2257 不需要改 — `selectedReason` 已经是 join 后的字符串。

**Step 1: 扩展测试** `src/generator/__tests__/reason-diversity.test.ts`

新增:
```typescript
it('improvement visits 的 reason 包含 "and" (2 个原因)', () => {
  const ctx = makeContext()
  let hasAnd = 0, total = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const { states } = generateTXSequenceStates(ctx, { txCount: 11, seed: seed * 1000 })
    for (const s of states) {
      if (s.symptomChange.includes('improvement')) {
        total++;
        if (s.reason.includes(' and ')) hasAnd++;
      }
    }
  }
  // 至少 80% 的 improvement visits 有 2 个 reason
  expect(hasAnd / total).toBeGreaterThanOrEqual(0.8)
})
```

**Step 2: 跑测试确认失败**

**Step 3: 实现修改**

**Step 4: 跑测试确认通过**

**Step 5: Commit**
```bash
git add src/generator/__tests__/reason-diversity.test.ts src/generator/tx-sequence-engine.ts
git commit -m "feat: TX reason supports 2 reasons joined with 'and'"
```

---

### Task 7: Snapshot 更新 + 全量回归验证

**问题:** Task 1-6 的修改会改变引擎输出，30 个 fixture snapshot 需要更新，部分测试阈值可能需要调整。

**Files:**
- Update: `src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap`
- Possibly adjust: 多个 `__tests__/*.test.ts` 文件的阈值

**Step 1: 更新 snapshot**
```bash
npx vitest run src/generator/__fixtures__/fixture-snapshots.test.ts --update
```

**Step 2: 跑全量测试**
```bash
npx vitest run --reporter=verbose 2>&1 | tail -20
```

**Step 3: 逐个修复失败的测试**

预期可能失败的测试:
1. `derive-assessment.test.ts` — 接口变了，需要传入新参数
2. `engine-stress-audit.test.ts` — reason 格式变了（含 "and"）
3. `granularity-phase-d.test.ts` — reason 唯一值数量可能变化
4. `assessment-cumulative.test.ts` — present 判定逻辑变了
5. `assessment-dynamic.test.ts` — 同上
6. `medical-history.test.ts` — seed 可能需要调整
7. `granularity-phase-e.test.ts` — seed 可能需要调整

修复原则:
- 接口变化: 补充新参数
- 阈值变化: 根据新行为调整（不是放宽，是对齐新逻辑）
- seed 变化: 如果 PRNG 偏移导致特定 seed 不满足条件，换 seed

**Step 4: 验证修复后指标**

运行诊断脚本确认:
```bash
npx tsx -e "
import { generateTXSequenceStates } from './src/generator/tx-sequence-engine.ts';
const ctx = { noteType:'TX', insuranceType:'OPTUM', primaryBodyPart:'LBP', laterality:'bilateral', localPattern:'Qi Stagnation', systemicPattern:'Kidney Yang Deficiency', chronicityLevel:'Chronic', severityLevel:'moderate to severe', painCurrent:7, associatedSymptom:'soreness' };
let similarWithDelta=0, totalDelta=0, similarWithObj=0, totalObj=0, contradictions=0, totalVisits=0;
for (let seed=10000; seed<10020; seed++) {
  const r = generateTXSequenceStates(ctx, { txCount:12, seed, initialState:{pain:7,associatedSymptom:'soreness'} });
  let prevPain=7;
  for (const s of r.states) {
    totalVisits++;
    const delta=prevPain-s.painScaleCurrent;
    const obj=s.soaChain.objective;
    const objI=obj.tightnessTrend!=='stable'||obj.tendernessTrend!=='stable'||obj.spasmTrend!=='stable'||obj.romTrend!=='stable'||obj.strengthTrend!=='stable';
    if(delta>0.3){totalDelta++;if(s.symptomChange.includes('similar'))similarWithDelta++;}
    if(delta<=0.3&&objI){totalObj++;if(s.symptomChange.includes('similar'))similarWithObj++;}
    const a=s.soaChain.assessment;
    if(a.present.includes('similar')&&(a.patientChange.includes('decreased')||a.physicalChange!=='remained the same'))contradictions++;
    prevPain=s.painScaleCurrent;
  }
}
console.log('painDelta>0.3 + similar:', (similarWithDelta/totalDelta*100).toFixed(1)+'%', '(target: <5%)');
console.log('obj improved + similar:', (similarWithObj/totalObj*100).toFixed(1)+'%', '(target: <10%)');
console.log('Assessment contradictions:', (contradictions/totalVisits*100).toFixed(1)+'%', '(target: <5%)');
"
```

**目标指标:**
- painDelta>0.3 但说 "similar": < 5% (从 26.3% 降)
- objective 有改善但说 "similar": < 10% (从 36.5% 降)
- Assessment 自相矛盾: < 5% (从 34.6% 降)

**Step 5: 全量测试最终确认**
```bash
npx vitest run 2>&1 | tail -5
```
Expected: 2720+ tests passing, 0 failures (除 2 个 pre-existing: useDiffHighlight + api-routes)

**Step 6: Commit**
```bash
git add -A
git commit -m "fix: update snapshots and test thresholds for multi-dimension symptomChange"
```

---

## 风险清单

| 风险 | 影响 | 缓解 |
|------|------|------|
| PRNG 序列偏移 (Task 6 新增 rng) | 所有 30 snapshot 变化 | Task 7 统一更新 |
| symptomChange 全部变成 improvement | 失去 "similar" 的真实性 | dimScore=0 时仍强制 similar |
| reason "and" 连接导致句子过长 | 可读性下降 | 限制 2 个 reason，不超过 3 个 |
| deriveAssessmentFromSOA 接口变化 | 所有调用处需更新 | 只有 1 个调用处 (line 1694) |
| 前端 fallback 改空数组 | 用户未选时 IE 输出可能不同 | 权重系统有完善的 body-part 特化逻辑 |
| 现有测试 seed 不再满足条件 | 测试失败 | Task 7 逐个调整 seed |
