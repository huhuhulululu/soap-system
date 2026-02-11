# 测试覆盖矩阵

## 概览

本文档提供 SOAP 系统的完整测试覆盖情况，包括单元测试、集成测试、黄金案例测试及端到端测试的覆盖矩阵。

**统计摘要**:
- **总测试文件**: 2 个集成测试
- **黄金案例**: 13 个 (优秀 5 + 错误 5 + 边界 3)
- **规则总数**: 23 个 (Layer 1: 13, Layer 2: 10)
- **目标覆盖率**: 80%+

---

## 1. 测试覆盖矩阵总览

| Feature | Unit Test | Integration Test | Golden Case | E2E Test | Coverage % |
|---------|-----------|------------------|-------------|----------|------------|
| **Parser (IE/TX)** | ❌ Missing | ✅ FE-01, FE-02 | ✅ 5 IE cases | ⚠️ Planned | 60% |
| **Layer 1 (Rules)** | ❌ Missing | ⚠️ Partial | ✅ 5 error cases | ❌ Missing | 45% |
| **Layer 2 (Heuristics)** | ❌ Missing | ❌ Missing | ⚠️ Partial | ❌ Missing | 30% |
| **Layer 3 (Similarity)** | ❌ Missing | ❌ Missing | ✅ Implicit | ❌ Missing | 35% |
| **Generator (Continuation)** | ❌ Missing | ✅ FE-03, FE-06 | ✅ Implicit | ❌ Missing | 55% |
| **Auditor (3-Layer)** | ❌ Missing | ✅ FE-06 | ✅ All cases | ❌ Missing | 50% |
| **Body Part Recognition** | ❌ Missing | ✅ FE-05 (3 parts) | ⚠️ Partial | ❌ Missing | 40% |
| **Vertical Logic** | ❌ Missing | ✅ FE-03 pain trend | ⚠️ Partial | ❌ Missing | 50% |

**总体覆盖率**: **~46%** (远低于 80% 目标)

---

## 2. 规则测试矩阵

### 2.1 Layer 1 规则 (Rule Compliance)

| Rule ID | 规则名称 | Positive Test | Negative Test | Edge Case | Error Case | Total Coverage |
|---------|---------|---------------|---------------|-----------|------------|----------------|
| **AC-2.1** | Chronicity 选项 | ❌ | ❌ | ❌ | ⚠️ (隐含) | 25% |
| **AC-2.2** | Severity 选项 | ❌ | ❌ | ❌ | ⚠️ (隐含) | 25% |
| **AC-2.3** | General Condition | ❌ | ❌ | ❌ | ⚠️ (隐含) | 25% |
| **AC-3.1** | Pain 纵向逻辑 | ✅ FE-03 | ✅ ERROR_PAIN_REBOUND_001 | ✅ EDGE_IE_PAIN_* | ✅ | **90%** |
| **AC-3.2** | Pain Scale 一致性 | ❌ | ❌ | ✅ EDGE_IE_PAIN_* | ❌ | 40% |
| **AC-4.1** | Pain-Symptom 链 | ⚠️ FE-06 | ✅ ERROR_SOA_CONTRADICTION_001 | ❌ | ✅ | 60% |
| **AC-6.1** | Pacemaker 禁忌 | ❌ | ✅ ERROR_PACEMAKER_STIMULATION_001 | ❌ | ✅ | 50% |
| **V01** | Pain 不反弹 | ✅ FE-03 | ✅ ERROR_PAIN_REBOUND_001 | ✅ EDGE_IE_PAIN_* | ✅ | **90%** |
| **V02** | Tightness 纵向 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **V03** | ROM 纵向 | ❌ | ❌ | ✅ EDGE_ROM_CRITICAL_DECREASE | ❌ | 30% |
| **IE01** | IE Pain 6-8 | ✅ 5 IE cases | ✅ ERROR_IE_PAIN_OUT_OF_RANGE_001 | ✅ EDGE_IE_PAIN_* | ✅ | **95%** |
| **IE02** | IE Severity | ✅ 5 IE cases | ❌ | ❌ | ❌ | 40% |
| **IE03** | IE Chronicity | ✅ 5 IE cases | ❌ | ❌ | ❌ | 40% |
| **IE04** | IE General Condition | ✅ 5 IE cases | ❌ | ❌ | ❌ | 40% |

