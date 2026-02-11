# SPEC 2: AI 审核员模块

**版本**: v1.0  
**日期**: 2026-02-10  
**范围**: 三层智能审核系统

---

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    AuditorAgent                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Layer 1   │  │   Layer 2   │  │   Layer 3   │     │
│  │ 规则合规引擎 │  │ 医学逻辑检查 │  │ 案例相似度  │     │
│  │             │  │             │  │             │     │
│  │ 确定性规则  │  │ 启发式规则  │  │ 黄金案例库  │     │
│  │ 100% 准确  │  │ 置信度评分  │  │ 相似度匹配  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
├─────────────────────────────────────────────────────────┤
│                    审核报告聚合                          │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: 规则合规引擎

### L1-1: 规则定义

**输入**: SOAP 笔记 (解析后)  
**输出**: 规则检查结果列表

```typescript
interface RuleResult {
  ruleId: string           // 'AC-2.1', 'AC-3.1', ...
  passed: boolean
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  violation?: {
    location: string       // 'TX3 Subjective'
    issue: string          // 'pain 7.5 > 前次 7.3'
    suggestion: string     // 'pain 应持续下降'
  }
}
```

### L1-2: 规则分类

| 严重程度 | 规则数 | 示例 |
|----------|--------|------|
| CRITICAL | 9 | AC-2 选项合规, AC-3 纵向逻辑, AC-7 续写 |
| HIGH | 12 | AC-1 格式, AC-4 S-O-A 链, AC-6 针刺 |
| MEDIUM | 8 | AC-5 部位特定 |
| LOW | 3 | 格式建议 |

### L1-3: 批量检查 API

```typescript
class RuleComplianceEngine {
  // 单笔记检查
  check(note: ParsedSOAPNote): RuleResult[]
  
  // 批量检查
  checkBatch(notes: ParsedSOAPNote[]): Map<string, RuleResult[]>
  
  // 按严重程度过滤
  getViolations(results: RuleResult[], minSeverity: Severity): RuleResult[]
}
```

### L1-4: 输出格式

```json
{
  "layer": "rule_compliance",
  "result": "FAIL",
  "summary": {
    "total": 32,
    "passed": 30,
    "failed": 2,
    "passRate": "93.8%"
  },
  "violations": [
    {
      "ruleId": "AC-3.1",
      "severity": "CRITICAL",
      "location": "TX3 Subjective",
      "issue": "pain 7.5 > 前次 TX2 pain 7.3",
      "suggestion": "pain 应持续下降或保持"
    }
  ]
}
```

**用例**: 15

---

## Layer 2: 医学逻辑检查

### L2-1: 启发式规则

| ID | 名称 | 检查逻辑 | 置信度 |
|----|------|----------|--------|
| HS01 | 证型-疼痛性质 | qi_deficiency + severe_pain(>7) → 疑点 | 0.75 |
| HS02 | 部位-治疗原则 | KNEE + tonify_heart → 疑点 | 0.80 |
| HS03 | 疼痛-ROM 关联 | severe_pain(>7) + full_ROM → 疑点 | 0.70 |
| HS04 | 序列合理性 | pain: 8→3→7 (先降后升) → 疑点 | 0.85 |
| HS05 | 舌脉-证型一致 | damp_phlegm + dry_tongue → 疑点 | 0.75 |

### L2-2: 规则定义格式

```typescript
interface HeuristicRule {
  id: string
  name: string
  description: string
  check: (note: ParsedSOAPNote, context?: ValidationContext) => HeuristicResult
  confidence: number  // 0-1
}

interface HeuristicResult {
  triggered: boolean
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  detail: string
  reasoning: string
  suggestion: string
}
```

### L2-3: 证型-症状映射

| 证型 | 典型疼痛性质 | 典型舌象 | 典型脉象 |
|------|-------------|----------|----------|
| Qi Stagnation | 胀痛, 走窜 | 淡红, 薄白苔 | 弦 |
| Blood Stasis | 刺痛, 固定 | 紫暗, 瘀斑 | 涩 |
| Qi Deficiency | 隐痛, 乏力 | 淡, 齿痕 | 弱 |
| Cold-Damp | 重痛, 冷痛 | 白腻苔 | 濡缓 |
| Damp-Heat | 灼痛, 红肿 | 黄腻苔 | 滑数 |

### L2-4: 输出格式

