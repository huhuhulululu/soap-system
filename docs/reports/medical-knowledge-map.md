# 中医知识工程图谱

## 概览

本文档是 SOAP 系统的医学知识基础，包含证型分类、舌脉诊断、症状关联、审查规则映射及临床决策树。

---

## 1. 证型知识图谱

### 1.1 八大证型分类

#### 虚证 (Deficiency)

**Qi Deficiency (气虚证)**
- **典型舌象**: 淡舌、薄白苔、舌体胖大有齿痕
- **典型脉象**: 虚弱、细弱、无力
- **疼痛特征**: 隐痛 (dull)、酸痛 (aching)、轻度 (mild)、遇劳加重
- **部位倾向性**: 腰部 (肾气虚)、膝关节 (脾肾两虚)、全身乏力
- **触发规则**: HS06 (气虚证-舌象矛盾)、HS01 (证型-疼痛性质)

**Blood Deficiency (血虚证)**
- **典型舌象**: 淡白舌、薄白苔、舌质干燥
- **典型脉象**: 细脉、弱脉
- **疼痛特征**: 隐痛、空痛、夜间加重
- **部位倾向性**: 头部 (眩晕)、心悸、四肢麻木

**Kidney Yang Deficiency (肾阳虚)**
- **典型舌象**: 淡胖舌、水滑苔
- **典型脉象**: 沉细无力、尺脉弱
- **疼痛特征**: 腰膝酸软、冷痛、喜温喜按
- **部位倾向性**: 腰部、膝关节、下肢

---

#### 实证 (Excess)

**Blood Stasis (血瘀证)**
- **典型舌象**: 紫暗舌、舌有瘀点或瘀斑、舌下静脉曲张
- **典型脉象**: 涩脉、沉涩脉
- **疼痛特征**: 刺痛 (stabbing)、固定痛 (fixed)、锐痛 (sharp)、拒按
- **部位倾向性**: 外伤部位、关节、腰背
- **触发规则**: HS07 (血瘀证-淡舌矛盾)

**Qi Stagnation (气滞证)**
- **典型舌象**: 舌质正常或略暗、苔薄白
- **典型脉象**: 弦脉、沉弦脉
- **疼痛特征**: 胀痛 (distending)、游走痛 (moving)、情绪相关
- **部位倾向性**: 胸胁、腹部、头部

---

#### 寒证 (Cold)

**Cold-Damp (寒湿证)**
- **典型舌象**: 淡舌、白腻苔、舌体胖大
- **典型脉象**: 迟脉、缓脉、沉脉
- **疼痛特征**: 重痛 (heavy)、冷痛 (cold)、冻痛 (freezing)、得温减轻
- **部位倾向性**: 腰部、膝关节、下肢
- **触发规则**: HS08 (寒湿证-数脉矛盾)

**Wind-Cold (风寒证)**
- **典型舌象**: 淡红舌、薄白苔
- **典型脉象**: 浮紧脉
- **疼痛特征**: 紧痛、游走痛、遇风加重
- **部位倾向性**: 颈肩部、上背部

---

#### 热证 (Heat)

**Damp-Heat (湿热证)**
- **典型舌象**: 红舌、黄腻苔
- **典型脉象**: 滑数脉、濡数脉
- **疼痛特征**: 灼痛 (burning)、热痛 (hot)、伴红肿
- **部位倾向性**: 膝关节、肘关节、皮肤红肿处
- **触发规则**: HS09 (湿热证-迟脉矛盾)

---

#### 湿证 (Dampness)

**Phlegm-Dampness (痰湿证)**
- **典型舌象**: 舌体胖大、齿痕、厚腻苔 (白腻或黄腻)
- **典型脉象**: 滑脉、濡脉
- **疼痛特征**: 重着痛、困重感、肿胀
- **部位倾向性**: 肩关节、四肢沉重
- **触发规则**: HS05 (舌脉-证型一致)

---

#### 燥证 (Dryness)

