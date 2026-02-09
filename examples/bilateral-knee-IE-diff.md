# 双膝 IE 生成输出 vs 模板 — 逐行比对报告 (V2)

> 对比对象:
> - 生成输出: `examples/bilateral-knee-IE.md` (最新)
> - IE 模板: `ie/AC-IE KNEE.md`
> - 针刺模板: `needles/acupuncture knee pain.md`
> - 舌脉模板: `tone/acupuncture @ T&P (cold).md`

---

## Subjective

| # | 项目 | 模板渲染文本 | 生成输出 | 结果 |
|---|------|------------|---------|------|
| 1 | 访问类型 | `INITIAL EVALUATION` | `INITIAL EVALUATION` | ✅ 一致 |
| 2 | 主诉句式 | `Patient c/o Chronic pain in bilateral Knee area which is` | `Patient c/o Chronic pain in bilateral Knee area which is` | ✅ 一致 |
| 3 | 疼痛类型 | `Dull, Aching` (模板默认) | `Freezing, weighty` | ⚠️ 权重系统选择(Cold-Damp证型对应), 值来自下拉框 |
| 4 | 放射 | `without radiation` | `without radiation` | ✅ 一致 |
| 5 | 持续时间 | `3 month(s)` | `3 month(s)` | ✅ 一致 |
| 6 | 加重时间 | `recent 1 week(s)` | `recent 1 week(s)` | ✅ 一致 |
| 7 | 关联症状 | `soreness, heaviness` | `soreness, heaviness` | ✅ 一致 |
| 8 | 症状比例 | `(scale as 70%-80%)` | `(scale as 70%-80%)` | ✅ 一致 |
| 9 | 致因连词 | `due to` | `due to` | ✅ 一致 |
| 10 | 致因内容 | `age related/degenerative changes` | `age related/degenerative changes` | ✅ 一致 |
| 11 | 加重动词 | `aggravated by` | `aggravated by` | ✅ 一致 |
| 12 | 加重因素 | `any strenuous activities` | `any strenuous activities` | ✅ 一致 |
| 13 | 因素后空格+句号 | `activities .` (空格+句号) | `activities .` | ✅ 一致 |
| 14 | ADL严重度 | `moderate to severe` | `moderate to severe` | ✅ 一致 |
| 15 | ADL项目 | `Rising from a chair, Walking for long periods of time, bending knee to sit position` | `Rising from a chair, Standing for long periods of time, Walking for long periods of time` | ⚠️ 权重系统选择, 值均来自下拉框 |
| 16 | 缓解因素 | `Changing positions, Resting, Massage` | `Changing positions, Resting, Massage` | ✅ 一致 |
| 17 | 缓解措辞 | `can temporarily relieve the pain.` | `can temporarily relieve the pain.` | ✅ 一致 |
| 18 | 活动变化 | `decrease outside activity.` | `decrease outside activity.` | ✅ 一致 |
| 19 | 未改善动词 | `did not improved` | `did not improved` | ✅ 一致(保留模板语法) |
| 20 | 未改善原因 | `over-the-counter pain medication` | `over-the-counter pain medication` | ✅ 一致 |
| 21 | 次要部位 | `neck` (模板默认) | `lower back` | ⚠️ 上下文驱动(secondaryBodyParts='LBP'), 值来自下拉框 |
| 22 | 比较侧别 | `Bilateral` (大写B) | `Bilateral` | ✅ 一致 |
| 23 | 比较区域 | `Knee area pain.` | `Knee area pain.` | ✅ 一致 |
| 24 | 疼痛评分 | `Worst: 8 ; Best: 6 ; Current: 8` | `Worst: 8 ; Best: 6 ; Current: 8` | ✅ 一致 |
| 25 | 疼痛频率 | `Constant (symptoms occur between 76% and 100% of the time)` | `Constant (symptoms occur between 76% and 100% of the time)` | ✅ 一致 |
| 26 | 行走辅助 | `Walking aid :none` | `Walking aid :none` | ✅ 一致(空格在冒号前) |
| 27 | 病史 | `Medical history/Contraindication or Precision: N/A` | `Medical history/Contraindication or Precision: N/A` | ✅ 一致 |

**Subjective 小结: 27项中 24项完全一致, 3项为权重/上下文选择差异(值均来自模板下拉框)**

---

## Objective

