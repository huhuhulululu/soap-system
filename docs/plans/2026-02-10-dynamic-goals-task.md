# 动态 Goals 实施任务书

**创建日期**: 2026-02-10
**前置文档**: `2026-02-10-dynamic-goals-deep-analysis.md`
**总体置信度**: 93%（基于 4 部位实际运行数据验证 + 拼接方案验证）
**约束**: `soap-generator.ts` 不可修改

---

## 目标

消除 IE Goals 硬编码导致的逻辑矛盾，使 Goals 根据患者当前状态动态计算，同时保持与现有模板格式 100% 兼容。

---

## 架构约束与方案选择

`soap-generator.ts` 是锁定文件，不可修改。

### 方案对比

| 方案 | 置信度 | 核心风险 |
|------|--------|---------|
| A. 全文本替换 | 80% | Plan 部分多处替换，依赖精确文本匹配，静默失败 |
| **E. 重新拼接 + 新 Plan 生成** | **93%** | **Plan 全新生成无替换，仅 Subjective 1 处替换** |

**选择方案 E**。

### 方案 E 核心思路

已验证：手动调用各 generate 函数再拼接，输出与 `exportSOAPAsText` **逐字符一致**。

```
wrapper.exportSOAPAsText (IE 路径):
  S = patchSubjective(原始 generateSubjective(ctx))  ← 仅 1 处 Pain Scale 替换
  O = 原始 generateObjective(ctx)                     ← 不改
  A = 原始 generateAssessment(ctx)                    ← 不改
  P = 新 generateDynamicPlanIE(ctx)                   ← 全新生成，零文本替换
  N = 原始 generateNeedleProtocol(ctx)                ← 不改
  拼接: "Subjective\n" + S + "\n\n" + "Objective\n" + O + ... 

wrapper.exportSOAPAsText (TX 路径):
  完全透传原始 exportSOAPAsText                        ← 不改
```

---

## Task 1：新建 goals-calculator.ts

文件：`src/generator/goals-calculator.ts`

### 职责

纯函数，输入 severity + bodyPart，输出所有动态 Goals 值和 IE Pain Scale。

### 接口

```typescript
import type { SeverityLevel, BodyPart } from '../types'

export interface DynamicGoals {
  pain:       { st: string; lt: string }
  soreness:   { st: string; lt: string }
  tightness:  { st: string; lt: string }
  tenderness: { st: number; lt: number }
  spasm:      { st: number; lt: number }
  strength:   { st: string; lt: string }
}

export interface IEPainScale {
  worst: string
  best: string
  current: string
}

export function calculateDynamicGoals(severity: SeverityLevel, bp: BodyPart): DynamicGoals
export function calculateIEPainScale(severity: SeverityLevel, bp: BodyPart): IEPainScale
export function parsePainFromSeverity(severity: SeverityLevel): number
```

### IE Pain Scale 映射

与 `tx-sequence-engine.ts` 的 `severityFromPain()` 反向对齐：

```typescript
const IE_PAIN_SCALE: Record<string, Record<string, IEPainScale>> = {
  SHOULDER: {
    'severe':             { worst: '9',  best: '7', current: '9-8' },
    'moderate to severe': { worst: '7',  best: '6', current: '7-6' },  // ← 现有值
    'moderate':           { worst: '7',  best: '5', current: '6-5' },
    'mild to moderate':   { worst: '6',  best: '4', current: '5-4' },
    'mild':               { worst: '4',  best: '3', current: '4-3' },
  },
  DEFAULT: {
    'severe':             { worst: '10', best: '7', current: '10-9' },
    'moderate to severe': { worst: '8',  best: '6', current: '8' },    // ← 现有值
    'moderate':           { worst: '7',  best: '5', current: '7-6' },
    'mild to moderate':   { worst: '6',  best: '4', current: '5-4' },
    'mild':               { worst: '4',  best: '3', current: '4-3' },
  }
}
```

### Goals 计算规则

