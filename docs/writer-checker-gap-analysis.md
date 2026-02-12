# Writer vs Checker 差异分析与 2.0 优化建议

## 1. 架构对比

### Writer（生成端）
```
用户表单 → useWriterFields → generationContext
  → tx-sequence-engine (S曲线 + seeded RNG)
  → soap-generator (exportSOAPAsText)
  → 纯文本 SOAP 笔记
```

### Checker（校验端）
```
PDF 上传 → parser.ts (normalizePdfText → splitVisitRecords → parseVisitRecord)
  → bridge.ts (bridgeToContext / bridgeVisitToSOAPNote)
  → note-checker.ts (50+ 规则: IE/TX/Sequence/Code/Text/Generator)
  → correction-generator.ts (computeFixes → applyFixesToContext → exportSOAPAsText)
```

### 共享层
| 模块 | 路径 | 用途 |
|------|------|------|
| severity.ts | src/shared/severity.ts | severityFromPain, expectedTenderMinScaleByPain |
| soap-generator.ts | src/generator/soap-generator.ts | exportSOAPAsText (两端共用) |
| goals-calculator.ts | src/generator/goals-calculator.ts | calculateDynamicGoals |
| types.ts | src/types.ts | GenerationContext, SOAPNote 等类型 |

---

## 2. 规则覆盖对比

### 2.1 Checker 有但 Writer 未显式保证的规则

| 规则ID | 严重度 | 规则内容 | Writer 现状 | 风险 |
|--------|--------|----------|-------------|------|
| **T02** | CRITICAL | improvement 描述 + 数值恶化矛盾 | tx-sequence-engine 的 soaChain.assessment 由 deriveAssessmentFromSOA 计算，基于 painDelta。但 symptomChange 由 pickSingle 概率选择，理论上可能选到 "improvement" 而 pain 未降 | **高** — 概率选择可能违反硬约束 |
| **T03** | CRITICAL | exacerbate 描述 + 数值改善矛盾 | 同上，addProgressBias 压低 exacerbate 权重但不是硬约束 | **高** |
| **TX05** | CRITICAL | TX 舌脉与 IE 基线不一致 | Writer 的 fixedTonguePulse 从 IE 继承，**已保证** | 低 |
| **TX06** | CRITICAL | TX 不应携带 goals | Writer TX 模式不生成 goals，**已保证** | 低 |
| **T07** | CRITICAL | Pacemaker + 电刺激矛盾 | Writer 通过 hasPacemaker 传入 context，weight-integration 中 selectElectricalStimulation 检查。**已保证** | 低 |
| **V01** | HIGH | pain 不回升 | tx-sequence-engine 用 `Math.min(prevPain, ...)` 硬约束，**已保证** | 低 |
| **V02** | HIGH | tenderness 不回升 | 有 `Math.min(prevTenderness, ...)` 约束，**已保证** | 低 |
| **V03** | HIGH | tightness 不恶化 | 有纵向单调约束 + compareSeverity 检查，**已保证** | 低 |
| **V04** | HIGH | spasm 不回升 | 有 `Math.min(prevSpasm, ...)` 约束，**已保证** | 低 |
| **V05** | HIGH | ROM 不下降 | calculateRomValue 基于 progress 单调递增，**已保证** | 低 |
| **V06** | MEDIUM | strength 不下降 | calculateStrength 基于 progress 单调递增，**已保证** | 低 |
| **V07** | MEDIUM | frequency 不增加 | 有纵向约束 `Math.min(prevFrequency, ...)` ，**已保证** | 低 |
| **V09** | HIGH | 穴位跨 TX 重叠度 >= 0.4 | Writer 穴位由 FIXED_FIELDS 固定，所有 TX 相同，**已保证** | 低 |
| **T06** | MEDIUM | 进展状态 + 原因逻辑矛盾 | symptomChange 和 reason 都由 pickSingle 独立选择 | **中** — 可能出现 improvement + negative reason |
| **T08** | HIGH | ADL severity 单调性 | severity 由 severityFromPain 推导，pain 单调 → severity 单调，**已保证** | 低 |
| **T09** | MEDIUM | 伴随症状级别单调性 | tx-sequence-engine 有 associatedSymptomRank 约束，**已保证** | 低 |
| **T01** | HIGH | 方向词 + 名词极性矛盾 | deriveAssessmentFromSOA 生成 Assessment 文本，逻辑正确但无后置校验 | **中** — 模板拼接可能引入矛盾 |
| **T04** | HIGH | ROM 描述矛盾 | Assessment 中 romTrend 由 objective 推导，逻辑正确 | 低 |
| **T05** | HIGH | 肌力描述矛盾 | Assessment 中 strengthTrend 由 objective 推导，逻辑正确 | 低 |
| **S2** | MEDIUM | painTypes vs localPattern | Writer 由用户选择 painTypes，无自动校验 | **中** — 用户可能选错 |
| **S3** | MEDIUM | ADL activities vs bodyPart | Writer 由用户选择 activities，无自动校验 | **中** |
| **S7** | HIGH | symptomScale vs pain | Writer 由用户选择 symptomScale，无自动校验 | **高** — 用户可能设置不一致 |
| **O1** | HIGH | ROM degrees vs pain | Writer ROM 由 calculateRomValue 自动计算，**已保证** | 低 |
| **O2** | HIGH | ROM limitation label vs degrees | Writer ROM label 由计算推导，**已保证** | 低 |
| **DX01-04** | CRITICAL | ICD/CPT 编码校验 | Writer 不生成编码，**不适用** | — |
| **CPT01-03** | CRITICAL | CPT 编码校验 | Writer 不生成编码，**不适用** | — |

