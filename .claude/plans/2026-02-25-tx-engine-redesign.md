# TX 序列引擎重设计

## 背景

编写模式（Writer）是生产逻辑的真相源，批量模式（Batch）应复用编写模式的完整生产链路。现有引擎对 10 条动态路径的覆盖不完整，ROM/Strength/ADL 没有被统一调度。

## 核心架构

引擎统一调度 10 条动态路径：
- 起点：来自 IE 基线（患者输入）
- 终点：参考 `computePatchedGoals` 的 ST/LT goals
- 分配：通过变化预算分配器把改善分散到 1-20 次 visit

```
输入（IE 基线）
  ├── Pain, Frequency, Symptom%, ADL, Tightness, Tenderness, Spasm, ROM, Strength
  │
Goals（终点参考）
  ├── ST（约 55% 进度时达到）
  └── LT（约 100% 进度时达到）
  │
引擎调度
  ├── 每个维度有独立的恢复路径
  ├── 维度之间保持逻辑关联
  ├── 变化预算：每次 visit 释放 2-3 个维度变化
  ├── 未释放的变化进入缓冲队列，下次优先释放
  └── 输出完整 TXVisitState，soap-generator 直接用
```

## 10 条动态路径

### S 里的路径

| # | 路径 | 梯度 | 起点来源 | 终点参考 |
|---|------|------|---------|---------|
| 1 | Pain Scale | 21级: 10,10-9,9,9-8,...,1,1-0,0 | IE painCurrent | Goals pain ST/LT |
| 2 | Pain Frequency | 4级: Constant→Frequent→Occasional→Intermittent | IE frequency | 按 progress 分段 |
| 3 | Symptom Scale % | 18级: 100%,90%,80%-90%,...,10%-20%,10% | IE symptomScale | Goals symptomPct ST/LT |
| 4 | ADL-A severity | 5级: severe→mod-sev→moderate→mild-mod→mild | IE severity | Goals adl ST/LT |
| 5 | ADL-B severity | 5级（同上，仅 NECK/SHOULDER/KNEE/ELBOW） | IE severity（同A） | Goals adl ST/LT（错开节奏） |

### O 里的路径

| # | 路径 | 梯度 | 起点来源 | 终点参考 |
|---|------|------|---------|---------|
| 6 | Tightness | 5级: Severe→Mod-Sev→Moderate→Mild-Mod→Mild | IE 检查结果 | Goals tightness ST/LT |
| 7 | Tenderness | 4-5级: +4→+3→+2→+1→0(KNEE) | IE 检查结果 | Goals tenderness ST/LT |
| 8 | Spasm | 5级: +4→+3→+2→+1→0 | IE 检查结果 | Goals spasm ST/LT |
| 9 | ROM | 5度步进，每个运动独立 | IE ROM度数 | Goals rom ST/LT |
| 10 | Strength | 7级: 3-/5→3/5→3+/5→4-/5→4/5→4+/5→5/5（工作范围6级: 3/5起） | IE strength | Goals strength ST/LT |

### ADL 拆分规则（按部位，依照模板）

| 部位 | ADL 结构 |
|------|---------|
| LBP | 一组 — `severity difficulty with ADLs like [活动]` |
| NECK | 两组 — `severity difficulty of [活动A] and severity difficulty of [活动B]` |
| SHOULDER | 两组 — `severity difficulty of [活动A] and severity difficulty of [活动B]` |
| KNEE | 两组 — `severity difficulty [活动A] and severity difficulty [活动B]` |
| ELBOW | 两组 — `severity difficulty of [活动A] and severity difficulty of [活动B]` |

ADL 两组互斥：同一次 visit 只能有一组变化，交替改善。

## 变化预算分配器

### 核心规则

- 每次 visit 释放 2-3 个维度的变化
- 引擎计算所有维度的"理想值"，对比上次 visit 找出达到变化条件的维度
- 多个维度同时达到条件时，排队释放，不在一次 visit 全部兑现
- 未释放的变化进入缓冲队列，下次 visit 优先释放

### 互斥/关联规则

