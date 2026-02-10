# 续写功能 Bug 修复计划

> 基于 `stress-continuation-v2.ts` 高压测试结果  
> 日期: 2026-02-10  
> 总 ERROR: 163 / 105 次运行

---

## Bug 1: `generalCondition` 解析遗漏 `"poor"` (AC-6.1, 84 次命中)

### 根因

`parsers/optum-note/parser.ts` 第 730 行:

```ts
const conditionPattern = /general condition is\s+(good|fair)/i
```

正则只匹配 `good|fair`，遗漏了 `poor`。当文本为 `"general condition is poor"` 时不匹配，回退到默认值 `'good'`。

### 影响范围

所有 Chronic + 虚证组合 (SHOULDER/KNEE/NECK/LBP × Chronic)，续写 TX 的 `generalCondition` 从 `poor` 错误变为 `good`。

### 修复

文件 1: `parsers/optum-note/parser.ts` 第 730 行

```diff
- const conditionPattern = /general condition is\s+(good|fair)/i
+ const conditionPattern = /general condition is\s+(good|fair|poor)/i
```

文件 2: `parsers/optum-note/types.ts` 第 119 行

```diff
- generalCondition: 'good' | 'fair'
+ generalCondition: 'good' | 'fair' | 'poor'
```

文件 3: `parsers/optum-note/parser.ts` 第 732 行 — 类型断言

```diff
- const generalCondition = (conditionMatch?.[1]?.toLowerCase() as 'good' | 'fair') || 'good'
+ const generalCondition = (conditionMatch?.[1]?.toLowerCase() as 'good' | 'fair' | 'poor') || 'good'
```

三处改动，均为同一个枚举值扩展。

---

## Bug 2: NECK/LBP bilateral `laterality` 丢失 (AC-13.1, 66 次命中)

### 根因

`parsers/optum-note/parser.ts` 第 363 行调用链:

```
chiefComplaint = "Chronic pain in bilateral neck which is Dull..."
         ↓
extractBodyPart(chiefComplaint) → "neck"  (列表中无 "bilateral neck")
         ↓
parseBodyPartAndLaterality("neck") → laterality: 'unspecified'
```

`extractBodyPart()` (第 516 行) 的 bodyParts 列表只有 `'neck'`、`'lower back'`，没有 `'bilateral neck'`、`'bilateral lower back'` 等变体。提取后丢失了 "bilateral" 前缀。

然后第 363 行 `parseBodyPartAndLaterality(bodyPart || chiefComplaint)` 用的是已截断的 `bodyPart="neck"`，而非完整的 `chiefComplaint`。

### 影响范围

NECK/LBP bilateral 的所有续写:
- `laterality` 变为 `'unspecified'`
- `sideProgress` 不生成 (引擎只在 `laterality === 'bilateral'` 时生成)
- 续写文本中 KNEE/SHOULDER 的 bilateral 介词格式退化

### 修复

文件: `parsers/optum-note/parser.ts` 第 363 行

```diff
- const { normalizedBodyPart, laterality } = parseBodyPartAndLaterality(bodyPart || chiefComplaint)
+ const { normalizedBodyPart, laterality } = parseBodyPartAndLaterality(chiefComplaint || bodyPart)
```

始终优先从完整的 `chiefComplaint` 提取 laterality (包含 "bilateral" 关键词)，而非从 `extractBodyPart` 截断后的 `bodyPart`。

一行改动。

---

## Bug 3: `visits.reverse()` 导致续写取错 TX (AC-2.1, 13 次命中)

### 根因

`parsers/optum-note/parser.ts` 第 163 行:

```ts
const chronologicalVisits = enrichVisitsWithInheritance(visits.reverse())
```

`parseOptumNote` 假设输入是 PDF 格式（时间倒序，最新在前），所以 `reverse()` 转为正序。

但 `generateContinuation` 的输入是**正序拼接**的文本 (IE → TX1 → TX2 → ... → TX9)。`reverse()` 后变成倒序：TX9 → TX8 → ... → TX1 → IE。

`generateContinuation` 第 149 行取"最后一个 TX":
```js
const lastTx = txVisits[txVisits.length - 1]  // 取到 TX1 (pain=7~8)，而非 TX9 (pain=6)
```

续写引擎从 TX1 的 pain=7~8 开始，生成 TX10 pain=6.3~7.5，高于真实 TX9 pain=6。

### 影响范围

所有续写场景。当 TX1 和最后一个 TX 的 pain 差距越大，反弹越严重。
尾段续写 (TX9+) 最明显：TX1 pain≈7~8，TX9 pain≈6，差距 1~2 分。

### 修复

文件: `frontend/src/services/generator.js` 第 149 行

```diff
  const txVisits = doc.visits.filter(v => v.subjective.visitType !== 'INITIAL EVALUATION')
- const lastTx = txVisits.length > 0 ? txVisits[txVisits.length - 1] : null
+ const lastTx = txVisits.length > 0 ? txVisits[0] : null
```

`parseOptumNote` 对正序输入 reverse 后，`txVisits[0]` 是原来的最后一个 TX（最新的），这才是续写的正确起点。

**注意**: 这个修复假设 `generateContinuation` 的输入始终是正序拼接。如果未来支持 PDF 倒序输入，需要增加顺序检测逻辑。

一行改动。

---

## 修复优先级

| 优先级 | Bug | 改动量 | 影响 |
|--------|-----|--------|------|
| P0 | Bug 1: generalCondition 正则+类型 | 3 处 (正则/类型/断言) | 消除 84 个 ERROR (52%) |
| P0 | Bug 2: laterality 提取顺序 | 1 行 | 消除 66 个 ERROR (40%) |
| P0 | Bug 3: lastTx 取反 | 1 行 | 消除 13 个 ERROR (8%) |

修复后预计通过率从 43.8% 提升到 ~100%。

### 副作用风险评估

| Bug | 风险 | 说明 |
|-----|------|------|
| Bug 1 | 低 | 纯枚举扩展，下游均为字符串传递，不做枚举校验 |
| Bug 2 | 中 | `chiefComplaint` 可能含歧义 `"right"/"left"` (如 `"right after"`)，但实测所有 IE/TX 文本中 laterality 关键词均紧跟 `"pain in"` 后，无歧义 |
| Bug 3 | 中 | 假设 `generateContinuation` 输入始终为正序拼接。若未来支持 PDF 倒序输入需增加顺序检测 |

---

## 验证方式

```bash
npx tsx scripts/stress-continuation-v2.ts
```

目标: 0 ERROR, WARN ≤ 5% → PASS