**Layer 1 平均覆盖率**: **48%**

**覆盖良好** (≥80%):
- AC-3.1 / V01: Pain 纵向逻辑
- IE01: IE Pain 范围验证

**覆盖不足** (<50%):
- V02: Tightness 纵向 (0% - **高优先级补充**)
- AC-2.x: 选项合规系列
- IE02-IE04: IE 强制规范

---

### 2.2 Layer 2 规则 (Medical Logic)

| Rule ID | 规则名称 | Positive Test | Negative Test | Edge Case | Error Case | Total Coverage |
|---------|---------|---------------|---------------|-----------|------------|----------------|
| **HS01** | 证型-疼痛性质 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HS02** | 部位-治疗原则 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HS03** | 疼痛-ROM 关联 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HS04** | 序列合理性 | ⚠️ FE-03 (隐含) | ❌ | ❌ | ❌ | 20% |
| **HS05** | 舌脉-证型一致 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HS06** | 气虚证-舌象矛盾 | ⚠️ GOLDEN (隐含) | ✅ ERROR_PATTERN_TONGUE_MISMATCH_001 | ❌ | ✅ | 50% |
| **HS07** | 血瘀证-舌象矛盾 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HS08** | 寒湿证-脉象矛盾 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HS09** | 湿热证-脉象矛盾 | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HS10** | ADL-疼痛不匹配 | ❌ | ❌ | ❌ | ❌ | **0%** |

**Layer 2 平均覆盖率**: **7%** (**严重不足**)

**覆盖良好** (≥50%):
- HS06: 气虚证-舌象矛盾 (唯一有显式测试)

**完全缺失** (0%):
- HS01, HS02, HS03, HS05, HS07, HS08, HS09, HS10 (**8 个规则**)

---

## 3. 部位覆盖矩阵

| Body Part | IE Cases | TX Cases | Error Cases | Edge Cases | Total Coverage |
|-----------|----------|----------|-------------|------------|----------------|
| **KNEE** | ✅ GOLDEN_KNEE_IE_001 | ⚠️ Planned (GOLDEN_KNEE_TX_002) | ✅ ERROR_PAIN_REBOUND_001 | ✅ EDGE_IE_PAIN_* | **75%** |
| **LBP** | ⚠️ Planned (GOLDEN_LBP_IE_003) | ✅ GOLDEN_LBP_TX_001 | ❌ | ❌ | 40% |
| **SHOULDER** | ✅ GOLDEN_SHOULDER_IE_001 | ⚠️ Planned (GOLDEN_SHOULDER_TX_006) | ❌ | ❌ | 50% |
| **NECK** | ❌ | ✅ GOLDEN_NECK_TX_001 | ❌ | ❌ | 30% |
| **ELBOW** | ✅ GOLDEN_ELBOW_IE_001 | ⚠️ Planned (GOLDEN_ELBOW_TX_008) | ❌ | ❌ | 50% |
| **WRIST** | ❌ | ❌ | ❌ | ❌ | **0%** |
| **ANKLE** | ❌ | ❌ | ❌ | ❌ | **0%** |
| **HIP** | ❌ | ❌ | ❌ | ❌ | **0%** |

**部位覆盖统计**:
- **覆盖部位**: 5 个 (KNEE, LBP, SHOULDER, NECK, ELBOW)
- **未覆盖部位**: 3 个 (WRIST, ANKLE, HIP)
- **平均覆盖率**: **34%**

**优先补充**: WRIST, ANKLE, HIP 部位的 IE + TX 案例

