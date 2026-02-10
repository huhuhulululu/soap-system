# 续写功能高压测试 — 验收条件 SPEC

> 版本: 1.1 (严格对齐 soap-generator.ts 静态/动态文本)  
> 日期: 2026-02-10  
> 范围: `generateContinuation()` + `generateTXSequenceStates()` 续写路径

---

## 1. 术语定义

| 术语 | 含义 |
|------|------|
| IE | Initial Evaluation，初诊记录 |
| TX | Treatment Note，治疗记录 |
| 续写 | 从已有 IE+TX1~TXn 文本解析后，生成 TX(n+1)~TX(n+k) |
| 输入TX | 续写前最后一个已有 TX（续写的起点） |
| 续写TX | 由 `generateContinuation` 新生成的 TX |
| SOA链 | Subjective → Objective → Assessment 横向因果链 |
| full code | WC/VC/ELDERPLAN/NONE 保险 → 4步60分钟针刺协议 |
| 97810 | OPTUM/HF 保险 → 1步15分钟无电刺激协议 |

---

## 2. 测试矩阵

### 2.1 维度覆盖

| 维度 | 取值 |
|------|------|
| 身体部位 | SHOULDER, KNEE, NECK, LBP, ELBOW |
| 侧别 | left, right, bilateral |
| 保险类型 | OPTUM, WC, HF |
| 慢性度 | Acute, Sub Acute, Chronic |
| 续写起点 | TX2续写(标准), TX5续写(中段), TX9续写(尾段) |
| 续写数量 | 1, 3, 最大剩余 |

### 2.2 最小必测组合

- 每个身体部位 × bilateral × 每种保险 × Chronic = 15 组
- 每个身体部位 × left × OPTUM × 每种慢性度 = 15 组
- 边界: TX9续写2个(接近上限11) × 3个身体部位 = 3 组
- 总计 ≥ 33 组，每组重复 ≥ 3 轮（验证随机性稳定）

---

## 3. 验收条件

### AC-1: 解析与桥接

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-1.1 | 输入合法 IE+TX 文本，`generateContinuation` 返回 `error === undefined` | ERROR |
| AC-1.2 | `parseSummary.bodyPart` 与输入 IE 的身体部位一致 | ERROR |
| AC-1.3 | `parseSummary.existingTxCount` 等于输入文本中实际 TX 数量 | ERROR |
| AC-1.4 | `parseSummary.toGenerate` ≤ `11 - existingTxCount` | ERROR |
| AC-1.5 | `context.noteType === 'TX'` | ERROR |
| AC-1.6 | `context.previousIE` 非空且包含 painScale | ERROR |
| AC-1.7 | 输入空文本/无效文本返回有意义的 `error` 字符串 | ERROR |
| AC-1.8 | 输入无 IE 的纯 TX 文本返回 `error` 包含 `"未找到初诊记录"` | ERROR |
| AC-1.9 | 已有 11 个 TX 时返回 `error` 包含 `"已达上限"` | ERROR |

### AC-2: Pain 纵向一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-2.1 | 续写TX1 的 `painScaleCurrent` ≤ 输入TX 的 `painScaleCurrent` | ERROR |
| AC-2.2 | 续写TX 之间 pain 单调不增: `TX[i+1].painScaleCurrent ≤ TX[i].painScaleCurrent` | ERROR |
| AC-2.3 | 续写TX1 与输入TX 的 pain 差值 ∈ [0.5, 1.5]（首次续写降幅合理） | WARN |
| AC-2.4 | 续写 ≥ 3 个TX时，不允许所有 pain 完全相同（停滞） | WARN |
| AC-2.5 | 文本中 `Pain Scale: {painScaleLabel} /10` 与 state 一致（注意 label 可能是整数或范围如 `"8-7"`） | ERROR |

### AC-3: Tenderness 纵向一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-3.1 | 续写TX1 的 tenderness 等级 ≤ 输入TX 的 tenderness 等级（`+N` 中 N 不增大） | ERROR |
| AC-3.2 | 续写TX 之间 tenderness 单调不增 | ERROR |
| AC-3.3 | tenderness 等级与 pain 水平相关: pain≥8→+3/+4, pain 5~7→+2/+3, pain<5→+1/+2 | WARN |
| AC-3.4 | KNEE 使用 KNEE 专用 tenderness 文本（含 `"noxious stimulus"` / `"grimace and flinch"`），非 SHOULDER 文本 | ERROR |
| AC-3.5 | SHOULDER 使用 SHOULDER 专用 tenderness 文本（含 `"withdraws immediately"` / `"moderately tender"`） | ERROR |

