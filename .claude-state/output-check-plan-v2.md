# 输出检查审计（v2）

日期: 2026-03-04
范围: `SOAP 双格式输出（HTML + Text）` 计划执行结果

---

## 1) 审计结论

- 结论: **通过（PASS）**
- 说明: Phase 1~4 均已落地并通过全量测试回归。
- 边界: Phase 5（IE HTML 下拉）按计划保持后续排期，本轮不计入失败项。

---

## 2) 计划项逐条核对

1. Phase 1（HTML 包装 + 选项集补全）: **通过**
- 新增 `src/shared/html-wrapper.ts`（`escapeHtmlEntities`/`wrapSingle`/`wrapMulti`）
- 补全 `TEMPLATE_TX_PAIN_AREA` / `TEMPLATE_TX_RADIATION` / `TEMPLATE_TX_WHAT_CHANGED_O` / `TEMPLATE_TX_WHAT_CHANGED_S`
- `TEMPLATE_TX_FINDING_TYPE` 已移除 `"joint ROM"`

2. Phase 2（TX Assessment + Plan HTML）: **通过**
- `generateAssessmentTX(..., format)` 与 `generatePlanTX(..., format)` 已落地
- HTML 输出带 `ppnSelectCombo` span，text 模式保持兼容

3. Phase 3（TX Subjective HTML）: **通过**
- `generateSubjectiveTX(..., format)` 已落地
- bodyPart 分支逻辑保留原语义并输出 HTML 下拉 span

4. Phase 4（统一导出 + batch 接入）: **通过**
- 新增 `exportSOAP(...)`，`exportSOAPAsText` 保留 alias
- `exportTXSeriesAsText` 输出 `text + html`
- `BatchVisit.generated.html` 已接入四条路径：
  - `generateSingleVisit`
  - `generateTXSeries`
  - `generateContinueBatch`
  - `generateMixedBatch`

---

## 3) TDD 与测试证据

执行命令与结果:

1. `npx jest src/generator/__fixtures__/fixture-snapshots.test.ts -u --runInBand`
- 结果: 通过，更新 10 条 snapshot
- 变化点: `joint ROM` -> `joint ROM limitation`

2. `npx jest src/generator --runInBand`
- 结果: `52/52 suites`，`1632/1632 tests` 通过

3. `npx jest server --runInBand`
- 结果: `15/15 suites`，`151/151 tests` 通过

4. `npx jest --runInBand`
- 结果: `87/87 suites`，`2109/2109 tests` 通过，`30/30 snapshots` 通过

---

## 4) 与 memory 高优先 BUG 关联复核

- BUG-03（startPain fallback）: 已有回归测试 `start-pain-fallback.test.ts`，本轮全量通过。
- BUG-06（ROM 与 trend 脱节）: 已有回归测试 `rom-trend-render-alignment.test.ts`，本轮全量通过。

---

## 5) 残余风险

- IE HTML 下拉字段未在本轮实现（计划内明确后续 Phase 5）。
- 压力测试存在历史 warning 日志，但不构成当前失败门槛。

---

## 6) 2026-03-04 CRITICAL 复审修复

来源: `.claude-state/codex-review.md`

1. CRITICAL-01（`TEMPLATE_TX_RADIATION` 自创值）: **已修复**
- 全部替换为 TX 模板真值：
  - SHOULDER/ELBOW: `without radiation|with radiation to R arm|with radiation to L arm|with radiation to BLUE`
  - KNEE: `without radiation|with radiation to R leg|with radiation to L leg|with radiation to BLLE|with radiation to toes|with local swollen`
  - LBP: `without radiation|with radiation to R leg|with radiation to L leg|with radiation to BLLE|with radiation to toes`
  - NECK: `with dizziness|with headache|with migraine|without radiation|with radiation to R arm|with radiation to L arm|with radiation to BLUE`