```typescript
const SEVERITY_TO_TENDER: Record<string, number> = {
  'severe': 4, 'moderate to severe': 3, 'moderate': 3, 'mild to moderate': 2, 'mild': 1
}
const TIGHTNESS_LEVELS = ['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']
const IE_SPASM = 3  // generateObjective Line 987 固定值

function calculateDynamicGoals(severity, bp): DynamicGoals {
  const painCurrent = parsePainFromSeverity(severity)

  // Pain: 重症降 3 级范围，轻症维持
  let painST, painLT
  if (painCurrent <= 4) {
    painST = String(painCurrent)
    painLT = String(Math.max(2, painCurrent - 1))
  } else if (painCurrent <= 6) {
    painST = String(painCurrent)
    painLT = String(Math.max(2, painCurrent - 2))
  } else {
    painST = `${painCurrent - 3}-${painCurrent - 2}`  // 8→"5-6", 10→"7-8"
    painLT = String(Math.max(3, painCurrent - 5))      // 8→3, 10→5
  }
  // SHOULDER LT 用范围格式
  if (bp === 'SHOULDER' && painCurrent >= 7) {
    const ltBase = Math.max(3, painCurrent - 5)
    painLT = `${ltBase}-${ltBase + 1}`
  }

  // Tenderness: 降 1-2 级，最低 1
  const tenderCurrent = SEVERITY_TO_TENDER[severity] || 3
  const tenderST = tenderCurrent <= 1 ? 1 : Math.max(1, tenderCurrent - 1)
  const tenderLT = tenderCurrent <= 1 ? 1 : Math.max(1, tenderCurrent - 2)

  // Tightness: 降 1-2 档
  const tightIdx = TIGHTNESS_LEVELS.indexOf(severity)
  const tightCurrent = tightIdx >= 0 ? tightIdx : 3
  const tightSTIdx = tightCurrent <= 1 ? tightCurrent : Math.max(1, tightCurrent - 1)
  const tightLTIdx = tightCurrent <= 1 ? tightCurrent : Math.max(0, tightCurrent - 2)

  // Spasm: 固定 +3 起点
  const spasmST = Math.max(1, IE_SPASM - 1)  // 2
  const spasmLT = Math.max(0, IE_SPASM - 2)  // 1

  return {
    pain:       { st: painST, lt: painLT },
    soreness:   { st: '(70%-80%)', lt: '(70%-80%)' },
    tightness:  { st: TIGHTNESS_LEVELS[tightSTIdx], lt: TIGHTNESS_LEVELS[tightLTIdx] },
    tenderness: { st: tenderST, lt: tenderLT },
    spasm:      { st: spasmST, lt: spasmLT },
    strength:   { st: '4', lt: '4+' },
  }
}
```

### 向后兼容验证

| severity | painCurrent | Pain ST | Pain LT (KNEE) | Pain LT (SHOULDER) |
|----------|-------------|---------|----------------|-------------------|
| severe | 10 | 7-8 | 5 | 5-6 |
| **mod-sev** | **8** | **5-6** ✅ | **3** ✅ | **3-4** ✅ |
| moderate | 7 | 4-5 | 3 | 3-4 |
| mild-mod | 5 | 5 | 3 | 3-4 |
| mild | 4 | 4 | 3 | 3-4 |

---

## Task 2：新建 soap-generator-wrapper.ts

文件：`src/generator/soap-generator-wrapper.ts`

### 职责

包装 `soap-generator.ts` 的导出函数。IE 路径重新拼接（Plan 全新生成），TX 路径透传。

### 关键设计：重新拼接而非文本替换

已验证：手动调用各 generate 函数再拼接，输出与 `exportSOAPAsText` **逐字符一致**：

```typescript
// 验证代码（已通过）
const s = generateSubjective(ctx)
const o = generateObjective(ctx)
const a = generateAssessment(ctx)
const p = generatePlanIE(ctx)
const n = generateNeedleProtocol(ctx)
let manual = 'Subjective\n' + s + '\n\nObjective\n' + o + '\n\nAssessment\n' + a + '\n\nPlan\n' + p + '\n\n' + n
assert(manual === exportSOAPAsText(ctx))  // ✅ true
```

### 实现

