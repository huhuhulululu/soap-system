# SOAP 批量随机生成测试脚本 — 计划（最小引入版 v2）

## 目标

用**随机 seed 反复大量**生成 SOAP IE + TX，做两类校验：

1. **单个 seed：生成 SOAP 与输入值的一致性** — 发现输出与输入不符的异常。
2. **纵向：TX 序列逻辑变化 + SOA 链 + 文本完整性** — 发现违反单调性/逻辑/生成完整性的异常点。

---

## 最小引入原则

- **不新增文件**：批量逻辑放在现有 `engine-random.test.ts` 内，新增一个 `describe.skipIf` 块。
- **不新增共享模块**：不抽 `engine-test-utils.ts`；批量内用与现有用例**完全相同**的校验条件（22 条全覆盖），以「收集失败」代替 `expect`，最后汇总断言。
- **不扩展随机输入**：沿用现有 `generateRandomInput(seed)` 的字段。
- **不做可选扩展**：v1 不做 IE 文本解析（Pain W/B 等）、不写报告文件；仅控制台汇总 + 明细。

### 已知局限（v1 接受）

`generateRandomInput` 不覆盖 `recentWorse`、`medicalHistory`、`age`、`gender`；这些字段在 IE 文本中走默认值，不做输入一致性校验。日后需要时在 `generateRandomInput` 中补一次即可，两处测试共用。

---

## 1. 脚本定位与运行方式

| 项目 | 方案 |
|------|------|
| **位置** | `frontend/src/engine-random.test.ts` 末尾 |
| **触发** | `describe.skipIf(!process.env.BULK_SEED_COUNT)` — 仅设置环境变量时才跑，否则整个 describe 不出现在输出中 |
| **量级** | `BULK_SEED_COUNT` 建议 100～500 |
| **超时** | 单 it 设 `{ timeout: 120_000 }`，避免大量 seed 超时 |

---

## 2. 输入与生成流程

- 完全复用现有 `generateRandomInput(seed)`，不改动。
- **Seed 生成公式**：`(_, i) => (i + 20) * 6271 + 1337`，与现有 20 组 `i * 7919 + 42` **不重叠**，覆盖新输入空间。

---

## 3. 校验清单（22 条全覆盖）

### 校验一：SOAP 与输入值的一致性（9 条）

| # | 检查项 | 做法 |
|---|--------|------|
| 1 | IE 含 Pain Current | `ieText.includes('Current: ' + pain)` |
| 2 | IE 含 Duration | `ieText.includes(value + ' ' + unit)` |
| 3 | IE 含 Radiation | `ieText.includes(painRadiation)` |
| 4 | IE 含每个 Causative Factor | 遍历 causativeFactors |
| 5 | IE 含每个 Relieving Factor | 遍历 relievingFactors |
| 6 | TX1 继承 associatedSymptom | `states[0].associatedSymptom === initialState.associatedSymptom` |
| 7 | TX1 继承 painTypes | deepEqual |
| 8 | TX1 pain ≤ 输入 | `states[0].painScaleCurrent <= pain` |
| 9 | TX1 symptomScale ≤ 输入 | `extractSymptomPct` 比较 |

### 校验二：纵向单调性（8 条）

| # | 规则 | 做法（相邻 TX 比较） |
|---|------|------|
| 10 | Pain 单调不升 | painScaleCurrent |
| 11 | Severity 单调不升 | SEVERITY_ORDER indexOf |
| 12 | AssociatedSymptom 等级不升 | symptomRank |
| 13 | Spasm 单调不升 | extractSpasmLevel |
| 14 | Frequency 单调不升 | extractFrequencyLevel |
| 15 | SymptomScale 单调不升 | extractSymptomPct |
| 16 | Progress 单调不减 | progress 值 |
| 17 | Severity ≤ severityFromPain | 对每个 state |

### 校验三：SOA 链关联性（5 条）

| # | 规则 | 做法 |
|---|------|------|
| 18 | 后期 symptomChange 倾向改善 | progress > 0.7 的 TX → symptomChange 含 'improvement' |
| 19 | Assessment present 含 improvement | 所有 TX → present 含 'improvement' |
| 20 | Assessment physicalChange 与 O 趋势一致 | O 有改善 → A 不为 'remained the same' |
| 21 | Frequency chain | S frequency 改善 → A whatChanged = 'pain frequency' |
| 22-a | IE 含 S/O/A/P 四段 | ieText 包含四个关键词 |
| 22-b | 所有 TX 含四段且 >200 字符 | 遍历 txTexts |
| 22-c | TX 含 Inspection | toLowerCase 包含 |
| 22-d | TX 含 tongue 和 pulse | toLowerCase 包含 |

