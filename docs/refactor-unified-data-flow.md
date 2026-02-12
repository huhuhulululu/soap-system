# 一次性永久重构计划：统一数据流 v2.1

> 日期: 2026-02-12
> 版本: 2.1（含多代理可行性评估修订）
> 状态: 待执行
> 预计工期: 12 天

---

## 可行性评估摘要

| 评估角色 | 评分 | 关键意见 |
|---------|------|---------|
| 架构师 | 85% | 方向正确，需避免循环依赖 |
| QA 工程师 | 82% | 需要 PDF 样本测试库，回归风险可控 |
| DevOps | 78% | 需要回滚检查点，部署策略需明确 |
| 安全审计 | 75% | 解析函数统一降低不一致风险，需防范类型断言 |
| 代码审查 | 88% | 消除重复是正确方向，命名规范需统一 |
| 产品经理 | 72% | 10 天冻结需业务确认，需渐进式迁移 |
| 风险分析 | 80% | 级联失败是最大风险，需并行运行期 |
| **加权平均** | **78.2%** | **可行，需修补 P0 问题后执行** |

### P0 修订（已纳入 v2.1）

1. **无回滚计划** → 每个 Phase 增加回滚检查点
2. **级联删除风险** → `adlImpairment` 改为 `@deprecated` 并行运行，Phase 5 清理
3. **自检循环依赖** → `self-check.ts` 移至 `src/validator/`，独立于 Generator

### P1 修订（已纳入 v2.1）

4. **缺少 PDF 样本库** → Phase 0 增加收集测试 PDF
5. **命名规范不统一** → 统一前缀：`parse`（文本→枚举）、`extract`（文本→数值）、`compare`（比较）

---

## 问题诊断

### 根本问题：系统没有统一的数据流

```
Parser.parseAdlDifficultyLevel()  ←─┐
                                     ├─ 三份相同逻辑
Checker.parseAdlSeverity()        ←─┤
                                     │
Bridge.parseSeverityFromAdlText() ←─┘
```

### 双轨字段

types.ts 中存在冗余的双轨设计：

| 文本字段 | 枚举字段 | 谁读文本 | 谁读枚举 |
|---------|---------|---------|---------|
| `adlImpairment` | `adlDifficultyLevel` | Checker | Bridge (fallback) |
| `chiefComplaint` | `assessment.symptomChange` | Checker (parseProgressStatus) | Generator |

### 重复的解析函数

| 函数 | 位置 | 调用次数 |
|-----|------|---------|
| `parsePainCurrent` | note-checker.ts:24, correction-generator.ts:16, bridge.ts:70 | 3 |
| `parseAdlSeverity` / `parseAdlDifficultyLevel` / `parseSeverityFromAdlText` | note-checker.ts:50, parser.ts:436, bridge.ts:55 | 3 |
| `parseProgressStatus` | note-checker.ts:87 | 1 (但逻辑应共享) |
| `extractProgressReasons` | note-checker.ts:95 | 1 (但逻辑应共享) |

### Generator 常量与 Checker 不一致

| 常量 | Generator 值 | Checker 期望 | 影响 |
|-----|-------------|-------------|------|
| LBP 肌肉命名 | tx-sequence-engine 使用 `erector spinae`(总称) | Checker 期望 `iliocostalis`/`multifidus`(具体) | 36 CRITICAL |
| ROM 公式 | 线性插值 `getLimitationFactor()` | `limitFactor` 分段常量 | 24 错误 |
| ~~LBP 针具~~ | ~~`36#`~~ | ~~`[30, 34]`~~ | ~~已修复：当前 Generator LBP 仅含 34#/30#，与 Checker 一致~~ |
| ADL 文本 | 通用文本 | 含部位关键词 | 12 错误 |

