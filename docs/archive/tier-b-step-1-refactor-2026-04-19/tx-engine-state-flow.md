# TX Engine State Flow Map (tx-sequence-engine.ts:834-2173)

> B1.1 产物 — 6-stage pipeline 重构的契约基础。
> 完整扫描范围：`generateTXSequenceStates` 函数体全部（834-2173，共 1340 行）
> 产出日期：2026-04-19

## T1. EngineState（跨 visit session 状态）

持续状态在主循环外初始化，循环内读写；必须全量纳入 `EngineState` 接口。

| 字段 | 类型 | 初始化位置 | 更新位置 | 说明 |
|------|------|-----------|---------|------|
| `prevPain` | number | 890 | 1221 | 前一 visit 显示 pain |
| `prevPainScaleLabel` | string | 891 | 1473 | 前一 visit pain 标签（"5", "5-6"） |
| `consecutiveSameLabel` | number | 893 | (declared, not updated) | PLAT-01 计数器 — 代码未 update |
| `improvementCount` | number | 895 | 1701 | improvement visit 计数（reason 轮换） |
| `positiveShuffleBag` | string[] | 896 | 1674, 1679-1687 | positive reason 洗牌袋（purge + refill） |
| `cameBackShuffleBag` | string[] | 897 | 1712-1722 | came-back reason 洗牌袋 |
| `lastUsedReason` | string | 898 | 1694, 1728 | 上次用过的 reason（防连续重复） |
| `prevProgress` | number | 899 | 1175 | 保证 progress 单调不减 |
| `prevAdl` | number | 900 | (declared, not updated) | 死字段 — 不 update |
| `prevFrequency` | number | 901 | 1302 | 前一 visit frequency 数值（0-3） |
| `prevSymptomDecade` | number | 921 | 1945 | 前一 symptom 十分位（仅 drop 更新） |
| `prevTightness` | number | 947 | 1366 | tightness 数值（1-5） |
| `prevTenderness` | number | 951 | 1367 | tenderness 数值（0-4） |
| `prevSpasm` | number | 953 | 1388 | spasm 数值（0-4） |
| `prevRomDeficit` | number | 958 | 1474 | ROM deficit 比例（0.08-0.6） |
| `prevStrengthDeficit` | number | 959 | (declared, not updated) | 死字段 |
| `prevPainForSeverity` | number | 961 | 1263 | severity 单调用 |
| `prevSeverity` | SeverityLevel | 962 | 1262 | severity 单调只降不升 |
| `prevSeverityForAdl` | SeverityLevel | 965 | 1288 | ADL 用的 severity |
| `prevAdlImproved` | boolean | 966 | 1264 | ADL 改善标记（用于下次 severity 降档） |
| `prevAdlItemCount` | number | 981 | 1287 | ADL 项数（对比基线） |
| `prevTightnessGrading` | string | 982 | 1814 | tightness 文本（单调） |
| `prevTendernessGrade` | string | 983 | 1845/1848 | tenderness grade key（"+3" 等） |
| `prevAssociatedSymptom` | string | 1002 | 1755 | 关联症状（用户输入主导） |
| `prevStrengthLevel` | number | 1160 | 1475 | strength 离散等级（STRENGTH_LADDER 索引） |
| `prevTightnessBounced` | boolean | 1051 | 1336 | bounce tracking |
| `prevTendernessBounced` | boolean | 1052 | 1361 | bounce tracking |
| `prevSpasmBounced` | boolean | 1053 | 1383 | bounce tracking（永远 false，代码中 `spasmBounced = false`） |
| `fixedNeedleGroups` | NeedleGroups \| null | 1048 | 1881-1885（仅首访） | 首访选穴后永久复用（V09） |
| `visits` | TXVisitState[] | 1046 | 2111（push） | 输出累积数组；Stage 5-7 读 `visits[visits.length-1]` 的 display 值 |

**Session 固定常量（不属于 state，但 stage 实现需要）**：
- `rng`, `actualSeed`, `txCount`, `startIdx`
- `ieStartPain`, `startPain`, `targetPain`（target 动态切换 ST→LT）
- `chronicCapsEnabled`, `chronicEndRatio`, `chronicDampener`
- `progressMultiplier`, `medAdjustments` (spasmBump/romDeficitBump)
- `initSeverity`, `initialMuscles`
- `initialFrequencyIdx`, `initialFrequencyLabel`
- `baselineAssociatedSymptoms`
- `fixedGeneralCondition`, `fixedTonguePulse`（patient 固定体质）
- `patchedGoals`, `TX_FREQUENCY_GOAL`, `goalPaths`（改变 schedule 来源）

