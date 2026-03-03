# SOAP 系统全面产出质量检查计划

## 范围
覆盖 IE + TX 全链路、7 个部位、所有 SOAP 四大段 + 针灸协议。
不仅验证 #8/#13/#15/#18 修复，还覆盖 MEMORY.md 中 23 个已知问题的当前状态。

---

## 一、Subjective（主诉）

### IE Subjective
| 检查项 | 预期 | 方法 |
|--------|------|------|
| Pain Scale 三值 | Worst/Best/Current 使用 context 输入值 | 正则 `Worst: N`, `Best: N`, `Current: N` |
| Symptom Duration | 使用用户输入的 value+unit | 正则匹配 `{value} {unit}` |
| Pain Radiation | 使用用户输入 | 文本包含 context.painRadiation |
| Pain Types | 使用用户选择 | 文本包含每个 painType |
| Causative Factors | 使用用户输入 | 文本包含每个 factor |
| Relieving Factors | 使用用户输入 | 文本包含每个 factor |
| Associated Symptom | 使用用户选择的 symptom 类型 | 文本包含 symptom 名称 |
| Symptom Scale | 使用用户输入百分比 | 正则 `scale as XX%` |
| Pain Frequency | 使用用户输入 | 文本包含 frequency 文本 |
| Seed 变异 | 同输入不同 seed → 不同文本 | 对比 2 个 seed 的输出 |
| Seed 可复现 | 同 seed 同输入 → 相同文本 | 对比 2 次运行 |