2. CRITICAL-02（`TEMPLATE_TX_PAIN_AREA` 自创值）: **已修复**
- 全部替换为 TX 模板真值：
  - SHOULDER: `shoulder area|shoulder area and lateral arm|shoulder area, upper back and upper arm|shoulder area and upper back area|shoulder area, upper back and periscapular area|shoulder area and periscapular area`
  - NECK: `neck|neck and upper back|upper back`
  - LBP: `midback|mid and lower back|lower back|lower back and buttocks`

3. 类型与分支修复: **已修复**
- 新增 `TEMPLATE_TX_RADIATION_INPUT_TYPE`，KNEE/LBP 使用 `ppnSelectComboSingle`，其余使用 `ppnSelectCombo`
- NECK radiation 按模板混合下拉处理（含 dizziness/headache/migraine）
- ELBOW Subjective + Assessment 均补 laterality 下拉（`along right|along left|along bilateral|in left|in right|in bilateral`）

4. 验证结果
- `npx jest src/shared/__tests__/template-options.test.ts src/generator/__tests__/export-soap-html.test.ts src/generator/__tests__/tx-assessment-laterality.test.ts server/__tests__/batch-generator-html.test.ts --runInBand` 通过
- `npx jest src/generator/__fixtures__/fixture-snapshots.test.ts -u --runInBand` 通过（快照同步）
- `npx jest src/generator --runInBand` 通过
- `npx jest server --runInBand` 通过
- `npx jest --runInBand` 通过（`87/87 suites`, `2109/2109 tests`）

---

## 7) 2026-03-04 v2 审计项闭环（`.claude-state/codex-review-v2.md`）

结论: **4 个 CRITICAL（P0）+ 5 个 HIGH（P1）全部完成；3 个 MEDIUM 完成 3/3。**

### P0（必须修）

1. Assessment 首行 painArea 下拉补齐（SHOULDER/NECK/LBP）: **已修复**
- 文件: `src/generator/soap-generator.ts`
- 方案:
  - 新增 `TEMPLATE_TX_ASSESSMENT_AREA` 消费路径
  - SHOULDER 使用 `ppnSelectCombo` 6 选项
  - NECK 使用 `ppnSelectComboSingle` 4 选项（含 `neck and upper back with migraine`）
  - LBP 使用 `ppnSelectCombo` 4 选项

2. Plan treatment 固定 14 选项池: **已修复**
- 文件: `src/generator/soap-generator.ts`
- 方案:
  - 计划项从 `localPattern.treatmentPrinciples` 动态列表切换为 `TEMPLATE_TX_TREATMENT_OPTIONS` 固定 14 选项
  - selectedValue 限定在模板 14 选项内

### P1（应该修）

3. symptomChange 3→4（补 `similar symptom(s) as last visit`）: **已修复**
- 文件: `src/generator/soap-generator.ts`, `src/shared/template-options.ts`

4. painScale 17→21（补 `10-9`, `9-8`, `1-0`, `0`）: **已修复**
- 文件: `src/generator/soap-generator.ts`, `src/shared/template-options.ts`

5. symptomScale 10→18（补区间值）: **已修复**
- 文件: `src/generator/soap-generator.ts`, `src/shared/template-options.ts`

6. LBP patientChange 用 reduced 系列: **已修复**
- 文件: `src/generator/soap-generator.ts`, `src/shared/template-options.ts`
- 方案:
  - 新增 `TEMPLATE_TX_PATIENT_CHANGE_BY_BODY_PART`
  - LBP 映射为 `reduced/slightly reduced`
  - 兼容引擎传入 `decreased` 的归一化映射

7. NECK painArea 缺第 4 选项（Assessment）: **已修复**
- 文件: `src/shared/template-options.ts`, `src/generator/soap-generator.ts`
- 方案:
  - `TEMPLATE_TX_ASSESSMENT_AREA.NECK` 补充 `neck and upper back with migraine`

### MEDIUM（建议修）

