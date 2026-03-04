# Codex 实现审查报告 v3 — 深度审查

## 审查日期: 2026-03-04（第三轮深度审查）

## 测试基线

| 指标 | Base (c1469bf) | Codex 当前 | 差异 |
|------|---------------|-----------|------|
| Failed files | 7 | 7 | 0 |
| Failed tests | 24 | 24 | 0 |
| Passed tests | 2958 | 2967 | +9 ✅ |
| Snapshots | 30/30 | 30/30 | ✅ (但内容被修改) |

---

## CRITICAL: Text 输出回归 — emotionalState/causativeMiddle 污染可见文本

### 问题

Codex 新增了 `TEMPLATE_TX_EMOTIONAL_STATE` 和 `TEMPLATE_TX_CAUSATIVE_MIDDLE` 常量（正确），但在 `generateSubjectiveTX` L2160 中把它们的值作为**可见文本**插入了输出：

```typescript
// Codex 代码 (L2160):
subjective += `Patient reports: ${renderedEmotionalState}, there is ${renderedChange} ${renderedConnector} ${renderedCausativeMiddle} ${renderedReason} .\n`;
```

### 基线 vs Codex 输出对比

| | 输出 |
|---|------|
| 基线 | `Patient reports: there is improvement of symptom(s) because of can move joint more freely...` |
| Codex | `Patient reports: Normal, there is improvement of symptom(s) because of maintain regular treatments can move joint more freely...` |

多出的文本：`"Normal, "` + `"maintain regular treatments "`

### 根因

模板中 emotionalState 和 causativeMiddle 是 **wrapper span**（条件显示容器），它们的选中值**不出现在可见文本中**。模板可见文本只有：
```
Patient reports: there is [symptomChange] [connector] [reason] .
```

Codex 误解了这两个字段的角色，把 wrapper 的值当成了独立的可见字段。

### 影响

- 684 处 snapshot 被修改（`"Normal, there is"` 替代了 `"there is"`）
- text 输出格式回归 — 所有 TX Subjective 的 "Patient reports:" 行都多了两段文字
- html 输出也受影响 — 多了两个不应存在的 ppnSelectCombo span

### 修复方案

根据 plan.md L181 的架构决策（"不复现 emotionalState 嵌套 span"），应该：

1. **text 模式**：移除 `renderedEmotionalState` 和 `renderedCausativeMiddle` 的可见文本输出，恢复基线格式
2. **html 模式**：两个选择：
   - A) 同样不输出（与 text 一致，遵循 plan.md 决策）
   - B) 作为 wrapper span 包裹相关内容（完整复现模板结构，但增加复杂度）

推荐方案 A — 不输出。这两个字段在模板中是 TinyMCE 编辑器的条件显示 artifact，MDLand 的 ppnSelectCombo 插件不依赖它们。

### 具体修复

L2160 改为：
```typescript
subjective += `Patient reports: there is ${renderedChange} ${renderedConnector} ${renderedReason} .\n`;
```

移除 `selectedEmotionalState` 和 `selectedCausativeMiddle` 的选择逻辑（L2017-2025）和 render 逻辑（L2101-2108），或保留常量定义但不消费。

Snapshot 需要 revert 回基线格式（`-u` 更新）。

---

## HIGH: Plan HTML 缺少 `<strong>` 标签

模板 Plan 首行：`<strong>Today's treatment principles:</strong>`
代码 L2548：`Today's treatment principles:\n`（纯文本，无 `<strong>`）

html 模式应输出 `<strong>Today's treatment principles:</strong><br>`。

---

## MEDIUM: 测试覆盖度不足

### 缺失的关键测试

| # | 缺失项 | 风险 |
|---|--------|------|
| 1 | `TEMPLATE_TX_REASON` 常量验证（26 项） | HIGH — 核心字段无测试 |
| 2 | `deriveAssessmentFromSOA` 多 bodyPart 测试 | HIGH — 只测了 LBP |
| 3 | `tx-assessment-laterality.test.ts` H-01 断言是 false positive | MEDIUM — `toContain("for ")` 没验证 "in" 前缀 |
| 4 | `derive-assessment.test.ts` VALID_FINDING_TYPE 含 `"joint ROM"` | LOW — 不是模板值 |

### 测试质量问题

- `tx-assessment-laterality.test.ts` 用源码 grep（`fs.readFileSync`）而非行为测试，重构即碎
- 29 个 TX 常量中 12 个未被 template-options.test.ts 覆盖

---

## LOW: NECK radiation 后逗号差异

模板 NECK：`...with migraine associated with muscles...`（无逗号）
代码：`...${renderedRadiation}, associated with muscles...`（有逗号）

其他 bodyPart 模板都有逗号，只有 NECK 没有。

---

## 修复优先级

### P0（必须修 — 回归）
1. **移除 emotionalState/causativeMiddle 的可见文本输出** — 恢复基线 text 格式
2. **Revert snapshot 到基线格式**

### P1（应该修）
3. Plan HTML 加 `<strong>` 标签

### P2（建议修）
4. 补充缺失测试（TEMPLATE_TX_REASON、多 bodyPart Assessment）
5. 修复 tx-assessment-laterality.test.ts 的 false positive 断言

### P3（可选）
6. NECK 逗号差异
7. 性能优化（2× 开销）
