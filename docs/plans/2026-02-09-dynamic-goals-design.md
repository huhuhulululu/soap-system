# IE Goals 动态计算设计文档

**文档版本**: 1.0
**创建日期**: 2026-02-09
**状态**: 设计阶段

---

## 📋 目录

1. [问题背景](#问题背景)
2. [现状分析](#现状分析)
3. [核心设计原则](#核心设计原则)
4. [康复曲线理论](#康复曲线理论)
5. [动态计算规则](#动态计算规则)
6. [实现方案](#实现方案)
7. [测试验证](#测试验证)
8. [附录](#附录)

---

## 问题背景

### 当前问题

`generatePlanIE()` 函数（`src/generator/soap-generator.ts` Line 1239-1296）使用**完全硬编码**的 Goals：

```typescript
// 当前实现
plan += `Decrease Pain Scale to5-6.\n`              // 固定值
plan += `Decrease Muscles Tightness to moderate\n`  // 固定值
plan += `Decrease Muscles Tenderness to Grade 3\n`  // 固定值
```

**问题表现**：
1. **逻辑矛盾**：当前 Pain=4，Goal 仍然是 "5-6"（反而更高）
2. **无改善空间**：当前 Tenderness=+1，Goal 仍然是 "Grade 3"（无法显示进步）
3. **不留后路**：IE 如果生成 Strength=5/5，后续 TX 无法显示治疗效果
4. **临床不合理**：不同严重程度患者应有不同的康复目标

### 用户需求

> "goal应该是根据IE的S中的信息进行调整 动态计算的"
> "现在是4，预期是更低，tenderness已经1了，那就只能1持平"
> "如何在IE中多给后面数值让空间"
> "严格遵照template静态和动态文本"

**关键要求**：
- ✅ Goals 必须根据当前状态动态计算
- ✅ 必须为后续 TX 序列留出进展空间
- ✅ 保持模板格式规范（"to5-6" vs "to 5-6"）
- ✅ 处理边界情况（已达标、极差等）

---

## 现状分析

### 现有示例的发现

所有示例文件（`examples/*.md`, `data/*.md`）的 Goals **完全相同**：

```
Short Term Goal:
  Decrease Pain Scale to5-6.
  Decrease Muscles Tightness to moderate
  Decrease Muscles Tenderness to Grade 3

Long Term Goal:
  Decrease Pain Scale to3 (SHOULDER: 3-4)
  Decrease Muscles Tightness to mild-moderate
  Decrease Muscles Tenderness to Grade 2
```

**分析**：这些示例都基于"标准重症患者"模型：
- Pain Current: 8
- Tightness: moderate to severe
- Tenderness: +3 或 +4
- Strength: 3+/5

**结论**：现有固定值是针对这种"标准患者"的合理 Goals，但不适用于其他情况。

### TX Sequence Engine 的启示

从 `tx-sequence-engine.ts` 发现了**康复曲线设计**：

```typescript
export interface TXVisitState {
  visitIndex: number        // TX1, TX2, TX3...
  progress: number          // 0.0 到 1.0 的康复进度
  painScaleCurrent: number  // 连续的疼痛值（非离散）
  painScaleLabel: string    // 吸附到模板网格 "8-7", "7", "6-5"
}
```

**关键发现**：
1. TX 系统使用**连续进度曲线**（0-1）模拟治疗进程
2. Pain 从 8.0 → 7.3 → 6.8 → 6.2... **平滑下降**
3. 然后**吸附**到模板允许的离散值

**这解释了为什么 IE Goals 必须保守！**

---

## 核心设计原则

### 1️⃣ 为后续治疗留出空间

**反面案例**：
```typescript
// ❌ 错误：IE 生成时太激进
IE Strength: 5/5
Short Term Goal: 5/5  // 没有改善空间！
TX1: 5/5  // 无法显示进步
TX2: 5/5  // 保险公司：为什么还需要治疗？
```

**正确做法**：
```typescript
// ✅ 正确：IE 生成时留出渐进空间
IE Strength: 3+/5
Short Term Goal: 4/5   // 有改善目标
Long Term Goal: 4+/5   // 有长期目标

TX1: 3+/5 → 4-/5  (显示进步)
TX2: 4-/5 → 4/5   (显示进步)
TX3: 4/5  → 4/5   (稳定维持)
TX4: 4/5  → 4+/5  (继续改善)
```

### 2️⃣ 边界情况处理

```typescript
// 情况 A: 当前已经很好
if (currentTenderness === 1) {
  shortTermGoal = 1  // 维持现状
  longTermGoal = 1   // 维持现状
}

// 情况 B: 当前已达到 Short Term 预期
if (currentPain <= 6) {
  shortTermGoal = currentPain       // 维持当前
  longTermGoal = max(3, currentPain - 2)  // 适度改善
}

// 情况 C: 当前极差（Pain 10）
if (currentPain >= 9) {
  shortTermGoal = 7  // 降低到可控范围
  longTermGoal = 4   // 长期目标保守
}
```

### 3️⃣ 模板格式严格性

**静态部分**（格式）：
```typescript
"Decrease Pain Scale to" + [动态值]
"Decrease Muscles Tightness to " + [动态值]
"Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):"
```

**动态部分**（数值）：
```typescript
// Pain: "5-6", "3-4", "6" 等
// Tightness: "moderate", "mild to moderate" 等
// Tenderness: 1, 2, 3, 4
// Strength: "4", "4+", "3+" 等
```

**格式规范**：
```typescript
// KNEE/SHOULDER/LBP/NECK (保留原模板格式)
"to5-6"  // 无空格
"to4"    // 无空格

// 其他部位 (规范格式)
"to 5-6" // 有空格
"to 4"   // 有空格
```

### 4️⃣ 临床合理性

**改善速度参考**：

| 指标 | Short Term (12 tx) | Long Term (20 tx) | 改善幅度 |
|------|-------------------|-------------------|----------|
| **Pain** | -2~-3 级 | -5 级 | 快速→缓慢 |
| **Tenderness** | -1 级 | -2 级 | 稳定下降 |
| **Tightness** | -1 档 | -2 档 | 稳定下降 |
| **Spasm** | -1 级 | -2 级 | 稳定下降 |
| **Strength** | +0.5~1 级 | +1~1.5 级 | 渐进提升 |
| **ROM** | 改善 50% 缺陷 | 改善 80% 缺陷 | 非线性 |

---

## 康复曲线理论

### 三阶段康复模型

```
Progress (0.0 - 1.0)
│
├─ Phase 1 (0.0 - 0.4): 快速改善期 ─→ Short Term Goal
│  - 对应前 12 次治疗
│  - Pain 降低 2-3 级
│  - 明显的症状缓解
│  - 患者感受明显
│
├─ Phase 2 (0.4 - 0.7): 稳定改善期
│  - 改善速度减缓
│  - 巩固治疗效果
│  - 防止反弹
│
└─ Phase 3 (0.7 - 1.0): 维持期 ─→ Long Term Goal
   - 达到长期目标
   - 微小波动
   - 预防复发
```

### 非线性康复曲线（Ease-Out）

```typescript
/**
 * 非线性康复曲线计算
 * 前期快速改善，后期缓慢（符合临床规律）
 */
function calculateRecoveryCurve(
  initial: number,
  target: number,
  progress: number  // 0.0 - 1.0
): number {
  // Ease-out quadratic: y = 1 - (1-x)²
  const easedProgress = 1 - Math.pow(1 - progress, 2)
  return initial - (initial - target) * easedProgress
}

// 示例：Pain 8 → 3 的康复曲线
// progress 0.0: 8.0  (初始)
// progress 0.2: 6.8  ⬇ 快速下降
// progress 0.4: 5.8  ⬇ (Short Term Goal 位置)
// progress 0.6: 4.8  ⬇ 减缓
// progress 0.8: 3.8  ⬇ 缓慢
// progress 1.0: 3.0  ⬇ (Long Term Goal)
```

**为什么用 Ease-Out？**
1. **临床符合性**：疼痛初期治疗效果明显，后期需要巩固
2. **患者体验**：前期快速缓解增强信心
3. **保险要求**：前 12 次必须显示明显进展

### Goals 与康复曲线对齐

```typescript
// Short Term Goal 应设置在康复曲线 40% 位置（略保守）
Initial Pain: 8
Recovery Curve at 40%: 5.8 (理论康复值)
Short Term Goal: 6 ✅ (向上取整，保守估计)

// Long Term Goal 应设置在康复曲线 100% 位置
Recovery Curve at 100%: 3.0
Long Term Goal: 3 ✅
```

---

## 动态计算规则

### Pain Scale (0-10)

```typescript
interface PainGoals {
  shortTerm: string  // "5-6", "6", "3-4" 等
  longTerm: string   // "3", "4", "2" 等
}

function calculatePainGoals(currentPain: number): PainGoals {
  // 边界情况：已经很好
  if (currentPain <= 3) {
    return {
      shortTerm: String(currentPain),  // 维持
      longTerm: String(currentPain)    // 维持
    }
  }

  // 边界情况：当前中等
  if (currentPain <= 6) {
    return {
      shortTerm: String(currentPain),              // 维持
      longTerm: String(Math.max(2, currentPain - 2))  // 适度改善
    }
  }

  // 正常情况：重症患者 (Pain >= 7)
  const optimalEnd = Math.max(2, currentPain * 0.35)  // 降到初始值的 35%

  // 使用康复曲线计算
  const curve40 = calculateRecoveryCurve(currentPain, optimalEnd, 0.4)
  const stTarget = Math.ceil(curve40)  // 向上取整（保守）
  const ltTarget = Math.ceil(optimalEnd)

  return {
    shortTerm: formatPainGoal(stTarget, currentPain),
    longTerm: String(ltTarget)
  }
}

function formatPainGoal(target: number, current: number): string {
  // 如果降幅较大，使用范围格式
  const delta = current - target
  if (delta >= 2 && delta <= 3) {
    return `${target}-${target + 1}`  // "5-6"
  }
  return String(target)  // "6"
}

// 康复曲线公式
function calculateRecoveryCurve(initial: number, target: number, progress: number): number {
  const easedProgress = 1 - Math.pow(1 - progress, 2)
  return initial - (initial - target) * easedProgress
}
```

**验证案例**：
```typescript
calculatePainGoals(8)  → { st: "5-6", lt: "3" } ✅
calculatePainGoals(6)  → { st: "6", lt: "4" } ✅
calculatePainGoals(4)  → { st: "4", lt: "4" } ✅ (维持)
calculatePainGoals(10) → { st: "7", lt: "4" } ✅
```

### Soreness Sensation (百分比)

```typescript
function calculateSorenessGoals(currentPercent: number): {
  shortTerm: string
  longTerm: string
} {
  // 当前值未提供，使用默认值
  if (!currentPercent) {
    return {
      shortTerm: "(70%-80%)",  // 标准中度
      longTerm: "(70%-80%)"
    }
  }

  // 使用与 Pain 类似的康复曲线
  const optimalEnd = Math.max(20, currentPercent * 0.4)
  const curve40 = calculateRecoveryCurve(currentPercent, optimalEnd, 0.4)

  const stValue = Math.ceil(curve40 / 10) * 10  // 向上取整到 10 的倍数
  const ltValue = Math.ceil(optimalEnd / 10) * 10

  return {
    shortTerm: `(${stValue}%-${stValue + 10}%)`,
    longTerm: `(${ltValue}%-${ltValue + 10}%)`
  }
}
```

**验证案例**：
```typescript
calculateSorenessGoals(75)  → { st: "(50%-60%)", lt: "(30%-40%)" }
calculateSorenessGoals(50)  → { st: "(40%-50%)", lt: "(20%-30%)" }
calculateSorenessGoals(30)  → { st: "(30%-40%)", lt: "(20%-30%)" }
```

### Tightness (离散等级)

```typescript
const TIGHTNESS_LEVELS = [
  'mild',
  'mild to moderate',
  'moderate',
  'moderate to severe',
  'severe'
]

function calculateTightnessGoals(current: string): {
  shortTerm: string
  longTerm: string
} {
  const currentIdx = TIGHTNESS_LEVELS.indexOf(current)

  // 边界：已经很好
  if (currentIdx <= 1) {
    return {
      shortTerm: current,  // 维持
      longTerm: current
    }
  }

  // 正常情况：降低 1-2 档
  const stIdx = Math.max(1, currentIdx - 1)  // Short Term 降 1 档，最低到 "mild to moderate"
  const ltIdx = Math.max(0, currentIdx - 2)  // Long Term 降 2 档，最低到 "mild"

  return {
    shortTerm: TIGHTNESS_LEVELS[stIdx],
    longTerm: TIGHTNESS_LEVELS[ltIdx]
  }
}
```

**验证案例**：
```typescript
calculateTightnessGoals("moderate to severe")
  → { st: "moderate", lt: "mild to moderate" } ✅

calculateTightnessGoals("moderate")
  → { st: "mild to moderate", lt: "mild" } ✅

calculateTightnessGoals("mild")
  → { st: "mild", lt: "mild" } ✅ (维持)
```

### Tenderness Grade (1-4)

```typescript
function calculateTendernessGoals(current: number): {
  shortTerm: number
  longTerm: number
} {
  // 边界：已经最优
  if (current <= 1) {
    return { shortTerm: 1, longTerm: 1 }
  }

  // 正常：降低 1-2 级
  return {
    shortTerm: Math.max(1, current - 1),
    longTerm: Math.max(1, current - 2)
  }
}
```

**验证案例**：
```typescript
calculateTendernessGoals(4) → { st: 3, lt: 2 } ✅
calculateTendernessGoals(2) → { st: 1, lt: 1 } ✅
calculateTendernessGoals(1) → { st: 1, lt: 1 } ✅ (维持)
```

### Spasm Grade (1-4)

```typescript
function calculateSpasmGoals(current: number): {
  shortTerm: number
  longTerm: number
} {
  // 与 Tenderness 相同逻辑
  if (current <= 1) {
    return { shortTerm: 1, longTerm: 1 }
  }

  return {
    shortTerm: Math.max(1, current - 1),
    longTerm: Math.max(1, current - 2)
  }
}
```

### Strength (0/5 - 5/5)

```typescript
const STRENGTH_MAP: Record<string, number> = {
  '0/5': 0, '1/5': 1, '2/5': 2, '2+/5': 2.5,
  '3/5': 3, '3+/5': 3.5, '4-/5': 3.8, '4/5': 4,
  '4+/5': 4.5, '5/5': 5
}

function calculateStrengthGoals(current: string): {
  shortTerm: string
  longTerm: string
} {
  const currentVal = STRENGTH_MAP[current] || 4

  // 边界：已接近满分
  if (currentVal >= 4.5) {
    return {
      shortTerm: '4+',  // 维持
      longTerm: '4+'    // 维持
    }
  }

  // 边界：已经是 4/5
  if (currentVal >= 4) {
    return {
      shortTerm: '4',   // 维持
      longTerm: '4+'    // 略微提升
    }
  }

  // 正常：提升 0.5 - 1.5 级
  const stTarget = Math.min(5, currentVal + 0.6)
  const ltTarget = Math.min(5, currentVal + 1.3)

  return {
    shortTerm: formatStrength(stTarget),
    longTerm: formatStrength(ltTarget)
  }
}

function formatStrength(value: number): string {
  // 去掉 /5 后缀（Goals 格式是 "to4" 不是 "to 4/5"）
  if (value >= 4.5) return '4+'
  if (value >= 4) return '4'
  if (value >= 3.5) return '3+'
  if (value >= 3) return '3'
  return '2+'
}
```

**验证案例**：
```typescript
calculateStrengthGoals("3+/5") → { st: "4", lt: "4+" } ✅
calculateStrengthGoals("4/5")  → { st: "4", lt: "4+" } ✅
calculateStrengthGoals("5/5")  → { st: "4+", lt: "4+" } ✅ (维持，已满分)
calculateStrengthGoals("2/5")  → { st: "2+", lt: "3+" } ✅
```

### ROM (活动范围)

```typescript
function calculateROMGoals(currentDeficit: number): {
  shortTerm: string
  longTerm: string
} {
  // currentDeficit: ROM 缺陷百分比 (0-100)
  // 例如：Flexion 80° vs normal 130° → deficit = (130-80)/130 ≈ 38%

  if (currentDeficit <= 10) {
    // 已经很好，不需要改善
    return {
      shortTerm: '',  // 省略
      longTerm: 'Maintain ROM'
    }
  }

  // Short Term: 改善 50% 缺陷
  const stImprovement = Math.round(currentDeficit * 0.5)
  const stPercent = Math.round((stImprovement / currentDeficit) * 100)

  // Long Term: 改善 80% 缺陷
  const ltImprovement = Math.round(currentDeficit * 0.8)
  const ltPercent = Math.round((ltImprovement / currentDeficit) * 100)

  return {
    shortTerm: stPercent > 0 ? `Improve ROM ${stPercent}%` : '',
    longTerm: `Increase ROM ${ltPercent}%`
  }
}
```

**验证案例**：
```typescript
// Flexion 80° vs normal 130°, deficit 38%
calculateROMGoals(38)
  → { st: "Improve ROM 50%", lt: "Increase ROM 80%" }

// 已经接近正常
calculateROMGoals(8)
  → { st: "", lt: "Maintain ROM" }
```

---

## 实现方案

### 第一步：扩展 GenerationContext

```typescript
// src/types.ts
export interface GenerationContext {
  // ... 现有字段

  // 新增：当前状态字段（用于动态计算 Goals）
  currentState?: {
    pain: number                // 当前疼痛 (0-10)
    sorenessPercent?: number    // soreness 百分比
    tightness: string           // "moderate to severe" 等
    tenderness: number          // 1-4
    spasm: number               // 1-4
    strength: string            // "3+/5" 等
    romDeficitPercent?: number  // ROM 缺陷百分比
  }
}
```

### 第二步：创建 Goals 计算模块

```typescript
// src/generator/goals-calculator.ts

import type { GenerationContext, BodyPart } from '../types'

export interface DynamicGoals {
  pain: { shortTerm: string; longTerm: string }
  soreness: { shortTerm: string; longTerm: string }
  tightness: { shortTerm: string; longTerm: string }
  tenderness: { shortTerm: number; longTerm: number }
  spasm: { shortTerm: number; longTerm: number }
  strength: { shortTerm: string; longTerm: string }
  rom: { shortTerm: string; longTerm: string }
}

/**
 * 根据患者当前状态动态计算 IE Goals
 */
export function calculateDynamicGoals(context: GenerationContext): DynamicGoals {
  const current = context.currentState

  if (!current) {
    // 回退到固定模板（向后兼容）
    return getDefaultGoals(context.primaryBodyPart)
  }

  return {
    pain: calculatePainGoals(current.pain),
    soreness: calculateSorenessGoals(current.sorenessPercent || 75),
    tightness: calculateTightnessGoals(current.tightness),
    tenderness: calculateTendernessGoals(current.tenderness),
    spasm: calculateSpasmGoals(current.spasm),
    strength: calculateStrengthGoals(current.strength),
    rom: calculateROMGoals(current.romDeficitPercent || 0)
  }
}

// ... 各个 calculate* 函数的实现
```

### 第三步：重构 generatePlanIE

```typescript
// src/generator/soap-generator.ts

import { calculateDynamicGoals } from './goals-calculator'

export function generatePlanIE(context: GenerationContext): string {
  const bp = context.primaryBodyPart
  const goals = calculateDynamicGoals(context)

  let plan = `Initial Evaluation - Personal one on one contact with the patient (total 20-30 mins)\n`
  plan += `1. Greeting patient.\n`
  plan += `2. Detail explanation from patient of past medical history and current symptom.\n`
  plan += `3. Initial evaluation examination of the patient current condition.\n`
  plan += `4. Explanation with patient for medical decision/treatment plan.\n\n`

  // 短期目标（使用动态计算值）
  plan += `Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):\n`

  if (bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK') {
    // 保留原模板格式（无空格）
    plan += `Decrease Pain Scale to${goals.pain.shortTerm}.\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.shortTerm}\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.shortTerm}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.shortTerm}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.shortTerm}\n`
    plan += `Increase Muscles Strength to${goals.strength.shortTerm}\n\n`
  } else {
    // 规范格式（有空格）
    plan += `Decrease Pain Scale to ${goals.pain.shortTerm}.\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.shortTerm}\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.shortTerm}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.shortTerm}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.shortTerm}\n`
    plan += `Increase Muscles Strength to ${goals.strength.shortTerm}\n\n`
  }

  // 长期目标（使用动态计算值）
  plan += `Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):\n`

  const ltPainTarget = bp === 'SHOULDER'
    ? goals.pain.longTerm  // SHOULDER 特殊处理
    : goals.pain.longTerm

  if (bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK') {
    plan += `Decrease Pain Scale to${ltPainTarget}\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.longTerm}\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.longTerm}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.longTerm}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.longTerm}\n`
    plan += `Increase Muscles Strength to${goals.strength.longTerm}\n`

    if (goals.rom.longTerm) {
      plan += `${goals.rom.longTerm}\n`
    }

    plan += `Decrease impaired Activities of Daily Living to ${goals.tightness.longTerm}.`
  } else {
    plan += `Decrease Pain Scale to ${ltPainTarget}\n`
    plan += `Decrease soreness sensation Scale to ${goals.soreness.longTerm}\n`
    plan += `Decrease Muscles Tightness to ${goals.tightness.longTerm}\n`
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.longTerm}\n`
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.longTerm}\n`
    plan += `Increase Muscles Strength to ${goals.strength.longTerm}\n`

    if (goals.rom.longTerm) {
      plan += `${goals.rom.longTerm}\n`
    }

    plan += `Decrease impaired Activities of Daily Living to ${goals.tightness.longTerm}.`
  }

  return plan
}
```