| # | 项目 | 模板渲染文本 | 生成输出 | 结果 |
|---|------|------------|---------|------|
| 28 | 标题 | `Muscles Testing:` (HTML `<strong>`) | `**Muscles Testing:**` | ⚠️ 多了markdown `**`标记 |
| 29 | Tightness肌肉 | `Quadratus femoris, Iliotibial Band ITB, Rectus Femoris` | `Quadratus femoris, Adductor longus/ brev/ magnus, Iliotibial Band ITB` | ⚠️ 不同切片选择, 值均来自下拉框 |
| 30 | Grading Scale | `moderate to severe` | `moderate to severe` | ✅ 一致 |
| 31 | Tenderness文本 | `Tenderness muscle noted along` | `Tenderness muscle noted along` | ✅ 一致("muscle"单数) |
| 32 | Tenderness肌肉 | `Gastronemius muscle, Hamstrings muscle group, Tibialis Post/ Anterior, Plantar Fasciitis, Intrinsic Foot Muscle group` | 同左 | ✅ 一致 |
| 33 | Tenderness标签 | `Tenderness Scale:` | `Tenderness Scale:` | ✅ 一致 |
| 34 | Tenderness量表 | `(+4) = There is severe tenderness and withdrawal response from the patient when there is noxious stimulus` | 同左 | ✅ 一致 |
| 35 | 量表后空格+句号 | ` .` | ` .` | ✅ 一致 |
| 36 | Spasm文本 | `Muscles spasm noted along` | `Muscles spasm noted along` | ✅ 一致 |
| 37 | Spasm肌肉 | `Quadratus femoris, Adductor longus/ brev/ magnus, Iliotibial Band ITB, Rectus Femoris` | 同左 | ✅ 一致 |
| 38 | 频率量表格式 | `Frequency Grading Scale:(+3)=>1 but < 10 spontaneous spasms per hour.` | 同左 | ✅ 一致(Scale:无空格) |
| 39 | ROM标题-右 | `Right Knee Muscles Strength and Joint ROM:` | 同左 | ✅ 一致 |
| 40 | ROM强度 | `3+/5` | `3+/5` | ✅ 一致 |
| 41 | ROM-Flexion标签 | `Flexion(fully bent):` | `Flexion(fully bent):` | ✅ 一致 |
| 42 | ROM-Flexion度数 | `90 Degrees(moderate)` (模板默认) | `80 Degrees(moderate)` | ⚠️ 严重度计算差异, 均为有效下拉框值 |
| 43 | ROM-Extension | `0(normal)` | `0(normal)` | ✅ 一致 |
| 44 | ROM标题-左 | `Left Knee Muscles Strength and Joint ROM:` | 同左 | ✅ 一致 |
| 45 | 左膝ROM度数 | `90 Degrees(moderate)` | `80 Degrees(moderate)` | ⚠️ 同#42 |
| 46 | Inspection标签 | `Inspection:` (HTML `<strong>`) | `Inspection:` | ✅ 一致(无markdown标记) |
| 47 | Inspection内容 | `joint swelling` | `joint swelling` | ✅ 一致 |
| 48 | 舌象标签 | `tongue` | `tongue` | ✅ 一致(来自T&P cold模板) |
| 49 | 舌象内容 | `thick, white coat` | `thick, white coat` | ✅ 一致 |
| 50 | 脉象标签 | `pulse` | `pulse` | ✅ 一致 |
| 51 | 脉象内容 | `deep` | `deep` | ✅ 一致 |

**Objective 小结: 24项中 20项完全一致, 1项markdown格式差异, 3项为权重/计算选择差异**

---

## Assessment

| # | 项目 | 模板渲染文本 | 生成输出 | 结果 |
|---|------|------------|---------|------|
| 52 | 标题 | `TCM Dx:` | `TCM Dx:` | ✅ 一致 |
| 53 | 侧别 | `Bilateral` (大写) | `Bilateral` | ✅ 一致 |
| 54 | 诊断句 | `knee pain due to Cold-Damp + Wind-Cold in local meridian, but patient also has Kidney Yang Deficiency in the general.` | 同左 | ✅ 一致 |
| 55 | 治则前缀 | `Today's TCM treatment principles:` | 同左 | ✅ 一致 |
| 56 | 治则动词 | `focus` | `focus` | ✅ 一致 |
| 57 | 治则内容 | `dispelling cold, drain the dampness` | `dispelling cold, drain the dampness` | ✅ 一致 |
| 58 | 调和目标 | `Liver and Kidney` | `Liver and Kidney` | ✅ 一致 |
| 59 | 治疗目的 | `promote healthy joint and lessen dysfunction in all aspects` | 同左 | ✅ 一致 |
| 60 | 评估位置 | `Acupuncture Eval was done today on bilateral knee area.` | 同左 | ✅ 一致 |

**Assessment 小结: 9项全部一致 ✅**

---

## Plan

