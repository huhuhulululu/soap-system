# TX 续写功能问题清单

> 测试场景: bilateral KNEE, Cold-Damp + Wind-Cold, Chronic, OPTUM
> 输入TX状态: Pain 6, Tightness moderate, Tenderness +2, Spasm +3, Frequency Frequent
> 续写3个TX (TX3→TX5)

---

## 一、状态继承断裂类

### 1. 疼痛类型 (painTypes) 未继承
- **输入TX**: `Dull, Aching`
- **续写TX3-5**: `Freezing, weighty`
- **原因**: `generateSubjectiveTX` 每次重新做权重选择，Cold-Damp证型权重偏向Freezing/weighty
- **临床问题**: 疼痛性质不应在连续治疗中突变
- **位置**: `soap-generator.ts` → `generateSubjectiveTX` L1533-1535

### 2. 关联症状 (associatedSymptoms) 未继承
- **输入TX**: `soreness, heaviness`
- **TX3**: `numbness` — 突变为更严重的症状
- **TX4-5**: `soreness` — 丢失了heaviness
- **原因**: tx-sequence-engine 有 associatedSymptomRank 纵向约束，但初始值未从上一个TX传入
- **位置**: `tx-sequence-engine.ts` L579 `prevAssociatedSymptom` 初始为空

### 3. 症状百分比 (symptomScale) 反向恶化
- **输入TX**: `50%`
- **续写TX3-5**: `70%-80%`
- **原因**: `getConfig(SYMPTOM_SCALE_MAP, bp)` 是静态配置，不随治疗进度变化，也不从上一个TX继承
- **临床问题**: 症状百分比应随治疗递减，不应从50%跳到70%-80%
- **位置**: `soap-generator.ts` → `generateSubjectiveTX` 中 `symptomScale` 是固定值

### 4. General Condition 未继承
- **输入TX**: `good`
- **续写TX3-5**: `fair`
- **原因**: `fixedGeneralCondition` 由 systemicPattern + chronicityLevel 自动推断 (Chronic + Qi Deficiency → fair)，忽略了已有TX中明确的good
- **位置**: `tx-sequence-engine.ts` L586-608 `fixedGeneralCondition` 闭包

### 5. Inspection 未继承
- **输入TX**: `local skin no damage or rash`
- **续写TX3-5**: `joint swelling`
- **原因**: `generateObjective` 中 inspection 是独立生成的，不从visitState继承
- **位置**: `soap-generator.ts` → `generateObjective`

### 6. 肌肉列表 (muscles) 未继承
- **输入TX tightness**: `Gluteus Maximus, Quadratus femoris, Adductor longus/brev/magnus, Rectus Femoris, Gastronemius, Plantar Fasciitis`
- **续写TX3-5**: `Hamstrings muscle group, Gluteus Maximus, Gluteus medius/minimus`
- **原因**: `generateObjective` 每次重新权重选择肌肉，不从visitState继承
- **同样影响**: tenderness muscles, spasm muscles
- **位置**: `soap-generator.ts` → `generateObjective`

### 7. ADL 活动列表未继承
- **输入TX Group1**: `Standing for long periods of time, Walking for long periods of time`
- **续写TX3-5 Group1**: `Going up and down stairs, Rising from a chair`
- **原因**: `generateSubjectiveTX` 每次重新权重选择ADL，不从visitState继承
- **位置**: `soap-generator.ts` → `generateSubjectiveTX` L1540-1545

### 8. ROM 具体数值未继承
- **输入TX**: 左右都是 `4-/5 Flexion: 100 Degrees(moderate)`
- **TX3**: 右 `4+/5 Flexion: 105 Degrees(mild)`, 左 `5/5 Flexion: 100 Degrees(moderate)`
- **原因**: ROM由 `romDeficit/strengthDeficit` 数值计算，但初始deficit未从上一个TX的实际ROM反推
- **位置**: `soap-generator.ts` → `generateObjective` 中ROM计算逻辑

---

## 二、纵向约束失败类

### 9. Tenderness 纵向约束首次失效 — 反向恶化
- **输入TX**: `(+2)`
- **TX3**: `(+3)` — 恶化了！
- **原因**: `prevTendernessGrade` 初始值为空字符串 `''`，第一次循环时约束条件 `prevTendernessGrade !== ''` 为false，跳过了约束检查
- **修复方向**: 从 `initialState.tenderness` 初始化 `prevTendernessGrade`
- **位置**: `tx-sequence-engine.ts` L571 初始化 + L849-855 约束逻辑

### 10. Tightness Grading 可能首次失效
- **输入TX**: `moderate`
- **TX3**: `Moderate` — 本次恰好没恶化，但同样存在首次约束缺失风险
- **原因**: 同#9，`prevTightnessGrading` 初始为空字符串
- **位置**: `tx-sequence-engine.ts` L569 初始化 + L808-813 约束逻辑

---

## 三、Plan/针刺协议类

### 11. 针刺协议严重退化
- **输入TX**: 4步, 前后各30分钟, 有电刺激, 多穴位组合, 60分钟
- **续写TX3-5**: 1步, 15分钟, 无电刺激, 仅 `A SHI POINTS`
- **原因**: `generateNeedleProtocol` 不接收 `visitState`，且 OPTUM 保险的 `INSURANCE_NEEDLE_MAP` 可能映射为简化协议
- **临床问题**: 针刺方案不应在连续治疗中突然从完整方案退化为最简方案
- **位置**: `soap-generator.ts` → `generateNeedleProtocol`

### 12. Treatment Time 不一致
- **输入TX**: `Total Operation Time: 60 mins`
- **续写TX3-5**: `Total Operation Time: 15 mins`
- **原因**: 同#11，保险映射问题
- **位置**: `soap-generator.ts` → `generateNeedleProtocol` 中 `INSURANCE_NEEDLE_MAP`

---

## 四、S→O→A 链一致性类

### 13. Assessment 中 "improvement" 与 Objective 趋势矛盾
- **TX3 Assessment**: `slight improvement of symptom(s)` + `reduced joint ROM limitation`
- **TX3 Objective**: tenderness 从+2恶化到+3
- **问题**: S说改善、A说改善，但O的tenderness实际恶化了，链条不一致

### 14. Assessment "decreased pain frequency" 但 Subjective 频率跳变过大
- **输入TX**: `Frequent (51%-75%)`
- **TX3**: `Occasional (26%-50%)` — 一次跳两级
- **TX4-5**: `Intermittent (<25%)` — 又跳一级
- **问题**: 频率改善过快，不符合临床渐进规律

---

## 五、格式/文本类

### 15. Assessment 拼写: "Assesment" (少一个s)
- **位置**: `soap-generator.ts` → `exportSOAPAsText` L2137
- **应为**: `Assessment`

### 16. Subjective 中 "associated with muscles numbness" 语法
- 当关联症状是numbness时，"muscles numbness" 不通顺，应为 "numbness in muscles" 或 "muscle numbness"

---

## 六、架构根因

### 17. `initialState` 类型过于简陋
当前 `TXSequenceOptions.initialState` 只有5个字段:
```typescript
{ pain, tightness, tenderness, spasm, frequency }
```
但续写需要继承的状态至少包括:
- painTypes, associatedSymptoms, symptomScale
- generalCondition, inspection
- muscles列表 (tightness/tenderness/spasm各自的)
- ADL活动列表 (两组)
- ROM具体数值 (每个movement的degrees和strength)
- needle protocol结构
- tightnessGrading文本, tendernessGrade文本 (用于纵向约束初始化)

### 18. `visitState` 未贯穿所有generator
- `generateSubjectiveTX` 接收visitState ✓ 但只用了部分字段
- `generateObjective` 接收visitState ✓ 但肌肉/inspection/ROM不从中读取
- `generateAssessmentTX` 接收visitState ✓
- `generatePlanTX` 不接收visitState ✗
- `generateNeedleProtocol` 不接收visitState ✗