### AC-4: Tightness 纵向一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-4.1 | 续写TX1 的 tightness 等级 ≤ 输入TX（按 `mild < mild to moderate < moderate < moderate to severe < severe` 排序） | ERROR |
| AC-4.2 | 续写TX 之间 tightness 单调不增 | ERROR |
| AC-4.3 | tightness 等级与 pain 水平相关: pain≥8→moderate to severe/severe, pain 5~7→moderate/moderate to severe, pain<5→mild/mild to moderate | WARN |

### AC-5: Spasm 纵向一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-5.1 | 续写TX 之间 spasm 等级单调不增 | ERROR |
| AC-5.2 | spasm 文本格式为 `(+N)=...` 或 `(0)=...`，N ∈ {0,1,2,3,4} | ERROR |

### AC-6: GeneralCondition 一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-6.1 | 所有续写TX 的 `generalCondition` 与输入TX 相同（固定属性不变） | ERROR |
| AC-6.2 | 续写TX 之间 `generalCondition` 全部一致 | ERROR |
| AC-6.3 | `generalCondition` 值为 `"good"` / `"fair"` / `"poor"` 之一 | ERROR |

### AC-7: 舌脉 (Tongue/Pulse) 一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-7.1 | 所有续写TX 的 `tonguePulse.tongue` 和 `tonguePulse.pulse` 与 IE 一致 | ERROR |
| AC-7.2 | 文本中包含小写 `"tongue"` 和 `"pulse"` 关键词（格式: `tongue\n{值}\npulse\n{值}`） | ERROR |

### AC-8: SOA 横向链一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-8.1 | `soaChain.subjective.painChange === 'improved'` 时，`soaChain.assessment.present` 不含 `"exacerbate"` 或 `"no change"` | ERROR |
| AC-8.2 | `soaChain.subjective.painChange === 'improved'` 时，`soaChain.assessment.patientChange` 不为 `"increased"` 或 `"remained the same"` | ERROR |
| AC-8.3 | Objective 有改善趋势（任一 trend ≠ `"stable"`）时，`soaChain.assessment.physicalChange` 不为 `"remained the same"` | WARN |

### AC-9: 针刺协议一致性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-9.1 | 输入TX 为 60min 协议时，续写TX 不退化为 15min | ERROR |
| AC-9.2 | OPTUM/HF 保险 → 97810 协议: 文本包含 `"Total Operation Time: 15 mins"` + `"without electrical stimulation"` + 仅 `"Back Points:"` | ERROR |
| AC-9.3 | WC 保险 → full code 协议: 文本包含 `"Total Operation Time: 60 mins"` + `"Front Points:"` + `"Back Points"` | ERROR |
| AC-9.4 | KNEE full code Step 4: 硬编码 `"left knee without electrical stimulation"` (不受 pacemaker 影响) | ERROR |
| AC-9.5 | SHOULDER full code Step 4: 硬编码 `"for left Shoulder without electrical stimulation"` | ERROR |
| AC-9.6 | NECK full code Step 4: 硬编码 `"without electrical stimulation"` | ERROR |
| AC-9.7 | LBP full code Step 4: 使用 `"${eStim} electrical stimulation"` (跟随 pacemaker) | ERROR |
| AC-9.8 | bilateral + full code + KNEE: 文本包含 `"right knee"` 和 `"left knee"` | ERROR |
| AC-9.9 | bilateral + full code + SHOULDER: 文本包含 `"right Shoulder"` 和 `"left Shoulder"` | ERROR |
| AC-9.10 | NECK/LBP full code: 不含 `"right neck"` / `"left neck"` / `"right lower back"` / `"left lower back"` | ERROR |

### AC-10: PainTypes 连续性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-10.1 | 续写TX 的 painTypes 与输入TX 至少有 1 个重叠（不允许完全突变） | ERROR |
| AC-10.2 | 文本中 `"Patient still c/o {painTypes} pain"` 的疼痛类型与 `state.painTypes` 一致 | WARN |

