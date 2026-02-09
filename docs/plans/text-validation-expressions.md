# Text Validation Expressions Reference

> 从所有模板生成器中提取的完整文本表述，用于设计文本一致性验证规则

---

## 1. Subjective Section (S段) 表述

来源: `src/generator/subjective-generator.ts`

### 1.1 IE 患者陈述句式模板

#### 句式: Patient c/o (主诉)

```
"Patient c/o [chronicity] pain [laterality] [bodyArea] which is [painTypes] [radiation].
The patient has been complaining of the pain for [durationNumber] [durationUnit] which got worse in recent [durationNumber] [durationUnit].
The pain is associated with muscles [associatedSymptoms] (scale as [percentageScale]) [causeType] [causativeFactors].
The pain is [exacerbationType] [exacerbatingFactors].
There is [severityLevel] difficulty with ADLs like [adlActivities]."
```

### 1.2 TX 患者陈述句式模板

#### 句式1: Patient reports (进展报告)

```
"Patient reports: there is [progressStatus] [causeType] [progressReasons]."
```

**完整示例**:
- ✓ "Patient reports: there is improvement of symptom(s) because of maintain regular treatments."
- ✓ "Patient reports: there is exacerbate of symptom(s) due to discontinuous treatments."
- ✗ "Patient reports: there is improvement of symptom(s) because of skipped treatments." (矛盾)

#### 句式2: Patient still c/o (持续主诉)

```
"Patient still c/o [painTypes] pain on [bodyArea] area [radiation],
associated with muscles [associatedSymptoms] (scale as [percentageScale]),
impaired performing ADL's with [severityLevel] difficulty with ADLs like [adlActivities]."
```

### 1.3 进展状态 (progressStatus)

```typescript
progressStatus: [
  'improvement of symptom(s)',                              // 正向 ✓
  'exacerbate of symptom(s)',                               // 负向 ✗
  'similar symptom(s) as last visit',                       // 中性 →
  'improvement after treatment, but pain still came back next day'  // 混合
]
```

### 1.4 进展原因 (progressReasons)

```typescript
// 正向原因 (解释改善) - 与 improvement 搭配
positiveReasons: [
  'can move joint more freely and with less pain',
  'physical activity no longer causes distress',
  'reduced level of pain',
  'reduced joint stiffness and swelling',
  'less difficulty performing daily activities',
  'energy level improved',
  'sleep quality improved',
  'more energy level throughout the day',
  'continuous treatment',
  'maintain regular treatments'
]

// 负向原因 (解释恶化) - 与 exacerbate 搭配
negativeReasons: [
  'still need more treatments to reach better effect',
  'weak constitution',
  'skipped treatments',
  'stopped treatment for a while',
  'discontinuous treatment',
  'discontinuous treatments',
  'did not have good rest',
  'intense work',
  'working on computer day by day',
  'excessive time using cell phone',
  'excessive time using computer',
  'bad posture',
  'bad posture day by day',
  'carrying/lifting heavy object(s)',
  'lack of exercise',
  'exposure to cold air',
  'uncertain reason'
]
```

### 1.5 TX 原因选项 (嵌入式)

```typescript
txReasonOptions: [
  'maintain regular treatments',                    // 正向
  'still need more treatments to reach better effect',  // 中性
  'uncertain reason',                               // 中性
  'discontinuous treatments',                       // 负向
  'stopped treatment for a while',                  // 负向
  'intense work',                                   // 负向
  'working on computer day by day',                 // 负向
  'excessive time using cell phone',                // 负向
  'bad posture day by day',                         // 负向
  'carrying/lifting heavy object(s)',               // 负向
  'lack of exercise',                               // 负向
  'exposure to cold air'                            // 负向
]
```

### 1.6 情绪/心理状态

```typescript
emotionalStatus: [
  'Normal',              // 中性
  'Emotion stress',      // 负向
  'Lack of motivation',  // 负向
  'Anxiety',             // 负向
  'Restless',            // 负向
  'Irritability',        // 负向
  'Lassitude'            // 负向
]

mentalStatus: [
  'Normal',     // 中性
  'Stressful',  // 负向
  'Anxious',    // 负向
  'Depressed',  // 负向
  'Irritable',  // 负向
  'Sad',        // 负向
  'Negative',   // 负向
  'Positive'    // 正向
]
```