| 分组 | 路径 | 规则 |
|------|------|------|
| S-疼痛 | Pain, Frequency, Symptom% | Pain 变时 Frequency 或 Symptom% 可跟着变 |
| S-功能 | ADL-A, ADL-B | 互斥，同一 visit 只能变一个 |
| O-肌肉 | Tightness, Tenderness, Spasm | 同一 visit 最多变 2 个 |
| O-功能 | ROM, Strength | 关联，可以同时变 |

### 负面波折（默认关闭）

- 默认模式：每次 visit 要么好转（正面），要么保持一致（中性）。不出现变差。
- 负面开关开启：20 次里穿插 1-2 次 visit 出现患者状况变差（exacerbate），指标回弹。不影响整体终点。

## S-O-A 一致性

### 核心原则

- S = 患者自述（"我感觉好了，因为..."）
- O = 医生检查验证（客观数据确认 S 说的）
- A = 医生总结（把 S 和 O 的所有变化完整汇总陈述）
- P = 治疗计划（基本固定，只有 IE 的 goals 不同）

A 必须完整体现当次 visit 的所有变化：S 里说了什么变了，O 里检查发现什么变了，A 全部如实汇总。不遗漏，不矛盾。

### 指标方向性

**"减少"是好事的指标（越少越好）：**
- pain, pain frequency, pain duration
- numbness/soreness/stiffness/heaviness/weakness sensation
- difficulty in performing ADLs
- dizziness, headache, migraine (NECK)
- local muscles tightness, tenderness, spasms, trigger points
- joint ROM limitation, joints swelling

**"增加"是好事的指标（越多越好）：**
- joint ROM
- muscles strength

**变化方向 × 指标方向 = 正负判定：**

| 变化方向 | 搭配"越少越好"指标 | 搭配"越多越好"指标 |
|---------|------------------|------------------|
| decreased / reduced | ✅ 正面 | ❌ 负面 |
| slightly decreased / slightly reduced | ✅ 正面（弱） | ❌ 负面（弱） |
| remained the same | ➡️ 中性 | ➡️ 中性 |
| slight increased | ❌ 负面（弱） | ✅ 正面（弱） |
| increased | ❌ 负面 | ✅ 正面 |

## 关联语句系统

### S 里的动态字段

**symptomChange（患者自述变化）：**

| 选项 | 分类 |
|------|------|
| improvement of symptom(s) | ✅ 正面 |
| improvement after treatment, but pain still came back next day | ✅ 正面（弱） |
| similar symptom(s) as last visit | ➡️ 中性（保持） |
| exacerbate of symptom(s) | ❌ 负面（需开关） |

**connector（连接词）：** because of / may related of / due to / and — 轮换使用

**reason（原因）— 按搭配逻辑分类：**

#### 具体型 reason（和特定指标变化挂钩）

| reason | 对应指标变化 |
|--------|-------------|
| can move joint more freely and with less pain | ROM 改善 + Pain 下降 |
| physical activity no longer causes distress | ADL 改善 |
| reduced level of pain | Pain 下降 |
| reduced joint stiffness and swelling | Tightness 改善 / swelling 改善 |
| less difficulty performing daily activities | ADL 改善 |

#### 笼统型 reason（不绑定特定指标，任何正面/中性 visit 可用）

- continuous treatment
- maintain regular treatments
- energy level improved
- sleep quality improved
- more energy level throughout the day

#### 负面 reason（需开关，按场景搭配）

| reason | 逻辑场景 |
|--------|---------|
| intense work / working on computer day by day | 肌肉指标回弹（tightness/tenderness/spasm） |
| bad posture / excessive time using cell phone/computer | NECK/SHOULDER 相关指标回弹 |
| carrying/lifting heavy object(s) | LBP/SHOULDER 相关指标回弹 |
| lack of exercise | Strength/ROM 没改善 |
| exposure to cold air | Wind-Cold / Cold-Damp 证型相关 |
| skipped treatments / stopped treatment / discontinuous treatment | 整体回弹 |
| did not have good rest | 笼统负面 |
| weak constitution | 老年/多病史患者 |
| still need more treatments to reach better effect | 中性偏负面，保持不变时用 |
| uncertain reason | 兜底 |

### A 里的动态字段

**present（症状表现）：** improvement / slight improvement / no change / exacerbate

**patientChange（患者变化方向）：** decreased / slightly decreased / remained the same / slight increased / increased

