# Goals 与 TX 序列对齐设计

**日期**: 2026-02-10
**状态**: 已实现

---

## 核心理念

**Goals 是 TX 序列的终点预演**，不是独立设定的目标。

```
IE (TX0) → TX1 → TX2 → ... → TX12 (ST Goal) → ... → TX20 (LT Goal)
```

---

## 动态 Goals 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| pain | { st, lt } | Pain Scale 目标 |
| symptomType | string | 症状类型: soreness/weakness/stiffness/heaviness/numbness |
| symptomPct | { st, lt } | 症状百分比目标 |
| tightness | { st, lt } | 肌肉紧张度目标 |
| tenderness | { st, lt } | 压痛等级目标 |
| spasm | { st, lt } | 痉挛等级目标 |
| strength | { st, lt } | 肌力目标 |
| rom | { st, lt } | 活动范围目标 |
| adl | { st, lt } | 日常活动能力目标 |

---

## 指标关联链

```
Pain ←→ Tenderness (强相关)
  ↓
Tightness ←→ Spasm (强相关)
  ↓
ROM (Tightness 改善 → ROM 改善)
  ↓
Strength (ROM 改善 → Strength 可训练)
  ↓
ADL (综合所有指标，与 Tightness 同步)
```

---

## 1. TX 序列的实际 Progress 分布

基于 `tx-sequence-engine.ts` 的 smoothstep S曲线：

| TX | Progress | 阶段 |
|----|----------|------|
| TX1 | ~10% | 快速启动 |
| TX4 | ~37% | 加速期 |
| TX8 | ~70% | 中期 |
| TX11 | ~98% | 接近 ST Goal |
| TX12 | ~100% | **ST Goal 达成** |
| TX20 | 100% | **LT Goal 达成** |

**关键发现**：ST Goal 在 TX12 达成，对应 progress ≈ 100%（ST 阶段内）

---

## 2. 指标关联性分析

### 2.1 主观指标 (Subjective)
- **Pain**: 患者主诉，核心指标
- **Soreness**: 与 Pain 正相关

### 2.2 客观指标 (Objective)
- **Tenderness**: 压痛，与 Pain 强相关
- **Tightness**: 肌肉紧张度，与 Pain 中等相关
- **Spasm**: 痉挛，与 Tightness 强相关
- **ROM**: 活动范围，与 Tightness 负相关
- **Strength**: 肌力，与 ROM 正相关

### 2.3 功能指标 (Assessment/Plan)
- **ADL**: 日常活动能力，综合反映所有指标

---

## 3. 指标关联链

```
Pain ←→ Tenderness (强相关)
  ↓
Tightness ←→ Spasm (强相关)
  ↓
ROM (Tightness 改善 → ROM 改善)
  ↓
Strength (ROM 改善 → Strength 可训练)
  ↓
ADL (综合所有指标)
```

**改善顺序**：
1. **Phase 1 (TX1-4)**: Pain/Tenderness 快速下降
2. **Phase 2 (TX5-8)**: Tightness/Spasm 改善，ROM 开始改善
3. **Phase 3 (TX9-12)**: Strength 提升，ADL 改善
4. **Phase 4 (TX13-20)**: 巩固维持，达到 LT Goal

---

## 4. 合理的 Goals 设定 (moderate to severe, Pain=8)

### 4.1 IE 初始状态
```
Pain:       8
Tenderness: +4 (Grade 4)
Tightness:  moderate to severe
Spasm:      +3 (Grade 3)
ROM:        60% of normal (deficit 40%)
Strength:   3+/5
ADL:        moderate to severe impairment
```

### 4.2 ST Goal (TX12 达成)
```
Pain:       5-6      (降 2-3 级，每次 TX 降 ~0.2)
Tenderness: Grade 3  (降 1 级)
Tightness:  moderate (降 1 档)
Spasm:      Grade 2  (降 1 级)
ROM:        改善 50% deficit → 80% of normal
Strength:   4/5      (提升 0.5 级)
ADL:        moderate impairment
```