### 1.7 严重程度 (severityLevel)

```typescript
severityLevel: [
  'severe',              // 5 (最严重)
  'moderate to severe',  // 4
  'moderate',            // 3
  'mild to moderate',    // 2
  'mild'                 // 1 (最轻)
]
```

### 1.8 伴随症状 (associatedSymptoms)

```typescript
associatedSymptoms: [
  'soreness',    // 1 (最轻)
  'stiffness',   // 2
  'heaviness',   // 3
  'weakness',    // 4 (较重)
  'numbness'     // 4 (较重)
]
```

### 1.9 疼痛频率 (painFrequency)

```typescript
painFrequency: [
  'Intermittent (symptoms occur less than 25% of the time)',      // 0 (最轻)
  'Occasional (symptoms occur between 26% and 50% of the time)',  // 1
  'Frequent (symptoms occur between 51% and 75% of the time)',    // 2
  'Constant (symptoms occur between 76% and 100% of the time)'    // 3 (最重)
]
```

### 1.10 慢性程度 (chronicity)

```typescript
chronicity: ['Acute', 'Sub Acute', 'Chronic']
```

### 1.11 原因类型 (causeType)

```typescript
causeType: ['because of', 'may related of', 'due to']
causeTypeTX: ['because of', 'may related of', 'due to', 'and']
```

### 1.12 加重类型 (exacerbationType)

```typescript
exacerbationType: ['exacerbated by', 'aggravated by']
```

---

## 2. Objective Section (O段) 表述

来源: `src/generator/objective-generator.ts`

### 2.1 肌肉紧张度分级 (Tightness Grading)

```typescript
TIGHTNESS_GRADING_OPTIONS: [
  'moderate',           // 3
  'moderate to severe', // 4
  'severe',             // 5
  'mild to moderate',   // 2
  'mild'                // 1
]
```

### 2.2 压痛分级 (Tenderness Grading)

```typescript
TENDERNESS_GRADING_OPTIONS: [
  '(+4) = Patient complains of severe tenderness, withdraws immediately...',    // 4 (最重)
  '(+3) = Patient complains of considerable tenderness and withdraws...',       // 3
  '(+2) = Patient states that the area is moderately tender',                   // 2
  '(+1) = Patient states that the area is mildly tender-annoying'               // 1 (最轻)
]
```

### 2.3 痉挛分级 (Spasm Grading)

```typescript
SPASM_GRADING_OPTIONS: [
  '(0)=No spasm',                                                    // 0 (无)
  '(+1)=No spontaneous spasms; vigorous stimulation results...',    // 1
  '(+2)=Occasional spontaneous spasms and easily induced...',       // 2
  '(+3)=>1 but < 10 spontaneous spasms per hour.',                  // 3
  '(+4)=>10 spontaneous spasms per hour.'                           // 4 (最重)
]
```

### 2.4 肌力分级 (Muscle Strength)

```typescript
MUSCLE_STRENGTH_OPTIONS: [
  '4+/5',  // 4.5
  '4/5',   // 4
  '4-/5',  // 3.8
  '3+/5',  // 3.5
  '3/5',   // 3
  '3-/5',  // 2.8
  '2+/5',  // 2.5
  '2/5',   // 2
  '2-/5',  // 1.8
  '0'      // 0
]
```

### 2.5 ROM 严重程度标签

```typescript
// 嵌入在角度选项中
romSeverityLabels: [
  'normal',    // 正常
  'mild',      // 轻度受限
  'moderate',  // 中度受限
  'severe'     // 重度受限
]

// 示例: "60 Degrees(moderate)", "90 Degrees(normal)"
```

### 2.6 Inspection 选项

```typescript
INSPECTION_OPTIONS: [
  'local skin no damage or rash',
  'weak muscles and dry skin without luster',
  'joint swelling',
  'joint deformation',
  'The Left muscles higher than Right.',
  'Both muscles are at the same level',
  'The Right muscles higher than Left',
  'local muscles smaller than normal side'
]
```

---

