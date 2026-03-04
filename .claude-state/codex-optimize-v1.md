# Codex 优化清单 v1

## 测试基线（优化前）

| 指标 | 当前值 |
|------|--------|
| Failed files | 7 (pre-existing) |
| Failed tests | 24 (pre-existing) |
| Passed tests | 2965 |
| Snapshots | 30/30 |

**约束: 优化后测试结果必须完全一致，不允许任何回归。**

---

## P1: 性能优化

### OPT-01: `generateSingleVisit` TX 路径消除 2× 渲染

**位置**: `server/services/batch-generator.ts` L88-97

**现状**:
```typescript
let fullText = exportSOAPAsText(context);  // 第 1 次渲染 (text)
// ...
const html = context.noteType === "TX"
  ? splitSOAPText(exportSOAP(context, undefined, "html"))  // 第 2 次渲染 (html)
  : convertSOAPToHTML(fullText);
```

TX 路径调用 `exportSOAP` 两次（text + html），每次都重新跑 weight-system 选择逻辑。对于单个 visit 开销翻倍。

**修复**: 用 `exportSOAPSections` 一次生成两种格式，或改为只调一次 `exportSOAPSections("html")`，text 版本从 html strip tags。

**推荐方案**: 最简单的方式 — TX 单 visit 也走 `exportTXSeriesAsText` (txCount=1, includeHtml=true)，复用已有的 `includeHtml` 机制:

```typescript
if (context.noteType === "TX") {
  const options: TXSequenceOptions = { txCount: 1, seed: actualSeed, includeHtml: true };
  const [result] = exportTXSeriesAsText(context, options);
  const soap = splitSOAPText(result.text);
  const html = splitSOAPText(result.html!);
  return { ...visit, generated: { soap, html, fullText: result.text, seed: actualSeed }, status: "done" };
}
```

但注意: `generateSingleVisit` 的 TX 路径没有 visitState（传 undefined），而 `exportTXSeriesAsText` 会通过引擎生成 visitState。两者行为可能不完全一致。需要验证单 visit 场景下引擎 state 与 undefined state 的输出差异。

**风险**: MEDIUM — 需要对比测试确认输出一致性
**收益**: 单 TX visit 生成速度提升 ~50%

---

## P2: 代码结构优化

### OPT-02: `wrapSingleIfNeeded` / `wrapMultiIfNeeded` 闭包去重

**位置**: `src/generator/soap-generator.ts` L1960-1968 和 L2237-2247

**现状**: `generateSubjectiveTX` 和 `generateAssessmentTX` 各自定义了完全相同的闭包:

```typescript
const wrapSingleIfNeeded = (value: string, options: readonly string[]) =>
  isHtml ? wrapSingle(value, options) : value;
const wrapMultiIfNeeded = (value: string | string[], options: readonly string[]) =>
  isHtml ? wrapMulti(value, options) : Array.isArray(value) ? value.join(", ") : value;
```

**修复**: 提取到 `html-wrapper.ts` 作为工厂函数:

```typescript
// html-wrapper.ts
export function createFormatWrappers(format: SOAPFormat) {
  const isHtml = format === "html";
  return {
    wrapSingleIfNeeded: (value: string, options: readonly string[]) =>
      isHtml ? wrapSingle(value, options) : value,
    wrapMultiIfNeeded: (value: string | string[], options: readonly string[]) =>
      isHtml ? wrapMulti(value, options) : Array.isArray(value) ? value.join(", ") : value,
  };
}
```

然后在 `generateSubjectiveTX` 和 `generateAssessmentTX` 中:
```typescript
const { wrapSingleIfNeeded, wrapMultiIfNeeded } = createFormatWrappers(format);
```

**风险**: LOW — 纯重构，行为不变
**收益**: 消除重复代码，未来新增 format-aware 函数只改一处

### OPT-03: Assessment area 变量延迟计算

**位置**: `src/generator/soap-generator.ts` L2406-2423