### 4.3 LT Goal (TX20 达成)
```
Pain:       2-3      (再降 3 级)
Tenderness: Grade 1  (再降 2 级)
Tightness:  mild     (再降 1 档)
Spasm:      Grade 0-1 (再降 1-2 级)
ROM:        改善 80% deficit → 92% of normal
Strength:   4+/5     (再提升 0.5 级)
ADL:        mild impairment
```

---

## 5. 每次 TX 的合理改善幅度

### 5.1 Pain (核心指标)
```
IE:   8.0
TX1:  7.7  (-0.3)  ← 首次治疗，明显改善
TX2:  7.5  (-0.2)
TX3:  7.3  (-0.2)
TX4:  7.0  (-0.3)
TX5:  6.8  (-0.2)
TX6:  6.5  (-0.3)
TX7:  6.3  (-0.2)
TX8:  6.0  (-0.3)
TX9:  5.8  (-0.2)
TX10: 5.6  (-0.2)
TX11: 5.4  (-0.2)
TX12: 5.2  (-0.2)  ← ST Goal: 5-6 ✓

累计: 8.0 → 5.2 = -2.8 (12次)
平均: -0.23/次
```

### 5.2 Tenderness (与 Pain 同步)
```
IE:   +4
TX1-3:  +4 (维持)
TX4:    +3 (降 1 级) ← 约 progress 37%
TX5-11: +3 (维持)
TX12:   +3          ← ST Goal: Grade 3 ✓

TX13-16: +2 (降 1 级)
TX17-20: +1-2
TX20:    +1         ← LT Goal: Grade 1 ✓
```

### 5.3 Tightness (滞后于 Pain)
```
IE:     moderate to severe
TX1-2:  moderate to severe (维持)
TX3:    moderate (降 1 档) ← 约 progress 25%
TX4-12: moderate (维持)
TX12:   moderate           ← ST Goal ✓

TX13-16: mild to moderate (降 1 档)
TX17-20: mild
TX20:    mild              ← LT Goal ✓
```

### 5.4 Spasm (与 Tightness 同步)
```
IE:     +3
TX1-4:  +3 (维持)
TX5:    +2 (降 1 级) ← 约 progress 42%
TX6-12: +2 (维持)
TX12:   +2          ← ST Goal: Grade 2 ✓

TX13-16: +1 (降 1 级)
TX17-20: +0-1
TX20:    +0         ← LT Goal: Grade 0-1 ✓
```

### 5.5 ROM (Tightness 改善后才改善)
```
IE:     60% of normal (deficit 40%)
TX1-4:  60-65% (缓慢改善)
TX5-8:  65-75% (Tightness 改善后加速)
TX9-12: 75-80%
TX12:   80%         ← ST Goal: 改善 50% deficit ✓

TX13-16: 80-88%
TX17-20: 88-92%
TX20:    92%        ← LT Goal: 改善 80% deficit ✓
```

### 5.6 Strength (ROM 改善后才能训练)
```
IE:     3+/5 (3.5)
TX1-6:  3+/5 (维持，ROM 不足无法训练)
TX7-9:  3+/5 → 4-/5 (ROM 改善后开始提升)
TX10-12: 4-/5 → 4/5
TX12:   4/5         ← ST Goal ✓

TX13-16: 4/5 (巩固)
TX17-20: 4/5 → 4+/5
TX20:    4+/5       ← LT Goal ✓
```

### 5.7 ADL (综合指标)
```
ADL 由以下因素决定:
- Pain level (权重 40%)
- ROM (权重 30%)
- Strength (权重 30%)

IE:     moderate to severe (Pain 8, ROM 60%, Str 3.5)
TX12:   moderate (Pain 5-6, ROM 80%, Str 4)  ← ST Goal ✓
TX20:   mild (Pain 2-3, ROM 92%, Str 4.5)    ← LT Goal ✓
```

---

## 6. Goals 计算公式修正

基于以上分析，修正 Goals 计算：

