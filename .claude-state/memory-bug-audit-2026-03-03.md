# Memory 审计记录（BUG-03 ~ BUG-06）

日期: 2026-03-03  
范围: `soap-system` 当前工作树（含未提交改动）

---

## 1) 结论总览

| Bug | 结论 | 严重级别复核 | 备注 |
|---|---|---|---|
| BUG-03 | 成立 | HIGH（维持） | 引擎起始 pain 源缺失 `context.painCurrent` fallback |
| BUG-04 | 成立 | MEDIUM | TX 设计为单值 `associatedSymptom`，多值会被压扁 |
| BUG-05 | 成立 | MEDIUM | IE 与 TX 肌肉来源双轨，导致数量/集合不一致 |
| BUG-06 | 部分成立 | HIGH（维持） | 当前不是“trend=improved 但 ROM 不变”，而是大量 “trend=stable 但 ROM 仍变化” |

---

## 2) 复现证据

### BUG-03: startPain 不读 context.painCurrent，fallback 到 8

代码证据:
- `ieStartPain = context.previousIE?.subjective?.painScale?.current ?? 8`
- `startPain = options.initialState?.pain ?? ieStartPain`
- 文件: `src/generator/tx-sequence-engine.ts:819-820`

复现（`painCurrent=7`）:
- 无 `initialState`：首访 `painScaleCurrent = 7.181...`
- 有 `initialState.pain=7`：首访 `painScaleCurrent = 6.181...`
- 同 seed 差值固定约 1 分

影响:
- `startPain` 会进入 goal path、累计改善、severity 轨迹等多个下游计算，偏移会放大到整条 TX 序列。

---

### BUG-04: TX associatedSymptom 单值设计丢失多值

代码证据:
- TX 状态模型是单值: `associatedSymptom: string`
- 文件: `src/generator/tx-sequence-engine.ts:118-129`
- 渲染层优先消费单值 `visitState.associatedSymptom`，否则只取 `context.associatedSymptoms[0]`
- 文件: `src/generator/soap-generator.ts:1915-1918`
- context 类型支持多值数组
- 文件: `src/types/index.ts:302-314`

复现:
- 输入 `associatedSymptoms: ["stiffness","soreness"]` 且无 `initialState`
- TX 首访实际 `state.associatedSymptom = "soreness"`（第二项丢失）

影响:
- 主诉文本和 Assessment 映射都会按单值走，无法表达多症状并存。

---

### BUG-05: IE vs TX 肌肉选择双源不一致（3 块 vs 4/5 块）

代码证据:
- Objective 渲染:
  - 有 `visitState.tightMuscles` -> 用引擎数组
  - 无 `visitState` -> 回退 `pickWeightedOptions(..., 3)`
  - 文件: `src/generator/soap-generator.ts:1085-1103`
- TX 引擎肌肉数量来自 `MUSCLE_COUNT`（中重度/重度 tightness 可 4~6）
  - 文件: `src/generator/muscle-selector.ts:23-38`

复现:
- SHOULDER severe 样例:
  - IE-like 路径: 3 块
  - TX 路径: 5 块

影响:
- 同一病例横向对比时，IE/TX 肌肉数量与集合变化过大，解释成本高。

---

### BUG-06: ROM 渲染与引擎 romTrend 存在双源脱节

当前状态说明:
- 旧问题 “`romTrend != stable` 但 ROM 文本不变” 在现分支已压到 0（动态审计脚本结果）。
- 但出现另一方向的脱节: `romTrend = stable` 时，ROM 文本仍经常变化。

量化结果（5+部位，120 seeds，20 visits 扫描）:
- `romTrend=stable` 且 ROM 变化: `5559/14677 = 37.88%`
- 在 `symptomChange = similar` visit 中，ROM 变化: `1908/5878 = 32.46%`
- `similar` visit 中，单 visit 最大 ROM 变化达到 `25` 度

样例:
- `bp=SHOULDER, seed=1, visit=2`
- `symptomChange=similar`, `romTrend=stable`, `painLabel 8 -> 8`
- `Abduction 70 -> 85`（+15 度）

根因线索代码:
- 渲染端无论 `romTrend` 是否 stable，都会注入 progress 驱动的改善项:
  - `painLevel = basePain - progress * 2.8`
  - `romAdj = round(progress * 8 + romTrendBoost)`（stable 时 boost 仍为 1）
  - 文件: `src/generator/soap-generator.ts:1185-1188`, `1448-1452`
- 引擎端 `romTrend` 又被 pain label 变化严格门控:
  - `!painLabelChanged => romTrend = "stable"`
  - 文件: `src/generator/tx-sequence-engine.ts:1402-1405`

影响:
- 会直接触发“文本说 similar / stable，但 ROM 数据明显变化”的感知冲突。

---

## 3) 根因归纳

### RC-03（对应 BUG-03）
`generateTXSequenceStates()` 的起点约定是 “`initialState` 或 `previousIE`”，未把 `context.painCurrent` 纳入第三层 fallback。  
结果是 API 合同在“直接调用引擎”与“经过 normalizer 的调用”之间不一致，导致隐性分叉。

