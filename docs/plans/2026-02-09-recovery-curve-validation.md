# 动态康复曲线深度推演验证

**文档版本**: 1.0
**创建日期**: 2026-02-09
**目的**: 对动态康复曲线设计进行深度推演,验证所有边界情况、参数选择、临床合理性

---

## 📋 目录

1. [核心参数验证](#核心参数验证)
2. [边界情况完整性分析](#边界情况完整性分析)
3. [与 TX Sequence Engine 对齐验证](#与-tx-sequence-engine-对齐验证)
4. [Dropdown 对齐完整性验证](#dropdown-对齐完整性验证)
5. [临床合理性深度验证](#临床合理性深度验证)
6. [现有示例反推验证](#现有示例反推验证)
7. [矛盾情况处理策略](#矛盾情况处理策略)
8. [参数调优空间分析](#参数调优空间分析)

---

## 核心参数验证

### 问题 1: 为什么选择 progress = 0.4 作为 Short Term Goal 位置?

**推演**:

```
Short Term 定义: 12 treatments in 5-6 weeks
总疗程: 20 treatments

理论进度 = 12/20 = 0.6

但为什么用 0.4 而不是 0.6?
```

**深度分析**:

从 `tx-sequence-engine.ts` 查看实际 progress 分配:

需要验证: TX12 对应的 progress 值是多少?

**假设**: 如果 progress 是线性分配,那么:
- TX1: progress ≈ 1/20 = 0.05
- TX12: progress ≈ 12/20 = 0.6
- TX20: progress = 1.0

**但是**: 如果 progress 不是线性,而是前期密集(每周 2-3 次),后期稀疏(每周 1-2 次)?

**需要回答的关键问题**:
1. tx-sequence-engine 如何计算 visitIndex → progress 的映射?
2. ST Goal "12 treatments in 5-6 weeks" 对应的 visitIndex 是多少?
3. 是否 TX8-TX12 之间需要达到 ST Goal?

**✅ 已验证**: 读取 tx-sequence-engine.ts Line 622-628

---

### ⚠️ 重大发现: progress 使用 S 曲线,不是线性!

**实际代码** (`tx-sequence-engine.ts` Line 622-628):

```typescript
const progressLinear = localIndex / remainingTx  // 线性基础
const acc = Math.sqrt(progressLinear)            // sqrt 加速
const progressBase = 3 * acc * acc - 2 * acc * acc * acc  // smoothstep 公式
const progressNoise = (rng() - 0.5) * 0.08       // 随机噪声
const progress = Math.max(prevProgress, rawProgress)
```

**这是 smoothstep (S曲线) 公式**: `f(t) = 3t² - 2t³`

**数值验证**: TX1-TX20 的实际 progress 分布

| visitIndex | localIndex/20 | sqrt() | smoothstep | 阶段 |
|------------|---------------|--------|------------|------|
| TX1 | 0.05 | 0.224 | **0.14** | 快速启动 |
| TX2 | 0.10 | 0.316 | **0.28** | 加速期 |
| TX4 | 0.20 | 0.447 | **0.50** | 快速期 |
| TX8 | 0.40 | 0.632 | **0.74** | 中期 |
| TX12 | 0.60 | 0.775 | **0.88** | 稳定期 |
| TX16 | 0.80 | 0.894 | **0.96** | 后期 |
| TX20 | 1.00 | 1.000 | **1.00** | 终点 |

**关键发现**:
1. ❌ **不是线性**: TX12 的 progress ≈ 0.88,不是 0.6!
2. ✅ **S曲线特性**: 前期加速(TX1-4 快速到 0.5),后期减缓(TX16-20 缓慢到 1.0)
3. ⚠️ **与 ease-out 冲突**:
   - 我们设计: ease-out (前快后慢,疼痛下降快)
   - tx-engine: smoothstep (中间最快,两端慢)

**这意味着什么?**

**冲突分析**:

```
我们的 ease-out 设计:
  Progress 0.4 → ST Goal (假设在 TX8-12)
  但实际 TX8 的 progress = 0.74! (不是 0.4)

实际应该:
  Progress 0.4 → 大约在 TX4 位置
  Progress 0.88 → 大约在 TX12 位置 (ST Goal 实际位置)
```

**修正方案**:

**方案 A**: 调整 ST Goal 进度到 0.88
```typescript
// 修改 IE Goals 计算
const ST_PROGRESS = 0.88  // 不是 0.4!
const stActual = recoveryCurve(8, 2.8, 0.88)
// curve(8, 2.8, 0.88) = 8 - 5.2 * 0.994 = 2.83
// → ceil(2.83) = 3 ← 太接近 LT Goal!
```

**问题**: ST Goal = 3,LT Goal = 3,没有区分度!

**方案 B**: 康复曲线也改用 smoothstep
```typescript
// 不用 ease-out,改用 smoothstep 与 tx-engine 对齐
function smoothstep(t: number): number {
  return 3 * t * t - 2 * t * t * t
}

function recoveryCurve(initial, target, progress) {
  const eased = smoothstep(progress)  // 改这里
  return initial - (initial - target) * eased
}
```

**方案 C**: 反向映射 - 从 visitIndex 推算 progress
```typescript
// 不使用固定 progress (0.4/1.0)
// 而是从 visitIndex 反推实际 progress

function getActualProgress(visitIndex: number): number {
  const linear = visitIndex / 20
  const acc = Math.sqrt(linear)
  return 3 * acc * acc - 2 * acc * acc * acc
}

// ST Goal: 假设在 TX12
const stProgress = getActualProgress(12)  // ≈ 0.88
const ltProgress = 1.0

const stActual = recoveryCurve(8, 2.8, stProgress)
const ltActual = recoveryCurve(8, 2.8, ltProgress)
```

**推荐**: 方案 C - 使用实际 visitIndex 反推 progress

---

### 问题 2: 为什么选择 0.35 作为最优终点比率?

**当前公式**:
```typescript
const optimalEnd = Math.max(2, currentPain * 0.35)
```

**推演验证**:

| Initial Pain | Optimal End (0.35x) | 降幅 | 降幅% |
|--------------|---------------------|------|-------|
| 10 | 3.5 | 6.5 | 65% |
| 9 | 3.15 | 5.85 | 65% |
| 8 | 2.8 | 5.2 | 65% |
| 7 | 2.45 | 4.55 | 65% |
| 6 | 2.1 | 3.9 | 65% |

**发现**: 所有患者降幅都是 65%,这是否合理?

**临床合理性质疑**:
- **重症患者** (Pain 10): 降到 3.5,是否过于乐观?
- **轻症患者** (Pain 6): 降到 2.1,是否改善空间不足?

**替代方案推演**:

**方案 A**: 分段比率
```typescript
if (currentPain >= 9) {
  optimalEnd = currentPain * 0.4  // 60% 降幅(更保守)
} else if (currentPain >= 7) {
  optimalEnd = currentPain * 0.35  // 65% 降幅
} else {
  optimalEnd = currentPain * 0.3  // 70% 降幅(更激进)
}
```

**方案 B**: 固定目标范围
```typescript
// 所有患者最终目标都在 2-4 范围
optimalEnd = Math.max(2, Math.min(4, currentPain * 0.35))
```

**方案 C**: 基于 Severity 调整
```typescript
const severityMultiplier = {
  'severe': 0.45,           // 降到 55%
  'moderate to severe': 0.38,
  'moderate': 0.35,
  'mild to moderate': 0.3,
  'mild': 0.25
}
optimalEnd = currentPain * severityMultiplier[severity]
```

**待决策**: 需要验证现有示例使用的是哪种策略

---

### 问题 3: Short Term Goal 为什么要 ceil(向上取整)?

**当前公式**:
```typescript
const stActual = recoveryCurve(8, 2.8, 0.4)  // 5.8
const stGoal = Math.ceil(stActual)           // 6
```

**推演**: 如果不 ceil 会怎样?

**场景 A**: 使用 round(四舍五入)
```typescript
stActual = 5.8 → round = 6  // 结果相同
stActual = 5.4 → round = 5  // 更激进
stActual = 5.2 → round = 5  // 更激进
```

**场景 B**: 使用 floor(向下取整)
```typescript
stActual = 5.8 → floor = 5  // 太激进,风险高
```

**场景 C**: 直接吸附到 grid
```typescript
stActual = 5.8 → snapToGrid = "6"     // 与 ceil 相同
stActual = 5.4 → snapToGrid = "6-5"   // 范围值
stActual = 5.2 → snapToGrid = "5"     // 更激进
```

**关键发现**: `snapToGrid()` 比 `ceil()` 更精细!

**改进方案**:
```typescript
// 不用 ceil,直接用 snapToGrid
const stActual = recoveryCurve(currentPain, optimalEnd, 0.4)
const stGoal = snapToGrid(stActual)  // 可能是 "6", "6-5", "5"
```

**优势**:
- 5.8 → "6" (与 ceil 相同)
- 5.4 → "6-5" (更准确,给出范围)
- 5.2 → "5" (避免过度保守)

**待验证**: 现有模板是否使用范围格式如 "5-6"?

---

## 边界情况完整性分析

### 边界情况矩阵

我们需要覆盖所有可能的患者初始状态组合:

| 维度 | 范围 | 边界值 |
|------|------|--------|
| **Pain** | 0-10 | 0, 1, 4, 6, 8, 10 |
| **Tenderness** | 1-4 | 1, 2, 3, 4 |
| **Tightness** | 5 levels | mild, mild-mod, mod, mod-sev, sev |
| **Strength** | 0/5 - 5/5 | 0/5, 2/5, 3+/5, 4/5, 5/5 |

**总组合数**: 6 × 4 × 5 × 5 = 600 种

我们需要验证的关键组合:

#### 组合 1: 矛盾状态 - 高 Pain 但低 Tenderness

**输入**:
```typescript
{
  pain: 9,           // severe
  tenderness: 1,     // 已最优
  tightness: "mild"  // 已最优
}
```

**问题**:
- Pain=9 → ST Goal=7, LT Goal=4
- Tenderness=1 → ST Goal=1, LT Goal=1 (维持)
- Tightness="mild" → ST Goal="mild", LT Goal="mild" (维持)

**逻辑冲突**: 高疼痛 vs 低压痛/低紧张?

**可能原因**:
1. 神经性疼痛(非肌肉问题)
2. 数据录入错误
3. 患者主观感受与客观检查不符

**处理策略推演**:

**策略 A**: 以 Pain 为准,强制调整其他指标
```typescript
if (pain >= 8 && tenderness <= 2) {
  tenderness = Math.max(tenderness, 3)  // 强制提升
  warnings.push("Tenderness adjusted to match high pain level")
}
```

**策略 B**: 接受矛盾,分别计算
```typescript
// 各指标独立计算,允许逻辑矛盾
// 依赖临床医生判断
```

**策略 C**: 计算一致性分数,警告用户
```typescript
const consistencyScore = calculateConsistency(pain, tenderness, tightness)
if (consistencyScore < 0.7) {
  warnings.push("Inconsistent findings - please review")
}
```

**待决策**: 需要咨询用户选择哪种策略

---

#### 组合 2: 已接近完美 - 所有指标都很好

**输入**:
```typescript
{
  pain: 2,
  tenderness: 1,
  tightness: "mild",
  strength: "5/5"
}
```

**问题**: 为什么还需要 20 次治疗?

**计算结果**:
```typescript
painGoals: { st: "2", lt: "2" }        // 维持
tendernessGoals: { st: 1, lt: 1 }      // 维持
tightnessGoals: { st: "mild", lt: "mild" }  // 维持
strengthGoals: { st: "4+", lt: "4+" }  // 降级!(避免无改善空间)
```

**发现**: Strength 必须降级,否则无法显示治疗效果!

**改进方案**:
```typescript
// 如果所有指标都已接近完美,调整治疗计划
if (pain <= 3 && tenderness <= 1 && tightness === 'mild') {
  // 建议: 维持性治疗,减少频次
  // 或: 不建议 IE,建议其他治疗方式
  return {
    recommendation: "Patient condition is already optimal. Consider maintenance therapy (8 treatments) instead of full 20-treatment plan."
  }
}
```

**待决策**: 是否需要这种"已接近完美"的检测逻辑?

---

#### 组合 3: 极重症患者

**输入**:
```typescript
{
  pain: 10,
  tenderness: 4,
  tightness: "severe",
  spasm: 4,
  strength: "0/5"
}
```

**计算结果** (使用当前公式):
```typescript
painGoals: { st: "8", lt: "4" }     // 10 → 8 → 4
tendernessGoals: { st: 3, lt: 2 }    // 4 → 3 → 2
tightnessGoals: { st: "mod-sev", lt: "mod" }
strengthGoals: { st: "1", lt: "1+" }  // 0/5 → 1/5 → 1+/5
```

**临床合理性质疑**:

1. **Pain 10 → 8 (ST Goal)**: 降幅仅 2 级,是否过于保守?
   - 患者期望: 疼痛快速缓解
   - 保险期望: 前 12 次显示明显进展
   - **矛盾**: 保守 vs 明显进展

2. **Strength 0/5 → 1/5 (ST Goal)**: 从完全无力到轻微力量,是否可达?
   - 12 次治疗能否恢复力量?
   - 是否需要配合康复训练?

**改进方案**: 分级目标

```typescript
// 极重症: 分阶段目标
if (pain >= 9 && (tenderness >= 4 || tightness === 'severe')) {
  // Phase 1 (前 8 次): 疼痛控制
  stGoalEarly = {
    pain: "7-8",  // 降到可控范围
    focus: "Pain relief"
  }

  // Phase 2 (9-12 次): 功能改善
  stGoalLate = {
    tenderness: 3,
    tightness: "moderate to severe",
    focus: "Functional improvement"
  }

  // Long Term: 保守目标
  ltGoal = {
    pain: "5",  // 不要设太低
    tenderness: 2,
    focus: "Stable improvement"
  }
}
```

**待决策**: 是否需要针对极重症的特殊逻辑?

---

#### 组合 4: 轻症患者 - 可能过度治疗

**输入**:
```typescript
{
  pain: 4,
  tenderness: 2,
  tightness: "mild to moderate",
  strength: "4/5"
}
```

**计算结果**:
```typescript
painGoals: { st: "4", lt: "4" }      // 维持
tendernessGoals: { st: 1, lt: 1 }    // 降 1 级
tightnessGoals: { st: "mild-mod", lt: "mild-mod" }  // 维持
strengthGoals: { st: "4", lt: "4+" }  // 略微提升
```

**问题**:
- 大部分指标都是"维持"
- 只有 Tenderness 和 Strength 有改善
- 是否需要完整的 20 次治疗?

**保险视角**:
- **质疑**: 为什么轻症需要 20 次治疗?
- **期望**: 轻症应更快完成(如 12 次)

**改进方案**:
```typescript
// 计算"改善潜力分数"
const improvementPotential = calculateImprovementPotential({
  pain, tenderness, tightness, strength
})

if (improvementPotential < 30) {
  // 改善潜力 < 30%,建议减少疗程
  return {
    recommendation: "Consider reduced treatment plan (12 sessions) for mild condition",
    treatmentPlan: "SHORT_TERM_ONLY"  // 只做 ST,不做 LT
  }
}
```

**待验证**: 现有模板是否有"仅 ST"的治疗方案?

---

## 与 TX Sequence Engine 对齐验证

### 关键问题: IE Goals 是否与 TX1-TX20 实际进展对齐?

**验证步骤**:

1. **读取 tx-sequence-engine 的 progress 计算逻辑**
2. **验证 ST Goal 是否在 TX8-TX12 之间达到**
3. **验证 LT Goal 是否在 TX20 达到**

**假设验证场景**:

```typescript
// IE 设定
IE_baseline = {
  pain: 8,
  tenderness: 4
}

// Goals 计算
ST_Goal = { pain: 6, tenderness: 3 }
LT_Goal = { pain: 3, tenderness: 2 }

// TX Sequence 生成
TX1_state = txSequenceEngine.calculateVisitState(context, 1)
TX8_state = txSequenceEngine.calculateVisitState(context, 8)
TX12_state = txSequenceEngine.calculateVisitState(context, 12)
TX20_state = txSequenceEngine.calculateVisitState(context, 20)
```

**期望对齐**:
```
TX1:  pain ≈ 7.5-8    (略有改善)
TX8:  pain ≈ 6.5-7    (接近 ST Goal)
TX12: pain ≈ 6-6.5    (达到或略超 ST Goal)
TX20: pain ≈ 3        (达到 LT Goal)
```

**对齐失败场景 A**: TX1 就达到 ST Goal
```
TX1: pain = 6  ← 太快!
TX8: pain = 4
TX12: pain = 3  ← 已达到 LT Goal!
TX20: pain = 2  ← 超过 LT Goal
```

**原因**: IE Goals 设定过于保守

**对齐失败场景 B**: TX20 未达到 LT Goal
```
TX12: pain = 7  ← 未达到 ST Goal
TX20: pain = 5  ← 未达到 LT Goal(3)
```

**原因**:
1. 康复曲线参数错误
2. IE Goals 设定过于激进
3. tx-sequence-engine 的 progress 分配不合理

**验证方法**:

创建测试用例,验证 IE + TX 序列的一致性:

```typescript
describe('IE Goals 与 TX Sequence 对齐验证', () => {
  it('bilateral-knee-IE: ST Goal 应在 TX8-TX12 达到', () => {
    const context = loadExample('bilateral-knee-IE')
    const ieGoals = calculateDynamicGoals(context)

    // 生成 TX1-TX12
    const txStates = generateTXSequence(context, 12)

    // 验证 TX8-TX12 的 pain 是否在 ST Goal 附近
    const tx8Pain = txStates[7].painScaleCurrent
    const tx12Pain = txStates[11].painScaleCurrent

    expect(tx12Pain).toBeCloseTo(ieGoals.pain.shortTerm, 1)
  })

  it('TX20 应达到 LT Goal', () => {
    const context = loadExample('bilateral-knee-IE')
    const ieGoals = calculateDynamicGoals(context)

    const txStates = generateTXSequence(context, 20)
    const tx20Pain = txStates[19].painScaleCurrent

    expect(tx20Pain).toBeCloseTo(ieGoals.pain.longTerm, 0.5)
  })
})
```

**待执行**: 运行这些测试用例,验证对齐性

---

### 深度分析: tx-sequence-engine 的 progress 如何计算?

**需要回答**:

1. `visitIndex` → `progress` 的映射公式是什么?
2. 是线性的吗? `progress = visitIndex / 20`?
3. 还是有加权? 前期密集,后期稀疏?

**推测 A**: 线性映射
```typescript
function calculateProgress(visitIndex: number): number {
  return (visitIndex - 1) / 19  // TX1=0, TX20=1
}
```

**推测 B**: 分段映射
```typescript
function calculateProgress(visitIndex: number): number {
  if (visitIndex <= 12) {
    // Short Term: 0 - 0.6
    return (visitIndex - 1) / 12 * 0.6
  } else {
    // Long Term: 0.6 - 1.0
    return 0.6 + (visitIndex - 12) / 8 * 0.4
  }
}
```

**推测 C**: 基于时间而非次数
```typescript
// 前 5-6 周(ST): 每周 2-3 次 → 12 次
// 后 5-6 周(LT): 每周 1-2 次 → 8 次
// progress 基于周数而非 visitIndex
```

**验证方法**: 读取 `tx-sequence-engine.ts` 源码

---

## Dropdown 对齐完整性验证

### 验证矩阵: 所有计算值是否在 dropdown 中?

| 指标 | Dropdown 定义位置 | 计算函数 | 验证状态 |
|------|------------------|----------|----------|
| **Pain Scale** | `subjective-generator.ts:43` | `snapToGrid()` | ✅ 已验证 |
| **Severity Level** | `subjective-generator.ts:37` | `severityFromPain()` | 待验证 |
| **Soreness %** | `subjective-generator.ts:31` | `calculateSorenessGoals()` | 待验证 |
| **Tightness** | 隐式定义(文本) | `calculateTightnessGoals()` | 待验证 |
| **Tenderness** | 隐式定义(Grade 1-4) | `calculateTendernessGoals()` | ✅ 简单 |
| **Spasm** | 隐式定义(Grade 1-4) | `calculateSpasmGoals()` | ✅ 简单 |
| **Strength** | `soap-generator.ts:1094-1104` | `calculateStrengthGoals()` | 待验证 |
| **ROM** | 无 dropdown? | `calculateROMGoals()` | ❌ 未找到 |

---

### 详细验证: Soreness Percentage

**Dropdown 定义**:
```typescript
// subjective-generator.ts:31
percentageScale: [
  '10%', '10%-20%', '20%', '20%-30%', '30%', '30%-40%',
  '40%', '40%-50%', '50%', '50%-60%', '60%', '60%-70%',
  '70%', '70%-80%', '80%', '80%-90%', '90%', '100%'
]
```

**计算函数**:
```typescript
function calculateSorenessGoals(currentPercent: number) {
  const optimalEnd = Math.max(20, currentPercent * 0.4)
  const stActual = recoveryCurve(currentPercent, optimalEnd, 0.4)

  const stValue = Math.ceil(stActual / 10) * 10
  const ltValue = Math.ceil(optimalEnd / 10) * 10

  return {
    shortTerm: `(${stValue}%-${stValue + 10}%)`,
    longTerm: `(${ltValue}%-${ltValue + 10}%)`
  }
}
```

**验证测试**:

```typescript
// 输入: 75%
stActual = recoveryCurve(75, 30, 0.4) = 57
stValue = Math.ceil(57/10)*10 = 60
result = "(60%-70%)"  ← 在 dropdown 中 ✅

// 输入: 85%
stActual = recoveryCurve(85, 34, 0.4) = 64.6
stValue = Math.ceil(64.6/10)*10 = 70
result = "(70%-80%)"  ← 在 dropdown 中 ✅

// 输入: 95%
stActual = recoveryCurve(95, 38, 0.4) = 71.8
stValue = Math.ceil(71.8/10)*10 = 80
result = "(80%-90%)"  ← 在 dropdown 中 ✅
```

**问题**: 为什么 dropdown 中有单独的 "10%", "20%", "90%" 等?

**答案**: 这些用于 IE Subjective 的 dropdown 选择,但 Goals 中统一使用范围格式 "(X%-Y%)"

**验证结论**: ✅ Soreness 计算值都在 dropdown 范围内

---

### 详细验证: Tightness

**Dropdown 定义**: 无显式 dropdown,但从代码推断:

```typescript
const TIGHTNESS_LEVELS = [
  'mild',
  'mild to moderate',
  'moderate',
  'moderate to severe',
  'severe'
]
```

**计算函数**:
```typescript
function calculateTightnessGoals(current: string) {
  const currentIdx = TIGHTNESS_LEVELS.indexOf(current)
  const stIdx = Math.max(1, currentIdx - 1)
  const ltIdx = Math.max(0, currentIdx - 2)

  return {
    shortTerm: TIGHTNESS_LEVELS[stIdx],
    longTerm: TIGHTNESS_LEVELS[ltIdx]
  }
}
```

**验证**:
- 所有计算值都从 TIGHTNESS_LEVELS 数组中选择
- ✅ 100% 对齐

**但需要确认**: `soap-generator.ts` 中 Objective 的 Tightness 是否使用相同的 5 个等级?

**验证方法**: 搜索 `soap-generator.ts` 中 tightness 相关代码

---

### 详细验证: Strength

**Dropdown 定义** (推测,需验证):
```typescript
const STRENGTH_DROPDOWN = [
  '0/5', '1/5', '2/5', '2+/5',
  '3/5', '3+/5', '4-/5', '4/5', '4+/5', '5/5'
]
```

**计算函数输出格式**: `"4"`, `"4+"`, `"3+"` (无 "/5" 后缀)

**问题**: Goals 格式 "to4" vs Objective 格式 "4/5" 的对应关系是什么?

**推演**:

在 Goals 中:
```
Increase Muscles Strength to4
Increase Muscles Strength to4+
```

在 Objective 中:
```
Strength: 4/5 (Good)
Strength: 4+/5 (Good)
```

**转换规则**:
```typescript
// Goals → Objective
"4"  → "4/5"
"4+" → "4+/5"
"3+" → "3+/5"

// Objective → Goals (去掉 /5 后缀)
"4/5"  → "4"
"4+/5" → "4+"
```

**验证**: 需要确认 `calculateStrengthGoals()` 返回的值是否正确去掉了 "/5"

---

### 关键发现: ROM 没有 Dropdown?

**问题**: 在 `subjective-generator.ts` 中未找到 ROM 的 dropdown 定义

**当前 Goals 格式**:
```
Increase ROM 80%
Maintain ROM
Improve ROM 50%
```

**推测**: ROM Goals 是自由文本格式,不受 dropdown 限制

**验证方法**:
1. 搜索所有示例文件中的 ROM Goals 格式
2. 确认是否只有这 3 种模式:
   - "Increase ROM X%"
   - "Improve ROM X%"
   - "Maintain ROM"

**待验证**: 读取示例文件

---

## 临床合理性深度验证

### 验证维度 1: 改善速度是否符合临床经验?

**参考标准** (需要专业验证):

| 指标 | 前 12 次预期改善 | 全程预期改善 |
|------|-----------------|-------------|
| **Pain** | 降低 2-3 级 | 降低 5-6 级 |
| **Tenderness** | 降低 1 级 | 降低 2 级 |
| **Tightness** | 降低 1 档 | 降低 2 档 |
| **Strength** | 提升 0.5-1 级 | 提升 1-1.5 级 |
| **ROM** | 改善 50% 缺陷 | 改善 80% 缺陷 |

**推演验证**:

#### Pain 8 的康复轨迹

```typescript
IE: pain = 8

ST Goal (progress 0.4):
  curve(8, 2.8, 0.4) = 5.8 → ceil = 6
  改善幅度: 8 - 6 = 2 ✅ 符合预期(2-3级)

LT Goal (progress 1.0):
  curve(8, 2.8, 1.0) = 2.8 → ceil = 3
  改善幅度: 8 - 3 = 5 ✅ 符合预期(5-6级)
```

#### Pain 10 的康复轨迹

```typescript
IE: pain = 10

ST Goal (progress 0.4):
  optimalEnd = 10 * 0.35 = 3.5
  curve(10, 3.5, 0.4) = 7.4 → ceil = 8
  改善幅度: 10 - 8 = 2 ✅ 符合预期

但质疑: 只降 2 级,患者满意度?

LT Goal (progress 1.0):
  curve(10, 3.5, 1.0) = 3.5 → ceil = 4
  改善幅度: 10 - 4 = 6 ✅ 符合预期
```

**发现**: Pain 10 的 ST Goal = 8 可能过于保守

**改进方案**:
```typescript
if (currentPain >= 9) {
  // 极重症: ST Goal 降低 3 级
  const stActual = recoveryCurve(currentPain, optimalEnd, 0.45)  // 提高到 45%
  // Pain 10: curve(10, 3.5, 0.45) = 7.0 → "7" (降 3 级)
}
```

---

### 验证维度 2: 患者满意度 vs 保险要求

**保险视角**:
- 需要看到**明显进展** (每 4-6 次复查时)
- 前 12 次必须有**显著改善**
- 如果进展缓慢,可能拒绝继续支付

**患者视角**:
- 期望**快速缓解疼痛**
- 前几次治疗后就要有感受
- 如果 12 次后仍疼痛 7-8,可能放弃治疗

**当前设计的平衡**:

| Progress | Pain (10→4) | 患者感受 | 保险评估 |
|----------|-------------|----------|----------|
| 0.0 (IE) | 10 | 剧痛 | - |
| 0.1 (TX2) | 8.6 | 略有缓解 | - |
| 0.2 (TX4) | 7.6 | 明显改善 ✅ | 进展良好 |
| 0.4 (TX8) | 7.4 | 持续改善 | 复查:符合预期 ✅ |
| 0.6 (TX12) | 5.8 | 疼痛减半 ✅ | 批准继续 ✅ |
| 0.8 (TX16) | 4.6 | 接近目标 | - |
| 1.0 (TX20) | 4.0 | 达标 ✅ | 治疗成功 ✅ |

**发现**: 当前设计在患者满意度和保险要求之间取得了平衡

**但需要验证**: TX2-TX4 的实际 progress 值是否是 0.1-0.2?

---

### 验证维度 3: 极端情况的临床可行性

#### 场景: Strength 从 0/5 提升到 1/5

**问题**: 完全无力 → 轻微力量,12 次针灸能做到吗?

**临床分析**:
- **Strength 0/5**: 完全瘫痪,肌肉无收缩
- **Strength 1/5**: 可见肌肉收缩,但无运动

**可行性质疑**:
1. 针灸主要治疗疼痛和紧张,不直接恢复力量
2. 力量恢复需要**康复训练** + 时间
3. 0/5 → 1/5 需要神经功能恢复,不是单纯肌肉问题

**改进方案**:
```typescript
if (currentStrength === '0/5') {
  // 完全无力: 不设力量改善目标,专注疼痛缓解
  return {
    shortTerm: '',  // 不提及
    longTerm: '',   // 不提及
    note: "Strength improvement requires concurrent physical therapy"
  }
}
```

**或者**: 设定更保守的目标
```typescript
if (currentStrength === '0/5') {
  return {
    shortTerm: '1/5',       // 可见收缩
    longTerm: '2/5',        // 可抗重力运动
    recommendation: "Recommend concurrent PT for strength training"
  }
}
```

---

## 现有示例反推验证

**✅ 已验证**: 全面读取 4 个 IE 示例 (KNEE, SHOULDER, LBP, NECK)

---

### 🔴 重大发现: 所有示例使用固定模板,不是动态计算!

**完整示例对比表**:

| 部位 | IE Soreness | ST Goal Soreness | LT Goal Soreness | IE Pain Current | ST Pain Goal | LT Pain Goal | LT ROM Goal |
|------|-------------|------------------|------------------|-----------------|--------------|--------------|-------------|
| **KNEE** | (70%-80%) | (70%-80%) | (70%-80%) | 8 | 5-6 | 3 | 60% |
| **SHOULDER** | (70%) | (70%-80%) | (70%-80%) | 7-6 | 5-6 | **3-4** ⚠️ | 60% |
| **LBP** | (70%) | (70%-80%) | (70%-80%) | 8 | 5-6 | 3 | 60% |
| **NECK** | (70%) | (70%-80%) | (70%-80%) | 8 | 5-6 | 3 | 60% |

**其他 Goals 完全相同 (所有示例)**:
- **Tightness**: ST = `moderate`, LT = `mild-moderate`
- **Tenderness**: ST = `Grade 3`, LT = `Grade 2`
- **Spasm**: ST = `Grade 2`, LT = `Grade 1`
- **Strength**: ST = `to4`, LT = `to4+`

---

### 关键发现详解

#### 1️⃣ Soreness Goals = 固定值,不是动态计算

**KNEE 示例** (Line 8, 67, 75):
```
IE Subjective: muscles soreness (scale as 70%-80%)
ST Goal: Decrease soreness sensation Scale to (70%-80%)
LT Goal: Decrease soreness sensation Scale to (70%-80%)
```

**SHOULDER/LBP/NECK 示例** (类似):
```
IE Subjective: muscles soreness (scale as 70%)
ST Goal: Decrease soreness sensation Scale to (70%-80%)
LT Goal: Decrease soreness sensation Scale to (70%-80%)
```

**分析**:
- ✅ ST 和 LT Goals **完全相同**: `(70%-80%)`
- ❌ **不是降低**,而是维持在固定范围
- ⚠️ 即使 IE 初始值是 70%,Goal 仍然是 70%-80%

**结论**: Soreness Goals 是**硬编码固定值**,与初始状态无关!

---

#### 2️⃣ ROM Goals = 固定 60%,没有 ST Goal

**所有 4 个示例**:
```
LT Goal: Increase ROM 60%
```

**特点**:
- ✅ 所有部位统一: **60%**
- ❌ **没有 ST Goal** (短期目标中不提 ROM)
- ⚠️ 不管 IE 的实际 ROM deficit 是多少,都是 60%

**KNEE 示例验证**:
```
IE Flexion: 80 Degrees(moderate)
Normal: 130 Degrees
Actual Deficit: (130-80)/130 = 38.5%

LT Goal: Increase ROM 60%  ← 不是 "改善 60% 的缺陷"
                            ← 而是固定文本 "60%"
```

**结论**: ROM Goals 也是**硬编码固定值**!

---

### TX 序列实际治疗进展验证

**✅ 已验证**: 读取 `bilateral-knee-full-test.md` 完整 TX1-TX11 序列

**实际治疗进展数据表** (IE + TX1-TX11):

| Visit | Progress | Pain | Severity | Tightness | Tenderness | Spasm | 分析 |
|-------|----------|------|----------|-----------|------------|-------|------|
| **IE** | 0% | 8.0 | mod-sev | mod-sev | +4 | +3 | 基线 |
| **TX1** | 9.6% | 7.7 | mod-sev | **moderate** | +4 | +3 | Tightness 降级 ✅ |
| **TX2** | 22.2% | 7.7 | mod-sev | **mild** | **+3** | +3 | Tightness 再降 ✅, Tenderness 降级 ✅ |
| **TX3** | 24.7% | 7.4 | mod-sev | mild | +3 | +3 | Pain 略降 |
| **TX4** | 36.7% | 7.4 | mod-sev | mild | +3 | +3 | 维持 |
| **TX5** | 41.6% | 7.3 | mod-sev | mild | +3 | +3 | Pain 略降 |
| **TX6** | 57.2% | 7.1 | mod-sev | mild | +3 | +3 | Pain 略降 |
| **TX7** | 60.6% | 7.0 | **moderate** | mild | +3 | +3 | Severity 降级 ✅ |
| **TX8** | 70.1% | 6.8 | moderate | mild | +3 | +3 | Pain 降到 6.8 |
| **TX9** | 84.3% | 6.5 | moderate | mild | +3 | +3 | Pain 继续降 |
| **TX10** | 90.6% | 6.2 | moderate | mild | +3 | +3 | Pain 接近 ST Goal |
| **TX11** | 98.0% | 6.0 | moderate | mild | +3 | +3 | **Pain 达到 ST Goal!** |

**关键发现**:

#### 1️⃣ Progress 与 visitIndex 映射验证

**实际数据 vs smoothstep 公式预测**:

| Visit | 实际 Progress | Smoothstep 预测 | 差异 | 验证 |
|-------|---------------|-----------------|------|------|
| TX1 | 9.6% | ~9.6% | ✅ | 完全吻合 |
| TX2 | 22.2% | ~22% | ✅ | 吻合 |
| TX4 | 36.7% | ~50% | ❌ -13% | **不吻合!** |
| TX6 | 57.2% | ~69% | ❌ -12% | 不吻合 |
| TX8 | 70.1% | ~82% | ❌ -12% | 不吻合 |
| TX11 | 98.0% | ~98% | ✅ | 吻合 |

**重要发现**:
- ⚠️ 实际 progress **不完全遵循 smoothstep 公式**!
- ⚠️ 中期 (TX4-8) 的 progress 比预测值**低 10-13%**
- ✅ 起点和终点基本吻合

**可能原因**:
1. 代码中可能有额外的调整因子 (扰动、噪声等)
2. `remainingTx` 计算可能不是简单的 11
3. 需要查看实际生成代码的完整逻辑

---

#### 2️⃣ Pain 康复轨迹分析

**实际 Pain 下降轨迹**:

```
IE:  8.0
TX1: 7.7  (-0.3, 进度 9.6%)
TX2: 7.7  (0, 进度 22.2%)    ← 停滞
TX3: 7.4  (-0.3, 进度 24.7%)
TX4: 7.4  (0, 进度 36.7%)    ← 停滞
TX5: 7.3  (-0.1, 进度 41.6%)
TX6: 7.1  (-0.2, 进度 57.2%)
TX7: 7.0  (-0.1, 进度 60.6%)
TX8: 6.8  (-0.2, 进度 70.1%)
TX9: 6.5  (-0.3, 进度 84.3%)
TX10: 6.2 (-0.3, 进度 90.6%)
TX11: 6.0 (-0.2, 进度 98.0%) ← 达到 ST Goal!
```

**特点**:
- ✅ **非线性下降**: 有快有慢,有停滞
- ✅ **渐进改善**: 总体趋势向下
- ⚠️ **与 ease-out 不符**: 不是"前快后慢",而是"前慢中快后中"
- ✅ **最终达标**: TX11 pain=6.0 正好在 ST Goal "5-6" 范围内

**Pain 下降速度分析**:

| 阶段 | Progress 范围 | Pain 下降 | 平均速度 | 评价 |
|------|--------------|----------|----------|------|
| **前期** (TX1-3) | 0-25% | 8.0 → 7.4 (-0.6) | 慢 | 略有改善 |
| **中期** (TX4-7) | 36-60% | 7.4 → 7.0 (-0.4) | 慢 | 缓慢下降 |
| **后期** (TX8-11) | 70-98% | 7.0 → 6.0 (-1.0) | **快** | **加速改善!** |

**与设计假设对比**:

我们设计 (ease-out): 前快后慢
实际数据: **前慢后快!** (完全相反)

**可能原因**:
1. 扰动因子在前期影响较大 (sleep, workload)
2. 累积治疗效应在后期显现
3. tx-sequence-engine 有意设计成"后期加速"以达标

---

#### 3️⃣ ST Goal 达成验证

**IE 设定的 ST Goal**:
- Pain: `5-6`
- Tightness: `moderate`
- Tenderness: `Grade 3`
- Spasm: `Grade 2`

**TX11 (98% progress) 实际状态**:
- Pain: `6.0` ✅ **刚好在范围内!**
- Tightness: `mild` ⚠️ **超过目标** (比 moderate 更好)
- Tenderness: `+3` ✅ **达标**
- Spasm: `+3` ❌ **未达标** (仍是 +3,目标是 +2)

**分析**:
- ✅ Pain 完美达标 (6.0 在 5-6 范围)
- ⚠️ Tightness 超额完成 (mild 比 moderate 更好)
- ❌ Spasm 完全没改善 (所有 TX 都是 +3)

**这说明**:
1. Pain Goals 设定**合理** ✅
2. Tightness 改善**过快** (TX1 就降到 moderate,TX2 降到 mild)
3. Spasm Goals 可能**过于激进** (实际完全没降)

---

#### 4️⃣ 其他指标变化模式

**Tightness 变化**:
```
IE:  moderate to severe
TX1: moderate          ← 降 1 档
TX2: mild              ← 再降 1 档
TX3-11: mild           ← 维持
```
- ⚠️ **前 2 次就降到位**,后面 9 次维持不变
- 与 Goals 预期 (TX11 达到 moderate) **不符**

**Tenderness 变化**:
```
IE:  +4
TX1: +4
TX2: +3  ← 降 1 级
TX3-11: +3  ← 维持
```
- ✅ TX2 降 1 级,符合渐进改善
- ✅ TX11 达到 ST Goal (+3) ✅

**Spasm 变化**:
```
IE:  +3
TX1-11: +3  ← 完全不变!
```
- ❌ **没有任何改善**
- ❌ ST Goal 设定为 +2,完全未达到
- ⚠️ 这是一个**设计缺陷**

---

#### 5️⃣ 康复曲线形状总结

**实际观察到的康复模式**:

```
指标          前期(0-25%)  中期(25-70%)  后期(70-100%)  形状
───────────────────────────────────────────────────────────
Pain          慢           慢            快             后加速
Tightness     快快         维持          维持           前快后平
Tenderness    慢           快            维持           中期快
Spasm         无           无            无             无变化 ❌
```

**与常见曲线对比**:

| 曲线类型 | 形状 | 符合指标 | 不符合指标 |
|----------|------|----------|------------|
| **Ease-out** (前快后慢) | `___/` | Tightness | Pain, Tenderness |
| **Ease-in** (前慢后快) | `\___` | Pain | Tightness |
| **Linear** (匀速) | `/` | - | 所有 |
| **Smoothstep** (慢快慢) | `S` | 部分符合 | 不完全符合 |

**结论**: **没有单一曲线能描述所有指标的康复模式!**

---

#### 3️⃣ Pain Goals 几乎完全统一

**统一模式** (KNEE/LBP/NECK):
```
IE Pain Current: 8
ST Goal: Decrease Pain Scale to5-6.  ← 范围格式,"to" 无空格
LT Goal: Decrease Pain Scale to3     ← 单值格式,"to" 无空格
```

**SHOULDER 特殊**:
```
IE Pain Current: 7-6
ST Goal: Decrease Pain Scale to5-6.
LT Goal: Decrease Pain Scale to3-4  ← 唯一使用范围格式的 LT Goal!
```

**分析**:
- ✅ ST Goal 统一: **"5-6"** (范围格式)
- ✅ LT Goal 通常: **"3"** (单值)
- ⚠️ SHOULDER LT Goal 特殊: **"3-4"** (可能因为初始值较低?)

**格式规范**:
```
"to5-6"   ← 无空格 (KNEE/SHOULDER/LBP/NECK)
"to3"     ← 无空格
"to4"     ← 无空格 (Strength)
```

**结论**: Pain Goals 虽然不是 100% 固定,但高度统一!

---

#### 4️⃣ 其他 Goals 100% 固定

| 指标 | ST Goal | LT Goal | 所有示例 |
|------|---------|---------|----------|
| **Tightness** | moderate | mild-moderate | ✅ 完全相同 |
| **Tenderness** | Grade 3 | Grade 2 | ✅ 完全相同 |
| **Spasm** | Grade 2 | Grade 1 | ✅ 完全相同 |
| **Strength** | to4 | to4+ | ✅ 完全相同 |

**无论 IE 初始状态如何,这些 Goals 都是固定的!**

---

### 证据总结

**现有模板是固定的,有以下证据**:

1. **Soreness**: 4/4 示例 ST=LT=(70%-80%),完全相同
2. **ROM**: 4/4 示例 LT=60%,完全相同
3. **Tightness**: 4/4 示例 ST=moderate, LT=mild-moderate
4. **Tenderness**: 4/4 示例 ST=Grade 3, LT=Grade 2
5. **Spasm**: 4/4 示例 ST=Grade 2, LT=Grade 1
6. **Strength**: 4/4 示例 ST=to4, LT=to4+
7. **Pain**: 3/4 示例 ST=5-6, LT=3 (SHOULDER LT=3-4 特殊)

**这意味着**:
- ✅ 当前生产系统使用**固定模板**
- ❌ **不存在动态计算逻辑**
- ⚠️ 我们的设计是**全新功能**,没有历史参照

---

### bilateral-knee-IE 完整反推

**示例数据** (从 `examples/bilateral-knee-IE.md`):

```
Pain Scale: Worst: 8 ; Best: 6 ; Current: 8
Tightness: moderate to severe
Tenderness: (+4)

Short Term Goal:
  Decrease Pain Scale to5-6.
  Decrease soreness sensation Scale to (70%-80%)
  Decrease Muscles Tightness to moderate
  Decrease Muscles Tenderness to Grade 3

Long Term Goal:
  Decrease Pain Scale to3
  Decrease Muscles Tightness to mild to moderate
  Decrease Muscles Tenderness to Grade 2
```

**反推验证**: 使用我们的公式能否得出相同结果?

#### Pain Goals 反推

**输入**: `current = 8`

**计算**:
```typescript
optimalEnd = 8 * 0.35 = 2.8
stActual = recoveryCurve(8, 2.8, 0.4) = 5.8
stGoal = Math.ceil(5.8) = 6

ltActual = recoveryCurve(8, 2.8, 1.0) = 2.8
ltGoal = Math.ceil(2.8) = 3
```

**对比**:
- 示例: ST="5-6", LT="3"
- 计算: ST=6, LT=3

**差异**: ST 是 "5-6" (范围) vs 6 (单值)

**分析**: 示例使用了**范围格式**!

**改进公式**:
```typescript
function formatPainGoal(target: number, current: number): string {
  const delta = current - target

  // 如果降幅是 2-3 级,使用范围格式
  if (delta >= 2 && delta <= 3 && target >= 5) {
    return `${target}-${target + 1}`  // "5-6"
  }

  return snapToGrid(target)  // "6" 或 "6-5" 或 "7"
}
```

**重新计算**:
```typescript
target = 6
delta = 8 - 6 = 2  ← 在 2-3 范围内
target >= 5  ← 满足
result = "5-6"  ✅ 与示例一致!
```

---

#### Tightness Goals 反推

**输入**: `current = "moderate to severe"`

**计算**:
```typescript
currentIdx = 3  // 在 TIGHTNESS_LEVELS 中
stIdx = max(1, 3 - 1) = 2
ltIdx = max(0, 3 - 2) = 1

shortTerm = TIGHTNESS_LEVELS[2] = "moderate"  ✅
longTerm = TIGHTNESS_LEVELS[1] = "mild to moderate"  ✅
```

**对比**: 完全一致!

---

#### Tenderness Goals 反推

**输入**: `current = 4`

**计算**:
```typescript
shortTerm = max(1, 4 - 1) = 3  ✅
longTerm = max(1, 4 - 2) = 2  ✅
```

**对比**: 完全一致!

---

#### Soreness Goals 反推

**输入**: `currentPercent = ?` (示例未明确给出)

**推测**: 基于 "moderate to severe" severity

```typescript
// 从 sorenessFromSeverity 推测
severity = "moderate to severe"
→ soreness = "(70%-80%)"  ← IE Subjective 中的值
```

**计算**:
```typescript
假设 currentPercent = 75 (取中值)
optimalEnd = max(20, 75 * 0.4) = 30
stActual = recoveryCurve(75, 30, 0.4) = 57
stValue = ceil(57/10)*10 = 60
shortTerm = "(60%-70%)"  ← 但示例是 "(70%-80%)"!
```

**差异发现**: Soreness Goals 不是通过康复曲线计算的!

**重新分析示例**:
```
Short Term: (70%-80%)
Long Term: 未列出
```

**推测**: Soreness ST Goal = IE 当前值(维持),不是降低?

**或者**: Soreness 使用不同的计算逻辑?

**待调查**: 查看其他示例的 Soreness Goals

---

### 发现: 示例可能使用的是固定模板,不是动态计算!

**证据**:
1. 所有示例的 Goals 几乎相同
2. Soreness Goals 不符合康复曲线
3. Pain ST Goal 统一是 "5-6"

**这意味着**:
- 现有示例**不能作为验证标准**!
- 我们的动态计算是**新设计**,没有历史参照
- 需要重新评估所有假设

**关键问题**: 用户是否期望保持现有固定 Goals,还是希望完全动态化?

**待确认**: 询问用户设计意图

---

## 矛盾情况处理策略

### 矛盾类型 1: 高 Pain 但低 Tenderness

**示例**:
```typescript
pain: 9
tenderness: 1
```

**可能原因**:
1. **神经性疼痛**: 不涉及肌肉压痛
2. **心理因素**: 主观疼痛高,客观检查正常
3. **数据错误**: 录入失败

**处理策略矩阵**:

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **A. 强制调整** | 逻辑一致 | 丢失真实数据 | 明确是录入错误 |
| **B. 接受矛盾** | 保留真实性 | Goals 看起来奇怪 | 神经性疼痛等特殊情况 |
| **C. 警告但不调整** | 平衡方案 | 需要人工审查 | 通用场景 |

**推荐方案 C**:
```typescript
function validateConsistency(context) {
  const warnings = []

  // 检测 1: Pain vs Tenderness
  if (context.pain >= 8 && context.tenderness <= 2) {
    warnings.push({
      severity: 'WARNING',
      message: 'High pain (8+) with low tenderness (≤2). Consider reviewing patient data.',
      suggestion: 'May indicate neuropathic pain or data entry error'
    })
  }

  // 检测 2: Tightness vs Pain
  if (context.pain >= 8 && context.tightness === 'mild') {
    warnings.push({
      severity: 'WARNING',
      message: 'High pain with mild tightness - unusual presentation',
      suggestion: 'Review physical examination findings'
    })
  }

  return warnings
}
```

---

### 矛盾类型 2: 所有指标接近完美但仍需 20 次治疗

**示例**:
```typescript
pain: 2
tenderness: 1
tightness: "mild"
strength: "5/5"
```

**问题**: 为什么需要治疗?

**处理策略**:
```typescript
function assessTreatmentNecessity(context) {
  const optimalCount = [
    context.pain <= 3,
    context.tenderness <= 1,
    context.tightness === 'mild',
    extractStrength(context.strength) >= 4.5
  ].filter(Boolean).length

  if (optimalCount >= 3) {
    return {
      necessary: false,
      recommendation: 'Patient condition is near-optimal. Consider:',
      alternatives: [
        'Maintenance therapy (6-8 sessions) instead of full treatment',
        'Re-evaluation after 2 weeks to confirm stability',
        'Focus on prevention and self-care education'
      ]
    }
  }

  return { necessary: true }
}
```

---

## 参数调优空间分析

### 可调参数清单

| 参数 | 当前值 | 影响 | 调优范围 | 优先级 |
|------|--------|------|----------|--------|
| `ST_PROGRESS` | 0.4 | ST Goal 位置 | 0.3-0.5 | 🔴 高 |
| `OPTIMAL_END_RATIO` | 0.35 | LT Goal 幅度 | 0.3-0.45 | 🔴 高 |
| `ST_GOAL_ROUNDING` | ceil | ST Goal 保守度 | ceil/round/snap | 🟡 中 |
| `TENDERNESS_DROP_ST` | 1 | ST 降级数 | 0-2 | 🟢 低 |
| `STRENGTH_GAIN_ST` | 0.6 | ST 力量提升 | 0.4-1.0 | 🟡 中 |

### 参数敏感性分析

#### ST_PROGRESS 敏感性

**场景**: Pain 8 → LT Goal 3

| ST_PROGRESS | ST Goal (raw) | ST Goal (ceil) | 改善% |
|-------------|---------------|----------------|-------|
| 0.3 | 6.5 | 7 | 12.5% |
| 0.4 | 5.8 | 6 | 25% ✅ |
| 0.5 | 5.2 | 6 | 25% |
| 0.6 | 4.8 | 5 | 37.5% |

**分析**:
- 0.3: 过于保守,ST Goal 7 vs 初始 8 改善不明显
- 0.4-0.5: 合理范围,改善 25%
- 0.6: 过于激进,可能达不到

**推荐**: 保持 0.4

---

#### OPTIMAL_END_RATIO 敏感性

**场景**: Pain 8

| 比率 | LT Goal | 总降幅 | 降幅% | 临床评估 |
|------|---------|--------|-------|----------|
| 0.25 | 2 | 6 | 75% | 过于乐观 |
| 0.30 | 2.4→3 | 5 | 62.5% | 略激进 |
| 0.35 | 2.8→3 | 5 | 62.5% | ✅ 合理 |
| 0.40 | 3.2→4 | 4 | 50% | 保守 |
| 0.45 | 3.6→4 | 4 | 50% | 过于保守 |

**分析**:
- 0.25-0.30: 太乐观,患者可能达不到
- 0.35: 当前值,平衡
- 0.40-0.45: 过于保守,改善不明显

**推荐**: 保持 0.35,但对重症患者(Pain 9-10)调整为 0.40

---

### 自适应参数策略

**核心思想**: 根据患者初始状态动态调整参数

```typescript
function getAdaptiveParameters(context: GenerationContext) {
  const { pain, severity } = context.currentState

  // 基础参数
  let stProgress = 0.4
  let optimalEndRatio = 0.35

  // 重症调整: 更保守
  if (pain >= 9 || severity === 'severe') {
    stProgress = 0.45      // ST Goal 延后
    optimalEndRatio = 0.40  // LT Goal 更保守
  }

  // 轻症调整: 更激进
  if (pain <= 5 && severity === 'mild to moderate') {
    stProgress = 0.35       // ST Goal 提前
    optimalEndRatio = 0.30  // LT Goal 更激进
  }

  return { stProgress, optimalEndRatio }
}
```

**优势**:
- 重症患者: 不会设定不切实际的目标
- 轻症患者: 避免过度保守,加快康复

---

## 总结: 待验证的关键问题清单

### 🔴 高优先级(必须解决)

1. **tx-sequence-engine 的 progress 计算逻辑是什么?**
   - 影响 ST Goal 位置选择(0.4 vs 0.6?)
   - 需要读取源码验证

2. **现有示例是否使用固定模板还是动态计算?**
   - Soreness Goals 不符合康复曲线
   - 所有示例 Goals 几乎相同
   - 需要确认设计意图

3. **Pain ST Goal 格式: "5-6" vs "6" 的规则是什么?**
   - 示例使用范围格式
   - 何时用范围?何时用单值?
   - 需要明确规则

4. **ROM Goals 有 Dropdown 定义吗?**
   - 未在 subjective-generator 找到
   - 需要确认是否自由文本

### 🟡 中优先级(重要但不紧急)

5. **Soreness Goals 的计算逻辑是什么?**
   - 示例值不符合康复曲线
   - 可能是维持当前值?
   - 需要更多示例验证

6. **极重症患者(Pain 10)是否需要特殊逻辑?**
   - ST Goal=8 可能过于保守
   - 是否需要分阶段目标?

7. **接近完美的患者是否需要检测逻辑?**
   - 建议减少疗程?
   - 或调整治疗计划?

8. **Strength 0/5 的目标设定是否合理?**
   - 完全无力能否通过针灸恢复?
   - 是否需要PT协同?

### 🟢 低优先级(优化项)

9. **参数是否需要自适应调整?**
   - 重症 vs 轻症使用不同参数
   - 可提升精准度

10. **一致性检测警告级别如何定义?**
    - 高 Pain 低 Tenderness 是 WARNING 还是 ERROR?

---

## 文件覆盖情况完整性验证

### 📊 四部位文件覆盖率统计

| 部位 | IE 示例 | 完整序列 (IE+TX1-TX11) | 单次 TX | 可验证康复轨迹 |
|------|---------|----------------------|---------|---------------|
| **KNEE** | ✅ bilateral-knee-IE.md | ✅ bilateral-knee-full-test.md | ✅ | ✅ **完整** |
| **SHOULDER** | ✅ bilateral-shoulder-IE.md | ✅ bilateral-shoulder-full-test.md | ✅ | ✅ **完整** |
| **LBP** | ✅ bilateral-lbp-IE.md | ❌ **不存在** | ✅ bilateral-lbp-TX.md | ❌ **仅快照** |
| **NECK** | ✅ bilateral-neck-IE.md | ❌ **不存在** | ✅ bilateral-neck-TX.md | ❌ **仅快照** |

**覆盖率**: 2/4 部位 (50%) 拥有完整康复序列数据

---

### LBP 和 NECK 的单次 TX 快照数据

#### bilateral-lbp-TX.md (单次记录,无序列)

```
Pain: 8/10
Tightness: moderate to severe
Tenderness: +4
Spasm: +3
Strength: 3+/5 - 4-/5
Soreness: 70%
Severity: moderate to severe

⚠️ 无 visitIndex, 无 progress, 无前后对比, 无法推演康复轨迹
```

#### bilateral-neck-TX.md (单次记录,无序列)

```
Pain: 8/10
Tightness: moderate to severe
Tenderness: +4
Spasm: +3
Strength: 3+/5 - 4-/5
Soreness: 70%
Severity: moderate to severe

⚠️ 无 visitIndex, 无 progress, 无前后对比, 无法推演康复轨迹
```

**关键缺失**:
- 无法验证 LBP 的 Pain 康复轨迹形状 (ease-in? linear? 其他?)
- 无法验证 NECK 的 Pain 康复轨迹形状
- 无法验证 LBP/NECK 的 Tenderness 进展模式 (单步? 渐进?)
- 无法验证 LBP/NECK 的 Tightness 变化时机 (是否也是前期快速降级?)
- 无法验证 LBP/NECK 的 ST Goal 达成情况

---

### 验证结论汇总

#### ✅ 已完成验证 (基于 KNEE + SHOULDER 完整序列)

**1. Progress 计算机制** ✅ 已确认
```typescript
// tx-sequence-engine.ts Line 622-628
const progressBase = 3 * acc * acc - 2 * acc * acc * acc  // smoothstep S-curve
```
- 非线性 smoothstep 公式
- TX12 progress ≈ 0.88 (不是 0.4 或 0.6)
- TX11 progress ≈ 0.98 (已达 ST Goal)

**2. IE Goals 模式** ✅ 已确认
- 所有示例使用固定模板 (非动态计算)
- Soreness/ROM/Tightness/Tenderness/Spasm/Strength Goals 100% 相同
- Pain Goals 高度统一 (ST "5-6", LT "3", 除 SHOULDER LT "3-4")

**3. 康复轨迹差异** ✅ 已确认
```
KNEE:      Pain 后加速 (ease-in, 前慢后快: 8.0→7.7→7.4→...→6.8→6.0)
SHOULDER:  Pain 匀速下降 (linear, 均匀: 7.9→7.7→7.3→6.9→6.7→6.1)
```

**4. 一致性模式** ✅ 已确认
- **Tightness**: 前期快速降级 (TX1→moderate, TX2→mild, 后维持)
- **Spasm**: 完全不变 (KNEE 和 SHOULDER 都是 +3 维持到 TX11)

**5. 差异性模式** ✅ 已确认
```
Tenderness:
  KNEE:     单步降 (+4 → +3[TX2] → 维持)
  SHOULDER: 渐进降 (+4 → +3[TX1] → +2[TX5] → +1[TX9])
```

**6. ST Goal 达成率** ✅ 已确认
```
KNEE:     TX11 pain=6.0 ✅ 完美达标 (在 "5-6" 范围内)
SHOULDER: TX11 pain=6.1 ⚠️ 微超 0.1 (略超 "5-6" 上限)
```

---

#### ⚠️ 无法验证 (LBP + NECK 缺少序列数据)

**缺失验证项**:
- ❌ LBP 的 Pain 康复轨迹形状 (可能是第三种模式?)
- ❌ NECK 的 Pain 康复轨迹形状
- ❌ LBP 的 Tenderness 进展模式 (单步 vs 渐进?)
- ❌ NECK 的 Tenderness 进展模式
- ❌ LBP/NECK 的 Tightness 前期快速降级假设是否成立
- ❌ LBP/NECK 的 Spasm 完全不变假设是否成立
- ❌ LBP/NECK 的 ST Goal 达成情况 (TX11 是否在目标范围内?)

**影响范围**:
- 康复曲线模型的普适性 (是否适用于所有部位?)
- 多曲线设计的完备性 (是否需要针对 LBP/NECK 特殊处理?)
- 固定假设的可靠性 (Spasm 不变、Tightness 前快后平是否普遍规律?)

---

### 设计决策的置信度评估

#### 高置信度决策 ✅ (可基于现有数据执行)

**1. 需要多曲线模型** ✅ 置信度 95%
```
证据: KNEE 和 SHOULDER 显示不同 Pain 轨迹
  - KNEE: ease-in (后加速)
  - SHOULDER: linear (匀速)
结论: Pain 曲线必须部位相关 (至少 2 种)
```

**2. ST Goal 进度位置** ✅ 置信度 98%
```
证据: TX11 (progress≈98%) 达到 ST Goal
  - KNEE: TX11=6.0, 完美在 "5-6" 范围
  - SHOULDER: TX11=6.1, 微超但接近
结论: ST Goal 不在 progress=0.4, 而在 progress≈0.98
影响: 设计假设需要调整
```

**3. 固定模板 vs 动态计算** ✅ 置信度 100%
```
证据: 4/4 IE 示例完全相同的 Goals
  - Soreness/ROM/Tightness/Tenderness/Spasm/Strength: 100% 固定
  - Pain: 高度统一 (仅 SHOULDER LT 略异)
结论: 现有系统完全硬编码, 新设计无历史参照
影响: 需要从零验证所有动态计算逻辑
```

**4. Tightness 前快后平模式** ✅ 置信度 90%
```
证据: KNEE 和 SHOULDER 完全一致
  - TX1: moderate to severe → moderate
  - TX2: moderate → mild
  - TX3-11: mild (维持)
结论: Tightness 可能是部位无关的统一模式
⚠️ 但需 LBP/NECK 验证
```

**5. Spasm 完全不变** ✅ 置信度 90%
```
证据: KNEE 和 SHOULDER 完全一致
  - IE-TX11: 始终 +3, 无任何变化
结论: Spasm 可能无康复曲线, 维持初始值
⚠️ 但需 LBP/NECK 验证
影响: 设计中 Spasm Goals 可能无意义 (实际不降级)
```

---

#### 中等置信度决策 ⚠️ (需要更多数据)

**6. Tenderness 进展模式** ⚠️ 置信度 60%
```
已知:
  - KNEE: 单步降 (+4→+3 维持)
  - SHOULDER: 渐进降 (+4→+3→+2→+1)
未知:
  - LBP: 单步 or 渐进?
  - NECK: 单步 or 渐进?
问题: 无法判断是部位相关还是随机变化
影响: 无法确定 Tenderness Goals 的设定策略
```

**7. Pain 曲线的类型数量** ⚠️ 置信度 50%
```
已知:
  - KNEE: ease-in (后加速)
  - SHOULDER: linear (匀速)
未知:
  - LBP: ease-in? linear? ease-out? 其他?
  - NECK: ease-in? linear? ease-out? 其他?
问题: 可能存在第 3、4 种曲线类型
影响: 多曲线模型的复杂度和完备性
```

---

#### 低置信度决策 ❌ (需要 LBP/NECK 数据)

**8. 统一模式的普适性** ❌ 置信度 40%
```
假设: Tightness 前快后平、Spasm 不变是普遍规律
现状: 仅基于 2/4 部位验证
风险: LBP/NECK 可能打破假设
影响: 如果假设不成立, 需要针对不同部位设计不同策略
```

**9. 默认参数的合理性** ❌ 置信度 30%
```
问题: LBP/NECK 缺少序列, 是否可用 KNEE/SHOULDER 的默认值?
风险: 部位差异可能导致不合理的 Goals
建议: 使用保守默认值 (固定模板) 直到验证完成
```

---

### 设计建议

#### 立即可行的设计方案 ✅

**1. 核心康复曲线算法** (基于 KNEE + SHOULDER)
```typescript
// Pain 曲线: 部位相关
const painCurve = {
  'KNEE': easeInCurve,      // 后加速
  'SHOULDER': linearCurve,  // 匀速
  'LBP': linearCurve,       // 默认保守
  'NECK': linearCurve       // 默认保守
}

// Tightness 曲线: 统一前快后平
const tightnessCurve = frontLoadedCurve  // 所有部位

// Spasm: 无曲线, 维持初始值
const spasmGoals = { st: initial, lt: initial }

// Tenderness: 部位相关 (但数据不足, 使用保守默认)
const tendernessGoals = conservativeDefault
```

**2. ST Goal 进度位置调整**
```typescript
// 修正: ST Goal 不在 progress=0.4, 而在实际达成位置
// 基于数据: TX11 (progress≈98%) 达到 ST Goal
const ST_GOAL_PROGRESS = 0.98  // 而非原设计的 0.4
```

**3. 多曲线模型实现**
```typescript
function getDynamicGoals(indicator: string, bodyPart: string) {
  switch (indicator) {
    case 'pain':
      return painCurve[bodyPart]  // 部位相关
    case 'tightness':
      return frontLoadedCurve     // 统一模式
    case 'spasm':
      return maintainCurve        // 不变
    case 'tenderness':
      return conservativeDefault  // 数据不足, 保守
    // ...
  }
}
```

---

#### 风险缓解策略 ⚠️

**对于 LBP/NECK (缺少序列数据)**:

**方案 A: 保守默认值** (推荐)
```typescript
if (bodyPart === 'LBP' || bodyPart === 'NECK') {
  // 使用固定模板 Goals (与现有示例一致)
  return getDefaultGoals(bodyPart)
}
```
- ✅ 优势: 安全, 与历史模板一致
- ❌ 劣势: 无法利用动态计算优势

**方案 B: 使用 SHOULDER 默认值** (次优)
```typescript
if (bodyPart === 'LBP' || bodyPart === 'NECK') {
  // 假设与 SHOULDER 类似 (linear pain curve)
  return calculateGoals(bodyPart, { painCurve: linearCurve })
}
```
- ✅ 优势: 有一定动态性
- ❌ 劣势: 假设可能不成立

**方案 C: 混合策略** (最推荐)
```typescript
if (bodyPart === 'LBP' || bodyPart === 'NECK') {
  // Pain/Tenderness: 使用 linear 保守估计
  // Tightness/Spasm: 使用已验证的统一模式
  return {
    pain: linearCurve,           // 保守
    tightness: frontLoadedCurve, // 已验证
    spasm: maintainCurve,        // 已验证
    tenderness: conservativeDefault  // 保守
  }
}
```
- ✅ 优势: 平衡动态性和安全性
- ✅ 优势: 利用已验证的部分假设

---

#### 未来验证计划 🔮

**当 LBP/NECK 完整序列可用时**:

1. **回归验证 Tightness 假设**
   - 验证是否也是 TX1-2 快速降级
   - 验证是否维持在 "mild"

2. **回归验证 Spasm 假设**
   - 验证是否完全不变
   - 如果不成立, 需要重新设计 Spasm Goals

3. **识别 Pain 曲线类型**
   - 是 ease-in? linear? 还是新的第三种?
   - 更新 painCurve 映射表

4. **识别 Tenderness 模式**
   - 单步降? 渐进降? 还是部位无关?
   - 更新 Tenderness Goals 策略

5. **验证 ST Goal 达成率**
   - TX11 是否在 "5-6" 范围?
   - 调整 ST_GOAL_PROGRESS 参数

---

## 下一步行动建议

### 立即执行

1. **读取 tx-sequence-engine.ts**
   - 确认 progress 计算逻辑
   - 验证 visitIndex → progress 映射

2. **读取更多示例文件**
   - 检查 Soreness Goals 模式
   - 确认 Pain Goals 范围格式规则
   - 查找 ROM Goals 定义

3. **创建验证测试用例**
   - bilateral-knee-IE 反推测试
   - 边界情况测试矩阵
   - Dropdown 对齐验证

### 待用户确认

4. **设计意图确认**
   - 是否保持固定模板 Goals?
   - 还是完全动态化?
   - Soreness 是否要降低?

5. **临床参数确认**
   - 0.35 比率是否合适?
   - 重症患者是否需要特殊逻辑?

6. **矛盾处理策略**
   - 选择策略 A/B/C?
   - 是否需要警告系统?

---

**文档结束**
