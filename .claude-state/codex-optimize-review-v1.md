# Codex 优化审查报告 v1

## 审查日期: 2026-03-04

## 测试基线

| 指标 | 优化前 | 优化后 | 差异 |
|------|--------|--------|------|
| Failed files | 7 | 8 | +1 ❌ (新增回归) |
| Failed tests | 24 | 25 | +1 ❌ (新增回归) |
| Passed tests | 2965 | 2976 | +11 ✅ (新测试) |
| Snapshots | 30/30 | 30/30 | ✅ |

注: `output-validator.test.ts` 在基线已经 3 个全挂（jest→vi 问题），之前统计时被包含在 7 failed files 里。实际新增回归只有 1 个 test。

---

## 优化项审查结果

### OPT-01: generateSingleVisit TX 2× 渲染消除 — ⚠️ 有隐患

**实现**: 新增 `convertSOAPHTMLToText()` 函数，TX 路径只渲染 HTML 一次，text 从 HTML strip tags 派生。

**验证结果**:
- SHOULDER/KNEE/NECK/LBP: ✅ text 输出完全一致
- ELBOW: ⚠️ Plan section 有 trailing space 差异（`"stimulation \n"` → `"stimulation\n"`）

**根因**: `withHtmlLineBreaks` 做了 `line.trimEnd()`，HTML 转换时丢失了 needle protocol 中的行尾空格。`convertSOAPHTMLToText` 无法恢复被 trim 的空格。

**风险评估**: LOW — 只影响 ELBOW 的 Plan section，且仅是行尾空格差异，MDLand 不会受影响。但 `soap.plan` 字段不再 byte-identical，如果有下游代码做精确字符串比较可能出问题。

**建议**: 可以接受。如果要完美一致，需要把 `withHtmlLineBreaks` 的 `trimEnd()` 去掉，但那会影响所有 HTML 输出。

### OPT-02: createFormatWrappers 工厂函数 — ✅ 完美

**实现**: `html-wrapper.ts` 新增 `createFormatWrappers(format)` 工厂函数，`generateSubjectiveTX` 和 `generateAssessmentTX` 都改为 `const { wrapSingleIfNeeded, wrapMultiIfNeeded } = createFormatWrappers(format)`。

**验证**: 无重复闭包定义，行为不变。

### OPT-03: Assessment area 延迟计算 — ✅ 完美

**实现**: `renderedShoulderAssessmentArea`、`renderedNeckAssessmentArea`、`renderedLbpAssessmentArea` 移到各自 if 分支内。

### OPT-04: Severity + ADL 去重 — ✅ 完美

**实现**: `sev`、`renderedSeverity`、`renderedAdlGroup1`、`renderedAdlGroup2`、`renderedAdl` 提到分支外面，只计算一次。

### OPT-05: Subjective painArea 延迟计算 — ✅ 完美

**实现**: `shoulderPainArea`、`neckPainArea`、`lbpPainArea` 移到各自 if 分支内。

### OPT-06: 空 options trailing space 修复 — ✅ 完美

**实现**: `wrapSingle` 和 `wrapMulti` 用三元判断，空 options 时 class 不含 trailing space。

**验证**:
```
空 options: class="ppnSelectComboSingle"  (无 trailing space) ✅
有 options: class="ppnSelectComboSingle a|b"  ✅
```

### OPT-07: HTML 模式测试 — ❌ 有 1 个回归

**新增 4 个测试文件**:

| 文件 | 状态 | 问题 |
|------|------|------|
| `src/generator/__tests__/export-soap-html.test.ts` | ✅ 通过 | 质量好 |
| `src/shared/__tests__/html-wrapper.test.ts` | ✅ 通过 | 质量好 |
| `src/shared/__tests__/html-wrapper-edge.test.ts` | ✅ 通过 | 质量好 |
| `server/__tests__/batch-generator-html.test.ts` | ❌ 1 failed | `jest.spyOn` 应为 `vi.spyOn` |

---

## 必须修复

### FIX-01: `batch-generator-html.test.ts` jest → vi (CRITICAL — 回归)

**位置**: `server/__tests__/batch-generator-html.test.ts` L97-98

**现状**:
```typescript
const exportSOAPSpy = jest.spyOn(soapGenerator, "exportSOAP");
const exportSOAPAsTextSpy = jest.spyOn(soapGenerator, "exportSOAPAsText");
```

**修复**:
```typescript
import { vi } from "vitest";
// ...
const exportSOAPSpy = vi.spyOn(soapGenerator, "exportSOAP");
const exportSOAPAsTextSpy = vi.spyOn(soapGenerator, "exportSOAPAsText");
```

同时检查该文件中所有 `jest.` 引用，全部替换为 `vi.`。

**注意**: 这个 spy 测试本身也比较脆弱（测试内部调用路由而非可观察行为），建议改为验证输出结果而非 spy 调用次数。但至少先修复 jest→vi 让测试能跑。

---

## 修复后预期基线

| 指标 | 预期值 |
|------|--------|
| Failed files | 7 (全部 pre-existing) |
| Failed tests | 24 (全部 pre-existing) |
| Passed tests | ≥ 2977 |
| Snapshots | 30/30 |