8. localPattern 选项超集（29 vs 模板 11）: **已修复**
- 文件: `src/generator/soap-generator.ts`
- 方案:
  - Assessment localPattern 下拉改为 `TEMPLATE_TX_LOCAL_PATTERN_OPTIONS` 固定 11 项

9. Subjective 缺情绪状态 + causative 中间层下拉: **已修复**
- 文件: `src/generator/soap-generator.ts`, `src/shared/template-options.ts`
- 方案:
  - 新增并渲染 `TEMPLATE_TX_EMOTIONAL_STATE`
  - 新增并渲染 `TEMPLATE_TX_CAUSATIVE_MIDDLE`

10. `exportTXSeriesAsText` 无条件 2× 开销: **已修复**
- 文件: `src/generator/tx-sequence-engine.ts`, `src/generator/soap-generator.ts`, `server/services/batch-generator.ts`
- 方案:
  - `TXSequenceOptions` 新增 `includeHtml?: boolean`
  - `exportTXSeriesAsText` 仅在 `includeHtml=true` 时生成 HTML
  - batch 三条 TX 生成路径显式设置 `includeHtml: true` 维持功能

### 新增测试与回归

- 新增/增强:
  - `src/generator/__tests__/export-soap-html.test.ts`
  - `src/shared/__tests__/template-options.test.ts`
- 快照:
  - `src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap` 已同步更新
- 验证:
  - `npx jest src/shared/__tests__/template-options.test.ts src/generator/__tests__/export-soap-html.test.ts --runInBand` ✅
  - `npx jest server/services/__tests__/batch-generator-counting.test.ts server/__tests__/batch-generator-html.test.ts --runInBand` ✅
  - `npx jest src/generator/__fixtures__/fixture-snapshots.test.ts -u --runInBand` ✅
  - `npx jest src/generator --runInBand` ✅
  - `npx jest server --runInBand` ✅
  - `npx jest --runInBand` ✅（`87/87 suites`, `2109/2109 tests`, `30/30 snapshots`）

---

## 8) 2026-03-04 v3 回归修正（`.claude-state/codex-review-v3.md`）

结论: **CRITICAL 回归已修复并通过全量回归。**

1. CRITICAL: `Patient reports` 文本污染（`Normal` / `maintain regular treatments`）: **已修复**
- 文件: `src/generator/soap-generator.ts`
- 修复:
  - 移除 `renderedEmotionalState` / `renderedCausativeMiddle` 的可见输出
  - 恢复基线句式：`Patient reports: there is {change} {connector} {reason} .`
- 影响:
  - 更新 `src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap`（恢复基线风格）

2. HIGH: Plan HTML 缺 `<strong>`: **已修复**
- 文件: `src/generator/soap-generator.ts`
- 修复:
  - HTML 模式输出 `<strong>Today's treatment principles:</strong><br>...`

3. MEDIUM: `tx-assessment-laterality.test.ts` false positive: **已修复**
- 文件: `src/generator/__tests__/tx-assessment-laterality.test.ts`
- 修复:
  - 从源码字符串 grep 断言改为 `generateAssessmentTX` 行为断言

4. MEDIUM: `TEMPLATE_TX_REASON` 核心常量无覆盖: **已修复**
- 文件: `src/shared/__tests__/template-options.test.ts`
- 修复:
  - 新增数量与关键项断言（长度、首项、末项、关键 reason 项）

5. 验证
- `npx jest src/generator/__tests__/tx-assessment-laterality.test.ts src/generator/__tests__/export-soap-html.test.ts src/shared/__tests__/template-options.test.ts --runInBand` ✅
- `npx jest src/generator/__fixtures__/fixture-snapshots.test.ts -u --runInBand` ✅
- `npx jest src/generator --runInBand` ✅
- `npx jest server --runInBand` ✅
- `npx jest --runInBand` ✅（`87/87 suites`, `2107/2107 tests`, `30/30 snapshots`）