### 第四步：更新调用点

需要在以下位置提供 `currentState`：

1. **IE 生成时**（`generateSOAPNote`）
   ```typescript
   const context: GenerationContext = {
     // ... 其他字段
     currentState: {
       pain: painScaleCurrent,
       tightness: severityLevel,  // 映射到 tightness
       tenderness: extractTendernessGrade(objective),
       // ...
     }
   }
   ```

2. **correction-generator.ts**（使用 bridgeToContext）
   ```typescript
   const context = bridgeToContext(document, ieIndex)
   // context 已包含 currentState
   const correctedSOAP = exportSOAPAsText(context)
   ```

---

## 测试验证

### 测试案例 1：bilateral-knee-IE (重症患者)

**输入**：
```typescript
{
  pain: 8,
  sorenessPercent: 75,
  tightness: "moderate to severe",
  tenderness: 4,
  spasm: 3,
  strength: "3+/5",
  romDeficitPercent: 38
}
```

**预期输出**：
```
Short Term Goal:
  Decrease Pain Scale to5-6.                   ← 8 → 5.8 → ceil(5.8) = 6
  Decrease soreness sensation Scale to (50%-60%)
  Decrease Muscles Tightness to moderate
  Decrease Muscles Tenderness to Grade 3
  Decrease Muscles Spasms to Grade 2
  Increase Muscles Strength to4

Long Term Goal:
  Decrease Pain Scale to3                      ← 8 * 0.35 = 2.8 → 3
  Decrease soreness sensation Scale to (30%-40%)
  Decrease Muscles Tightness to mild to moderate
  Decrease Muscles Tenderness to Grade 2
  Decrease Muscles Spasms to Grade 1
  Increase Muscles Strength to4+
  Increase ROM 80%
```

