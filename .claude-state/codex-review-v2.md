# Codex 实现审查报告 v2 — SOAP 双格式输出（深度审查）

## 审查日期: 2026-03-04（第二轮深度审查）

## 测试基线

| 指标 | 结果 |
|------|------|
| Failed files | 7（全部 pre-existing） |
| Failed tests | 24（全部 pre-existing） |
| Passed tests | 2958 |
| Fixture snapshots | 30/30 ✅ |
| 新增失败 | 0 |

---

## CRITICAL 问题（选项集与模板不一致）

### CRITICAL-03: Assessment 首行 SHOULDER 缺少 painArea 下拉

模板: `laterality(Single)` + `ppnSelectCombo shoulder area|shoulder area and lateral arm|...|shoulder area and periscapular area`（6 选项）+ "area today."
代码 L2413: `${renderedLateralityPhrase} ${bodyPartName.toLowerCase()} area today.` — 硬编码 "shoulder"，无 painArea 下拉。

Subjective 中 SHOULDER 有 `shoulderPainArea` wrap（L2141），但 Assessment 没有。

### CRITICAL-04: Assessment 首行 NECK 缺少 area 下拉

模板: `ppnSelectComboSingle neck|neck and upper back|upper back|neck and upper back with migraine`（4 选项）+ "area today."
代码 L2415: `${bodyPartName.toLowerCase()} area today.` — 硬编码 "neck"，无下拉。

注意：模板有 4 选项，但 `TEMPLATE_TX_PAIN_AREA.NECK` 只有 3 选项（缺 `"neck and upper back with migraine"`）。

### CRITICAL-05: Assessment 首行 LBP 缺少 painArea 下拉

模板: `ppnSelectCombo midback|mid and lower back|lower back|lower back and buttocks`（4 选项）+ "area today."
代码 L2417: `${bodyPartName.toLowerCase()} area today.` — 硬编码 "lower back"，无下拉。

### CRITICAL-06: Plan treatment 选项集完全错误

模板（全部 5 个部位一致）: `ppnSelectCombo` 固定 14 选项:
```
moving qi|regulates qi|activating Blood circulation to dissipate blood stagnant|
dredging channel and activating collaterals|activate blood and relax tendons|
eliminates accumulation|resolve stagnation, clears heat|promote circulation, relieves pain|
expelling pathogens|dispelling cold, drain the dampness|strengthening muscles and bone|
clear heat, dispelling the flame|clear damp-heat|drain the dampness, clear damp
```

代码 L2473-2479: `wrapMulti(selectedTreatment, localPattern?.treatmentPrinciples || [...])`
- 传入当前 TCM 证型的 treatmentPrinciples（2-3 项），不是模板固定 14 选项
- 多个证型的 principles 不在模板 14 选项中（如 `soothing liver qi`, `nourishing blood`, `tonifying qi and blood`）
- MDLand 下拉框会显示错误的选项列表

---

## HIGH 问题

### HIGH-04: Subjective symptomChange 选项集不完整

模板: `ppnSelectComboSingle improvement of symptom(s)|exacerbate of symptom(s)|similar symptom(s) as last visit|improvement after treatment, but pain still came back next day`（4 选项）

代码 `TX_SYMPTOM_CHANGE_OPTIONS` (L1744-1748): 3 选项（缺 `"similar symptom(s) as last visit"`）

`TEMPLATE_TX_SYMPTOM_CHANGE` 常量有 5 选项（多了 `"slight improvement of symptom(s)"`），但代码没用这个常量。

注意：代码故意移除了 `"similar symptom(s) as last visit"`（业务决策），但 HTML 下拉框的选项集应该与模板一致，让用户可以手动选回这个值。

### HIGH-05: Subjective painScale 选项集不完整

模板: `ppnSelectComboSingle` 21 选项: `10|10-9|9|9-8|8|8-7|7|7-6|6|6-5|5|5-4|4|4-3|3|3-2|2|2-1|1|1-0|0`

代码 `TX_PAIN_SCALE_OPTIONS` (L1783-1801): 17 选项，缺少 `"10-9"`, `"9-8"`, `"1-0"`, `"0"`

### HIGH-06: Subjective symptomScale 选项集不完整

模板: `ppnSelectCombo` 18 选项: `10%|10%-20%|20%|20%-30%|30%|30%-40%|40%|40%-50%|50%|50%-60%|60%|60%-70%|70%|70%-80%|80%|80%-90%|90%|100%`

代码 `TX_SYMPTOM_SCALE_OPTIONS` (L1810): 10 选项（只有整十值，缺少 `10%-20%`, `20%-30%` 等 8 个范围值）