> **⚠️ 复核注 (2026-02-12):** `soap-generator.ts:98` 的 LBP MUSCLE_MAP 已使用 `iliocostalis` 等具体肌束名，与 Checker 一致。
> 肌肉命名不一致仅存在于 `tx-sequence-engine.ts:50`（使用 `erector spinae` 总称）。
> LBP 针具问题在 clean-release 分支已修复，Generator LBP 模板 (line 534) 仅含 `34#` 和 `30#`。

---

## Phase 0: 准备（1 天）

- [ ] 创建分支 `refactor/unified-data-flow`
- [ ] **修复测试基础设施**：后端 Jest 配置 `roots` 引用不存在的 `tests/` 目录，需创建目录或移除该 root
- [ ] 运行全部测试，记录基准结果（截图保存）
  - 前端 Vitest (`cd frontend && npx vitest run`)：当前 882 个测试（861 passed, 20 failed, 1 skipped）
  - 后端 Jest (`npm test`)：需先修复配置后运行
  - **已知失败**：`engine-random.test.ts` 中 20 个测试因 symptomChange 逻辑问题失败
- [ ] 收集 3-5 份真实 PDF 样本作为集成测试数据
- [ ] 冻结功能开发（需业务方确认）
- [ ] 确认回滚策略：每个 Phase 完成后打 tag

**回滚点**: `git tag v2.0-pre-refactor`

---

## Phase 1: 建立单一真相来源（3 天）

### 1.1 创建 `src/shared/field-parsers.ts`

统一所有从文本提取结构化数据的逻辑。

**命名规范：**
- `parse*()` — 文本 → 枚举/类型（如 `parseAdlSeverity`）
- `extract*()` — 文本 → 数值（如 `extractPainCurrent`）
- `compare*()` — 两值比较（如 `compareSeverity`）

**需要迁移的函数：**

| 函数 | 来源 | 说明 |
|-----|------|------|
| `extractPainCurrent()` | note-checker.ts:24, bridge.ts:70, correction-generator.ts:16 | 处理 current/value/range 三种格式 |
| `parseGoalPainTarget()` | note-checker.ts:32 | 从目标文本提取数值 |
| `parseAdlSeverity()` | note-checker.ts:50, parser.ts:436, bridge.ts:55 | ADL 严重程度 |
| `parseAdlActivities()` | bridge.ts:142 | ADL 活动列表 |
| `parseProgressStatus()` | note-checker.ts:87 | 进展状态 |
| `extractProgressReasons()` | note-checker.ts:95 | 进展原因 |
| `parseFrequencyLevel()` | note-checker.ts:59 | 频率等级 |
| `compareSeverity()` | note-checker.ts:125 | 严重程度比较 |
| `severityRank()` | soap-constraints.ts:70 | 严重程度数值化（原名 `severityRank`，迁移后重命名为 `severityToRank`） |
| `parseTendernessScale()` | soap-constraints.ts:56 | 压痛等级 |
| `parseSpasmScale()` | soap-constraints.ts:61 | 痉挛等级 |
| `parseStrengthScore()` | note-checker.ts:15 | 肌力评分 |

### 1.2 重构 `types.ts`（并行运行策略）

**v1.0 方案（已废弃）：直接删除 `adlImpairment`**
**v2.1 方案：`@deprecated` 标记 + 并行运行**

```diff
 interface Subjective {
+  /** @deprecated 使用 adlDifficultyLevel + adlActivities 替代，将在 Phase 5 删除 */
   adlImpairment: string
-  adlDifficultyLevel?: 'mild' | 'mild to moderate' | 'moderate' | 'moderate to severe' | 'severe'
+  adlDifficultyLevel: SeverityLevel   // 必填，由 Parser 标准化
+  adlActivities: string[]             // 新增，具体 ADL 活动列表
+  adlRawText?: string                 // 可选，保留原始文本用于调试
 }
```

**新增进展原因字段：**

```diff
 interface Assessment {
   symptomChange: 'improvement' | 'slight improvement' | 'no change' | 'exacerbate'
+  progressReasons?: { positive: string[]; negative: string[] }
 }
```

