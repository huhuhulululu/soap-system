# 动态 Goals 深度分析报告（基于实际运行数据）

**文档版本**: 1.0
**创建日期**: 2026-02-10
**状态**: 分析完成，待实施
**数据来源**: 实际运行 4 部位 IE + 11 TX 序列

---

## 📋 目录

1. [已确认的问题（置信度 100%）](#已确认的问题置信度-100)
2. [已确认的行为模式（置信度 95%+）](#已确认的行为模式置信度-95)
3. [设计假设的验证与修正](#设计假设的验证与修正)
4. [TX Engine 核心机制解析](#tx-engine-核心机制解析)
5. [最终问题清单与优先级](#最终问题清单与优先级)
6. [实施建议](#实施建议)

---

## 已确认的问题（置信度 100%）

### 1. Goals 反向矛盾 — 已用实际数据复现

当 `severityLevel: 'mild'` 时的 IE 输出：

```
IE Tenderness = (+1) (最优)
IE Tightness  = mild (最优)

但 Goals 仍然写：
  ST Goal: Decrease Muscles Tenderness to Grade 3   ← 比当前 +1 更差！
  ST Goal: Decrease Muscles Tightness to moderate    ← 比当前 mild 更差！
  ST Goal: Decrease Muscles Spasms to Grade 2        ← 可能比当前更差
```

**根因**：`generatePlanIE()` (Line 1239-1296) 所有 Goals 值完全硬编码，不读取 Objective 中的实际值。

**复现命令**：
```typescript
const ctx: GenerationContext = {
  severityLevel: 'mild',  // ← 关键：轻症
  primaryBodyPart: 'KNEE',
  // ... 其他字段
}
const text = exportSOAPAsText(ctx)
// Tenderness Scale: (+1) 但 Goal 写 Grade 3
```

---

### 2. IE Pain Scale 完全不受 severity 影响

所有 4 个部位的 IE Subjective Pain Scale 输出：

| 部位 | severity=mild | severity=moderate | severity=severe | 实际输出 |
|------|--------------|-------------------|-----------------|---------|
| KNEE | 8/6/8 | 8/6/8 | 8/6/8 | **永远 8/6/8** |
| SHOULDER | 7/6/7-6 | 7/6/7-6 | 7/6/7-6 | **永远 7/6/7-6** |
| LBP | 8/6/8 | 8/6/8 | 8/6/8 | **永远 8/6/8** |
| NECK | 8/6/8 | 8/6/8 | 8/6/8 | **永远 8/6/8** |

**而 Objective 的 Tightness 和 Tenderness 是动态的**（根据 severity 变化），造成 S↔O 逻辑矛盾：

```
severity=mild 时：
  S: Pain Scale Current: 8        ← 重症疼痛
  O: Tightness: mild              ← 轻症紧张度
  O: Tenderness: (+1)             ← 轻症压痛
  → 矛盾：高疼痛 + 低体征
```

**代码位置**：`generateSubjective()` Line 642/679/705 硬编码 Pain Scale。

---

### 3. SOAPNote 结构体 vs 文本输出不一致

`generateSOAPNote()` (Line 2014) 返回的结构体值与 `generateSubjective()` 生成的文本不同：

| 字段 | 文本输出 | SOAPNote 结构体 | 一致？ |
|------|---------|----------------|--------|
| Pain worst | 8 | 8 | ✅ |
| Pain best | **6** | **4** | ❌ |
| Pain current | **8** | **7** | ❌ |
| Soreness ST Goal | (70%-80%) | 50% | ❌ |
| Soreness LT Goal | (70%-80%) | 30% | ❌ |

**影响**：TX engine 通过 `context.previousIE?.subjective?.painScale?.current` 读取起始 Pain。如果传了 previousIE，会用结构体的 7 而不是文本的 8。

---

### 4. demo full-test 没有传 previousIE

`demo-bilateral-knee-full-test.ts` 和 `demo-bilateral-shoulder-full-test.ts` 的 TX context **没有设置 `previousIE`**：

```typescript
// demo-bilateral-knee-full-test.ts Line 27-37
const kneeTXContext: GenerationContext = {
  noteType: 'TX',
  // ... 没有 previousIE!
}
```

导致 TX engine 使用 fallback：
```typescript
const ieStartPain = context.previousIE?.subjective?.painScale?.current ?? 8  // → 8
const targetPain = parsePainTarget(
  context.previousIE?.plan?.shortTermGoal?.painScaleTarget,  // → undefined
  Math.max(3, ieStartPain - 2)  // → max(3, 6) = 6
)
// targetPain = 6（而不是从 ST Goal "5-6" 解析的 5.5）
```

而 `scripts/generate-knee-demo.ts` **有传 previousIE**，两者行为不同。

---

### 5. TX severity 会跳升

当 IE severity 是 `mild to moderate` 时：

```
IE: severityLevel = 'mild to moderate'
IE: Pain Scale Current = 8 (硬编码)

TX engine: ieStartPain = 8 (从 previousIE 或 fallback)
TX1: pain = 8 - (0.5~1.5) ≈ 7.0
TX1: severityFromPain(7) = 'moderate to severe'  ← 比 IE 更严重！
```

**根因**：IE Pain 硬编码为 8，与 severity 不匹配。TX engine 用 Pain 推算 severity，导致跳升。

---

## 已确认的行为模式（置信度 95%+）

### 6. 四个部位的 TX 康复轨迹高度一致

实际运行数据（severity=moderate to severe, 无 previousIE）：

#### Pain 轨迹

| TX | KNEE | SHOULDER | LBP | NECK |
|----|------|----------|-----|------|
| 1 | 7.0 | 7.0 | 7.0 | 7.0 |
| 2 | 7.0 | 7.0 | 7.0 | 7.0 |
| 3 | 7.0 | 7.0 | 7.0 | 7.0 |
| 4 | 7.0 | 7.0 | 7.0 | 7.0 |
| 5 | 7.0 | 7.0 | 7.0 | 7.0 |
| 6 | 7.0 | 7.0 | 7.0 | 7.0 |
| 7 | 7.0 | 7.0 | 6.0 | 7.0 |
| 8 | 6.0 | 6.0 | 6.0 | 6.0 |
| 9 | 6.0 | 6.0 | 6.0 | 6.0 |
| 10 | 6.0 | 6.0 | 6.0 | 6.0 |
| 11 | 6.0 | 6.0 | 6.0 | 6.0 |

**关键发现**：Pain 是**阶梯式下降**（8→7→6），不是连续曲线。原因是 `snapToGrid` 吸附到整数。

#### Tightness 轨迹

| TX | KNEE | SHOULDER | LBP | NECK |
|----|------|----------|-----|------|
| 1-2 | mod-sev | mod-sev | mod-sev | mod-sev |
| 3 | mod-sev | mod-sev | mod-sev | mod-sev |
| 4 | **mod** | mod-sev | mod-sev | mod-sev |
| 5 | mod | mod-sev | mod-sev | mod-sev |
| 6 | mod | **mod** | **mod** | **mod** |
| 7-11 | mod | mod | mod | mod |

**关键发现**：Tightness 由 Pain 驱动。Pain=7 时 Tightness 在 mod-sev/mod 之间（随机），Pain=6 时稳定在 mod。

#### Tenderness 轨迹

| TX | KNEE | SHOULDER | LBP | NECK |
|----|------|----------|-----|------|
| 1-2 | +3 | +3 | +3 | +3 |
| 3 | +3 | +3 | **+2** | **+2** |
| 4 | **+2** | **+2** | +2 | +2 |
| 5-11 | +2 | +2 | +2 | +2 |

**关键发现**：Tenderness 在 TX3-4 降到 +2 后维持。四部位一致。

#### Spasm 轨迹

| TX | KNEE | SHOULDER | LBP | NECK |
|----|------|----------|-----|------|
| 1-2 | +3 | +3 | +3 | +3 |
| 3 | **+2** | **+2** | **+2** | **+2** |
| 4 | +2 | +2 | **+1** | **+1** |
| 5 | **+1** | **+1** | +1 | +1 |
| 6 | +1 | +1 | +1 | +1 |
| 7 | +1 | +1 | **0** | **0** |
| 8-11 | **0** | **0** | 0 | 0 |

**关键发现**：
- ⚠️ **推翻验证文档结论**：验证文档说"Spasm 完全不变"是错的（可能基于旧版本代码或不同 seed）
- Spasm 实际从 +3 渐进降到 0，由确定性公式驱动：
  ```typescript
  progress >= 0.40 → target=2
  progress >= 0.60 → target=1
  progress >= 0.85 → target=0
  ```

---

### 7. ST Goal 达成情况

所有 4 个部位 TX11 的状态 vs ST Goal：

| 指标 | TX11 实际 | ST Goal | 达标？ | 分析 |
|------|----------|---------|--------|------|
| Pain | 6 | 5-6 | ✅ 刚好在范围内 | 完美 |
| Tightness | Moderate | moderate | ✅ 达标 | 完美 |
| Tenderness | +2 | Grade 3 | ⚠️ **超额完成** | Goal 过于保守 |
| Spasm | 0 | Grade 2 | ⚠️ **大幅超额** | Goal 严重保守 |
| Soreness | 未追踪 | (70%-80%) | ❓ | TX 不输出 Soreness |
| Strength | 未追踪 | to4 | ❓ | 需要从 ROM 推断 |

---

### 8. Progress 曲线实际分布

| TX | KNEE | SHOULDER | LBP | NECK | 平均 |
|----|------|----------|-----|------|------|
| 1 | 21.3% | 19.8% | 18.5% | 20.9% | 20.1% |
| 2 | 39.8% | 40.8% | 36.3% | 35.7% | 38.2% |
| 3 | 51.7% | 52.6% | 54.7% | 55.2% | 53.6% |
| 4 | 67.4% | 64.6% | 62.7% | 61.5% | 64.1% |
| 5 | 78.4% | 74.1% | 73.1% | 72.8% | 74.6% |
| 6 | 83.7% | 83.4% | 81.1% | 79.2% | 81.9% |
| 7 | 85.7% | 90.6% | 88.6% | 88.4% | 88.3% |
| 8 | 97.7% | 90.7% | 93.8% | 95.6% | 94.5% |
| 9 | 98.0% | 97.8% | 98.0% | 95.6% | 97.4% |
| 10 | 98.0% | 98.0% | 98.0% | 98.0% | 98.0% |
| 11 | 98.0% | 98.0% | 98.0% | 98.0% | 98.0% |

**关键发现**：
- Progress 在 TX8-9 就到 98% 并封顶（`clamp(..., 0.05, 0.98)`）
- TX9-11 的状态几乎不变
- 公式：`smoothstep(√(localIndex/remainingTx))` + 噪声

---

## 设计假设的验证与修正

### 原假设 vs 实际数据

| 假设 | 原置信度 | 新置信度 | 结论 |
|------|---------|---------|------|
| 四部位需要不同 Pain 曲线 | 95% | **20%** | ❌ 推翻：四部位行为几乎一致 |
| Spasm 完全不变 | 90% | **0%** | ❌ 推翻：Spasm 从 +3 降到 0 |
| Tightness 前 2 次降到 mild | 90% | **0%** | ❌ 推翻：由 Pain 驱动，Pain=7 时仍 mod-sev |
| 需要多曲线模型 | 95% | **20%** | ❌ 推翻：一套统一逻辑即可 |
| ST Goal 在 progress=0.4 | 设计假设 | **0%** | ❌ 推翻：实际在 progress≈98% 时达标 |
| Pain 是连续下降 | 隐含假设 | **0%** | ❌ 推翻：阶梯式（snapToGrid 离散化） |
| Ease-out 康复曲线 | 设计核心 | **30%** | ⚠️ 存疑：实际是阶梯式，曲线形状被离散化掩盖 |
| Soreness Goals 应该降低 | 设计假设 | **20%** | ⚠️ 存疑：所有示例固定 (70%-80%)，TX 不追踪 |
| ROM Goals 应该动态化 | 设计假设 | **20%** | ⚠️ 存疑：所有示例固定 60% |

---

## TX Engine 核心机制解析

### Pain 计算流程

```typescript
// 1. 基础期望值（连续）
const expectedPain = startPain - (startPain - targetPain) * progress
// startPain=8, targetPain=6, progress=0.5 → expectedPain = 7.0

// 2. 加噪声 + 扰动
const painNoise = clamp(((rng()-0.5)*0.2) + disruption*0.08, -0.15, 0.15)

// 3. TX1 特殊处理：强制降 0.5-1.5
if (i === startIdx) rawPain = startPain - (0.5 + rng() * 1.0)

// 4. 单调约束：不能比上次高
rawPain = Math.min(prevPain, expectedPain + painNoise)

// 5. 吸附到整数网格
const snapped = snapPainToGrid(rawPain)
// 7.3 → {value: 7, label: "8-7"} 或 {value: 7, label: "7"}

// 6. 再次单调约束
painScaleCurrent = Math.min(prevPain, snapped.value)
```

**为什么是阶梯式**：expectedPain 从 8.0 缓慢降到 7.x，但 snapToGrid 把 7.0-7.74 都吸附到 7，直到降到 6.75 以下才跳到 "7-6" 或 6。

### Tightness 计算流程（双重控制）

```typescript
// 第一套：基于 progress 的概率递减（用于 soaChain 趋势判断）
const nextTightness = Math.max(1, prevTightness - (progress > 0.55 && rng() > 0.35 ? 1 : 0))

// 第二套：基于 painScaleCurrent 的确定性映射（用于文本输出，覆盖第一套）
if (painScaleCurrent >= 8) targetTightnessGrade = 'Severe' 或 'Moderate to severe'
else if (painScaleCurrent >= 5) targetTightnessGrade = 'Moderate' 或 'Moderate to severe'（受 progress 影响）
else targetTightnessGrade = 'Mild' 或 'Mild to moderate'

// 纵向约束：不允许比上次更差
if (curIdx > prevIdx) tightnessGrading = prevTightnessGrading
```

**结论**：Tightness 是 Pain 的衍生物。Pain 降了，Tightness 自然降。

### Tenderness 计算流程

```typescript
// 基于 painScaleCurrent 的确定性映射
if (painScaleCurrent >= 8) targetTenderGrade = '+4' 或 '+3'
else if (painScaleCurrent >= 5) targetTenderGrade = '+2' 或 '+3'（受 progress 影响）
else targetTenderGrade = '+1' 或 '+2'

// 纵向约束：不允许比上次更差
```

### Spasm 计算流程

```typescript
// 确定性阶梯递减
const spasmTarget = progress >= 0.85 ? 0
                  : progress >= 0.60 ? 1
                  : progress >= 0.40 ? 2
                  : 3

// 每次最多降 1 级
const nextSpasm = Math.min(prevSpasm, Math.max(spasmTarget, prevSpasm - 1))
```

### targetPain 来源

```typescript
// 优先从 previousIE 读取 ST Goal
const targetPain = parsePainTarget(
  context.previousIE?.plan?.shortTermGoal?.painScaleTarget,  // "5-6" → 5.5
  Math.max(3, ieStartPain - 2)  // fallback: max(3, 8-2) = 6
)
```

**关键**：TX engine 只读 ST Goal，不读 LT Goal。整个 TX 序列趋向 ST Goal。

---

## 最终问题清单与优先级

### P0：必须修复（核心矛盾）

| # | 问题 | 影响 | 复杂度 |
|---|------|------|--------|
| 1 | **Goals 反向矛盾**：当前 Tenderness=+1 时 Goal 写 Grade 3 | 临床不合理，保险审查风险 | 中 |
| 2 | **IE Pain Scale 硬编码**：不受 severity 影响 | S↔O 逻辑矛盾，TX severity 跳升 | 中 |
| 3 | **SOAPNote 结构体 vs 文本不一致**：best/current 值不同 | TX engine 用错误的起始值 | 低 |

### P1：应该修复（改善质量）

| # | 问题 | 影响 | 复杂度 |
|---|------|------|--------|
| 4 | **Tenderness/Spasm Goals 过于保守**：TX11 远超目标 | 保险可能质疑为什么还需治疗 | 低 |
| 5 | **Soreness Goal 固定 (70%-80%)**：ST=LT 完全相同 | 无改善目标 | 低 |
| 6 | **demo full-test 没传 previousIE** | 测试数据不准确 | 低 |

### P2：可以后做（优化项）

| # | 问题 | 影响 | 复杂度 |
|---|------|------|--------|
| 7 | **ROM Goal 固定 60%** | 可能是设计意图 | 低 |
| 8 | **SHOULDER LT Pain Goal "3-4" 特殊规则** | 需确认是否保留 | 低 |
| 9 | **数据流重构**：generate 函数只返回 string | 阻碍 Goals 读取 Objective 值 | 高 |

### 不需要做（已推翻）

| 原计划 | 推翻原因 |
|--------|---------|
| ~~多曲线模型（每部位不同曲线）~~ | 四部位行为一致 |
| ~~Spasm Goals 取消~~ | Spasm 实际会降 |
| ~~progress 对齐问题~~ | Goals 不需要依赖 TX progress |
| ~~Ease-out vs Ease-in 选择~~ | 阶梯式下降，曲线形状不重要 |

---

## 实施建议

### 最小可行方案（解决 P0）

#### Step 1：让 IE Pain Scale 根据 severity 动态设置

```typescript
// generateSubjective() 中替换硬编码
const painMap = {
  'severe':             { worst: 10, best: 7, current: '10-9' },
  'moderate to severe': { worst: 8,  best: 6, current: '8' },
  'moderate':           { worst: 7,  best: 5, current: '7' },
  'mild to moderate':   { worst: 6,  best: 4, current: '5-4' },
  'mild':               { worst: 4,  best: 2, current: '4-3' }
}
```

#### Step 2：让 Goals 根据当前状态动态计算

核心逻辑：**Goal 不能比当前状态更差**

```typescript
function calculateGoals(currentState) {
  return {
    tenderness: {
      st: Math.max(1, currentState.tenderness - 1),  // 降 1 级，最低 1
      lt: Math.max(1, currentState.tenderness - 2)   // 降 2 级，最低 1
    },
    // 如果当前已经 <= 目标，维持当前值
  }
}
```

#### Step 3：统一 SOAPNote 结构体和文本输出

让 `generateSOAPNote()` 使用与 `generateSubjective()` 相同的 Pain Scale 值。

### 数据流方案

当前问题：`generatePlanIE()` 不知道 `generateObjective()` 产生的 Tenderness/Tightness 值。

**方案 A**（最小改动）：从 `context.severityLevel` 推算
```typescript
// 不需要读 Objective 的实际值，用 severity 推算
const severityToTender = { 'severe': 4, 'moderate to severe': 3, 'moderate': 3, 'mild to moderate': 2, 'mild': 1 }
const currentTenderness = severityToTender[context.severityLevel]
```

**方案 B**（更准确）：重构生成流程，传递中间状态
```typescript
const subjResult = generateSubjective(context)  // 返回 { text, painScale }
const objResult = generateObjective(context)     // 返回 { text, tenderness, tightness, ... }
const goals = calculateDynamicGoals(subjResult.painScale, objResult)
const planText = generatePlanIE(context, goals)
```

**推荐方案 A**：因为 Objective 的 Tenderness/Tightness 本身就是从 severity 推算的，直接用 severity 推算 Goals 等价且无需重构。

---

## 附录

### A. 验证命令

```bash
# 运行 4 部位 IE 对比
npx tsx -e "
import { exportSOAPAsText } from './src/index'
const parts = ['KNEE', 'SHOULDER', 'LBP', 'NECK']
for (const bp of parts) {
  const ctx = { noteType: 'IE', insuranceType: 'WC', primaryBodyPart: bp,
    laterality: 'bilateral', localPattern: 'Cold-Damp + Wind-Cold',
    systemicPattern: 'Kidney Yang Deficiency', chronicityLevel: 'Chronic',
    severityLevel: 'mild', hasPacemaker: false }
  const text = exportSOAPAsText(ctx)
  console.log('=== ' + bp + ' (mild) ===')
  console.log(text.match(/Pain Scale:.*/)?.[0])
  console.log(text.match(/Tenderness Scale:.*/)?.[0])
  console.log(text.match(/Decrease Muscles Tenderness.*/)?.[0])
}
"
```

### B. TX Engine 关键代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| Progress 计算 | tx-sequence-engine.ts | 622-628 |
| Pain 计算 | tx-sequence-engine.ts | 640-680 |
| Tightness 映射 | tx-sequence-engine.ts | 810-850 |
| Tenderness 映射 | tx-sequence-engine.ts | 860-900 |
| Spasm 递减 | tx-sequence-engine.ts | 716-718 |
| targetPain 读取 | tx-sequence-engine.ts | 562-567 |
| snapToGrid | tx-sequence-engine.ts | 289-306 |
| severityFromPain | tx-sequence-engine.ts | 308-320 |

### C. IE Goals 硬编码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| Pain Scale 硬编码 | soap-generator.ts | 642/679/705 |
| Goals 硬编码 | soap-generator.ts | 1253-1283 |
| SOAPNote 结构体 | soap-generator.ts | 2060-2110 |

---

**文档结束**
