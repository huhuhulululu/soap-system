# 计划：SOAP 双格式输出（HTML + Text）— v2

## 目标
generate*() 函数同时支持纯文本和 HTML 输出。HTML 输出带 ppnSelectCombo span，填入 MDLand TinyMCE 后可交互修改下拉框值。

## 已验证
- 扁平 ppnSelectCombo span（无嵌套）在 MDLand TinyMCE 正常工作 ✅
- 代码输出文本结构与模板 HTML 1:1 对齐 ✅
- Assessment 常量与模板选项一致 ✅

## 架构决策

1. **统一入口**: `exportSOAP(context, { format })` 替代 `exportSOAPAsText`，保留旧函数名作为 alias
2. **format 参数**: `'text'`(默认) | `'html'`，向后兼容
3. **代码是 source of truth**: 不解析模板 HTML，选项集从 template-options.ts 取
4. **TX Objective 无模板**: html 模式仍用 `<br>` 换行（无下拉框）
5. **`convertSOAPToHTML` 保留**: 给非 ppnSelectCombo 场景（如 Objective、Needle Protocol）继续使用

---

## Phase 1: HTML 包装工具 + per-bodyPart 选项集补全

### 1.1 新建 `src/shared/html-wrapper.ts`
- `wrapSingle(value: string, options: readonly string[]): string`
  → `<span class="ppnSelectComboSingle opt1|opt2|...">value</span>`
- `wrapMulti(values: string | string[], options: readonly string[]): string`
  → `<span class="ppnSelectCombo opt1|opt2|...">val1, val2</span>`
- `escapeHtmlEntities(text: string): string` — `&` → `&amp;` 等
- 选项中的 `&` 也需要转义（如 "Qi & Blood Deficiency" → "Qi &amp; Blood Deficiency"）
- 单元测试

### 1.2 补全 `src/shared/template-options.ts` per-bodyPart 选项

以下常量需要新增（数据来源：模板 HTML 文件逐一提取确认）：

| 新常量 | 类型 | 来源确认 |
|--------|------|---------|
| `TEMPLATE_TX_PAIN_AREA` | `Record<BodyPartKey, readonly string[]>` | SHOULDER(6 opts), NECK(3), LBP(4), KNEE=无(静态文本), ELBOW=无(静态文本) |
| `TEMPLATE_TX_RADIATION` | `Record<BodyPartKey, readonly string[]>` | SHOULDER/ELBOW: arm 版, KNEE/LBP: leg 版, NECK: 无 |
| `TEMPLATE_TX_WHAT_CHANGED_O` | `Record<BodyPartKey, readonly string[]>` | SHOULDER/ELBOW(8, 无"joint ROM"), KNEE/NECK/LBP(9, 有"joint ROM") |
| `TEMPLATE_TX_WHAT_CHANGED_S` | `Record<BodyPartKey, readonly string[]>` | NECK(13, 多headache/migraine/dizziness), 其他(10) |

已有可复用：`BODY_PART_ADL`, `TEMPLATE_PAIN_TYPES`, 所有 `TEMPLATE_TX_*` 统一常量

修正 `TEMPLATE_TX_FINDING_TYPE`: 移除代码自创的 `"joint ROM"`（模板无此选项）

---

## Phase 2: TX Assessment + Plan HTML 输出（13 字段）

### 2.1 `generateAssessmentTX(context, visitState, format?)` 加 format 参数

11 个动态字段，按 bodyPart 分支处理：

**治疗延续句（3 个分支）：**
- KNEE/SHOULDER: `laterality`(wrapSingle) + `bodyPartName`(静态) + "area today."
- NECK: 无 laterality 下拉，静态 "neck area today."
- LBP/else: 无 laterality 下拉，静态 "lower back area today."

**通用字段（所有 bodyPart 一致）：**
- `selectedCondition` → wrapSingle(TEMPLATE_TX_GENERAL_CONDITION)
- `selectedPresent` → wrapSingle(TEMPLATE_TX_SYMPTOM_PRESENT)
- `selectedPatientChange` → wrapSingle(TEMPLATE_TX_PATIENT_CHANGE)
- `selectedWhat` → wrapMulti(TEMPLATE_TX_WHAT_CHANGED_S[bp])
- `selectedPhysical` → wrapSingle(TEMPLATE_TX_PHYSICAL_CHANGE)
- `selectedFinding` → wrapMulti(TEMPLATE_TX_WHAT_CHANGED_O[bp])
- `selectedTolerated` → wrapMulti(TEMPLATE_TX_TOLERATED)
- `selectedResponse` → wrapMulti(TEMPLATE_TX_RESPONSE)
- `localPattern` → wrapMulti(TEMPLATE_TCM_LOCAL_PATTERNS)