### 2.2 高风险差异汇总

| # | 风险 | 描述 | 影响 |
|---|------|------|------|
| 1 | **CRITICAL** | symptomChange 概率选择可能违反 T02/T03 | improvement + pain 未降 / exacerbate + pain 已降 |
| 2 | **HIGH** | symptomChange + reason 独立选择可能违反 T06 | improvement + "skipped treatments" |
| 3 | **HIGH** | 用户选择的 symptomScale 无 vs pain 校验 (S7) | pain=8 但 symptomScale=20% |
| 4 | **MEDIUM** | 用户选择的 painTypes 无 vs localPattern 校验 (S2) | Blood Stasis + "Dull" |
| 5 | **MEDIUM** | 用户选择的 ADL activities 无 vs bodyPart 校验 (S3) | KNEE + "combing hair" |

---

## 3. 数据映射差异

### 3.1 severityFromPain 一致性 ✅
```
Writer:  tx-sequence-engine.ts:336-348  (本地副本)
Checker: src/shared/severity.ts:13-19
```
两者逻辑完全一致：`>=9 severe, >=7 m2s, >=6 moderate, >=4 m2m, else mild`

### 3.2 expectedTenderMinScaleByPain 一致性 ✅
```
Writer:  不直接使用（tenderness 由 progress 推导）
Checker: src/shared/severity.ts:26-31
```
Writer 的 tenderness 从 pain 推导初始值，然后单调递减。Checker 校验最低值。两者兼容。

### 3.3 舌脉→证型映射 ⚠️ 部分不一致
```
Writer:  soap-generator.ts 中 TCM_PATTERNS 知识库
Checker: correction-generator.ts:29-38 PATTERN_TO_TONGUE_PULSE (8 种证型)
         note-checker.ts:44-53 isTonePatternConsistent (3 种证型)
```
- Checker 的 isTonePatternConsistent 只检查 3 种证型（Qi Stagnation, Blood Stasis, Phlegm-Damp）
- correction-generator 有 8 种证型映射
- Writer 使用 TCM_PATTERNS 知识库，覆盖更全
- **风险**: Checker 对未覆盖证型默认返回 true（不检查），可能漏检

### 3.4 painTypes→localPattern 映射 ⚠️
```
Writer:  用户手动选择，无自动校验
Checker: note-checker.ts:1050-1056 painMap (5 种证型)
```
Writer 完全依赖用户选择，Checker 有 5 种证型的 painType 映射校验。

### 3.5 ADL activities→bodyPart 映射 ⚠️
```
Writer:  tx-sequence-engine.ts ADL_MAP (6 部位，每部位 10 个活动)
Checker: note-checker.ts:1073-1078 adlKeywords (4 部位，关键词匹配)
```
Writer 的 ADL_MAP 更完整（6 部位），但用户可以手动选择任意活动。Checker 只检查 4 部位的关键词。

### 3.6 GenerationContext 字段覆盖差异

| 字段 | Writer 来源 | Checker bridge 来源 | 差异 |
|------|-------------|---------------------|------|
| painCurrent | 用户输入 painScale.current | parsePainCurrent (多格式兼容) | Writer 更直接 |
| severityLevel | derivedSeverity (computed) | parseSeverityFromVisit | 逻辑一致 |
| chronicityLevel | 用户选择 | 从 chiefComplaint 推断 | Writer 更可靠 |
| localPattern | 用户选择 | extractLocalPattern (正则清洗) | Checker 需要清洗 |
| systemicPattern | 用户选择 | inferSystemicPattern (从 IE 推断) | Writer 更可靠 |
| associatedSymptoms | 用户多选 | parseAssociatedSymptoms (正则提取) | Writer 更可靠 |
| causativeFactors | 用户多选 | parseCausativeFactors (正则提取) | Writer 更可靠 |
| relievingFactors | 用户多选 | parseRelievingFactors (正则提取) | Writer 更可靠 |
| hasPacemaker | medicalHistory.includes('Pacemaker') | medicalHistory regex | 逻辑一致 |
| originalSOAP | 无 | bridgeVisitToSOAPNote | Checker 独有 |
| previousIE | 无 | bridgeVisitToSOAPNote(ieVisit) | Checker 独有 |

---

## 4. 优化建议

### P0 — 必须修复（CRITICAL 风险）

#### 4.1 symptomChange 硬约束守卫
**问题**: tx-sequence-engine 中 symptomChange 由 `pickSingle` 概率选择，可能选到与 painDelta 矛盾的值。