> 22a-22d 为文本完整性，可捕捉**生成崩溃/模板缺失**。

---

## 4. 失败记录与汇总

每条失败/异常记为统一结构：

```ts
type BulkFailure = {
  seed: number
  check: string       // 如 'IE Pain Current', 'pain 单调', 'Assessment present'
  visitIndex?: number  // 纵向异常时的 TX 索引
  expected?: unknown
  actual?: unknown
}
```

最后输出两段：

1. **按 metric 分组汇总** — 一目了然哪类规则薄弱：
   ```
   ┌─────────────────────┬───────┐
   │ check               │ count │
   ├─────────────────────┼───────┤
   │ pain 单调不升        │     3 │
   │ Assessment present  │     1 │
   │ ...                 │   ... │
   └─────────────────────┴───────┘
   ```
2. **前 30 条失败明细** — 便于用 seed 复现。

---

## 5. 实现形态（最小）

在 `engine-random.test.ts` 末尾增加约 80 行：

```ts
const BULK_N = process.env.BULK_SEED_COUNT ? parseInt(process.env.BULK_SEED_COUNT, 10) : 0

describe.skipIf(BULK_N <= 0)(`Bulk 批量随机 (${BULK_N} seeds)`, () => {
  it('所有 seed 的输入一致性 + 纵向一致性 + SOA 链 + 文本完整性', () => {
    const failures: BulkFailure[] = []
    const seeds = Array.from({ length: BULK_N }, (_, i) => (i + 20) * 6271 + 1337)

    for (const testSeed of seeds) {
      const { context, initialState, seed } = generateRandomInput(testSeed)
      const { states } = generateTXSequenceStates(context, { txCount: 11, startVisitIndex: 1, seed, initialState })
      const ieCtx = { ...context, noteType: 'IE' as const }
      const ieText = exportSOAPAsText(ieCtx)
      const txTexts = states.map(s => exportSOAPAsText(context, s))

      const fail = (check: string, expected?: unknown, actual?: unknown, visitIndex?: number) =>
        failures.push({ seed: testSeed, check, visitIndex, expected, actual })

      // === 校验一 (9) ===
      if (!ieText.includes(`Current: ${initialState.pain}`)) fail('IE Pain Current', initialState.pain)
      if (!ieText.includes(`${context.symptomDuration!.value} ${context.symptomDuration!.unit}`)) fail('IE Duration')
      if (!ieText.includes(context.painRadiation!)) fail('IE Radiation')
      for (const cf of context.causativeFactors!) { if (!ieText.includes(cf)) fail('IE Causative', cf) }
      for (const rf of context.relievingFactors!) { if (!ieText.includes(rf)) fail('IE Relieving', rf) }
      if (states[0].associatedSymptom !== initialState.associatedSymptom) fail('TX1 associatedSymptom', initialState.associatedSymptom, states[0].associatedSymptom)
      if (JSON.stringify(states[0].painTypes) !== JSON.stringify(initialState.painTypes)) fail('TX1 painTypes', initialState.painTypes, states[0].painTypes)
      if (states[0].painScaleCurrent > initialState.pain) fail('TX1 pain ≤ input', initialState.pain, states[0].painScaleCurrent)
      if (extractSymptomPct(states[0].symptomScale) > extractSymptomPct(initialState.symptomScale)) fail('TX1 symptomScale ≤ input')

      // === 校验二 (8) ===
      for (let i = 1; i < states.length; i++) {
        const prev = states[i - 1], cur = states[i]
        if (cur.painScaleCurrent > prev.painScaleCurrent) fail('Pain 单调', prev.painScaleCurrent, cur.painScaleCurrent, i)
        if (SEVERITY_ORDER.indexOf(cur.severityLevel) > SEVERITY_ORDER.indexOf(prev.severityLevel)) fail('Severity 单调', prev.severityLevel, cur.severityLevel, i)
        if (symptomRank(cur.associatedSymptom) > symptomRank(prev.associatedSymptom)) fail('Symptom 单调', prev.associatedSymptom, cur.associatedSymptom, i)
        if (extractSpasmLevel(cur.spasmGrading) > extractSpasmLevel(prev.spasmGrading)) fail('Spasm 单调', prev.spasmGrading, cur.spasmGrading, i)
        if (extractFrequencyLevel(cur.painFrequency) > extractFrequencyLevel(prev.painFrequency)) fail('Frequency 单调', prev.painFrequency, cur.painFrequency, i)
        if (extractSymptomPct(cur.symptomScale) > extractSymptomPct(prev.symptomScale)) fail('Scale 单调', prev.symptomScale, cur.symptomScale, i)
        if (cur.progress < prev.progress) fail('Progress 单调', prev.progress, cur.progress, i)
      }
      for (const s of states) {
        if (SEVERITY_ORDER.indexOf(s.severityLevel) > SEVERITY_ORDER.indexOf(severityFromPain(s.painScaleCurrent))) fail('Severity≤Pain', severityFromPain(s.painScaleCurrent), s.severityLevel)
      }

      // === 校验三 SOA 链 (5) ===
      for (const s of states.filter(s => s.progress > 0.7)) {
        if (!s.symptomChange.toLowerCase().includes('improvement')) fail('后期 symptomChange', 'improvement', s.symptomChange)
      }
      for (const s of states) {
        if (!s.soaChain.assessment.present.toLowerCase().includes('improvement')) fail('A.present improvement')
        const o = s.soaChain.objective
        if ((o.romTrend !== 'stable' || o.strengthTrend !== 'stable' || o.tightnessTrend !== 'stable' || o.tendernessTrend !== 'stable') && s.soaChain.assessment.physicalChange === 'remained the same') fail('A.physicalChange vs O')
        if (s.soaChain.subjective.frequencyChange === 'improved' && s.soaChain.assessment.whatChanged !== 'pain frequency') fail('Frequency chain')
      }

      // === 文本完整性 (4) ===
      for (const kw of ['Subjective', 'Objective', 'Assessment', 'Plan']) {
        if (!ieText.includes(kw)) fail(`IE 缺 ${kw}`)
      }
      for (let ti = 0; ti < txTexts.length; ti++) {
        const tx = txTexts[ti]
        for (const kw of ['Subjective', 'Objective', 'Assessment', 'Plan']) { if (!tx.includes(kw)) fail(`TX${ti+1} 缺 ${kw}`, undefined, undefined, ti) }
        if (tx.length <= 200) fail(`TX${ti+1} 文本过短`, '>200', tx.length, ti)
        if (!tx.toLowerCase().includes('inspection')) fail(`TX${ti+1} 缺 inspection`, undefined, undefined, ti)
        if (!tx.toLowerCase().includes('tongue')) fail(`TX${ti+1} 缺 tongue`, undefined, undefined, ti)
        if (!tx.toLowerCase().includes('pulse')) fail(`TX${ti+1} 缺 pulse`, undefined, undefined, ti)
      }
    }

    // 汇总
    if (failures.length > 0) {
      const summary: Record<string, number> = {}
      for (const f of failures) summary[f.check] = (summary[f.check] || 0) + 1
      console.table(summary)
      console.log(`前 30 条失败明细:`, failures.slice(0, 30))
    }
    expect(failures.length).toBe(0)
  }, { timeout: 120_000 })
})
```

**新增代码量**：约 80 行，零新文件、零新依赖，完全复用同文件已有函数。

---

## 6. 运行方式

```bash
# 快速冒烟 (100 seeds, ~3s)
BULK_SEED_COUNT=100 npx vitest run engine-random

# 深度扫描 (500 seeds, ~15s)
BULK_SEED_COUNT=500 npx vitest run engine-random

# 默认不跑 bulk（现有 598 测试不受影响）
npx vitest run
```

---

## 7. 成功标准

- `failures.length === 0`。
- 若有失败：`console.table` 显示按 metric 分组的计数，`console.log` 显示前 30 条明细（含 seed、check、visitIndex、expected/actual），可直接用 seed 复现。

---

## 8. 与现有测试的关系

- **engine.test.ts**：不动。
- **engine-random.test.ts**：
  - 现有 20 组（598 tests）：保留不变，每次 CI 必跑，每 seed 多 it 结构便于精确定位。
  - 新增 Bulk：仅环境变量触发，单 it 循环 N 次，22 条规则全覆盖，「收集 + 汇总」模式适合大量扫描。

---

*计划结束。*