```typescript
// Pain: 12次降 2.5-3 级
ST_PAIN_DROP = 2.5  // Pain 8 → 5.5 → "5-6"
LT_PAIN_DROP = 5.5  // Pain 8 → 2.5 → "2-3"

// Tenderness: ST 降 1 级, LT 降 3 级
ST_TENDER_DROP = 1  // +4 → +3
LT_TENDER_DROP = 3  // +4 → +1

// Tightness: ST 降 1 档, LT 降 3 档
ST_TIGHT_DROP = 1   // mod-sev → mod
LT_TIGHT_DROP = 3   // mod-sev → mild

// Spasm: ST 降 1 级, LT 降 3 级
ST_SPASM_DROP = 1   // +3 → +2
LT_SPASM_DROP = 3   // +3 → +0

// ROM: ST 改善 50% deficit, LT 改善 80% deficit
ST_ROM_IMPROVE = 0.5
LT_ROM_IMPROVE = 0.8

// Strength: ST +0.5, LT +1.0
ST_STR_GAIN = 0.5   // 3.5 → 4
LT_STR_GAIN = 1.0   // 3.5 → 4.5

// ADL: 与 Tightness 同步
ADL = Tightness
```

---

## 7. 关联性约束

### 7.1 Tightness → ROM 约束
```typescript
// ROM 改善不能超过 Tightness 允许的范围
if (tightness === 'severe') maxROM = 60%
if (tightness === 'moderate to severe') maxROM = 70%
if (tightness === 'moderate') maxROM = 80%
if (tightness === 'mild to moderate') maxROM = 90%
if (tightness === 'mild') maxROM = 100%
```

### 7.2 ROM → Strength 约束
```typescript
// Strength 提升需要足够的 ROM
if (ROM < 70%) maxStrength = current  // 无法训练
if (ROM >= 70%) maxStrength = current + 0.5
if (ROM >= 80%) maxStrength = current + 1.0
if (ROM >= 90%) maxStrength = 5.0  // 可达满分
```

### 7.3 Pain/Tightness → ADL 约束
```typescript
// ADL 取 Pain 和 Tightness 的较差者
ADL = worse(painToSeverity(pain), tightness)
```

---

## 8. 最终 Goals 设定表

### moderate to severe (Pain=8, 标准重症)

| 指标 | IE | ST Goal | LT Goal | ST差距 | LT差距 |
|------|-----|---------|---------|--------|--------|
| Pain | 8 | 5-6 | 2-3 | 2-3级 | 5-6级 |
| Tenderness | +4 | Grade 3 | Grade 1 | 1级 | 3级 |
| Tightness | mod-sev | moderate | mild | 1档 | 3档 |
| Spasm | +3 | Grade 2 | Grade 0-1 | 1级 | 2-3级 |
| ROM | 60% | 80% | 92% | +20% | +32% |
| Strength | 3+/5 | 4/5 | 4+/5 | +0.5 | +1.0 |
| ADL | mod-sev | moderate | mild | 1档 | 3档 |

### severe (Pain=10, 极重症)

| 指标 | IE | ST Goal | LT Goal |
|------|-----|---------|---------|
| Pain | 10 | 7-8 | 3-4 |
| Tenderness | +4 | Grade 3 | Grade 1-2 |
| Tightness | severe | mod-sev | moderate |
| Spasm | +4 | Grade 3 | Grade 1 |
| ROM | 50% | 70% | 85% |
| Strength | 3/5 | 3+/5 | 4/5 |
| ADL | severe | mod-sev | moderate |

### moderate (Pain=7, 中度)

| 指标 | IE | ST Goal | LT Goal |
|------|-----|---------|---------|
| Pain | 7 | 5 | 2-3 |
| Tenderness | +3 | Grade 2 | Grade 1 |
| Tightness | moderate | mild-mod | mild |
| Spasm | +2 | Grade 1 | Grade 0 |
| ROM | 70% | 85% | 95% |
| Strength | 4-/5 | 4/5 | 4+/5 |
| ADL | moderate | mild-mod | mild |

---

## 9. 待实现

- [ ] 更新 `goals-calculator.ts` 使用新的计算公式
- [ ] 添加 ROM Goals 计算
- [ ] 添加 ADL Goals 计算 (与 Tightness 关联)
- [ ] 验证与 tx-sequence-engine 的对齐
- [ ] 添加关联性约束检查