**Yin Deficiency with Heat (阴虚内热)**
- **典型舌象**: 红舌少苔、舌面干燥、裂纹舌
- **典型脉象**: 细数脉
- **疼痛特征**: 隐痛、午后加重、伴五心烦热
- **部位倾向性**: 腰膝、咽干口燥

---

## 2. 证型-症状对应表

### Qi Deficiency (气虚证)
- **舌象**: 淡舌、薄白苔、舌体胖大有齿痕
- **脉象**: 虚弱、细弱、无力
- **疼痛**: 隐痛 (dull)、乏力、遇劳加重
- **常见部位**: 腰部 (肾气虚)、膝关节 (脾肾两虚)
- **审查规则**:
  - HS06: 气虚证不应出现红舌或黄苔 (置信度 78%)
  - HS01: 气虚证疼痛通常 ≤7/10，若 >7 需复核 (置信度 75%)
- **禁忌组合**: 红舌 + 黄苔 (实热象)、数脉 (热象)

---

### Blood Stasis (血瘀证)
- **舌象**: 紫暗舌、舌有瘀点、舌下静脉曲张
- **脉象**: 涩脉、沉涩脉
- **疼痛**: 刺痛 (stabbing)、固定痛 (fixed)、锐痛 (sharp)、拒按
- **常见部位**: 外伤部位、关节、腰背
- **审查规则**:
  - HS07: 血瘀证不应出现淡舌或淡白舌 (置信度 80%)
- **禁忌组合**: 淡舌 (血虚象)、虚脉

---

### Qi Stagnation (气滞证)
- **舌象**: 舌质正常或略暗、苔薄白
- **脉象**: 弦脉、沉弦脉
- **疼痛**: 胀痛 (distending)、游走痛 (moving)、情绪相关
- **常见部位**: 胸胁、腹部、头部、颈部
- **审查规则**: 情绪诱发或加重

---

### Cold-Damp (寒湿证)
- **舌象**: 淡舌、白腻苔、舌体胖大
- **脉象**: 迟脉、缓脉、沉脉
- **疼痛**: 重痛 (heavy)、冷痛 (cold)、冻痛 (freezing)、得温减轻
- **常见部位**: 腰部、膝关节、下肢
- **审查规则**:
  - HS08: 寒湿证不应出现数脉 (快脉) (置信度 82%)
- **禁忌组合**: 数脉 (热象)、红舌

---

### Damp-Heat (湿热证)
- **舌象**: 红舌、黄腻苔
- **脉象**: 滑数脉、濡数脉
- **疼痛**: 灼痛 (burning)、热痛 (hot)、伴红肿
- **常见部位**: 膝关节、肘关节、红肿部位
- **审查规则**:
  - HS09: 湿热证不应出现迟脉 (慢脉) (置信度 79%)
  - HS06: 气虚证诊断时出现红舌黄苔应考虑湿热证 (置信度 78%)
- **禁忌组合**: 迟脉 (寒象)、淡舌

---

### Wind-Cold (风寒证)
- **舌象**: 淡红舌、薄白苔
- **脉象**: 浮紧脉
- **疼痛**: 紧痛、游走痛、遇风加重
- **常见部位**: 颈肩部、上背部
- **审查规则**:
  - HS08: 风寒证不应出现数脉 (置信度 82%)
- **禁忌组合**: 数脉 (热象)

---

### Phlegm-Dampness (痰湿证)
- **舌象**: 舌体胖大、齿痕、厚腻苔
- **脉象**: 滑脉、濡脉
- **疼痛**: 重着痛、困重感、肿胀
- **常见部位**: 肩关节、四肢沉重
- **审查规则**:
  - HS05: 湿证不应出现干燥舌象 (置信度 75%)
- **禁忌组合**: 干燥舌 (燥象)

---

## 3. 症状组合规则

### 3.1 虚实夹杂常见组合