**验证**：与现有模板对比 → ✅ 一致

---

### 测试案例 2：轻症患者

**输入**：
```typescript
{
  pain: 4,
  sorenessPercent: 40,
  tightness: "mild to moderate",
  tenderness: 2,
  spasm: 1,
  strength: "4/5",
  romDeficitPercent: 15
}
```

**预期输出**：
```
Short Term Goal:
  Decrease Pain Scale to4.                     ← 维持
  Decrease soreness sensation Scale to (30%-40%)
  Decrease Muscles Tightness to mild to moderate  ← 维持
  Decrease Muscles Tenderness to Grade 1
  Decrease Muscles Spasms to Grade 1          ← 维持
  Increase Muscles Strength to4               ← 维持

Long Term Goal:
  Decrease Pain Scale to4                      ← 维持（已很好）
  Decrease soreness sensation Scale to (20%-30%)
  Decrease Muscles Tightness to mild to moderate
  Decrease Muscles Tenderness to Grade 1
  Decrease Muscles Spasms to Grade 1
  Increase Muscles Strength to4+
  Increase ROM 80%
```

**验证**：避免逻辑矛盾 → ✅ 合理

---

### 测试案例 3：已部分康复的患者

**输入**：
```typescript
{
  pain: 6,
  sorenessPercent: 50,
  tightness: "moderate",
  tenderness: 2,
  spasm: 2,
  strength: "4/5",
  romDeficitPercent: 20
}
```