**whatChanged（S 侧变化内容 — 多选）：**
pain, pain frequency, pain duration, numbness sensation, muscles weakness, muscles soreness/stiffness/heaviness sensation, difficulty in performing ADLs, dizziness/headache/migraine(NECK), as last time visit

**physicalChange（体征变化方向）：** reduced / slightly reduced / remained the same / slight increased / increased

**findingType（O 侧变化内容 — 多选）：**
local muscles tightness, local muscles tenderness, local muscles spasms, local muscles trigger points, joint ROM, joint ROM limitation, muscles strength, joints swelling, last visit

### S-A 联动规则

| 模式 | S symptomChange | S reason | A present | A patientChange + whatChanged | A physicalChange + findingType |
|------|----------------|----------|-----------|------------------------------|-------------------------------|
| 正面（强） | improvement | 具体型/笼统型正面 | improvement | decreased + 实际变化指标 | reduced + 实际变化指标 |
| 正面（弱） | improvement / came back | 笼统型正面 | slight improvement | slightly decreased + 实际变化指标 | slightly reduced + 实际变化指标 |
| 中性（保持） | similar as last visit | 笼统型正面/弱负面 | no change | remained the same + as last time visit | remained the same + last visit |
| 负面（需开关） | exacerbate | 负面池 | exacerbate | increased/slight increased + 回弹指标 | increased/slight increased + 回弹指标 |

## TXVisitState 扩展

需要新增到 TXVisitState 的显式字段：

```typescript
// 现有字段保留，新增：
strengthGrade: string           // '3+/5' → '4/5' → '4+/5'
romSnapshot: ROMSnapshot[]      // 每个运动的具体度数 + limitation
adlSeverityA: string            // ADL 第一组评分
adlSeverityB: string            // ADL 第二组评分（NECK/SHOULDER/KNEE/ELBOW）
symptomScalePct: string         // '70%-80%' → '50%-60%' → ...

// ROMSnapshot 结构
interface ROMSnapshot {
  movement: string
  degrees: number
  limitation: string            // normal/mild/moderate/severe
  strength: string              // 该运动对应的 strength grade
}
```

现有 `soaChain.objective` 缺少 `spasmTrend`，需补充：
```typescript
objective: {
  tightnessTrend: ...
  tendernessTrend: ...
  spasmTrend: 'reduced' | 'slightly reduced' | 'stable'  // 新增
  romTrend: ...
  strengthTrend: ...
}
```

## Goals 模型

现有 `computePatchedGoals` 的 BASE_MODELS（pain 5-9）已覆盖所有 8 个维度的 ST/LT 目标，加上 body part / 病史 / 年龄微调。这套模型保留，作为所有 10 条路径的终点参考。

| 维度 | Pain 8 ST | Pain 8 LT |
|------|-----------|-----------|
| Pain | 4-5 | 3 |
| Symptom% | (40%-50%) | (20%-30%) |
| Tightness | moderate | mild to moderate |
| Tenderness | +2 | +1 |
| Spasm | +2 | +1 |
| Strength | 4 | 4+ |
| ROM | 55% | 70% |
| ADL | moderate | mild-moderate |

## 现有引擎产出分析

### Case 1: LBP, Pain 8, 55岁女性, Chronic, 高血压, Seed 42

| Visit | Pain | Freq | Symptom% | ADL | Tightness | Tenderness | Spasm | ROM(Flexion) | Strength(Flexion) |
|-------|------|------|----------|-----|-----------|------------|-------|-------------|-------------------|
| 0(IE) | 8 | Constant | 70%-80% | mod-sev | — | — | — | — | — |
| 1 | 8-7 | Constant | 70% | mod-sev | Moderate | +3 | +3 | 45° | 3+/5 |
| 2 | 7 | Constant | 70% | mod-sev | Moderate | +3 | +3 | 55° | 3+/5 |
| 3 | 7-6 | Constant | 60%-70% | mod-sev | Moderate | +3 | +3 | 60° | 3+/5 |
| 4 | 6 | Constant | 60%-70% | mod-sev | Moderate | +3 | +3 | 65° | 3+/5 |
| 5 | 6 | Constant | 60% | mod-sev | Moderate | +2 | +3 | 70° | 4-/5 |
| 6 | 6-5 | Constant | 60% | mod-sev | Moderate | +2 | +2 | 70° | 4/5 |
| 7 | 6-5 | Constant | 60% | mod-sev | Moderate | +2 | +2 | 70° | 4/5 |
| 8 | 6-5 | Frequent | 60% | mod-sev | Moderate | +2 | +1 | 70° | 4/5 |
| 9 | 5 | Frequent | 60% | mod-sev | Moderate | +1 | +1 | 70° | 4/5 |
| 10 | 5 | Occasional | 60% | mod-sev | Mild-mod | +1 | +1 | 70° | 4/5 |
| 11 | 5 | Occasional | 50%-60% | mild-mod | Mild-mod | +1 | +1 | 70° | 4/5 |