**换行**: `\n` → `<br>`

### 2.2 `generatePlanTX(context, visitState, format?)` 加 format 参数

2 个动态字段：
- `selectedVerb` → wrapMulti(TEMPLATE_TX_VERB)
- `selectedTreatment` → wrapMulti(治则选项)

### 2.3 单元测试
- 输出包含正确的 ppnSelectCombo span + 选项集
- text 模式输出不变（回归测试）
- 每个 bodyPart 至少一个 case

---

## Phase 3: TX Subjective HTML 输出（~15 个动态字段）

### 3.1 `generateSubjectiveTX(context, visitState, format?)` 加 format 参数

**通用字段（所有分支共享）：**
- `selectedChange` → wrapSingle(TEMPLATE_TX_SYMPTOM_CHANGE)
- `selectedConnector` → wrapSingle(TEMPLATE_TX_CONNECTOR)
- `selectedReason` → wrapMulti(TEMPLATE_TX_REASON)
- `selectedPainTypes` → wrapMulti(TEMPLATE_PAIN_TYPES[bp])
- `associatedSymptomsText` → wrapMulti(ASSOCIATED_SYMPTOMS)
- `symptomScale` → wrapMulti(SYMPTOM_SCALE_OPTIONS)
- `painScale` → wrapSingle(PAIN_SCALE_OPTIONS)
- `painFrequency` → wrapSingle(PAIN_FREQUENCY_OPTIONS)

**per-bodyPart 分支字段：**

| 分支 | laterality | painArea | radiation | ADL 格式 |
|------|-----------|----------|-----------|---------|
| KNEE/SHOULDER | wrapSingle(LATERALITY) | SHOULDER: wrapMulti(TX_PAIN_AREA.SHOULDER), KNEE: 静态 | wrapMulti(TX_RADIATION[bp]) | severity×2 + adlItems×2 |
| NECK | 静态方向词 | wrapMulti(TX_PAIN_AREA.NECK) | 无 | severity×2 + adlItems×2 |
| LBP | 无 | wrapMulti(TX_PAIN_AREA.LBP) | wrapMulti(TX_RADIATION.LBP) | severity×1 + adlItems×1 |
| ELBOW | wrapSingle(LATERALITY) | 静态 | wrapMulti(TX_RADIATION.ELBOW) | severity×2 + adlItems×2 |

- `severity` → wrapSingle(SEVERITY_OPTIONS)
- `adlItems` → wrapMulti(BODY_PART_ADL[bp])

### 3.2 单元测试
- 每个 bodyPart 分支至少一个 case
- text 模式回归

---

## Phase 4: 集成管线

### 4.1 统一导出函数

```typescript
// 新签名
export function exportSOAP(
  context: GenerationContext,
  visitState?: TXVisitState,
  format?: 'text' | 'html'
): string

// 向后兼容 alias
export const exportSOAPAsText = (ctx, vs?) => exportSOAP(ctx, vs, 'text')
```

同步改 `exportTXSeriesAsText` → 内部调用 `exportSOAP(ctx, state, format)`
返回类型 `TXSeriesTextItem` 加 `html?: string` 字段

TX Objective: html 模式用 `<br>` 换行（无下拉框）
Needle Protocol: html 模式用 `<br>` 换行（无下拉框）

### 4.2 类型扩展

`server/types.ts` — `BatchVisit.generated` 加：
```typescript
readonly html?: {
  readonly subjective: string
  readonly objective: string
  readonly assessment: string
  readonly plan: string
}
```

### 4.3 batch-generator 所有路径集成

**4 个生成路径全部覆盖：**

| 函数 | 行号 | 改动 |
|------|------|------|
| `generateSingleVisit` | L75 | 调用 exportSOAP(format='html')，结果加入 generated.html |
| `generateTXSeries` | L109 | 从 exportTXSeries 取 html，加入 generated.html |
| `generateContinueBatch` | L246 | 同 generateTXSeries 路径 |
| `generateMixedBatch` | L326 | continue 分支同上，full 分支走 generateSingleVisit + generateTXSeries |

