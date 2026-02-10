# TX 续写逐行修复计划

> 创建时间: 2026-02-09 23:59
> 基于: tx-fix-confidence.md v2 代码验证结果
> 所有行号已于 2026-02-09 23:50 验证

---

## 第一批: 置信度 ≥95%, 回归风险极低

### Fix-01: #78 txVisits 取错 [置信度 99%]

**文件**: `frontend/src/services/generator.js`
**行号**: L132

```diff
- // 4. 提取最后一个 TX 的状态（parser reverse 后最新在前，即 txVisits[0]）
+ // 4. 提取最后一个 TX 的状态（parser reverse 后时间正序，最新在末尾）
  const txVisits = doc.visits.filter(v => v.subjective.visitType !== 'INITIAL EVALUATION')
- const lastTx = txVisits.length > 0 ? txVisits[0] : null
+ const lastTx = txVisits.length > 0 ? txVisits[txVisits.length - 1] : null
```

**影响**: 1 文件 2 行 (注释+代码)
**回归**: 无 — 只影响续写路径

---

### Fix-02: #15/#58 拼写 Assesment → Assessment [置信度 99%]

**文件**: `src/generator/soap-generator.ts`
**行号**: L2135

```diff
-    output += `Assesment\n${assessment}\n\n`
+    output += `Assessment\n${assessment}\n\n`
```

**影响**: 1 文件 1 行
**回归**: 无 — parser 用 `Subjective:` 分隔，`dropdown-parser.ts` L394 已兼容两种拼写

---

### Fix-03: #47 语法 continue to be emphasize [置信度 99%]

**4 个文件同步修改**:

**文件 A**: `src/generator/soap-generator.ts` L1470
```diff
  const TX_VERB_OPTIONS = [
-   'continue to be emphasize', 'emphasize', 'consist of promoting',
+   'continue to emphasize', 'emphasize', 'consist of promoting',
```

**文件 B**: `src/generator/assessment-generator.ts` L78
```diff
  const TREATMENT_FOCUS_OPTIONS = [
-   'continue to be emphasize',
+   'continue to emphasize',
```

**文件 C**: `src/generator/plan-generator.ts` L93
```diff
-  treatmentPrinciplesFocus: ['continue to be emphasize', 'emphasize', ...],
+  treatmentPrinciplesFocus: ['continue to emphasize', 'emphasize', ...],
```

**文件 D**: `src/parser/dropdown-parser.ts` L302
```diff
-    options.includes('continue to be emphasize')
+    options.includes('continue to emphasize')
```

**影响**: 4 文件各 1 行
**回归**: 无 — parser/checker 不引用此文本

---

### Fix-04: #9/#10 纵向约束初始化 [置信度 97%]

**文件**: `src/generator/tx-sequence-engine.ts`
**行号**: L563-565

```diff
    // 纵向单调约束追踪变量
-   let prevTightnessGrading = ''
-   let prevTendernessGrade = ''
-   let prevAssociatedSymptom = ''
+   let prevTightnessGrading = options.initialState?.tightnessGrading ?? ''
+   let prevTendernessGrade = options.initialState?.tendernessGrade ?? ''
+   let prevAssociatedSymptom = options.initialState?.associatedSymptom ?? ''
```

**前提**: Fix-06 (扩展 initialState 类型) 先完成
**影响**: 1 文件 3 行
**回归**: 无 — 无 initialState 时 fallback 到 `''`，行为不变

---

### Fix-05: #4/#41 generalCondition 继承 [置信度 95%]

**文件**: `src/generator/tx-sequence-engine.ts`
**行号**: L578-580

```diff
    const fixedGeneralCondition: string = (() => {
-     // 1) 如果用户显式指定了 baselineCondition，直接使用
+     // 1) 优先从 initialState 继承（续写场景）
+     if (options.initialState?.generalCondition) return options.initialState.generalCondition
+     // 2) 如果用户显式指定了 baselineCondition，直接使用
      if (context.baselineCondition) return context.baselineCondition
  
-     // 2) 根据整体证型 + 慢性程度自动推断
+     // 3) 根据整体证型 + 慢性程度自动推断
```

