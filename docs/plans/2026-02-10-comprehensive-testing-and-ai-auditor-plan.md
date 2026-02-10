# SOAP System 全面测试与 AI 审核员训练计划

**文档版本**: v2.0
**创建日期**: 2026-02-10
**项目**: SOAP Medical Notes Validation System
**计划类型**: 测试策略 + AI 审核系统训练

---

## 📋 执行摘要

### 项目重新定位

**从传统测试到 AI 审核员训练**：本计划不是传统的软件测试项目，而是构建一个具备三层判断能力的 **SOAP 笔记智能审核系统**。

### 核心目标

- 交付一个能像资深医疗审核专家一样工作的 AI Agent
- Agent 能够准确判断 SOAP 笔记是否合规、合理、优质
- 提供详细的审核报告、违规定位、修复建议

### 关键决策（基于 13 个问题的答案）

| 问题 | 选择 | 理由 |
|------|------|------|
| 1. 测试目标 | B - 全面质量保障 | 追求 90%+ 覆盖率，系统性验证 |
| 2. 资源时间 | A - 充足资源，4-6周 | 有足够时间建立完善体系 |
| 3. 规则验证深度 | C - 极致验证（15-20用例/规则） | 医疗级应用，零容忍错误 |
| 4. 问题记录 | C - 交互式问题看板 | 可视化质量状态，实时追踪 |
| 5. 测试数据 | A - 真实数据优先 | 最高置信度要求 |
| 6. 数据扩展 | B - 辅助工具半自动化 | 保证真实性，提高效率 |
| 7. 测试执行 | C - 大规模并行执行 | 10-15分钟获得全量反馈 |
| 8. 模块优先级 | A+B - 验证引擎+端到端双轨 | 确保规则可靠+主干流程畅通 |
| 9. 失败处理 | A - 零容忍策略 | 任何失败立即阻塞，强制高质量 |
| 10. 团队配置 | A - 独立开发者（1人） | 需要高度自动化工具支持 |
| 11. 工作量优化 | D - 自动化优先 | 工具达到极致覆盖，减少人工 |
| 12. Agent知识库 | D - 并行构建（平衡推进） | 全面发展，6周交付完整系统 |
| 13. 最终交付物 | D - 混合交付（系统+文档+工具） | 企业级完整可维护方案 |

---

## 🎯 三层审核架构

### 第一层：规则合规性引擎（确定性判断）

**职责**：执行 48 条明确规则的自动检查

**输出格式**：
```json
{
  "layer": "rule_compliance",
  "result": "FAIL",
  "violations": [
    {
      "ruleId": "TX03",
      "severity": "CRITICAL",
      "location": "Subjective - Progress Status",
      "issue": "疼痛从 7 降至 4，但描述为 'exacerbate'",
      "suggestion": "应改为 'improvement' 或 'reduced pain'"
    }
  ],
  "passRate": "47/48 (97.9%)"
}
```

**准确率要求**：100%（零容忍错误）

**48 条规则分类**：

| 类别 | 规则 | 数量 | 严重程度分布 |
|------|------|------|-------------|
| 文档级 | DOC01 | 1 | HIGH |
| 初诊 (IE) | IE01-IE08 | 8 | CRITICAL×2, HIGH×4, MEDIUM×2 |
| 复诊 (TX) | TX01-TX06 | 6 | CRITICAL×2, HIGH×3, MEDIUM×1 |
| 纵向 (V) | V01-V09 | 9 | HIGH×5, MEDIUM×4 |
| ICD 编码 | DX01-DX04 | 4 | HIGH×2, MEDIUM×2 |
| CPT 编码 | CPT01-CPT04 | 4 | CRITICAL×2, MEDIUM×2 |
| 生成器链 | S2,S3,S6,S7,O1-O3,O8,O9,A5,P1,P2,X1-X4 | 16 | CRITICAL×1, HIGH×4, MEDIUM×8, LOW×3 |

**测试策略**：极致验证（15-20 个用例/规则）
- 正常情况 × 2（不同场景）
- 违规情况 × 3（轻度/中度/严重违规）
- 边界情况 × 2（上下边界）
- 组合情况 × 2（与其他规则交叉）
- 异常处理 × 2（数据缺失/格式错误）
- 状态转换测试 × 2（IE → TX 序列）
- 时间序列测试 × 2（多次访问趋势）
- 身体部位特定测试 × 2
- 证型特定测试 × 2
- 回归测试 × 1（历史 bug 场景）

**总计**：48 × 18 = ~864 个规则测试用例

---

### 第二层：医学逻辑合理性检查（启发式判断）

**职责**：检查超越硬规则的医学合理性