> 并行运行期间：`adlImpairment` 保留但标记废弃，所有消费方优先读取 `adlDifficultyLevel`。
> 若 `adlDifficultyLevel` 为空，fallback 到 `parseAdlSeverity(adlImpairment)`。

### 1.3 更新 `parser.ts`

- 导入 `src/shared/field-parsers` 中的共享函数
- 删除本地 `parseAdlDifficultyLevel()` 函数
- 填充新字段 `adlActivities`、`progressReasons`
- 将原始文本存入 `adlRawText`（调试用）
- **保留** `adlImpairment` 赋值（并行运行期）

### 1.4 更新 `note-checker.ts`

- 导入 `src/shared/field-parsers` 中的共享函数
- 删除本地 `parsePainCurrent()`、`parseAdlSeverity()`、`parseProgressStatus()`、`extractProgressReasons()`、`scoreByStrength()`、`frequencyLevel()`、`compareSeverity()`
- 所有规则改为读取规范化字段（`adlDifficultyLevel` 而非 `adlImpairment`）

### 1.5 更新 `bridge.ts`

- 导入共享函数
- 删除本地 `parseSeverityFromAdlText()`、`parsePainCurrent()`
- `parseSeverityFromVisit()` 简化为直接读取 `adlDifficultyLevel`（保留 fallback）

### 1.6 更新 `correction-generator.ts`

- 导入共享函数
- 删除本地 `parsePainCurrent()`

### 1.7 更新 `soap-constraints.ts`

- 导入共享函数
- 删除本地 `parseTendernessScale()`、`parseSpasmScale()`、`severityRank()`、`frequencyRank()`

**回滚点**: `git tag v2.1-phase1` — 若 Phase 2 失败，可回退到此处

---

## Phase 2: 统一常量映射（2 天）

### 2.1 创建 `src/shared/body-part-constants.ts`

统一 Generator 和 Checker 使用的所有身体部位相关常量。

**需要统一的常量：**

| 常量 | Generator 位置 | Checker 位置 | 统一到 |
|-----|---------------|-------------|--------|
| 肌肉映射 | soap-generator.ts `MUSCLE_MAP` | note-checker.ts 关键词 | `BODY_PART_MUSCLES` |
| ADL 映射 | soap-generator.ts `ADL_MAP` | note-checker.ts 关键词 | `BODY_PART_ADL` |
| ROM 正常值 | soap-generator.ts 硬编码 | note-checker.ts 硬编码 | `BODY_PART_ROM_NORMAL` |
| ROM 限制因子 | soap-generator.ts 线性插值 `getLimitationFactor()` | note-checker.ts 分段常量 `limitFactor` | `romLimitFactor()` |
| 针具号数 | soap-generator.ts 硬编码 | note-checker.ts validGauges | `BODY_PART_NEEDLE_GAUGES` |
| ICD 侧性后缀 | generator.js 写死 | note-checker.ts 期望动态 | `ICD_LATERALITY_SUFFIX` |
| 肌肉映射(权重) | weight-system.ts `bodyPartMuscles`:226 | — | `BODY_PART_MUSCLES` |
| ADL映射(权重) | weight-system.ts `bodyPartAdl`:328 | — | `BODY_PART_ADL` |
| 肌肉配置(HTML) | objective-generator.ts `MUSCLE_CONFIGS`:63 | — | `BODY_PART_MUSCLES` |
| severityFromPain | tx-sequence-engine.ts:336 (本地副本) | — | `severity.ts` (已有，需删除重复) |

> **⚠️ 复核注：** `objective-generator.ts` 的 KNEE 肌肉列表 (`Quadriceps, Vastus lateralis...`) 与
> `soap-generator.ts` 的 KNEE 列表 (`Gluteus Maximus, Piriformis...`) **完全不同**，需在统一时决定以哪个为准。

### 2.2 更新 `soap-generator.ts`

