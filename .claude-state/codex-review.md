# Codex 实现审查报告 — SOAP 双格式输出

## 审查日期: 2026-03-04

## 测试基线对比

| | Base (c1469bf) | Codex 改动后 | 差异 |
|---|---|---|---|
| Failed files | 9 | 7 | -2 ✅ |
| Failed tests | 26 | 24 | -2 ✅ |
| Passed tests | 2946 | 2952 | +6 ✅ |

30 个 fixture snapshot 通过，text 输出向后兼容。

## 正确实现的部分

1. ✅ `html-wrapper.ts` — wrapSingle/wrapMulti/escapeHtmlEntities 实现正确
2. ✅ `SOAPFormat` 类型 + `wrapSingleIfNeeded`/`wrapMultiIfNeeded` 闭包模式
3. ✅ `exportSOAP` 统一入口 + `exportSOAPAsText` alias
4. ✅ `BatchVisit.generated.html` 类型扩展
5. ✅ 4 个 batch 路径全覆盖
6. ✅ `TEMPLATE_TX_FINDING_TYPE` 移除 "joint ROM" + 引擎索引同步更新
7. ✅ `TEMPLATE_TX_WHAT_CHANGED_O` per-bodyPart（SHOULDER/ELBOW 无 "joint ROM"）
8. ✅ `TEMPLATE_TX_WHAT_CHANGED_S` per-bodyPart（NECK 多 headache/migraine/dizziness）
9. ✅ TX Objective 用 `plainToHtmlSection`（无下拉框）
10. ✅ Needle Protocol 用 `plainToHtmlSection`
11. ✅ `TXSeriesTextItem` 加 `html` 字段

## 问题清单

### CRITICAL-01: TEMPLATE_TX_RADIATION 选项全部自创，与模板不一致

Codex 没有从模板 HTML 提取选项，而是自己编造了选项值。

| bodyPart | 模板实际 | Codex 写的 | 类型 |
|----------|---------|-----------|------|
| SHOULDER | without radiation, with radiation to R arm, with radiation to L arm, with radiation to BLUE | without radiation, radiating down to upper arm, radiating down to forearm, radiating to hand | Multi |
| KNEE | without radiation, with radiation to R leg, with radiation to L leg, with radiation to BLLE, with radiation to toes, with local swollen (6) | without radiation, radiating down to thigh, radiating down to lower leg, radiating to foot (4) | Single |
| NECK | with dizziness, with headache, with migraine, without radiation, with radiation to R arm, with radiation to L arm, with radiation to BLUE (7) | without radiation (1) | Multi |
| LBP | without radiation, with radiation to R leg, with radiation to L leg, with radiation to BLLE, with radiation to toes (5) | without radiation, radiating down to buttock, radiating down to thigh, radiating down to leg, radiating to foot (5) | Single |
| ELBOW | without radiation, with radiation to R arm, with radiation to L arm, with radiation to BLUE (4) | without radiation, radiating down to forearm, radiating to wrist, radiating to hand (4) | Multi |

注意：KNEE 和 LBP 在模板中是 `ppnSelectComboSingle`，其他是 `ppnSelectCombo`。

### CRITICAL-02: TEMPLATE_TX_PAIN_AREA 选项全部自创，与模板不一致

| bodyPart | 模板实际 | Codex 写的 |
|----------|---------|-----------|
| SHOULDER | shoulder area, shoulder area and lateral arm, shoulder area upper back and upper arm, shoulder area and upper back area, shoulder area upper back and periscapular area, shoulder area and periscapular area (6, Multi) | shoulder area, anterior shoulder area, posterior shoulder area, deltoid area, acromion area, upper shoulder area (6) ❌ |
| NECK | neck, neck and upper back, upper back (3, Multi) | neck area, cervical area, posterior neck area (3) ❌ |
| LBP | midback, mid and lower back, lower back, lower back and buttocks (4, Multi) | lower back area, lumbar area, mid and lower back area, lumbosacral area (4) ❌ |
| KNEE | 无下拉（静态文本）✅ | ["knee area"] — 定义了但未消费 ⚠️ |
| ELBOW | 无下拉（静态文本）✅ | ["elbow area"] — 定义了但未消费 ⚠️ |

### HIGH-01: ELBOW Subjective 缺少 laterality 下拉

模板 ELBOW Subjective 有 laterality 下拉（`along right|along left|along bilateral|in left|in right|in bilateral`），但代码 ELBOW 走 else 分支（L2136），没有 laterality。

ELBOW Assessment 也有 laterality 下拉，同样需要处理。

### HIGH-02: exportTXSeriesAsText 无条件生成 HTML（2× 性能开销）

L3019: `let html = exportSOAP(txContext, stateWithFloors, "html")` 对每个 visit 无条件执行。
即使调用者不需要 HTML，也会付出 2× 的生成成本。
建议：加 `includeHtml` 参数，或者让调用者按需请求。

### HIGH-03: Single vs Multi 类型未区分

模板中 radiation 的 KNEE 和 LBP 是 `ppnSelectComboSingle`（单选），SHOULDER/NECK/ELBOW 是 `ppnSelectCombo`（多选）。
当前代码统一用 `wrapMultiIfNeeded`，没有区分 Single/Multi。
需要按 bodyPart 选择 wrapSingle 或 wrapMulti。

### MEDIUM-01: NECK radiation 下拉包含 dizziness/headache/migraine

NECK 模板的 radiation 位置实际是一个混合下拉框（7 选项），包含 dizziness/headache/migraine + radiation 选项。
这不是纯 radiation 字段，语义上是 "伴随症状 + 放射"。
代码需要特殊处理 NECK 的这个字段。

### MEDIUM-02: batch-generator-counting.test.ts 仍用 jest.mock

Pre-existing 问题，Codex 修改了此文件但未迁移到 vitest。

### LOW-01: TEMPLATE_TX_PAIN_AREA 的 KNEE/ELBOW/HIP/THIGH 定义了但未消费

这些 bodyPart 在代码中走 else 分支用 `bodyPartAreaName` 静态文本，不消费 TEMPLATE_TX_PAIN_AREA。
死数据，不影响功能。

## 修复优先级

1. CRITICAL-01 + CRITICAL-02: 用模板实际选项替换自创选项（必须修）
2. HIGH-03: 按 bodyPart 区分 wrapSingle/wrapMulti
3. HIGH-01: ELBOW 加 laterality 下拉
4. HIGH-02: exportTXSeriesAsText 性能优化（可后续）
5. MEDIUM-01: NECK radiation 混合下拉特殊处理