### AC-11: Inspection 连续性

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-11.1 | SHOULDER: `"Inspection:"` 紧接值，无空格（格式: `Inspection:{value}`） | ERROR |
| AC-11.2 | KNEE/LBP/NECK: `"Inspection: "` 有空格（格式: `Inspection: {value}`） | ERROR |
| AC-11.3 | SHOULDER: Inspection 在 Muscles Testing 之前 | ERROR |
| AC-11.4 | KNEE/LBP/NECK: Inspection 在 ROM 之后 | ERROR |
| AC-11.5 | ELBOW: 文本中不出现 `"Inspection"` 行 | ERROR |
| AC-11.6 | 续写TX 的 inspection 值与输入TX 一致（从 initialState 继承） | WARN |

### AC-12: SymptomScale 纵向

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-12.1 | 续写TX 的 symptomScale% ≤ 输入TX 的 symptomScale%（不恶化） | ERROR |
| AC-12.2 | 续写TX 之间 symptomScale 单调不增 | WARN |
| AC-12.3 | symptomScale 吸附到 10% 整数倍（`Math.round(reduced / 10) * 10`） | WARN |

### AC-13: Bilateral 双侧进度

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-13.1 | bilateral 时 `sideProgress` 非空 | ERROR |
| AC-13.2 | `sideProgress.left` 与 `sideProgress.right` 不完全相同（存在不对称性） | ERROR |
| AC-13.3 | 非 bilateral 时 `sideProgress` 为 undefined | WARN |

---

### AC-14: 模板合规 — Subjective (TX)

> 源码: `generateSubjectiveTX()` — 静态文本逐行对齐

| ID | 条件 | 源码行 | 严重度 |
|----|------|--------|--------|
| AC-14.1 | 文本以 `"Follow up visit\n"` 开头 | L1558 | ERROR |
| AC-14.2 | 文本包含 `"Patient reports: there is "` | L1561 | ERROR |
| AC-14.3 | `"Patient reports:"` 后跟 `"improvement of symptom(s)"` (state.symptomChange 固定值) | L1561 + engine | ERROR |
| AC-14.4 | 文本包含 `"Patient still c/o "` | L1566~1575 | ERROR |
| AC-14.5 | `"Patient still c/o"` 后跟 painTypes 逗号分隔 + `" pain"` | L1566 | ERROR |
| AC-14.6 | KNEE/SHOULDER: `"pain in {laterality} {bodyPartAreaName}"` — KNEE 用 `"Knee area"`, SHOULDER 用 `"shoulder area"` | L1567 | ERROR |
| AC-14.7 | NECK bilateral: `"pain in neck area"` (不含 `"bilateral"`) | L1572 | ERROR |
| AC-14.8 | LBP: `"pain on lower back area"` (用 `"on"` 不是 `"in"`) | L1575 | ERROR |
| AC-14.9 | 文本包含 `"without radiation, associated with muscles "` | L1577 | ERROR |
| AC-14.10 | 文本包含 `"(scale as {symptomScale})"` | L1577 | ERROR |
| AC-14.11 | KNEE ADL 格式: `"difficulty {adl}"` (无 `"of"`) | L1582 | ERROR |
| AC-14.12 | SHOULDER/NECK ADL 格式: `"difficulty of {adl}"` (有 `"of"`) | L1586 | ERROR |
| AC-14.13 | LBP ADL 格式: `"difficulty with ADLs like {adl}"` | L1590 | ERROR |
| AC-14.14 | Pain Scale 格式: `"Pain Scale: {label} /10"` (注意 `/10` 前有空格) | L1595 | ERROR |
| AC-14.15 | Pain frequency 格式: `"Pain frequency: "` (小写 `f`，不同于 IE 的 `"Pain Frequency:"`) | L1597 | ERROR |

---

### AC-15: 模板合规 — Objective (TX)

> 源码: `generateObjective()` — 静态文本逐行对齐

| ID | 条件 | 源码行 | 严重度 |
|----|------|--------|--------|
| AC-15.1 | 文本包含 `"Muscles Testing:\n"` | L942 | ERROR |
| AC-15.2 | 文本包含 `"Tightness muscles noted along "` | L951 | ERROR |
| AC-15.3 | 文本包含 `"Grading Scale: "` + tightnessGrading 值 | L952 | ERROR |
| AC-15.4 | Tenderness 文本格式: `"{tenderText} {muscles}"` — tenderText 按身体部位不同 | L968 | ERROR |
| AC-15.5 | Tenderness 等级行: `"{tenderLabel}: {tendernessGrading}."` (末尾有句号) | L975 | ERROR |
| AC-15.6 | 文本包含 `"Muscles spasm noted along "` | L977 | ERROR |
| AC-15.7 | Spasm 格式: `"Frequency Grading Scale:"` 紧接值（无空格） | L978 | ERROR |
| AC-15.8 | bilateral KNEE: 包含 `"Right Knee Muscles Strength"` 和 `"Left Knee Muscles Strength"` | L1000 | ERROR |
| AC-15.9 | bilateral SHOULDER: 包含 `"Right Shoulder Muscles Strength"` 和 `"Left Shoulder Muscles Strength"` | L1050 | ERROR |
| AC-15.10 | NECK: ROM 标题为 `"Cervical Muscles Strength and Spine ROM Assessment:"` | L1120 | ERROR |
| AC-15.11 | LBP: ROM 标题为 `"Lumbar Muscles Strength and Spine ROM"` (无 `"Assessment:"`) | L1118 | ERROR |
| AC-15.12 | 舌脉格式: `"tongue\n{tongue值}\npulse\n{pulse值}"` (小写 `tongue`/`pulse`) | L1147 | ERROR |