---

## T2. VisitAccumulator（单 visit 累积状态）

每个 visit 按 6 stage 顺序填充。

| 字段 | 由哪个 stage 产出 | 类型 | 说明 |
|------|----------------|------|------|
| `progress` | Stage 1 | number | S 曲线进度 |
| `objectiveFactors` | Stage 1 | object | sessionGapDays/sleepLoad/workloadLoad/weatherExposureLoad/adherenceLoad |
| `painScaleCurrent` | Stage 1 | number | 显示 pain |
| `painScaleLabel` | Stage 1 | string | "5", "5-6" 等 |
| `painDelta` | Stage 1 | number | prev - current |
| `nextFrequency` | Stage 1 | number | 0-3 (数值) |
| `frequencyImproved` | Stage 1 | boolean | initial dimScore 用 |
| `severityLevel` | Stage 2 | SeverityLevel | 纵向约束只降 |
| `prevSeveritySnapshot` | Stage 2 | SeverityLevel | severityChanged 比较用 |
| `visitMuscles` | Stage 2 | SelectedMuscles | reduceMuscles(initialMuscles, severity) |
| `adlItems` | Stage 2 | string[] | 按 muscle 权重 + severity count 筛选 |
| `adlImproved` | Stage 2 | boolean | 基于 item count vs prev 修正 |
| `aggravatingItems` | Stage 2 | string[] | 固定为 [] |
| `nextTightness` | Stage 3 | number | 1-5 numeric |
| `nextTenderness` | Stage 3 | number | 0-4 numeric |
| `nextSpasm` | Stage 3 | number | 0-4 numeric（无 bounce） |
| `tightnessTrend`/`tendernessTrend`/`spasmTrend` | Stage 3 (pre-reconcile) | string | 会被 Stage 5 / Stage 7 重算 |
| `nextRomDeficit` | Stage 3 | number | — |
| `nextStrengthLevel` | Stage 3 | number | STRENGTH_LADDER 索引 |
| `strengthGrade` | Stage 3 | string | 如 "4/5" |
| `romTrend`/`strengthTrend` | Stage 3 + plateau | string | plateau 修正 |
| `sideProgress` | Stage 3 | object? | 仅 bilateral；含 RNG |
| `ruleContext` | Stage 4 | object | buildRuleContext() |
| `symptomChange` | Stage 4 | string | 多轮修正：初选 → negative gate → dimScore gate → 后期强制 → 最终 S-O guard |
| `reasonConnector`/`reason` | Stage 4 | string | initial pick |
| `finalReason`/`finalConnector` | Stage 4 | string | shuffle bag 重选后 |
| `associatedSymptoms`/`associatedSymptom` | Stage 4 | — | 用户输入主导 |
| `painFrequency` (label) | Stage 4 | string | pickSingle 选 label |
| `treatmentFocus` | Stage 4 | string | — |
| `tightnessGrading`/`tendernessGrading`/`spasmGrading` | Stage 5 | string | 文本 grading（从 numeric 映射 + 单调） |
| `needlePoints` | Stage 5 | NeedleGroups | = fixedNeedleGroups |
| `chainFrequency` | Stage 5 | string | findTemplateOption(frequencyByLevel[prevFrequency]) |
| `visitSymptomScale` | Stage 5 | string | snapSymptomToGrid(prevSymptomDecade * 10) |
| `cumulativePainDrop` | Stage 5 | number | startPain - current |
| `adlDelta` | Stage 5 | number | adlImproved ? 1 : 0 |
| **display 覆盖字段** | Stage 6 | — | 见 T3 |
| `finalTightnessTrend`/`finalTendernessTrend`/`finalSpasmTrend` | Stage 7 | string | 基于 display grading 对比 prev.display |
| `finalFrequencyImproved` | Stage 7 | boolean | chainFrequency vs prev |
| `finalSymptomScaleChanged` | Stage 7 | boolean | visitSymptomScale vs prev |
| `finalDimScore` | Stage 7 | object | computeDimensionScore(final*) |
| `hasFinalObjectiveChange` | Stage 7 | boolean | — |
| `hasSubjectiveImprovementSignal` | Stage 7 | boolean | 最终 S-O guard |
| `assessmentFromChain` | Stage 7 | object | deriveAssessmentFromSOA(...) |
| `soaChain` | Stage 7 | TXVisitState["soaChain"] | push 到 visits |