```json
{
  "layer": "medical_logic",
  "result": "WARNING",
  "concerns": [
    {
      "ruleId": "HS01",
      "severity": "MEDIUM",
      "detail": "qi deficiency 患者出现 severe sharp pain (8/10)",
      "reasoning": "气虚证通常表现为隐痛、乏力，剧烈刺痛更符合气滞血瘀",
      "suggestion": "建议复核证型诊断或疼痛性质描述",
      "confidence": 0.75
    }
  ],
  "manualReviewRequired": true
}
```

**用例**: 10 (5 规则 × 2 场景)

---

## Layer 3: 案例相似度

### L3-1: 案例库结构

```
golden-cases/
├── excellent/     # 优秀案例 (12)
├── typical-errors/ # 典型错误 (10)
└── edge-cases/    # 边界案例 (8)
```

### L3-2: 案例标注格式

```yaml
id: GOLDEN_KNEE_IE_001
type: excellent
body_part: KNEE
note_type: IE
tcm_pattern:
  local: Cold-Damp + Wind-Cold
  systemic: Kidney Yang Deficiency
source: CHEN-SAIZHU.pdf
quality_score: 92
strengths:
  - 证型诊断依据充分
  - S-O-A 逻辑连贯
  - 穴位配伍合理
key_features:
  pain_level: 8
  pain_types: [Dull, Aching]
  tongue: "pale, white coating"
  pulse: "deep, slow"
```

### L3-3: 相似度算法

```typescript
function calculateSimilarity(note: ParsedSOAPNote, case: GoldenCase): number {
  const weights = {
    bodyPart: 0.15,       // 部位完全匹配
    noteType: 0.10,       // IE/TX 类型
    tcmPattern: 0.25,     // 证型匹配
    painLevel: 0.15,      // 疼痛等级接近度
    painTypes: 0.10,      // 疼痛性质重叠
    severityLevel: 0.10,  // 严重程度
    violations: 0.15      // 违规模式相似
  }
  
  let score = 0
  if (note.bodyPart === case.body_part) score += weights.bodyPart
  if (note.noteType === case.note_type) score += weights.noteType
  score += patternSimilarity(note.tcmPattern, case.tcm_pattern) * weights.tcmPattern
  score += 1 - Math.abs(note.painLevel - case.key_features.pain_level) / 10 * weights.painLevel
  // ...
  
  return score
}
```

### L3-4: 输出格式

```json
{
  "layer": "case_similarity",
  "result": "PASS",
  "qualityScore": 82,
  "topMatches": [
    {
      "caseId": "GOLDEN_KNEE_IE_001",
      "similarity": 0.85,
      "type": "excellent",
      "strengths": ["证型诊断准确", "S-O-A 逻辑连贯"],
      "differences": ["本案例穴位更多 (12 vs 8)"]
    },
    {
      "caseId": "ERROR_KNEE_TX_003",
      "similarity": 0.45,
      "type": "typical-error",
      "warning": "与典型错误案例相似，注意 pain 趋势"
    }
  ],
  "recommendations": [
    "参考案例 GOLDEN_KNEE_IE_001 的治疗原则表述"
  ]
}
```

**用例**: 10

---

## 审核员主接口

### API 定义

```typescript
// src/auditor/index.ts
export class AuditorAgent {
  private layer1: RuleComplianceEngine
  private layer2: MedicalLogicChecker
  private layer3: CaseSimilarityAnalyzer

  constructor(config: AuditorConfig) {
    this.layer1 = new RuleComplianceEngine(config.rules)
    this.layer2 = new MedicalLogicChecker(config.heuristics)
    this.layer3 = new CaseSimilarityAnalyzer(config.caseLibrary)
  }

  // 完整审核
  async audit(input: string | ParsedSOAPNote): Promise<AuditReport> {
    const note = typeof input === 'string' ? parse(input) : input
    
    const [r1, r2, r3] = await Promise.all([
      this.layer1.check(note),
      this.layer2.check(note),
      this.layer3.check(note)
    ])

    return {
      overallResult: this.aggregate(r1, r2, r3),
      qualityScore: this.calculateScore(r1, r2, r3),
      layer1: r1,
      layer2: r2,
      layer3: r3,
      timestamp: new Date().toISOString()
    }
  }

  // 快速检查 (仅 Layer 1)
  quickCheck(note: ParsedSOAPNote): RuleResult[] {
    return this.layer1.check(note)
  }
}
```

### 聚合逻辑

