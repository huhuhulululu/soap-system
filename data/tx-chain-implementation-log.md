# TX 纵横向逻辑链落地记录

## 1. 目标与约束
- 目标：在 IE 之后支持连续多个 TX 的生成，做到：
  - 横向链：单次 TX 内 S/O/A/P 规则加权联动
  - 纵向链：TX1 -> TX2 -> TX3 的趋势收敛（向 short term goal）
  - 仅好转分支（不走恶化/持平文案）
  - 双侧时左右改善不同步（不对齐）
- 约束：
  - 严格使用模板动态字段与模板选项
  - `P` 不参与纵向联动（保持原逻辑）
  - 先后要求：`TONE` 加载到 `O` 末尾、`NEEDLE` 加载到 `P` 末尾

## 2. 前期整治（模板边界 + 规则链）
### 2.1 模板白名单与规则过滤
- 新增/强化：`src/parser/template-rule-whitelist.ts`
  - 仅允许模板可识别 field/option 进入规则链
  - 加载顺序：`ie/tx` -> `tone(O末尾)` -> `needles(P末尾)`

### 2.2 模板规则集
- 新增/扩展：`src/parser/template-logic-rules.ts`
  - 仅保留模板内字段与选项
  - 补齐慢性/急性、疼痛分级、证型舌脉、ADL、针刺点位等链路
  - 补齐 TX 复诊链：`symptomChange -> reasonConnector -> reason`
    - improvement / relapse / exacerbate / similar 四分支
  - 补齐恶化因素词（模板内）：weather/cold、停治、间断治疗、体质弱等

### 2.3 解析器字段识别
- 更新：`src/parser/dropdown-parser.ts`
  - 增加 TX 关键字段识别：
    - `subjective.symptomChange`
    - `subjective.reason`
    - `subjective.reasonConnector`
  - 其他模板字段映射补齐（用于规则链覆盖）

### 2.4 规则上下文承接
- 更新：`src/parser/rule-engine.ts`
  - 扩展 `RuleContext.subjective` 结构，承接 TX 链路字段

## 3. 审计体系
### 3.1 新增全字段绑定审计
- 新增：`scripts/audit-template-chain-binding.ts`
  - 审计模板识别字段是否被规则链绑定
  - 排除“既定事实/策略固定”字段（ROM、painScale拆项、evaluationType、e-stim、operation time 等）

### 3.2 核心字段完整性审计
- 维持：`scripts/audit-weight-chain-completeness.ts`
  - 核心权重字段模板存在性 + 规则覆盖性

### 3.3 审计结果
- `Missing binding: 0`
- `Missing template field: 0`
- `Missing rule coverage: 0`

## 4. 纵向引擎（跨 TX）
### 4.1 新增序列引擎
- 新增：`src/generator/tx-sequence-engine.ts`
- 功能：
  - 生成 `TXVisitState[]`
  - 只输出 improvement 分支
  - pain/ADL/频率等向 short-term goal 收敛
  - 双侧输出 `sideProgress.left/right`（不对齐）
  - 注入客观扰动因子：
    - `sessionGapDays`
    - `sleepLoad`
    - `workloadLoad`
    - `weatherExposureLoad`
    - `adherenceLoad`
  - 默认不可复现（运行时熵混合，不依赖固定 seed）

### 4.2 S/O/A 硬链条
- 在 `TXVisitState` 中新增 `soaChain`：
  - `subjective`: pain/adl/frequency 变化声明
  - `objective`: tightness/tenderness/ROM/strength 趋势
  - `assessment`: 由 S+O 反推得到（present/patientChange/whatChanged/physicalChange/findingType）

## 5. 与 soap-generator.ts 集成（最终落地）
### 5.1 集成方式
- 更新：`src/generator/soap-generator.ts`
  - `generateSubjectiveTX(context, visitState?)`
  - `generateObjective(context, visitState?)`
  - `generateAssessmentTX(context, visitState?)`
  - `exportSOAPAsText(context, visitState?)`
- 新增批量导出：
  - `exportTXSeriesAsText(context, options)`
  - 输出：每次 TX 的 `state + text`

### 5.2 结果
- `S` 使用 visitState（pain/reason/frequency 等）
- `O` 使用 visitState（severity + bilateral sideProgress）
- `A` 使用 visitState.soaChain.assessment 强制同步
- `P` 保持原逻辑（`generatePlanTX + generateNeedleProtocol`）

## 6. 对外导出
- 更新：`src/index.ts`
  - 导出 `generateTXSequenceStates`
  - 导出 `exportTXSeriesAsText`
  - 导出相关类型 `TXVisitState`、`TXSeriesTextItem`

## 7. 测试与验证
### 7.1 新增测试
- `src/generator/__tests__/tx-sequence-engine.test.ts`
  - 仅好转
  - 趋近 short-term goal
  - 双侧不对齐
  - 客观扰动因子范围与变化
  - S->O->A 链一致性
