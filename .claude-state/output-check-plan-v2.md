# SOAP 全面产出质量检查计划 v2

## 范围
IE + TX 全链路 × 7 部位 × SOAP 四段 + Needle Protocol
横向: 每个 visit 内部各段之间的一致性
纵向: TX 序列跨 visit 的递减/递增约束

---

## A. Subjective 检查

### A1. IE Subjective — 用户输入贯通
| # | 检查项 | 预期 | 正则/方法 |
|---|--------|------|-----------|
| A1.1 | Pain Scale 三值 | Worst/Best/Current = context 值 | `Worst: N ; Best: N ; Current: N` |
| A1.2 | Symptom Duration | context.symptomDuration | `for {value} {unit}` |
| A1.3 | Pain Radiation | context.painRadiation | 文本包含 |
| A1.4 | Pain Types | context.painTypes 每个都出现 | 文本包含 |
| A1.5 | Causative Factors | context.causativeFactors 出现 | 文本包含 |
| A1.6 | Relieving Factors | context.relievingFactors 出现 | 文本包含 |
| A1.7 | Associated Symptom | context.associatedSymptom 出现 | `muscles {symptom}` |
| A1.8 | Symptom Scale | context.symptomScale | `scale as XX%` |
| A1.9 | Pain Frequency | context.painFrequency | 文本包含 |
| A1.10 | Medical History | context.medicalHistory | 末尾行包含 |
| A1.11 | Chronicity | context.chronicityLevel | 首段包含 |
| A1.12 | Secondary Body Parts | context.secondaryBodyParts | 有则出现 "also complaints" |
| A1.13 | Note Type 标题 | IE→"INITIAL EVALUATION", RE→"RE-EVALUATION" | 首行 |
| A1.14 | Walking aid | 固定 "none" | `Walking aid :none` |

### A2. TX Subjective — 引擎驱动
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| A2.1 | Pain Scale 格式 | `{label} /10` | 正则 |
| A2.2 | Pain 递减 | TX(n+1).pain ≤ TX(n).pain | 序列提取 |
| A2.3 | Symptom Scale 递减 | 百分比只降不升 | 序列提取 |
| A2.4 | Frequency 递减 | 频率等级只降不升 | 序列提取 |
| A2.5 | Associated Symptom 一致 | 与 initialState.associatedSymptom 匹配 | `muscles {symptom}` |
| A2.6 | Pain Types 一致 | 与 initialState.painTypes 匹配 | 文本包含 |
| A2.7 | symptomChange 文本 | 非空，来自 TEMPLATE_TX_SYMPTOM_CHANGE | 文本匹配 |
| A2.8 | reason 文本 | 非空，来自 TEMPLATE_TX_REASON | 文本匹配 |
| A2.9 | ADL 文本 | 非空，来自 BODY_PART_ADL[bp] | 文本匹配 |
| A2.10 | Severity 与 ADL 难度 | severity 降 → ADL difficulty 降 | 文本对照 |

### A3. 部位特定格式
| # | 部位 | 检查项 |
|---|------|--------|
| A3.1 | SHOULDER | `pain in {lat}-{area}` (连字符) |
| A3.2 | NECK | `pain in/in left side/in right side {area} area` |
| A3.3 | LBP | `pain on {area} area` |
| A3.4 | KNEE | ADL 无 "of"，两组 |
| A3.5 | SHOULDER/NECK | ADL 有 "of"，两组 |
| A3.6 | LBP | ADL "difficulty with ADLs like"，单组 |
| A3.7 | IE vs TX | IE "Pain Frequency:" (大写F) vs TX "Pain frequency:" (小写f) |

---

## B. Objective 检查

### B1. Muscles Testing
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| B1.1 | Tightness muscles | 来自 TEMPLATE_MUSCLES[bp].tightness | 对照模板池 |
| B1.2 | Tightness grading | 与 severity 一致 | 文本匹配 |
| B1.3 | Tenderness muscles | 来自 TEMPLATE_MUSCLES[bp] | 对照模板池 |
| B1.4 | Tenderness grading | 与 severity 映射一致 | `(+N)` 提取 |
| B1.5 | Spasm muscles | 来自 TEMPLATE_MUSCLES[bp] | 对照模板池 |
| B1.6 | Spasm grading | 与 computeSpasm 一致 | `(+N)` 提取 |
| B1.7 | TX Tightness 递减 | grading 只降不升 | 序列检查 |
| B1.8 | TX Tenderness 递减 | grading 只降不升 | 序列检查 |
| B1.9 | TX Spasm 递减 | grading 只降不升 | 序列检查 |
| B1.10 | Tightness muscle 数量 | IE=3 (pickWeightedOptions) | 计数 |
| B1.11 | ELBOW muscles 临床合理性 | 不应含 Gluteus Maximus/Hamstrings | 文本检查 |