- 导入 `src/shared/body-part-constants`
- 删除本地 `MUSCLE_MAP`、`ADL_MAP`
- 使用共享 `romLimitFactor()` 替代本地线性插值 `getLimitationFactor()`

### 2.3 更新 `tx-sequence-engine.ts`

- 导入 `src/shared/body-part-constants`
- 删除本地 `MUSCLE_MAP`、`ADL_MAP`
- 删除本地 `severityFromPain()` (line 336-348)，改为 `import { severityFromPain } from '../shared/severity'`

### 2.4 更新 `note-checker.ts`

- 导入共享常量用于验证

### 2.5 更新 `weight-system.ts`

- 删除本地 `bodyPartMuscles` (line 225-231)，改为从 `body-part-constants` 导入
- 删除本地 `bodyPartAdl` (line 328-336)，改为从 `body-part-constants` 导入

### 2.6 更新 `objective-generator.ts`

- `MUSCLE_CONFIGS` (line 63-106) 的 `muscles` 字段改为从 `body-part-constants` 导入
- 注意：`defaultTightness` / `defaultTenderness` / `defaultSpasm` 为 HTML 生成专用，保留在本地

**回滚点**: `git tag v2.1-phase2`

---

## Phase 3: 输出验证器（2 天）

> v2.1 变更：从 `src/generator/self-check.ts` 移至 `src/validator/output-validator.ts`，
> 避免 Generator → Parser → Checker 循环依赖。

### 3.1 创建 `src/validator/output-validator.ts`

独立的验证模块，不属于 Generator 也不属于 Checker。

**依赖关系（无循环）：**

```
src/validator/output-validator.ts
    ├── imports: parsers/optum-note/parser.ts     (回解析)
    ├── imports: parsers/optum-note/checker/       (验证)
    └── imports: src/shared/field-parsers.ts       (共享逻辑)

frontend/src/services/generator.js
    └── imports: src/validator/output-validator.ts  (调用验证)
```

**流程：**

```
TXVisitState
    │
    ▼
exportSOAPAsText()  →  SOAP 文本
    │
    ▼
OutputValidator.validate(soapText)
    ├── parseOptumNote()    →  VisitRecord（回解析）
    ├── checkDocument()     →  CheckOutput（验证）
    │
    ▼
passed? → 返回 { valid: true, text }
failed? → 返回 { valid: false, errors, text }
```

### 3.2 集成验证器到 `generator.js`

- 每个生成的 visit 都经过验证
- CRITICAL/HIGH 错误 → 抛出异常（阻止输出）
- MEDIUM 错误 → 记录警告（允许输出）
- 验证失败时返回错误详情，不静默吞掉

**回滚点**: `git tag v2.1-phase3`

---

## Phase 4: 测试与验证（2 天）

### 4.1 为 `field-parsers.ts` 编写单元测试

每个共享函数 100% 覆盖：

| 函数 | 测试用例数 |
|-----|----------|
| `extractPainCurrent` | 5（单值/范围/详细/缺失/默认） |
| `parseAdlSeverity` | 6（5 级 + 空值） |
| `parseProgressStatus` | 4（improvement/exacerbate/similar/null） |
| `extractProgressReasons` | 4（正向/负向/混合/空） |
| `parseFrequencyLevel` | 5（4 级 + 默认） |
| `compareSeverity` | 4（大于/小于/相等/无效） |
| `parseTendernessScale` | 3（+1/+3/无效） |
| `parseStrengthScore` | 4（整数/半级/无效/默认） |

### 4.2 数据流集成测试

验证 Parser → Checker → Generator 完整流程：

- Parser 提取的字段能被 Checker 正确读取
- Generator 生成的文本能通过 OutputValidator 验证
- 共享常量在三个模块中一致
- 使用 Phase 0 收集的真实 PDF 样本

### 4.3 回归测试