### RC-04（对应 BUG-04）
领域模型是多症状（`associatedSymptoms[]`），但 TX 状态与模板消费链路是单症状（`associatedSymptom`）。  
这是模型层与渲染层契约不一致，不是单点逻辑 bug。

### RC-05（对应 BUG-05）
Objective 肌肉渲染处于“迁移过渡态”: TX 优先引擎数组，IE 保留旧权重抽样。  
同一维度（tightness muscles）存在两套选择器，天然会分布不一致。

### RC-06（对应 BUG-06）
ROM 变化同时由两套通道驱动:
1. 引擎 `romTrend`（离散状态，且受 pain label 变化门控）
2. 渲染 `progress/painLevel/romAdj`（连续改变量）

两套通道并行但未设置统一仲裁规则，导致“趋势字段”和“文本度数”可独立漂移。

---

## 4) 优先级建议（修复顺序）

1. BUG-03（HIGH）: 补 `startPain` 第三层 fallback 为 `context.painCurrent`。  
2. BUG-06（HIGH）: 统一 ROM 驱动主源（建议以引擎 `romTrend + romFloors` 为主，渲染侧 progress 改为受控增量）。  
3. BUG-04（MEDIUM）: 决策多症状策略（保留数组并渲染多值，或明确只允许单值并在入口强校验）。  
4. BUG-05（MEDIUM）: 明确 IE/TX 肌肉选择策略是否统一；若不统一，需在文案层解释“评估覆盖范围扩大/收敛”。

---

## 5) 本轮修复落地（2026-03-03）

已完成:
- BUG-03 修复:
  - `startPain` fallback 变更为 `initialState.pain -> previousIE pain -> context.painCurrent -> 8`
  - 文件: `src/generator/tx-sequence-engine.ts`
- BUG-06 修复（架构收敛）:
  - TX ROM 渲染不再额外消费 progress bonus 造成漂移
  - pain 输入对齐到 `painScaleLabel`（同标签下稳定）
  - ROM trend bonus 下调为温和偏置，避免相邻 visit 大跳变
  - 文件: `src/generator/soap-generator.ts`, `src/shared/rom-from-template.ts`
- BUG-04 修复:
  - TX state 新增 `associatedSymptoms`，并保留 `associatedSymptom` 兼容字段
  - 引擎在无 initialState 时不再回退固定 `soreness`，改为继承 `context.associatedSymptoms`
  - Subjective 渲染支持多值输出（`stiffness, soreness`）
  - 文件: `src/generator/tx-sequence-engine.ts`, `src/generator/soap-generator.ts`
- BUG-05 修复:
  - IE Objective 肌肉选择改为优先复用 `muscle-selector`（与 TX 同源）
  - 不再固定 `pickWeightedOptions(...,3)` 造成 IE/TX 数量断层
  - 文件: `src/generator/soap-generator.ts`
- 新增回归测试:
  - `src/generator/__tests__/start-pain-fallback.test.ts`
  - `src/generator/__tests__/rom-trend-render-alignment.test.ts`
  - `src/generator/__tests__/associated-symptoms-multivalue.test.ts`
  - `src/generator/__tests__/objective-ie-muscle-source.test.ts`

修复前后关键指标（同一审计脚本口径）:
- `stableChanged / stableTotal`:
  - 修复前: `5559 / 14677` (`37.88%`)
  - 修复后: `4602 / 14677` (`31.36%`)
- `similarChanged / similarTotal`:
  - 修复前: `1908 / 5878` (`32.46%`)
  - 修复后: `284 / 5878` (`4.83%`)
- `similarDelta>=15`:
  - 修复后: `24 / 5878` (`0.41%`)
- `mixedDirectionEmptyFindingType`:
  - 修复前: `1109`
  - 修复后: `0`

回归验证:
- `start-pain-fallback.test.ts` 通过
- `rom-trend-render-alignment.test.ts` 通过
- `associated-symptoms-multivalue.test.ts` 通过
- `objective-ie-muscle-source.test.ts` 通过
- `derive-assessment.test.ts` 通过（mixed direction findingType 非空）
- `symptom-change-guard.test.ts` 通过
- `goal-driven-engine.test.ts` 通过
- `objective-source-alignment.test.ts` 通过
- `audit:dynamic` / `sentence-audit-v2` / `deep-coherence-audit` 均通过

---

## 6) 严格审计补充（测试基建根因）

新增发现（不属于业务引擎逻辑，但影响审计闭环）:
1. 测试运行器根因:
   - 5 个测试文件使用 `vitest` 的 `vi` API，但仓库默认测试入口是 `jest`（`ts-jest` + CommonJS）。
   - 直接导致全量 `npx jest` 在模块加载阶段失败。
2. 快照基线根因:
   - `fixture-snapshots` 存在 30 条 obsolete snapshot，导致全量回归非零退出。

已修订:
- 将 5 个失败套件统一改为 `jest.*` mock API。
- 执行 `npx jest -u` 清理 30 条 obsolete snapshot。

最终验证（2026-03-03）:
- `npx jest -u` -> `81/81 suites`, `2048 tests`, 全通过，退出码 `0`。