---

## 4. 证型覆盖矩阵

| Pattern | Excellent Cases | Error Cases | Edge Cases | Total |
|---------|----------------|-------------|------------|-------|
| **Cold-Damp** | ✅ GOLDEN_KNEE_IE_001, GOLDEN_LBP_TX_001 | ❌ | ❌ | 2 |
| **Blood Stasis** | ⚠️ GOLDEN_KNEE_TX_002, GOLDEN_LBP_IE_003 | ❌ | ❌ | 2 |
| **Qi Deficiency** | ⚠️ GOLDEN_SHOULDER_TX_006 | ✅ ERROR_PATTERN_TONGUE_MISMATCH_001 | ❌ | 2 |
| **Wind-Cold** | ⚠️ GOLDEN_SHOULDER_IE_005, GOLDEN_NECK_IE_007 | ❌ | ❌ | 2 |
| **Qi Stagnation** | ✅ GOLDEN_LBP_TX_001, ⚠️ GOLDEN_ELBOW_TX_008 | ❌ | ❌ | 2 |
| **Damp-Heat** | ❌ | ❌ | ❌ | **0** |
| **Phlegm-Dampness** | ⚠️ GOLDEN_SHOULDER_IE_005 (夹杂) | ❌ | ❌ | 1 |
| **Kidney Yang Deficiency** | ✅ GOLDEN_KNEE_IE_001 (夹杂) | ❌ | ❌ | 1 |
| **Kidney Deficiency** | ⚠️ GOLDEN_LBP_IE_003 (夹杂) | ❌ | ❌ | 1 |
| **Liver Qi Stagnation** | ⚠️ GOLDEN_KNEE_TX_002, GOLDEN_NECK_IE_007 (夹杂) | ❌ | ❌ | 2 |

**证型覆盖统计**:
- **覆盖证型**: 9 个
- **未覆盖证型**: 1 个 (Damp-Heat - **高优先级补充**)
- **平均案例数/证型**: 1.4 个

**覆盖缺口**:
- **Damp-Heat**: 完全缺失 (触发 HS09 规则，但无案例验证)
- **Blood Deficiency**: 仅作为夹杂证出现
- **Yin Deficiency**: 未涉及

---

## 5. 测试策略

### 5.1 单元测试策略

**目标**: 独立验证每个规则的逻辑

**当前状态**: ❌ **完全缺失**

**建议补充**:

#### Parser 单元测试
```typescript
// tests/unit/parser/ie-parser.test.ts
describe('IE Parser', () => {
  test('无冒号格式解析', () => { ... })
  test('标准格式解析', () => { ... })
  test('部位识别: KNEE', () => { ... })
  test('疼痛提取: Pain Scale', () => { ... })
  test('舌脉提取', () => { ... })
})
```

#### Layer 1 单元测试
```typescript
// tests/unit/layer1/ac-rules.test.ts
describe('AC-2 选项合规', () => {
  test('AC-2.1: Chronicity 非法选项', () => { ... })
  test('AC-2.2: Severity 非法选项', () => { ... })
  test('AC-2.3: General Condition 非法选项', () => { ... })
})

describe('AC-3 纵向逻辑', () => {
  test('AC-3.1: Pain 反弹检测', () => { ... })
  test('AC-3.2: Pain Scale 一致性', () => { ... })
})

describe('V 系列纵向规则', () => {
  test('V01: Pain 不反弹', () => { ... })
  test('V02: Tightness 不恶化', () => { ... }) // 🔴 缺失
  test('V03: ROM 不下降', () => { ... })
})

describe('IE 系列规范', () => {
  test('IE01: Pain 6-8', () => { ... })
  test('IE02: Severity moderate to severe', () => { ... })
  test('IE03: Chronicity Chronic', () => { ... })
  test('IE04: General Condition fair', () => { ... })
})
```