**前提**: Fix-06 (扩展 initialState 类型) 先完成
**影响**: 1 文件 3 行
**回归**: 无 — 无 initialState 时走原推断逻辑

---

### Fix-06: #17 扩展 initialState 类型 [置信度 95%]

**文件 A**: `src/generator/tx-sequence-engine.ts` L174-180

```diff
    initialState?: {
      pain: number
      tightness: number
      tenderness: number
      spasm: number
      frequency: number
+     // --- 续写继承字段 ---
+     painTypes?: string[]
+     associatedSymptom?: string
+     symptomScale?: string
+     generalCondition?: string
+     inspection?: string
+     tightnessGrading?: string
+     tendernessGrade?: string
+     tonguePulse?: { tongue: string; pulse: string }
+     acupoints?: string[]
+     electricalStimulation?: boolean
+     treatmentTime?: number
    }
```

**文件 B**: `frontend/src/services/generator.js` L27-55 `extractInitialState`

```diff
  function extractInitialState(visit) {
    // pain
    const ps = visit.subjective.painScale
    const pain = typeof ps === 'number' ? ps
      : (ps?.current ?? ps?.value ?? ps?.worst ?? 8)

    // tightness: severity text → number
    const tMap = { severe: 4, 'moderate to severe': 3.5, moderate: 3, 'mild to moderate': 2, mild: 1 }
    const tightness = tMap[(visit.objective.tightnessMuscles?.gradingScale || '').toLowerCase()] ?? 3

    // tenderness: "(+3)..." → 3
    const tenderDesc = visit.objective.tendernessMuscles?.scaleDescription || ''
    const tenderMatch = tenderDesc.match(/\+(\d)/)
    const tenderness = tenderMatch ? parseInt(tenderMatch[1]) : 3

    // spasm: frequencyScale 直接数字
    const spasm = visit.objective.spasmMuscles?.frequencyScale ?? 3

    // frequency: text → level
    const fText = (visit.subjective.painFrequency || '').toLowerCase()
    const frequency = fText.includes('constant') ? 3
      : fText.includes('frequent') ? 2
      : fText.includes('occasional') ? 1
      : fText.includes('intermittent') ? 0
      : 2

-   return { pain, tightness, tenderness, spasm, frequency }
+   // --- 续写继承字段 ---
+   const painTypes = visit.subjective.painTypes?.length > 0
+     ? visit.subjective.painTypes : undefined
+   const associatedSymptom = (() => {
+     const cc = visit.subjective.chiefComplaint || ''
+     const m = cc.match(/associated with muscles?\s+(\w+)/i)
+     return m ? m[1].toLowerCase() : undefined
+   })()
+   const symptomScale = visit.subjective.muscleWeaknessScale || undefined
+   const generalCondition = visit.assessment?.generalCondition || undefined
+   const inspection = visit.objective?.inspection || undefined
+   const tightnessGrading = (visit.objective.tightnessMuscles?.gradingScale || '')
+   const tendernessGrade = tenderMatch ? `+${tenderMatch[1]}` : undefined
+   const tonguePulse = (visit.objective?.tonguePulse?.tongue && visit.objective?.tonguePulse?.pulse)
+     ? { tongue: visit.objective.tonguePulse.tongue, pulse: visit.objective.tonguePulse.pulse }
+     : undefined
+   const acupoints = visit.plan?.acupoints?.length > 0
+     ? visit.plan.acupoints : undefined
+   const electricalStimulation = visit.plan?.electricalStimulation
+   const treatmentTime = visit.plan?.treatmentTime
+
+   return {
+     pain, tightness, tenderness, spasm, frequency,
+     painTypes, associatedSymptom, symptomScale,
+     generalCondition, inspection, tightnessGrading, tendernessGrade,
+     tonguePulse, acupoints, electricalStimulation, treatmentTime
+   }
  }
```

**影响**: 2 文件
**回归**: 无 — 新增可选字段，原有字段不变
**风险点**: `associatedSymptom` 从 chiefComplaint 正则提取，只取第一个词 → 简单可靠