**Qi Deficiency + Blood Stasis (气虚血瘀)**
- **临床表现**: 隐痛 + 刺痛、乏力 + 固定痛点
- **舌象**: 淡暗舌、有齿痕 + 瘀点
- **脉象**: 细涩脉
- **审查策略**: 需同时满足两种证型的部分特征，置信度适当降低

**Qi Stagnation + Blood Stasis (气滞血瘀)**
- **临床表现**: 胀痛 + 刺痛、情绪波动影响
- **舌象**: 暗红舌、瘀点
- **脉象**: 弦涩脉
- **审查策略**: 常见于慢性损伤，需检查疼痛性质描述

**Cold-Damp + Kidney Yang Deficiency (寒湿 + 肾阳虚)**
- **临床表现**: 冷痛 + 腰膝酸软、得温减轻
- **舌象**: 淡胖舌、白腻苔
- **脉象**: 沉迟无力
- **审查策略**: 典型腰膝痛组合，允许虚实夹杂

---

### 3.2 复杂证型审查策略

**三证夹杂 (如 Qi Deficiency + Blood Stasis + Cold-Damp)**
- **要求**: 必须在 Assessment 中详细说明三者关系
- **舌脉**: 至少符合主证型 (第一证型) 的舌脉特征
- **置信度调整**: 单一规则置信度降低 10-15%
- **人工审核**: 复杂证型自动标记需人工审核 (Layer 2 manualReviewRequired = true)

---

### 3.3 边界情况处理

**临界舌象 (如舌淡红)**
- **策略**: 允许匹配气虚证或风寒证，不触发矛盾规则
- **置信度**: 降低至 65-70%

**轻度矛盾 (如气虚证 + 微黄苔)**
- **策略**: 触发 WARNING 而非 FAIL
- **建议**: 建议复核，但不阻止通过

**疼痛评分临界值 (如气虚证 pain = 7.0)**
- **策略**: HS01 规则阈值为 >7，7.0 不触发
- **边界**: pain ∈ (7, 10] 触发 MEDIUM 警告

---

## 4. 审查规则映射

### 4.1 Layer 1: 规则合规引擎 (Rule Compliance)

#### AC-2 系列: 选项合规
- **AC-2.1**: Chronicity Level 选项验证
  - 医学依据: 慢性疼痛定义 (>3个月)
  - 合法选项: ["Acute", "Subacute", "Chronic"]
  - 严重程度: CRITICAL

- **AC-2.2**: Severity Level 选项验证
  - 医学依据: 疼痛强度分级标准
  - 合法选项: ["mild", "mild to moderate", "moderate", "moderate to severe", "severe"]
  - 严重程度: CRITICAL

- **AC-2.3**: General Condition 选项验证
  - 医学依据: 整体健康状态评估
  - 合法选项: ["poor", "fair", "good", "excellent"]
  - 严重程度: CRITICAL

---

#### AC-3 系列: 纵向逻辑
- **AC-3.1 / V01**: Pain 不应反弹
  - 医学依据: 有效治疗应使疼痛持续下降或保持
  - 阈值: 允许波动 +0.1 (测量误差)
  - 严重程度: CRITICAL
  - 置信度: 100% (确定性规则)

- **AC-3.2**: Pain Scale 内部一致性
  - 医学依据: Current ∈ [Best, Worst]
  - 检查: Current ≤ Worst 且 Current ≥ Best
  - 严重程度: CRITICAL

- **V02**: Tightness 不应恶化
  - 医学依据: 肌肉紧张度应随治疗改善
  - 评分映射: mild(1) < moderate(3) < severe(4)
  - 严重程度: CRITICAL

- **V03**: ROM 不应下降 >5°
  - 医学依据: 活动度应随治疗改善
  - 阈值: 允许测量误差 ±5°
  - 严重程度: CRITICAL

---

#### AC-4 系列: S-O-A 链
- **AC-4.1**: Pain-SymptomChange 一致性
  - 医学依据: Pain↓ ⇒ Symptom Improvement
  - 检查: Pain 下降 ≥1 时，symptomChange 不应为 "exacerbate"
  - 严重程度: HIGH