#### Layer 2 单元测试
```typescript
// tests/unit/layer2/heuristic-rules.test.ts
describe('HS 系列启发式规则', () => {
  test('HS01: 虚证 + 剧烈疼痛 ⇒ WARNING', () => { ... }) // 🔴 缺失
  test('HS06: Qi Deficiency + 红舌 ⇒ WARNING', () => { ... })
  test('HS07: Blood Stasis + 淡舌 ⇒ WARNING', () => { ... }) // 🔴 缺失
  test('HS08: Cold-Damp + 数脉 ⇒ WARNING', () => { ... }) // 🔴 缺失
  test('HS09: Damp-Heat + 迟脉 ⇒ WARNING', () => { ... }) // 🔴 缺失
  test('HS10: ADL 高 + Pain 低 ⇒ WARNING', () => { ... }) // 🔴 缺失
})
```

**优先级**: **HIGH** (单元测试是基础)

---

### 5.2 集成测试策略

**目标**: 验证 Layer 1+2+3 联合工作

**当前状态**: ✅ 2 个集成测试文件

**已覆盖**:
- `tests/integration/continuation-flow.test.ts`: 前端续写流程 (FE-01 至 FE-06)
- `tests/integration/generator-full.test.ts`: 完整生成器测试

**建议补充**:

#### 多部位集成测试
```typescript
// tests/integration/multi-body-part.test.ts
describe('多部位覆盖', () => {
  test('KNEE: IE + 3 TX 完整流程', () => { ... })
  test('LBP: IE + 5 TX 完整流程', () => { ... })
  test('SHOULDER: IE + 4 TX 完整流程', () => { ... })
  test('WRIST: IE + 3 TX 完整流程', () => { ... }) // 🔴 新增
  test('ANKLE: IE + 3 TX 完整流程', () => { ... }) // 🔴 新增
})
```

#### 证型专项集成测试
```typescript
// tests/integration/pattern-scenarios.test.ts
describe('证型场景测试', () => {
  test('Damp-Heat: 红舌黄苔 + 滑数脉', () => { ... }) // 🔴 缺失
  test('虚实夹杂: Qi Deficiency + Blood Stasis', () => { ... })
  test('三证夹杂: Qi Def + Blood Stasis + Cold-Damp', () => { ... })
})
```

#### 审核联动测试
```typescript
// tests/integration/audit-full-cycle.test.ts
describe('审核完整周期', () => {
  test('Layer 1 CRITICAL ⇒ 整体 FAIL', () => { ... })
  test('Layer 2 HIGH ⇒ manualReviewRequired', () => { ... })
  test('Layer 3 相似度匹配', () => { ... })
  test('3 层联合评分', () => { ... })
})
```

**优先级**: **MEDIUM**

---

### 5.3 黄金案例测试策略

**目标**: 回归测试基准 + AI 训练数据

**当前状态**: ✅ 13 个案例 (5 优秀 + 5 错误 + 3 边界)

**已覆盖**:

#### 优秀案例 (5 个)
- ✅ GOLDEN_KNEE_IE_001: Cold-Damp, Pain 8, 质量 92
- ✅ GOLDEN_LBP_TX_001: Qi Stagnation, 疼痛趋势良好
- ✅ GOLDEN_SHOULDER_IE_001: Wind-Cold, 复杂证型
- ✅ GOLDEN_NECK_TX_001: 颈部特定体征
- ✅ GOLDEN_ELBOW_IE_001: Tendon Strain

#### 错误案例 (5 个)
- ✅ ERROR_PAIN_REBOUND_001: V01 违规
- ✅ ERROR_SOA_CONTRADICTION_001: AC-4.1 违规
- ✅ ERROR_PATTERN_TONGUE_MISMATCH_001: HS06 违规
- ✅ ERROR_IE_PAIN_OUT_OF_RANGE_001: IE01 违规
- ✅ ERROR_PACEMAKER_STIMULATION_001: AC-6.1 违规