### TX Subjective
| 检查项 | 预期 | 方法 |
|--------|------|------|
| Pain Scale 递减 | TX(n+1).pain ≤ TX(n).pain | 正则提取 `Pain Scale: X-Y /10` |
| Symptom Scale 递减 | 百分比只降不升 | 正则提取 `scale as XX%` |
| Pain Frequency 递减 | 频率只降不升 | 正则提取 frequency 行 |
| whatChanged 动态 (#15) | 匹配 associatedSymptom | 从 Assessment 反向验证 |
| response 文本 | 与实际维度变化一致 | 检查 "improvement/reducing" 与实际数值 |
| ADL 文本 | 出现在输出中 | 正则提取 ADL 描述 |

### 测试矩阵
- IE: 7 部位 × 5 symptom × 3 seed = 105 样本
- TX: 5 部位 × 5 symptom × 3 seed × 11 visits = 825 样本

---

## 二、Objective（客观检查）

### Muscles Testing
| 检查项 | 预期 | 方法 |
|--------|------|------|
| Tightness muscles | 来自 TEMPLATE_MUSCLES[bp] | 正则提取肌肉名，对照模板池 |
| Tightness grading | 与 severity 一致，TX 递减 | 正则提取 grading 文本 |
| Tenderness muscles | 来自 TEMPLATE_MUSCLES[bp] | 同上 |
| Tenderness grading | TX 递减 | 正则提取 `(+N)` |
| Spasm muscles | 来自 TEMPLATE_MUSCLES[bp] | 同上 |
| Spasm grading | TX 递减 | 正则提取 `(+N)` |
| Tightness trend 一致性 (#5) | trend=reducing 时 grading 应下降 | 对比相邻 visit |

### ROM
| 检查项 | 预期 | 方法 |
|--------|------|------|
| IE ROM 连续性 (#13) | pain 6→7 差异 ≤ 8 度 | 相邻 pain 级别对比 |
| IE ROM 范围 | pain 9-10 在 severe band | 度数检查 |
| TX ROM 单调递增 | 度数只增不减（或持平） | 正则提取度数序列 |
| ROM 与 romTrend 一致 (#1) | trend=improved 时度数应增加 | 对比 state.romTrend 与实际度数 |
| Strength grade | 与 severity 一致 | 正则提取 `N/5` |
| Strength TX 递增 | grade 只增不减 | 序列检查 |
| 部位动作完整性 | 每个部位输出正确的动作集 | 对照 BODY_PART_ROM[bp] |
| Bilateral 双侧 | bilateral 输出 Left+Right | 文本包含两侧 |
| Unilateral 单侧 | left/right 只输出对应侧 | 文本不包含另一侧 |

### Inspection
| 检查项 | 预期 | 方法 |
|--------|------|------|
| 位置正确 | SHOULDER 在前，其他在后 | 检查 Inspection 行位置 |
| TX 固定继承 (#19) | 各 visit 相同 | 对比序列 |

### 舌脉
| 检查项 | 预期 | 方法 |
|--------|------|------|
| 格式 | `tongue\n...\npulse\n...` | 正则匹配 |
| TX 固定继承 (#20) | 各 visit 相同 | 对比序列 |

### 测试矩阵
- IE ROM: 6 部位 × 7 pain levels × 10 seeds = 420 样本
- TX Muscles: 5 部位 × 3 seed × 11 visits = 165 样本
- TX ROM: 5 部位 × 3 seed × 11 visits = 165 样本

---

## 三、Assessment（评估）

### IE Assessment
| 检查项 | 预期 | 方法 |
|--------|------|------|
| 部位名称 | 包含正确部位 | 文本匹配 |
| Pattern 诊断 | 包含 localPattern | 文本匹配 |

### TX Assessment
| 检查项 | 预期 | 方法 |
|--------|------|------|
| whatChanged 动态 (#15) | 匹配 associatedSymptom 映射 | 5 种 symptom 各验证 |
| response 与维度一致 (#4) | "reducing spasm" 时 spasm 应实际下降 | 对比 state 与文本 |
| general condition (#22) | 固定 "good" | 文本匹配 |
| output-cap defer 回补 (#3) | defer 后 Assessment 完整 | 检查长序列末尾 |
| Pattern 诊断 | 包含 localPattern | 文本匹配 |

### 测试矩阵
- TX Assessment: 5 部位 × 5 symptom × 3 seed × 11 visits = 825 样本

---

## 四、Plan（治疗计划）

### IE Plan
| 检查项 | 预期 | 方法 |
|--------|------|------|
| Treatment principles | 包含部位相关原则 | 文本非空 |
| Goals (ST/LT) | 包含 pain/frequency/symptom goals | 正则匹配 |
| Frequency goals (#18) | 相对计算，非硬编码 | 数值验证 |

### TX Plan
| 检查项 | 预期 | 方法 |
|--------|------|------|
| Treatment principles | 非空 | 文本检查 |
| painScale 非硬编码 (#14) | 使用实际 painCurrent | 检查是否仍有 "7/10" |
| treatmentFocus 驱动 (#9) | 不同 visit 的 Plan 有变化 | 对比序列 |

### 测试矩阵
- IE Plan: 7 部位 × 4 frequency × 3 seed = 84 样本
- TX Plan: 5 部位 × 3 seed × 11 visits = 165 样本

---

## 五、Needle Protocol（针灸协议）

### 97810 穴位 (#8)
| 检查项 | 预期 | 方法 |
|--------|------|------|
| 标签 | "Acupuncture Points"（非 Front/Back Points） | 文本匹配 |
| 穴位来源 | TX: 4 组合并; IE: 全池随机 | 穴位对照模板池 |
| 穴位数量 | 4 个 | 计数 |
| 跨侧分布 | 不全部来自同侧 | 统计 front/back 比例 |

### 97813/97814 穴位
| 检查项 | 预期 | 方法 |
|--------|------|------|
| 穴位来源 | 来自 TEMPLATE_NEEDLE_POINTS[bp] | 对照模板池 |
| TX 穴位继承 (#21) | 各 visit 穴位一致或来自引擎 | 对比序列 |
| 穴位数量 | 符合 NEEDLE_GROUP_SIZES[bp] | 计数 |

### Needle Size
| 检查项 | 预期 | 方法 |
|--------|------|------|
| 格式 | `Select Needle Size :36#x0.5" , 34#x1" ,30# x1.5"` | 文本匹配 |

### 测试矩阵
- IE Needle: 6 部位 × 5 seed = 30 样本
- TX Needle: 5 部位 × 3 seed × 11 visits = 165 样本

---

## 六、纵向一致性（TX 序列）

### 单调性约束
| 维度 | 约束 | 方法 |
|------|------|------|
| Pain | 只降不升 | 数值序列检查 |
| Severity | 只降不升 | 等级序列检查 |
| Symptom Scale | 只降不升 | 百分比序列检查 |
| Frequency | 只降不升 | 等级序列检查 |
| Tightness | 只降不升 | grading 序列检查 |
| Tenderness | 只降不升 | grading 序列检查 |
| Spasm | 只降不升 | grading 序列检查 |
| ROM | 只增不减 | 度数序列检查 |
| Strength | 只增不减 | grade 序列检查 |
| Associated Symptom 等级 | 只降不升 | rank 序列检查 |

### Frequency Goals 相对计算 (#18)
| 起始 | ST goal | LT goal | 验证 |
|------|---------|---------|------|
| Constant(3) | Frequent(2) | Occasional(1) | 序列末尾 ≤ LT |
| Frequent(2) | Occasional(1) | Intermittent(0) | 同上 |
| Occasional(1) | Intermittent(0) | Intermittent(0) | 同上 |
| Intermittent(0) | 0 | 0 | 无变化 |

### PRNG 可复现
| 检查项 | 方法 |
|--------|------|
| 同 seed 同输入 → 相同全文 | 2 次生成对比 |
| 不同 seed → 不同全文 | 2 个 seed 对比 |

### 测试矩阵
- 5 部位 × 5 symptom × 4 frequency × 3 seed × 11 visits = 3300 样本

---

## 七、跨维度一致性

### romTrend vs ROM 文本 (#1)
- state.romTrend = "improved" → 本次 ROM 度数 > 上次
- state.romTrend = "stable" → 本次 ROM 度数 = 上次（±2度容差）

### response vs 实际变化 (#4)
- response 包含 "reducing spasm" → spasm grading 应下降
- response 包含 "reducing pain" → pain 应下降
- response 包含 "improving ROM" → ROM 应增加

### tightness trend vs grading (#5)
- tightness trend = "reducing" → grading 应下降

### adlItems vs 文本 (#6)
- state.adlItems 数量变化时，文本 ADL 应反映

### needlePoints vs 文本 (#8)
- state.needlePoints 应出现在渲染文本中

---

## 八、边界条件

### 极端 Pain
| 场景 | 预期 |
|------|------|
| pain=10 | severe, ROM 显著受限, 高 grading |
| pain=3 | mild, ROM 接近正常, 低 grading |
| pain=1 | minimal, ROM 正常 |

### 极端序列长度
| 场景 | 预期 |
|------|------|
| txCount=1 | 单次 TX 正常输出 |
| txCount=20 | 长序列末尾维度趋于稳定 |

### 缺失字段防御
| 场景 | 预期 |
|------|------|
| 无 severityLevel | fallback severityFromPain() |
| 无 chronicityLevel | fallback "Chronic" |
| 无 localPattern | fallback "Qi Stagnation" |
| 无 systemicPattern | 跳过相关句子 |
| 无 laterality | fallback "bilateral" |

### Pacemaker
| 场景 | 预期 |
|------|------|
| hasPacemaker=true | 针灸协议排除电刺激 |

---

## 九、统计扫描（大样本）

### 参数
- TX: 5 部位 × 5 symptom × 20 seeds × 11 visits = 5500 visit 样本
- IE: 6 部位 × 7 pain × 10 seeds = 420 样本

### 统计指标
| 指标 | 目标 |
|------|------|
| whatChanged 正确率 (#15) | 100% |
| whatChanged 错误 soreness 率 | 0%（非 soreness 患者） |
| frequency 硬编码残留率 (#18) | 0% |
| IE ROM 跳变 >10度 率 (#13) | 0% |
| 97810 全同侧率 (#8) | < 50% |
| 97810 标签错误率 | 0% |
| response-spasm 冲突率 (#4) | 统计（已知问题，记录当前值） |
| tightness trend 冲突率 (#5) | 统计（已知问题，记录当前值） |
| romTrend-ROM 脱节率 (#1) | 统计（已知问题，记录当前值） |
| Plan painScale=7 硬编码率 (#14) | 统计（已知问题，记录当前值） |
| TX Plan 全序列相同率 (#9) | 统计（已知问题，记录当前值） |
| 单调性违反率 | 0%（所有维度） |
| undefined 出现率 | 0% |
| 空行/格式异常率 | 0% |

---

## 十、执行顺序

### Phase A: 基础完整性（快速）
1. 30 个 fixture snapshot 全部通过
2. 7 部位 IE 生成不报错
3. 5 部位 TX 序列生成不报错
4. PRNG 可复现验证

### Phase B: 结构正确性（中等）
5. IE Subjective 用户输入贯通
6. TX 纵向单调性（10 维度）
7. ROM 部位动作完整性
8. Bilateral/Unilateral 正确性
9. Needle 穴位来源验证

### Phase C: 修复验证（#8 #13 #15 #18）
10. #15 whatChanged 5 种 symptom × 5 部位
11. #18 frequency goals 4 种起始 × 5 部位
12. #13 IE ROM 连续性 6 部位 × 7 pain
13. #8 97810 穴位 4 组合并

### Phase D: 跨维度一致性
14. romTrend vs ROM 文本
15. response vs 实际维度变化
16. tightness trend vs grading

### Phase E: 大样本统计扫描
17. 5500 TX visit + 420 IE 全量扫描
18. 统计报告生成

### Phase F: 边界条件
19. 极端 pain 值
20. 极端序列长度
21. 缺失字段防御
22. Pacemaker 特殊处理

---

## 产出物
- 每个 Phase 的 pass/fail 结果
- 大样本统计报告（数值 + 分布 + 已知问题当前状态）
- 新发现问题清单
- 建议修复优先级