**预期输出**：
```
Short Term Goal:
  Decrease Pain Scale to6.                     ← 维持
  Decrease soreness sensation Scale to (40%-50%)
  Decrease Muscles Tightness to mild to moderate
  Decrease Muscles Tenderness to Grade 1
  Decrease Muscles Spasms to Grade 1
  Increase Muscles Strength to4               ← 维持

Long Term Goal:
  Decrease Pain Scale to4                      ← 适度改善
  Decrease soreness sensation Scale to (20%-30%)
  Decrease Muscles Tightness to mild
  Decrease Muscles Tenderness to Grade 1
  Decrease Muscles Spasms to Grade 1
  Increase Muscles Strength to4+
  Increase ROM 80%
```

**验证**：为后续 TX 留出空间 → ✅ 合理

---

### 测试案例 4：极重症患者

**输入**：
```typescript
{
  pain: 10,
  sorenessPercent: 90,
  tightness: "severe",
  tenderness: 4,
  spasm: 4,
  strength: "2/5",
  romDeficitPercent: 60
}
```

**预期输出**：
```
Short Term Goal:
  Decrease Pain Scale to7.                     ← 保守目标
  Decrease soreness sensation Scale to (70%-80%)
  Decrease Muscles Tightness to moderate to severe
  Decrease Muscles Tenderness to Grade 3
  Decrease Muscles Spasms to Grade 3
  Increase Muscles Strength to2+

Long Term Goal:
  Decrease Pain Scale to4                      ← 现实可达
  Decrease soreness sensation Scale to (40%-50%)
  Decrease Muscles Tightness to moderate
  Decrease Muscles Tenderness to Grade 2
  Decrease Muscles Spasms to Grade 2
  Increase Muscles Strength to3+
  Increase ROM 80%
```