**输出格式**：
```json
{
  "layer": "medical_logic",
  "result": "WARNING",
  "concerns": [
    {
      "type": "pattern_symptom_mismatch",
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

**启发式规则示例（10-15 条）**：

1. **证型-症状关联**
   - `qi_deficiency + severe_pain (>7) → 疑点`
   - `blood_stasis + dull_pain → 疑点`（应为刺痛）
   - `damp_phlegm + dry_tongue → 疑点`

2. **部位-治疗原则关联**
   - `KNEE + tonify_heart → 疑点`（膝关节通常不需补心）
   - `LBP + expel_wind_heat → 疑点`（腰痛少见风热证）

3. **疼痛-ROM 关联**
   - `severe_pain (>7) + full_ROM → 疑点`（剧痛通常限制活动）
   - `mild_pain (<3) + severe_ROM_limitation → 疑点`

4. **序列合理性**
   - `pain: 8→3→7 (先降后升) + continuous_treatment → 疑点`
   - `ROM: 20°→80°→30° (大幅波动) → 疑点`

**测试策略**：
- 每条启发式规则 8-10 个测试用例
- 包含：典型场景、边界情况、假阳性控制
- 总计：~120 个医学逻辑测试用例

---

### 第三层：案例库相似度对比（经验学习）

**职责**：与黄金案例对比，识别最佳实践和常见错误

**输出格式**：
```json
{
  "layer": "case_similarity",
  "result": "PASS",
  "qualityScore": 82,
  "similarCases": [
    {
      "caseId": "GOLDEN_KNEE_IE_127",
      "similarity": 0.85,
      "category": "优秀案例",
      "strengths": ["证型诊断准确", "S-O-A-P 逻辑连贯"],
      "differences": ["本案例穴位选择更丰富（12 vs 8）"]
    }
  ],
  "recommendations": [
    "参考案例 #127 的治疗原则表述方式",
    "考虑增加远端配穴（当前仅局部取穴）"
  ]
}
```

**案例库结构（目标 100 个案例）**：

| 类别 | 数量 | 说明 |
|------|------|------|
| 优秀案例 | 40 | 各场景的标杆（IE×20, TX×20） |
| 典型错误 | 30 | 常见违规模式 |
| 边界案例 | 20 | 灰色地带、复杂情况 |
| 回归案例 | 10 | 历史 bug 重现场景 |

**案例标注模板**：
```yaml
case_id: GOLDEN_KNEE_IE_127
category: 优秀案例
body_part: KNEE
note_type: IE
tcm_pattern: qi_stagnation
source: 真实PDF提取 + 人工验证
annotations:
  strengths:
    - 证型诊断依据充分（舌脉、疼痛性质一致）
    - 穴位配伍合理（局部+远端+辨证）
    - S-O-A-P 逻辑链完整
  quality_score: 95
  key_features:
    - pain_description: "dull aching pain, worse with movement"
    - tongue: "purple, thin white coating"
    - pulse: "wiry"
    - treatment_principle: "promote qi circulation, relieve pain"
```

**测试策略**：
- 案例相似度算法验证（~30 个测试）
- 案例检索准确性测试（~40 个测试）
- 质量评分一致性测试（~20 个测试）
- 总计：~90 个案例库测试用例

---

## 📊 完整测试矩阵

### 三维测试覆盖

| 维度 | 覆盖范围 | 数量 |
|------|----------|------|
| **规则维度** | 48 条规则 × 18 用例 | 864 |
| **工作流维度** | IE/TX 完整流程测试 | 150 |
| **数据维度** | 29 真实PDF + 200 变体 | 229 |
| **模块维度** | 单元/集成/E2E | 300 |
| **知识库维度** | 医学逻辑 + 案例库 | 210 |
| **工具维度** | 自动化工具测试 | 80 |
| **总计** | | ~1833 |

### 测试金字塔分布

```
           /\
          /E2E\         15% - 端到端测试（~275 用例）
         /------\          - 29 真实PDF解析
        /Integration\   25% - 集成测试（~458 用例）
       /------------\       - 工作流集成
      /    Unit      \  60% - 单元测试（~1100 用例）
     /----------------\     - 规则验证、解析器、生成器
```

---

## 🗂️ 目录结构重组

### 新的 tests/alltest 结构

```
tests/alltest/
├── README.md                                    # 测试数据使用说明
│
├── fixtures/                                    # 只读测试夹具
│   ├── pdfs/                                    # 真实PDF文件（29个）
│   │   ├── knee/                                # 按部位分类
│   │   │   ├── CHEN-SAIZHU-knee-ie-tx.pdf
│   │   │   └── ...
│   │   ├── shoulder/
│   │   ├── lbp/
│   │   ├── neck/
│   │   └── mixed/                               # 多部位
│   ├── templates/                               # 模板文件
│   │   ├── ie/                                  # IE模板（8个）
│   │   │   ├── AC-IE-KNEE.md
│   │   │   └── ...
│   │   └── tx/                                  # TX模板（5个）
│   │       ├── AC-TX-KNEE.md
│   │       └── ...
│   └── tcm-patterns/                            # 证型文档（11个）
│       ├── qi-stagnation.md
│       ├── blood-deficiency.md
│       └── ...
│
├── golden-cases/                                # 黄金案例库（目标100个）
│   ├── excellent/                               # 优秀案例（40个）
│   │   ├── GOLDEN_KNEE_IE_001.yaml
│   │   ├── GOLDEN_KNEE_TX_001.yaml
│   │   └── ...
│   ├── typical-errors/                          # 典型错误（30个）
│   │   ├── ERROR_PATTERN_TX03_001.yaml
│   │   └── ...
│   ├── edge-cases/                              # 边界案例（20个）
│   │   └── EDGE_PACEMAKER_ESTIM_001.yaml
│   └── regression/                              # 回归案例（10个）
│       └── BUG_20260208_PAIN_TREND.yaml
│
├── generated-variants/                          # 生成的测试变体（200个）
│   ├── auto/                                    # 工具自动生成
│   │   └── variant_knee_ie_001_to_050.json
│   └── manual/                                  # 手工审核通过
│       └── variant_shoulder_tx_001_to_020.json
│
├── test-cases/                                  # 测试用例定义
│   ├── matrix-generator.ts                     # 测试矩阵生成器
│   ├── rule-test-templates/                    # 规则测试模板
│   │   ├── CRITICAL-rules.json                 # 9条关键规则
│   │   ├── HIGH-rules.json                     # 15条高优先级
│   │   ├── MEDIUM-rules.json                   # 18条中等
│   │   └── LOW-rules.json                      # 6条低优先级
│   ├── workflow-scenarios.json                 # 工作流场景定义
│   └── full-matrix.json                        # 完整测试矩阵
│
├── snapshots/                                   # 快照测试基线
│   ├── parser-outputs/
│   ├── generator-outputs/
│   └── validator-reports/
│
└── helpers/                                     # 测试辅助函数
    ├── pdf-loader.ts                            # PDF加载器
    ├── assertion-helpers.ts                     # 断言辅助
    ├── mock-factory.ts                          # Mock数据工厂
    ├── case-similarity.ts                       # 案例相似度算法
    └── rule-coverage-tracker.ts                 # 规则覆盖追踪