```typescript
import type { GenerationContext, SOAPNote } from '../types'
import type { TXVisitState, TXSequenceOptions } from './tx-sequence-engine'
import type { TXSeriesTextItem } from './soap-generator'
import {
  generateSubjective as _generateSubjective,
  generateObjective,
  generateAssessment,
  generateSubjectiveTX,
  generateAssessmentTX,
  generatePlanTX,
  generateNeedleProtocol,
  generateSOAPNote as _generateSOAPNote,
  exportSOAPAsText as _exportSOAPAsText,
  exportTXSeriesAsText as _exportTXSeriesAsText,
} from './soap-generator'
import { calculateDynamicGoals, calculateIEPainScale, parsePainFromSeverity } from './goals-calculator'

// ===== Subjective：仅 1 处 Pain Scale 替换 =====

const PAIN_SCALE_PATTERNS: Record<string, RegExp> = {
  SHOULDER: /Pain Scale: Worst: 7 ; Best: 6 ; Current: 7-6/,
  DEFAULT:  /Pain Scale: Worst: 8 ; Best: 6 ; Current: 8/,
}

function patchSubjective(text: string, context: GenerationContext): string {
  if (context.noteType !== 'IE') return text
  const painScale = calculateIEPainScale(context.severityLevel, context.primaryBodyPart)
  const replacement = `Pain Scale: Worst: ${painScale.worst} ; Best: ${painScale.best} ; Current: ${painScale.current}`
  const pattern = PAIN_SCALE_PATTERNS[context.primaryBodyPart] || PAIN_SCALE_PATTERNS['DEFAULT']
  return text.replace(pattern, replacement)
}

// ===== Plan IE：全新生成，零文本替换 =====

function generateDynamicPlanIE(context: GenerationContext): string {
  const bp = context.primaryBodyPart
  const goals = calculateDynamicGoals(context.severityLevel, bp)
  const formatTightLT = (level: string) => level.replace(/ to /g, '-')

  let plan = `Initial Evaluation - Personal one on one contact with the patient (total 20-30 mins)\n`
  plan += `1. Greeting patient.\n`
  plan += `2. Detail explanation from patient of past medical history and current symptom.\n`
  plan += `3. Initial evaluation examination of the patient current condition.\n`
  plan += `4. Explanation with patient for medical decision/treatment plan.\n\n`

  plan += `Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):\n`

  if (bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK') {
    plan += `Decrease Pain Scale to${goals.pain.st}.\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.st}\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`
    plan += `Increase Muscles Strength to${goals.strength.st}\n\n`
  } else {
    plan += `Decrease Pain Scale to ${goals.pain.st}.\n`
    plan += `Decrease soreness sensation Scale to 50%\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`
    plan += `Increase Muscles Strength to ${goals.strength.st}\n\n`
  }

  plan += `Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):\n`

  if (bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK') {
    plan += `Decrease Pain Scale to${goals.pain.lt}\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.lt}\n`
    plan += `Decrease Muscles Tightness to ${formatTightLT(goals.tightness.lt)}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`
    plan += `Increase Muscles Strength to${goals.strength.lt}\n`
    plan += `Increase ROM 60%\n`
    plan += `Decrease impaired Activities of Daily Living to ${formatTightLT(goals.tightness.lt)}.`
  } else {
    plan += `Decrease Pain Scale to ${goals.pain.lt}\n`
    plan += `Decrease soreness sensation Scale to 30%\n`
    plan += `Decrease Muscles Tightness to ${formatTightLT(goals.tightness.lt)}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`
    plan += `Increase Muscles Strength to ${goals.strength.lt}\n`
    plan += `Increase ROM 60%\n`
    plan += `Decrease impaired Activities of Daily Living to ${formatTightLT(goals.tightness.lt)}.`
  }

  return plan
}

// ===== SOAPNote 结构体修补 =====

function patchSOAPNote(note: SOAPNote, context: GenerationContext): SOAPNote {
  if (context.noteType !== 'IE') return note
  const painScale = calculateIEPainScale(context.severityLevel, context.primaryBodyPart)
  const goals = calculateDynamicGoals(context.severityLevel, context.primaryBodyPart)

  note.subjective.painScale = {
    worst: parseInt(painScale.worst) || 8,
    best: parseInt(painScale.best) || 6,
    current: parsePainFromSeverity(context.severityLevel),
  }
  note.plan.shortTermGoal.painScaleTarget = goals.pain.st
  note.plan.longTermGoal.painScaleTarget = goals.pain.lt
  return note
}

// ===== 导出函数 =====

export function generateSubjective(context: GenerationContext): string {
  return patchSubjective(_generateSubjective(context), context)
}

export function generatePlanIE(context: GenerationContext): string {
  return generateDynamicPlanIE(context)  // 全新生成，不调用原始版本
}

export function generateSOAPNote(context: GenerationContext): SOAPNote {
  return patchSOAPNote(_generateSOAPNote(context), context)
}

export function exportSOAPAsText(context: GenerationContext, visitState?: TXVisitState): string {
  if (context.noteType === 'TX') {
    return _exportSOAPAsText(context, visitState)  // TX 透传
  }
  // IE：重新拼接
  const subjective = patchSubjective(_generateSubjective(context), context)
  const objective = generateObjective(context)
  const assessment = generateAssessment(context)
  const plan = generateDynamicPlanIE(context)
  const needleProtocol = generateNeedleProtocol(context)

  let output = `Subjective\n${subjective}\n\n`
  output += `Objective\n${objective}\n\n`
  output += `Assessment\n${assessment}\n\n`
  output += `Plan\n${plan}\n\n`
  output += needleProtocol
  return output
}

export function exportTXSeriesAsText(
  context: GenerationContext, options: TXSequenceOptions
): TXSeriesTextItem[] {
  return _exportTXSeriesAsText(context, options)  // TX 透传
}

// 透传不需要修改的函数
export {
  generateObjective,
  generateAssessment,
  generateSubjectiveTX,
  generateAssessmentTX,
  generatePlanTX,
  generateNeedleProtocol,
} from './soap-generator'
```