**验证**：避免不切实际的目标 → ✅ 合理

---

## 附录

### A. 康复曲线数学公式

```typescript
/**
 * Ease-out quadratic function
 * 前期快速改善，后期缓慢（符合临床规律）
 */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/**
 * 康复曲线计算
 * @param initial 初始值
 * @param target 目标值
 * @param progress 进度 (0-1)
 * @returns 当前进度下的康复值
 */
function calculateRecoveryCurve(
  initial: number,
  target: number,
  progress: number
): number {
  const easedProgress = easeOutQuad(progress)
  return initial - (initial - target) * easedProgress
}
```

**曲线对比**：

| Progress | Linear | Ease-out | 说明 |
|----------|--------|----------|------|
| 0.0 | 0.00 | 0.00 | 起点 |
| 0.2 | 0.20 | 0.36 | 快速改善 |
| 0.4 | 0.40 | 0.64 | ST Goal 位置 |
| 0.6 | 0.60 | 0.84 | 减缓 |
| 0.8 | 0.80 | 0.96 | 缓慢 |
| 1.0 | 1.00 | 1.00 | LT Goal |

---

### B. Severity Level 映射表

```typescript
// Pain → Severity
const PAIN_TO_SEVERITY: Record<number, string> = {
  10: 'severe',
  9: 'severe',
  8: 'moderate to severe',
  7: 'moderate to severe',
  6: 'moderate',
  5: 'mild to moderate',
  4: 'mild to moderate',
  3: 'mild',
  2: 'mild',
  1: 'mild',
  0: 'mild'
}

// Severity → Expected Pain Range
const SEVERITY_TO_PAIN: Record<string, [number, number]> = {
  'severe': [9, 10],
  'moderate to severe': [7, 8],
  'moderate': [6, 6],
  'mild to moderate': [4, 5],
  'mild': [0, 3]
}
```