## 3. Assessment Section (A段) 表述

来源: `src/generator/assessment-generator.ts`

### 3.1 症状变化描述 (symptomChange)

```typescript
SYMPTOM_CHANGE_OPTIONS: [
  'slight improvement of symptom(s).',    // 正向 (轻微改善)
  'improvement of symptom(s).',           // 正向 (改善)
  'exacerbate of symptom(s).',            // 负向 (恶化)
  'no change.'                            // 中性 (无变化)
]
```

### 3.2 变化程度词 (changeLevel)

```typescript
CHANGE_LEVEL_OPTIONS: [
  'reduced',           // 正向 (减少) ✓
  'slightly reduced',  // 正向 (轻微减少) ✓
  'increased',         // 负向 (增加) ✗
  'slight increased',  // 负向 (轻微增加) ✗
  'remained the same'  // 中性 (保持不变) →
]
```

### 3.3 物理发现名词 (physicalFindings)

```typescript
PHYSICAL_FINDING_OPTIONS: [
  // 负向名词 (数值下降=改善, 应与 reduced 搭配)
  'local muscles tightness',    // 肌肉紧张
  'local muscles tenderness',   // 肌肉压痛
  'local muscles spasms',       // 肌肉痉挛
  'joint ROM limitation',       // 关节活动受限

  // 正向名词 (数值上升=改善, 应与 increased 搭配)
  'muscles strength',           // 肌力
  'joint ROM'                   // 关节活动度
]
```

### 3.4 General Condition

```typescript
generalCondition: ['good', 'fair', 'poor']
```

---

## 4. Plan Section (P段) 表述

来源: `src/generator/plan-generator.ts`

### 4.1 目标动词 (Goal Actions)

```typescript
// 用于 Short/Long Term Goal
goalActions: [
  'Decrease Pain Scale to',              // 减少 (负向指标)
  'Decrease [symptom] sensation Scale to',
  'Decrease Muscles Tightness to',
  'Decrease Muscles Tenderness to Grade',
  'Decrease Muscles Spasms to Grade',
  'Decrease impaired Activities of Daily Living to',
  'Increase Muscles Strength to',        // 增加 (正向指标)
  'Increase ROM'
]
```

### 4.2 治疗原则焦点 (Treatment Principles Focus)

```typescript
treatmentPrinciplesFocus: [
  'continue to be emphasize',
  'emphasize',
  'consist of promoting',
  'promote',
  'focus',
  'pay attention'
]
```

### 4.3 治疗行动 (Treatment Actions)

```typescript
treatmentActions: [
  'moving qi',
  'regulates qi',
  'activating Blood circulation to dissipate blood stagnant',
  'dredging channel and activating collaterals',
  'activate blood and relax tendons',
  'eliminates accumulation',
  'resolve stagnation, clears heat',
  'promote circulation, relieves pain',
  'expelling pathogens',
  'dispelling cold, drain the dampness',
  'strengthening muscles and bone',
  'clear heat, dispelling the flame',
  'clear damp-heat',
  'drain the dampness, clear damp'
]
```

### 4.4 电刺激选项

```typescript
withWithout: ['with', 'without']
// 与 pacemaker 医疗史关联
// 有 pacemaker → 必须 without
```

---

## 5. 语义分类汇总

### 5.1 方向词分类

| 类型 | 词汇 | 含义 |
|------|------|------|
| 正向 | `reduced`, `slightly reduced`, `improvement`, `improved`, `Decrease` | 情况好转 |
| 负向 | `increased`, `slight increased`, `exacerbate`, `worsened` | 情况恶化 |
| 中性 | `remained the same`, `no change`, `similar` | 情况不变 |

### 5.2 名词极性分类

| 极性 | 名词 | 数值变化含义 |
|------|------|-------------|
| 负向名词 | `tightness`, `tenderness`, `spasms`, `ROM limitation`, `pain`, `ADL difficulty` | 数值↓=改善 |
| 正向名词 | `strength`, `ROM`, `energy level`, `sleep quality` | 数值↑=改善 |

### 5.3 改善/恶化语义映射

