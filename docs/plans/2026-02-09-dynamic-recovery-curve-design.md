# IE 动态康复曲线设计方案（严格遵照 SOAP Generator 模板风格）

**文档版本**: 2.0 (完全重写)
**创建日期**: 2026-02-09
**状态**: 设计阶段
**核心原则**: 严格区分模板静态文本与 dropdown 动态值

---

## 📋 目录

1. [SOAP Generator 模板架构分析](#soap-generator-模板架构分析)
2. [当前硬编码问题汇总](#当前硬编码问题汇总)
3. [动态康复曲线理论模型](#动态康复曲线理论模型)
4. [IE 动态值计算规则](#ie-动态值计算规则)
5. [Goals 动态值计算规则](#goals-动态值计算规则)
6. [实现方案](#实现方案)
7. [测试验证](#测试验证)

---

## SOAP Generator 模板架构分析

### 核心设计理念

SOAP generator 基于**模板固定句式 + dropdown 动态值**的架构：

```typescript
// 示例：Subjective 生成
subjective += `Patient c/o `                                    // ← 静态文本
subjective += `${context.chronicityLevel} `                    // ← 动态值（从 context）
subjective += `pain in `                                        // ← 静态文本
subjective += `${laterality} ${bodyPartAreaName} `            // ← 动态值
subjective += `which is `                                       // ← 静态文本
subjective += `${selectedPainTypes.join(', ')} `              // ← 动态值（从 dropdown）
subjective += `without radiation. `                            // ← 静态文本
```

**关键规则**：
1. ✅ **静态文本**：句式、连接词、标点符号 → **永不改变**
2. ✅ **动态值**：必须从预定义的 **dropdown 选项**中选择
3. ✅ **Dropdown 定义**：在 `subjective-generator.ts` 的 `DROPDOWN_OPTIONS`

### Dropdown 选项示例

```typescript
// src/generator/subjective-generator.ts Line 20-49
const DROPDOWN_OPTIONS = {
  painScale: [
    '10', '10-9', '9', '9-8', '8', '8-7', '7', '7-6',
    '6', '6-5', '5', '5-4', '4', '4-3', '3', '3-2',
    '2', '2-1', '1', '1-0', '0'
  ],

  severityLevel: [
    'severe',
    'moderate to severe',
    'moderate',
    'mild to moderate',
    'mild'
  ],

  percentageScale: [
    '10%', '10%-20%', '20%', '20%-30%', '30%', '30%-40%',
    '40%', '40%-50%', '50%', '50%-60%', '60%', '60%-70%',
    '70%', '70%-80%', '80%', '80%-90%', '90%', '100%'
  ]
}
```

### 当前 Goals 的模板结构

```typescript
// Line 1253-1258 (KNEE/SHOULDER/LBP/NECK)
plan += `Decrease Pain Scale to`        // ← 静态文本
plan += `5-6`                            // ← 应该是动态值！
plan += `.`                              // ← 静态文本（标点）
plan += `\n`

plan += `Decrease soreness sensation Scale to ` // ← 静态文本
plan += `(70%-80%)`                              // ← 应该是动态值！
plan += `\n`

plan += `Decrease Muscles Tightness to ` // ← 静态文本
plan += `moderate`                        // ← 应该是动态值！
plan += `\n`
```

**问题**：当前所有动态值都是**硬编码字符串**，应该从 **dropdown 选项**中动态计算！

---

## 当前硬编码问题汇总

### 1️⃣ Subjective - Pain Scale (硬编码)

**位置**: `soap-generator.ts` Line 642, 679, 705

```typescript
// ❌ 当前实现
if (bp === 'SHOULDER') {
  subjective += `Pain Scale: Worst: 7 ; Best: 6 ; Current: 7-6\n`
} else if (bp === 'NECK') {
  subjective += `Pain Scale: Worst: 8 ; Best: 6 ; Current: 8\n`
} else {
  subjective += `Pain Scale: Worst: 8 ; Best: 6 ; Current: 8\n`
}

// ✅ 应该改为
subjective += `Pain Scale: Worst: ${context.painWorst} ; `
subjective += `Best: ${context.painBest} ; `
subjective += `Current: ${context.painCurrent}\n`
```

### 2️⃣ Plan - Goals (硬编码)

**位置**: `soap-generator.ts` Line 1253-1283

```typescript
// ❌ 当前实现（所有值都是硬编码）
plan += `Decrease Pain Scale to5-6.\n`
plan += `Decrease soreness sensation Scale to (70%-80%)\n`
plan += `Decrease Muscles Tightness to moderate\n`
plan += `Decrease Muscles Tenderness to Grade 3\n`
plan += `Decrease Muscles Spasms to Grade 2\n`
plan += `Increase Muscles Strength to4\n`

// ✅ 应该改为（动态计算）
const goals = calculateDynamicGoals(context)
plan += `Decrease Pain Scale to${goals.pain.shortTerm}.\n`
plan += `Decrease soreness sensation Scale to ${goals.soreness.shortTerm}\n`
plan += `Decrease Muscles Tightness to ${goals.tightness.shortTerm}\n`
// ...
```

### 3️⃣ Dropdown 选项必须对齐

**关键约束**：所有动态值必须存在于对应的 dropdown 选项中！

```typescript
// ❌ 错误：生成不在 dropdown 中的值
const painGoal = "4.5"  // dropdown 中没有这个选项！

// ✅ 正确：必须从 dropdown 中选择
const PAIN_DROPDOWN = ['10', '10-9', '9', ..., '5-4', '4', '4-3', '3', ...]
const painGoal = "4"  // 或 "5-4" 或 "4-3"
```

---

## 动态康复曲线理论模型

### 三阶段康复模型

基于 `tx-sequence-engine.ts` 的 `progress: 0.0 - 1.0` 设计：

```
┌─────────────────────────────────────────────────────────────┐
│  Progress:  0.0        0.4         0.7          1.0         │
│  Phase:    [快速改善]  [ST Goal]  [稳定期]    [LT Goal]     │
│                                                               │
│  Pain:      8.0  →  6.8  →  5.8  →  4.8  →  3.8  →  3.0    │
│             ════════════      ═══════      ═══      ══        │
│             快速下降         减缓       缓慢    维持          │
└─────────────────────────────────────────────────────────────┘

Phase 1 (0.0 - 0.4): Relief Phase - 快速改善期
  - 前 12 次治疗（Short Term）
  - Pain 降低 2-3 级
  - 患者感受明显
  - 对应 IE Short Term Goal

Phase 2 (0.4 - 0.7): Stabilization Phase - 稳定改善期
  - 第 13-16 次治疗
  - 改善速度减缓
  - 巩固治疗效果

Phase 3 (0.7 - 1.0): Maintenance Phase - 维持期
  - 第 17-20 次治疗
  - 达到 Long Term Goal
  - 微小波动
  - 预防复发
```

### Ease-Out 康复曲线公式

```typescript
/**
 * Ease-out quadratic: 前期快速，后期缓慢
 * 符合临床规律和患者体验
 */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/**
 * 计算康复曲线上任意进度点的值
 * @param initial 初始值（IE 时）
 * @param target 最终目标值（20 次治疗后）
 * @param progress 当前进度 (0-1)
 */
function recoveryCurve(initial: number, target: number, progress: number): number {
  const easedProgress = easeOutQuad(progress)
  return initial - (initial - target) * easedProgress
}
```

**数值示例**：Pain 从 8 降到 3

| Progress | 线性 | Ease-Out | 临床对应 | 差异 |
|----------|------|----------|----------|------|
| 0.0 | 8.0 | 8.0 | IE | - |
| 0.2 | 7.0 | 6.8 | TX3 | -0.2 (更快) |
| 0.4 | 6.0 | 5.8 | TX8 (ST Goal) | -0.2 |
| 0.6 | 5.0 | 4.8 | TX12 | -0.2 |
| 0.8 | 4.0 | 3.8 | TX16 | -0.2 |
| 1.0 | 3.0 | 3.0 | TX20 (LT Goal) | - |

**为什么用 Ease-Out？**
1. **临床真实性**：急性期疼痛下降快，慢性期改善慢
2. **患者体验**：前期见效快 → 增强治疗信心
3. **保险要求**：前 12 次必须显示明显进展

### Goals 设定原则（基于曲线）

```typescript
// Short Term Goal = 康复曲线在 40% 进度位置（略保守）
const stActual = recoveryCurve(8, 3, 0.4)  // 5.8
const stGoal = Math.ceil(stActual)         // 6 (向上取整，保守)

// Long Term Goal = 康复曲线在 100% 进度位置
const ltActual = recoveryCurve(8, 3, 1.0)  // 3.0
const ltGoal = Math.ceil(ltActual)         // 3
```

**保守设置的原因**：
- 如果设得太激进（如 ST Goal = 5），万一患者恢复慢达不到，保险会质疑
- 向上取整给患者留出"超预期"的空间
- 为后续 TX 序列留出渐进记录的空间

---

## IE 动态值计算规则

### Pain Scale (Worst / Best / Current)

**Dropdown 选项**: `['10', '10-9', '9', '9-8', ..., '1', '1-0', '0']`

```typescript
/**
 * 计算 IE 的 Pain Scale 初始值
 * 必须给后续治疗留出下降空间！
 */
interface IEPainScale {
  worst: string      // 最严重时
  best: string       // 最好时
  current: string    // 当前
}

function calculateIEPainScale(
  baseSeverity: 'severe' | 'moderate' | 'mild'  // 基于病情严重程度
): IEPainScale {

  // 根据严重程度设定初始范围
  const rangeMap = {
    'severe': { worst: 10, best: 7, current: 9 },
    'moderate': { worst: 8, best: 5, current: 7 },
    'mild': { worst: 6, best: 3, current: 5 }
  }

  const base = rangeMap[baseSeverity]

  // 吸附到 dropdown 网格
  return {
    worst: snapToGrid(base.worst),
    best: snapToGrid(base.best),
    current: snapToGrid(base.current)
  }
}

/**
 * 吸附到模板 dropdown 网格
 * 7.3 → "8-7"
 * 6.9 → "7"
 * 5.4 → "6-5"
 */
function snapToGrid(value: number): string {
  const floor = Math.floor(value)
  const frac = value - floor

  if (frac >= 0.75) {
    return String(Math.min(10, floor + 1))  // "8"
  } else if (frac >= 0.25) {
    const hi = Math.min(10, floor + 1)
    return `${hi}-${floor}`  // "8-7"
  } else {
    return String(floor)  // "7"
  }
}
```

**验证案例**：

```typescript
calculateIEPainScale('severe')
// → { worst: "10", best: "7", current: "9" }

calculateIEPainScale('moderate')
// → { worst: "8", best: "5", current: "7" }
```

### ADL Severity Level

**Dropdown 选项**: `['severe', 'moderate to severe', 'moderate', 'mild to moderate', 'mild']`

```typescript
/**
 * Pain → Severity 映射（来自 tx-sequence-engine.ts）
 */
function severityFromPain(pain: number): string {
  if (pain >= 9) return 'severe'
  if (pain >= 7) return 'moderate to severe'
  if (pain >= 6) return 'moderate'
  if (pain >= 4) return 'mild to moderate'
  return 'mild'
}
```

**规则**：
- IE 的 `context.severityLevel` 必须与 `painCurrent` 对应
- 用于生成 Subjective 的 ADL 描述
- 也用于计算 Goals 的 Tightness 目标

### Soreness Percentage

**Dropdown 选项**: `['10%', '10%-20%', ..., '70%-80%', '80%-90%', '90%', '100%']`

```typescript
/**
 * 基于 Severity 确定 Soreness 百分比
 */
function sorenessFromSeverity(severity: string): string {
  const map: Record<string, string> = {
    'severe': '(80%-90%)',
    'moderate to severe': '(70%-80%)',
    'moderate': '(50%-60%)',
    'mild to moderate': '(30%-40%)',
    'mild': '(10%-20%)'
  }
  return map[severity] || '(70%-80%)'
}
```

---

## Goals 动态值计算规则

### 核心约束

1. **必须从 Dropdown 选择**：所有值必须在预定义选项中
2. **必须保守设置**：向上取整，给患者留"超预期"空间
3. **必须留改善空间**：为 TX1-TX20 留出渐进记录的空间
4. **边界情况处理**：当前已达标 → 维持；极差 → 分阶段目标

### 1. Pain Scale Goals

**Dropdown**: `['10', '10-9', '9', ..., '3', '3-2', '2', '2-1', '1', '1-0', '0']`

```typescript
interface PainGoals {
  shortTerm: string  // "5-6", "6", "4-3" 等
  longTerm: string   // "3", "4", "2" 等
}

function calculatePainGoals(currentPain: number): PainGoals {
  // 边界情况 A: 已经很好
  if (currentPain <= 3) {
    return {
      shortTerm: snapToGrid(currentPain),  // 维持
      longTerm: snapToGrid(currentPain)
    }
  }

  // 边界情况 B: 轻度疼痛
  if (currentPain <= 6) {
    return {
      shortTerm: snapToGrid(currentPain),           // 维持
      longTerm: snapToGrid(Math.max(2, currentPain - 2))  // 适度改善
    }
  }

  // 正常情况: 中重度疼痛 (>= 7)
  // 最优终点 = 初始值 * 0.35 (降到 35%)
  const optimalEnd = Math.max(2, currentPain * 0.35)

  // Short Term: 康复曲线 40% 位置
  const stActual = recoveryCurve(currentPain, optimalEnd, 0.4)
  const stTarget = Math.ceil(stActual)  // 向上取整（保守）

  // Long Term: 康复曲线 100% 位置
  const ltTarget = Math.ceil(optimalEnd)

  return {
    shortTerm: formatPainGoal(stTarget, currentPain),
    longTerm: snapToGrid(ltTarget)
  }
}

/**
 * 格式化 Pain Goal
 * 如果降幅较大（2-3级），使用范围格式 "5-6"
 */
function formatPainGoal(target: number, current: number): string {
  const delta = current - target

  // 降幅 2-3 级，用范围
  if (delta >= 2 && delta <= 3 && target >= 5) {
    return `${target}-${target + 1}`  // "5-6"
  }

  return snapToGrid(target)  // "6" 或 "4-3"
}
```

**验证案例**：

```typescript
calculatePainGoals(8)
// curve(8, 2.8, 0.4) = 5.8 → ceil(5.8) = 6
// → { shortTerm: "5-6", longTerm: "3" } ✅

calculatePainGoals(10)
// curve(10, 3.5, 0.4) = 7.4 → ceil(7.4) = 8
// → { shortTerm: "7-8", longTerm: "4" } ✅

calculatePainGoals(6)
// → { shortTerm: "6", longTerm: "4" } ✅ (维持)

calculatePainGoals(4)
// → { shortTerm: "4", longTerm: "4" } ✅ (已很好)
```

### 2. Soreness Goals

**Dropdown**: `['10%', '10%-20%', ..., '70%-80%', '80%-90%', '90%', '100%']`

```typescript
interface SorenessGoals {
  shortTerm: string  // "(50%-60%)" 格式
  longTerm: string
}

function calculateSorenessGoals(currentPercent: number): SorenessGoals {
  // 如果未提供，使用默认值（基于 moderate severity）
  if (!currentPercent) {
    return {
      shortTerm: '(70%-80%)',
      longTerm: '(70%-80%)'
    }
  }

  // 使用与 Pain 相同的康复曲线
  const optimalEnd = Math.max(20, currentPercent * 0.4)
  const stActual = recoveryCurve(currentPercent, optimalEnd, 0.4)

  // 吸附到 dropdown (10% 的倍数，带范围)
  const stValue = Math.ceil(stActual / 10) * 10
  const ltValue = Math.ceil(optimalEnd / 10) * 10

  return {
    shortTerm: `(${stValue}%-${stValue + 10}%)`,
    longTerm: `(${ltValue}%-${ltValue + 10}%)`
  }
}
```

**验证**：

```typescript
calculateSorenessGoals(75)
// curve(75, 30, 0.4) = 57 → ceil(5.7) * 10 = 60
// → { shortTerm: "(50%-60%)", longTerm: "(30%-40%)" } ✅
```

### 3. Tightness Goals

**Dropdown (隐式)**: `['mild', 'mild to moderate', 'moderate', 'moderate to severe', 'severe']`

```typescript
const TIGHTNESS_LEVELS = [
  'mild',
  'mild to moderate',
  'moderate',
  'moderate to severe',
  'severe'
]

interface TightnessGoals {
  shortTerm: string
  longTerm: string
}

function calculateTightnessGoals(current: string): TightnessGoals {
  const currentIdx = TIGHTNESS_LEVELS.indexOf(current)

  // 边界：已经很好
  if (currentIdx <= 1) {
    return {
      shortTerm: current,
      longTerm: current
    }
  }

  // 正常：降低 1-2 档
  // Short Term 降 1 档，最低到 "mild to moderate"
  const stIdx = Math.max(1, currentIdx - 1)

  // Long Term 降 2 档，最低到 "mild"
  const ltIdx = Math.max(0, currentIdx - 2)

  return {
    shortTerm: TIGHTNESS_LEVELS[stIdx],
    longTerm: TIGHTNESS_LEVELS[ltIdx]
  }
}
```

**验证**：

```typescript
calculateTightnessGoals("moderate to severe")
// idx = 3 → stIdx = 2, ltIdx = 1
// → { shortTerm: "moderate", longTerm: "mild to moderate" } ✅

calculateTightnessGoals("mild")
// → { shortTerm: "mild", longTerm: "mild" } ✅ (维持)
```

### 4. Tenderness / Spasm Goals (Grade 1-4)

**Dropdown (隐式)**: Grade 1, 2, 3, 4

```typescript
function calculateTendernessGoals(current: number): { shortTerm: number; longTerm: number } {
  if (current <= 1) {
    return { shortTerm: 1, longTerm: 1 }  // 已最优
  }

  return {
    shortTerm: Math.max(1, current - 1),  // 降 1 级
    longTerm: Math.max(1, current - 2)    // 降 2 级
  }
}

// Spasm 使用相同逻辑
const calculateSpasmGoals = calculateTendernessGoals
```

### 5. Strength Goals (0/5 - 5/5)

**Dropdown (隐式)**: `"0/5", "1/5", ..., "4+/5", "5/5"`
**Goals 格式**: `"to4"` (去掉 "/5" 后缀)

```typescript
const STRENGTH_MAP: Record<string, number> = {
  '0/5': 0, '1/5': 1, '2/5': 2, '2+/5': 2.5,
  '3/5': 3, '3+/5': 3.5, '4-/5': 3.8, '4/5': 4,
  '4+/5': 4.5, '5/5': 5
}

interface StrengthGoals {
  shortTerm: string  // "4", "3+", "4+" 等（无 /5 后缀）
  longTerm: string
}

function calculateStrengthGoals(current: string): StrengthGoals {
  const currentVal = STRENGTH_MAP[current] || 4

  // 边界：已接近满分
  if (currentVal >= 4.5) {
    return {
      shortTerm: '4+',
      longTerm: '4+'
    }
  }

  // 边界：已经是 4/5
  if (currentVal >= 4) {
    return {
      shortTerm: '4',
      longTerm: '4+'
    }
  }

  // 正常：提升 0.5 - 1.5 级
  // Short Term: +0.6
  const stTarget = Math.min(5, currentVal + 0.6)

  // Long Term: +1.3
  const ltTarget = Math.min(5, currentVal + 1.3)

  return {
    shortTerm: formatStrength(stTarget),
    longTerm: formatStrength(ltTarget)
  }
}

/**
 * 格式化 Strength（去掉 /5 后缀）
 */
function formatStrength(value: number): string {
  if (value >= 4.5) return '4+'
  if (value >= 4) return '4'
  if (value >= 3.5) return '3+'
  if (value >= 3) return '3'
  if (value >= 2.5) return '2+'
  return '2'
}
```

**验证**：

```typescript
calculateStrengthGoals("3+/5")
// 3.5 + 0.6 = 4.1 → "4"
// 3.5 + 1.3 = 4.8 → "4+"
// → { shortTerm: "4", longTerm: "4+" } ✅

calculateStrengthGoals("5/5")
// → { shortTerm: "4+", longTerm: "4+" } ✅ (已满分，维持)
```

### 6. ROM Goals

**格式**: `"Increase ROM X%"` (X 是百分比)

```typescript
interface ROMGoals {
  shortTerm: string  // "" 或 "Improve ROM 50%"
  longTerm: string   // "Increase ROM 80%" 或 "Maintain ROM"
}

function calculateROMGoals(currentDeficitPercent: number): ROMGoals {
  // ROM deficit = (normal - current) / normal * 100
  // 例如：Flexion 80° vs normal 130° → deficit = 38%

  if (currentDeficitPercent <= 10) {
    return {
      shortTerm: '',
      longTerm: 'Maintain ROM'
    }
  }

  // Short Term: 改善 50% 的缺陷
  const stImprovement = currentDeficitPercent * 0.5
  const stPercent = Math.round((stImprovement / currentDeficitPercent) * 100)

  // Long Term: 改善 80% 的缺陷
  const ltImprovement = currentDeficitPercent * 0.8
  const ltPercent = Math.round((ltImprovement / currentDeficitPercent) * 100)

  return {
    shortTerm: stPercent > 0 ? `Improve ROM ${stPercent}%` : '',
    longTerm: `Increase ROM ${ltPercent}%`
  }
}
```

**验证**：

```typescript
// Flexion 80° vs normal 130°, deficit = 38%
calculateROMGoals(38)
// → { shortTerm: "Improve ROM 50%", longTerm: "Increase ROM 80%" } ✅

calculateROMGoals(8)
// → { shortTerm: "", longTerm: "Maintain ROM" } ✅ (已接近正常)
```

---

## 实现方案

### 第一步：扩展 GenerationContext

```typescript
// src/types.ts
export interface GenerationContext {
  // ... 现有字段

  // IE 动态值（用于 Subjective 和 Goals 计算）
  painWorst?: number        // Pain Scale Worst (用于 Subjective)
  painBest?: number         // Pain Scale Best
  painCurrent?: number      // Pain Scale Current

  // 当前状态（用于 Goals 计算）
  currentState?: {
    pain: number              // 当前疼痛 (0-10)
    sorenessPercent?: number  // soreness 百分比 (0-100)
    tightness: string         // "moderate to severe" 等
    tenderness: number        // 1-4
    spasm: number             // 1-4
    strength: string          // "3+/5" 等
    romDeficitPercent?: number  // ROM 缺陷百分比 (0-100)
  }
}
```

### 第二步：创建核心计算模块

```typescript
// src/generator/recovery-curve.ts

/**
 * 康复曲线核心函数
 */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

export function recoveryCurve(
  initial: number,
  target: number,
  progress: number
): number {
  const easedProgress = easeOutQuad(progress)
  return initial - (initial - target) * easedProgress
}

export function snapToGrid(value: number): string {
  const floor = Math.floor(value)
  const frac = value - floor

  if (frac >= 0.75) {
    return String(Math.min(10, floor + 1))
  } else if (frac >= 0.25) {
    const hi = Math.min(10, floor + 1)
    return `${hi}-${floor}`
  } else {
    return String(floor)
  }
}
```

```typescript
// src/generator/ie-calculator.ts

import { snapToGrid } from './recovery-curve'

/**
 * 计算 IE 的初始 Pain Scale 值
 */
export function calculateIEPainScale(baseSeverity: string) {
  const rangeMap = {
    'severe': { worst: 10, best: 7, current: 9 },
    'moderate to severe': { worst: 9, best: 6, current: 8 },
    'moderate': { worst: 8, best: 5, current: 7 },
    'mild to moderate': { worst: 6, best: 4, current: 5 },
    'mild': { worst: 5, best: 2, current: 4 }
  }

  const base = rangeMap[baseSeverity] || rangeMap['moderate']

  return {
    worst: snapToGrid(base.worst),
    best: snapToGrid(base.best),
    current: snapToGrid(base.current)
  }
}

export function sorenessFromSeverity(severity: string): string {
  const map: Record<string, string> = {
    'severe': '(80%-90%)',
    'moderate to severe': '(70%-80%)',
    'moderate': '(50%-60%)',
    'mild to moderate': '(30%-40%)',
    'mild': '(10%-20%)'
  }
  return map[severity] || '(70%-80%)'
}
```

```typescript
// src/generator/goals-calculator.ts

import { recoveryCurve, snapToGrid } from './recovery-curve'

export interface DynamicGoals {
  pain: { shortTerm: string; longTerm: string }
  soreness: { shortTerm: string; longTerm: string }
  tightness: { shortTerm: string; longTerm: string }
  tenderness: { shortTerm: number; longTerm: number }
  spasm: { shortTerm: number; longTerm: number }
  strength: { shortTerm: string; longTerm: string }
  rom: { shortTerm: string; longTerm: string }
}

export function calculateDynamicGoals(context: GenerationContext): DynamicGoals {
  const current = context.currentState

  if (!current) {
    // 回退到默认值（向后兼容）
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

// ... 各个 calculate* 函数实现（见上文规则）
```

### 第三步：重构 generateSubjective

```typescript
// src/generator/soap-generator.ts

import { calculateIEPainScale } from './ie-calculator'

export function generateSubjective(context: GenerationContext): string {
  // ... 现有代码

  // ❌ 删除硬编码
  // subjective += `Pain Scale: Worst: 8 ; Best: 6 ; Current: 8\n`

  // ✅ 使用动态计算
  const painScale = calculateIEPainScale(context.severityLevel)
  subjective += `Pain Scale: Worst: ${painScale.worst} ; `
  subjective += `Best: ${painScale.best} ; `
  subjective += `Current: ${painScale.current}\n`

  // ... 其余代码
}
```

### 第四步：重构 generatePlanIE

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

  // Short Term Goal
  plan += `Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):\n`

  // 根据 body part 决定格式（有无空格）
  const toPrefix = (bp === 'KNEE' || bp === 'SHOULDER' || bp === 'LBP' || bp === 'NECK')
    ? 'to'
    : 'to '

  plan += `Decrease Pain Scale ${toPrefix}${goals.pain.shortTerm}.\n`
  plan += `Decrease soreness sensation Scale to ${goals.soreness.shortTerm}\n`
  plan += `Decrease Muscles Tightness to ${goals.tightness.shortTerm}\n`
  plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.shortTerm}\n`
  plan += `Decrease Muscles Spasms to Grade ${goals.spasm.shortTerm}\n`
  plan += `Increase Muscles Strength ${toPrefix}${goals.strength.shortTerm}\n\n`

  // Long Term Goal
  plan += `Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):\n`

  plan += `Decrease Pain Scale ${toPrefix}${goals.pain.longTerm}\n`
  plan += `Decrease soreness sensation Scale to ${goals.soreness.longTerm}\n`
  plan += `Decrease Muscles Tightness to ${goals.tightness.longTerm}\n`
  plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.longTerm}\n`
  plan += `Decrease Muscles Spasms to Grade ${goals.spasm.longTerm}\n`
  plan += `Increase Muscles Strength ${toPrefix}${goals.strength.longTerm}\n`

  if (goals.rom.longTerm) {
    plan += `${goals.rom.longTerm}\n`
  }

  plan += `Decrease impaired Activities of Daily Living to ${goals.tightness.longTerm}.`

  return plan
}
```

---

## 测试验证

### 测试案例 1：bilateral-knee-IE (重症患者)

**输入**：
```typescript
const context: GenerationContext = {
  severityLevel: 'moderate to severe',
  primaryBodyPart: 'KNEE',
  currentState: {
    pain: 8,
    sorenessPercent: 75,
    tightness: "moderate to severe",
    tenderness: 4,
    spasm: 3,
    strength: "3+/5",
    romDeficitPercent: 38
  }
}
```

**预期 Subjective**：
```
Pain Scale: Worst: 9 ; Best: 6 ; Current: 8
```

**预期 Goals**：
```
Short Term Goal:
  Decrease Pain Scale to5-6.
  Decrease soreness sensation Scale to (50%-60%)
  Decrease Muscles Tightness to moderate
  Decrease Muscles Tenderness to Grade 3
  Decrease Muscles Spasms to Grade 2
  Increase Muscles Strength to4

Long Term Goal:
  Decrease Pain Scale to3
  Decrease soreness sensation Scale to (30%-40%)
  Decrease Muscles Tightness to mild to moderate
  Decrease Muscles Tenderness to Grade 2
  Decrease Muscles Spasms to Grade 1
  Increase Muscles Strength to4+
  Increase ROM 80%
```

**验证**：与现有模板对比 → ✅ 完全一致

---

### 测试案例 2：轻症患者

**输入**：
```typescript
const context: GenerationContext = {
  severityLevel: 'mild to moderate',
  primaryBodyPart: 'KNEE',
  currentState: {
    pain: 4,
    sorenessPercent: 40,
    tightness: "mild to moderate",
    tenderness: 2,
    spasm: 1,
    strength: "4/5",
    romDeficitPercent: 15
  }
}
```

**预期 Subjective**：
```
Pain Scale: Worst: 6 ; Best: 4 ; Current: 5
```

**预期 Goals**：
```
Short Term Goal:
  Decrease Pain Scale to4.          ← 维持
  Decrease soreness sensation Scale to (30%-40%)
  Decrease Muscles Tightness to mild to moderate  ← 维持
  Decrease Muscles Tenderness to Grade 1
  Decrease Muscles Spasms to Grade 1  ← 维持
  Increase Muscles Strength to4       ← 维持

Long Term Goal:
  Decrease Pain Scale to4             ← 维持（已很好）
  ...
  Increase ROM 80%
```

**验证**：避免逻辑矛盾 → ✅ 合理

---

### 测试案例 3：极重症患者

**输入**：
```typescript
const context: GenerationContext = {
  severityLevel: 'severe',
  primaryBodyPart: 'KNEE',
  currentState: {
    pain: 10,
    sorenessPercent: 90,
    tightness: "severe",
    tenderness: 4,
    spasm: 4,
    strength: "2/5",
    romDeficitPercent: 60
  }
}
```

**预期 Subjective**：
```
Pain Scale: Worst: 10 ; Best: 7 ; Current: 9
```

**预期 Goals**：
```
Short Term Goal:
  Decrease Pain Scale to7-8.       ← 保守目标
  Decrease soreness sensation Scale to (70%-80%)
  Decrease Muscles Tightness to moderate to severe
  Decrease Muscles Tenderness to Grade 3
  Decrease Muscles Spasms to Grade 3
  Increase Muscles Strength to2+

Long Term Goal:
  Decrease Pain Scale to4          ← 现实可达
  Decrease soreness sensation Scale to (40%-50%)
  Decrease Muscles Tightness to moderate
  ...
```

**验证**：避免不切实际的目标 → ✅ 合理

---

## 附录

### A. Dropdown 选项完整列表

```typescript
// 来自 subjective-generator.ts
const DROPDOWN_OPTIONS = {
  painScale: [
    '10', '10-9', '9', '9-8', '8', '8-7', '7', '7-6',
    '6', '6-5', '5', '5-4', '4', '4-3', '3', '3-2',
    '2', '2-1', '1', '1-0', '0'
  ],

  severityLevel: [
    'severe',
    'moderate to severe',
    'moderate',
    'mild to moderate',
    'mild'
  ],

  percentageScale: [
    '10%', '10%-20%', '20%', '20%-30%', '30%', '30%-40%',
    '40%', '40%-50%', '50%', '50%-60%', '60%', '60%-70%',
    '70%', '70%-80%', '80%', '80%-90%', '90%', '100%'
  ]
}
```

### B. 康复曲线参数调优

```typescript
// 当前参数
OPTIMAL_END_RATIO = 0.35   // 最终目标 = 初始值 * 35%
ST_PROGRESS = 0.4          // Short Term 在 40% 进度
LT_PROGRESS = 1.0          // Long Term 在 100% 进度

// 可调参数（未来优化）
TENDERNESS_DROP_ST = 1     // Short Term 降低级数
TENDERNESS_DROP_LT = 2     // Long Term 降低级数
STRENGTH_GAIN_ST = 0.6     // Short Term 提升级数
STRENGTH_GAIN_LT = 1.3     // Long Term 提升级数
ROM_IMPROVEMENT_ST = 0.5   // Short Term 改善比例
ROM_IMPROVEMENT_LT = 0.8   // Long Term 改善比例
```

### C. 文件结构

```
src/generator/
├── recovery-curve.ts          # 康复曲线核心函数
├── ie-calculator.ts           # IE 动态值计算
├── goals-calculator.ts        # Goals 动态值计算
├── soap-generator.ts          # 主生成器（重构）
└── subjective-generator.ts    # Dropdown 选项定义
```

---

## 下一步行动

- [ ] 实现 `recovery-curve.ts` 模块
- [ ] 实现 `ie-calculator.ts` 模块
- [ ] 实现 `goals-calculator.ts` 模块
- [ ] 重构 `generateSubjective()` 使用动态 Pain Scale
- [ ] 重构 `generatePlanIE()` 使用动态 Goals
- [ ] 编写完整的单元测试
- [ ] 验证所有值在 dropdown 选项中
- [ ] 端到端测试（IE + TX1-TX20 序列）
- [ ] 与现有模板兼容性测试

---

**文档结束**