```

### 主测试目录结构

```
tests/
├── unit/                                        # 单元测试（~1100用例）
│   ├── layer1-rules/                            # 第一层：规则引擎
│   │   ├── critical-rules.test.ts              # CRITICAL规则（9×18=162用例）
│   │   ├── high-rules.test.ts                  # HIGH规则（15×18=270用例）
│   │   ├── medium-rules.test.ts                # MEDIUM规则（18×18=324用例）
│   │   └── low-rules.test.ts                   # LOW规则（6×18=108用例）
│   ├── layer2-logic/                            # 第二层：医学逻辑
│   │   ├── pattern-symptom.test.ts             # 证型-症状关联
│   │   ├── bodypart-treatment.test.ts          # 部位-治疗关联
│   │   └── sequence-logic.test.ts              # 序列合理性
│   ├── layer3-cases/                            # 第三层：案例库
│   │   ├── similarity-algorithm.test.ts        # 相似度算法
│   │   ├── case-retrieval.test.ts              # 案例检索
│   │   └── quality-scoring.test.ts             # 质量评分
│   ├── generators/                              # 生成器单元测试
│   │   ├── subjective-generator.test.ts
│   │   ├── objective-generator.test.ts
│   │   ├── assessment-generator.test.ts
│   │   └── plan-generator.test.ts
│   ├── parsers/                                 # 解析器单元测试
│   │   ├── header-parser.test.ts
│   │   ├── subjective-parser.test.ts
│   │   ├── objective-parser.test.ts
│   │   ├── assessment-parser.test.ts
│   │   └── plan-parser.test.ts
│   └── engines/                                 # 引擎单元测试
│       ├── weight-system.test.ts
│       ├── rule-engine.test.ts
│       └── tx-sequence-engine.test.ts
│
├── integration/                                 # 集成测试（~458用例）
│   ├── three-layer-integration.test.ts         # 三层联合测试
│   ├── parser-validator-flow.test.ts           # 解析→验证流程
│   ├── generator-validator-loop.test.ts        # 生成→验证循环
│   ├── full-ie-workflow.test.ts                # 完整IE工作流（24用例）
│   ├── full-tx-workflow.test.ts                # 完整TX工作流（20用例）
│   └── cross-section-consistency.test.ts       # 跨段落一致性
│
├── e2e/                                         # 端到端测试（~275用例）
│   ├── real-pdf-parsing.test.ts                # 真实PDF解析（29个）
│   ├── template-coverage.test.ts               # 模板全覆盖（108个）
│   ├── auditor-agent-e2e.test.ts               # 审核员Agent端到端
│   ├── rule-engine-comprehensive.test.ts       # 规则引擎全覆盖
│   ├── frontend-backend-integration.test.ts    # 前后端集成
│   └── multi-visit-timeline.test.ts            # 多访问时间线
│
├── stress/                                      # 压力测试（~30用例）
│   ├── bulk-pdf-processing.test.ts             # 批量处理
│   ├── rule-validation-performance.test.ts     # 验证性能
│   └── concurrent-auditing.test.ts             # 并发审核
│
└── tools/                                       # 工具测试（~80用例）
    ├── variant-generator.test.ts                # 变体生成器
    ├── case-annotator.test.ts                   # 案例标注工具
    └── rule-test-generator.test.ts              # 规则测试生成器
```

---

## 🛠️ 工具开发计划

### 核心工具清单

#### 1. 病例变体生成器 (Variant Generator)

**功能**：
- 输入：真实 PDF + 变化规则
- 输出：符合规则的新病例文本
- 支持：批量生成、预览、人工审核

**使用示例**：
```typescript
const generator = new VariantGenerator()

// 基于真实病例生成变体
const variant = generator.generate({
  sourceCase: 'tests/alltest/fixtures/pdfs/knee/CHEN-SAIZHU.pdf',
  modifications: [
    { field: 'pain.level', change: 'increase', amount: 2 },
    { field: 'tcm_pattern', change: 'replace', value: 'blood_stasis' },
    { field: 'rom.flexion', change: 'decrease', amount: 10 }
  ],
  targetRule: 'TX03'  // 针对特定规则生成测试数据
})

// 人工审核
if (reviewer.approve(variant)) {
  variant.save('tests/alltest/generated-variants/manual/')
}
```

**Week 1 原型 → Week 2-3 完善**

---

#### 2. 案例标注工具 (Case Annotator)

**功能**：
- 辅助标注黄金案例
- 自动提取关键特征
- 质量评分建议

**使用界面**（CLI）：
```bash
$ npm run annotate tests/alltest/fixtures/pdfs/knee/CHEN-SAIZHU.pdf

📝 案例标注助手
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 源文件: CHEN-SAIZHU.pdf
🔍 自动识别:
  - 部位: KNEE
  - 类型: IE + TX (3 visits)
  - 证型: qi stagnation