**问题：**
1. ADL 完全没变化 — 11 次 visit 里只在最后 1 次变了
2. Symptom Scale 变化太慢 — 12 次只降了 2-3 档，未达 ST goal (40%-50%)
3. ROM 前半段变太快后半段停滞 — 前 5 次到 70° 后 6 次不动
4. Strength 只变了 2 次 — 3+/5 → 4-/5 → 4/5，未达 LT goal (4+)
5. Frequency 变化太晚 — 前 7 次都是 Constant
6. Tightness 变化太晚 — 前 9 次都是 Moderate
7. S 的 reason 重复 — "continuous treatment" 出现太多
8. S 的 symptomChange 太单调 — 前 4 次都是 "improvement after treatment, but pain still came back next day"

## 批量测试分析（5 部位 × 10 seeds = 50 runs）

HIP/WRIST 不在引擎支持列表，实际有效 5 部位。

### 覆盖率统计

| 部位 | Pain达ST | Freq变化 | Sym%达ST | ADL变化 | ADL-B | Tight变 | Tender变 | Spasm变 | ROM变 | Str变 |
|------|---------|---------|---------|---------|-------|---------|---------|---------|-------|-------|
| LBP | 10/10 | 10/10 | 10/10 | 10/10 | 0/10(正确) | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| NECK | 0/10 ❌ | 10/10 | 9/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| SHOULDER | 0/10 ❌ | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| KNEE | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |
| ELBOW | 0/10 ❌ | 10/10 | 10/10 | 7/10 | 0/10 ❌ | 10/10 | 10/10 | 10/10 | 10/10 | 10/10 |

### 系统性问题（按严重程度排序）

#### 🔴 P0 — Strength 异常回退（负面开关未开）

| 部位 | 回退次数 |
|------|---------|
| KNEE | 18 |
| NECK | 15 |
| SHOULDER | 9 |
| LBP | 8 |
| ELBOW | 7 |
| **合计** | **57** |

根因：`objective-patch.ts` 的 `bumpStrength` 基于 `progress` 做阶梯跳跃，当 progress 在 0.50/0.80 边界震荡时 step 回落导致回退。引擎主循环的 `prevStrengthDeficit` 有单调约束，但 `bumpStrength` 是独立计算的，两套逻辑没对齐。Spasm 回退为 0 是因为走了 `goal-path-calculator` 的离散调度 + 纵向约束。

修复方向：Strength 必须和 Tightness/Tenderness/Spasm 一样走 goal-path-calculator 调度，引擎输出离散 grade，文本后处理不再独立重算。

#### 🔴 P0 — S-O-A 不一致（S 说 improvement 但 O 无变化）

| 部位 | 次数 |
|------|------|
| ELBOW | 25 |
| SHOULDER | 7 |
| NECK | 4 |
| KNEE | 4 |
| LBP | 0 ✅ |
| **合计** | **40** |

根因：守卫条件只检查 `painDelta <= 0 && !objectiveImproved`，当 painDelta 是微小正数（0.01-0.1）时绕过守卫。ELBOW 初始 pain 6，下降空间小，微小 painDelta 频繁触发。

修复方向：improvement 的前提条件改为至少满足一个：painDelta ≥ 0.3 / O 侧至少一个维度变化 / frequency 改善 / ADL 改善。

#### 🟡 P1 — Pain 未达 ST Goal（低 pain 部位）

Pain 8 部位（LBP/KNEE）全部达标，Pain 7（NECK/SHOULDER）和 Pain 6（ELBOW）全部未达标。`chronicDampener = 0.72` + `CHRONIC_END_RATIO = 0.55` 叠加后 progress 被压太低，11 次 visit 不够。

