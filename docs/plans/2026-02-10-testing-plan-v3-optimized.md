# SOAP System 测试计划 v3 (高置信度优化版)

**版本**: v3.0
**日期**: 2026-02-10
**置信度**: 92%

---

## 📊 现状基线

| 资产 | 数量 | 状态 |
|------|------|------|
| 现有测试用例 | 344 | ✅ 通过 |
| 测试文件 | 28 | 运行中 |
| 真实 PDF | 29 | 待解析验证 |
| 已实现规则 | ~56 | 代码中已有 |
| 续写测试 | 105 用例 | 100% 通过 |

---

## 🎯 审核基准 (三层)

### 基准 1: soap-generator.ts 输出格式

**文件**: `src/generator/soap-generator.ts`

生成器定义了 SOAP 文本的**精确格式**，包括：
- 静态文本（固定措辞）
- 动态插值（`${context.xxx}`）
- 条件分支（`if/else`）

```typescript
// 示例：Subjective 段落格式
`Patient c/o ${chronicityLevel} pain ${lateralityText} ${bodyPartText} area which is ${painTypes.join(', ')} ${radiationText}.`
```

**审核点**：生成文本必须严格匹配 generator 定义的格式

---

### 基准 2: Template 动态/静态字段

**文件**: `tests/alltest/ie/*.md`, `tests/alltest/tx/*.md`

| 字段类型 | 说明 | 示例 |
|----------|------|------|
| **静态文本** | 固定不变 | `"Patient c/o"`, `"which is"` |
| **动态单选** | `ppnSelectComboSingle` | `Acute\|Sub Acute\|Chronic` |
| **动态多选** | `ppnSelectCombo` | `Dull\|Burning\|Freezing\|...` |

**动态字段清单**：

| 字段 | 类型 | 合法值 |
|------|------|--------|
| chronicityLevel | 单选 | Acute, Sub Acute, Chronic |
| laterality | 单选 | along right, along left, along bilateral, in left, in right, in bilateral |
| severityLevel | 单选 | severe, moderate to severe, moderate, mild to moderate, mild |
| painScale | 单选 | 10, 10-9, 9, 9-8, 8, ... 0 |
| painTypes | 多选 | Dull, Burning, Freezing, Shooting, Tingling, Stabbing, Aching, ... |
| localPattern | 多选 | Qi Stagnation, Blood Stasis, Cold-Damp + Wind-Cold, ... |
| systemicPattern | 多选 | Kidney Yang Deficiency, Kidney Yin Deficiency, ... |
| tightnessGrading | 单选 | severe, moderate to severe, moderate, mild to moderate, mild |
| tendernessScale | 单选 | (+4), (+3), (+2), (+1), (0) |
| spasmScale | 单选 | (+4), (+3), (+2), (+1), (0) |
| generalCondition | 单选 | good, fair, poor |
| symptomChange | 单选 | improvement, slight improvement, no change, exacerbate |

**审核点**：动态字段值必须在模板定义的选项列表中

---

### 基准 3: 引擎逻辑约束

**文件**: `src/generator/tx-sequence-engine.ts`

引擎定义了**数值变化的逻辑规则**：

| 规则 | 约束 | 来源 |
|------|------|------|
| Pain 趋势 | TX(n+1).pain ≤ TX(n).pain (整体下降) | `generateTXSequenceStates()` |
| Pain 首次降幅 | TX1.pain = IE.pain - [0.5, 1.5] | `tx1Decrease` 参数 |
| Tightness 趋势 | 随 pain 同向变化 | `tightnessFromPain()` |
| ROM 趋势 | 随治疗逐步改善 | `romProgression()` |
| Tenderness 趋势 | 整体下降，允许波动 | `tendernessProgression()` |
| S-O-A 链一致性 | pain↓ → tightness↓ → "improvement" | `soaChainConsistency()` |

**关键逻辑**：
```typescript
// Pain 不能反弹
if (currentPain > previousPain + 0.1) → ERROR

// S-O-A 链一致性
if (painTrend === 'improved' && symptomChange === 'exacerbate') → ERROR

// Objective 变化必须反映在 Assessment
if (tightness↓ && physicalChange !== 'reduced') → WARNING
```

**审核点**：数值序列必须符合引擎定义的变化逻辑

---

## 🎯 优化后目标

### Phase 1: 巩固现有 (2 周)
- 修复 3 个失败的测试套件
- 29 PDF 端到端解析验证
- 规则覆盖率报告

### Phase 2: 扩展验证 (3 周)
- 核心规则深度测试 (CRITICAL + HIGH)
- 集成测试补全
- 案例库初建 (30 个)

### Phase 3: 审核系统 (3 周)
- 三层架构实现
- 医学逻辑规则
- 看板系统

**总周期**: 8 周 (vs 原计划 6 周)

---

## 📈 测试用例目标 (优化后)

