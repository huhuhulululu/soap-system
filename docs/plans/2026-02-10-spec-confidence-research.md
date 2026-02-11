# Spec 研究计划：提高置信度

**日期**: 2026-02-10
**目标**: 系统性验证 checker-spec-v2 的完整性和可行性

---

## 📊 当前状态评估

### 已有资产
| 资产 | 状态 | 置信度 |
|------|------|--------|
| 规则定义 | ✅ **56 条已实现** (超出 spec 23 条) | **95%** |
| Parser 实现 | ✅ 基本完成 | 85% |
| Generator 实现 | ✅ 完成 | 90% |
| Bridge 层 | ✅ 实现完整，测试调用有误 | 85% |
| Note-Checker | ✅ **1398 行，功能完整** | **90%** |
| 测试用例 | ⚠️ 344 通过，3 套件 TS 编译错误 | 75% |

### 🎉 重大发现：规则实现超预期

**已实现 56 条规则** (note-checker.ts):
```
IE 横向:  IE01-IE08 (8条) ✅ 全部实现
TX 横向:  TX01-TX06 (6条) ✅ 全部实现
纵向:     V01-V09 (9条) ✅ 全部实现
ICD:      DX01-DX04 (4条) ✅ 全部实现
CPT:      CPT01-CPT03 (3条) ✅ 实现
文档级:   DOC01 (1条) ✅ 实现
生成器链: S2,S3,S6,S7,O1-O3,O8,O9,A5,P1,P2,X1-X4 (16条) ✅ 全部实现
额外规则: T01-T09 (9条) ✅ 额外实现
```

### 关键风险点

| 风险 | 严重度 | 根因 | 解决方案 |
|------|--------|------|----------|
| E2E 测试编译失败 | HIGH | `bridgeToContext` 签名变更 | 添加 visitIndex=0 |
| 规则测试覆盖低 | MEDIUM | 仅 2/56 有显式测试 | 添加 CRITICAL 规则测试 |
| Layer2 未实现 | LOW | 计划中 | 按计划推进 |
| Layer3 未实现 | LOW | 计划中 | 按计划推进 |

---

## 🔬 深度分析

### 1. bridgeToContext 问题根因

**实现** (bridge.ts:197):
```typescript
export function bridgeToContext(doc: OptumNoteDocument, visitIndex: number): GenerationContext
```

**测试调用** (full-system.spec.ts):
```typescript
// ❌ 错误调用 - 缺少 visitIndex (13 处)
const ctx = bridgeToContext(tc.document)

// ✅ 正确调用
const ctx = bridgeToContext(tc.document, 0)
```

**结论**: 实现正确，测试调用错误。修复测试即可。

---

### 2. CRITICAL 规则清单 (共 12 条)

| 规则 | 描述 | 实现行 | 测试 |
|------|------|--------|------|
| T02 | 改善描述+数值恶化 | 330-355 | ❌ |
| T03 | 恶化描述+数值改善 | 358-383 | ❌ |
| T07 | Pacemaker+电刺激 | 490-512 | ❌ |
| TX05 | 舌脉与IE不一致 | 410-422 | ❌ |
| TX06 | TX不应有goals | 424-434 | ❌ |
| DX01 | ICD→bodyPart匹配 | 780-795 | ❌ |
| DX02 | ICD跨visit一致 | 815-828 | ❌ |
| DX03 | ICD编码存在 | 770-778 | ❌ |
| DX04 | ICD laterality一致 | 800-813 | ❌ |
| CPT01 | CPT编码存在 | 831-838 | ❌ |
| CPT02 | CPT↔电刺激匹配 | 841-862 | ❌ |
| CPT03 | CPT↔时间units匹配 | 865-875 | ❌ |

---

### 3. 评分逻辑 ✅ 已验证