修复方向：Chronic 患者的 ST/LT 目标应比非 Chronic 保守 1-2 级，或调整 dampener 使 progress 曲线更合理。

#### 🟡 P1 — Reason 重复率过高（20%-29%）

`POSITIVE_REASONS_LIST` 只有 7 个元素，用 modulo 轮换，11 次 visit 必然重复。

修复方向：
1. 具体型 reason 优先匹配实际变化维度
2. 同一 reason 不得连续 3 次出现
3. 改用 shuffle bag 算法（取完重新打乱）

#### 🟢 P2 — symptomChange 种类单调（平均 1.9-2.0 种）

11 次 visit 只出现 improvement + similar 两种。`came back` 被 `addProgressBias` 强力压制（`bias -= 55`），`exacerbate` 被负面开关关闭。

### 核心架构问题总结

当前引擎是"双轨制"：
- **离散调度轨**（效果好）：Tightness/Tenderness/Spasm → goal-path-calculator → changeVisits → 纵向约束 → Spasm 回退 0
- **连续值独立轨**（效果差）：Pain/Frequency/Symptom%/ADL/ROM/Strength → 各自独立逻辑 → Strength 回退 57 次，S-O-A 不一致 40 次

重设计核心：把 10 条路径统一到 goal-path-calculator 的离散调度框架下，用变化预算分配器统一管理。

### ADL 结构补充（已合并到主表）

ELBOW 依照模板有两组 ADL，已更正。

#### 🔴 P0 — ELBOW ADL 分支遗漏

`soap-generator.ts` 的 ADL 分支逻辑只处理了 KNEE / SHOULDER / NECK 的两组 ADL，ELBOW 落入 else 分支被当作单组处理。

当前代码（约 line 1660）：
```
if (bp === 'KNEE') → 两组（无 "of"）
else if (bp === 'SHOULDER' || bp === 'NECK') → 两组（有 "of"）
else → 单组（"with ADLs like"）  ← ELBOW 错误地走这里
```

修复：ELBOW 应加入 SHOULDER/NECK 分支（两组，有 "of"）。

#### S 里的 reason 双池结构

模板 S 部分实际有两个 reason 下拉框嵌套：
- **内层池**（12 项，包裹 connector）：`maintain regular treatments|still need more treatments|discontinuous treatments|stopped treatment|intense work|working on computer day by day|excessive time using cell phone|bad posture day by day|carrying/lifting heavy object(s)|lack of exercise|exposure to cold air|uncertain reason`
- **外层池**（24 项，connector 之后）：完整 reason 列表

内层池是 MDLand UI 的上下文选择器，引擎输出文本只需 `[connector] [reason]`（外层池），内层池不影响输出。但内层池的选项列表可作为"负面 reason"的参考来源。

设计文档 reason 分类中的"23 选项"应更正为 **24 选项**（外层池）。

## 模板审计补充

### Strength 格式（依照模板，两种格式并存）

| 部位 | IE 模板格式 | 级数 |
|------|-----------|------|
| LBP/NECK/KNEE | `4+/5|4/5|4-/5|3+/5|3/5|3-/5|2+/5|2/5|2-/5|0` | 10级 |
| SHOULDER/ELBOW | `4+|4|4-|3+|3|3-|2+|2|2-` | 9级 |

引擎 `STRENGTH_LADDER` 有 7 级（3-/5 到 5/5），实际工作范围 3+/5 到 4+/5。引擎输出需要按部位匹配格式。

### findingType 选项（依照模板，各部位不同）

| 部位 | 有 `joint ROM` | 有 `joint ROM limitation` |
|------|---------------|--------------------------|
| LBP | ✅ | ✅ |
| NECK | ✅ | ✅ |
| KNEE | ✅ | ✅ |
| SHOULDER | ❌ | ✅ |
| ELBOW | ❌ | ✅ |

引擎 `deriveAssessmentFromSOA` 的 findingType 需要按部位区分：SHOULDER/ELBOW 只能用 `joint ROM limitation`，不能用 `joint ROM`。

### associatedSymptom 种类固定

种类不变（soreness 始终是 soreness），只有 Symptom Scale % 变化。代码中 1226-1246 行的降级逻辑需要删除。

### tolerated/response 需要匹配实际变化