| 类别 | 原计划 | 优化后 | 理由 |
|------|--------|--------|------|
| 规则测试 | 864 (48×18) | **336** (56×6) | 6 用例/规则足够覆盖核心场景 |
| 工作流测试 | 150 | **80** | 聚焦 IE→TX 主流程 |
| PDF E2E | 229 | **29** | 先确保真实 PDF 100% 通过 |
| 集成测试 | 458 | **120** | 聚焦三层集成 |
| 案例库测试 | 210 | **60** | 30 案例 × 2 测试 |
| **总计** | **1833** | **625** | 降低 66%，提高可行性 |

---

## 🗓️ 8 周详细计划

### Phase 1: 巩固现有 (Week 1-2)

#### Week 1: 基准提取 + 测试修复

**Day 1-2: 提取三层基准 (12h)**

任务 1: 从 `soap-generator.ts` 提取格式规范
```typescript
// scripts/extract-generator-format.ts
// 提取静态文本 + 动态插值位置
```

任务 2: 从模板提取动态字段选项
```typescript
// scripts/extract-template-options.ts
// 解析 ppnSelectCombo* 生成选项清单
```

任务 3: 从引擎提取逻辑约束
```typescript
// scripts/extract-engine-rules.ts
// 提取 pain/tightness/rom 变化规则
```

交付物:
- [ ] `src/auditor/baselines/generator-format.json`
- [ ] `src/auditor/baselines/template-options.json`
- [ ] `src/auditor/baselines/engine-rules.json`

**Day 3-4: 修复失败测试 (8h)**
```bash
# 当前失败:
# - goals-calculator.test.ts (vitest/jest 混用)
# - optum-parser.spec.ts (@jest/globals 导入错误)
# - 类型错误 ('Bilateral' vs 'bilateral')
```

任务:
- [ ] 统一测试框架为 Jest
- [ ] 修复类型错误 (laterality 大小写)
- [ ] 确保 344 + 修复后测试全部通过

**Day 3-4: PDF 解析验证 (10h)**
- [ ] 29 PDF 逐个解析测试
- [ ] 记录解析失败的 PDF 和原因
- [ ] 修复 PDF 规范化问题

**Day 5: 规则覆盖率报告 (4h)**
- [ ] 统计 56 条规则的测试覆盖
- [ ] 识别未覆盖规则
- [ ] 生成覆盖率报告

**交付物**:
- ✅ 所有现有测试通过
- ✅ 29 PDF 解析状态报告
- ✅ 规则覆盖率基线

---

#### Week 2: 续写测试固化 + 文档

**Day 6-7: 续写测试集成 (6h)**
- [ ] 将 `stress-continuation-v2.ts` 集成到 Jest
- [ ] 105 用例转为正式测试
- [ ] CI 集成

**Day 8-9: 现有测试文档化 (8h)**
- [ ] 测试目录 README
- [ ] 测试命名规范
- [ ] 运行指南

**Day 10: Phase 1 验收 (4h)**
- [ ] 全量测试运行
- [ ] 覆盖率报告
- [ ] Phase 2 计划确认

**Phase 1 交付物**:
- ✅ 测试通过率 100%
- ✅ 29 PDF 解析验证完成
- ✅ 规则覆盖率报告
- ✅ 测试文档

---

### Phase 2: 扩展验证 (Week 3-5)

#### Week 3: CRITICAL 规则深度测试

**目标**: 9 条 CRITICAL 规则 × 6 用例 = 54 用例

CRITICAL 规则清单:
1. `X4` - Pacemaker + 电刺激禁忌
2. `TX02` - 疼痛趋势与描述一致性
3. `TX03` - 恶化描述 + 数值改善矛盾
4. `CPT02` - CPT 与电刺激匹配
5. `IE01` - 疼痛-ADL 一致性
6. `IE02` - 初诊必填字段
7. `V01` - 纵向 laterality 一致
8. `V02` - 纵向 bodyPart 一致
9. `DX01` - ICD 与部位匹配

**6 用例模板**:
```typescript
describe('规则 TX03', () => {
  it('正常: 改善描述 + 数值改善', () => {})
  it('正常: 恶化描述 + 数值恶化', () => {})
  it('违规: 改善描述 + 数值恶化', () => {})
  it('违规: 恶化描述 + 数值改善', () => {})
  it('边界: 数值不变 + 改善描述', () => {})
  it('异常: 数据缺失', () => {})
})
```

**交付物**: 54 个 CRITICAL 规则测试

---

#### Week 4: HIGH 规则 + 集成测试

**目标**: 
- 15 条 HIGH 规则 × 6 用例 = 90 用例
- 集成测试 40 用例

HIGH 规则 (部分):
- `V03-V09` - 纵向一致性
- `O2, O8, O9` - Objective 数据
- `DX02-DX04` - ICD 编码
- `S2, S3` - Subjective 逻辑