```typescript
private aggregate(r1: Layer1Result, r2: Layer2Result, r3: Layer3Result): OverallResult {
  // CRITICAL 违规 → FAIL
  if (r1.violations.some(v => v.severity === 'CRITICAL')) {
    return 'FAIL'
  }
  
  // HIGH 违规 > 2 → FAIL
  if (r1.violations.filter(v => v.severity === 'HIGH').length > 2) {
    return 'FAIL'
  }
  
  // Layer 2 高置信度疑点 → WARNING
  if (r2.concerns.some(c => c.confidence > 0.8)) {
    return 'WARNING'
  }
  
  // Layer 3 与错误案例高度相似 → WARNING
  if (r3.topMatches.some(m => m.type === 'typical-error' && m.similarity > 0.7)) {
    return 'WARNING'
  }
  
  return 'PASS'
}

private calculateScore(r1, r2, r3): number {
  let score = 100
  
  // Layer 1 扣分
  for (const v of r1.violations) {
    score -= { CRITICAL: 15, HIGH: 8, MEDIUM: 3, LOW: 1 }[v.severity]
  }
  
  // Layer 2 扣分
  for (const c of r2.concerns) {
    score -= c.confidence * 5
  }
  
  // Layer 3 加分 (与优秀案例相似)
  const bestMatch = r3.topMatches.find(m => m.type === 'excellent')
  if (bestMatch && bestMatch.similarity > 0.8) {
    score += 5
  }
  
  return Math.max(0, Math.min(100, score))
}
```

**用例**: 5

---

## 审核看板

### CLI 输出

```
$ npm run audit -- --file note.pdf

📊 SOAP 审核报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
综合结果: ⚠️ WARNING          综合评分: 78/100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第一层: 规则合规  ✅ 30/32 通过 (93.8%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ❌ [CRITICAL] AC-3.1 TX3 pain 7.5 > 前次 7.3
     位置: TX3 Subjective
     建议: pain 应持续下降或保持
  
  ❌ [HIGH] AC-4.1 symptomChange 与 pain 趋势矛盾
     位置: TX3 Assessment
     建议: pain↓ 应配合 "improvement"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第二层: 医学逻辑  ⚠️ 1 个疑点需人工复核
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️ [HS01] 证型-疼痛性质不匹配 (置信度: 75%)
     详情: qi deficiency + severe sharp pain (8/10)
     分析: 气虚证通常表现为隐痛，剧烈刺痛更符合气滞血瘀
     建议: 复核证型诊断或疼痛性质描述

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
第三层: 案例相似  📊 质量评分: 82
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🏆 最相似优秀案例: GOLDEN_KNEE_IE_001 (85%)
     优点: 证型诊断准确, S-O-A 逻辑连贯
  
  💡 建议: 参考该案例的治疗原则表述方式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 测试矩阵

| 模块 | 用例数 | 优先级 |
|------|--------|--------|
| L1-1~4 规则引擎 | 15 | CRITICAL |
| L2-1~4 医学逻辑 | 10 | HIGH |
| L3-1~4 案例相似 | 10 | HIGH |
| 主接口 + 聚合 | 5 | CRITICAL |
| **总计** | **40** | - |

---

## 验收标准

| 指标 | 目标 |
|------|------|
| Layer 1 准确率 | 100% |
| Layer 2 召回率 | ≥80% |
| Layer 3 相关性 | ≥75% |
| 综合评分一致性 | ≥90% |
| 单笔记审核时间 | <100ms |

---

## 实施计划

### Week 6: Layer 1 规则引擎
- 统一 32 条规则输出格式
- 批量检查 API
- 15 个测试用例

### Week 7: Layer 2 医学逻辑
- 5 条启发式规则实现
- 证型-症状映射表
- 10 个测试用例

### Week 8: Layer 3 + 集成
- 30 案例标注
- 相似度算法
- 审核看板 CLI
- 10 个测试用例

---

## 依赖关系

```
SPEC 1 (全面测试) ──────────────────────┐
  ├── AC-1~7 规则定义                   │
  ├── 三层基准 JSON                     │
  └── 140 测试用例                      │
                                        ▼
                              SPEC 2 (AI 审核员)
                                ├── Layer 1 使用 AC-1~7 规则
                                ├── Layer 2 使用基准 2 证型映射
                                └── Layer 3 使用 30 标注案例
```

SPEC 1 是 SPEC 2 的前置依赖。