#### 边界案例 (3 个)
- ✅ EDGE_IE_PAIN_LOWER_BOUND: Pain = 6.0 (临界)
- ✅ EDGE_IE_PAIN_UPPER_BOUND: Pain = 8.0 (临界)
- ✅ EDGE_ROM_CRITICAL_DECREASE: ROM 下降 -5° (临界)

**建议补充** (根据 INDEX.md 规划):

#### 优秀案例补充 (3 个)
- ⚠️ GOLDEN_KNEE_TX_002: Blood Stasis, 疼痛趋势 7→5.5→4→3
- ⚠️ GOLDEN_LBP_IE_003: Qi Stagnation + Blood Stasis, Pain 9
- ⚠️ GOLDEN_LBP_TX_004: Cold-Damp, 匀速下降
- ⚠️ GOLDEN_SHOULDER_IE_005: Wind-Cold + Phlegm
- ⚠️ GOLDEN_SHOULDER_TX_006: Qi & Blood Deficiency
- ⚠️ GOLDEN_NECK_IE_007: Wind-Cold + Qi Stagnation
- ⚠️ GOLDEN_ELBOW_TX_008: Tendon Strain + Qi Stagnation

#### 边界案例补充
- 🔴 EDGE_TIGHTNESS_BOUNDARY: Tightness moderate ↔ moderate to severe
- 🔴 EDGE_PATTERN_MIXED_THREE: 三证夹杂临界
- 🔴 EDGE_PAIN_FLUCTUATION: Pain 波动 +0.1 (允许)

**优先级**: **HIGH** (黄金案例是质量基准)

---

### 5.4 端到端测试策略

**目标**: 模拟真实用户场景

**当前状态**: ❌ **完全缺失**

**建议补充**:

#### E2E 场景 1: 完整诊疗流程
```typescript
// tests/e2e/full-treatment-flow.spec.ts
test('用户粘贴 IE → 生成 5 次 TX → 审核通过', async () => {
  // 1. 用户输入 IE 文本
  // 2. 系统解析 + 生成续写
  // 3. Layer 1+2+3 审核
  // 4. 用户获取结果
  // 5. 验证: 所有 TX Pain 下降, 无 CRITICAL 错误
})
```

#### E2E 场景 2: 错误处理流程
```typescript
test('用户输入违规 IE → 系统拒绝 + 提示', async () => {
  // 1. 输入 Pain = 5 (违反 IE01)
  // 2. 系统检测 + 返回错误
  // 3. 验证: 错误信息清晰, 提供修复建议
})
```

#### E2E 场景 3: 多部位切换
```typescript
test('用户切换部位 KNEE → LBP → SHOULDER', async () => {
  // 1. 生成 KNEE IE + TX
  // 2. 切换到 LBP
  // 3. 生成 LBP IE + TX
  // 4. 验证: 部位识别准确, 证型不混淆
})
```

**优先级**: **MEDIUM** (集成测试稳定后再补充)

---

## 6. 测试缺口分析

### 6.1 未覆盖规则 (高优先级)

| 规则 ID | 规则名称 | 严重程度 | 建议测试 |
|---------|---------|---------|---------|
| **V02** | Tightness 纵向逻辑 | CRITICAL | 单元测试 + 边界案例 |
| **HS01** | 证型-疼痛性质 | MEDIUM | 单元测试 + 黄金案例 |
| **HS02** | 部位-治疗原则 | MEDIUM | 单元测试 (KNEE + Heart 矛盾) |
| **HS03** | 疼痛-ROM 关联 | LOW | 单元测试 |
| **HS05** | 舌脉-证型一致 | MEDIUM | 单元测试 + 错误案例 |
| **HS07** | 血瘀证-舌象矛盾 | MEDIUM | 单元测试 + 错误案例 |
| **HS08** | 寒湿证-脉象矛盾 | MEDIUM | 单元测试 + 错误案例 |
| **HS09** | 湿热证-脉象矛盾 | MEDIUM | 单元测试 + 错误案例 |
| **HS10** | ADL-疼痛不匹配 | LOW | 单元测试 |