### 4.4 MDLand automation
- `fillSOAP(soap, html)` 已支持 htmlData 优先路径 ✅
- 只需 batch-generator 传入 html 数据，无需改 automation 代码

### 4.5 E2E 验证
- 生成 HTML → 注入 MDLand TinyMCE → 验证下拉框可交互
- 至少覆盖 SHOULDER + KNEE 两个 bodyPart

---

## Phase 5（后续，独立排期）: IE HTML 输出
- IE 有 ~86 个字段
- Objective 有 23 个字段（ROM/Strength/Muscles 下拉框）
- 不阻塞 TX 上线

## 不做
- 不解析模板 HTML
- 不改现有 text 输出逻辑
- 不复现 emotionalState 嵌套 span（TinyMCE 编辑残留）
- 不更新模板 .md 文件

## 风险
- LBP 模板 Subjective 结构差异大（无 laterality、section marker 拼写为 "Subject"）→ 已在 Phase 3 分支表中覆盖
- 选项中 `&` 需转义为 `&amp;` → Phase 1.1 的 escapeHtmlEntities 处理
- 模板 Subjective 仍含 "similar symptom(s) as last visit" → 代码已移除，HTML 选项集也不包含

---

## 执行验收审计（2026-03-04 复审）

### 结论
- 当前状态：**计划已执行完成（TX 双格式输出 + batch HTML 链路接入）**
- 验收口径：以本计划 Phase 1~4 为准，Phase 5（IE HTML 下拉）按原计划保持独立排期。

### Phase 对照结果

1. Phase 1（HTML 包装工具 + 选项集补全）✅  
   - 已新增 `src/shared/html-wrapper.ts`（`escapeHtmlEntities/wrapSingle/wrapMulti`）  
   - 已补全 `TEMPLATE_TX_PAIN_AREA / TEMPLATE_TX_RADIATION / TEMPLATE_TX_WHAT_CHANGED_O / TEMPLATE_TX_WHAT_CHANGED_S`  
   - 已从 `TEMPLATE_TX_FINDING_TYPE` 移除 `"joint ROM"` 并同步引擎索引

2. Phase 2（TX Assessment + Plan HTML）✅  
   - `generateAssessmentTX(context, visitState, format)` 已落地  
   - `generatePlanTX(context, visitState, format)` 已落地  
   - 动态字段已输出 `ppnSelectCombo`/`ppnSelectComboSingle` span

3. Phase 3（TX Subjective HTML）✅  
   - `generateSubjectiveTX(context, visitState, format)` 已落地  
   - bodyPart 分支（KNEE/SHOULDER/NECK/LBP/ELBOW）均保留原文本语义并增加 HTML 包裹

4. Phase 4（统一导出 + batch 集成）✅  
   - 已新增统一入口 `exportSOAP(context, visitState, format)`  
   - `exportSOAPAsText` 已保留为 alias（向后兼容）  
   - `TXSeriesTextItem` 已扩展 `html?: string`  
   - `BatchVisit.generated.html` 已扩展并接入 `generateSingleVisit/generateTXSeries/generateContinueBatch/generateMixedBatch`

### TDD 与回归证据

- 快照更新：`npx jest src/generator/__fixtures__/fixture-snapshots.test.ts -u --runInBand`  
  - 结果：10 条 snapshot 更新（`joint ROM` → `joint ROM limitation`）
- 生成器全量：`npx jest src/generator --runInBand`  
  - 结果：`52/52` suites, `1632/1632` tests 通过
- 服务端分组：`npx jest server --runInBand`  
  - 结果：`15/15` suites, `151/151` tests 通过
- 仓库全量：`npx jest --runInBand`  
  - 结果：`87/87` suites, `2094/2094` tests 通过，snapshot `30/30` 通过

### 风险与边界（仍有效）

- Phase 5（IE HTML 下拉字段）未纳入本轮，当前 IE HTML 仍为文本转 HTML（`<br>`/`<p>` 路径）。
- 压力测试仍有历史 WARN（reason diversity、symptom consistency 控制台输出），但本轮不构成失败条件。