---

### Fix-07: #1 painTypes 继承 [置信度 95%]

**文件**: `src/generator/soap-generator.ts` L1531-1532

```diff
    const weightedPainTypes = calculateWeights('subjective.painTypes', painTypeOptions, weightContext)
-   const selectedPainTypes = selectBestOptions(weightedPainTypes, 2)
+   const selectedPainTypes = visitState?.painTypes
+     ?? selectBestOptions(weightedPainTypes, 2)
```

**前提**: Fix-06 完成 + engine 传递 painTypes 到 visitState (见 Fix-07b)

**文件 (Fix-07b)**: `src/generator/tx-sequence-engine.ts`

在 `TXVisitState` 接口 (L183) 中新增:
```diff
  export interface TXVisitState {
    ...
+   painTypes?: string[]
  }
```

在 visits.push (L935 附近) 中新增:
```diff
    visits.push({
      ...
+     painTypes: options.initialState?.painTypes,
    })
```

**影响**: 2 文件
**回归**: 无 — visitState.painTypes 为 undefined 时 fallback 到权重选择

---

### Fix-08: #5 inspection 继承 [置信度 95%]

**文件**: `src/generator/soap-generator.ts`

**L936** (SHOULDER inspection):
```diff
    if (bp === 'SHOULDER') {
-     objective += `Inspection:${inspectionDefault}\n\n`
+     objective += `Inspection:${visitState?.inspection ?? inspectionDefault}\n\n`
    }
```

**L1137** (KNEE/LBP/NECK inspection):
```diff
    if (bp === 'KNEE' || bp === 'LBP' || bp === 'NECK') {
-     objective += `Inspection: ${inspectionDefault}\n\n`
+     objective += `Inspection: ${visitState?.inspection ?? inspectionDefault}\n\n`
    }
```

**前提**: Fix-06 完成 + engine 传递 inspection 到 visitState

**engine 侧** (`tx-sequence-engine.ts`):

TXVisitState 新增:
```diff
+ inspection?: string
```

visits.push 新增:
```diff
+ inspection: options.initialState?.inspection,
```

**影响**: 2 文件
**回归**: 无 — IE 路径不传 visitState

---

### Fix-09: #51 tongue/pulse 继承 [置信度 95%]

**文件**: `src/generator/soap-generator.ts` L1143-1146

```diff
    const toneData = TONE_MAP[context.localPattern]
    if (toneData) {
-     objective += `tongue\n${toneData.tongueDefault}\npulse\n${toneData.pulseDefault}`
+     const tongue = visitState?.tonguePulse?.tongue ?? toneData.tongueDefault
+     const pulse = visitState?.tonguePulse?.pulse ?? toneData.pulseDefault
+     objective += `tongue\n${tongue}\npulse\n${pulse}`
    }
```

**影响**: 1 文件 3 行
**回归**: 无 — visitState.tonguePulse 已由 engine 从 IE 继承 (L602-614)，此处只是让 generator 实际使用它

---

## 第二批: 置信度 80-90%

### Fix-10: #35 进度起点 [置信度 90%]

**文件**: `src/generator/tx-sequence-engine.ts` L554

```diff
-   let prevProgress = 0
+   let prevProgress = startIdx > 1 ? (startIdx - 1) / txCount : 0
```

**影响**: 1 文件 1 行
**回归**: 低 — 从头生成时 startIdx=1，`(1-1)/n = 0`，行为不变

---

### Fix-11: #11/#21/#53 OPTUM 针刺协议 [置信度 85%]

**方案**: 从 initialState 推断协议类型，覆盖保险映射

**文件 A**: `src/generator/soap-generator.ts` `generateNeedleProtocol` 签名 (L1742)

```diff
- export function generateNeedleProtocol(context: GenerationContext): string {
+ export function generateNeedleProtocol(context: GenerationContext, visitState?: TXVisitState): string {
-   const isFullCode = INSURANCE_NEEDLE_MAP[context.insuranceType] === 'full'
+   // 续写时: 从输入TX的实际协议推断 (电刺激或时间>=30 → full)
+   const inheritedFull = visitState?.electricalStimulation === true
+     || (visitState?.treatmentTime != null && visitState.treatmentTime >= 30)
+   const isFullCode = inheritedFull ?? (INSURANCE_NEEDLE_MAP[context.insuranceType] === 'full')
```