### HIGH-07: LBP Assessment patientChange 选项不匹配

LBP 模板: `ppnSelectComboSingle reduced|slightly reduced|increased|slight increased|remained the same`
其他模板: `ppnSelectComboSingle decreased|slightly decreased|increased|slight increased|remained the same`

代码统一用 `TEMPLATE_TX_PATIENT_CHANGE` = `["decreased", "slightly decreased", ...]`
LBP 应该用 `reduced/slightly reduced`，不是 `decreased/slightly decreased`。

### HIGH-08: NECK Assessment painArea 缺少 "neck and upper back with migraine"

模板: `ppnSelectComboSingle neck|neck and upper back|upper back|neck and upper back with migraine`（4 选项）
代码 `TEMPLATE_TX_PAIN_AREA.NECK`: `["neck", "neck and upper back", "upper back"]`（3 选项）

缺少第 4 个选项 `"neck and upper back with migraine"`。

---

## MEDIUM 问题

### MEDIUM-03: Assessment localPattern 选项集是超集

模板: `ppnSelectCombo` 11 个 local 证型:
```
Qi Stagnation|Blood Stasis|Liver Qi Stagnation|Blood Deficiency|
Qi & Blood Deficiency|Wind-Cold Invasion|Cold-Damp + Wind-Cold|
LV/GB Damp-Heat|Phlegm-Damp|Phlegm-Heat|Damp-Heat
```

代码 L2402: `Object.keys(TCM_PATTERNS)` = 29 个（含 18 个 systemic 证型）
MDLand 下拉框会显示 18 个模板不存在的选项。

应该用固定的 11 个 local 证型列表。

### MEDIUM-04: Subjective 缺少情绪状态下拉

模板有 `ppnSelectCombo Normal|Stressful|Anxious|Depressed|Irritable|Sad|Negative|Positive` 情绪下拉。
代码完全未生成此字段。

### MEDIUM-05: Subjective 缺少 causative 中间层下拉

模板在 connector 和 reason 之间有一个 12 项的 causative 下拉:
```
maintain regular treatments|still need more treatments to reach better effect|
uncertain reason|discontinuous treatments|stopped treatment for a while|
intense work|working on computer day by day|excessive time using cell phone|
bad posture day by day|carrying/lifting heavy object(s)|lack of exercise|
exposure to cold air
```
代码只生成了 connector + reason，缺少这个中间层。

### MEDIUM-06: exportTXSeriesAsText 无条件 2× 性能开销

L3037-3038 每个 visit 无条件调用 `exportSOAP` 两次（text + html）。
20 个 TX visit 的 batch = 40 次完整 SOAP 生成。
建议加 `includeHtml` 参数或 lazy 生成。

---

## LOW 问题

### LOW-02: ELBOW painTypes 可能缺少 "pin & needles"

TX ELBOW 模板 Subjective 的 painTypes 下拉包含 `pin & needles`（13 项）。
`TEMPLATE_PAIN_TYPES.ELBOW` 用 `PAIN_TYPES_WITHOUT_PIN_NEEDLES`（12 项）。
需要确认 TX ELBOW 模板是否真的有 `pin & needles`（IE ELBOW 确实没有）。

### LOW-03: html-wrapper 空 options 数组尾部多余空格

`options = []` 时 class 属性变成 `"ppnSelectComboSingle "` — 尾部多余空格。

### LOW-04: generateContinueBatch vs generateMixedBatch seed 来源不一致

`generateContinueBatch` 永远随机 seed，`generateMixedBatch` continue 分支尊重 `patient.seed`。

---

## 修复优先级

### P0（必须修）
1. CRITICAL-06: Plan treatment 选项集 → 用模板固定 14 选项
2. CRITICAL-03/04/05: Assessment 首行 painArea 下拉 → SHOULDER/NECK/LBP 加 wrap

### P1（应该修）
3. HIGH-04: symptomChange → 用 `TEMPLATE_TX_SYMPTOM_CHANGE` 常量（或模板 4 选项）
4. HIGH-05: painScale → 补齐到模板 21 选项
5. HIGH-06: symptomScale → 补齐到模板 18 选项
6. HIGH-07: LBP patientChange → per-bodyPart 区分 reduced/decreased
7. HIGH-08: NECK painArea → 补 "neck and upper back with migraine"

### P2（建议修）
8. MEDIUM-03: localPattern → 用固定 11 选项
9. MEDIUM-04/05: 情绪状态 + causative 中间层（结构性遗漏，可后续）
10. MEDIUM-06: 性能优化

### P3（可选）
11. LOW-02/03/04