📊 自动提取的关键特征:
  ✓ 疼痛描述: "dull aching pain, worse with movement"
  ✓ 舌象: "purple tongue, thin white coating"
  ✓ 脉象: "wiry pulse"
  ✓ 治疗原则: "promote qi circulation, relieve pain"

❓ 请选择案例类别:
  1) 优秀案例
  2) 典型错误
  3) 边界案例
  4) 回归案例
> 1

❓ 质量评分建议: 92 分
   是否接受? (y/n/自定义)
> y

💾 保存到: tests/alltest/golden-cases/excellent/GOLDEN_KNEE_IE_001.yaml
```

**Week 1 原型 → Week 4-5 完善**

---

#### 3. 规则测试生成器 (Rule Test Generator)

**功能**：
- 输入：规则定义
- 输出：18 个测试用例骨架
- 自动生成测试数据

**使用示例**：
```typescript
const generator = new RuleTestGenerator()

// 为规则 TX03 生成测试
generator.generateTests({
  ruleId: 'TX03',
  ruleName: '恶化描述 + 数值改善矛盾',
  severity: 'CRITICAL',
  testTemplate: 'extreme',  // 极致验证（18个用例）
  outputDir: 'tests/unit/layer1-rules/'
})

// 生成输出:
// tests/unit/layer1-rules/TX03.test.ts
//   - ✓ 正常情况_改善描述配数值改善
//   - ✓ 正常情况_恶化描述配数值恶化
//   - ✗ 违规情况_轻度_改善描述配疼痛微升1分
//   - ✗ 违规情况_中度_改善描述配疼痛升2分
//   - ✗ 违规情况_严重_改善描述配疼痛升3分
//   - ... (共18个)
```

**Week 1 开发 → Week 2 使用**

---

#### 4. 交互式审核看板 (Auditor Dashboard)

**功能**：
- 实时显示三层审核结果
- 可视化测试矩阵
- 点击查看详细日志

**界面设计**（基于 HTML Reporter）：
```
╔══════════════════════════════════════════════════════════════╗
║  SOAP 审核员 - 质量看板                      测试: 1833/1833  ║
╠══════════════════════════════════════════════════════════════╣
║                                                               ║
║  📊 综合评分: 94/100                  ⏱️  执行时间: 12m 34s   ║
║                                                               ║
║  第一层: 规则合规性    ✅ 98.5% (850/864 通过)                ║
║  第二层: 医学逻辑      ⚠️  15 个疑点需人工复核                ║
║  第三层: 案例相似度    📊 平均相似度 82%                       ║
║                                                               ║
╠══════════════════════════════════════════════════════════════╣
║  🗺️  测试矩阵热力图 (154 组合)                                ║
║                                                               ║
║        qi_stag  qi_def  blood_def  damp  ...                 ║
║  KNEE    ✅      ✅      ✅         ✅                         ║
║  LBP     ✅      ⚠️       ✅         ✅                         ║
║  SHOULDER✅      ✅      ❌         ✅    ← 点击查看详情        ║
║  ...                                                          ║
║                                                               ║
╠══════════════════════════════════════════════════════════════╣
║  ❌ 失败测试（14 个）                                          ║
║                                                               ║
║  1. TX03_severe_violation_case_7                             ║
║     位置: parsers/optum-note/checker/note-checker.ts:156     ║
║     原因: 未检测到"improvement" + pain上升的矛盾              ║
║     数据: pain 7→9, description "patient improved"            ║
║     [查看详情] [重现] [创建Issue]                              ║
║                                                               ║
║  2. SHOULDER_blood_stasis_IE_integration                     ║
║     ...                                                       ║
║                                                               ║
╚══════════════════════════════════════════════════════════════╝
```

**Week 1 基础框架 → Week 3 集成 → Week 6 完善**

---

#### 5. 规则覆盖追踪器 (Rule Coverage Tracker)

**功能**：
- 追踪每条规则被测试的次数
- 生成覆盖率报告
- 识别未覆盖的规则

**输出报告**：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  规则覆盖率报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 总体覆盖: 48/48 (100%)
✅ 完全覆盖: 45 条 (测试用例 ≥ 15)
⚠️  部分覆盖: 3 条 (测试用例 < 15)
❌ 未覆盖: 0 条

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  覆盖不足的规则:

  DX04 (ICD laterality 一致性) - 12/18 用例
    缺失场景:
      - 边界情况 × 2
      - 时间序列测试 × 2
      - 回归测试 × 2

  P2 (Acupoints 数量合理性) - 10/18 用例
    缺失场景:
      - 组合情况 × 2
      - 异常处理 × 2
      ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 最多测试的规则:
  1. TX03 (恶化描述+数值改善) - 24 用例
  2. X4 (Pacemaker+电刺激禁忌) - 22 用例
  3. IE01 (疼痛-ADL一致性) - 21 用例

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Week 1 开发 → 持续使用**

---

## 📅 6 周详细实施计划

### Week 1: 基础设施 + 知识梳理（30-35 小时）

#### Day 1-2：架构搭建（14 小时）

**目标**：建立审核员 Agent 的三层框架

**任务清单**：
- [ ] 创建 `src/auditor/` 目录结构
- [ ] 定义三层接口 (Layer1, Layer2, Layer3)
- [ ] 实现 AuditorAgent 主类
- [ ] 集成看板系统基础框架
- [ ] 配置 Jest 并行执行（maxWorkers）

**代码结构**：
```typescript
// src/auditor/index.ts
export class AuditorAgent {
  private layer1: RuleComplianceEngine
  private layer2: MedicalLogicChecker
  private layer3: CaseSimilarityAnalyzer