---

## T3. True-vs-Display 字段（Stage 6 `applyDisplayCaps` 会覆盖）

cap 触发条件：`outputChanges.length > 4`（pain/sev/symScale/freq/str/adl/tight/tend/spasm 中 >4 变化）
defer 优先级：spasm → tend → tight → str（skip）→ freq → symScale
pain/severity/adl 永不 defer（cascade-critical）

| 字段 | "true" 值来源 | cap 后读 `prev.*` | Stage 7 读的版本 |
|------|-------------|-----------------|----------------|
| `spasmGrading` | Stage 5: SPASM_TEXTS[nextSpasm] | visits[-1].spasmGrading | display（finalSpasmTrend 对比 prev.spasmGrading） |
| `tendernessGrading` | Stage 5: bpTenderScale[+N] + 单调 | visits[-1].tendernessGrading | display（finalTendernessTrend 从 display 对比） |
| `tightnessGrading` | Stage 5: TIGHTNESS_ORDER[numeric] + 单调 | visits[-1].tightnessGrading | display（finalTightnessTrend 从 display grade order 对比） |
| `chainFrequency` | Stage 5: 从 prevFrequency 构造 | visits[-1].painFrequency | display（finalFrequencyImproved） |
| `visitSymptomScale` | Stage 5: snapSymptomToGrid(prevSymptomDecade\*10) | visits[-1].symptomScale | display（finalSymptomScaleChanged） |

**Strength 无法 defer**（line 1996-1997: `case "str": continue`），因为 STRENGTH_LADDER 是 ladder index 不能简单回退。

---

## T4. Stage → 消费字段 / 产出字段

### Stage 1: `deriveBaseVisitState`
- **RNG 消耗**：5 次（progressNoise、\_painRng、objectiveFactors × 5 内调用、\_freqRng）
- **消费**：EngineState.prevProgress, prevPain, prevPainScaleLabel, prevFrequency + consts (progressMultiplier, goalPaths.pain/frequency, startPain)
- **产出**：progress, objectiveFactors, painScaleCurrent, painScaleLabel, painDelta, nextFrequency, frequencyImproved
- **更新 EngineState**：prevProgress, prevPain

### Stage 2: `deriveSubjectiveDerived`
- **RNG 消耗**：2 次（\_adlRng1、\_adlRng2）
- **消费**：context, pain, EngineState.prevSeverity/prevAdlImproved/prevSeverityForAdl/prevAdlItemCount + consts (goalPaths.adlA/adlB, initialMuscles)
- **产出**：severityLevel, prevSeveritySnapshot, visitMuscles, adlItems, adlImproved, aggravatingItems
- **更新 EngineState**：prevSeverity, prevPainForSeverity, prevAdlImproved, prevAdlItemCount, prevSeverityForAdl

### Stage 3: `deriveObjectiveMuscles` (+ ROM/strength + sideProgress)
- **RNG 消耗**：~9 次（bounceRng, tenderBounceRng, spasmBounceRng (consumed), extra spasm rng, ROM-deficit rng, \_strengthRng, plateau rng (可选), side asym (if bilateral)）
- **消费**：goalPaths.tightness/tenderness/spasm/strength, prev* 数值, EngineState bounces
- **产出**：nextTightness/Tenderness/Spasm/RomDeficit/StrengthLevel + trends + sideProgress
- **更新 EngineState**：prevTightness/Tenderness/Spasm/RomDeficit/StrengthLevel + bounces

### Stage 4: `buildSubjectiveNarrative`
- **RNG 消耗**：~6-8 次（symptomChange, negativeRoll (可选), reasonConnector, reason, shuffle bag pick, connector pick, painFrequency, treatmentFocus + 多个 rng 补偿）
- **消费**：context, ruleContext, progress, dimScore, EngineState.positiveShuffleBag/cameBackShuffleBag/lastUsedReason/improvementCount + consts (TEMPLATE_TX_REASON)
- **产出**：symptomChange (多轮修正), finalReason, finalConnector, associatedSymptoms, painFrequency, treatmentFocus, generalCondition (= fixed)
- **更新 EngineState**：positiveShuffleBag/cameBackShuffleBag/lastUsedReason/improvementCount, prevAssociatedSymptom