**方案**: 在 pickSingle 之后添加硬约束守卫：
```typescript
// tx-sequence-engine.ts generateTXSequenceStates 循环内
let symptomChange = pickSingle('subjective.symptomChange', ruleContext, progress, rng, 'improvement of symptom(s)')

// 硬约束: T02/T03 守卫
if (painDelta <= 0 && symptomChange.includes('improvement')) {
  symptomChange = 'similar symptom(s) as last visit'
}
if (painDelta > 0.5 && symptomChange.includes('exacerbate')) {
  symptomChange = 'similar symptom(s) as last visit'
}
```

#### 4.2 symptomChange + reason 联动守卫
**问题**: symptomChange 和 reason 独立选择，可能出现 "improvement" + "skipped treatments"。

**方案**: reason 选择时根据 symptomChange 过滤：
```typescript
// 如果 symptomChange 是 improvement，排除负向原因
// 如果 symptomChange 是 exacerbate，排除正向原因
```

### P1 — 建议修复（HIGH 风险）

#### 4.3 用户输入前置校验
**问题**: 用户选择的 symptomScale、painTypes、ADL activities 无交叉校验。

**方案**: 在 WriterView Step 1 完成时添加校验提示：
- symptomScale vs painScale.current (S7 规则)
- painTypes vs localPattern (S2 规则)
- ADL activities vs bodyPart (S3 规则)

实现方式：在 useWriterFields 中添加 `validateCrossFields()` 函数，返回警告列表。

#### 4.4 Writer 内置 Checker 自检
**问题**: Writer 生成的笔记无法保证通过 Checker 校验。

**方案**: 生成后自动运行 Checker 核心规则子集（不含 PDF 解析和编码校验），在 UI 显示通过/警告状态。

### P2 — 改进建议（MEDIUM 风险）

#### 4.5 统一舌脉→证型映射
**问题**: Writer (TCM_PATTERNS)、Checker validator (3种)、Checker corrector (8种) 三处映射不统一。

**方案**: 提取到 `src/shared/tcm-mappings.ts`，三处引用同一数据源。

#### 4.6 统一 ADL→bodyPart 映射
**问题**: Writer (ADL_MAP 6部位) 和 Checker (adlKeywords 4部位) 映射不统一。

**方案**: 提取到 `src/shared/adl-mappings.ts`，Checker 引用 Writer 的完整映射。

#### 4.7 Checker isTonePatternConsistent 扩展
**问题**: 只覆盖 3 种证型，其余默认通过。

**方案**: 使用统一的 tcm-mappings 扩展到全部证型。

### P3 — 架构优化

#### 4.8 共享规则引擎
**现状**: Writer 用 weight-system + template-logic-rules 做概率选择，Checker 用 note-checker 做确定性校验。两套规则独立维护。

**方案**: 提取 Checker 的硬约束规则为 `src/shared/soap-constraints.ts`，Writer 在生成后运行约束检查，Checker 在校验时引用同一规则集。

#### 4.9 Bridge 反向复用
**现状**: bridge.ts 将 PDF 解析结果转为 GenerationContext。Writer 直接从表单构建 generationContext。

**方案**: 让 Writer 的 generationContext 构建逻辑与 bridge.ts 的输出格式完全对齐，确保两端使用相同的 GenerationContext 结构。

---

## 5. 已完成修复

### 5.1 Goals Calculator 对齐 (已完成)
**问题**: goals-calculator 的 pain<=6 分支直接返回 `painCurrent` 作为 ST Goal，导致 ST=pain（无改善目标），违反 Checker IE05。tx-sequence-engine 的 LT fallback 用 `pain-4` 与 goals-calculator 的 `ceil(pain*0.25)` 不一致。

**修复**:
- `goals-calculator.ts`: pain<=3 → ST=1/LT=1, pain<=6 → ST=2/LT=1
- `tx-sequence-engine.ts`: fallback 公式同步对齐，LT 从 `pain-4` 改为 `ceil(pain*0.25)`

**验证结果** (goals-calculator ↔ tx-sequence-engine 全部对齐):
| Pain | ST Goal | LT Goal |
|------|---------|---------|
| 10 | 5 | 3 |
| 9 | 4 | 3 |
| 8 | 4 | 2 |
| 7 | 4 | 2 |
| 6 | 2 | 1 |
| 5 | 2 | 1 |
| 4 | 2 | 1 |
| 3 | 1 | 1 |

---

## 6. 实施优先级

| 阶段 | 任务 | 预期效果 |
|------|------|----------|
| ~~**Phase 0**~~ | ~~Goals Calculator 对齐~~ | ~~✅ 已完成~~ |
| **Phase 1** | 4.1 + 4.2 symptomChange 硬约束 | 消除 CRITICAL 矛盾风险 |
| **Phase 2** | 4.3 用户输入交叉校验 | 减少用户输入错误 |
| **Phase 3** | 4.5 + 4.6 + 4.7 统一映射 | 消除数据源分歧 |
| **Phase 4** | 4.4 + 4.8 共享规则引擎 | Writer 生成即通过 Checker |