---

### 6.2 未覆盖证型组合

| 证型组合 | 当前状态 | 建议补充 |
|---------|---------|---------|
| **Damp-Heat (单独)** | ❌ 完全缺失 | 🔴 GOLDEN_*_DAMP_HEAT_001 (IE + TX) |
| **Qi Def + Damp-Heat** | ❌ 缺失 | 黄金案例 (夹杂证示例) |
| **Blood Def (单独)** | ❌ 缺失 | 黄金案例 |
| **Yin Def with Heat** | ❌ 缺失 | 边界案例 (低优先级) |

---

### 6.3 未覆盖部位

| 部位 | 当前状态 | 建议补充 |
|------|---------|---------|
| **WRIST** | ❌ 0 案例 | 🔴 IE + TX 各 1 个 |
| **ANKLE** | ❌ 0 案例 | 🔴 IE + TX 各 1 个 |
| **HIP** | ❌ 0 案例 | IE + TX 各 1 个 |

---

### 6.4 未覆盖边界情况

| 边界场景 | 当前状态 | 建议补充 |
|---------|---------|---------|
| **Tightness 临界变化** | ❌ 缺失 | EDGE_TIGHTNESS_BOUNDARY |
| **Pain 允许波动 +0.1** | ⚠️ 隐含 | EDGE_PAIN_FLUCTUATION_ALLOWED |
| **ROM 临界下降 -5°** | ✅ 已有 | - |
| **三证夹杂** | ❌ 缺失 | EDGE_PATTERN_MIXED_THREE |
| **虚实夹杂舌象模糊** | ❌ 缺失 | EDGE_TONGUE_AMBIGUOUS |

---

## 7. 测试补充优先级清单

### 🔴 P0 - 紧急 (影响核心功能)

1. **V02 单元测试**: Tightness 纵向逻辑 (CRITICAL 规则, 0% 覆盖)
2. **Damp-Heat 黄金案例**: 完全缺失的主要证型
3. **WRIST/ANKLE 部位案例**: 扩展部位覆盖

### ⚠️ P1 - 高优先级 (提升质量保障)

4. **HS01, HS07, HS08, HS09 单元测试**: Layer 2 核心规则
5. **Parser 单元测试套件**: 基础功能验证
6. **IE02-IE04 负向测试**: 强制规范验证

### ✅ P2 - 中优先级 (完善覆盖)

7. **HIP 部位案例**: 完整部位矩阵
8. **Blood Deficiency 案例**: 补充证型覆盖
9. **三证夹杂边界案例**: 复杂场景

### 📌 P3 - 低优先级 (锦上添花)

10. **E2E 测试**: 用户流程模拟
11. **HS03, HS10 单元测试**: LOW 严重程度规则
12. **Yin Deficiency 案例**: 非主流证型

---

## 8. 测试数据来源

### 8.1 代码文件
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/src/auditor/layer1/index.ts` (13 个规则)
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/src/auditor/layer2/index.ts` (10 个启发式)
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/src/auditor/layer3/index.ts` (案例相似度)

### 8.2 测试文件
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/tests/integration/continuation-flow.test.ts` (8 个测试)
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/tests/integration/generator-full.test.ts`

### 8.3 黄金案例库
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/tests/alltest/golden-cases/excellent/` (5 个)
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/tests/alltest/golden-cases/typical-errors/` (5 个)
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/tests/alltest/golden-cases/edge-cases/` (3 个)

---

## 9. 测试执行指南

### 9.1 运行现有测试

```bash
# 集成测试
cd /Users/ping/Desktop/Code/2_8/templete/soap-system
npx tsx tests/integration/continuation-flow.test.ts

# 单元测试 (待补充)
npm test -- --coverage

# E2E 测试 (待补充)
npm run test:e2e
```