**现状**: 每次调用 `generateAssessmentTX` 都计算 3 个 area 变量（SHOULDER/NECK/LBP），但只有对应 body part 的那个会被使用:

```typescript
const renderedShoulderAssessmentArea = wrapMultiIfNeeded("shoulder area", TEMPLATE_TX_ASSESSMENT_AREA.SHOULDER);
const renderedNeckAssessmentArea = wrapSingleIfNeeded("neck", TEMPLATE_TX_ASSESSMENT_AREA.NECK);
const renderedLbpAssessmentArea = wrapMultiIfNeeded(lbpAssessmentAreaValue, TEMPLATE_TX_ASSESSMENT_AREA.LBP);
```

**修复**: 移到各自的 if 分支内，只在需要时计算:

```typescript
if (bp === "SHOULDER") {
  const renderedArea = wrapMultiIfNeeded("shoulder area", TEMPLATE_TX_ASSESSMENT_AREA.SHOULDER);
  assessment += `The patient continues treatment for ${renderedLateralityPhrase} ${renderedArea} area today.\n`;
} else if (bp === "NECK") {
  const renderedArea = wrapSingleIfNeeded("neck", TEMPLATE_TX_ASSESSMENT_AREA.NECK);
  assessment += `Patient continue treatment for ${renderedArea} area today.\n`;
} else {
  const areaValue = bp === "MIDDLE_BACK" ? "midback" : bp === "MID_LOW_BACK" ? "mid and lower back" : "lower back";
  const renderedArea = wrapMultiIfNeeded(areaValue, TEMPLATE_TX_ASSESSMENT_AREA.LBP);
  assessment += `The patient continues treatment for ${renderedArea} area today.\n`;
}
```

**风险**: LOW — 纯重构
**收益**: 每次调用少 2 次 wrapMulti/wrapSingle 计算

### OPT-04: Subjective severity + ADL 渲染去重

**位置**: `src/generator/soap-generator.ts` L2156-2192

**现状**: 3 个 body part 分支（KNEE / SHOULDER+NECK+ELBOW / LBP）各自重复计算 `sev` 和 `renderedSeverity`:

```typescript
// KNEE 分支 (L2157-2161)
const sev = visitState?.severityLevel || context.severityLevel || severityFromPain(...);
const renderedSeverity = wrapSingleIfNeeded(sev, TX_SEVERITY_OPTIONS);

// SHOULDER/NECK/ELBOW 分支 (L2171-2175) — 完全相同
const sev = visitState?.severityLevel || context.severityLevel || severityFromPain(...);
const renderedSeverity = wrapSingleIfNeeded(sev, TX_SEVERITY_OPTIONS);

// LBP 分支 (L2185-2189) — 完全相同
const sev = visitState?.severityLevel || context.severityLevel || severityFromPain(...);
const renderedSeverity = wrapSingleIfNeeded(sev, TX_SEVERITY_OPTIONS);
```

**修复**: 提到分支外面:

```typescript
const sev = visitState?.severityLevel || context.severityLevel ||
  severityFromPain(visitState?.painScaleCurrent ?? context.painCurrent ?? 8);
const renderedSeverity = wrapSingleIfNeeded(sev, TX_SEVERITY_OPTIONS);

if (bp === "KNEE") {
  // 用 renderedSeverity...
} else if (bp === "SHOULDER" || bp === "NECK" || bp === "ELBOW") {
  // 用 renderedSeverity...
} else {
  // 用 renderedSeverity...
}
```

**风险**: LOW — 纯重构
**收益**: 消除 3 处重复的 severity 计算

### OPT-05: Subjective painArea 变量延迟计算

**位置**: `src/generator/soap-generator.ts` L2108-2123

**现状**: 与 OPT-03 同理，`shoulderPainArea`、`neckPainArea`、`lbpPainArea` 每次都算，但只用一个:

