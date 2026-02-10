# TX 续写优化方案 — 置信度评估 (v2)

> 创建时间: 2026-02-09 21:38
> 更新时间: 2026-02-09 21:43 — 代码验证后提升置信度
> 评估标准:
> - **置信度**: 修复方案正确且不引入新问题的概率
> - **影响范围**: 改动波及的文件/函数数量
> - **回归风险**: 破坏现有 IE 生成或从头生成 TX 的概率

---

## Phase 0: 一行修复

### #78 `txVisits[0]` → `txVisits[txVisits.length - 1]`

| 维度 | 评估 |
|------|------|
| 置信度 | **99%** |
| 影响范围 | 1 文件 1 行 (`generator.js` L132) |
| 回归风险 | **极低** — 只影响续写路径，不影响 IE 或从头生成 |
| 验证方式 | `parseOptumNote` 已确认 `visits.reverse()` 转为时间正序 |

```js
// 修复前
const lastTx = txVisits.length > 0 ? txVisits[0] : null
// 修复后
const lastTx = txVisits.length > 0 ? txVisits[txVisits.length - 1] : null
```

---

## Phase 1: 紧急修复

### 1.1 扩展 `initialState` 类型 (#17)

| 维度 | 评估 |
|------|------|
| 置信度 | **90%** |
| 影响范围 | 3 文件: `tx-sequence-engine.ts` (类型), `generator.js` (提取), `soap-generator.ts` (消费) |
| 回归风险 | **低** — 新增可选字段，不改变现有字段语义 |
| 不确定性 | parser 的 `VisitRecord` 中部分字段可能为空/格式不一致 |

方案: 扩展 `TXSequenceOptions.initialState` 增加可选字段:
```typescript
initialState?: {
  pain: number
  tightness: number
  tenderness: number
  spasm: number
  frequency: number
  // --- 新增 ---
  painTypes?: string[]           // 从 visit.subjective.painTypes
  associatedSymptoms?: string[]  // 从 chiefComplaint 解析
  symptomScale?: string          // 从 muscleWeaknessScale
  generalCondition?: string      // 从 visit.assessment.generalCondition
  inspection?: string            // 从 visit.objective.inspection
  tightnessGrading?: string      // 从 visit.objective.tightnessMuscles.gradingScale
  tendernessGrade?: string       // 从 visit.objective.tendernessMuscles.scale → "+2"
  tightnessMuscles?: string[]    // 从 visit.objective.tightnessMuscles.muscles
  tendernessMuscles?: string[]   // 从 visit.objective.tendernessMuscles.muscles
  spasmMuscles?: string[]        // 从 visit.objective.spasmMuscles.muscles
  adlActivities?: string[]       // 从 chiefComplaint 解析 (困难)
  tonguePulse?: { tongue: string; pulse: string }
  acupoints?: string[]           // 从 visit.plan.acupoints
  treatmentTime?: number         // 从 visit.plan.treatmentTime
  electricalStimulation?: boolean // 从 visit.plan.electricalStimulation
}
```