- 运行原有 882 个测试（Vitest 前端），确保通过数不低于基准 861
- 对比基准结果，确认无退化
- 验证 `adlImpairment`（deprecated）与 `adlDifficultyLevel` 在并行期输出一致

**回滚点**: `git tag v2.1-phase4`

---

## Phase 5: 清理废弃字段（2 天）

> v2.1 新增。在并行运行验证通过后，执行最终清理。

### 5.1 前置条件

- [ ] Phase 1-4 全部完成且测试通过
- [ ] 并行运行期间无 fallback 到 `adlImpairment` 的日志
- [ ] 至少运行 1 轮完整的真实数据验证

### 5.2 删除废弃字段

```diff
 interface Subjective {
-  /** @deprecated */
-  adlImpairment: string
   adlDifficultyLevel: SeverityLevel
   adlActivities: string[]
   adlRawText?: string
 }
```

### 5.3 清理 fallback 逻辑

- 删除 `bridge.ts` 中 `parseSeverityFromVisit()` 的 fallback 分支
- 删除所有 `adlImpairment` 引用
- 搜索全项目确认无遗漏引用

### 5.4 最终回归

- 运行全部测试
- 确认无编译错误
- 确认无运行时引用 `adlImpairment`

**最终 tag**: `git tag v2.1-complete`

---

## 风险矩阵

| 风险 | 概率 | 影响 | 缓解措施 |
|-----|------|------|---------|
| 解析函数迁移后行为不一致 | 中 | 高 | 逐函数迁移 + 单元测试对比 |
| `adlImpairment` 删除导致级联失败 | 高 | 高 | **并行运行策略（Phase 5 延迟删除）** |
| Generator 自检引入循环依赖 | 高 | 中 | **移至 `src/validator/`（独立模块）** |
| 常量统一后 Generator 输出变化 | 中 | 高 | 常量值以 Checker 期望为准，Generator 适配 |
| 10+ 天冻结影响业务 | 低 | 中 | Phase 可独立部署，非全有全无 |
| 真实 PDF 解析与测试数据不一致 | 中 | 中 | Phase 0 收集真实样本 |

---

## 文件变更清单

### 新建文件

| 文件 | 行数 | 说明 |
|-----|------|------|
| `src/shared/field-parsers.ts` | ~200 | 统一字段解析器 |
| `src/shared/body-part-constants.ts` | ~200 | 统一身体部位常量 |
| `src/validator/output-validator.ts` | ~80 | 输出验证器（原 self-check） |
| `src/tests/shared/field-parsers.test.ts` | ~200 | 解析器单元测试 |
| `src/tests/integration/data-flow.test.ts` | ~150 | 数据流集成测试 |

### 修改文件

| 文件 | 变更类型 | 说明 |
|-----|---------|------|
| `parsers/optum-note/types.ts` | 重构 | `adlImpairment` 标记 @deprecated，新增 `adlActivities`、`adlRawText`、`progressReasons` |
| `parsers/optum-note/parser.ts` | 重构 | 使用共享解析器，删除本地函数 |
| `parsers/optum-note/checker/note-checker.ts` | 重构 | 使用共享解析器和常量，删除 ~80 行本地函数 |
| `parsers/optum-note/checker/bridge.ts` | 重构 | 使用共享解析器，删除 ~30 行本地函数 |
| `parsers/optum-note/checker/correction-generator.ts` | 重构 | 使用共享解析器 |
| `src/shared/soap-constraints.ts` | 重构 | 使用共享解析器，删除 ~30 行本地函数 |
| `src/generator/soap-generator.ts` | 重构 | 使用共享常量，删除本地 MUSCLE_MAP/ADL_MAP |
| `src/generator/tx-sequence-engine.ts` | 重构 | 使用共享常量 |
| `frontend/src/services/generator.js` | 增强 | 集成 OutputValidator |

### 删除的代码