**集成测试重点**:
- Parser → Checker 流程
- Generator → Validator 循环
- IE → TX 序列验证

**交付物**: 130 用例

---

#### Week 5: 案例库初建

**目标**: 30 个黄金案例

| 类别 | 数量 | 来源 |
|------|------|------|
| 优秀案例 | 12 | 29 PDF 精选 |
| 典型错误 | 10 | 规则违规场景 |
| 边界案例 | 8 | 特殊情况 |

**案例标注简化模板**:
```yaml
id: CASE_001
type: excellent | error | edge
body_part: KNEE
note_type: IE | TX
source: PDF名称
quality_score: 85
key_violations: []  # 错误案例填写
notes: 简要说明
```

**交付物**:
- 30 个标注案例
- 案例库目录结构
- 案例检索基础实现

---

### Phase 3: 审核系统 (Week 6-8)

#### Week 6: 第一层规则引擎

**目标**: 规则引擎重构 + 统一输出

```typescript
// src/auditor/layer1/index.ts
export interface RuleResult {
  ruleId: string
  passed: boolean
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  violation?: {
    location: string
    issue: string
    suggestion: string
  }
}

export class RuleComplianceEngine {
  check(note: SOAPNote): RuleResult[]
}
```

**任务**:
- [ ] 统一 56 条规则输出格式
- [ ] 规则分类和优先级
- [ ] 批量检查 API

---

#### Week 7: 第二层医学逻辑

**目标**: 5 条核心启发式规则

```typescript
// src/auditor/layer2/heuristics.ts
export const heuristicRules = [
  {
    id: 'HS01',
    name: '证型-疼痛性质关联',
    check: (note) => {
      // qi_deficiency + severe_pain > 7 → 疑点
    }
  },
  // HS02-HS05
]
```

**5 条规则**:
1. 证型-疼痛性质关联
2. 部位-治疗原则关联
3. 疼痛-ROM 关联
4. 序列合理性 (pain 趋势)
5. 舌脉-证型一致性

---

#### Week 8: 第三层 + 看板

**目标**: 案例相似度 + 审核看板

**案例相似度 (简化版)**:
```typescript
// 基于关键字段的加权匹配
function calculateSimilarity(note: SOAPNote, case: GoldenCase): number {
  const weights = {
    bodyPart: 0.2,
    tcmPattern: 0.3,
    painLevel: 0.2,
    noteType: 0.1,
    violations: 0.2
  }
  // 加权计算
}
```

**审核看板 (CLI 版)**:
```bash
$ npm run audit -- --file note.pdf

📊 SOAP 审核报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第一层: 规则合规  ✅ 54/56 通过 (96.4%)
第二层: 医学逻辑  ⚠️  2 个疑点
第三层: 案例相似  📊 最相似: CASE_012 (82%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📊 优化后指标

| 指标 | 原目标 | 优化目标 | 置信度 |
|------|--------|----------|--------|
| 测试用例 | 1833 | **625** | 95% |
| 规则覆盖 | 48×18 | **56×6** | 92% |
| 案例库 | 100 | **30** | 90% |
| 启发式规则 | 15 | **5** | 88% |
| 工具数量 | 5 | **2** (规则测试生成器 + CLI 看板) | 90% |
| 周期 | 6 周 | **8 周** | 92% |

---

## ⚡ 快速启动

### 今日可执行 (Week 1 Day 1)

```bash
# 1. 修复 goals-calculator.test.ts 类型错误
sed -i '' "s/'Bilateral'/'bilateral'/g" src/generator/__tests__/goals-calculator.test.ts

# 2. 统一测试框架
npm uninstall vitest
# 将 vitest 导入改为 jest

# 3. 运行测试确认
npm test
```

### 本周目标

- [ ] 所有测试通过 (344 + 修复)
- [ ] 29 PDF 解析验证
- [ ] 规则覆盖率报告

---

## 🔄 与原计划对比

| 维度 | 原计划 | 优化后 | 变化 |
|------|--------|--------|------|
| 总用例 | 1833 | 625 | -66% |
| 周期 | 6 周 | 8 周 | +33% |
| 案例库 | 100 | 30 | -70% |
| 工具 | 5 | 2 | -60% |
| 启发式规则 | 15 | 5 | -67% |
| **置信度** | 72% | **92%** | +20% |

---

## ✅ 验收标准 (简化)

### Phase 1 验收
- [ ] 测试通过率 100%
- [ ] 29 PDF 解析成功率 ≥ 90%

### Phase 2 验收
- [ ] CRITICAL 规则 100% 覆盖
- [ ] HIGH 规则 100% 覆盖
- [ ] 30 案例标注完成

### Phase 3 验收
- [ ] 三层审核 API 可用
- [ ] CLI 看板可运行
- [ ] 端到端审核流程通过

---

**下一步**: 确认后开始 Week 1 Day 1 任务