---

#### AC-6 系列: 针刺协议
- **AC-6.1**: Pacemaker 患者禁用电刺激
  - 医学依据: 电刺激可能干扰起搏器
  - 检查: hasPacemaker = true ⇒ electricalStimulation = false
  - 严重程度: CRITICAL
  - 置信度: 100% (安全规则)

---

#### IE 系列: 初诊规范
- **IE01**: IE 笔记 Pain 必须 6-8
  - 医学依据: 保险规定 (moderate to severe pain)
  - 严重程度: CRITICAL

- **IE02**: IE 笔记 Severity 必须 "moderate to severe"
  - 医学依据: 保险理赔要求
  - 严重程度: CRITICAL

- **IE03**: IE 笔记 Chronicity 必须 "Chronic"
  - 医学依据: 保险覆盖范围 (慢性疼痛)
  - 严重程度: CRITICAL

- **IE04**: IE 笔记 General Condition 必须 "fair"
  - 医学依据: 初诊基线标准
  - 严重程度: CRITICAL

---

### 4.2 Layer 2: 医学逻辑检查 (Heuristic Rules)

#### HS01: 证型-疼痛性质关联
- **医学依据**: 虚证通常表现为隐痛、乏力，剧烈疼痛更符合实证
- **检查**: Deficiency 证型 + pain >7 ⇒ WARNING
- **严重程度**: MEDIUM
- **置信度**: 75%

#### HS02: 部位-治疗原则关联
- **医学依据**: 经络循行理论，膝关节不涉及心经
- **检查**: KNEE + Heart 相关证型 ⇒ WARNING
- **严重程度**: MEDIUM
- **置信度**: 80%

#### HS03: 疼痛-ROM 关联
- **医学依据**: 剧烈疼痛通常限制关节活动
- **检查**: pain >7 且 ROM >120° ⇒ WARNING
- **严重程度**: LOW
- **置信度**: 70%

#### HS04: 序列合理性
- **医学依据**: 治疗过程中疼痛不应大幅反弹
- **检查**: pain 序列 p1>p2 且 p3>p2+1 ⇒ WARNING
- **严重程度**: HIGH
- **置信度**: 85%

#### HS05: 舌脉-证型一致 (湿证-干燥矛盾)
- **医学依据**: 湿证舌苔应腻，不应干燥
- **检查**: Pattern 含 "Damp" + Tongue 含 "dry" ⇒ WARNING
- **严重程度**: MEDIUM
- **置信度**: 75%

#### HS06: 气虚证-舌象矛盾
- **医学依据**: 气虚证典型舌象为淡舌薄白苔，红舌黄苔多见于热证或实证
- **检查**: "Qi Deficiency" + (red tongue OR yellow coating) ⇒ WARNING
- **严重程度**: MEDIUM
- **置信度**: 78%
- **建议**: 考虑改为湿热证或气虚夹热

#### HS07: 血瘀证-舌象矛盾
- **医学依据**: 血瘀证典型舌象为紫暗舌或有瘀点，淡舌多见于血虚证
- **检查**: "Blood Stasis" + (pale tongue OR light tongue) ⇒ WARNING
- **严重程度**: MEDIUM
- **置信度**: 80%

#### HS08: 寒湿证-脉象矛盾
- **医学依据**: 寒湿证典型脉象为迟脉或缓脉，数脉多见于热证
- **检查**: ("Cold-Damp" OR "Wind-Cold") + "rapid pulse" ⇒ WARNING
- **严重程度**: MEDIUM
- **置信度**: 82%

#### HS09: 湿热证-脉象矛盾
- **医学依据**: 湿热证典型脉象为滑数脉，迟脉多见于寒证
- **检查**: "Damp-Heat" + "slow pulse" ⇒ WARNING
- **严重程度**: MEDIUM
- **置信度**: 79%