| 来源 | 删除函数 | 替代 |
|-----|---------|------|
| note-checker.ts | `parsePainCurrent()` | `field-parsers.extractPainCurrent()` |
| note-checker.ts | `parseAdlSeverity()` | `field-parsers.parseAdlSeverity()` |
| note-checker.ts | `parseProgressStatus()` | `field-parsers.parseProgressStatus()` |
| note-checker.ts | `extractProgressReasons()` | `field-parsers.extractProgressReasons()` |
| note-checker.ts | `scoreByStrength()` | `field-parsers.parseStrengthScore()` |
| note-checker.ts | `frequencyLevel()` | `field-parsers.parseFrequencyLevel()` |
| note-checker.ts | `compareSeverity()` | `field-parsers.compareSeverity()` |
| parser.ts | `parseAdlDifficultyLevel()` | `field-parsers.parseAdlSeverity()` |
| bridge.ts | `parseSeverityFromAdlText()` | `field-parsers.parseAdlSeverity()` |
| bridge.ts | `parsePainCurrent()` | `field-parsers.extractPainCurrent()` |
| correction-generator.ts | `parsePainCurrent()` | `field-parsers.extractPainCurrent()` |
| soap-constraints.ts | `parseTendernessScale()` | `field-parsers.parseTendernessScale()` |
| soap-constraints.ts | `parseSpasmScale()` | `field-parsers.parseSpasmScale()` |
| soap-constraints.ts | `severityRank()` (line 70) | `field-parsers.severityToRank()` |
| soap-constraints.ts | `frequencyRank()` | `field-parsers.parseFrequencyLevel()` |
| soap-generator.ts | `MUSCLE_MAP` | `body-part-constants.BODY_PART_MUSCLES` |
| soap-generator.ts | `ADL_MAP` | `body-part-constants.BODY_PART_ADL` |
| tx-sequence-engine.ts | `MUSCLE_MAP` | `body-part-constants.BODY_PART_MUSCLES` |
| tx-sequence-engine.ts | `ADL_MAP` | `body-part-constants.BODY_PART_ADL` |
| tx-sequence-engine.ts | `severityFromPain()` (line 336) | `import { severityFromPain } from '../shared/severity'` |
| weight-system.ts | `bodyPartMuscles` (line 225) | `body-part-constants.BODY_PART_MUSCLES` |
| weight-system.ts | `bodyPartAdl` (line 328) | `body-part-constants.BODY_PART_ADL` |
| objective-generator.ts | `MUSCLE_CONFIGS.muscles` (line 63) | `body-part-constants.BODY_PART_MUSCLES` |

---

## 重构后的数据流

```
                    src/shared/
                    ├── field-parsers.ts        ← 🆕 新建：统一解析逻辑
                    ├── body-part-constants.ts  ← 🆕 新建：统一常量映射
                    ├── severity.ts             ← [已有] 业务规则 (severityFromPain, expectedTenderMinScaleByPain)
                    ├── soap-constraints.ts     ← [已有] Writer 自检规则 (Phase 1.7 重构)
                    ├── tcm-mappings.ts         ← [已有]
                    └── adl-mappings.ts          ← [已有]
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        Parser       Checker      Generator
     (parser.ts)  (note-checker) (soap-generator)
            │            │            │
            ▼            ▼            ▼
     PDF → VisitRecord  验证规则   VisitRecord → SOAP
     (填充规范化字段)  (读取规范化字段) (读取规范化字段)
                                      │
                                      ▼
                              src/validator/
                              output-validator.ts
                              (回解析 + 验证)
```

---

## 验收标准

- [ ] `src/shared/field-parsers.ts` 中无重复函数
- [ ] `note-checker.ts` 中无本地解析函数
- [ ] `parser.ts` 中无本地解析函数
- [ ] `bridge.ts` 中无本地解析函数
- [ ] `correction-generator.ts` 中无本地解析函数
- [ ] `soap-generator.ts` 中无本地 MUSCLE_MAP/ADL_MAP
- [ ] `tx-sequence-engine.ts` 中无本地 MUSCLE_MAP/ADL_MAP
- [ ] `types.ts` 中 `adlImpairment` 已标记 @deprecated（Phase 1-4）或已删除（Phase 5）
- [ ] 所有 882 个测试通过（或不低于基准通过数 861）
- [ ] OutputValidator 集成完成（无循环依赖）
- [ ] 新增测试覆盖率 >= 80%
- [ ] 每个 Phase 有独立 git tag 回滚点
- [ ] 并行运行期无 fallback 触发（Phase 5 前置条件）