---

### AC-16: 模板合规 — Assessment (TX)

> 源码: `generateAssessmentTX()` — 静态文本逐行对齐

| ID | 条件 | 源码行 | 严重度 |
|----|------|--------|--------|
| AC-16.1 | KNEE/SHOULDER: `"The patient continues treatment for in {laterality} {bodyPart} area today."` (注意 `"for in"` 连写) | L1670 | ERROR |
| AC-16.2 | NECK: `"Patient continue treatment for neck area today."` (无 `"The"`，`"continue"` 无 `"s"`) | L1672 | ERROR |
| AC-16.3 | LBP/其他: `"The patient continues treatment for {bodyPart} area today."` (无 `"in {laterality}"`) | L1674 | ERROR |
| AC-16.4 | 文本包含 `"The patient's general condition is {condition}"` | L1678 | ERROR |
| AC-16.5 | 文本包含 `"compared with last treatment, the patient presents with "` | L1679 | ERROR |
| AC-16.6 | 文本包含 `"The patient has {patientChange} {whatChanged}"` | L1680 | ERROR |
| AC-16.7 | 文本包含 `"physical finding has {physicalChange} {findingType}."` | L1681 | ERROR |
| AC-16.8 | 文本包含 `"Patient tolerated {tolerated} {response}."` | L1682 | ERROR |
| AC-16.9 | 文本包含 `"No adverse side effect post treatment."` | L1683 | ERROR |
| AC-16.10 | 文本包含 `"Current patient still has {localPattern} in local meridian that cause the pain."` | L1686 | ERROR |

---

### AC-17: 模板合规 — Plan (TX)

> 源码: `generatePlanTX()` + `generateNeedleProtocol()`

| ID | 条件 | 源码行 | 严重度 |
|----|------|--------|--------|
| AC-17.1 | 文本包含 `"Today's treatment principles:\n"` | L1723 | ERROR |
| AC-17.2 | 治则格式: `"{verb} on {treatment} to speed up the recovery, soothe the tendon."` | L1724 | ERROR |
| AC-17.3 | 文本包含 `"Select Needle Size"` (各部位冒号/空格格式不同，只检查前缀) | needle map | ERROR |
| AC-17.4 | 文本包含 `"Daily acupuncture treatment for "` | protocol | ERROR |
| AC-17.5 | 文本以 `"Documentation"` 结尾 | protocol 末尾 | ERROR |
| AC-17.6 | 文本包含 `"Removing and properly disposing of needles"` | protocol | ERROR |
| AC-17.7 | 文本包含 `"Post treatment service and education patient about precautions at home after treatment."` | protocol | ERROR |
| AC-17.8 | TX 模式 Step 1 前缀: `"Greeting patient, Review of the chart, Routine examination of the patient current condition, "` | L1789 | ERROR |

---

### AC-18: Section 结构

> 源码: `exportSOAPAsText()` — section 标题格式

| ID | 条件 | 源码行 | 严重度 |
|----|------|--------|--------|
| AC-18.1 | 文本包含 `"Subjective\n"` (无冒号) | L2138 | ERROR |
| AC-18.2 | 文本包含 `"Objective\n"` (无冒号) | L2139 | ERROR |
| AC-18.3 | 文本包含 `"Assessment\n"` (无冒号，注意拼写不是 `"Assesment"`) | L2140 | ERROR |
| AC-18.4 | 文本包含 `"Plan\n"` (无冒号) | L2141 | ERROR |
| AC-18.5 | 四个 section 按 S→O→A→P 顺序出现 | L2138~2142 | ERROR |

---