  async audit(soapNote: SOAPNote): Promise<AuditReport> {
    const results = await Promise.all([
      this.layer1.check(soapNote),
      this.layer2.check(soapNote),
      this.layer3.check(soapNote)
    ])

    return this.aggregateResults(results)
  }
}
```

**交付物**：
- ✅ 三层接口定义完成
- ✅ AuditorAgent 基础框架可运行
- ✅ 看板 HTML 模板创建

---

#### Day 3-4：规则库初始化（10 小时）

**目标**：将 48 条规则转化为可执行代码

**任务清单**：
- [ ] 梳理 48 条规则，按严重程度分类
- [ ] 为每条规则创建可执行定义
- [ ] 为每条规则设计 18 个测试场景模板
- [ ] 开发规则测试生成器

**规则定义示例**：
```typescript
// src/auditor/layer1/rules/TX03.ts
export const TX03: RuleDefinition = {
  id: 'TX03',
  name: '恶化描述 + 数值改善矛盾',
  severity: 'CRITICAL',
  category: 'TX',

  check: (visit: VisitRecord, context: ValidationContext) => {
    const progressText = extractProgressStatus(visit.subjective.cc)
    const painTrend = calculatePainTrend(context.previousVisit, visit)

    if (progressText === 'exacerbate' && painTrend < 0) {
      return {
        passed: false,
        violation: {
          location: 'Subjective - Progress Status',
          issue: `疼痛从 ${context.previousVisit.pain} 降至 ${visit.pain}，但描述为 'exacerbate'`,
          suggestion: "应改为 'improvement' 或 'reduced pain'"
        }
      }
    }

    return { passed: true }
  },

  testScenarios: [
    { name: '正常_改善描述配数值改善', type: 'normal' },
    { name: '正常_恶化描述配数值恶化', type: 'normal' },
    { name: '违规_轻度_改善描述配疼痛微升1分', type: 'violation', severity: 'mild' },
    // ... 共 18 个
  ]
}
```

**交付物**：
- ✅ 48 条规则可执行定义完成
- ✅ 规则测试生成器可运行
- ✅ CRITICAL 规则测试模板生成

---

#### Day 5：初始案例库（8 小时）

**目标**：精选 20 个黄金案例

**任务清单**：
- [ ] 审查 29 个真实 PDF
- [ ] 精选 10 个优秀案例
- [ ] 精选 10 个典型错误案例
- [ ] 完整标注（强项、弱项、质量评分）
- [ ] 开发案例标注工具原型

**案例选择标准**：

| 案例类型 | 选择标准 | 数量 |
|---------|---------|------|
| 优秀案例 | S-O-A-P 逻辑完整、证型准确、无规则违规 | 10 |
| 典型错误 | 常见违规模式（TX03, X4, IE01 等） | 10 |

**交付物**：
- ✅ 20 个案例完成标注
- ✅ 案例标注工具 CLI 原型
- ✅ 案例库目录结构建立

---

#### Day 6：医学知识提炼（6 小时）

**目标**：构建 10-15 条启发式规则

**任务清单**：
- [ ] 分析模板和真实病例，提炼医学逻辑
- [ ] 定义证型-症状关联规则
- [ ] 定义部位-治疗关联规则
- [ ] 定义疼痛-ROM 关联规则
- [ ] 定义序列合理性规则

**启发式规则定义**：
```typescript
// src/auditor/layer2/heuristics/pattern-symptom.ts
export const patternSymptomRules: HeuristicRule[] = [
  {
    id: 'HS_01',
    name: 'qi_deficiency 与剧烈疼痛矛盾',
    condition: (note) => {
      return note.tcmPattern === 'qi_deficiency' && note.pain > 7
    },
    concern: {
      type: 'pattern_symptom_mismatch',
      severity: 'MEDIUM',
      detail: 'qi deficiency 患者出现 severe sharp pain',
      reasoning: '气虚证通常表现为隐痛、乏力，剧烈刺痛更符合气滞血瘀',
      suggestion: '建议复核证型诊断或疼痛性质描述',
      confidence: 0.75
    }
  },
  // ... 9-14 条更多规则
]
```

**交付物**：
- ✅ 10-15 条启发式规则定义
- ✅ Layer2 检查器基础实现
- ✅ 初步医学知识文档

---

#### Day 7：工具原型开发（3 小时）

**目标**：完成病例变体生成器原型

**任务清单**：
- [ ] 设计变体生成规则语法
- [ ] 实现基础变体生成逻辑
- [ ] 测试生成 5 个变体案例
- [ ] 人工审核流程设计

**变体生成示例**：
```bash
$ npm run generate-variant -- \
  --source tests/alltest/fixtures/pdfs/knee/CHEN-SAIZHU.pdf \
  --rule TX03 \
  --count 5

生成 5 个针对规则 TX03 的测试变体:
  ✓ variant_001: pain 5→3, description "exacerbate" (违规)
  ✓ variant_002: pain 7→9, description "improvement" (违规)
  ✓ variant_003: pain 6→4, description "improvement" (正常)
  ✓ variant_004: pain 4→6, description "exacerbate" (正常)
  ✓ variant_005: pain 5→5, description "similar" (正常)