---

## 附录：多代理评估报告

> 评估日期: 2026-02-12
> 评估版本: v2.1

### 综合评分

| 维度 | 评分 | 权重 | 加权分 |
|-----|------|------|--------|
| 代码审查 | 92 | 20% | 18.4 |
| 架构设计 | 86 | 25% | 21.5 |
| 测试策略 | 78 | 25% | 19.5 |
| 风险控制 | 74 | 30% | 22.2 |
| **总分** | **81.6** | 100% | **81.6** |

---

### A. 代码审查员：函数重复度分析（92/100）

**三份 `parsePainCurrent` 实现对比：**

| 位置 | 代码逻辑 | 类型检查方式 | 差异 |
|-----|---------|------------|------|
| note-checker.ts:24 | `ps?.current` → `ps?.value` → `ps?.range?.max` → `7` | optional chaining | ✅ 基准 |
| bridge.ts:70 | `ps?.current` → `ps?.value` → `ps?.range?.max` → `7` | optional chaining | ✅ 相同 |
| correction-generator.ts:16 | `'current' in ps` → `'range' in ps` → `'value' in ps` → `7` | `in` 操作符 | ⚠️ **顺序和检查方式均不同** |

> **⚠️ 风险场景：** 当 `painScale = { value: 5, range: { max: 8 } }`（无 `current`）时：
> - note-checker / bridge → 返回 **5**（走 `value` 分支）
> - correction-generator → 返回 **8**（走 `range.max` 分支）
> 统一时应以 note-checker 版本（`current → value → range.max`）为准。

**三份 ADL severity 解析对比：**

| 位置 | 代码逻辑 | 差异 |
|-----|---------|------|
| parser.ts:436 | `moderate to severe` → `mild to moderate` → `severe` → `moderate` → `mild` | ✅ 相同 |
| note-checker.ts:50 | `moderate to severe` → `mild to moderate` → `severe` → `moderate` → `mild` | ✅ 相同 |
| bridge.ts:55 | `moderate to severe` → `mild to moderate` → `severe` → `moderate` → `mild` | ✅ 相同 |

**结论：**
- ADL severity 三份 100% 相同 ✅
- `parsePainCurrent` 有微妙差异：correction-generator 使用 `'current' in ps` 检查
- 统一时应选择 **note-checker.ts 版本**（最简洁，使用 optional chaining）

**改进建议：**
1. Phase 1.1 明确选择 note-checker.ts 版本作为标准实现
2. field-parsers.ts 中添加 JSDoc 注释说明 fallback 顺序

---

### B. 架构师：依赖关系与模块边界（86/100）

**v2.1 依赖图验证：**

```
src/validator/output-validator.ts
    ├── parsers/optum-note/parser.ts (parseOptumNote)
    ├── parsers/optum-note/checker/ (checkDocument)
    └── src/shared/field-parsers.ts

frontend/src/services/generator.js
    ├── src/generator/soap-generator.ts (exportSOAPAsText)
    └── src/validator/output-validator.ts (validate)

src/generator/soap-generator.ts
    ├── src/shared/body-part-constants.ts
    └── src/shared/field-parsers.ts
```

**循环依赖检查：** ✅ 无循环

**并行运行策略风险：**
- `@deprecated adlImpairment` 保留期间，Parser 需同时填充两个字段
- 如果 Parser 填充 `adlDifficultyLevel` 有 bug，fallback 会掩盖问题 ⚠️