| 表述类型 | 正向名词期望 | 负向名词期望 |
|----------|-------------|-------------|
| `improvement` | 数值↑ | 数值↓ |
| `exacerbate` | 数值↓ | 数值↑ |
| `reduced` | 数值↓ | 数值↓ |
| `increased` | 数值↑ | 数值↑ |
| `Decrease` | - | 数值↓ |
| `Increase` | 数值↑ | - |

### 5.4 进展状态与原因逻辑映射

| progressStatus | 允许的原因类型 | 禁止的原因类型 |
|----------------|---------------|---------------|
| `improvement of symptom(s)` | 正向原因 | 负向原因 |
| `exacerbate of symptom(s)` | 负向原因 | 正向原因 |
| `similar symptom(s) as last visit` | 任意 | - |

---

## 6. 提议的文本验证规则

### T01: 方向词 + 名词极性矛盾检测

**规则ID**: T01
**严重程度**: HIGH
**描述**: 检测 `increased` + 负向名词 或 `reduced` + 正向名词 的语义矛盾

```
错误示例:
- "increased ROM limitation" ❌ (应为 reduced ROM limitation)
- "reduced muscles strength" ❌ (应为 increased muscles strength)
- "increased tightness" ❌ (恶化，与 improvement 矛盾)

正确示例:
- "reduced ROM limitation" ✓
- "increased muscles strength" ✓
- "reduced tightness" ✓
```

### T02: 改善描述 + 数值恶化矛盾

**规则ID**: T02
**严重程度**: CRITICAL
**描述**: 文本写 `improvement` 但相关数值实际恶化

```
错误示例:
- symptomChange = "improvement of symptom(s)"
  但 pain: 7→8 ❌
- symptomChange = "slight improvement of symptom(s)"
  但 tenderness: +2→+3 ❌

正确示例:
- symptomChange = "improvement of symptom(s)"
  且 pain: 8→6 ✓
```

### T03: 恶化描述 + 数值改善矛盾

**规则ID**: T03
**严重程度**: CRITICAL
**描述**: 文本写 `exacerbate` 但相关数值实际改善

```
错误示例:
- symptomChange = "exacerbate of symptom(s)"
  但 pain: 8→6 ❌

正确示例:
- symptomChange = "exacerbate of symptom(s)"
  且 pain: 6→8 ✓
```

### T04: ROM 描述矛盾检测

**规则ID**: T04
**严重程度**: HIGH
**描述**: 检测 ROM 相关描述与实际 ROM 数值变化的矛盾

```
错误示例:
- "reduced ROM limitation" 但 ROM degrees: 80→70 ❌
- "increased joint ROM" 但 ROM degrees: 80→70 ❌

正确示例:
- "reduced ROM limitation" 且 ROM degrees: 70→80 ✓
- "increased joint ROM" 且 ROM degrees: 70→80 ✓
```

### T05: 肌力描述矛盾检测

**规则ID**: T05
**严重程度**: HIGH
**描述**: 检测肌力相关描述与实际 strength 数值变化的矛盾

```
错误示例:
- "increased muscles strength" 但 strength: 4/5→3/5 ❌
- Goal: "Increase Muscles Strength to 4+" 但实际 strength: 4→3+ ❌

正确示例:
- "increased muscles strength" 且 strength: 3/5→4/5 ✓
```

### T06: 进展状态 + 原因逻辑矛盾

**规则ID**: T06
**严重程度**: MEDIUM
**描述**: progressStatus 与 progressReasons 的逻辑一致性

```
错误示例:
- progressStatus = "improvement of symptom(s)"
  progressReasons = "skipped treatments" ❌
- progressStatus = "improvement of symptom(s)"
  progressReasons = "discontinuous treatment" ❌

正确示例:
- progressStatus = "improvement of symptom(s)"
  progressReasons = "maintain regular treatments" ✓
- progressStatus = "exacerbate of symptom(s)"
  progressReasons = "stopped treatment for a while" ✓
```

### T07: Pacemaker + 电刺激矛盾

**规则ID**: T07
**严重程度**: CRITICAL
**描述**: 医疗史包含 Pacemaker 但计划使用电刺激