| # | 项目 | 模板渲染文本 | 生成输出 | 结果 |
|---|------|------------|---------|------|
| 61 | 评估类型 | `Initial Evaluation - Personal one on one contact with the patient (total 20-30 mins)` | 同左 | ✅ 一致 |
| 62 | 步骤1-4 | `1. Greeting patient.` ... `4. Explanation with patient for medical decision/treatment plan.` | 同左 | ✅ 一致(4行全部匹配) |
| 63 | 短期目标标题 | `Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):` | 同左 | ✅ 一致 |
| 64 | Pain Scale格式 | `Decrease Pain Scale to5-6.` | 同左 | ✅ 一致(to紧连值) |
| 65 | Soreness格式 | `Decrease soreness sensation Scale to (70%-80%)` | 同左 | ✅ 一致(括号包裹) |
| 66 | Tightness | `Decrease Muscles Tightness to moderate` | 同左 | ✅ 一致 |
| 67 | Tenderness | `Decrease Muscles Tenderness to Grade 3` | 同左 | ✅ 一致 |
| 68 | Spasms | `Decrease Muscles Spasms to Grade 2` | 同左 | ✅ 一致 |
| 69 | Strength格式 | `Increase Muscles Strength to4` | 同左 | ✅ 一致(to紧连值) |
| 70 | 长期目标标题 | `Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):` | 同左 | ✅ 一致 |
| 71 | LT-Pain | `Decrease Pain Scale to3` | 同左 | ✅ 一致 |
| 72 | LT-Soreness | `Decrease soreness sensation Scale to (70%-80%)` | 同左 | ✅ 一致 |
| 73 | LT-Tightness | `to mild-moderate` | 同左 | ✅ 一致 |
| 74 | LT-Tenderness | `Grade 2` | 同左 | ✅ 一致 |
| 75 | LT-Spasms | `Grade 1` | 同左 | ✅ 一致 |
| 76 | LT-Strength | `Increase Muscles Strength to4+` | 同左 | ✅ 一致 |
| 77 | ROM目标 | `Increase ROM 60%` | 同左 | ✅ 一致 |
| 78 | ADL目标 | `Decrease impaired Activities of Daily Living to mild-moderate.` | 同左 | ✅ 一致 |

**Plan 小结: 18项全部一致 ✅**

---

## Needle Protocol (来自 acupuncture knee pain.md)

| # | 项目 | 模板渲染文本 | 生成输出 | 结果 |
|---|------|------------|---------|------|
| 79 | 针号 | `Select Needle Size : 34#x1" ,30# x1.5",30# x2"` | 同左 | ✅ 一致 |
| 80 | 治疗标题 | `Daily acupuncture treatment for knee - Personal one on one contact with the patient (Total Operation Time: 60 mins)` | 同左 | ✅ 一致 |
| 81 | 前穴标题 | `Front Points: (30 mins) - personal one on one contact with the patient` | 同左 | ✅ 一致 |
| 82 | Step1前缀 | `1. Greeting patient, Review of the chart, Routine examination of the patient current condition,` | 同左 | ✅ 一致 |
| 83 | Step1内容 | `...Initial Acupuncture needle inserted for right knee with electrical stimulation GB33, GB34, GB36` | 同左 | ✅ 一致 |
| 84 | Step2内容 | `2. Washing hands...re-insertion of additional needles left knee with electrical stimulation SP9, XI YAN, HE DING, A SHI POINT` | 同左 | ✅ 一致 |
| 85 | 前穴清理 | `Removing and properly disposing of needles` | 同左 | ✅ 一致 |
| 86 | 后穴标题 | `Back Points (30 mins) - personal one on one contact with the patient` | 同左 | ✅ 一致 |
| 87 | Step3内容 | `3. Explanation with patient for future treatment plan...re-insertion of additional needles right knee with electrical stimulation BL40, BL57` | 同左 | ✅ 一致 |
| 88 | Step4电刺激 | `left knee without electrical stimulation` | 同左 | ✅ 一致(Step4无电刺激) |
| 89 | Step4穴位 | `BL23, BL55, A SHI POINTS` | 同左 | ✅ 一致 |
| 90 | 后穴清理 | `Removing and properly disposing of needles` | 同左 | ✅ 一致 |
| 91 | 术后教育 | `Post treatment service and education patient about precautions at home after treatment.` | 同左 | ✅ 一致 |
| 92 | 文档记录 | `Documentation` | 同左 | ✅ 一致 |

**Needle Protocol 小结: 14项全部一致 ✅**

---

## 总结

| 分类 | 总项 | 完全一致 | 权重/上下文差异 | 格式差异 |
|------|------|---------|---------------|---------|
| Subjective | 27 | 24 | 3 | 0 |
| Objective | 24 | 20 | 3 | 1 |
| Assessment | 9 | 9 | 0 | 0 |
| Plan | 18 | 18 | 0 | 0 |
| Needle Protocol | 14 | 14 | 0 | 0 |
| **合计** | **92** | **85 (92.4%)** | **6 (6.5%)** | **1 (1.1%)** |

### 剩余差异明细

**权重/上下文选择差异 (6项) — 值均来自模板下拉框，属于预期行为:**

1. `#3` 疼痛类型: `Freezing, weighty` vs 默认 `Dull, Aching` — Cold-Damp证型权重选择
2. `#15` ADL项目: 选了不同的3项 — 权重系统选择
3. `#21` 次要部位: `lower back` vs 默认 `neck` — 由 context.secondaryBodyParts=['LBP'] 驱动
4. `#29` Tightness肌肉: 不同切片 — 权重系统选择
5. `#42` ROM-Flexion度数: `80` vs 默认 `90` — 严重度计算 (moderate to severe → 38%减少)
6. `#45` 左膝同#42

**格式差异 (1项):**

7. `#28` Muscles Testing 标题: 输出有 `**` markdown粗体标记，模板使用HTML `<strong>`

### 结论

生成器的**固定文本、格式、标点、空格、下拉框选项**已与 KNEE 模板完全对齐。所有 6 项"差异"均为权重系统的正常选择行为（选中的值都来自模板下拉框的有效选项），1 项为 markdown vs HTML 的格式表达差异。