```typescript
const shoulderPainArea = wrapMultiIfNeeded(bodyPartAreaName, TEMPLATE_TX_PAIN_AREA.SHOULDER);
const neckPainArea = wrapMultiIfNeeded("neck", TEMPLATE_TX_PAIN_AREA.NECK);
const lbpPainArea = wrapMultiIfNeeded(lbpPainAreaValue, TEMPLATE_TX_PAIN_AREA.LBP);
```

**修复**: 移到各自的 if 分支内。

**风险**: LOW
**收益**: 每次调用少 2 次 wrapMulti 计算

---

## P3: 边缘情况修复

### OPT-06: `buildOptionClass` 空数组 trailing space

**位置**: `src/shared/html-wrapper.ts` L18-20

**现状**: 空 options 数组产生 `class="ppnSelectCombo "` (trailing space):

```typescript
function buildOptionClass(options: readonly string[]): string {
  return options.map((opt) => escapeHtmlEntities(opt)).join("|");
}
// wrapSingle: `<span class="ppnSelectComboSingle ${escapedOptions}">`
// 空 options → `<span class="ppnSelectComboSingle ">`
```

**修复**:
```typescript
export function wrapSingle(value: string, options: readonly string[]): string {
  const escapedValue = escapeHtmlEntities(value);
  const escapedOptions = buildOptionClass(options);
  const cls = escapedOptions ? `ppnSelectComboSingle ${escapedOptions}` : "ppnSelectComboSingle";
  return `<span class="${cls}">${escapedValue}</span>`;
}
```

wrapMulti 同理。

**风险**: LOW — 当前 KNEE/ELBOW 空 options 路径不会被触发，但防御性修复更安全
**收益**: 防止未来新 body part 加入时产生无效 HTML class

---

## P4: 测试补充

### OPT-07: HTML 模式端到端测试

**现状**: 现有测试主要覆盖 text 模式。HTML 模式只有 `tx-assessment-laterality.test.ts` 间接覆盖了 Assessment 首行。

**建议新增测试**:

1. **html-output.test.ts** — 验证每个 body part 的 HTML 输出包含正确的 ppnSelectCombo/ppnSelectComboSingle span:
   - Subjective: painTypes, laterality, radiation, associatedSymptoms, symptomScale, severity, ADL, painScale, painFrequency
   - Assessment: laterality, condition, present, patientChange, whatChanged, physicalChange, findingType, tolerated, response, localPattern
   - Plan: verb, treatment, `<strong>` tag

2. **html-wrapper-edge.test.ts** — 验证 html-wrapper 边缘情况:
   - 空 options 数组
   - 含 `&`, `<`, `>`, `"`, `'` 的 options 和 values
   - 空字符串 value
   - 数组 value 含空字符串元素

3. **batch-generator-html.test.ts** — 验证 batch 4 条路径都产出 html 字段:
   - `generateSingleVisit` TX → html 有 ppnSelectCombo spans
   - `generateSingleVisit` IE → html 是 plainToHtmlSection (无 spans)
   - `generateTXSeries` → 每个 visit 的 html 有 spans
   - `generateContinueBatch` → html 有 spans

**风险**: NONE — 只加测试
**收益**: 防止未来修改导致 HTML 输出回归

---

## 执行顺序建议

| 顺序 | 编号 | 优先级 | 风险 | 预估时间 |
|------|------|--------|------|---------|
| 1 | OPT-02 | P2 | LOW | 5 min |
| 2 | OPT-04 | P2 | LOW | 5 min |
| 3 | OPT-03 + OPT-05 | P2 | LOW | 5 min |
| 4 | OPT-06 | P3 | LOW | 3 min |
| 5 | OPT-07 | P4 | NONE | 20 min |
| 6 | OPT-01 | P1 | MEDIUM | 15 min |

先做低风险重构（OPT-02/03/04/05/06），跑测试确认无回归，再做 OPT-01 性能优化（需要对比验证），最后补测试。

**每步完成后必须 `npx vitest --run` 确认: 7 failed / 102 passed files, 24 failed / 2965 passed tests。**