### AC-19: 文本质量

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-19.1 | 不出现 `"Assesment"` 拼写错误 | WARN |
| AC-19.2 | 不出现 `"continue to be emphasize"` 语法错误（应为 `"continue to emphasize"`） | WARN |

---

### AC-20: 边界条件

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-20.1 | 从 TX9 续写 2 个 TX 不崩溃，`visits.length === 2` | ERROR |
| AC-20.2 | 从 TX10 续写 1 个 TX 不崩溃，`visits.length === 1` | ERROR |
| AC-20.3 | `generateCount` 超过剩余容量时自动截断，不报错 | ERROR |
| AC-20.4 | 续写 1 个 TX 时所有纵向约束仍成立 | ERROR |
| AC-20.5 | 多轮续写（先续写3个，再从第3个续写3个）结果一致性 | WARN |

---

### AC-21: 性能

| ID | 条件 | 严重度 |
|----|------|--------|
| AC-21.1 | 单次 `generateContinuation` (续写3个TX) 耗时 < 2000ms | WARN |
| AC-21.2 | 全矩阵 33组 × 3轮 = 99 次调用总耗时 < 60s | WARN |
| AC-21.3 | 无内存泄漏：连续运行 100 次后 heap 增长 < 50MB | WARN |

---

## 4. 身体部位差异速查表

> 以下差异直接来自 `soap-generator.ts` 源码，SPEC 条件必须按此区分

| 特性 | SHOULDER | KNEE | NECK | LBP | ELBOW |
|------|----------|------|------|-----|-------|
| Inspection 位置 | Muscles Testing 前 | ROM 后 | ROM 后 | ROM 后 | **无** |
| Inspection 格式 | `Inspection:{val}` (无空格) | `Inspection: {val}` | `Inspection: {val}` | `Inspection: {val}` | — |
| Assessment 开头 | `The patient continues treatment for in {lat}` | 同 SHOULDER | `Patient continue treatment for neck` | `The patient continues treatment for lower back` | 走 else 分支 |
| ADL 格式 | `difficulty of {adl}` | `difficulty {adl}` (无 of) | `difficulty of {adl}` | `difficulty with ADLs like {adl}` | 走 else 分支 |
| Pain 介词 | `pain in {lat} shoulder area` | `pain in {lat} Knee area` | `pain {direction} neck area` | `pain on lower back area` | `pain on {bodyPart}` |
| NECK bilateral 方向 | — | — | `"in"` (不含 bilateral) | — | — |
| Pain frequency 大小写 | `Pain frequency:` (小写 f) | 同左 | 同左 | 同左 | 同左 |
| ROM 标题 | `{Side} Shoulder Muscles Strength and Joint ROM` | `{Side} Knee Muscles Strength and Joint ROM:` | `Cervical Muscles Strength and Spine ROM Assessment:` | `Lumbar Muscles Strength and Spine ROM` | 走通用分支 |
| Full code Step 4 | `without` (硬编码) | `without` (硬编码) | `without` (硬编码) | `${eStim}` (跟随 pacemaker) | 走通用分支 |
| Bilateral 针刺侧别 | `right Shoulder` / `left Shoulder` | `right knee` / `left knee` | 不分侧 | 不分侧 | 不分侧 |
| Tenderness 文本 | SHOULDER 专用 (`withdraws immediately`) 复数 | KNEE 专用 (`noxious stimulus`) 单数 | 走 DEFAULT 复数 | 单数 `"Tenderness muscle"` | 走 DEFAULT 复数 |

---

## 5. 判定标准

| 等级 | 条件 |
|------|------|
| ✅ PASS | 0 个 ERROR，WARN ≤ 总检查项的 5% |
| ⚠️ WARNING | 0 个 ERROR，WARN > 5% |
| ❌ FAIL | 任何 ERROR > 0 |

---

## 6. 与现有测试的关系

| 现有脚本 | 覆盖范围 | 本 SPEC 补充 |
|----------|----------|-------------|
| `stress-continuation.ts` | 8 组合，续写场景审计 (11项检查) | 扩展到 33+ 组合，细化到源码行级别的静态文本匹配 |
| `batch-continuation-test.ts` | 全矩阵 IE+TX 直接生成 | 本 SPEC 专注续写路径（解析→桥接→续写），非直接生成 |
| `generator.test.js` | 单元测试级别 | 本 SPEC 为集成级别端到端验收 |
| `note-checker.ts` | 文档级别校验 | 本 SPEC 聚焦续写衔接点的纵向/横向一致性 |