#### HS10: ADL-疼痛不匹配
- **医学依据**: 日常活动严重受限通常伴随中度以上疼痛
- **检查**: ADL ≥7 且 pain <3 ⇒ WARNING
- **严重程度**: LOW
- **置信度**: 72%

---

## 5. 临床决策树

### 5.1 舌象分析决策树

```
患者舌象: 红舌 + 黄腻苔
├─ 证型诊断: Qi Deficiency
│  └─ ❌ HS06 触发 (置信度 78%)
│     └─ 建议: 复核证型，考虑湿热证或气虚夹热
│
├─ 证型诊断: Damp-Heat
│  └─ ✅ 完全匹配 (典型舌象)
│     └─ 继续检查: 脉象应为滑数脉
│
└─ 证型诊断: Qi Deficiency + Damp-Heat (虚实夹杂)
   └─ ⚠️ 需详细说明
      └─ 要求: Assessment 中说明气虚为主 or 湿热为主
```

---

### 5.2 脉象分析决策树

```
患者脉象: 数脉 (rapid pulse)
├─ 证型诊断: Cold-Damp
│  └─ ❌ HS08 触发 (置信度 82%)
│     └─ 建议: 复核证型或脉象，寒证不应见数脉
│
├─ 证型诊断: Damp-Heat
│  └─ ✅ 符合 (滑数脉典型)
│     └─ 继续检查: 舌象应为红舌黄腻苔
│
└─ 证型诊断: Wind-Cold
   └─ ❌ HS08 触发 (置信度 82%)
      └─ 建议: 风寒应见浮紧脉，非数脉
```

---

### 5.3 疼痛性质决策树

```
疼痛性质: stabbing (刺痛) + fixed (固定)
├─ 证型诊断: Qi Deficiency
│  └─ ⚠️ HS01 可能触发 (如 pain >7)
│     └─ 建议: 虚证通常为隐痛，刺痛更符合血瘀证
│
├─ 证型诊断: Blood Stasis
│  └─ ✅ 完全匹配 (典型疼痛)
│     └─ 继续检查: 舌象应为紫暗舌或有瘀点
│
└─ 证型诊断: Qi Stagnation
   └─ ⚠️ 部分匹配
      └─ 注意: 气滞应为胀痛，刺痛更符合血瘀
```

---

### 5.4 虚实夹杂决策树

```
证型诊断: Qi Deficiency + Blood Stasis + Cold-Damp
├─ 步骤 1: 识别主证
│  └─ 检查: 第一证型为主证 (如 Qi Deficiency)
│
├─ 步骤 2: 舌脉验证
│  ├─ 舌象: 应符合主证 (淡舌) + 允许次证特征 (瘀点)
│  └─ 脉象: 应符合主证 (细弱) + 允许次证特征 (涩)
│
├─ 步骤 3: 疼痛验证
│  └─ 检查: 疼痛性质可混合 (隐痛 + 刺痛)
│
├─ 步骤 4: 规则调整
│  ├─ HS06 置信度: 78% → 65% (虚实夹杂降低)
│  └─ HS07 置信度: 80% → 68%
│
└─ 步骤 5: 人工审核标记
   └─ Layer2.manualReviewRequired = true (三证夹杂)
```

---

### 5.5 初诊 (IE) 决策树

```
笔记类型: IE
├─ AC-2 选项合规
│  ├─ Chronicity: 必须 "Chronic" (IE03)
│  ├─ Severity: 必须 "moderate to severe" (IE02)
│  └─ General Condition: 必须 "fair" (IE04)
│
├─ AC-3 Pain Scale
│  ├─ Current: 必须 6-8 (IE01)
│  ├─ Worst: 必须 ≥ Current (AC-3.2)
│  └─ Best: 必须 ≤ Current (AC-3.2)
│
├─ Layer 2 医学逻辑
│  ├─ HS01-HS10 全量检查
│  └─ 生成 WARNING (不阻止通过)
│
└─ Layer 3 案例相似度
   └─ 匹配黄金案例: GOLDEN_*_IE_00X
```