**src/shared/ 模块边界：**
- 现有 4 文件 652 行 + 新增 2 文件 400 行 = 总计 ~1052 行，6 个文件
- 职责清晰分离，不会变成 God Module ✅

**改进建议：**
1. Parser 填充 `adlDifficultyLevel` 后，立即验证与 `parseAdlSeverity(adlImpairment)` 一致性
2. `field-parsers.ts` 按功能分组：Pain / ADL / Progress / Scale / Comparison
3. 考虑 TypeScript path alias：`@shared/field-parsers`

---

### C. QA 工程师：测试策略评估（78/100）

**Phase 4 测试计划分析：**

| 测试类型 | 计划用例数 | 实际需要 | 差距 |
|---------|----------|---------|------|
| 单元测试 | 35 | 50+ | -15 |
| 快照测试 | 未规划 | 需要 | 缺失 |
| 静态检查 | 未规划 | 需要 | 缺失 |

**问题：**
1. 35 个单元测试用例不足以覆盖 12 个函数的所有边界情况
2. 并行运行期测试策略不明确
3. Phase 5 清理测试缺少静态分析

**改进建议：**
1. Phase 4.1 单元测试用例数从 35 增加到 50+
2. Phase 4.3 增加快照对比：
   ```bash
   npm test -- --json > baseline.json  # Phase 1 前
   npm test -- --json > phase1.json    # Phase 1 后
   diff baseline.json phase1.json
   ```
3. Phase 5.3 增加静态检查：
   ```bash
   grep -r "adlImpairment" src/ parsers/ frontend/  # 确认 0 结果
   ```
4. Phase 0 收集 5-10 份真实 PDF（原计划 3-5 份）

---

### D. 风险分析师：执行风险评估（74/100）

**v1.0 → v2.1 P0 修订有效性：**

| P0 问题 | v2.1 方案 | 是否解决 |
|--------|----------|----------|
| 无回滚计划 | 每个 Phase 打 git tag | ✅ 部分解决 |
| 级联删除风险 | `@deprecated` + Phase 5 延迟删除 | ✅ 有效缓解 |
| 自检循环依赖 | `src/validator/output-validator.ts` | ✅ 完全解决 |

**12 天工期现实性：**

| Phase | 预估 | 实际可能 | 风险 |
|-------|------|---------|------|
| Phase 0 | 1 天 | 1 天 | 低 |
| Phase 1 | 3 天 | 4-5 天 | **高** |
| Phase 2 | 2 天 | 2-3 天 | 中 |
| Phase 3 | 2 天 | 2 天 | 低 |
| Phase 4 | 2 天 | 3-4 天 | **高** |
| Phase 5 | 2 天 | 1-2 天 | 低 |
| **总计** | **12 天** | **13-17 天** | - |

**改进建议：**
1. 工期调整为 **14 天**（Phase 1 +1, Phase 4 +1）
2. Phase 0 增加：导出当前 Generator 输出作为 baseline
3. Parser 中添加 fallback 日志监控：
   ```typescript
   if (!adlDifficultyLevel) {
     console.warn('[DEPRECATED] Fallback to parseAdlSeverity(adlImpairment)')
   }
   ```
4. Phase 5 触发条件增加：业务方确认 Generator 输出符合预期
5. 考虑使用 feature flag 控制并行运行期

---

### 关键改进清单（P0）

- [ ] **工期调整：** 12 天 → 14 天
- [ ] **测试用例：** 35 个 → 50+ 个单元测试
- [ ] **快照测试：** Phase 1/2/4 前后对比 882 个测试输出
- [ ] **Fallback 监控：** Parser 中添加 `console.warn` 日志
- [ ] **Baseline 导出：** Phase 0 导出当前 Generator 输出
- [ ] **静态检查：** Phase 5 增加 `grep -r "adlImpairment"` 确认 0 结果
- [ ] **PDF 样本：** 收集 5-10 份（原计划 3-5 份）