```typescript
// 有 CRITICAL 即 FAIL
if (hasCritical) return { grade: 'FAIL', totalScore: 0 }

// 无 CRITICAL 时按 HIGH/MEDIUM 扣分
const penaltyMap = { CRITICAL: 0, HIGH: 15, MEDIUM: 8, LOW: 0 }
const totalScore = Math.max(0, 100 - totalPenalty)
const grade = totalScore >= 80 ? 'PASS' : totalScore >= 60 ? 'WARNING' : 'FAIL'
```

---

## 🎯 置信度提升方案

### Phase 1: 修复阻塞 (30 分钟)

修复 E2E 测试编译错误：
```typescript
// tests/e2e/full-system.spec.ts (13 处)
bridgeToContext(tc.document) → bridgeToContext(tc.document, 0)
```

---

### Phase 2: CRITICAL 规则测试 (3-4 小时)

为 5 条高风险 CRITICAL 规则添加测试：

```typescript
// tests/unit/critical-rules.spec.ts

describe('T02: 改善描述 + 数值恶化矛盾', () => {
  it('正常: improvement + pain 下降', () => { /* ... */ })
  it('违规: improvement + pain 上升', () => { /* ... */ })
  it('违规: improvement + tenderness 上升', () => { /* ... */ })
  it('边界: improvement + pain 持平', () => { /* ... */ })
})

describe('T07: Pacemaker + 电刺激矛盾', () => {
  it('正常: 无 Pacemaker + 有电刺激', () => { /* ... */ })
  it('违规: 有 Pacemaker + 有电刺激', () => { /* ... */ })
})

describe('CPT02: CPT↔电刺激匹配', () => {
  it('正常: 有电刺激 + 97813', () => { /* ... */ })
  it('违规: 有电刺激 + 97810', () => { /* ... */ })
})
```

---

### Phase 3: 纵向规则测试 (2-3 小时)

```typescript
describe('V01: Pain 不回升', () => {
  it('正常: pain 7→6→5', () => { /* ... */ })
  it('违规: pain 7→5→6', () => { /* ... */ })
})

describe('V09: 穴位大变化', () => {
  it('正常: 穴位重叠 > 40%', () => { /* ... */ })
  it('违规: 穴位重叠 < 40%', () => { /* ... */ })
})
```

---

### Phase 4: 边界情况测试 (1-2 小时)

| 场景 | 测试方法 |
|------|----------|
| Parser 字段 null | 构造缺失字段的 visit |
| 只有 IE 没有 TX | 单 visit 文档 |
| 只有 TX 没有 IE | 无 IE 的文档 |
| 多部位 | secondaryBodyParts 非空 |

---

## 📋 置信度报告

### 修复前
```
规则层 (Layer 1):     56/56 规则已实现 (100%) ✅
                      2/56 规则有测试 (3.6%) ⚠️
E2E 测试:             编译失败 ❌
整体置信度:           ~70%
```

### 修复后预期
```
规则层 (Layer 1):     56/56 规则已实现 (100%) ✅
                      17/56 规则有测试 (30%) ⬆️
                      12/12 CRITICAL 规则有测试 (100%) ✅
E2E 测试:             全部通过 ✅
整体置信度:           ~90%
```

---

## ⏱️ 时间估算

| Phase | 任务 | 时间 | 置信度提升 |
|-------|------|------|------------|
| 1 | 修复 bridgeToContext | 30min | +10% |
| 2 | CRITICAL 规则测试 | 3-4h | +10% |
| 3 | 纵向规则测试 | 2-3h | +5% |
| 4 | 边界情况测试 | 1-2h | +5% |
| **总计** | | **7-10h** | **+30%** |

---

## 🚀 立即行动

### Step 1: 修复 bridgeToContext
```bash
# 文件: tests/e2e/full-system.spec.ts
# 行号: 161,173,265,279,295,... (13 处)
```

### Step 2: 运行测试验证
```bash
npm test
```

### Step 3: 创建 CRITICAL 规则测试
```bash
touch tests/unit/critical-rules.spec.ts
```