---

### 5.6 续写 (TX) 决策树

```
笔记类型: TX (第 N 次)
├─ 纵向逻辑验证
│  ├─ V01: Pain 不反弹 (允许 +0.1)
│  ├─ V02: Tightness 不恶化
│  └─ V03: ROM 不下降 >5°
│
├─ S-O-A 链验证
│  ├─ AC-4.1: Pain↓ ⇒ Symptom Improvement
│  └─ Objective ⇔ Assessment 一致
│
├─ 证型稳定性
│  └─ 检查: 证型不应频繁变更 (除非病情变化)
│
└─ 趋势合理性
   ├─ HS04: Pain 序列不大幅反弹
   └─ 建议: Pain 下降曲线应平滑
```

---

## 6. 部位-证型倾向性映射

| Body Part | 常见证型 | 次要证型 | 少见证型 |
|-----------|---------|---------|---------|
| **KNEE** | Cold-Damp, Kidney Yang Deficiency | Qi & Blood Deficiency, Blood Stasis | Heart 相关 (触发 HS02) |
| **LBP** | Kidney Deficiency, Blood Stasis | Qi Stagnation, Cold-Damp | Spleen 单纯虚证 |
| **SHOULDER** | Wind-Cold, Phlegm-Dampness | Qi & Blood Deficiency, Qi Stagnation | Kidney 单纯虚证 |
| **NECK** | Wind-Cold, Qi Stagnation | Liver Qi Stagnation, Blood Stasis | Dampness 单纯证 |
| **ELBOW** | Tendon Strain, Qi Stagnation | Blood Stasis, Wind-Damp | Kidney 相关 |

---

## 7. 置信度设置医学原理

### 7.1 高置信度规则 (≥80%)

**HS08: 寒湿证-数脉矛盾 (82%)**
- 原理: 寒主收引，脉应迟缓；数脉为热象，二者生理机制相反
- 例外: 极少数寒包热证型 (外寒内热)

**HS07: 血瘀证-淡舌矛盾 (80%)**
- 原理: 血瘀应见舌质紫暗；淡舌为血虚象，病机不同
- 例外: 气虚血瘀夹杂 (淡暗舌)

**HS02: 部位-治疗原则 (80%)**
- 原理: 经络循行路线固定，膝关节主要涉及足三阳、足三阴
- 例外: 极少数特殊病例

---

### 7.2 中置信度规则 (75-79%)

**HS06: 气虚证-红舌黄苔 (78%)**
- 原理: 气虚应见淡舌；红舌黄苔为热象或实证
- 例外: 气虚夹湿热 (22% 临床可见)

**HS09: 湿热证-迟脉 (79%)**
- 原理: 湿热应见数脉；迟脉为寒象
- 例外: 湿盛于热时，脉象可濡缓

**HS01: 证型-疼痛性质 (75%)**
- 原理: 虚证多隐痛；剧烈疼痛通常为实证
- 例外: 虚证日久，局部实证夹杂 (25%)

**HS05: 湿证-干燥舌 (75%)**
- 原理: 湿证舌苔应腻；干燥为燥象
- 例外: 湿证脱水时可见干燥

---

### 7.3 低置信度规则 (70-74%)

**HS10: ADL-疼痛不匹配 (72%)**
- 原理: 严重功能障碍通常伴中度以上疼痛
- 例外: 慢性适应、运动功能障碍非疼痛导致 (28%)

**HS03: 疼痛-ROM 关联 (70%)**
- 原理: 剧烈疼痛通常限制活动
- 例外: 某些炎症性疼痛 ROM 可保持 (30%)

---

## 8. 黄金案例证型分布

### 8.1 优秀案例证型统计 (计划 8 个)