### 为什么比全文本替换更好

| 对比项 | 全文本替换（方案 A） | 重新拼接（方案 E） |
|--------|--------------------|--------------------|
| Plan Goals | 多处 `String.replace`，依赖精确匹配 | **全新生成，零替换** |
| Subjective Pain | 1 处替换 | 1 处替换（相同） |
| 静默失败风险 | 高（替换不匹配时无报错） | **低（Plan 完全自控）** |
| 维护性 | 原始文本改了就坏 | **只需同步静态句式** |

---

## Task 3：修改 src/index.ts 导出

将需要 patch 的函数导出从 `soap-generator` 切换到 `soap-generator-wrapper`：

```typescript
// 修改前
export {
  generateSOAPNote,
  exportSOAPAsText,
  generateSubjective,
  generateObjective,
  generateAssessment,
  generatePlanIE,
  generateSubjectiveTX,
  generateAssessmentTX,
  generatePlanTX,
  generateNeedleProtocol,
  exportTXSeriesAsText
} from './generator/soap-generator'

// 修改后
export {
  generateSOAPNote,
  exportSOAPAsText,
  generateSubjective,
  generatePlanIE,
  exportTXSeriesAsText,
  // 透传
  generateObjective,
  generateAssessment,
  generateSubjectiveTX,
  generateAssessmentTX,
  generatePlanTX,
  generateNeedleProtocol,
} from './generator/soap-generator-wrapper'
```

### 影响范围

| 调用方 | import 来源 | 是否经过 wrapper | 影响 |
|--------|------------|-----------------|------|
| `demo-bilateral-*-IE.ts` | `./src/index` | ✅ 是 | 使用动态 Goals |
| `demo-bilateral-*-full-test.ts` | `./src/index` | ✅ 是 | 使用动态 Goals |
| `scripts/generate-*-demo.ts` | `../src/generator/soap-generator` | ❌ 否 | 保持硬编码 |
| `correction-generator.ts` | `../../../src/generator/soap-generator` | ❌ 否 | 保持硬编码 |
| `__tests__/*.test.ts` | `../soap-generator` | ❌ 否 | 保持硬编码 |

直接 import `soap-generator` 的调用方不受影响，保持原始行为。

---

## 改动文件清单

| 文件 | 操作 | 改动量 |
|------|------|--------|
| `src/generator/goals-calculator.ts` | **新建** | ~80 行 |
| `src/generator/soap-generator-wrapper.ts` | **新建** | ~100 行 |
| `src/index.ts` | **修改** | ~5 行（切换导出源） |
| `soap-generator.ts` | **不改** | — |
| `tx-sequence-engine.ts` | **不改** | — |
| 类型定义 | **不改** | — |

---

## 置信度评估

### 总体：93%

| 项 | 置信度 | 说明 |
|---|---|---|
| IE 拼接逻辑正确 | **99%** | 已验证 manual === original（IE + TX 路径） |
| Plan 全新生成正确 | **95%** | 静态句式从原始代码复制，动态值由 calculator 提供 |
| Pain Scale 替换安全 | **95%** | 模式在全文唯一，`String.replace` 只替换第一个 |
| SOAPNote 结构体修补 | **98%** | 直接修改返回值字段 |
| TX 路径不受影响 | **99%** | 完全透传 |
| 向后兼容（mod-sev） | **95%** | 可用测试保证逐字符一致 |
| 现有测试不受影响 | **95%** | 测试直接 import soap-generator |

