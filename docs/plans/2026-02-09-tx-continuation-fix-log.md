# TX 续写修复记录

> 创建时间: 2026-02-09 19:18
> 状态: 分析完成，待修复
> 关联文档: `docs/tx-continuation-issues.md` (65+ 问题完整清单)

---

## 一、问题总览

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| CRITICAL | 9 | 会导致审计失败 |
| HIGH | 12 | 明显不合理 |
| MEDIUM | 18+ | 可改善 |
| 架构级 | 8+ | 需要结构性重构 |

---

## 二、已确认的 CRITICAL 问题

| # | 问题 | 位置 | 根因 | 修复复杂度 |
|---|------|------|------|-----------|
| **#78** | `txVisits[0]` 取最早TX而非最新TX | `generator.js` L132 | `visits.reverse()` 后 `doc.visits` 是时间正序，`txVisits[0]` = 最早TX | 一行修复 |
| **#9** | Tenderness 纵向约束首次失效 (恶化) | `tx-sequence-engine.ts` L571 | `prevTendernessGrade = ''` → 首次循环跳过约束 | 从 initialState 初始化 |
| **#11** | 针刺协议严重退化 60min→15min | `soap-generator.ts` L22-29 | `INSURANCE_NEEDLE_MAP['OPTUM'] = '97810'` 强制简化 | 需重构映射逻辑 |
| **#13** | Assessment improvement 与 Objective 恶化矛盾 | `tx-sequence-engine.ts` L355 | `deriveAssessmentFromSOA` 不检查 tenderness 实际方向 | 需增加交叉验证 |
| **#21** | OPTUM 保险映射与实际不一致 | `soap-generator.ts` L22-29 | 系统假设 OPTUM 只能用 97810 | 同 #11 |
| **#33** | Severity mild-to-moderate 但 tenderness severe | 多处 | #9 的下游影响 | 修 #9 即可 |
| **#41** | General Condition 全部推断为 poor | `tx-sequence-engine.ts` L586-608 | Qi & Blood Deficiency + Chronic → 强制 poor | 需从 initialState 继承 |
| **#53** | OPTUM 电刺激矛盾 | `soap-generator.ts` L22-29 | 同 #11/#21 | 同 #11 |
| **#58** | Assessment 拼写不一致 | `soap-generator.ts` L2137 | TX 用 `Assesment`，ELBOW/NECK/LBP 模板用 `Assessment` | 统一拼写 |

---

## 三、字段分类分析结果

### 4 种核心问题模式