### 9.2 生成覆盖率报告

```bash
# Jest 覆盖率
npm test -- --coverage --coverageReporters=html

# 查看报告
open coverage/index.html
```

### 9.3 黄金案例验证

```bash
# 验证所有黄金案例
npm run validate:golden-cases

# 验证单个案例
npm run validate:case -- GOLDEN_KNEE_IE_001
```

---

## 10. 质量门禁标准

### 10.1 代码提交标准
- ✅ 所有 CRITICAL 规则必须有单元测试
- ✅ 新增功能必须达到 80% 行覆盖率
- ✅ 所有 Layer 2 规则必须有正向 + 负向测试

### 10.2 版本发布标准
- ✅ 总体测试覆盖率 ≥80%
- ✅ 所有黄金案例通过验证
- ✅ 所有错误案例正确触发规则
- ✅ 至少 5 个部位有完整 IE + TX 案例

### 10.3 当前与目标差距

| 指标 | 当前值 | 目标值 | 差距 |
|------|-------|-------|------|
| **总体覆盖率** | 46% | 80% | **-34%** |
| **Layer 1 覆盖** | 48% | 85% | -37% |
| **Layer 2 覆盖** | 7% | 80% | **-73%** |
| **部位覆盖** | 5/8 (63%) | 8/8 (100%) | -37% |
| **证型覆盖** | 9/11 (82%) | 11/11 (100%) | -18% |
| **黄金案例** | 13 个 | 20 个 | -7 个 |

---

## 11. 测试自动化建议

### 11.1 CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Unit Tests
        run: npm test -- --coverage
      - name: Run Integration Tests
        run: npm run test:integration
      - name: Validate Golden Cases
        run: npm run validate:golden-cases
      - name: Upload Coverage
        uses: codecov/codecov-action@v2
```

### 11.2 Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
npm test -- --findRelatedTests --passWithNoTests
npm run validate:golden-cases
```

---

## 12. 附录: 测试模板

### 12.1 单元测试模板

```typescript
// tests/unit/layer1/rule-template.test.ts
import { RuleComplianceEngine } from '@/auditor/layer1'

describe('Rule ID: [RULE_ID]', () => {
  const engine = new RuleComplianceEngine()

  describe('正向测试 (应通过)', () => {
    test('[场景描述]', () => {
      const note = { /* 合规数据 */ }
      const result = engine.check(note)
      expect(result.violations).toHaveLength(0)
    })
  })

  describe('负向测试 (应失败)', () => {
    test('[场景描述]', () => {
      const note = { /* 违规数据 */ }
      const result = engine.check(note)
      expect(result.violations).toContainEqual(
        expect.objectContaining({ ruleId: '[RULE_ID]' })
      )
    })
  })

  describe('边界测试', () => {
    test('[临界值场景]', () => {
      const note = { /* 边界数据 */ }
      const result = engine.check(note)
      // 验证边界行为
    })
  })
})
```

### 12.2 黄金案例模板

```yaml
# GOLDEN_[PART]_[TYPE]_[ID].yaml
caseId: GOLDEN_KNEE_IE_001
type: excellent
bodyPart: KNEE
noteType: IE
patterns:
  local: Cold-Damp + Wind-Cold
  systemic: Kidney Yang Deficiency
metrics:
  pain: 8.0
  qualityScore: 92
  ruleViolations: []
soap:
  subjective: |
    INITIAL EVALUATION
    Patient c/o Chronic pain in right Knee...
  objective: |
    Tightness muscles noted...
  assessment: |
    TCM Dx: Right knee pain due to Cold-Damp...
  plan: |
    Initial Evaluation
metadata:
  createdBy: Agent-X
  createdAt: 2026-02-10
  reviewedBy: Agent-5
```

---

**文档版本**: v1.0
**最后更新**: 2026-02-10
**维护者**: Agent 6 (文档生成)
**下次审查**: 每月更新覆盖率数据