---

## 七、Pain 进度停滞类

### 19. 续写3个TX的Pain全部相同 (5.5 → "6-5")
- **TX3**: Pain 5.5 (6-5)
- **TX4**: Pain 5.5 (6-5)
- **TX5**: Pain 5.5 (6-5)
- **原因**: 
  - `initialState.pain = 6`, `targetPain = parsePainTarget("5-6") = 5.5`
  - TX3 的 `tx1Decrease` (0.5~1.5) 把 pain 降到 ~5.5
  - TX4/TX5 的 `expectedPain = startPain - (startPain - targetPain) * progress` 在 progress 90%+ 时 ≈ targetPain = 5.5
  - `snapPainToGrid(5.5)` → `{ value: 6, label: "6-5" }`
  - 纵向约束 `Math.min(prevPain, snapped.value)` → `Math.min(5.5, 6)` = 5.5
  - 结果: 3个TX的pain完全相同，没有任何进展
- **根因**: 当 `initialState.pain` 已经接近 `targetPain` 时，续写的TX没有空间继续改善
- **位置**: `tx-sequence-engine.ts` L654-680 pain计算逻辑

### 20. Pain Target 计算不考虑续写起点
- `targetPain = parsePainTarget(IE.plan.shortTermGoal.painScaleTarget)` 始终基于IE的目标
- 当续写起点已经达到或接近短期目标时，应该切换到长期目标
- **位置**: `tx-sequence-engine.ts` L551-554

---

## 八、针刺协议深层问题

### 21. OPTUM 保险映射为 '97810' (简化协议) — 但输入TX是完整60分钟协议
- `INSURANCE_NEEDLE_MAP['OPTUM'] = '97810'` → `isFullCode = false`
- 简化协议: 15分钟, 1步, 无电刺激, 仅 `A SHI POINTS`
- **但输入TX明确是**: 60分钟, 4步, 有电刺激, 完整穴位组合
- **矛盾**: 保险类型映射与实际临床操作不一致
- **位置**: `soap-generator.ts` L22-29 `INSURANCE_NEEDLE_MAP`

### 22. `visitState.needlePoints` 生成了但从未使用
- `tx-sequence-engine.ts` L899: `pickMultiple('plan.needleProtocol.points', 6, ...)` 生成了穴位
- `TXVisitState.needlePoints` 存储了这些穴位
- 但 `generateNeedleProtocol(context)` 完全不接收 `visitState`，穴位全部硬编码
- **结果**: 引擎精心选择的穴位被完全忽略
- **位置**: `soap-generator.ts` L1742 `generateNeedleProtocol` 签名

### 23. 穴位跨TX重叠度 — checker V09 会报错
- checker `checkSequence` 中 V09 规则: `jaccard(prev.acupoints, cur.acupoints) < 0.4` → 报错
- 续写TX的穴位是硬编码的（全部相同），所以TX之间重叠度=1.0，不会触发V09
- 但如果输入TX的穴位与硬编码穴位不同，输入TX→续写TX3之间的重叠度可能很低
- **位置**: `note-checker.ts` L620-630

---

## 九、Checker 覆盖盲区

### 24. Checker 不检查 painTypes 纵向一致性
- 没有规则检查连续TX之间的疼痛类型是否突变
- 输入TX `Dull, Aching` → 续写TX `Freezing, weighty` 不会被发现
- **建议**: 添加 V10 规则检查 painTypes 的 jaccard 重叠度

### 25. Checker 不检查 symptomScale 纵向一致性
- 没有规则检查症状百分比是否合理递减
- 输入TX `50%` → 续写TX `70%-80%` (恶化) 不会被发现
- **建议**: 添加规则检查 symptomScale 不应恶化

### 26. Checker 不检查 inspection 纵向一致性
- 没有规则检查 inspection 是否在TX之间突变
- `local skin no damage or rash` → `joint swelling` 不会被发现
- **建议**: 添加规则检查 inspection 文本的相似度

### 27. Checker 不检查 muscle 列表纵向一致性
- 没有规则检查 tightness/tenderness/spasm 的肌肉列表是否在TX之间大幅变化
- 完全不同的肌肉列表不会被发现
- **建议**: 添加规则检查肌肉列表的 jaccard 重叠度

### 28. Checker T02 能发现 tenderness 恶化 + improvement 矛盾
- ✅ 如果输入TX作为prevVisit，续写TX3的tenderness从+2→+3，且Assessment说improvement
- T02 会报 CRITICAL: "标注 improvement 但数值实际恶化"
- **但**: 这只在有prevVisit时生效，续写场景中prevVisit是输入TX，需要确保parser正确解析

### 29. Checker V02 能发现 tenderness 纵向回升
- ✅ `checkSequence` 中 V02: `curTenderness > prevTenderness` → HIGH
- **但**: 同样依赖parser正确解析输入TX

---

## 十、Assessment 文本逻辑问题

### 30. "heaviness sensation" 在 Assessment 中出现但 Subjective 中可能只有 "soreness"
- 输入TX Assessment: `decreased muscles soreness sensation, heaviness sensation`
- 续写TX3 Subjective: `associated with muscles numbness` — 没有heaviness
- 续写TX3 Assessment: 没有提到具体症状，只说 `slightly decreased pain frequency`
- **问题**: Assessment 中的症状描述应该与 Subjective 中的关联症状一致
- **位置**: `deriveAssessmentFromSOA` 不考虑具体症状名称

### 31. Assessment "whatChanged" 选择逻辑过于简单
- `deriveAssessmentFromSOA` 中:
  - `frequencyImproved` → "pain frequency"
  - `adlDelta > 0.2` → "difficulty in performing ADLs"
  - else → "pain"
- 没有考虑: muscles soreness/heaviness/tenderness 等具体变化
- 输入TX的Assessment更丰富: "decreased muscles soreness sensation, heaviness sensation"
- **位置**: `tx-sequence-engine.ts` L355-360

---

## 十一、S→O 链断裂细节

### 32. Subjective "associated with muscles numbness" 但 Objective 没有 numbness 相关检查
- TX3 Subjective 说 numbness，但 Objective 没有感觉测试
- 临床上 numbness 需要感觉检查 (sensory testing)，但模板没有这个section
- **影响**: 审计时可能被质疑 S→O 不一致