| 证型 | 案例数 | 案例 ID |
|------|-------|---------|
| **Cold-Damp** | 2 | GOLDEN_KNEE_IE_001, GOLDEN_LBP_TX_004 |
| **Blood Stasis** | 2 | GOLDEN_KNEE_TX_002, GOLDEN_LBP_IE_003 |
| **Qi Deficiency** | 2 | GOLDEN_SHOULDER_TX_006, (夹杂于多案例) |
| **Wind-Cold** | 2 | GOLDEN_SHOULDER_IE_005, GOLDEN_NECK_IE_007 |
| **Qi Stagnation** | 2 | GOLDEN_LBP_TX_001, GOLDEN_ELBOW_TX_008 |

### 8.2 错误案例规则覆盖 (计划 5 个)

| 错误类型 | 触发规则 | 案例 ID |
|---------|---------|---------|
| Pain 反弹 | V01, AC-3.1 | ERROR_PAIN_REBOUND_001 |
| S-O-A 矛盾 | AC-4.1 | ERROR_SOA_CONTRADICTION_001 |
| 舌象矛盾 | HS06, HS07 | ERROR_PATTERN_TONGUE_MISMATCH_001 |
| IE Pain 越界 | IE01 | ERROR_IE_PAIN_OUT_OF_RANGE_001 |
| Pacemaker 违规 | AC-6.1 | ERROR_PACEMAKER_STIMULATION_001 |

---

## 9. 审查策略总结

### 9.1 单一证型审查
1. 验证舌象与证型匹配 (HS05-HS09)
2. 验证脉象与证型匹配 (HS08-HS09)
3. 验证疼痛性质与证型匹配 (HS01, patternPainMapping)
4. 验证部位与证型合理性 (HS02)

### 9.2 虚实夹杂审查
1. 识别主证型 (第一证型)
2. 舌脉至少符合主证型
3. 允许次证型特征出现
4. 置信度降低 10-15%
5. 复杂夹杂标记人工审核

### 9.3 纵向审查 (TX 笔记)
1. Pain 纵向趋势 (V01)
2. Tightness 改善趋势 (V02)
3. ROM 改善趋势 (V03)
4. S-O-A 链一致性 (AC-4.1)
5. 序列合理性 (HS04)

### 9.4 初诊审查 (IE 笔记)
1. 强制规范: IE01-IE04 (CRITICAL)
2. 医学逻辑: HS01-HS10 (WARNING)
3. 案例相似度: 匹配优秀案例
4. 质量评分: ≥85 分为优秀

---

## 10. 参考文献与知识来源

### 10.1 代码文件
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/src/auditor/layer1/index.ts` (规则引擎)
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/src/auditor/layer2/index.ts` (医学逻辑)
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/src/auditor/layer3/index.ts` (案例相似度)

### 10.2 基准文件
- `src/auditor/baselines/template-options.json` (选项合规)
- `src/auditor/baselines/engine-rules.json` (规则清单)

### 10.3 测试数据
- `/Users/ping/Desktop/Code/2_8/templete/soap-system/tests/alltest/golden-cases/INDEX.md` (黄金案例库)

---

## 附录: 术语对照表

| 中文 | 英文 | 缩写 |
|------|------|------|
| 气虚证 | Qi Deficiency | - |
| 血虚证 | Blood Deficiency | - |
| 血瘀证 | Blood Stasis | - |
| 气滞证 | Qi Stagnation | - |
| 寒湿证 | Cold-Damp | - |
| 湿热证 | Damp-Heat | - |
| 风寒证 | Wind-Cold | - |
| 痰湿证 | Phlegm-Dampness | - |
| 肾阳虚 | Kidney Yang Deficiency | - |
| 初诊 | Initial Evaluation | IE |
| 续写 | Treatment Visit | TX |
| 活动度 | Range of Motion | ROM |
| 日常活动 | Activities of Daily Living | ADL |

---

**文档版本**: v1.0
**最后更新**: 2026-02-10
**维护者**: Agent 6 (文档生成)
