# 黄金案例库索引

## 统计信息

- **总案例数**: 待补充（计划 11 个：优秀 8 + 错误 3）
- **覆盖部位**: KNEE, LBP, SHOULDER, NECK, ELBOW
- **覆盖证型**: 5 个主要证型
- **最后更新**: 2026-02-11

---

## 优秀案例（计划 8 个）

### KNEE（2 个）

#### GOLDEN_KNEE_IE_001
- **证型**: Cold-Damp + Wind-Cold / Kidney Yang Deficiency
- **疼痛**: 8/10
- **质量评分**: 92/100
- **优点**:
  - 证型诊断准确（舌象：淡舌薄白苔 ✓）
  - S-O-A 逻辑连贯（pain 8 → tightness severe → Cold-Damp）
  - 穴位选择符合证型（ST36, SP9 健脾祛湿）
- **文件**: `excellent/GOLDEN_KNEE_IE_001.yaml`

#### GOLDEN_KNEE_TX_002
- **证型**: Blood Stasis / Liver Qi Stagnation
- **疼痛趋势**: 7 → 5.5 → 4 → 3
- **质量评分**: 89/100
- **优点**:
  - 疼痛下降符合趋势（首次降 1.5）
  - ROM 持续改善（Flexion: 110° → 125° → 135°）
  - S-O-A 链完整（pain↓ → tightness↓ → improvement）
- **文件**: `excellent/GOLDEN_KNEE_TX_002.yaml`

---

### LBP（2 个）

#### GOLDEN_LBP_IE_003
- **证型**: Qi Stagnation + Blood Stasis / Kidney Deficiency
- **疼痛**: 9/10
- **质量评分**: 94/100
- **优点**:
  - 高疼痛场景处理准确（ADL: severe difficulty ✓）
  - 舌脉一致（舌暗有瘀点 + 沉涩脉 = Blood Stasis ✓）
  - 穴位配伍合理（BL23, BL52 补肾 + SP10 活血）
- **文件**: `excellent/GOLDEN_LBP_IE_003.yaml`

#### GOLDEN_LBP_TX_004
- **证型**: Cold-Damp Bi Syndrome
- **疼痛趋势**: 6.5 → 5.5 → 4.5 → 3.5
- **质量评分**: 87/100
- **优点**:
  - 匀速下降模式（每次降 1.0）
  - Tenderness 逐步改善（+3 → +2 → +1 → 0）
  - General condition 与疼痛对应（fair → good）
- **文件**: `excellent/GOLDEN_LBP_TX_004.yaml`

---

### SHOULDER（2 个）

#### GOLDEN_SHOULDER_IE_005
- **证型**: Wind-Cold + Phlegm / Spleen Qi Deficiency
- **疼痛**: 7.5/10
- **质量评分**: 90/100
- **优点**:
  - 复杂证型组合准确（舌淡苔腻 = Spleen虚 + Phlegm ✓）
  - ROM 限制合理（Abduction 80° < 正常 180°）
  - 穴位针对性强（LI15, SI9 肩部特定穴 + SP6 健脾化痰）
- **文件**: `excellent/GOLDEN_SHOULDER_IE_005.yaml`

#### GOLDEN_SHOULDER_TX_006
- **证型**: Qi & Blood Deficiency
- **疼痛趋势**: 5 → 4 → 3.5 → 2.5
- **质量评分**: 85/100
- **优点**:
  - 虚证治疗周期合理（下降较缓慢）
  - Strength 恢复追踪（4/5 → 4+/5 → 5/5）
  - 补法为主穴位（ST36, SP6, LI4 补气血）
- **文件**: `excellent/GOLDEN_SHOULDER_TX_006.yaml`

---

### NECK（1 个）

#### GOLDEN_NECK_IE_007
- **证型**: Wind-Cold + Qi Stagnation / Liver Qi Stagnation
- **疼痛**: 6/10
- **质量评分**: 88/100
- **优点**:
  - 颈部特定体征准确（muscle spasm frequent ✓）
  - ROM 多角度评估（Flexion, Extension, Rotation 全覆盖）
  - 穴位组合经典（GB20, BL10 祛风 + LV3 疏肝）