**文件 B**: `src/generator/soap-generator.ts` `exportSOAPAsText` TX 路径 (L2131)

```diff
-   const needleProtocol = generateNeedleProtocol(context)
+   const needleProtocol = generateNeedleProtocol(context, visitState)
```

**前提**: Fix-06 完成 (initialState 有 electricalStimulation/treatmentTime)
**engine 侧**: TXVisitState 新增 `electricalStimulation?: boolean` 和 `treatmentTime?: number`，从 initialState 传递

**影响**: 1 文件 (soap-generator.ts) 签名+调用
**回归**: 低 — 无 visitState 时 `inheritedFull = undefined`，`undefined ?? X = X`，走原逻辑

---

### Fix-12: #19/#20 Pain 停滞 [置信度 85%]

**文件**: `src/generator/tx-sequence-engine.ts` L547-550

```diff
-   const targetPain = parsePainTarget(
-     context.previousIE?.plan?.shortTermGoal?.painScaleTarget,
-     Math.max(3, ieStartPain - 2)
-   )
+   const shortTermTarget = parsePainTarget(
+     context.previousIE?.plan?.shortTermGoal?.painScaleTarget,
+     Math.max(3, ieStartPain - 2)
+   )
+   const longTermTarget = parsePainTarget(
+     context.previousIE?.plan?.longTermGoal?.painScaleTarget,
+     Math.max(2, ieStartPain - 4)
+   )
+   // 续写时: 如果起点已接近短期目标，切换到长期目标
+   const targetPain = (startPain - shortTermTarget) < 1.5 ? longTermTarget : shortTermTarget
```

**影响**: 1 文件 6 行
**回归**: 低 — 从头生成时 startPain=IE pain (7-8)，shortTermTarget=5.5，差值>1.5，不触发切换

---

### Fix-13: #3 symptomScale 递减 [置信度 82%]

**方案**: engine 计算递减值，generator 从 visitState 读取

**文件 A**: `src/generator/tx-sequence-engine.ts`

TXVisitState 新增:
```diff
+ symptomScale?: string
```

在 for 循环内 (visits.push 前) 新增计算:
```typescript
const inheritedScale = options.initialState?.symptomScale
const computedScale = (() => {
  if (!inheritedScale) return undefined
  const m = inheritedScale.match(/(\d+)/)
  if (!m) return inheritedScale
  const base = parseInt(m[1], 10)
  const reduced = Math.max(10, base - Math.round(progress * 25))
  // 吸附到 10 的倍数
  const snapped = Math.round(reduced / 10) * 10
  return `${snapped}%`
})()
```

visits.push 新增:
```diff
+ symptomScale: computedScale,
```

**文件 B**: `src/generator/soap-generator.ts` `generateSubjectiveTX` (L1549 附近)

```diff
-   const symptomScale = getConfig(SYMPTOM_SCALE_MAP, bp)
+   const symptomScale = visitState?.symptomScale ?? getConfig(SYMPTOM_SCALE_MAP, bp)
```

**影响**: 2 文件
**回归**: 无 — 无 visitState 时 fallback 到硬编码

---

### Fix-14: #2 associatedSymptom 初始化 [置信度 80%]

已包含在 Fix-04 中:
```diff
- let prevAssociatedSymptom = ''
+ let prevAssociatedSymptom = options.initialState?.associatedSymptom ?? ''
```

无额外修改。

---

### Fix-15: #14 频率改善速度 [置信度 80%]

**文件**: `src/generator/tx-sequence-engine.ts` L700 附近

```diff
-   const frequencyImproveGate = progress > 0.45 || rng() > 0.65
+   const frequencyImproveGate = progress > 0.55 && rng() > 0.45
```

**影响**: 1 文件 1 行
**回归**: 低 — 频率改善变慢，更符合临床