```
错误示例:
- medicalHistory includes "Pacemaker"
  且 electricalStimulation = "with" ❌

正确示例:
- medicalHistory includes "Pacemaker"
  且 electricalStimulation = "without" ✓
```

### T08: Severity 级别跨 visit 单调性

**规则ID**: T08
**严重程度**: HIGH
**描述**: 严重程度应逐渐改善，不应恶化

```
错误示例:
- Visit 1: severityLevel = "moderate"
  Visit 2: severityLevel = "severe" ❌

正确示例:
- Visit 1: severityLevel = "moderate"
  Visit 2: severityLevel = "mild to moderate" ✓
```

### T09: 伴随症状级别单调性

**规则ID**: T09
**严重程度**: MEDIUM
**描述**: 伴随症状严重程度应逐渐改善

```
错误示例:
- Visit 1: associatedSymptoms = "soreness"
  Visit 2: associatedSymptoms = "numbness" ❌ (更严重)

正确示例:
- Visit 1: associatedSymptoms = "numbness"
  Visit 2: associatedSymptoms = "weakness" ✓ (保持或改善)
```

---

## 7. 实现优先级

| 优先级 | 规则ID | 严重程度 | 描述 |
|--------|--------|----------|------|
| P0 | T02 | CRITICAL | 改善描述 + 数值恶化 |
| P0 | T03 | CRITICAL | 恶化描述 + 数值改善 |
| P0 | T07 | CRITICAL | Pacemaker + 电刺激矛盾 |
| P1 | T01 | HIGH | 方向词 + 名词极性矛盾 |
| P1 | T04 | HIGH | ROM 描述矛盾 |
| P1 | T05 | HIGH | 肌力描述矛盾 |
| P1 | T08 | HIGH | Severity 单调性 |
| P2 | T06 | MEDIUM | 进展状态 + 原因逻辑矛盾 |
| P2 | T09 | MEDIUM | 伴随症状单调性 |

---

## 8. 附录: 身体部位特定表述

### 8.1 肌肉配置 (按身体部位)

```typescript
MUSCLE_CONFIGS: {
  LBP: ['iliocostalis', 'spinalis', 'longissimus', 'Iliopsoas Muscle', 'Quadratus Lumborum', 'Gluteal Muscles', 'The Multifidus muscles'],
  NECK: ['Scalene anterior / med / posterior', 'Levator Scapulae', 'Trapezius', 'sternocleidomastoid muscles'],
  SHOULDER: ['upper trapezius', 'greater tuberosity', 'lesser tuberosity', 'AC joint', 'levator scapula', 'rhomboids', 'middle deltoid', 'deltoid ant fibres', 'bicep long head', 'supraspinatus', 'triceps short head'],
  KNEE: ['Quadriceps', 'Vastus lateralis', 'Vastus medialis', 'Gastrocnemius', 'Popliteus', 'Hamstrings'],
  HIP: ['Gluteus Maximus', 'Gluteus Medius', 'Piriformis', 'Iliopsoas', 'Tensor Fasciae Latae', 'Quadratus Femoris'],
  ELBOW: ['Biceps', 'Triceps', 'Brachioradialis', 'Supinator', 'Pronator Teres', 'Extensor Carpi']
}
```

### 8.2 ROM 运动 (按身体部位)

```typescript
ROM_MOVEMENTS: {
  LBP: ['Flexion', 'Extension', 'Rotation to Right', 'Rotation to Left', 'Flexion to the Right', 'Flexion to the Left'],
  NECK: ['Extension (look up)', 'Flexion (look down)', 'Rotation to Right', 'Rotation to Left', 'Flexion to the Right', 'Flexion to the Left'],
  SHOULDER: ['Abduction', 'Horizontal Adduction', 'Flexion', 'Extension', 'External rotation', 'Internal rotation'],
  KNEE: ['Flexion', 'Extension'],
  ELBOW: ['Flexion', 'Extension', 'Supination', 'Pronation']
}
```

---

*文档生成时间: 2026-02-09*
*来源文件:*
- `src/generator/subjective-generator.ts`
- `src/generator/objective-generator.ts`
- `src/generator/assessment-generator.ts`
- `src/generator/plan-generator.ts`
- `data/unique-dropdowns.json`