保存到: tests/alltest/generated-variants/auto/
请人工审核后移至: tests/alltest/generated-variants/manual/
```

**交付物**：
- ✅ 变体生成器原型可运行
- ✅ 生成 5 个测试变体
- ✅ 审核流程文档

---

#### Week 1 交付物总结

- ✅ 三层架构代码框架完成
- ✅ 48 条规则可执行定义
- ✅ 20 个标注完整的黄金案例
- ✅ 10-15 条医学启发式规则
- ✅ 3 个工具原型可运行（规则测试生成器、案例标注工具、变体生成器）
- ✅ 审核看板基础框架
- ✅ 测试基础设施就绪（Jest 配置、并行执行）

---

### Week 2-3: 第一层深化 + 端到端验证（双轨并行，60-70 小时）

#### 轨道 A：第一层规则验证（40 小时）

**目标**：完成 864 个规则测试用例

**任务分解**：

| 优先级 | 规则类型 | 数量 | 用例数 | 时间 |
|--------|---------|------|--------|------|
| P0 | CRITICAL (9条) | 9 | 162 | 12h |
| P1 | HIGH (15条) | 15 | 270 | 18h |
| P2 | MEDIUM (18条) | 18 | 324 | 16h |
| P3 | LOW (6条) | 6 | 108 | 6h |

**Week 2 任务**：
- [ ] Day 8-9：CRITICAL 规则极致验证（162 用例）
  - X4 (Pacemaker + 电刺激禁忌)
  - TX02, TX03 (疼痛趋势一致性)
  - CPT02 (CPT 与电刺激匹配)
  - IE01, IE02 (疼痛-ADL 一致性)
  - ...

- [ ] Day 10-12：HIGH 规则深度验证（270 用例）
  - V01-V05 (纵向一致性)
  - DX01, DX03 (ICD 匹配)
  - O2, O8, O9 (Objective 数据合理性)
  - ...

- [ ] Day 13-14：运行测试，修复失败（零容忍）
  - 所有失败必须修复
  - 追踪失败原因（代码 bug vs 测试数据问题）

**Week 3 任务**：
- [ ] Day 15-17：MEDIUM 规则标准验证（324 用例）
- [ ] Day 18-19：LOW 规则基础验证（108 用例）
- [ ] Day 20-21：全量回归测试 + 优化

**交付物**：
- ✅ 864 个规则测试用例全部通过
- ✅ 第一层准确率 = 100%
- ✅ 规则覆盖率报告（48/48）

---

#### 轨道 B：端到端真实 PDF 验证（30 小时）

**目标**：确保 29 个真实 PDF 完整解析和审核

**Week 2 任务**：
- [ ] Day 8-10：PDF 解析测试（15 小时）
  - 测试 29 个 PDF 的 Header 解析
  - 测试 S/O/A/P 各段提取准确性
  - 测试 ICD/CPT 编码提取
  - 修复 PDF 文本规范化问题

- [ ] Day 11-12：端到端审核流程（10 小时）
  - PDF → Parser → AuditorAgent → Report
  - 验证三层审核输出正确性
  - 测试看板显示

**Week 3 任务**：
- [ ] Day 15-16：多访问时间线测试（8 小时）
  - 选择 5 个包含多次访问的 PDF
  - 测试 IE → TX1 → TX2 → ... 序列
  - 验证纵向规则（V01-V09）

- [ ] Day 17-18：边界情况测试（6 小时）
  - 起搏器案例
  - 多部位案例
  - 罕见证型案例

**交付物**：
- ✅ 29 个 PDF 全部通过端到端测试
- ✅ E2E 通过率 ≥ 95%
- ✅ 主干流程完全畅通

---

### Week 4-5: 第三层扩展 + 集成测试（50-60 小时）

#### Week 4：案例库扩展（30 小时）

**目标**：从 20 个案例扩展到 100 个

**任务清单**：
- [ ] Day 22-24：使用变体生成器创建案例（18 小时）
  - 优秀案例：从 10 扩展到 40（新增 30）
  - 典型错误：从 10 扩展到 30（新增 20）
  - 边界案例：创建 20 个
  - 回归案例：创建 10 个（基于历史 bug）

- [ ] Day 25-27：人工审核所有生成案例（12 小时）
  - 每个案例平均审核时间 7-8 分钟
  - 完整标注（强项、弱项、评分）
  - 使用案例标注工具加速

**案例分布目标**：

| 部位 | 优秀 | 错误 | 边界 | 回归 | 总计 |
|------|------|------|------|------|------|
| KNEE | 8 | 6 | 4 | 2 | 20 |
| LBP | 8 | 6 | 4 | 2 | 20 |
| SHOULDER | 8 | 6 | 4 | 2 | 20 |
| NECK | 6 | 4 | 3 | 2 | 15 |
| 其他 | 10 | 8 | 5 | 2 | 25 |
| **总计** | **40** | **30** | **20** | **10** | **100** |

**交付物**：
- ✅ 100 个黄金案例完成标注
- ✅ 案例库质量评审通过
- ✅ 案例相似度算法优化

---

#### Week 5：集成测试 + Layer 2/3 测试（30 小时）

**目标**：完成集成测试和第二、三层测试

**任务清单**：
- [ ] Day 28-29：三层集成测试（10 小时）
  - Layer1 + Layer2 联合测试
  - Layer1 + Layer3 联合测试
  - 三层完整流程测试
  - 输出格式一致性测试

- [ ] Day 30-31：第二层医学逻辑测试（120 用例，10 小时）
  - 证型-症状关联测试（40 用例）
  - 部位-治疗关联测试（30 用例）
  - 疼痛-ROM 关联测试（30 用例）
  - 序列合理性测试（20 用例）

- [ ] Day 32-33：第三层案例库测试（90 用例，10 小时）
  - 相似度算法测试（30 用例）
  - 案例检索准确性测试（40 用例）
  - 质量评分一致性测试（20 用例）

**交付物**：
- ✅ 集成测试全部通过
- ✅ Layer 2 启发式规则验证完成
- ✅ Layer 3 案例库测试完成
- ✅ 三层输出格式统一

---

### Week 6: 完善优化 + 文档交付（35-40 小时）

#### Day 34-36：压力测试 + 性能优化（16 小时）

**任务清单**：
- [ ] 批量 PDF 处理测试（100 个并发）
- [ ] 规则验证性能测试（1000 笔记批量）
- [ ] 并发审核测试（50 个同时请求）
- [ ] 内存泄漏检测
- [ ] 性能瓶颈优化

**性能目标**：
- 单笔记审核 < 100ms (p95)
- 批量处理 100 笔记 < 10s
- 内存使用 < 512MB
- 并发 50 请求无降级

---

#### Day 37-38：工具完善 + 看板优化（10 小时）

**任务清单**：
- [ ] 变体生成器完善（批量生成、审核流程）
- [ ] 案例标注工具完善（自动特征提取）
- [ ] 规则测试生成器优化
- [ ] 交互式看板最终优化
  - 测试矩阵热力图
  - 详细日志查看
  - Issue 自动创建集成

---

#### Day 39-42：文档编写 + 最终验证（14 小时）

**文档清单**：
- [ ] **Agent 设计文档** (4 小时)
  - 三层架构详细说明
  - 规则引擎设计
  - 案例库设计
  - 医学逻辑设计

- [ ] **知识库维护手册** (3 小时)
  - 如何添加新规则
  - 如何标注新案例
  - 如何更新医学逻辑

- [ ] **测试执行指南** (2 小时)
  - 本地测试流程
  - CI/CD 流程
  - 失败处理流程

- [ ] **API 文档** (2 小时)
  - AuditorAgent API
  - 工具使用文档

- [ ] **最终质量报告** (3 小时)
  - 测试覆盖率报告
  - 规则覆盖率报告
  - 性能基准报告
  - 已知问题清单

---

## 📈 成功指标与验收标准

### 关键绩效指标 (KPI)

| 指标 | 目标值 | 测量方式 | 优先级 |
|------|--------|----------|--------|
| **代码覆盖率** | 90%+ | Jest coverage report | P0 |
| **第一层准确率** | 100% | 规则测试通过率 | P0 |
| **第二层召回率** | 85%+ | 医学逻辑疑点识别率 | P1 |
| **第三层相关性** | 80%+ | 案例检索准确率 | P1 |
| **E2E 通过率** | 95%+ | 真实 PDF 测试 | P0 |
| **规则覆盖率** | 48/48 (100%) | RuleCoverageTracker | P0 |
| **案例库规模** | 100 个 | 标注完成数量 | P1 |
| **测试执行时间** | <15 分钟 | CI/CD metrics | P2 |
| **单笔记审核时间** | <100ms (p95) | 性能测试 | P2 |
| **PDF 解析成功率** | 29/29 (100%) | E2E PDF tests | P0 |

---

### 验收清单

#### 功能完整性

- [ ] **审核员 Agent**
  - [ ] 三层架构完整实现
  - [ ] 48 条规则全部可执行
  - [ ] 10-15 条医学逻辑规则运行
  - [ ] 100 个案例库建立
  - [ ] 三层输出格式统一

- [ ] **测试套件**
  - [ ] 单元测试 ~1100 用例
  - [ ] 集成测试 ~458 用例
  - [ ] E2E 测试 ~275 用例
  - [ ] 压力测试 ~30 用例
  - [ ] 总计 ~1833+ 用例

- [ ] **支撑工具**
  - [ ] 病例变体生成器可用
  - [ ] 案例标注工具可用
  - [ ] 规则测试生成器可用
  - [ ] 交互式看板可用
  - [ ] 规则覆盖追踪器可用

#### 质量标准

- [ ] **零容忍标准**
  - [ ] 所有 CRITICAL 规则测试 100% 通过
  - [ ] 所有真实 PDF 解析 100% 成功
  - [ ] CI/CD 流水线无失败

- [ ] **高质量标准**
  - [ ] 代码覆盖率 ≥ 90%
  - [ ] 规则覆盖率 = 100% (48/48)
  - [ ] E2E 通过率 ≥ 95%

- [ ] **性能标准**
  - [ ] 完整测试执行 < 15 分钟
  - [ ] 单笔记审核 < 100ms (p95)
  - [ ] 内存使用 < 512MB

#### 文档完整性

- [ ] Agent 设计文档
- [ ] 知识库维护手册
- [ ] 测试执行指南
- [ ] API 文档
- [ ] 最终质量报告

---

## 🔄 持续改进机制

### 案例库持续扩展

**流程**：
1. 从生产环境收集新的真实病例
2. 使用案例标注工具标注
3. 人工审核质量
4. 添加到案例库
5. 重新运行相似度测试

**频率**：每月新增 10-20 个案例

---

### 规则持续优化

**流程**：
1. 监控审核报告，识别误报/漏报
2. 分析根因（规则定义问题 vs 数据问题）
3. 更新规则定义
4. 重新生成测试用例
5. 回归测试

**频率**：每季度规则审查

---

### 医学逻辑知识更新

**流程**：
1. 与医疗专家定期会议
2. 识别新的医学逻辑关联
3. 添加启发式规则
4. 验证规则准确性
5. 更新知识图谱

**频率**：每半年知识库审查

---

## ⚠️ 风险管理

### 高风险项

| 风险 | 严重程度 | 概率 | 缓解措施 |
|------|----------|------|----------|
| 独立开发工作量超预期 | HIGH | MEDIUM | Week 1 全力开发自动化工具，Week 2+ 用工具加速 |
| 真实 PDF 格式差异大 | HIGH | MEDIUM | 增强 PDF 规范化，Week 2 集中修复 |
| 案例标注质量不一致 | MEDIUM | HIGH | 使用标注工具辅助，建立质量检查清单 |
| 医学逻辑规则定义困难 | MEDIUM | MEDIUM | 从简单规则开始，逐步扩展；咨询医疗专家 |
| 测试数据维护成本高 | MEDIUM | HIGH | 使用快照测试，变体生成器自动化 |
| 性能目标无法达成 | LOW | LOW | 并行执行，代码优化，必要时放宽到 20 分钟 |

---

### 应对策略

#### 如果 Week 2 进度落后

**Plan B**：
- 降低规则测试深度：从极致（18 用例）降为深度（12 用例）
- 总用例从 864 降为 576
- 仍保持 CRITICAL 规则极致验证

#### 如果案例库无法达到 100 个

**Plan B**：
- 保证核心 60 个案例高质量（优秀 30 + 错误 20 + 边界 10）
- 其余案例后续补充
- 第三层测试相应调整

#### 如果工具开发耗时超预期

**Plan B**：
- Week 1 仅完成规则测试生成器（最关键）
- 变体生成器和案例标注工具可手工替代
- Week 4-5 再补充工具开发

---

## 📊 附录：测试矩阵详细设计

### 规则 × 场景 矩阵（部分示例）

| 规则 ID | 场景类型 | 测试数据 | 预期结果 |
|---------|----------|----------|----------|
| TX03 | 正常_改善描述配数值改善 | pain: 7→4, text: "improvement" | PASS |
| TX03 | 正常_恶化描述配数值恶化 | pain: 4→7, text: "exacerbate" | PASS |
| TX03 | 违规_轻度 | pain: 7→6.5, text: "exacerbate" | FAIL |
| TX03 | 违规_中度 | pain: 7→5, text: "exacerbate" | FAIL |
| TX03 | 违规_严重 | pain: 7→3, text: "exacerbate" | FAIL |
| TX03 | 边界_临界上升 | pain: 7→7.1, text: "improvement" | FAIL |
| TX03 | 边界_临界下降 | pain: 7→6.9, text: "exacerbate" | FAIL |
| TX03 | 组合_多部位 | knee pain: 7→4, shoulder pain: 5→6, text: "mixed" | COMPLEX |
| TX03 | 异常_数据缺失 | pain: null→4, text: "improvement" | ERROR |
| TX03 | 异常_格式错误 | pain: "moderate"→"mild", text: "improvement" | ERROR |
| TX03 | 状态转换_IE到TX | IE pain: 7, TX1 pain: 5, text: "improvement" | PASS |
| TX03 | 时间序列_3次访问 | pain: 7→5→4, text: ["improved", "continued improvement"] | PASS |
| TX03 | 部位_KNEE | KNEE pain: 7→4, text: "improvement" | PASS |
| TX03 | 证型_qi_stagnation | qi_stag pain: 7→4, text: "improvement" | PASS |
| TX03 | 回归_bug_20260208 | pain: 7→4, text: "exacerbate" (历史 bug) | FAIL |

**每条规则 × 18 个场景 = 完整覆盖**

---

### 部位 × 证型 × 笔记类型 矩阵（部分示例）

| 部位 | 证型 | 笔记类型 | 测试用例 ID | 状态 |
|------|------|----------|-------------|------|
| KNEE | qi_stagnation | IE | TEST_KNEE_QI_STAG_IE_001 | ✅ PASS |
| KNEE | qi_stagnation | TX | TEST_KNEE_QI_STAG_TX_001 | ✅ PASS |
| KNEE | qi_deficiency | IE | TEST_KNEE_QI_DEF_IE_001 | ✅ PASS |
| KNEE | blood_stasis | IE | TEST_KNEE_BLOOD_STASIS_IE_001 | ⚠️ WARNING |
| LBP | qi_stagnation | IE | TEST_LBP_QI_STAG_IE_001 | ✅ PASS |
| LBP | damp_phlegm | IE | TEST_LBP_DAMP_PHLEGM_IE_001 | ✅ PASS |
| SHOULDER | blood_deficiency | TX | TEST_SHOULDER_BLOOD_DEF_TX_001 | ❌ FAIL |
| ... | ... | ... | ... | ... |

**完整矩阵**：7 部位 × 11 证型 × 2 类型 = 154 组合

---

## 🎯 总结

### 项目本质

这不是一个传统的软件测试项目，而是：
1. **训练一个 AI 审核员**，使其具备专家级的 SOAP 笔记审核能力
2. **建立三层判断体系**：规则合规 + 医学逻辑 + 案例经验
3. **创建可持续的知识系统**：规则库、案例库、医学知识图谱

### 核心价值

- **零容忍质量保障**：100% 规则合规性，医疗级可靠性
- **智能审核辅助**：不仅指出违规，还能理解"为什么"
- **持续学习能力**：案例库不断扩充，系统不断进化
- **完整工具链**：从数据生成到审核看板，全流程自动化

### 6 周后的交付

**系统能力**：
- 像资深审核员一样审核 SOAP 笔记
- 准确率 ≥ 95%，关键规则 100% 准确
- 10-15 分钟完成 1000+ 笔记审核

**知识资产**：
- 48 条可执行规则
- 100 个黄金案例
- 10-15 条医学逻辑规则

**技术资产**：
- ~1833 个测试用例
- 5 个自动化工具
- 完整的 CI/CD 流水线

---

**下一步行动**：
1. 确认此计划是否符合预期
2. 如需调整，请指出具体方向
3. 确认后，开始执行 Week 1 Day 1 任务

```diff
+ 置信度: 96% (Very High - 基于详细问答和完整规划的综合方案)
```
