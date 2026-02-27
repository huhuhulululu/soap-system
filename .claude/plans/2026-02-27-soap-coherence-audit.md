# SOAP 内在关联一致性排查计划

## 目标

系统性排查 TX 序列生成结果中所有存在内在逻辑关联的表述，记录不一致问题。

## 内在关联维度清单

### 一、Subjective 内部关联

| # | 关联对 | 规则 | 优先级 |
|---|--------|------|--------|
| S1 | reason ↔ S-side 变化 | ADL reason 只在 adlImproved 时出现；pain reason 只在 painDelta>0.2 时出现；O-side reason 只在 O 有变化时出现 | HIGH |
| S2 | symptomChange ↔ reason 语义 | improvement → positive reason；similar → neutral reason；exacerbate → negative reason | HIGH |
| S3 | painScale 变化方向 ↔ symptomChange | pain 下降 → 不应 exacerbate；pain 不变 → 不应 improvement（除非其他维度变了） | HIGH |
| S4 | painFrequency ↔ frequencyImproved | frequency 降级时 S.frequencyChange 应=improved | MED |
| S5 | symptomScale ↔ symptomScaleChanged | scale 数值变化时 whatChanged 应包含 soreness 相关 | MED |
| S6 | severityLevel ↔ pain 范围 | severity 应和 pain 范围匹配 | HIGH |
| S7 | ADL difficulty 描述 ↔ severityLevel | "moderate to severe difficulty" 应匹配当前 severityLevel | MED |

### 二、Objective 内部关联

| # | 关联对 | 规则 | 优先级 |
|---|--------|------|--------|
| O1 | tightnessGrading ↔ tightnessTrend | grading 降级时 trend 应≠stable | HIGH |
| O2 | tendernessGrading ↔ tendernessTrend | 同上 | HIGH |
| O3 | spasmGrading ↔ spasmTrend | 同上 | HIGH |
| O4 | strengthGrade ↔ strengthTrend | grade 升级时 trend 应≠stable | HIGH |
| O5 | ROM 数值 ↔ romTrend | ROM 增加时 trend 应≠stable | HIGH |

### 三、S ↔ A 跨段关联

| # | 关联对 | 规则 | 优先级 |
|---|--------|------|--------|
| SA1 | S.painChange ↔ A.present | S=improved → A 不应 similar（除非 dimScore=0） | HIGH |
| SA2 | S.adlChange ↔ A.whatChanged | adl=improved 时 whatChanged 可含 ADL；adl=stable 时不应只有 ADL | MED |
| SA3 | S.frequencyChange ↔ A.whatChanged | freq=improved 时 whatChanged 应含 frequency | HIGH |
| SA4 | A.present ↔ A.patientChange | improvement → decreased；similar → remained the same | HIGH |
| SA5 | A.physicalChange ↔ O trends | all O stable → remained the same | HIGH |
| SA6 | A.findingType ↔ O trends | ROM changed → findingType 含 ROM | HIGH |

### 四、纵向（跨 visit）关联

| # | 关联对 | 规则 | 优先级 |
|---|--------|------|--------|
| V1 | pain 单调递减 | 后 visit pain ≤ 前 visit pain | HIGH |
| V2 | severity 随 pain 降级 | pain 进入新区间时 severity 应降级 | HIGH |
| V3 | A.present 语气随累积增强 | 后期不应比前期弱 | MED |
| V4 | tightnessGrading 纵向递减 | 不应回升 | MED |
| V5 | tendernessGrading 纵向递减 | 不应回升 | MED |
| V6 | spasmGrading 纵向递减 | 不应回升 | MED |
| V7 | painFrequency 纵向递减 | Constant→Frequent→Occasional→Intermittent | MED |
| V8 | symptomScale 纵向递减 | 70%→60%→50%... | MED |

## 执行

Phase 1: 写审计脚本覆盖所有维度，跑 5 bp × 10 seeds × 12 visits = 600 visits，记录问题
Phase 2: 按 HIGH 优先级逐个修复
Phase 3: 回归验证