- **文件**: `excellent/GOLDEN_NECK_IE_007.yaml`

---

### ELBOW（1 个）

#### GOLDEN_ELBOW_TX_008
- **证型**: Tendon Strain + Qi Stagnation
- **疼痛趋势**: 4.5 → 3.5 → 3 → 2
- **质量评分**: 86/100
- **优点**:
  - 肌腱损伤特征明显（tenderness at lateral epicondyle ✓）
  - 功能改善追踪（grip strength 60% → 85% → 95%）
  - 局部远端配穴（LI11, LI10 局部 + LI4 远端）
- **文件**: `excellent/GOLDEN_ELBOW_TX_008.yaml`

---

## 典型错误案例（计划 3 个）

### 1. Pain 反弹错误

#### ERROR_PAIN_REBOUND_001
- **违规规则**: AC-3.1 纵向逻辑 - Pain Trend
- **错误类型**: 疼痛值反弹
- **具体问题**:
  - TX3: pain 6.0
  - TX4: pain 7.5 ❌ (反弹 +1.5)
  - **正确应为**: pain ≤ 6.1 (允许波动 +0.1)
- **影响**: 违反 `engine-rules.json` 中 `pain.trend` 规则
- **严重程度**: CRITICAL
- **文件**: `typical-errors/ERROR_PAIN_REBOUND_001.yaml`

---

### 2. S-O-A 链断裂错误

#### ERROR_SOA_CHAIN_002
- **违规规则**: AC-4.2 Objective-Assessment 一致性
- **错误类型**: Tightness 与 Assessment 矛盾
- **具体问题**:
  - Objective: tightness **increased** (moderate → severe)
  - Assessment: muscle tension **reduced** ❌
  - **正确应为**: muscle tension **increased** 或 **remained the same**
- **影响**: 违反 `engine-rules.json` 中 `soaChain.objectiveToAssessment` 规则
- **严重程度**: HIGH
- **文件**: `typical-errors/ERROR_SOA_CHAIN_002.yaml`

---

### 3. 舌象-证型矛盾错误

#### ERROR_TONGUE_PATTERN_003
- **违规规则**: AC-4.6 舌象-证型合理性
- **错误类型**: 虚证配实证舌象
- **具体问题**:
  - Pattern: **Qi Deficiency** (虚证)
  - Tongue: **red tongue, yellow coating** ❌ (热象/实证)
  - **正确应为**: pale tongue, thin white coating (淡舌薄白苔)
- **影响**: 违反医学知识图谱中舌象-证型关联规则
- **严重程度**: HIGH
- **置信度**: 0.78 (HS06 规则)
- **文件**: `typical-errors/ERROR_TONGUE_PATTERN_003.yaml`

---

## 案例使用指南

### 优秀案例用途
1. **回归测试基准**: 确保系统生成质量不低于这些案例
2. **AI 训练数据**: 作为 Few-Shot Learning 的示例
3. **审核员校准**: 统一人工审核标准

### 错误案例用途
1. **规则验证**: 确保审核系统能检测出这些错误
2. **边界测试**: 测试系统对违规的敏感度
3. **教学材料**: 帮助新审核员识别常见错误

---

## 数据规范

### YAML 结构
```yaml
caseId: GOLDEN_KNEE_IE_001
type: excellent  # 或 typical-error
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
  subjective: "..."
  objective: "..."
  assessment: "..."
  plan: "..."
metadata:
  createdBy: Agent-1
  createdAt: 2026-02-11
  reviewedBy: Agent-5
```

---

## 更新日志

- **2026-02-11**: 创建索引结构，定义 11 个案例规范
- **待补充**: Agent 1-4 补充具体案例 YAML 文件
- **待审核**: Agent 5 医学审核并评分

---

## 贡献者

- **Agent 1** (纵向逻辑): V01-V09 规则覆盖
- **Agent 2** (格式合规): IE/TX 模板规范
- **Agent 3** (医学知识): 舌脉证型关联
- **Agent 4** (S-O-A链): 逻辑一致性验证
- **Agent 5** (医学审核): 质量评分与最终审核
- **Agent 6** (文档生成): 本索引及配套文档