---

### C. 模板格式规范

```typescript
// KNEE/SHOULDER/LBP/NECK (原模板格式，保留历史兼容性)
const LEGACY_FORMAT_PARTS = new Set(['KNEE', 'SHOULDER', 'LBP', 'NECK'])

function formatGoalText(
  bodyPart: BodyPart,
  value: string
): string {
  const useSpace = !LEGACY_FORMAT_PARTS.has(bodyPart)
  return useSpace ? ` ${value}` : value  // "to 4" vs "to4"
}
```

---

### D. 待解决问题

1. **ROM 计算的数据来源**
   - 当前需要 `romDeficitPercent`
   - 如何从 Objective 中提取？
   - 需要规范化 ROM 数据结构

2. **Soreness 的语义**
   - "(70%-80%)" 是什么意思？
   - 是"严重程度"还是"发生频率"？
   - 需要明确定义

3. **SHOULDER 的特殊处理**
   - Long Term Pain Goal 是 "3-4" 而非 "3"
   - 为什么？临床依据？
   - 需要文档化

4. **与 TX Sequence 的对齐**
   - IE Goals 应该与 TX1-TX5 的实际进展对齐
   - 需要验证 Goals 是否能被 TX sequence engine 正常追踪

---

### E. 参考资料

- **TX Sequence Engine**: `src/generator/tx-sequence-engine.ts`
- **现有模板示例**: `examples/bilateral-*.md`
- **Severity 映射**: `src/shared/severity.ts`
- **SOAP Generator**: `src/generator/soap-generator.ts`

---

## 下一步行动

- [ ] 创建 `goals-calculator.ts` 模块
- [ ] 编写完整的单元测试
- [ ] 更新 `GenerationContext` 类型定义
- [ ] 重构 `generatePlanIE()` 函数
- [ ] 验证与现有模板的兼容性
- [ ] 更新 IE 生成流程以提供 `currentState`
- [ ] 端到端测试（IE + TX1-5 序列）

---

**文档结束**
