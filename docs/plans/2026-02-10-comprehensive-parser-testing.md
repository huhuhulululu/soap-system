# 全面 Parser 测试计划

## 问题分析

刚发现的 Bug：`Subjective` 无冒号导致 "No visit records found"

**根因**：`splitVisitRecords` 函数没有测试用例覆盖边界情况

## 测试缺口分析

| 模块 | 当前用例 | 缺失场景 |
|------|----------|----------|
| splitVisitRecords | 0 | 无冒号、多 visit、空文本、PDF 噪音 |
| parseHeader | 6 | 格式变体、缺失字段 |
| parseSubjective | 10 | IE/TX 变体、字段缺失 |
| parseObjective | 8 | 部位特定字段、缺失节 |
| parseAssessment | 4 | 日期格式、TCM 诊断变体 |
| parsePlan | 3 | 针刺协议变体、目标解析 |
| 端到端 | 0 | 完整文档流、前端集成 |

## 全面测试矩阵

### 1. splitVisitRecords 边界测试 (12 用例)

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| SVR-01 | Subjective 带冒号 | `Subjective: IE...` | 1 个 block |
| SVR-02 | Subjective 无冒号 | `Subjective\nIE...` | 1 个 block |
| SVR-03 | 多个 visit | IE + TX1 + TX2 | 3 个 blocks |
| SVR-04 | 空文本 | `""` | 0 个 blocks |
| SVR-05 | 无 Subjective | `Objective: ...` | 0 个 blocks |
| SVR-06 | 短文本过滤 | `Subjective: x` (< 200 chars) | 0 个 blocks |
| SVR-07 | PDF 噪音 | `S ubjective: ...` | 1 个 block |
| SVR-08 | 大小写混合 | `SUBJECTIVE: ...` | 1 个 block |
| SVR-09 | 换行变体 | `Subjective:\r\n...` | 1 个 block |
| SVR-10 | 中间空白 | `Subjective :  IE` | 1 个 block |
| SVR-11 | 嵌入文本 | `...Subjective: in text...` | 正确分割 |
| SVR-12 | Unicode | `Subjective：...` (全角冒号) | 1 个 block |

### 2. parseHeader 边界测试 (8 用例)

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| PH-01 | 标准格式 | 完整 header | 全部字段 |
| PH-02 | 缺少 Gender | 无 Gender 行 | gender = null |
| PH-03 | 缺少 Age | 无 AGE 行 | age = null |
| PH-04 | 日期格式变体 | `01-15-2024` | 正确解析 |
| PH-05 | 名字带后缀 | `SMITH, JANE A JR` | 正确解析 |
| PH-06 | 空 header | `""` | null |
| PH-07 | 部分 header | 只有名字 | 部分字段 |
| PH-08 | PDF 噪音 | `SM ITH, JANE` | 正确解析 |

### 3. parseSubjective 边界测试 (15 用例)

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| PS-01 | IE 标准 | 完整 IE | 全部字段 |
| PS-02 | TX 标准 | 完整 TX | 全部字段 |
| PS-03 | Pain Scale 范围 | `Pain Scale: 5-4` | range: {min:4, max:5} |
| PS-04 | Pain Scale 单值 | `Pain Scale: 6` | value: 6 |
| PS-05 | Pain Scale IE格式 | `Worst: 8 ; Best: 6 ; Current: 7` | 三个值 |
| PS-06 | 无 Pain Scale | 缺失 | painScale = null |
| PS-07 | 多部位 | `knee and hip` | 两个部位 |
| PS-08 | 双侧 | `bilateral knee` | laterality: bilateral |
| PS-09 | 无侧别 | `knee pain` | laterality: null |
| PS-10 | ADL 缺失 | 无 ADL 行 | adlDifficultyLevel = null |
| PS-11 | 医史 N/A | `Medical history: N/A` | medicalHistory = [] |
| PS-12 | 医史多项 | `HTN, DM, HLD` | 3 项 |
| PS-13 | 症状变化 | `improvement of symptom` | improvement |
| PS-14 | 症状无变化 | `no significant change` | stable |
| PS-15 | 症状恶化 | `worsening of symptom` | worsening |