---

## 暂缓

### Fix-16: #39 symptomChange 取消硬编码 [置信度 75%]

**文件**: `src/generator/tx-sequence-engine.ts` L939

```diff
-     symptomChange: 'improvement of symptom(s)',
+     symptomChange,
```

**风险**: `addProgressBias` 给 improvement +80，99% 情况仍选 improvement。但极端 disruption 时可能选到 `"came back"`，此时 `deriveAssessmentFromSOA` 仍假设 improvement → S→A 矛盾。

**需要同步修改**: `deriveAssessmentFromSOA` 增加非 improvement 分支。暂缓到第三批。

---

## 执行依赖图

```
Fix-01 (#78)          ← 独立，立即执行
Fix-02 (#15)          ← 独立，立即执行
Fix-03 (#47)          ← 独立，立即执行 (4文件)
Fix-06 (#17 类型扩展)  ← 独立，立即执行 (2文件)
  ├── Fix-04 (#9/#10)  ← 依赖 Fix-06
  ├── Fix-05 (#4/#41)  ← 依赖 Fix-06
  ├── Fix-07 (#1)      ← 依赖 Fix-06
  ├── Fix-08 (#5)      ← 依赖 Fix-06
  ├── Fix-11 (#11)     ← 依赖 Fix-06
  ├── Fix-13 (#3)      ← 依赖 Fix-06
  └── Fix-14 (#2)      ← 包含在 Fix-04 中
Fix-09 (#51)          ← 独立 (engine 已有 tonguePulse)
Fix-10 (#35)          ← 独立
Fix-12 (#19/#20)      ← 独立
Fix-15 (#14)          ← 独立
Fix-16 (#39)          ← 暂缓
```

---

## 修改文件汇总

| 文件 | Fix 编号 | 改动行数 |
|------|---------|---------|
| `frontend/src/services/generator.js` | Fix-01, Fix-06 | ~25 行 |
| `src/generator/tx-sequence-engine.ts` | Fix-04, Fix-05, Fix-06, Fix-07b, Fix-08b, Fix-10, Fix-11b, Fix-12, Fix-13a, Fix-15 | ~35 行 |
| `src/generator/soap-generator.ts` | Fix-02, Fix-03a, Fix-07, Fix-08, Fix-09, Fix-11, Fix-13b | ~15 行 |
| `src/generator/assessment-generator.ts` | Fix-03b | 1 行 |
| `src/generator/plan-generator.ts` | Fix-03c | 1 行 |
| `src/parser/dropdown-parser.ts` | Fix-03d | 1 行 |

**总计**: 6 文件, ~78 行改动

---

## 置信度总览

| Fix | 问题 | 置信度 | 行数 | 依赖 |
|-----|------|--------|------|------|
| 01 | #78 txVisits 取错 | **99%** | 2 | 无 |
| 02 | #15/#58 拼写 | **99%** | 1 | 无 |
| 03 | #47 语法 | **99%** | 4 (4文件) | 无 |
| 04 | #9/#10 prev* 初始化 | **97%** | 3 | Fix-06 |
| 05 | #4/#41 generalCondition | **95%** | 3 | Fix-06 |
| 06 | #17 扩展 initialState | **95%** | ~30 | 无 |
| 07 | #1 painTypes | **95%** | 4 | Fix-06 |
| 08 | #5 inspection | **95%** | 4 | Fix-06 |
| 09 | #51 tongue/pulse | **95%** | 3 | 无 |
| 10 | #35 进度起点 | **90%** | 1 | 无 |
| 11 | #11/#53 OPTUM 针刺 | **85%** | 5 | Fix-06 |
| 12 | #19/#20 Pain 停滞 | **85%** | 6 | 无 |
| 13 | #3 symptomScale | **82%** | 8 | Fix-06 |
| 14 | #2 associatedSymptom | **80%** | 0 (含在04) | Fix-06 |
| 15 | #14 频率速度 | **80%** | 1 | 无 |
| 16 | #39 symptomChange | **75%** | 暂缓 | 需链式改动 |