### B2. ROM
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| B2.1 | IE ROM 连续性 (#13) | pain 6→7 差异 ≤ 8 度 | 相邻 pain 对比 |
| B2.2 | IE ROM 范围 | pain 9-10 在 severe band | 度数检查 |
| B2.3 | TX ROM 单调递增 | 度数只增不减 | 序列检查 |
| B2.4 | ROM 与 romTrend 一致 (#1) | trend=improved → 度数增加 | state vs 文本 |
| B2.5 | 部位动作完整性 | 每部位输出正确动作数 | 计数对照 |
| B2.6 | Bilateral 双侧 | 输出 Left + Right | 文本包含 |
| B2.7 | Unilateral 单侧 | 只输出对应侧 | 文本不含另侧 |
| B2.8 | SHOULDER 格式 | Abduction 无尾空格, Flexion 冒号前空格 | 精确匹配 |
| B2.9 | LBP/NECK degree label | "Degrees" (大写D) | 文本匹配 |
| B2.10 | ELBOW/SHOULDER degree label | ELBOW 统一 `degree`；SHOULDER 按动作混用 `degree`/`Degrees` | 按动作逐项匹配 |
| B2.11 | ROM header 格式 | LBP="Lumbar", NECK="Cervical", etc. | 文本匹配 |
| B2.12 | IE seed 变异 | 同 pain 不同 seed → ROM 不完全相同 | 对比 |

### B3. Strength
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| B3.1 | TX Strength 递增 | grade 只增不减 | 序列检查 |
| B3.2 | Strength 方向差异 | 不同方向应有差异（至少 IE） | 统计同 visit 内 unique grade 数 |
| B3.3 | resolveStrength floor 效应 | TX 后期引擎 grade 抹平方向差异的比例 | 统计 |
| B3.4 | HARD difficulty 降级 | HARD 动作 strength 比 EASY 低一级 | 对比同 visit |

### B4. Inspection / 舌脉
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| B4.1 | SHOULDER Inspection 位置 | ROM 之前 | 文本位置检查 |
| B4.2 | 其他部位 Inspection 位置 | ROM 之后 | 文本位置检查 |
| B4.3 | TX Inspection 固定 (#19) | 各 visit 相同 | 序列对比 |
| B4.4 | 舌脉格式 | `tongue\n...\npulse\n...` | 正则 |
| B4.5 | TX 舌脉固定 (#20) | 各 visit 相同 | 序列对比 |
| B4.6 | TCM pattern → 舌脉映射 | localPattern 对应正确 tongue/pulse | 对照 TONE_MAP |

---

## C. Assessment 检查

### C1. IE Assessment
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| C1.1 | 部位名称 | 包含正确部位 area 名 | 文本匹配 |
| C1.2 | TCM Pattern | 包含 localPattern | 文本匹配 |
| C1.3 | 格式完整 | 包含诊断 + 治疗建议 | 非空检查 |

### C2. TX Assessment
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| C2.1 | whatChanged 动态 (#15) | 多维驱动（frequency/ADL/symptomScale/severity），非单一 symptom 映射 | state vs 文本交叉验证 |
| C2.2 | whatChanged 映射表 | 仅在 symptomScaleChanged 时命中 symptom 映射；否则允许其他维度驱动 | 条件化文本匹配 |
| C2.3 | general condition (#22) | 来源于 visitState.generalCondition 或 inferCondition 结果（good/fair/poor） | 数据源校验 |
| C2.4 | symptomPresent | 来自 TEMPLATE_TX_SYMPTOM_PRESENT | 文本匹配 |
| C2.5 | patientChange | 来自 TEMPLATE_TX_PATIENT_CHANGE | 文本匹配 |
| C2.6 | physicalChange | 来自 TEMPLATE_TX_PHYSICAL_CHANGE | 文本匹配 |
| C2.7 | findingType | 来自 TEMPLATE_TX_FINDING_TYPE | 文本匹配 |
| C2.8 | tolerated | 来自 TEMPLATE_TX_TOLERATED | 文本匹配 |
| C2.9 | response | 来自 TEMPLATE_TX_RESPONSE | 文本匹配 |
| C2.10 | adverse | 固定 "No adverse side effect post treatment." | 文本匹配 |
| C2.11 | TCM Pattern | 包含 localPattern | 文本匹配 |
| C2.12 | output-cap defer 回补 (#3) | 长序列末尾 Assessment 完整 | 检查 TX15+ |

### C3. S-A 横向一致性（新发现）
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| C3.1 | S 提到的 symptom 与 A.whatChanged 的条件一致性 | 仅当 whatChanged 使用 symptom 文案时，需与 symptomScale/associatedSymptom/severity 变化一致 | 交叉比对 |
| C3.2 | response 与实际维度一致 (#4) | "reducing spasm" → spasm 实际下降 | state vs 文本 |
| C3.3 | response 与实际维度一致 | "improving ROM" → ROM 实际增加 | state vs 文本 |
| C3.4 | response 与实际维度一致 | "reducing pain" → pain 实际下降 | state vs 文本 |
| C3.5 | tightness trend vs grading (#5) | trend=reducing → grading 下降 | state vs 文本 |

---

## D. Plan 检查

### D1. IE Plan
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| D1.1 | Treatment principles | 非空，包含部位相关原则 | 文本检查 |
| D1.2 | Goals ST/LT | 包含 pain/symptom/tightness/tenderness/spasm/strength/ROM/ADL goals（不含 pain frequency） | 正则 |
| D1.3 | ST 疗程文案 | 固定出现 `12 treatments in 5-6 weeks` | 文本匹配 |
| D1.4 | LT 疗程文案 | 固定出现 `8 treatments in 5-6 weeks` | 文本匹配 |
| D1.5 | symptomType 动态 (#15) | 使用 context.associatedSymptoms[0] | 文本匹配 |
| D1.6 | Needle size | 来自 TEMPLATE_NEEDLE_SIZE[bp] | 文本匹配 |

### D2. TX Plan
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| D2.1 | Treatment principles | 非空 | 文本检查 |
| D2.2 | TX Plan 字段边界 | Plan 不输出 Pain Scale（painScale 仅在 Subjective） | 文本不含 `Pain Scale:` |
| D2.3 | treatmentFocus 驱动 (#9) | 不同 visit 的 Plan 有变化 | 序列对比 |
| D2.4 | Needle size | 来自 TEMPLATE_NEEDLE_SIZE[bp] | 文本匹配 |

---

## E. Needle Protocol 检查

### E1. 97810 穴位 (#8)
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| E1.1 | 标签 | "Acupuncture Points"（非 Front/Back Points） | 文本匹配 |
| E1.2 | TX 穴位来源 | 4 组合并 (front1+front2+back1+back2) | 对照引擎数据 |
| E1.3 | IE 穴位来源 | templateFrontPool ∪ templateBackPool | 对照模板池 |
| E1.4 | 穴位数量 | 4 个 | 计数 |
| E1.5 | 跨侧分布 | 允许同侧；记录 front/back 占比，不作为失败条件 | 统计 front/back |

### E2. 97813/97814 穴位
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| E2.1 | 穴位来源 | 来自 TEMPLATE_NEEDLE_POINTS[bp] | 对照模板池 |
| E2.2 | 穴位数量 | 符合 NEEDLE_GROUP_SIZES[bp] | 计数 |
| E2.3 | TX 穴位继承 (#21) | 来自引擎 visitNeedle | 对照 |
| E2.4 | Pacemaker | hasPacemaker=true → 排除电刺激 | 文本检查 |

### E3. 格式
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| E3.1 | Needle size 行 | `Select Needle Size :` 格式 | 正则 |
| E3.2 | Operation time | 15 mins (HF/OPTUM) 或 60 mins | 文本匹配 |
| E3.3 | 尾部固定文本 | "Removing and properly disposing..." | 文本包含 |

---

## F. 纵向约束（TX 序列）

### F1. 单调性（10 维度）
| # | 维度 | 约束 | 方法 |
|---|------|------|------|
| F1.1 | Pain | 只降不升 | 数值序列 |
| F1.2 | Severity | 只降不升 | 等级序列 |
| F1.3 | Symptom Scale | 只降不升 | 百分比序列 |
| F1.4 | Frequency | 只降不升 | 等级序列 |
| F1.5 | Tightness grading | 只降不升 | 等级序列 |
| F1.6 | Tenderness grading | 只降不升 | 等级序列 |
| F1.7 | Spasm grading | 只降不升 | 等级序列 |
| F1.8 | ROM degrees | 只增不减 | 度数序列 |
| F1.9 | Strength grade | 只增不减 | 等级序列 |
| F1.10 | Associated Symptom rank | 只降不升 | rank 序列 |

### F2. Frequency Goals 相对计算 (#18)
| 起始 | ST goal | LT goal | 验证 |
|------|---------|---------|------|
| Constant(3) | Frequent(2) | Occasional(1) | 序列末尾 ≤ LT |
| Frequent(2) | Occasional(1) | Intermittent(0) | 同上 |
| Occasional(1) | Intermittent(0) | Intermittent(0) | 同上 |
| Intermittent(0) | 0 | 0 | 无变化 |

### F3. PRNG 可复现
| # | 检查项 | 方法 |
|---|--------|------|
| F3.1 | 同 seed 同输入 → 相同全文 | 2 次生成对比 |
| F3.2 | 不同 seed → 不同全文 | 2 个 seed 对比 |
| F3.3 | IE seed 变异 | 同输入不同 seed → 不同 IE 文本 |
| F3.4 | IE seed 可复现 | 同 seed → 相同 IE 文本 |

---

## G. 横向一致性（visit 内跨段）

### G1. S-O 一致性
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| G1.1 | S.pain vs O.strength | pain 高 → strength 低 | 数值对照 |
| G1.2 | S.severity vs O.tightness | severity 等级 ≈ tightness grading | 等级对照 |
| G1.3 | S.severity vs O.ROM | severity 高 → ROM 受限 | 度数对照 |

### G2. S-A 一致性
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| G2.1 | S.associatedSymptom vs A.whatChanged | A 提到的 symptom 必须在 S 中出现 | 交叉比对 |
| G2.2 | S.pain 变化 vs A.patientChange | pain 下降 → "decreased pain" | 文本对照 |
| G2.3 | S.symptomScale 变化 vs A.whatChanged | scale 下降 → whatChanged 包含 symptom | 文本对照 |

### G3. O-A 一致性
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| G3.1 | O.spasm 变化 vs A.response | A 说 "reducing spasm" → O.spasm 实际下降 | 对照 |
| G3.2 | O.ROM 变化 vs A.response | A 说 "improving ROM" → O.ROM 实际增加 | 对照 |
| G3.3 | O.strength 变化 vs A.physicalChange | A 说 "increased strength" → O.strength 增加 | 对照 |
| G3.4 | O.tightness 变化 vs A.findingType | A 说 "reduced tightness" → O.tightness 下降 | 对照 |

### G4. A-P 一致性
| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| G4.1 | A.treatmentFocus vs P.principles | Plan 原则与 Assessment focus 相关 | 文本对照 |

---

## H. 数据源断裂检查（MEMORY.md 已知问题）

| # | 问题 | 检查方法 | 预期状态 |
|---|------|----------|----------|
| H1 | adlItems 未被渲染层消费 (#6) | state.adlItems 数量 vs 文本 ADL 数量 | 记录差异率 |
| H2 | aggravatingItems 未消费 (#7) | TX 模板不输出 aggravating（设计决策） | 确认 |
| H3 | needlePoints 与渲染断裂 (#8) | state.needlePoints vs 文本穴位 | 记录 missing 率 |
| H4 | treatmentFocus 未驱动 Plan (#9) | 不同 visit 的 Plan 是否变化 | 记录相同率 |
| H5 | objectiveFactors 未消费 (#10) | 引擎生成但文本无消费 | 确认 |
| H6 | soaChain.subjective 部分使用 (#11) | 渲染主要消费 assessment chain | 确认 |
| H7 | strengthGrade 全局单值 (#12) | 方向差异被 floor 抹平 | 记录抹平率 |
| H8 | Plan 层 painScale 旧检查项 (#14) | 确认 Plan 不输出 Pain Scale；painScale 检查迁移到 Subjective | 确认 |
| H9 | energy/sleep reason 无门控 (#16) | 主观维度全稳定时是否选 energy/sleep | 记录 |
| H10 | IE symptomScale 格式丢失 (#17) | TX1 比较保护逻辑 | 确认 |

---

## I. 边界条件

### I1. 极端 Pain
| 场景 | 预期 |
|------|------|
| pain=10 | severe, ROM 显著受限, 高 grading |
| pain=3 | mild, ROM 接近正常, 低 grading |
| pain=1 | minimal, ROM 正常 |

### I2. 极端序列长度
| 场景 | 预期 |
|------|------|
| txCount=1 | 单次 TX 正常输出 |
| txCount=20 | 长序列末尾维度趋于稳定 |

### I3. 缺失字段防御
| 场景 | 预期 |
|------|------|
| 无 severityLevel | fallback severityFromPain() |
| 无 chronicityLevel | fallback "Chronic" |
| 无 localPattern | fallback "Qi Stagnation" |
| 无 systemicPattern | 跳过相关句子 |
| 无 laterality | fallback "bilateral" |
| 无 painTypes | weight system picks 2 |
| 无 causativeFactors | weight system picks |
| 无 relievingFactors | weight system picks |

### I4. 特殊配置
| 场景 | 预期 |
|------|------|
| hasPacemaker=true | 排除电刺激 |
| medicalHistory=["Diabetes","Hypertension"] | 影响 goals |
| realisticPatch=true (IE) | ROM 更陡峭曲线 |
| bilateral vs unilateral | 双侧/单侧正确 |

### I5. 模板数据质量
| # | 检查项 | 预期 |
|---|--------|------|
| I5.1 | ELBOW muscles | 不应含 Gluteus Maximus/Hamstrings（非肘部肌肉） |
| I5.2 | ELBOW ROM movements | 不应含 "side flexion/rotation"（脊柱动作） |
| I5.3 | 所有部位 TEMPLATE_MUSCLES 非空 | 7 部位都有 |
| I5.4 | 所有部位 TEMPLATE_NEEDLE_POINTS 非空 | 7 部位都有 |
| I5.5 | 所有部位 BODY_PART_ROM 非空 | 7 部位都有 |

---

## J. 大样本统计扫描

### 参数
- TX: 5 部位 × 5 symptom × 20 seeds × 11 visits = 5500 visit 样本
- IE: 6 部位 × 7 pain × 10 seeds = 420 样本

### 统计指标
| 指标 | 目标 |
|------|------|
| undefined 出现率 | 0% |
| 空行/格式异常率 | 0% |
| 单调性违反率（10 维度） | 0% |
| whatChanged 正确率 (#15) | 100% |
| whatChanged 错误 soreness 率（非 soreness 患者） | 0% |
| frequency 硬编码残留率 (#18) | 0% |
| IE ROM 跳变 >10度 率 (#13) | 0% |
| 97810 标签错误率 (#8) | 0% |
| S-A symptom 不一致率（新发现） | 记录当前值 |
| response-spasm 冲突率 (#4) | 记录当前值 |
| tightness trend 冲突率 (#5) | 记录当前值 |
| romTrend-ROM 脱节率 (#1) | 记录当前值 |
| Plan painScale=7 硬编码率 (#14) | 记录当前值 |
| TX Plan 全序列相同率 (#9) | 记录当前值 |
| Strength 方向差异被抹平率（新发现） | 记录当前值 |
| adlItems 渲染断裂率 (#6) | 记录当前值 |
| needlePoints 渲染断裂率 (#8) | 记录当前值 |

---

## K. Batch Pipeline 检查

| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| K1 | toBatchInput 字段映射 | 所有 clinical 字段正确传递 | 单元测试 |
| K2 | realisticPatch 只应用 IE | TX 不被 patch | 文本对比 |
| K3 | continue mode 状态提取 | extractStateFromTX 正确解析 | 单元测试 |
| K4 | seed 一致性 | batch 内同 patient 用同 seed | 检查 |
| K5 | 计数正确 | totalGenerated/totalFailed 不重复计数 | 已有测试 |
| K6 | splitSOAPText 正确 | 四段分割无遗漏 | 单元测试 |

---

## L. objective-patch 检查（IE only）

| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| L1 | ROM 更陡峭 | patch 后 ROM 比原始更受限 | 对比 |
| L2 | Strength 重算 | patch 后 strength 与 pain 一致 | 检查 |
| L3 | Spasm 重算 | patch 后 spasm 与 pain 一致 | 检查 |
| L4 | Goals 重算 | computePatchedGoals 8 维度 | 数值验证 |
| L5 | 文本标记依赖 | "Muscles Strength and"/"Inspection:"/"tongue" 存在 | 格式检查 |
| L6 | pain 5-9 clamp | pain 4→用 5 模型, pain 10→用 9 模型 | 边界验证 |

---

## 执行顺序

### Phase 1: 基础完整性（5 min）
- 30 fixture snapshot 通过
- 7 部位 IE 不报错
- 5 部位 TX 不报错
- PRNG 可复现 (F3)

### Phase 2: 结构正确性（15 min）
- IE Subjective 用户输入贯通 (A1)
- TX 纵向单调性 10 维度 (F1)
- ROM 部位动作完整性 (B2.5)
- Bilateral/Unilateral (B2.6/B2.7)
- Needle 穴位来源 (E1/E2)
- 部位特定格式 (A3)

### Phase 3: 修复验证 #8 #13 #15 #18（10 min）
- whatChanged 5 种 symptom × 5 部位 (C2.1)
- frequency goals 4 种起始 × 5 部位 (F2)
- IE ROM 连续性 6 部位 × 7 pain (B2.1)
- 97810 穴位 4 组合并 (E1)

### Phase 4: 横向一致性（15 min）
- S-A symptom 一致性 (G2.1) — 新发现
- S-O pain vs strength (G1.1)
- O-A response vs 实际维度 (G3)
- Strength 方向差异 (B3.2) — 新发现

### Phase 5: 数据源断裂 + 已知问题（10 min）
- MEMORY.md 23 个问题当前状态 (H1-H10)
- 模板数据质量 (I5)

### Phase 6: 大样本统计扫描（20 min）
- 5500 TX + 420 IE 全量扫描 (J)
- 统计报告

### Phase 7: Batch Pipeline + Patch（10 min）
- Batch 字段映射 (K)
- objective-patch 正确性 (L)

### Phase 8: 边界条件（10 min）
- 极端 pain/序列长度 (I1/I2)
- 缺失字段防御 (I3)
- 特殊配置 (I4)

---

## 产出物
1. 每个检查项的 PASS/FAIL/KNOWN_ISSUE 状态
2. 大样本统计报告（数值 + 分布）
3. 新发现问题清单（含 S-A 不一致、Strength 抹平）
4. 已知问题当前状态更新
5. 建议修复优先级

---

## M. BUG-03~06 审计记录（2026-03-03）

- 审计结论与根因文档: `.claude-state/memory-bug-audit-2026-03-03.md`
- 核心结论:
  - BUG-03: 成立，HIGH（startPain 源缺失 `context.painCurrent` fallback）
  - BUG-04: 成立，MEDIUM（`associatedSymptoms[]` 在 TX 链路被单值化）
  - BUG-05: 成立，MEDIUM（IE/TX 肌肉选择双源导致数量差异）
  - BUG-06: 成立（架构级，表现为大量 `romTrend=stable` 但 ROM 文本仍变化）
- 修复状态（本轮）:
  - BUG-03: 已修复并补测试 `start-pain-fallback.test.ts`
  - BUG-04: 已修复并补测试 `associated-symptoms-multivalue.test.ts`
  - BUG-05: 已修复并补测试 `objective-ie-muscle-source.test.ts`
  - BUG-06: 已修复并补测试 `rom-trend-render-alignment.test.ts`
  - 附加项: `mixedDirectionEmptyFindingType` 已修复（动态审计命中 1109 -> 0）

---

## N. 严格审计执行结果（2026-03-03，续）

### N1. 脚本与回归结果
- `npm run -s audit:dynamic`：全部计数 `0`
- `node --import tsx scripts/sentence-audit-v2.ts`：`TOTAL: 0`
- `node --import tsx scripts/deep-coherence-audit.ts`：`TOTAL: 0`
- `npx jest -u`：`81/81 suites`，`2048 tests` 全通过，退出码 `0`

### N2. 本轮新增根因（测试基础设施）
1. `vitest`/`jest` 运行器混用：
   - 多个测试文件直接 `import { vi } from "vitest"`，在当前 `jest` + `ts-jest`（CommonJS）链路下会触发模块加载失败。
2. snapshot 陈旧导致全量回归非零退出：
   - `fixture-snapshots` 存在 `obsolete snapshots`，需要统一更新清理。

### N3. 本轮修订
- 将以下测试文件从 `vi.*` 统一替换为 `jest.*`：
  - `src/validator/__tests__/output-validator.test.ts`
  - `server/routes/__tests__/ai-generate.route.test.ts`
  - `server/routes/__tests__/automate.route.test.ts`
  - `server/routes/__tests__/batch.route.test.ts`
  - `server/services/__tests__/batch-generator-counting.test.ts`
- 清理过期快照：`src/generator/__fixtures__/fixture-snapshots.test.ts.snap`（移除 30 条 obsolete）

### N4. 当前状态
- BUG-03~06 + mixedDirection 修复链路已通过脚本与单测双重验证。
- 全量 `jest` 已可稳定执行通过。
- 压测仍会输出 `TX-reason-diversity` 的 `WARN` 报告（非 ERROR，不阻断通过）。