### 33. Subjective severity "mild to moderate" 但 Objective tenderness "+3" (severe)
- TX3: severity = `mild to moderate` (从 pain 5.5 推导)
- TX3: tenderness = `(+3) = severe tenderness with withdrawal`
- **矛盾**: mild to moderate 的患者不应该有 severe tenderness
- **根因**: tenderness 纵向约束首次失效 (问题#9)，加上 pain→tenderness 映射在首次续写时没有从 initialState 初始化

---

## 十二、进度曲线问题

### 34. 续写时 progress 起点过高
- `txCount=5, startVisitIndex=3` → `remainingTx = 5 - 3 + 1 = 3`
- TX3: `localIndex=1, progressLinear=1/3=0.33` → S曲线后 progress≈0.64
- TX4: `localIndex=2, progressLinear=2/3=0.67` → progress≈0.91
- TX5: `localIndex=3, progressLinear=3/3=1.0` → progress≈0.98
- **问题**: 续写3个TX，第一个就已经64%进度，第二个91%，变化空间极小
- **根因**: `progressLinear = localIndex / remainingTx` 只看续写部分的相对位置，不考虑全局进度
- **应该**: 考虑 `startVisitIndex / txCount` 作为起始进度，续写部分在剩余进度空间内分配

### 35. `prevProgress` 初始值为0，但续写起点应该有已有进度
- `let prevProgress = 0` — 硬编码
- 续写时应该从 `(startVisitIndex - 1) / txCount` 开始
- **位置**: `tx-sequence-engine.ts` L563

---

## 问题严重程度分级

### CRITICAL (会导致审计失败)
- #9 Tenderness 纵向约束首次失效 (恶化)
- #11 针刺协议严重退化 (60min→15min)
- #13 Assessment improvement 与 Objective 恶化矛盾
- #21 OPTUM 保险映射与实际不一致
- #33 Severity mild-to-moderate 但 tenderness severe

### HIGH (明显不合理)
- #1 疼痛类型突变
- #2 关联症状突变
- #3 症状百分比反向恶化
- #6 肌肉列表完全不同
- #7 ADL活动列表不同
- #14 频率改善过快
- #19 Pain 3个TX完全相同

### MEDIUM (可改善)
- #4 General Condition 未继承
- #5 Inspection 未继承
- #8 ROM 未继承
- #10 Tightness 首次约束缺失风险
- #15 Assessment 拼写错误
- #16 语法问题
- #20 Pain Target 不考虑续写起点
- #22 needlePoints 生成但未使用
- #30-31 Assessment 文本逻辑简单
- #34-35 进度曲线起点问题

### 架构级
- #17 initialState 类型过于简陋
- #18 visitState 未贯穿所有 generator
- #24-27 Checker 覆盖盲区

---

## 十三、双 MUSCLE_MAP / ADL_MAP 定义冲突

### 36. `tx-sequence-engine.ts` 和 `soap-generator.ts` 各自定义了不同的 MUSCLE_MAP
- `soap-generator.ts` KNEE muscles: `Gluteus Maximus, Gluteus medius/minimus, Piriformis, Quadratus femoris, Adductor longus/brev/magnus, ITB, Rectus Femoris, Gastronemius, Hamstrings, Tibialis Post/Anterior, Plantar Fasciitis, Intrinsic Foot Muscle group, Achilles Tendon` (13个, 来自模板)
- `tx-sequence-engine.ts` KNEE muscles: `quadriceps, hamstrings, gastrocnemius, popliteus, sartorius, gracilis, tensor fasciae latae, iliotibial band, vastus medialis, vastus lateralis, rectus femoris` (11个, 解剖学名称)
- **问题**: 两套完全不同的肌肉名称！soap-generator用的是模板中的临床名称，tx-sequence-engine用的是解剖学名称
- **影响**: tx-sequence-engine中的ADL_MAP也是不同的 (如 `walking, climbing stairs` vs `Walking for long periods of time, Going up and down stairs`)
- **结果**: 即使visitState传了肌肉信息，名称也对不上

### 37. `bridgeVisitToSOAPNote` 丢失了关键信息
- `associatedSymptoms: []` — 永远为空！不从visit中提取
- `causativeFactors: []` — 永远为空
- `exacerbatingFactors: []` — 永远为空
- `relievingFactors: []` — 永远为空
- `activityChanges: []` — 永远为空
- `treatmentPrinciples.focusOn: 'focus'` — 硬编码，不从visit提取
- **位置**: `bridge.ts` L82-195

### 38. `bridgeToContext` 不传递 `baselineCondition`
- `GenerationContext.baselineCondition` 未设置
- 导致 `fixedGeneralCondition` 每次从 systemicPattern 重新推断
- 即使输入TX的Assessment明确写了 `good`，也会被覆盖
- **位置**: `bridge.ts` L197-228

---

## 十四、symptomChange 永远是 "improvement"

### 39. `addProgressBias` 强制 symptomChange = "improvement of symptom(s)"
- `symptomChange` 字段: `improvement of symptom(s)` 获得 +80 偏置
- `exacerbate` 获得 -100 偏置
- `similar` 获得 -100 偏置
- `came back` 获得 -60 偏置
- **结果**: 无论实际进展如何，symptomChange 永远是 "improvement"
- **临床问题**: 即使pain停滞不变 (如3个TX都是5.5)，仍然说 "improvement"
- **位置**: `tx-sequence-engine.ts` L453-457

### 40. `TXVisitState.soaChain.subjective.painChange` 类型固定为 `'improved'`
- TypeScript类型定义: `painChange: 'improved'` — 字面量类型，不允许其他值
- 同样: `adlChange: 'improved'` — 也是固定的
- **问题**: 类型系统本身就不允许表达 "stable" 或 "worsened" 的状态
- **位置**: `tx-sequence-engine.ts` L222-225

---

## 十五、跨身体部位验证 (SHOULDER/NECK/LBP 均确认)

### 41. 所有身体部位的 General Condition 都是 "poor"
- 测试: Chronic + Qi & Blood Deficiency → `fixedGeneralCondition` = "poor"
- `isMultiDeficiency = (sp.includes('qi') && sp.includes('blood'))` → true
- `isChronic && isMultiDeficiency` → "poor"
- **问题**: 即使患者实际状况是good/fair，系统也会根据证型强制推断为poor
- **所有身体部位均受影响**

### 42. 所有身体部位的 Pain 都停滞在 5.5 (6-5)
- SHOULDER TX2-3: 5.5, 5.5
- NECK TX2-3: 5.5, 5.5
- LBP TX2-3: 5.5, 5.5
- **确认**: 这是系统性问题，不限于KNEE

### 43. 所有身体部位的 Plan 都退化为 15分钟简化协议
- OPTUM → '97810' → 15分钟, 1步, 无电刺激
- **所有身体部位均受影响**
- SHOULDER/NECK 的针号也变了 (36#x0.5" 出现了，但实际可能不适用)

### 44. NECK 的 Subjective 方向格式问题
- bilateral NECK: `pain in neck area` — 没有显示 bilateral
- 代码: `laterality === 'bilateral' ? 'in' : ...` → 只输出 "in"
- **问题**: 丢失了 bilateral 信息
- **位置**: `soap-generator.ts` → `generateSubjectiveTX` NECK分支

### 45. 治则文本不随证型变化
- 所有身体部位: `promote circulation, relieves pain to speed up the recovery, soothe the tendon`
- 但证型是 `Qi Stagnation, Blood Stasis`，治则应该是 "活血化瘀, 行气止痛"
- **原因**: `generatePlanTX` 中 `TX_TREATMENT_OPTIONS` 的权重选择可能没有正确匹配证型
- **位置**: `soap-generator.ts` → `generatePlanTX`

### 46. 疼痛类型 "Burning" 在所有身体部位出现
- SHOULDER: `Dull, Burning`
- NECK: `Dull, Burning`
- LBP: `Dull, Burning`
- 但证型是 `Qi Stagnation, Blood Stasis`，不应该有 Burning (Burning 对应热证)
- **原因**: `generateSubjectiveTX` 中 painTypes 权重选择没有正确排除与证型矛盾的选项
- **位置**: `soap-generator.ts` → `generateSubjectiveTX` L1533-1535

### 47. Plan 治则动词 "continue to be emphasize" 语法错误
- 所有续写TX: `continue to be emphasize on promote circulation...`
- **语法问题**: "continue to be emphasize" 应为 "continue to emphasize" 或 "continue emphasizing"
- **来源**: `TX_VERB_OPTIONS[0] = 'continue to be emphasize'` — 模板原文就有语法错误
- **位置**: `soap-generator.ts` L1469

### 48. Plan 治则内容与证型不匹配
- 证型: `Qi Stagnation, Blood Stasis`
- 输出: `promote circulation, relieves pain` — 部分匹配
- 但更准确的应该是: `activating Blood circulation to dissipate blood stagnant` 或 `activate blood and relax tendons`
- **原因**: `calculateWeights('plan.treatmentPrinciples', TX_TREATMENT_OPTIONS, weightContext)` 的权重逻辑可能没有正确匹配 Blood Stasis 证型
- **位置**: `soap-generator.ts` → `generatePlanTX`

### 49. Plan 治则 "soothe the tendon" 是硬编码后缀
- `plan += \`${selectedVerb} on ${selectedTreatment} to speed up the recovery, soothe the tendon.\``
- "to speed up the recovery, soothe the tendon" 是固定文本，不随证型变化
- 对于某些证型 (如 Damp-Heat)，"soothe the tendon" 可能不是主要治则
- **位置**: `soap-generator.ts` → `generatePlanTX` L1724

### 50. TX Reason 缺乏多样性
- SHOULDER: `sleep quality improved`
- NECK: `energy level improved`
- LBP: `energy level improved`
- 所有续写TX的reason都集中在 energy/sleep 相关
- **原因**: `applyTxReasonChain` 对 improvement + Deficiency 证型给 energy/sleep 加了 +45/+30 的巨大偏置
- **位置**: `soap-generator.ts` → `applyTxReasonChain` L1430-1440

---

## 问题严重程度分级 (更新)

### CRITICAL (会导致审计失败)
- #9 Tenderness 纵向约束首次失效 (恶化)
- #11 针刺协议严重退化 (60min→15min) — 所有身体部位
- #13 Assessment improvement 与 Objective 恶化矛盾
- #21 OPTUM 保险映射与实际不一致
- #33 Severity mild-to-moderate 但 tenderness severe
- #41 General Condition 全部推断为 "poor" (Qi & Blood Deficiency)

### HIGH (明显不合理)
- #1 疼痛类型突变 — 所有身体部位
- #2 关联症状突变
- #3 症状百分比反向恶化
- #6 肌肉列表完全不同
- #7 ADL活动列表不同
- #14 频率改善过快
- #19 Pain 所有TX完全相同 — 所有身体部位
- #36 双 MUSCLE_MAP 定义冲突
- #39 symptomChange 永远是 improvement
- #46 Burning 疼痛类型与证型矛盾

### MEDIUM (可改善)
- #4 General Condition 未继承
- #5 Inspection 未继承
- #8 ROM 未继承
- #10 Tightness 首次约束缺失风险
- #15 Assessment 拼写错误 "Assesment"
- #16 语法问题 "muscles numbness"
- #20 Pain Target 不考虑续写起点
- #22 needlePoints 生成但未使用
- #30-31 Assessment 文本逻辑简单
- #34-35 进度曲线起点问题
- #37 bridgeVisitToSOAPNote 丢失关键信息
- #38 bridgeToContext 不传递 baselineCondition
- #44 NECK bilateral 方向丢失
- #47 "continue to be emphasize" 语法错误
- #48 治则内容与证型不匹配
- #49 "soothe the tendon" 硬编码
- #50 TX Reason 缺乏多样性

### 架构级
- #17 initialState 类型过于简陋
- #18 visitState 未贯穿所有 generator
- #24-27 Checker 覆盖盲区
- #36 双 MUSCLE_MAP/ADL_MAP 定义冲突
- #40 TXVisitState.soaChain 类型限制

---

## 十六、舌脉继承问题

### 51. `generateObjective` 忽略 `visitState.tonguePulse`
- `tx-sequence-engine` 中 `fixedTonguePulse` 正确从IE继承了舌脉
- `TXVisitState.tonguePulse` 存储了继承的值
- 但 `generateObjective` 直接用 `TONE_MAP[context.localPattern].tongueDefault`，不读 `visitState.tonguePulse`
- **影响**: 如果IE的舌脉被医生手动修改（非默认值），续写TX的舌脉会回退到默认值
- **位置**: `soap-generator.ts` L1143-1146

### 52. `isTonePatternConsistent` 不检查 Cold-Damp + Wind-Cold 证型
- checker 中 `isTonePatternConsistent` 只检查 Qi Stagnation、Blood Stasis、Phlegm-Damp
- Cold-Damp + Wind-Cold 证型（你的测试场景）不在检查范围内
- **影响**: 即使舌脉与证型不一致，checker也不会报错
- **位置**: `note-checker.ts` L44-53

---

## 十七、OPTUM 保险 + 电刺激矛盾

### 53. OPTUM 保险被系统强制为无电刺激，但实际临床可能有电刺激
- `INSURANCE_NEEDLE_MAP['OPTUM'] = '97810'` → 无电刺激
- `formatIcdCpt`: OPTUM → `97810/97811` (without estim)
- `generateNeedleProtocol`: OPTUM → 15分钟简化协议，无电刺激
- **但**: 你的输入TX明确有电刺激 (`with electrical stimulation GB33, GB34, GB36`)
- **根因**: 系统假设 OPTUM 保险只能用 97810 (无电刺激)，但实际临床中 OPTUM 也可能使用 97813 (有电刺激)
- **影响**: 续写TX的CPT代码和针刺协议与输入TX不一致
- **位置**: `soap-generator.ts` L22-29, `generator.js` L69-73

### 54. 前端 `generateContinuation` 不传递 `treatmentTime`
- `generateContinuation` 接收 `options.treatmentTime` 但只用于 `formatIcdCpt`
- 不传递给 `generateTXSequenceStates` 或 `exportSOAPAsText`
- `generateNeedleProtocol` 的时间由 `INSURANCE_NEEDLE_MAP` 决定，不受 `treatmentTime` 影响
- **影响**: 即使用户指定 `treatmentTime=60`，OPTUM 仍然生成15分钟协议
- **位置**: `generator.js` L94-166

---

## 十八、Whitelist 问题

### 55. Whitelist 中 `objective.muscleTesting.muscles` 不按身体部位区分
- 只有24个肌肉，混合了 LBP (7个) + KNEE (13个) + NECK (4个) 的肌肉
- 没有 SHOULDER 的肌肉 (upper trapezius, greater tuberosity 等)
- **影响**: `pickMultiple('objective.muscleTesting.muscles', ...)` 可能选到不属于当前身体部位的肌肉
- **但**: `generateObjective` 不用 whitelist 选肌肉，而是用 `MUSCLE_MAP[bp]` 硬编码
- **实际影响有限**: 只影响 `tx-sequence-engine` 中的 `pickMultiple`，而那个结果也没被 `generateObjective` 使用

### 56. Whitelist 中没有 `subjective.symptomScale` 字段
- 症状百分比 (如 "50%", "70%-80%") 不在 whitelist 中
- 但 TX 模板中确实有这个下拉框: `ppnSelectCombo 10%|10%-20%|20%|...|100%`
- **原因**: `buildTemplateWhitelist` 中 `inferFieldPath` 可能没有正确识别这个字段
- **影响**: `pickSingle` 无法选择 symptomScale，只能用硬编码的 `SYMPTOM_SCALE_MAP`

---

## 十九、TX 模板结构发现

### 57. TX 模板没有 Objective section
- TX 模板 (AC-TX KNEE.md 等) 只有 Subjective、Assessment(Assesment)、Plan 三个section
- Objective 完全由代码生成 (`generateObjective`)
- **影响**: Objective 的所有内容（肌肉、ROM、Inspection、舌脉）都是代码逻辑决定的，没有模板约束
- **这解释了为什么**: 肌肉列表、Inspection、ROM 等在续写时会完全重新生成

### 58. TX 模板中 "Assesment" 拼写不一致
- KNEE: `Assesment` (少一个s)
- SHOULDER: `Assesment` (少一个s)
- ELBOW: `Assessment` (正确)
- NECK: `Assessment` (正确)
- LBP: `Assessment` (正确，但LBP模板没有Subjective行头)
- **代码**: `exportSOAPAsText` 中 TX 用 `Assesment` — 匹配 KNEE/SHOULDER 模板
- **问题**: ELBOW/NECK/LBP 的 TX 输出用了错误的拼写

### 59. LBP TX 模板缺少 Subjective 行头
- `head -6 AC-TX LBP.md` 输出: `Assessment\nPlan` — 没有 Subjective
- **可能原因**: 模板文件格式问题，Subjective 内容可能在第一行但没有标题

---

## 二十、批量测试覆盖盲区

### 60. `batch-continuation-test.ts` 不测试续写场景
- 只测试从IE开始生成全部11个TX
- 不测试 `initialState` 的继承
- 不测试从已有TX续写的场景
- **结果**: 100%通过率掩盖了续写场景的所有问题

### 61. 批量测试不检查 painTypes 与证型一致性
- `auditTX` 不检查 painTypes 是否与 localPattern 匹配
- `auditIE` 也不检查
- **但**: checker 的 `S2` 规则会检查

### 62. 批量测试不检查 symptomScale 合理性
- 不检查症状百分比是否随治疗递减
- 不检查 symptomScale 与 pain 的关系

### 63. 批量测试不检查肌肉列表与身体部位一致性
- `auditTX` 不检查肌肉是否属于当前身体部位
- **但**: checker 的 `O8` 规则会检查

---

## 二十一、`severityFromPain` 边界问题

### 64. Pain 6 → severity "moderate"，但输入TX写的是 "moderate to severe"
- `severityFromPain(6)` = `moderate` (6 >= 6 但 < 7)
- 你的输入TX ADL: `moderate to severe difficulty`
- **矛盾**: 输入TX本身就不符合 `severityFromPain` 的映射
- **影响**: checker TX01 会报这个不一致
- **但**: 这可能是医生手动选择的，系统应该尊重而不是覆盖

### 65. Pain 5.5 → severity "mild to moderate"，跳过了 "moderate"
- `severityFromPain(5.5)` = `mild to moderate` (5.5 >= 4 但 < 6)
- 从 pain 6 (moderate) 到 pain 5.5 (mild to moderate)，severity 跳了一级
- **影响**: ADL difficulty 从 "moderate to severe" 直接变成 "mild to moderate"，跳了两级
- **临床问题**: severity 变化应该更平滑

---

## 问题严重程度分级 (最终更新)

### CRITICAL (会导致审计失败) — 9个
- #78 ⭐ `txVisits[0]` 取最早TX而非最新TX — 续写起点完全错误
- #9 Tenderness 纵向约束首次失效 (恶化)
- #11 针刺协议严重退化 (60min→15min) — 所有身体部位
- #13 Assessment improvement 与 Objective 恶化矛盾
- #21 OPTUM 保险映射与实际不一致
- #33 Severity mild-to-moderate 但 tenderness severe
- #41 General Condition 全部推断为 "poor" (Qi & Blood Deficiency)
- #53 OPTUM 电刺激矛盾
- #58 Assessment 拼写不一致影响 ELBOW/NECK/LBP

### HIGH (明显不合理) — 12个
- #1 疼痛类型突变 — 所有身体部位
- #2 关联症状突变
- #3 症状百分比反向恶化
- #6 肌肉列表完全不同
- #7 ADL活动列表不同
- #14 频率改善过快
- #19 Pain 所有TX完全相同 — 所有身体部位
- #36 双 MUSCLE_MAP 定义冲突
- #39 symptomChange 永远是 improvement
- #46 Burning 疼痛类型与证型矛盾
- #51 generateObjective 忽略 visitState.tonguePulse
- #65 Severity 跳级过大

### MEDIUM (可改善) — 18个
- #4 General Condition 未继承
- #5 Inspection 未继承
- #8 ROM 未继承
- #10 Tightness 首次约束缺失风险
- #15 Assessment 拼写错误 "Assesment"
- #16 语法问题 "muscles numbness"
- #20 Pain Target 不考虑续写起点
- #22 needlePoints 生成但未使用
- #30-31 Assessment 文本逻辑简单
- #34-35 进度曲线起点问题
- #37 bridgeVisitToSOAPNote 丢失关键信息
- #38 bridgeToContext 不传递 baselineCondition
- #44 NECK bilateral 方向丢失
- #47 "continue to be emphasize" 语法错误
- #48 治则内容与证型不匹配
- #49 "soothe the tendon" 硬编码
- #50 TX Reason 缺乏多样性
- #54 generateContinuation 不传递 treatmentTime
- #56 Whitelist 缺少 symptomScale 字段
- #64 输入TX本身 severity 不一致

### 架构级 — 8个
- #17 initialState 类型过于简陋
- #18 visitState 未贯穿所有 generator
- #24-27 Checker 覆盖盲区
- #36 双 MUSCLE_MAP/ADL_MAP 定义冲突
- #40 TXVisitState.soaChain 类型限制
- #52 isTonePatternConsistent 覆盖不全
- #55 Whitelist muscles 不按身体部位区分
- #57 TX模板无Objective section
- #60 批量测试不覆盖续写场景

---

## 二十二、Parser 解析问题

### 66. 穴位解析只取第一个 step 的穴位
- `acupointsPattern1` 用 `block.match()` 只匹配第一个 `with/without electrical stimulation` 后的穴位
- 4步针刺协议中只解析了1步的穴位
- **测试结果**: 输入TX有 GB33/GB34/GB36 + SP9/XI YAN/HE DING/A SHI POINT + BL40/BL57 + BL23/BL55/A SHI POINTS，但只解析出 `['SP9', 'XI YAN', 'HE DING', 'A SHI POINT']`（step 2的穴位，因为step 1的 `GB33, GB34, GB36` 后面紧跟换行，被 `\n\n` 截断了）
- **影响**: checker V09 (穴位重叠度) 基于不完整的穴位列表判断
- **影响**: `extractInitialState` 无法获取完整穴位信息
- **位置**: `parser.ts` L812-815

### 67. `muscleWeaknessScale` 解析失败 — 多症状格式不匹配
- Regex: `muscles?\s+(?:weakness|soreness|heaviness|numbness)\s*\(?\s*scale\s+as\s+(\d+%)`
- 输入: `muscles soreness, heaviness (scale as 50%)`
- **问题**: regex 只匹配 `muscles` 后面紧跟单个症状词，但输入是逗号分隔的多个症状
- **结果**: `muscleWeaknessScale` 为空字符串
- **影响**: checker S7 (muscleWeaknessScale vs pain) 无法检查
- **影响**: `bridgeVisitToSOAPNote` 中 `symptomPercentage` fallback 到 '70%'
- **位置**: `parser.ts` L369-371

### 68. TX Pain Scale 只有 `value`，没有 `worst/best`
- TX格式: `Pain Scale: 6 /10` — 只有一个数字
- IE格式: `Worst: 8 Best: 6 Current: 7` — 三个数字
- Parser 对TX返回 `{ value: 6 }`，对IE返回 `{ worst: 8, best: 6, current: 7 }`
- **影响**: `extractInitialState` 中 `ps?.current ?? ps?.value` 能正确取到6
- **但**: `bridgeVisitToSOAPNote` 中 `(visit.subjective.painScale as any).worst` 对TX返回 undefined
- **位置**: `parser.ts` → `parsePainScale`

### 69. Parser 不解析 `associatedSymptoms` 为结构化数据
- 输入: `associated with muscles soreness, heaviness`
- Parser 不提取 `['soreness', 'heaviness']` 作为数组
- 只在 `chiefComplaint` 原始文本中保留
- **影响**: `bridgeVisitToSOAPNote` 中 `associatedSymptoms: []` 永远为空
- **位置**: `parser.ts` → `parseSubjective`

### 70. Parser 不解析 `painTypes` 为结构化数据（TX格式）
- IE格式: `Patient c/o Chronic Dull, Aching pain` — parser 能解析
- TX格式: `Patient still c/o Dull, Aching pain` — parser 也能解析
- **但**: `extractBodyPart` 和 `parseBodyPartAndLaterality` 可能干扰 painTypes 提取
- **需验证**: parser 对TX的 painTypes 解析是否完整

---

## 二十三、Weight System 三套肌肉名称冲突

### 71. 三个模块各自定义了不同的 KNEE 肌肉列表
| 模块 | 肌肉名称 | 来源 |
|------|----------|------|
| `soap-generator.ts` MUSCLE_MAP | Gluteus Maximus, Gluteus medius/minimus, Piriformis, Quadratus femoris, Adductor longus/brev/magnus, ITB, Rectus Femoris, Gastronemius, Hamstrings, Tibialis Post/Anterior, Plantar Fasciitis, Intrinsic Foot Muscle group, Achilles Tendon (13个) | 模板原文 |
| `tx-sequence-engine.ts` MUSCLE_MAP | quadriceps, hamstrings, gastrocnemius, popliteus, sartorius, gracilis, tensor fasciae latae, iliotibial band, vastus medialis, vastus lateralis, rectus femoris (11个) | 解剖学名称 |
| `weight-system.ts` bodyPartMuscles | Quadriceps, Vastus lateralis, Vastus medialis, Hamstrings, Gastrocnemius (5个) | 简化列表 |
- **问题**: 三套名称互不兼容，大小写不一致，同一肌肉有不同名称
- **影响**: 权重系统的肌肉偏好无法正确应用到生成器的肌肉选择

### 72. `weightMuscles` 中 SHOULDER 肌肉列表与模板不匹配
- `weight-system.ts`: `['Deltoid', 'Supraspinatus', 'Infraspinatus', 'Teres Minor', 'Trapezius', 'Rhomboid']`
- `soap-generator.ts` MUSCLE_MAP: `['upper trapezius', 'greater tuberosity', 'lesser tuberosity', 'AC joint', 'levator scapula', 'rhomboids', 'middle deltoid', 'deltoid ant fibres', 'bicep long head', 'supraspinatus', 'triceps short head']`
- **问题**: 权重系统用的是标准解剖学名称，但生成器用的是模板中的临床名称

---

## 二十四、`selectBestOption` 确定性问题

### 73. 所有动词权重相同时，`selectBestOption` 总是选第一个
- `TX_VERB_OPTIONS = ['continue to be emphasize', 'emphasize', ...]`
- 所有权重都是50（默认），没有任何规则给动词加权
- `selectBestOption` 选权重最高的，相同时选第一个
- **结果**: 永远选 `continue to be emphasize`（语法错误的那个）
- **位置**: `soap-generator.ts` → `generatePlanTX` L1716

### 74. `generatePlanTX` 不接收 `visitState`
- `visitState.treatmentFocus` 存储了 `pickSingle('assessment.treatmentPrinciples.focusOn', ...)` 的结果
- 但 `generatePlanTX(context)` 不接收 `visitState`，完全忽略了这个值
- **影响**: 每次续写TX的治则动词都是重新选择的，不从 visitState 继承
- **位置**: `soap-generator.ts` L1698

---

## 二十五、`extractInitialState` 信息丢失

### 75. `extractInitialState` 不提取 painTypes
- 只提取 pain/tightness/tenderness/spasm/frequency
- 不提取: painTypes, associatedSymptoms, symptomScale, generalCondition, inspection, muscles, ADL, ROM, acupoints, treatmentPrinciples
- **位置**: `generator.js` L27-54

### 76. `extractInitialState` 的 tightness 映射不完整
- `tMap = { severe: 4, 'moderate to severe': 3.5, moderate: 3, 'mild to moderate': 2, mild: 1 }`
- 但 `visit.objective.tightnessMuscles.gradingScale` 可能是 `Moderate`（首字母大写）
- `.toLowerCase()` 处理了大小写，但 `3.5` 不是整数，后续 `prevTightness` 初始化为 `3.5` 可能导致比较问题
- **位置**: `generator.js` L36

### 77. `extractInitialState` 的 tenderness 解析依赖正则
- `tenderDesc.match(/\+(\d)/)` 从 `scaleDescription` 中提取数字
- 如果 `scaleDescription` 格式不标准（如缺少 `+` 号），会 fallback 到 3
- **位置**: `generator.js` L40-41

---

## 二十六、`generateContinuation` 流程问题

### 78. `generateContinuation` 中 `txVisits[0]` 取的是最早的TX，不是最新的 ❌ CRITICAL
- 注释: `parser reverse 后最新在前，即 txVisits[0]`
- **实际**: `parseOptumNote` 中 `visits.reverse()` 把PDF倒序转为时间正序（IE在前，最新TX在后）
- `doc.visits` 是时间正序的，`txVisits[0]` 是**最早的TX**
- **应该**: `txVisits[txVisits.length - 1]` 才是最新的TX
- **影响**: `initialState` 从最早的TX提取，导致续写起点完全错误
- **严重程度**: CRITICAL — 这是续写功能的核心bug
- **位置**: `generator.js` L138-139

### 79. `generateContinuation` 不验证 `bridgeToContext` 的结果
- `bridgeToContext` 可能推断出错误的 bodyPart/laterality/localPattern
- 没有与已有TX的实际内容做交叉验证
- **影响**: 如果IE和TX的身体部位不同（如IE是KNEE但TX是SHOULDER），系统不会报错

---

## 待继续调查 — 已完成

### ✅ `parseOptumNote` 是否对 visits 做了 reverse
- **确认**: `parser.ts` L163: `visits.reverse()` 将 PDF 倒序（最新在前）转为时间正序（IE在前，最新TX在后）
- **结果**: `doc.visits` 是时间正序的，`visits[0]` = IE，`visits[last]` = 最新TX
- **影响**: 确认 #78 是 CRITICAL bug — `txVisits[0]` 取的是最早TX而非最新TX

### ✅ `enrichVisitsWithInheritance` 的继承逻辑是否正确
- **确认**: `parser.ts` L177-187: 只继承 `systemicPattern`（整体证型），从IE传递到没有证型的TX
- **问题**: 继承范围极其有限，只有1个字段
- **缺失**: 不继承 localPattern、bodyPart、laterality、painTypes 等任何其他字段
- **影响**: 如果TX的assessment没有解析出systemicPattern，会从IE继承；其他字段全部独立解析

### ✅ RE (Re-Evaluation) 类型的生成是否也有类似问题
- **确认**: 系统中 RE 只在 `plan-generator.ts` 的 `evaluationType` 下拉选项中出现
- `bridge.ts` L166: 非IE的visit都映射为 `Re-Evaluation`
- **但**: `generateContinuation` 只生成 `noteType = 'TX'`，不生成 RE
- **结论**: RE 生成不在续写流程中，暂无影响。但如果未来需要生成 RE，会面临同样的状态继承问题

### ✅ 多身体部位 (secondaryBodyParts) 场景下的续写行为
- **确认**: `bridgeToContext` 中 `secondaryBodyParts: []` — 永远为空数组
- `bridge.ts` L101: 硬编码空数组，不从IE或TX中提取次要身体部位
- **影响**: 续写时 `generateSubjectiveTX` 中 `context.secondaryBodyParts` 为空
- `soap-generator.ts` L636-637: 有 secondaryBodyParts 的逻辑，但续写时永远不触发
- **结论**: 多身体部位信息在续写中完全丢失

### ✅ HIP 身体部位只支持IE不支持TX的影响
- **确认**: 通过搜索代码，HIP 在 `MUSCLE_MAP`、`SYMPTOM_SCALE_MAP` 等配置中没有专门条目
- 会 fallback 到 `DEFAULT` 配置
- **影响**: 如果输入是 HIP IE + TX 续写，生成的TX内容会使用默认配置，可能不准确
- **但**: 这是已知限制，不是续写特有问题

### ✅ `inferFieldPath` 为什么没有识别 symptomScale 下拉框
- **确认**: `dropdown-parser.ts` L118-335 的 `inferFieldPath` 函数中：
  - 没有任何分支匹配 `symptomScale` / 百分比选项 (`10%|20%|30%|...`)
  - 百分比选项 (`10%`, `20%`, `70%-80%`) 不匹配任何现有条件
  - 最接近的是数字选项 `options.every(o => /^\d+$/.test(o))` — 但百分比有 `%` 符号，不匹配
- **结果**: `inferFieldPath` 返回 `'unknown'`，symptomScale 不在 whitelist 中
- **修复方向**: 添加百分比选项识别分支：
  ```typescript
  if (options.some(o => /^\d+%/.test(o))) {
    return 'subjective.symptomScale'
  }
  ```

### ✅ 前端 `generator.test.js` 的测试覆盖范围
- **两个测试文件**:
  1. `frontend/src/services/generator.test.js` (463行): 测试 `generateContinuation` 的基本流程，使用构造的IE+TX文本
  2. `frontend/src/services/__tests__/generator.test.js` (123行): 只测试 `ensureHeader` 的正则匹配
- **覆盖盲区**:
  - 不测试 `txVisits[0]` vs `txVisits[last]` 的正确性
  - 不测试 `initialState` 的字段完整性
  - 不测试续写TX与输入TX的纵向一致性
  - 不测试多TX续写场景（只测试单次调用）
  - 不测试 OPTUM 保险映射的正确性
  - 不测试 `extractInitialState` 的边界情况

---

## 二十七、SOAP Generator 字段分类：动态 vs 静态

> 分析范围: `soap-generator.ts` 中 `exportSOAPAsText` TX 路径调用的所有函数
> 分类标准:
> - **动态字段 (D)**: 每次生成时通过 `calculateWeights` / `pickSingle` / `pickMultiple` 权重选择，或由 `tx-sequence-engine` 计算
> - **静态字段 (S)**: 由 `getConfig(MAP, bodyPart)` 硬编码映射、固定文本模板、或 `INSURANCE_NEEDLE_MAP` 决定
> - **半静态字段 (H)**: 由 `tx-sequence-engine` 基于 pain/progress 计算，但不从 `visitState` 继承上一个TX的实际值
> - **链式字段 (C)**: 由 `deriveAssessmentFromSOA` 从 S→O 趋势推导，非独立选择

### Subjective (`generateSubjectiveTX`)

| # | 字段 | 类型 | 来源 | visitState 读取? | 问题 |
|---|------|------|------|-----------------|------|
| 1 | `symptomChange` | D→H | engine `pickSingle` 选择，但 `addProgressBias` 强制 +80 improvement | ✅ `visitState.symptomChange` | #39 永远是 improvement；engine 选了但 push 时硬编码覆盖为 `'improvement of symptom(s)'` (L942) |
| 2 | `reasonConnector` | D | engine `pickSingle` | ✅ `visitState.reasonConnector` | 正常 |
| 3 | `reason` | D | engine `pickSingle` + `applyTxReasonChain` 偏置 | ✅ `visitState.reason` | #50 偏置过大，缺乏多样性 |
| 4 | `painTypes` | **D** | `calculateWeights('subjective.painTypes', ...)` 每次重新选 | ❌ 不从 visitState 读 | **#1 CRITICAL**: 每次重新权重选择，不继承上一个TX |
| 5 | `associatedSymptom` | D | engine `pickSingle` + 纵向 rank 约束 | ✅ `visitState.associatedSymptom` | #2 首次约束缺失 (`prevAssociatedSymptom` 初始为空) |
| 6 | `symptomScale` | **S** | `getConfig(SYMPTOM_SCALE_MAP, bp)` 硬编码 | ❌ 不存在于 visitState | **#3 HIGH**: KNEE 永远 `70%-80%`，不随治疗递减 |
| 7 | `causativeConnector` | S | `getConfig(CAUSATIVE_CONNECTOR_MAP, bp)` | ❌ | 正常（固定即可） |
| 8 | ADL 活动列表 | **D** | `calculateWeights('subjective.adlDifficulty.activities', ...)` 每次重新选 | ❌ 不从 visitState 读 | **#7 HIGH**: 每次重新权重选择，不继承 |
| 9 | ADL severity | H | `visitState.severityLevel` (从 pain 推导) | ✅ | #65 跳级过大 |
| 10 | `painScale` | H | engine 计算 → `visitState.painScaleLabel` | ✅ | #19 停滞问题 |
| 11 | `painFrequency` | D | engine `pickSingle` + 纵向约束 | ✅ `visitState.painFrequency` | #14 改善过快 |
| 12 | 方向/侧别 | S | `LATERALITY_NAMES[context.laterality]` | ❌ | #44 NECK bilateral 丢失 |
| 13 | 身体部位名 | S | `BODY_PART_NAMES` / `BODY_PART_AREA_NAMES` | ❌ | 正常 |

### Objective (`generateObjective`)

| # | 字段 | 类型 | 来源 | visitState 读取? | 问题 |
|---|------|------|------|-----------------|------|
| 14 | Tightness 肌肉列表 | **D** | `calculateWeights('objective.tightness', muscles, ...)` 从 `MUSCLE_MAP[bp]` 选 | ❌ 不从 visitState 读 | **#6 HIGH**: 每次重新选，不继承 |
| 15 | Tightness grading | H | engine 基于 pain+progress 计算 | ✅ `visitState.tightnessGrading` | #10 首次约束缺失风险 |
| 16 | Tenderness 肌肉列表 | **S** | `muscles.slice(7, 12)` 固定切片 | ❌ | #6 与 tightness 肌肉不同但也是固定的 |
| 17 | Tenderness grading | H | engine 基于 pain+progress 计算 | ✅ `visitState.tendernessGrading` | **#9 CRITICAL**: 首次约束失效 |
| 18 | Spasm 肌肉列表 | **S** | `muscles.slice(3, 7)` 固定切片 | ❌ | 同 #16 |
| 19 | Spasm grading | H | engine 基于 progress 计算 | ✅ `visitState.spasmGrading` | 正常 |
| 20 | ROM degrees | **H** | `calculateRomValue(normal, painLevel, difficulty)` 公式计算 | ⚠️ 间接：用 `visitState.painScaleCurrent` + `visitState.progress` | **#8**: 不从上一个TX的实际ROM反推 |
| 21 | ROM strength | H | `getStrengthByDifficulty` + `bumpStrength` | ⚠️ 间接 | 同上 |
| 22 | ROM limitation label | H | `calculateLimitation(romValue, normalRom)` | ⚠️ 间接 | 同上 |
| 23 | Inspection | **S** | `getConfig(INSPECTION_DEFAULT_MAP, bp)` 硬编码 | ❌ 不从 visitState 读 | **#5**: KNEE 永远 `joint swelling` |
| 24 | Tongue | **S** | `TONE_MAP[context.localPattern].tongueDefault` 硬编码 | ❌ 不从 visitState 读 | **#51**: 忽略 `visitState.tonguePulse` |
| 25 | Pulse | **S** | `TONE_MAP[context.localPattern].pulseDefault` 硬编码 | ❌ 不从 visitState 读 | **#51**: 同上 |

### Assessment (`generateAssessmentTX`)

| # | 字段 | 类型 | 来源 | visitState 读取? | 问题 |
|---|------|------|------|-----------------|------|
| 26 | 治疗延续句 | S | 固定模板文本 + `laterality` + `bodyPartName` | ❌ | 正常 |
| 27 | `generalCondition` | H | engine 基于证型+慢性程度一次性推断 | ✅ `visitState.generalCondition` | **#4/#41**: 不从上一个TX继承，Qi & Blood Deficiency 强制 poor |
| 28 | `present` (症状变化) | **C** | `deriveAssessmentFromSOA` 从 painDelta 推导 | ✅ `visitState.soaChain.assessment.present` | #13 可能与 O 矛盾 |
| 29 | `patientChange` | **C** | `deriveAssessmentFromSOA` 从 painDelta 推导 | ✅ `visitState.soaChain.assessment.patientChange` | 正常 |
| 30 | `whatChanged` | **C** | `deriveAssessmentFromSOA` 从 frequency/adl/pain 推导 | ✅ `visitState.soaChain.assessment.whatChanged` | #31 逻辑过于简单 |
| 31 | `physicalChange` | **C** | `deriveAssessmentFromSOA` 从 O 趋势推导 | ✅ `visitState.soaChain.assessment.physicalChange` | 正常 |
| 32 | `findingType` | **C** | `deriveAssessmentFromSOA` 从 O 趋势推导 | ✅ `visitState.soaChain.assessment.findingType` | 正常 |
| 33 | `tolerated` | D | `calculateWeights('assessment.tolerated', ...)` 每次重新选 | ❌ | 低影响 |
| 34 | `response` | D | `calculateWeights('assessment.response', ...)` 每次重新选 | ❌ | 低影响 |
| 35 | 证型延续句 | S | `context.localPattern` 固定文本 | ❌ | 正常 |

### Plan (`generatePlanTX`)

| # | 字段 | 类型 | 来源 | visitState 读取? | 问题 |
|---|------|------|------|-----------------|------|
| 36 | 治则动词 | **D** | `calculateWeights('plan.verb', TX_VERB_OPTIONS, ...)` | ❌ 不从 visitState 读 | **#73/#47**: 权重相同时总选第一个 `continue to be emphasize` |
| 37 | 治则内容 | **D** | `calculateWeights('plan.treatmentPrinciples', TX_TREATMENT_OPTIONS, ...)` | ❌ 不从 visitState 读 | **#48**: 与证型不匹配 |
| 38 | 固定后缀 | **S** | `"to speed up the recovery, soothe the tendon."` 硬编码 | ❌ | #49 不随证型变化 |

### Needle Protocol (`generateNeedleProtocol`)

| # | 字段 | 类型 | 来源 | visitState 读取? | 问题 |
|---|------|------|------|-----------------|------|
| 39 | 协议类型 | **S** | `INSURANCE_NEEDLE_MAP[insuranceType]` → `'97810'` or `'full'` | ❌ | **#11/#21/#53 CRITICAL**: OPTUM 强制简化 |
| 40 | 总时间 | **S** | `isFullCode ? 60 : 15` 硬编码 | ❌ | **#12**: 不从 visitState 或 options 读 |
| 41 | 步骤数 | **S** | `isFullCode ? 4 : 1` 硬编码 | ❌ | 同上 |
| 42 | 电刺激 | **S** | `context.hasPacemaker ? 'without' : 'with'` | ❌ | #53 不考虑保险类型 |
| 43 | 穴位 | **S** | 各身体部位硬编码常量 (如 `KNEE_FRONT_RIGHT`) | ❌ 不从 visitState 读 | **#22**: engine 生成了 `visitState.needlePoints` 但被忽略 |
| 44 | 针号 | **S** | `getConfig(NEEDLE_SIZE_MAP, bp)` | ❌ | 正常 |
| 45 | Step 前缀文本 | **S** | IE/TX 不同的固定文本 | ❌ | 正常 |

### tx-sequence-engine 生成但 soap-generator 未使用的字段

| # | engine 字段 | 存储位置 | soap-generator 使用? | 问题 |
|---|------------|---------|---------------------|------|
| 46 | `needlePoints` | `visitState.needlePoints` | ❌ `generateNeedleProtocol` 不接收 visitState | #22 |
| 47 | `tonguePulse` | `visitState.tonguePulse` | ❌ `generateObjective` 用 `TONE_MAP` 硬编码 | #51 |
| 48 | `treatmentFocus` | `visitState.treatmentFocus` | ❌ `generatePlanTX` 不接收 visitState | #74 |
| 49 | `sideProgress` | `visitState.sideProgress` | ⚠️ 未直接使用，ROM 用 `painLevel ± 1` 模拟 | 低影响 |
| 50 | `objectiveFactors` | `visitState.objectiveFactors` | ❌ 未使用 | 低影响 |

---

### 字段分类统计

| 类型 | 数量 | 说明 |
|------|------|------|
| **S (静态)** | 19 | 硬编码映射，不随治疗进度变化 |
| **D (动态)** | 12 | 每次重新权重选择，不继承上一个TX |
| **H (半静态)** | 9 | engine 计算但不从实际值反推 |
| **C (链式)** | 5 | 从 S→O 趋势推导 |

### 核心问题模式

**模式 A — "动态字段不继承" (D 类字段)**
- painTypes, ADL 活动, tightness 肌肉: 每次 `calculateWeights` 重新选择
- 根因: `generateSubjectiveTX` / `generateObjective` 不从 `visitState` 读取这些字段
- 影响: #1, #6, #7 — 续写TX与输入TX的内容完全不同

**模式 B — "静态字段不可变" (S 类字段)**
- symptomScale, inspection, tongue/pulse, 针刺协议: 硬编码不变
- 根因: 这些字段由 `getConfig(MAP, bp)` 或 `INSURANCE_NEEDLE_MAP` 决定
- 影响: #3, #5, #11, #51 — 即使输入TX有不同值也会被覆盖

**模式 C — "engine 生成但 generator 忽略" (未使用字段)**
- needlePoints, tonguePulse, treatmentFocus: engine 精心计算但 generator 不读
- 根因: `generateNeedleProtocol` / `generatePlanTX` 不接收 `visitState` 参数
- 影响: #22, #51, #74 — 代码做了无用功

**模式 D — "半静态字段首次约束缺失" (H 类字段)**
- tenderness, tightness: engine 有纵向约束但 `prev*` 初始为空字符串
- 根因: `prevTendernessGrade = ''` → 首次循环跳过约束检查
- 影响: #9, #10 — 续写首个TX可能恶化

---

### 修复映射: 字段 → 修复策略

| 字段类型 | 修复策略 | 涉及问题 |
|---------|---------|---------|
| D 不继承 | 扩展 `TXVisitState` + `initialState`，generator 优先读 visitState | #1,#6,#7 |
| S 不可变 | 改为从 visitState 读取，fallback 到硬编码 | #3,#5,#11,#51 |
| engine→generator 断裂 | `generateNeedleProtocol`/`generatePlanTX` 增加 visitState 参数 | #22,#51,#74 |
| H 首次约束缺失 | 从 `initialState` 初始化 `prev*` 变量 | #9,#10 |
| C 链式逻辑简单 | 扩展 `deriveAssessmentFromSOA` 输入维度 | #31 |

---

## 修复优先级建议

### Phase 0: 紧急修复 (核心逻辑错误)
0. **修复 `txVisits[0]` → `txVisits[txVisits.length - 1]`** (#78) — 一行修复，影响所有续写结果

### Phase 1: 紧急修复 (阻塞审计)
1. 扩展 `initialState` 类型，增加所有需要继承的字段
2. 修复 tenderness/tightness 纵向约束初始化 (#9, #10)
3. 修复 OPTUM 保险针刺协议映射 (#11, #21, #53)
4. 让 `generateNeedleProtocol` 接收 `visitState` (#18, #22)

### Phase 2: 状态继承 (核心质量)
5. painTypes 从上一个TX继承 (#1)
6. associatedSymptoms 从上一个TX继承 (#2)
7. symptomScale 随治疗进度递减 (#3)
8. generalCondition 从上一个TX继承 (#4)
9. inspection 从上一个TX继承 (#5)
10. 肌肉列表从上一个TX继承 (#6)
11. ADL活动列表从上一个TX继承 (#7)

### Phase 3: 进度曲线优化
12. Pain 停滞问题 — 当接近target时切换到longTermGoal (#19, #20)
13. 进度曲线起点考虑已有TX (#34, #35)
14. 频率改善速度控制 (#14)

### Phase 4: 文本质量
15. 修复 "Assesment" 拼写 (#15, #58)
16. 修复 "continue to be emphasize" 语法 (#47)
17. 治则与证型匹配 (#48)
18. Reason 多样性 (#50)
19. painTypes 与证型一致性 (#46)