### 4. parseObjective 边界测试 (12 用例)

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| PO-01 | 完整 Objective | 全部字段 | 全部解析 |
| PO-02 | 无 Tightness | 缺失 | tightness = null |
| PO-03 | 无 Tenderness | 缺失 | tenderness = null |
| PO-04 | 无 Spasm | 缺失 | spasm = null |
| PO-05 | 无 ROM | 缺失 | rom = null |
| PO-06 | ROM 多项 | Flexion + Extension | 2 项 |
| PO-07 | Tongue 变体 | `tongue: pale` | pale |
| PO-08 | Pulse 变体 | `pulse: wiry, thready` | 两个 |
| PO-09 | Grading 变体 | `moderate to severe` | moderate to severe |
| PO-10 | Tenderness +3 | `(+3) = severe` | scale: 3 |
| PO-11 | 部位特定肌肉 | KNEE 肌肉组 | 正确肌肉 |
| PO-12 | Inspection 变体 | `joint swelling` | swelling |

### 5. 端到端集成测试 (10 用例)

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| E2E-01 | 完整 IE 文档 | 真实 IE | 全部解析成功 |
| E2E-02 | 完整 TX 文档 | 真实 TX | 全部解析成功 |
| E2E-03 | IE + 3 TX | 多 visit | 4 个 records |
| E2E-04 | 前端续写流 | IE → generateContinuation | 成功生成 |
| E2E-05 | 无冒号格式 | `Subjective\n` | 成功解析 |
| E2E-06 | PDF 提取文本 | 真实 PDF 输出 | 成功解析 |
| E2E-07 | 部分缺失 | 无 Assessment | warnings, 成功 |
| E2E-08 | 错误恢复 | 损坏的 Objective | 跳过，继续 |
| E2E-09 | 空文档 | `""` | 明确错误 |
| E2E-10 | 审核集成 | 解析 → 审核 | 全流程通过 |

### 6. 前端集成测试 (5 用例)

| ID | 场景 | 输入 | 期望 |
|----|------|------|------|
| FE-01 | 用户粘贴 IE | 无冒号文本 | 成功解析 |
| FE-02 | 用户粘贴 TX | 标准格式 | 成功解析 |
| FE-03 | 续写生成 | IE 输入 | 生成 TX |
| FE-04 | 错误提示 | 无效输入 | 友好错误 |
| FE-05 | 部位识别 | 各部位 | 正确识别 |

## 实施计划

### Phase 1: 紧急修复 (今天)
- [x] 修复 `Subjective:?` 正则
- [ ] 添加 SVR-01 ~ SVR-06 测试

### Phase 2: 核心覆盖 (明天)
- [ ] 添加 SVR-07 ~ SVR-12 测试
- [ ] 添加 PH-01 ~ PH-08 测试
- [ ] 添加 PS-01 ~ PS-15 测试

### Phase 3: 完整覆盖 (后天)
- [ ] 添加 PO-01 ~ PO-12 测试
- [ ] 添加 E2E-01 ~ E2E-10 测试
- [ ] 添加 FE-01 ~ FE-05 测试

## 测试文件结构

```
tests/unit/
├── parser/
│   ├── split-visit-records.spec.ts    # SVR-01 ~ SVR-12
│   ├── parse-header.spec.ts           # PH-01 ~ PH-08
│   ├── parse-subjective.spec.ts       # PS-01 ~ PS-15
│   ├── parse-objective.spec.ts        # PO-01 ~ PO-12
│   └── parse-assessment-plan.spec.ts  # 补充
├── integration/
│   └── parser-e2e.spec.ts             # E2E-01 ~ E2E-10
└── frontend/
    └── continuation-flow.spec.ts      # FE-01 ~ FE-05
```

## 总计

| 类别 | 用例数 |
|------|--------|
| splitVisitRecords | 12 |
| parseHeader | 8 |
| parseSubjective | 15 |
| parseObjective | 12 |
| 端到端 | 10 |
| 前端集成 | 5 |
| **总计** | **62** |

当前: 47 用例 → 目标: 109 用例 (+62)