- `src/generator/__tests__/tx-series-soa-integration.test.ts`
  - `soap-generator` 中 S/O/A 注入生效
  - `P` 跨访次保持不变

### 7.2 全量测试
- 结果：`9 suites passed, 43 tests passed`

## 8. 关键文件清单
- `src/parser/template-rule-whitelist.ts`
- `src/parser/template-logic-rules.ts`
- `src/parser/dropdown-parser.ts`
- `src/parser/rule-engine.ts`
- `scripts/audit-template-chain-binding.ts`
- `src/generator/tx-sequence-engine.ts`
- `src/generator/soap-generator.ts`
- `src/generator/__tests__/tx-sequence-engine.test.ts`
- `src/generator/__tests__/tx-series-soa-integration.test.ts`
- `src/index.ts`

## 9. 当前状态
- 已完成“横向+纵向”逻辑链并接入最终 TX 文本输出流程
- 满足：模板边界、S/O/A 强链条、双侧不对齐、P 保持不变

## 2026-02-09 Additional Investigation (Body-Part Sweep)

- Performed multi-body-part stress sweeps and semantic chain checks.
- Identified edge-case issue for unsupported TX body parts (e.g., HAND/FOOT/ARM/FOREARM):
  - empty tenderness muscle list,
  - empty ROM section,
  - assessment still claiming ROM improvement.
- Root cause: generator allowed body parts without corresponding TX templates.

### Fix
- Added template support guard in `src/generator/soap-generator.ts`:
  - `SUPPORTED_TX_BODY_PARTS = ELBOW, KNEE, LBP, NECK, SHOULDER`
  - `SUPPORTED_IE_BODY_PARTS = ELBOW, HIP, KNEE, LBP, NECK, SHOULDER, THIGH`
  - Throws explicit error when unsupported body part is requested.

### Validation
- Added tests in `src/generator/__tests__/tx-series-soa-integration.test.ts`:
  - reject unsupported TX body part
  - reject unsupported IE body part
- Test result: `9 suites passed, 47 tests passed`.
- Supported-body-part resweep (`SHOULDER/KNEE/LBP/NECK/ELBOW`, 250 series): no regressions found.

## 2026-02-09 IE Sweep Follow-up

- Ran IE stress sweep and found:
  - NECK `tongue/pulse` alert was a checker false-positive (objective text contains "...Assessment:" causing naive split issue).
  - Real issue: `THIGH` was marked as IE-supported but lacked complete objective mappings (empty tenderness/ROM output risk).

### Fix
- Removed `THIGH` from `SUPPORTED_IE_BODY_PARTS` in `src/generator/soap-generator.ts`.
- Current IE supported body parts: `ELBOW, HIP, KNEE, LBP, NECK, SHOULDER`.

### Verification
- Test suites: `9 passed, 47 tests passed`.
- IE resweep after fix:
  - supported cases: 240
  - unsupported cases: 10
  - findings: 0

## 2026-02-09 Insurance Isolation Sweep

- Purpose: verify insurance differences do not leak into S/O/A logic.
- Method:
  - TX: fixed same `visitState`, compare all insurance outputs (`NONE/HF/OPTUM/WC/VC/ELDERPLAN`) across supported TX body parts and lateralities.
  - IE: compare all insurance outputs across supported IE body parts and lateralities.
  - Unsupported body parts must always be rejected for both TX and IE.

### Result
- TX cases checked: 15
- IE cases checked: 18
- Findings: 0
- Conclusion:
  - S/O/A are insurance-invariant under fixed visit state.
  - Insurance differences remain in Plan/needle protocol behavior.
  - Unsupported body parts are correctly rejected.

## 2026-02-09 Legacy Rule Cleanup

### Goal
- Eliminate remaining `rule-template alignment` residual issues from legacy rule source.

### Changes
- Reworked `src/parser/logic-rules.ts` into a compatibility shim:
  - Kept public type/interface and export names stable.
  - Deprecated historical non-template categories by exporting empty arrays.
  - Set `ALL_LOGIC_RULES` to `TEMPLATE_ONLY_RULES` (template-aligned source of truth).
- Updated `scripts/audit-rules-template-alignment.ts`:
  - Switched audit data source to `template-rule-whitelist` APIs (`isTemplateField`, `getTemplateOptionsForField`) to match active runtime rule constraints.
- Added whitelist utility exports in `src/parser/template-rule-whitelist.ts`:
  - `getAllTemplateFieldPaths()`
  - `getAllTemplateOptionsNormalized()`

### Verification
- Unit tests: `9 suites passed, 47 tests passed`.
- Rule-template alignment: `Issues: 0`.
- Template chain binding: `Missing binding: 0`.
- Weight chain completeness: `Missing template field: 0`, `Missing rule coverage: 0`.