当前 response 在 `strongPhysicalImprove` 时从 improve 池轮换，但没有匹配实际变化维度。例如 spasm 没变但可能选到 "reducing spasm"。

修复方向：response 应该匹配当次 visit 实际变化的 O 维度：
- spasmTrend !== 'stable' → "with good outcome in reducing spasm"
- painDelta > 0.3 → "with excellent outcome due reducing pain"
- romTrend !== 'stable' → "with good outcome in improving ROM"
- adlImproved → "good outcome in improving ease with functional mobility"
- 无明确变化 → 通用 response（well / good positioning / good draping / positive verbal response）

### 部位差异字段汇总（模板审计完整版）

以下字段在 5 个部位之间有差异，引擎必须按部位区分处理：

#### whatChanged（A 里的 S 侧变化内容）

| 部位 | 额外选项 |
|------|---------|
| NECK | +dizziness, +headache, +migraine（共 13 项，其他部位 10 项） |
| 其他 | 标准 10 项 |

#### laterality / area（S 和 A 里的位置描述）

| 部位 | S 里的位置字段 | A 里的区域字段 |
|------|--------------|--------------|
| LBP | area: `midback\|mid and lower back\|lower back\|lower back and buttocks` | 同 S |
| NECK | `in\|in left side\|in right side\|along right side\|along left side` | `neck\|neck and upper back\|upper back\|neck and upper back with migraine` |
| SHOULDER | `along right\|along left\|along bilateral\|in left\|in right\|in bilateral` | `shoulder area\|shoulder area and lateral arm\|shoulder area, upper back and upper arm\|shoulder area and upper back area\|shoulder area, upper back and periscapular area\|shoulder area and periscapular area` |
| KNEE | 同 SHOULDER 格式 | `knee area`（固定） |
| ELBOW | 同 SHOULDER 格式 | （无独立区域字段） |

#### radiation（S 里的放射痛）

| 部位 | 选项 |
|------|------|
| LBP | without radiation, to R/L leg, to BLLE, to toes |
| NECK | with dizziness, with headache, with migraine, without radiation, to R/L arm, to BLUE |
| SHOULDER | without radiation, to R/L arm, to BLUE |
| KNEE | without radiation, to R/L leg, to BLLE, to toes, **with local swollen** |
| ELBOW | without radiation, to R/L arm, to BLUE |

#### ADL 活动列表（按部位不同）

| 部位 | 活动数 | 特征 |
|------|-------|------|
| LBP | 14 | 下肢为主：Standing, Walking, Sitting, Lifting, Bending, Stairs |
| NECK | 14 | 颈部特有：gargling, looking down, turning head, tilting head, reading |
| SHOULDER | 14 | 上肢为主：reach top cabinet, reach back unzip, comb hair, put coat on |
| KNEE | 11 | 下肢为主：Stairs, Bending knee, Rising from chair, Standing, Walking |
| ELBOW | 14 | 同 SHOULDER（上肢活动） |

#### 跨部位一致的字段（不需要区分处理）

以下字段在所有 5 个部位完全相同：
- symptomChange（4 选项）、connector（4 选项）、reason 池（24 选项）
- present（4 选项）、patientChange（5 选项）、physicalChange（5 选项）
- tolerated/response（12 选项）、session word（4 选项）
- emotion status（8 选项）、TCM pattern（11 选项）
- P emphasis（6 选项）、P treatment goals（同一列表）
- Pain Scale（21 级）、Frequency（4 级）、Symptom Scale %（18 级）
- ADL severity（5 级）、associatedSymptom（5 选项，种类固定）

### 已有完整逻辑的系统（不需要重设计）

| 系统 | 位置 | 说明 |
|------|------|------|
| TCM 辨证 | soap-generator.ts `TCM_PATTERNS` | localPattern/systemicPattern 从用户输入传入 |
| generalCondition | medical-history-engine.ts `inferCondition` | 基于病史+年龄+证型推断 good/fair/poor，TX 固定继承 |
| IE Plan ST/LT goals | objective-patch.ts `patchPlanGoals` | 用 `computePatchedGoals` 替换 IE Plan 文本中的目标值 |
| tonguePulse | tx-sequence-engine.ts `PATTERN_TONGUE_DEFAULTS` | 从 IE 继承或从 localPattern 推导，TX 固定 |