### 剩余风险

| 风险 | 置信度 | 缓解 |
|------|--------|------|
| 原始 generatePlanIE 改了静态句式，新版本不同步 | 85% | 向后兼容测试会捕获 |
| correction-generator 也需要动态 Goals | 75% | 需要时改其 import 即可 |

---

## 验证矩阵

### severity=moderate to severe（向后兼容基准）

4 个部位 + ELBOW 的输出必须与当前**逐字符一致**。

### severity=mild（核心矛盾修复）

| 指标 | 修复前 | 修复后 | 合理？ |
|------|--------|--------|--------|
| Pain Scale | Worst:8 Best:6 Current:8 | Worst:4 Best:3 Current:4-3 | ✅ |
| Pain ST Goal | 5-6 | 4 | ✅ 维持 |
| Tenderness ST Goal | Grade 3 | Grade 1 | ✅ 不再反向 |
| Tightness ST Goal | moderate | mild | ✅ 不再反向 |

### 全量验证（5 severity × KNEE）

| severity | Pain Current | Pain ST | Pain LT | Tender ST | Tender LT | Tight ST | Tight LT |
|----------|-------------|---------|---------|-----------|-----------|----------|----------|
| severe | 10-9 | 7-8 | 5 | 3 | 2 | mod-sev | mod |
| **mod-sev** | **8** | **5-6** | **3** | **3** | **2** | **mod** | **mild-mod** |
| moderate | 7-6 | 4-5 | 3 | 2 | 1 | mild-mod | mild |
| mild-mod | 5-4 | 5 | 3 | 1 | 1 | mild | mild |
| mild | 4-3 | 4 | 3 | 1 | 1 | mild | mild |

加粗行 = 向后兼容基准，必须与当前硬编码完全一致。

---

## 实施顺序

```
1. goals-calculator.ts（纯函数，可独立测试）
2. soap-generator-wrapper.ts（依赖 1）
3. src/index.ts 导出切换（依赖 2）
4. 运行现有测试 + demo 验证向后兼容
```

---

## 实施状态：✅ 已完成 (2026-02-10)

### 公式修正（相对于原始计划）

原始计划中 Tenderness 和 Tightness 的公式与向后兼容基准不一致，已修正：

| 指标 | 原始计划公式 | 修正后公式 | 原因 |
|------|-------------|-----------|------|
| Tenderness ST | `max(1, current - 1)` | `current`（保持当前级别） | 原始硬编码 mod-sev ST=3=current |
| Tenderness LT (主要部位) | `max(1, current - 2)` | `max(1, current - 1)` | 原始硬编码 mod-sev LT=2 |
| Tenderness LT (其他部位) | 同上 | `max(1, current - 2)` | 原始硬编码 else LT=1 |
| Tightness ST | `current`（保持当前级别） | `max(0, current - 1)` | 原始硬编码 mod-sev ST=moderate(idx2)=current(3)-1 |
| Tightness LT | `max(0, current - 1)` | `max(0, current - 2)` | 原始硬编码 mod-sev LT=mild-mod(idx1)=current(3)-2 |

### 验证结果

- ✅ KNEE IE: 逐字符一致 (severity=moderate to severe)
- ✅ SHOULDER IE: 逐字符一致
- ✅ LBP IE: 逐字符一致
- ✅ NECK IE: 逐字符一致
- ✅ ELBOW IE: 逐字符一致
- ✅ TX 路径: 逐字符一致（完全透传）
- ✅ `demo-bilateral-knee-full-test.ts`: 0 错误, 0 警告
- ✅ 现有测试: 11/12 通过（1 个 pre-existing failure in correction-generator.test.ts）
- ✅ TypeScript 编译: 无新增错误
- ✅ `soap-generator.ts`: 零改动

---

## 验收标准

1. ✅ `severity: 'moderate to severe'` 时，`exportSOAPAsText` 输出与修改前**逐字符一致**
2. `severity: 'mild'` 时，不再出现 Goal 比当前状态更差的情况（待人工验证）
3. ✅ `generateSOAPNote()` 返回的 `painScale` 和 `shortTermGoal` 与文本输出一致
4. ✅ 现有测试全部通过（`npm test`，pre-existing failure 除外）
5. ✅ `demo-bilateral-knee-full-test.ts` 输出无变化（severity 仍是 moderate to severe）
6. ✅ `soap-generator.ts` 零改动