**风险点**:
- `associatedSymptoms` 和 `adlActivities` 在 parser 中不是结构化字段 (#69)，需要从 `chiefComplaint` 正则提取 → 置信度降低
- `painTypes` parser 已有 `visit.subjective.painTypes: PainType[]` → 直接可用 ✅
- `inspection` parser 已有 `visit.objective.inspection: InspectionType` → 直接可用 ✅
- `generalCondition` parser 已有 `visit.assessment.generalCondition` → 直接可用 ✅
- `tonguePulse` parser 已有 `visit.objective.tonguePulse` → 直接可用 ✅
- `acupoints` parser 已有 `visit.plan.acupoints` → 可用但不完整 (#66 只解析第一步穴位)

### 1.2 初始化 `prevTendernessGrade` / `prevTightnessGrading` (#9, #10)

| 维度 | 评估 |
|------|------|
| 置信度 | **95%** |
| 影响范围 | 1 文件 2 行 (`tx-sequence-engine.ts` L569, L571) |
| 回归风险 | **极低** — 只在 `initialState` 存在时生效，从头生成不受影响 |
| 验证方式 | 纵向约束逻辑已确认: `prev !== ''` 时才检查 |

```typescript
// 修复前
let prevTightnessGrading = ''
let prevTendernessGrade = ''

// 修复后
let prevTightnessGrading = options.initialState?.tightnessGrading ?? ''
let prevTendernessGrade = options.initialState?.tendernessGrade ?? ''
```

**前提**: 依赖 1.1 扩展 initialState 类型。`tightnessGrading` 需要从 parser 的 `gradingScale` (如 `"moderate"`) 映射为首字母大写 (如 `"Moderate"`)，因为 engine 内部用首字母大写比较。

**风险点**: engine 内部 `TIGHTNESS_ORDER` 用小写比较 (`indexOf(tightnessGrading.toLowerCase())`)，所以大小写不是问题。但 tenderness 用 `"+2"` 格式，需要从 `visit.objective.tendernessMuscles.scale` (数字 2) 转为 `"+2"` 字符串。

### 1.3 修复 OPTUM 保险针刺协议映射 (#11, #21, #53)

| 维度 | 评估 |
|------|------|
| 置信度 | **70%** |
| 影响范围 | 2 文件: `soap-generator.ts` (映射 + `generateNeedleProtocol`), `generator.js` (传递 treatmentTime) |
| 回归风险 | **中** — 改变 OPTUM 的默认行为，可能影响从头生成 |
| 不确定性 | **高** — 不清楚业务意图: OPTUM 是否真的应该支持 full 协议? |

**方案 A — 从 initialState 继承协议类型** (置信度 75%):
```typescript
// generateNeedleProtocol 增加 visitState 参数
export function generateNeedleProtocol(context: GenerationContext, visitState?: TXVisitState): string {
  // 如果 visitState 有针刺信息，优先使用
  const isFullCode = visitState?.needleProtocolType === 'full'
    ?? (INSURANCE_NEEDLE_MAP[context.insuranceType] === 'full')
  ...
}
```

**方案 B — 用 treatmentTime 推断协议类型** (置信度 80%):
```typescript
// generator.js 中已有 treatmentTime 参数
// 如果 treatmentTime >= 30，强制使用 full 协议
const isFullCode = treatmentTime >= 30 || INSURANCE_NEEDLE_MAP[context.insuranceType] === 'full'
```

**方案 C — 从输入TX的实际协议推断** (置信度 85%):
```typescript
// extractInitialState 中提取
const electricalStimulation = visit.plan.electricalStimulation
const treatmentTime = visit.plan.treatmentTime
// 如果输入TX有电刺激或时间>=30，说明实际是 full 协议
const needleProtocolType = (electricalStimulation || treatmentTime >= 30) ? 'full' : '97810'
```

**推荐方案 C**: 从输入TX的实际数据推断，最符合"续写应延续输入TX风格"的原则。

**风险点**:
- parser 的 `plan.treatmentTime` 固定为 15 (#54 提到)，可能不准确
- parser 的 `plan.electricalStimulation` 依赖正则解析，可能漏判
- 从头生成 (无 initialState) 时仍走 `INSURANCE_NEEDLE_MAP` 默认逻辑，不受影响

### 1.4 `generateNeedleProtocol` 增加 `visitState` 参数 (#18, #22)

| 维度 | 评估 |
|------|------|
| 置信度 | **80%** |
| 影响范围 | 1 文件 (`soap-generator.ts`): 函数签名 + `exportSOAPAsText` 调用处 |
| 回归风险 | **低** — visitState 是可选参数，IE 路径不传 |
| 不确定性 | visitState.needlePoints 是 engine 用解剖学名称选的，与 soap-generator 硬编码穴位名称不同 (#36) |

**风险点**: engine 的 `pickMultiple('plan.needleProtocol.points', 6, ...)` 从 whitelist 选穴位，但 whitelist 的穴位名称可能与 soap-generator 硬编码的不同。需要验证 whitelist 穴位是否与模板穴位一致。

**替代方案**: 不用 engine 选的穴位，而是从 `initialState.acupoints` 继承输入TX的实际穴位。置信度更高 (85%)，因为直接复用已有数据。

---

## Phase 2: 状态继承

### 2.1 painTypes 继承 (#1)

| 维度 | 评估 |
|------|------|
| 置信度 | **92%** |
| 影响范围 | 1 文件 (`soap-generator.ts` `generateSubjectiveTX`) |
| 回归风险 | **极低** |

```typescript
// generateSubjectiveTX 中
const selectedPainTypes = visitState?.painTypes  // 新增字段
  ?? selectBestOptions(weightedPainTypes, 2)     // fallback 到权重选择
```

**前提**: 依赖 1.1 扩展 initialState + engine 传递到 visitState。
**风险点**: parser 的 `visit.subjective.painTypes` 类型是 `PainType[]`，与 `calculateWeights` 的选项列表完全兼容 ✅

### 2.2 associatedSymptoms 继承 (#2)

| 维度 | 评估 |
|------|------|
| 置信度 | **65%** |
| 影响范围 | 2 文件: `generator.js` (提取), `tx-sequence-engine.ts` (初始化 prevAssociatedSymptom) |
| 回归风险 | **低** |
| 不确定性 | **高** — parser 不解析 associatedSymptoms 为结构化数据 (#69) |

**风险点**: 需要从 `chiefComplaint` 文本中正则提取 `"associated with muscles soreness, heaviness"` → `['soreness', 'heaviness']`。正则可能不稳定。

**替代方案**: 只初始化 `prevAssociatedSymptom` 为 `initialState.associatedSymptoms?.[0]`，让纵向 rank 约束从正确起点开始。不需要完整列表。置信度提升到 **80%**。

### 2.3 symptomScale 递减 (#3)

| 维度 | 评估 |
|------|------|
| 置信度 | **75%** |
| 影响范围 | 2 文件: `soap-generator.ts` (读取), `tx-sequence-engine.ts` (计算递减) |
| 回归风险 | **低** |
| 不确定性 | 百分比格式多样 (`"50%"`, `"70%-80%"`, `"40%"`)，递减逻辑需要解析和生成 |

**方案**: engine 中新增 `symptomScale` 字段，基于 progress 从 initialState 值递减:
```typescript
const startScale = parsePercent(initialState?.symptomScale) ?? 70
const currentScale = Math.max(10, startScale - Math.round(progress * 30))
// 吸附到模板选项: 10%|10%-20%|20%|...|100%
```

**风险点**: 百分比格式吸附逻辑需要与模板下拉框选项匹配。

### 2.4 generalCondition 继承 (#4)

| 维度 | 评估 |
|------|------|
| 置信度 | **93%** |
| 影响范围 | 2 文件: `generator.js` (提取), `tx-sequence-engine.ts` (使用) |
| 回归风险 | **极低** |

```typescript
// tx-sequence-engine.ts fixedGeneralCondition 闭包中
const fixedGeneralCondition: string = (() => {
  // 优先从 initialState 继承
  if (options.initialState?.generalCondition) return options.initialState.generalCondition
  if (context.baselineCondition) return context.baselineCondition
  // ... 原有推断逻辑
})()
```

**风险点**: parser 的 `visit.assessment.generalCondition` 类型是 `'good' | 'fair'`，没有 `'poor'`。但 engine 可能推断出 `'poor'`。需要确认 parser 是否能解析 `'poor'`。

### 2.5 inspection 继承 (#5)

| 维度 | 评估 |
|------|------|
| 置信度 | **90%** |
| 影响范围 | 1 文件 (`soap-generator.ts` `generateObjective`) |
| 回归风险 | **极低** |

```typescript
// generateObjective 中
const inspection = visitState?.inspection ?? inspectionDefault
// 替换所有 inspectionDefault 引用
```

**前提**: 需要在 TXVisitState 中新增 `inspection` 字段，从 initialState 传递。
**风险点**: parser 的 `visit.objective.inspection` 是 `InspectionType` 枚举，值固定为 3 个选项之一 ✅

### 2.6 肌肉列表继承 (#6)

| 维度 | 评估 |
|------|------|
| 置信度 | **55%** |
| 影响范围 | 1 文件 (`soap-generator.ts` `generateObjective`) |
| 回归风险 | **中** — 改变肌肉选择逻辑 |
| 不确定性 | **高** — 三套肌肉名称冲突 (#36, #71) |

**核心问题**: 输入TX的肌肉名称来自 `soap-generator.ts` 的 `MUSCLE_MAP`（模板名称），parser 解析后存储的也是模板名称。但 `generateObjective` 中 tightness 用权重选择、tenderness/spasm 用固定切片。要继承就需要：
1. 从 initialState 传入 3 组肌肉列表
2. `generateObjective` 优先使用传入的列表

**风险点**:
- 如果输入TX的肌肉数量与模板不同（如医生手动删减），续写可能格式异常
- tenderness/spasm 的固定切片逻辑需要改为条件分支
- 从头生成时仍走原逻辑，需要确保 fallback 正确

**替代方案**: 不继承具体肌肉名称，而是固定使用 `MUSCLE_MAP[bp]` 的全量列表 + 固定切片。这样至少保证续写TX之间肌肉一致（虽然可能与输入TX不同）。置信度 **85%**。

### 2.7 ADL 活动列表继承 (#7)

| 维度 | 评估 |
|------|------|
| 置信度 | **50%** |
| 影响范围 | 2 文件: `generator.js` (提取), `soap-generator.ts` (使用) |
| 回归风险 | **低** |
| 不确定性 | **很高** — parser 不解析 ADL 为结构化数据 |

**核心问题**: ADL 活动在 parser 中只存在于 `chiefComplaint` 和 `adlImpairment` 原始文本中，没有结构化的 `activities: string[]`。需要正则从文本中提取。

**风险点**:
- ADL 文本格式因身体部位不同而不同 (KNEE: `"difficulty Standing for long periods of time, Walking..."`, SHOULDER: `"difficulty of holding the pot..."`)
- 正则提取不稳定，可能漏提或错提
- 两组 ADL 的分组逻辑在文本中没有明确分隔符

**替代方案**: 不继承 ADL，而是固定使用 `ADL_MAP[bp]` 的权重选择结果。续写TX之间 ADL 可能不同，但至少都来自同一个身体部位的有效选项池。置信度 **85%**。

---

## Phase 3: 进度曲线优化

### 3.1 Pain 停滞修复 (#19, #20)

| 维度 | 评估 |
|------|------|
| 置信度 | **80%** |
| 影响范围 | 1 文件 (`tx-sequence-engine.ts` L548-554, L654-680) |
| 回归风险 | **中** — 改变 pain 计算核心逻辑 |

**方案**: 当 `startPain` 已接近 `targetPain` 时，切换到 longTermGoal:
```typescript
const shortTermTarget = parsePainTarget(context.previousIE?.plan?.shortTermGoal?.painScaleTarget, ...)
const longTermTarget = parsePainTarget(context.previousIE?.plan?.longTermGoal?.painScaleTarget, ...)
const targetPain = (startPain - shortTermTarget) < 1.5 ? longTermTarget : shortTermTarget
```

**风险点**: 从头生成时 `startPain` = IE pain (通常 7-8)，远离 shortTermTarget (5-6)，不会触发切换。只有续写时才可能触发。但需要确认 `longTermGoal.painScaleTarget` 在 `previousIE` 中是否可用。

### 3.2 进度曲线起点 (#34, #35)

| 维度 | 评估 |
|------|------|
| 置信度 | **85%** |
| 影响范围 | 1 文件 (`tx-sequence-engine.ts` L563) |
| 回归风险 | **低** |

```typescript
// 修复前
let prevProgress = 0

// 修复后
let prevProgress = startIdx > 1 ? (startIdx - 1) / txCount : 0
```

**风险点**: 这会让续写的第一个TX的 progress 不再从 0 开始，而是从已有进度开始。所有依赖 progress 的计算（pain, tightness, tenderness, frequency, ROM）都会受影响。需要验证不会导致数值跳变。

### 3.3 频率改善速度控制 (#14)

| 维度 | 评估 |
|------|------|
| 置信度 | **75%** |
| 影响范围 | 1 文件 (`tx-sequence-engine.ts` L700-703) |
| 回归风险 | **低** |

**方案**: 限制每次最多降 1 级，且需要连续 2 个TX progress > gate 才降:
```typescript
const frequencyImproveGate = progress > 0.55 && rng() > 0.55  // 提高门槛
```

---

## Phase 4: 文本质量

### 4.1 拼写修复 (#15, #58)

| 维度 | 评估 |
|------|------|
| 置信度 | **98%** |
| 影响范围 | 1 文件 1 行 (`soap-generator.ts` L2137) |
| 回归风险 | **极低** — 但需确认 checker/parser 是否依赖 `Assesment` 拼写 |

**风险点**: parser 中 `splitVisitRecords` 可能用 `Assesment` 作为分隔符。需要检查。

### 4.2 语法修复 (#47)

| 维度 | 评估 |
|------|------|
| 置信度 | **95%** |
| 影响范围 | 1 文件 1 行 (`soap-generator.ts` L1469) |
| 回归风险 | **极低** |

```typescript
// 修复前
'continue to be emphasize'
// 修复后
'continue to emphasize'
```

**风险点**: checker 的文本匹配规则可能依赖原始拼写。需要检查。

### 4.3 symptomChange 取消硬编码 (#39)

| 维度 | 评估 |
|------|------|
| 置信度 | **70%** |
| 影响范围 | 1 文件 (`tx-sequence-engine.ts` L939) |
| 回归风险 | **中** — 允许非 improvement 的 symptomChange 会影响整个 S→O→A 链 |

```typescript
// 修复前
symptomChange: 'improvement of symptom(s)',
// 修复后
symptomChange,  // 使用 pickSingle 的结果
```

**风险点**: `addProgressBias` 给 improvement +80、exacerbate -100，所以 99% 情况仍然选 improvement。但如果 disruption 很高，可能选到 `"came back"`，此时 Assessment 的 `deriveAssessmentFromSOA` 仍然假设 improvement → S→A 矛盾。需要同时修改 `deriveAssessmentFromSOA` 支持非 improvement 场景。

---

## 置信度总览

| Phase | 修复项 | 置信度 | 回归风险 | 建议 |
|-------|--------|--------|---------|------|
| 0 | #78 txVisits 取错 | **99%** | 极低 | ✅ 立即修 |
| 1.1 | 扩展 initialState | **95%** | 低 | ✅ 修 — parser 直接可用字段已验证 |
| 1.2 | prev* 初始化 | **97%** | 极低 | ✅ 立即修 |
| 1.3 | OPTUM 针刺映射 | **85%** | 中 | ✅ 方案C — parser `treatmentTime` 是动态解析的 |
| 1.4 | needleProtocol 参数 | **85%** | 低 | ✅ 从 initialState 继承穴位+时间+电刺激 |
| 2.1 | painTypes 继承 | **95%** | 极低 | ✅ parser `painTypes: PainType[]` 直接可用 |
| 2.2 | associatedSymptoms | **80%** | 低 | ✅ 只初始化 prevAssociatedSymptom |
| 2.3 | symptomScale 递减 | **82%** | 低 | ✅ parser `muscleWeaknessScale` 单症状可用 |
| 2.4 | generalCondition | **95%** | 极低 | ✅ parser `assessment.generalCondition` 直接可用 |
| 2.5 | inspection 继承 | **95%** | 极低 | ✅ parser `objective.inspection` 直接可用 |
| 2.6 | 肌肉列表继承 | **85%** | 低 | ✅ 替代方案: 固定 MUSCLE_MAP + 固定切片 |
| 2.7 | ADL 继承 | **85%** | 低 | ✅ 替代方案: 固定 ADL_MAP 权重选择 |
| 3.1 | Pain 停滞 | **85%** | 中 | ✅ bridge 已传 longTermGoal.painScaleTarget |
| 3.2 | 进度起点 | **90%** | 低 | ✅ 修 |
| 3.3 | 频率速度 | **80%** | 低 | ✅ 修 |
| 4.1 | Assesment 拼写 | **99%** | 极低 | ✅ 修 — parser 用 `Subjective:` 分隔，不依赖 Assessment |
| 4.2 | 语法修复 | **99%** | 极低 | ✅ 修 — parser/checker 不引用此文本 |
| 4.3 | symptomChange | **75%** | 中 | ⚠️ 需同时改 deriveAssessmentFromSOA |

---

## 代码验证结果 (v2 新增)

### ✅ 拼写修复安全性确认 (#15/#58) → 置信度 98% → **99%**
- `splitVisitRecords` 用 `Subjective:` 分隔，不依赖 `Assessment` 拼写
- `parseVisitRecord` 调用 `parseAssessment(block)` 解析整个 block，不按 section header 切分
- `normalizePdfText` 有 `[/A\s+ssessment/g, 'Assessment']` 修复 PDF 断词
- `dropdown-parser.ts` L394 已兼容: `trimmed === 'assessment' || trimmed === 'assesment'`
- **结论**: 改 `Assesment` → `Assessment` 不影响任何解析逻辑

### ✅ 语法修复安全性确认 (#47) → 置信度 95% → **99%**
- `continue to be emphasize` 出现在 4 个文件:
  - `soap-generator.ts` L1470 (TX_VERB_OPTIONS)
  - `assessment-generator.ts` L78
  - `plan-generator.ts` L93
  - `dropdown-parser.ts` L302 (inferFieldPath 匹配条件)
- parser/checker 目录下 **0 处引用**
- **需要同步改 4 个文件**，但都是选项列表，不影响解析
- `dropdown-parser.ts` L302 的 `options.includes('continue to be emphasize')` 需要同步改为 `options.includes('continue to emphasize')`

### ✅ parser `treatmentTime` 是动态解析的 → OPTUM 方案C 置信度 70% → **85%**
- `parsePlan` L805: `const timeMatch = block.match(/Total Operation Time\s*:\s*(\d+)\s*mins?/i)`
- `treatmentTime = timeMatch ? parseInt(timeMatch[1], 10) : 15` — 有匹配就用实际值
- 输入TX如果有 `Total Operation Time: 60 mins`，parser 会正确解析为 60
- `plan.electricalStimulation` 通过 `/with electrical stimulation/i` 检测 — 可靠
- **结论**: 从输入TX的 `plan.treatmentTime` 和 `plan.electricalStimulation` 推断协议类型是可靠的

### ✅ parser 字段可用性验证 → initialState 扩展置信度 90% → **95%**

| 字段 | parser 来源 | 可用性 | 备注 |
|------|-----------|--------|------|
| `painTypes` | `visit.subjective.painTypes: PainType[]` | ✅ 直接可用 | `extractPainTypes` 从 chiefComplaint 提取 |
| `generalCondition` | `visit.assessment.generalCondition: 'good'\|'fair'` | ✅ 直接可用 | 无 `'poor'` 选项，但续写时 engine 可能推断 poor |
| `inspection` | `visit.objective.inspection: InspectionType` | ✅ 直接可用 | 3 个枚举值之一 |
| `tonguePulse` | `visit.objective.tonguePulse: {tongue, pulse}` | ✅ 直接可用 | |
| `tightnessMuscles` | `visit.objective.tightnessMuscles.muscles: string[]` | ✅ 直接可用 | 模板名称 |
| `tendernessMuscles` | `visit.objective.tendernessMuscles.muscles: string[]` | ✅ 直接可用 | |
| `spasmMuscles` | `visit.objective.spasmMuscles.muscles: string[]` | ✅ 直接可用 | |
| `acupoints` | `visit.plan.acupoints: string[]` | ⚠️ 不完整 | #66 只解析第一个 step |
| `electricalStimulation` | `visit.plan.electricalStimulation: boolean` | ✅ 可靠 | |
| `treatmentTime` | `visit.plan.treatmentTime: number` | ✅ 动态解析 | 有值就准确 |
| `symptomScale` | `visit.subjective.muscleWeaknessScale: string` | ⚠️ 多症状失败 | 单症状 OK，`"soreness, heaviness"` 格式失败 |
| `associatedSymptoms` | 不存在 | ❌ 无结构化字段 | 只在 chiefComplaint 原文中 |
| `adlActivities` | `visit.subjective.adlImpairment: string` | ⚠️ 原始文本 | 非结构化，需正则拆分 |

### ✅ muscleWeaknessScale 正则验证 → symptomScale 置信度 75% → **82%**
```
✅ "muscles soreness (scale as 50%)"     → "50%"
✅ "muscles numbness (scale as 70%-80%)" → "70%-80%"
❌ "muscles soreness, heaviness (scale as 50%)" → undefined (多症状失败)
```
- 单症状格式 (TX 续写生成的格式) 能正确解析
- 多症状格式 (医生手动输入) 会失败 → fallback 到空字符串
- **修复方案**: `extractInitialState` 中 fallback 到 `SYMPTOM_SCALE_MAP[bp]` 而非空值
- **或**: 修复 parser 正则为 `/muscles?\s+\w+(?:,\s*\w+)*\s*\(?\s*scale\s+as\s+(\d+%(?:-\d+%)?)\)?/i`

### ✅ bridge 已传 longTermGoal → Pain 停滞置信度 80% → **85%**
- `bridgeVisitToSOAPNote` L175: `painScaleTarget: visit.plan.longTermGoal?.painScaleTarget || '3'`
- `context.previousIE.plan.longTermGoal.painScaleTarget` 在续写时可用
- **结论**: 可以安全地在 engine 中读取 longTermGoal target

### ✅ 肌肉列表替代方案验证 → 置信度 55% → **85%**
- `generateObjective` 中 tightness 用 `calculateWeights` 从 `MUSCLE_MAP[bp]` 选 3 个
- tenderness 用 `muscles.slice(7, 12)` 固定切片
- spasm 用 `muscles.slice(3, 7)` 固定切片
- **替代方案**: 不改选择逻辑，但确保续写TX之间用相同的 seed → 选出相同肌肉
- **更好的替代方案**: 在 `generateObjective` 中，如果 `visitState` 存在，直接用 `MUSCLE_MAP[bp]` 的固定子集而非权重选择。这样续写TX之间肌肉列表一致。
- **回归风险**: 从头生成不受影响（无 visitState 时走原逻辑）

---

## 推荐执行顺序 (v2 更新)

### 第一批: 高置信度 + 低风险 — 全部 ≥95% (可立即执行)
1. **#78** txVisits 取错 (99%) — 1 文件 1 行
2. **#15/#58** 拼写 `Assesment` → `Assessment` (99%) — 1 文件 1 行
3. **#47** 语法 `continue to be emphasize` → `continue to emphasize` (99%) — 4 文件各 1 行
4. **#9/#10** prev* 初始化 (97%) — 1 文件 2 行
5. **#4** generalCondition 继承 (95%) — 2 文件 3 行
6. **#1** painTypes 继承 (95%) — 2 文件 2 行
7. **#5** inspection 继承 (95%) — 1 文件 2 行
8. **#17** 扩展 initialState (95%) — 2 文件

### 第二批: 中高置信度 — 全部 ≥80%
9. **#35** 进度起点 (90%) — 1 文件 1 行
10. **#11/#21/#53** OPTUM 针刺映射 (85%) — 方案C: 从 initialState 推断
11. **#22** needleProtocol 接收 visitState (85%) — 1 文件签名+调用
12. **#6** 肌肉列表一致性 (85%) — 替代方案: visitState 存在时用固定子集
13. **#7** ADL 一致性 (85%) — 替代方案: 固定 ADL_MAP 权重选择
14. **#19/#20** Pain 停滞 (85%) — 切换到 longTermGoal
15. **#3** symptomScale 递减 (82%) — fallback 到 SYMPTOM_SCALE_MAP
16. **#2** associatedSymptoms (80%) — 只初始化 prevAssociatedSymptom
17. **#14** 频率速度 (80%) — 提高门槛

### 暂缓: 需要链式逻辑同步修改
18. **#39** symptomChange 取消硬编码 (75%) — 需同时改 deriveAssessmentFromSOA