**模式 A — 动态字段不继承 (影响: #1, #6, #7)**
```
painTypes, ADL活动, tightness肌肉
→ 每次 calculateWeights 重新选择
→ 不从 visitState 读取上一个TX的值
→ 续写TX与输入TX内容完全不同
```

**模式 B — 静态字段不可变 (影响: #3, #5, #11, #51)**
```
symptomScale, inspection, tongue/pulse, 针刺协议
→ getConfig(MAP, bp) 或 INSURANCE_NEEDLE_MAP 硬编码
→ 即使输入TX有不同值也会被覆盖
```

**模式 C — engine 生成但 generator 忽略 (影响: #22, #51, #74)**
```
needlePoints, tonguePulse, treatmentFocus
→ engine pickSingle/pickMultiple 精心计算
→ generator 函数不接收 visitState 参数
→ 代码做了无用功
```

**模式 D — 半静态字段首次约束缺失 (影响: #9, #10)**
```
prevTendernessGrade = '', prevTightnessGrading = ''
→ 首次循环 prev !== '' 为 false
→ 跳过纵向约束检查
→ 续写首个TX可能恶化
```

### 额外发现: symptomChange 硬编码覆盖
```
tx-sequence-engine.ts L780: pickSingle('subjective.symptomChange', ...) → 选择了值
tx-sequence-engine.ts L939: symptomChange: 'improvement of symptom(s)' → 硬编码覆盖
→ pickSingle 的结果被丢弃
```

### 字段统计

| 类型 | 数量 | 说明 |
|------|------|------|
| S (静态硬编码) | 19 | 不随治疗进度变化 |
| D (动态不继承) | 12 | 每次重新权重选择 |
| H (半静态计算) | 9 | engine 计算但不从实际值反推 |
| C (链式推导) | 5 | 从 S→O 趋势推导 |

---

## 四、待继续调查项 — 已全部完成 ✅

| 调查项 | 结论 |
|--------|------|
| `parseOptumNote` reverse | ✅ `visits.reverse()` 转为时间正序，确认 #78 是 CRITICAL bug |
| `enrichVisitsWithInheritance` | ✅ 只继承 `systemicPattern` 1个字段，范围极其有限 |
| RE 生成 | ✅ 续写流程只生成 TX，不涉及 RE，暂无影响 |
| 多身体部位 secondaryBodyParts | ✅ `bridgeToContext` 硬编码 `[]`，续写时完全丢失 |
| HIP 支持 | ✅ 无专门配置，fallback 到 DEFAULT，已知限制 |
| `inferFieldPath` 不识别 symptomScale | ✅ 百分比选项不匹配任何分支，返回 `'unknown'` |
| 前端测试覆盖 | ✅ 不测试 txVisits 排序、initialState 完整性、纵向一致性 |

---

## 五、三套肌肉名称冲突

| 模块 | KNEE 肌肉 | 来源 |
|------|----------|------|
| `soap-generator.ts` MUSCLE_MAP | 13个 (Gluteus Maximus, Piriformis muscle, ...) | 模板原文 |
| `tx-sequence-engine.ts` MUSCLE_MAP | 11个 (quadriceps, hamstrings, ...) | 解剖学名称 |
| `weight-system.ts` bodyPartMuscles | 5个 (Quadriceps, Vastus lateralis, ...) | 简化列表 |

三套名称互不兼容，大小写不一致，同一肌肉有不同名称。

---

## 六、修复优先级

### Phase 0: 一行修复 (立即)
- [ ] `generator.js` L132: `txVisits[0]` → `txVisits[txVisits.length - 1]` (#78)

### Phase 1: 紧急修复 (阻塞审计)
- [ ] 扩展 `initialState` 类型，增加所有需要继承的字段 (#17)
- [ ] 从 `initialState` 初始化 `prevTendernessGrade` / `prevTightnessGrading` (#9, #10)
- [ ] 修复 OPTUM 保险针刺协议映射 (#11, #21, #53)
- [ ] `generateNeedleProtocol` 增加 `visitState` 参数 (#18, #22)

### Phase 2: 状态继承 (核心质量)
- [ ] painTypes 从 visitState 继承 (#1)
- [ ] associatedSymptoms 从 visitState 继承 (#2)
- [ ] symptomScale 随治疗进度递减 (#3)
- [ ] generalCondition 从 initialState 继承 (#4)
- [ ] inspection 从 visitState 继承 (#5)
- [ ] 肌肉列表从 visitState 继承 (#6)
- [ ] ADL 活动列表从 visitState 继承 (#7)

### Phase 3: 进度曲线优化
- [ ] Pain 停滞 — 接近 target 时切换到 longTermGoal (#19, #20)
- [ ] 进度曲线起点考虑已有TX (#34, #35)
- [ ] 频率改善速度控制 (#14)

### Phase 4: 文本质量
- [ ] `Assesment` → `Assessment` 统一拼写 (#15, #58)
- [ ] `continue to be emphasize` → `continue to emphasize` (#47)
- [ ] 治则与证型匹配 (#48)
- [ ] Reason 多样性 (#50)
- [ ] painTypes 与证型一致性 (#46)
- [ ] `symptomChange` 取消硬编码覆盖 (#39)

---

## 七、关键代码位置索引

| 文件 | 行号 | 内容 |
|------|------|------|
| `generator.js` L132 | `txVisits[0]` | #78 取错TX |
| `generator.js` L27-54 | `extractInitialState` | #75 只提取5个字段 |
| `tx-sequence-engine.ts` L571 | `prevTendernessGrade = ''` | #9 首次约束缺失 |
| `tx-sequence-engine.ts` L569 | `prevTightnessGrading = ''` | #10 同上 |
| `tx-sequence-engine.ts` L586-608 | `fixedGeneralCondition` | #41 强制推断 |
| `tx-sequence-engine.ts` L939 | `symptomChange: 'improvement...'` | #39 硬编码覆盖 |
| `soap-generator.ts` L22-29 | `INSURANCE_NEEDLE_MAP` | #11/#21/#53 |
| `soap-generator.ts` L312-316 | `SYMPTOM_SCALE_MAP` | #3 硬编码 |
| `soap-generator.ts` L1143-1146 | tongue/pulse | #51 忽略 visitState |
| `soap-generator.ts` L1469 | `TX_VERB_OPTIONS[0]` | #47 语法错误 |
| `soap-generator.ts` L1698 | `generatePlanTX` | #74 不接收 visitState |
| `soap-generator.ts` L1742 | `generateNeedleProtocol` | #22 不接收 visitState |
| `soap-generator.ts` L2137 | `Assesment` | #15/#58 拼写错误 |
| `bridge.ts` L82-195 | `bridgeVisitToSOAPNote` | #37 丢失关键信息 |
| `bridge.ts` L197-228 | `bridgeToContext` | #38 不传递 baselineCondition |
| `parser.ts` L163 | `visits.reverse()` | 确认时间正序 |
| `dropdown-parser.ts` L118-335 | `inferFieldPath` | #56 缺少 symptomScale |