### Stage 5: `buildObjectiveGradingText`
- **RNG 消耗**：~7 次（tightness 2 rng, tenderness 2 rng, needle fixed bag: 首访 6 rng + seed 不算，spasm 0）
- **消费**：Stage 3 的 next* numeric + context, EngineState.prevTightnessGrading/prevTendernessGrade/fixedNeedleGroups
- **产出**：tightnessGrading/tendernessGrading/spasmGrading, needlePoints, chainFrequency, visitSymptomScale, correctedObjImproved
- **更新 EngineState**：prevTightnessGrading, prevTendernessGrade, prevSymptomDecade, fixedNeedleGroups（首访），cumulativePainDrop, adlDelta

### Stage 6: `applyDisplayCaps`
- **RNG 消耗**：0
- **消费**：Stage 5 grading + visits[-1]
- **产出**：display 覆盖 spasm/tend/tight/chainFrequency/visitSymptomScale（见 T3）
- **更新 EngineState**：无

### Stage 7: `buildFinalAssessment`
- **RNG 消耗**：0（deriveAssessmentFromSOA 纯函数）
- **消费**：Stage 6 display + Stage 1/2/3 trends + context
- **产出**：finalTightnessTrend/TendernessTrend/SpasmTrend/FrequencyImproved/SymptomScaleChanged, finalDimScore, hasFinalObjectiveChange, symptomChange (S-O guard 可改写), assessmentFromChain, soaChain
- **更新 EngineState**：visits.push()

**问题**：plan 的 6 阶段实际需 7 个阶段来精确表达。决策：**合并 Stage 5 "grading text" 到 Stage 3 "objectiveState"**，因为 grading 本质是 Stage 3 numeric 的文本渲染。合并后 6 阶段：

| Plan 阶段 | 映射 | 职责 |
|----------|------|------|
| Stage 1 baseVisitState | Stage 1 | progress + pain + frequency |
| Stage 2 subjectiveDerived | Stage 2 | severity + ADL + muscle counts |
| Stage 3 subjectiveNarrative | Stage 4 | symptomChange + reason + narrative |
| Stage 4 objectiveState | Stage 3 + Stage 5 合并 | tight/tender/spasm/ROM/strength (numeric + grading text) + needle + sideProgress + chainFrequency + visitSymptomScale |
| Stage 5 displayReconciliation | Stage 6 | applyDisplayCaps |
| Stage 6 finalAssessment | Stage 7 | final trends + deriveAssessmentFromSOA |

---

## T5. 未覆盖的 state domains

扫描后，以下 state 需单独处理，不属于 6 阶段的任一常规职责：

| Domain | 位置 | 当前如何处理 | Pipeline 中的归属 |
|--------|------|------------|-----------------|
| Engine init (EngineState 初始化) | 834-1160 | 主循环开始前一次性执行 | **Stage 0 engineInit**（可作为独立 `initEngineState` 函数） |
| Needle group selection (首访) | 1867-1885 | `fixedNeedleGroups` null → selectNeedleGroups(seed) 一次性 | **Stage 4 子步骤**（首访特判） |
| Patterns tonguePulse (固定) | 1017-1044 | 一次性构造，所有 visit 复用 | **Stage 0** |
| Visit push to visits[] | 2111 | 循环末尾 | **Stage 6** 完成后由外层主函数统一 push |
| Dead state 字段 | 890,900,959 | `consecutiveSameLabel`, `prevAdl`, `prevStrengthDeficit` 未更新 | **删除**（死代码，Tier B 清理） |

---

## 签字区

- [ ] state flow map 完整性核对 — 对照 834-2173 源码，T1-T5 无遗漏
- [ ] 6 阶段切分合理，可落实为 `VisitAccumulator` 类型和 `EngineState` 类型
- [ ] Stage 0 engineInit + Stage 1-6 stages 组合可等价表达原函数

**由 ping 签字：APPROVED 日期：2026-04-19**
