# 双格式输出：HTML 模板格式 + 纯文本格式

## 问题

当前管线：`exportSOAPAsText()` → 纯文本 → `textToHTML()` 简单 `<p>` 包装 → TinyMCE

这导致 MDLand 编辑器里看到的是纯文本段落，没有下拉框，无法手动微调。
原始模板用 `ppnSelectComboSingle` / `ppnSelectCombo` 提供可交互下拉框。

## 目标

SOAP 输出同时支持：
1. **纯文本格式**（现有，用于预览、调试、日志）
2. **HTML 模板格式**（新增，带 ppnSelectCombo 下拉框，用于 MDLand TinyMCE）

## 核心发现

### 三类字段

| 类型 | HTML 表现 | 例子 |
|------|-----------|------|
| 静态文本 | 原样输出 | "Patient c/o", "Pain Scale:", "No adverse side effect" |
| 单选动态 | `<span class="ppnSelectComboSingle opt1\|opt2\|...">selected</span>` | laterality, painScale, generalCondition |
| 多选动态 | `<span class="ppnSelectCombo opt1\|opt2\|...">val1, val2</span>` | painType, muscles, adlItems |

### 模板结构差异

| | IE | TX |
|---|---|---|
| Subjective | ✅ 30 fields | ✅ 23 fields |
| Objective | ✅ 23 fields | ❌ 不存在（代码生成） |
| Assessment | ✅ 10 fields | ✅ 11 fields |
| Plan | ✅ 23 fields | ✅ 2 fields |

TX Objective 完全由代码生成，模板里没有 → HTML 输出时 Objective 仍用 `<p>` 包装。

### 已有支撑

- MDLand automation L809: `htmlData?.subjective || textToHTML(soapData.subjective)` — 已支持 htmlData 优先
- `BatchVisit.generated` 类型可扩展加 `html` 字段
- 模板 .md 文件已存在，可作为 source of truth

## 架构设计

### 方案：模板骨架 + 字段填充

```
模板 .md 文件 (source of truth)
       ↓ 解析
TemplateSkeleton {
  sections: Section[]    // Subjective, Objective, Assessment, Plan
  每个 Section = Fragment[]
  Fragment = StaticText | DynamicField
  DynamicField = { type: single|multi, options: string[], slotId: string }
}
       ↓
引擎/渲染器输出 FieldValues: Record<slotId, string | string[]>
       ↓
renderHTML(skeleton, fieldValues) → 带 ppnSelectCombo 的完整 HTML
renderText(skeleton, fieldValues) → 纯文本（现有格式）
```

### 层次

```
Layer 0: 模板文件 (.md)
  ↓ 解析一次，缓存
Layer 1: TemplateSkeleton（中间表示）
  ↓
Layer 2a: FieldResolver — 从 GenerationContext + VisitState 解析每个 slotId 的值
Layer 2b: 现有 generate*() 函数 — 继续存在，作为 text 输出的 fallback
  ↓
Layer 3a: HTML Renderer — skeleton + fieldValues → ppnSelectCombo HTML
Layer 3b: Text Renderer — skeleton + fieldValues → 纯文本（或直接用现有 generate*()）
```

### 关键决策点

1. **FieldResolver 从哪取值？**
   - 选项 A: 从现有 generate*() 函数内部提取（需要重构为返回结构化数据）
   - 选项 B: 新建独立的字段解析器，直接读 context + visitState
   - 选项 C: generate*() 改为返回 `{ text: string, fields: Record<slotId, value> }`

   → 倾向 C：最小改动，现有文本输出不变，额外返回字段值

2. **slotId 命名规范？**
   - 按模板中出现顺序: `subjective.0`, `subjective.1`, ...
   - 按语义: `subjective.laterality`, `subjective.painType`, ...

   → 倾向语义命名，可读性好，跨模板复用

3. **Objective section（TX 无模板）怎么处理？**
   - TX Objective 继续用 `<p>` 包装（无下拉框）
   - IE Objective 用模板骨架 + 字段填充

   → 分开处理，TX Objective 保持现状

4. **模板解析时机？**
   - 启动时解析一次，缓存到内存
   - 按 bodyPart + noteType 索引

## 实现步骤（草案）

### Phase 1: 模板解析器
- 解析 .md 模板文件 → TemplateSkeleton
- 提取所有 ppnSelectCombo/ppnSelectComboSingle 为 DynamicField
- 给每个 DynamicField 分配语义 slotId
- 单元测试：解析 TX SHOULDER → 验证 36 个字段

### Phase 2: 字段映射表
- 建立 slotId → context/visitState 字段的映射
- 覆盖所有 bodyPart × noteType 组合
- 单元测试：给定 context → 输出正确的 fieldValues

### Phase 3: HTML 渲染器
- renderHTML(skeleton, fieldValues) → 完整 HTML
- 静态文本原样输出
- DynamicField → `<span class="ppnSelectCombo* options">selectedValue</span>`
- 单元测试：渲染结果包含正确的 span class 和选中值

### Phase 4: 集成
- batch-generator 同时生成 text + html
- BatchVisit.generated 加 html 字段
- MDLand automation 使用 htmlData 路径
- E2E 测试：生成的 HTML 在 TinyMCE 中正确显示下拉框

## 深层发现

### 1. 代码输出与模板 HTML 高度对齐

逐句对比 TX SHOULDER 的 Subjective/Assessment/Plan：
- 静态文本完全一致
- 动态字段位置 1:1 对应
- 差异极小：Subjective 的 treatmentFactor 嵌套方式略有不同

**结论：不需要"模板骨架解析"这么重的方案。可以直接在现有 generate*() 函数中，用同样的变量值生成 HTML 版本。**

### 2. 模板 section marker 拼写不一致

| 模板 | Subjective | Assessment |
|------|-----------|------------|
| TX LBP | `Subject` ❌ | `Assessment` |
| TX KNEE | `Subjective` | `Assesment` ❌ |
| TX SHOULDER | `Subjective` | `Assesment` ❌ |
| IE RT KNEE | `Subjective` | `Assesment` ❌ |
| IE THIGH | `Subjective` | `Assesment` ❌ |
| 其他 | `Subjective` | `Assessment` |

→ 解析器必须兼容这些拼写变体

### 3. 代码常量 vs 模板选项差异

| 常量 | 差异 |
|------|------|
| `TEMPLATE_TX_FINDING_TYPE` | 代码多了 `"joint ROM"`（模板只有 `"joint ROM limitation"`）|
| `TEMPLATE_TX_WHAT_CHANGED` | 代码和模板一致 ✅ |
| 其他 Assessment 常量 | 全部一致 ✅ |

bodyPart 间差异：
- whatChanged-O: KNEE/NECK/LBP 有 `"joint ROM"`，SHOULDER/ELBOW 没有
- whatChanged-S: NECK 独有 `"headache"`, `"migraine"`, `"dizziness"`
- **代码用统一常量，模板按 bodyPart 有差异** → HTML 输出需要按 bodyPart 选择正确的选项集

### 4. Subjective symptomTrend 模板仍含 "similar"

模板 HTML 的 Subjective 下拉仍有 `"similar symptom(s) as last visit"`。
代码已移除此选项。如果用模板 HTML 作为 source of truth，模板也需要更新。

### 5. TX Objective 完全无模板

所有 5 个 TX 模板都没有 Objective section。
Objective 的 ROM/Strength/Muscles 全部由代码生成。
→ TX Objective 只能用 `<p>` 包装，无法提供下拉框。

### 6. IE 模板有完整 4 section + 86 个字段

IE 的 Objective 有 23 个下拉字段（ROM 度数、Strength 等级、肌肉选择）。
这些字段的选项集是 bodyPart 特有的（SHOULDER 的 ROM 范围和 KNEE 不同）。

## 架构方案修订

### 原方案（重）：模板骨架解析 + 字段填充
- 解析 HTML → 骨架 → 填值 → 渲染
- 工作量大，解析器复杂（嵌套 span）

### 修订方案（轻）：generate*() 函数直接输出双格式

由于代码输出和模板结构高度对齐，最简方案是：

```
generate*() 函数
  ├── 选择变量值（现有逻辑不变）
  ├── 拼接纯文本（现有逻辑不变）
  └── 拼接 HTML（新增：用同样的变量值，包裹 ppnSelectCombo span）
```

具体做法：
1. 新建 `html-wrapper.ts` — 提供 `wrapSingle(value, options)` 和 `wrapMulti(values, options)` 工具函数
2. 每个 generate*() 函数新增 `format: 'text' | 'html'` 参数
3. `format === 'html'` 时，动态值用 `wrapSingle/wrapMulti` 包裹
4. 静态文本用 `<span>` 包裹（保持模板结构）
5. 选项集从 `template-options.ts` 取（已有），bodyPart 差异的用 per-bodyPart 映射

### 优势
- 零解析器：不需要解析模板 HTML
- 最小改动：generate*() 函数只加一个 format 分支
- 选项集已在代码中：`template-options.ts` 已有所有常量
- 渐进式：可以先做 TX（36 字段），再做 IE（86 字段）

### 需要补充的选项集

当前 `template-options.ts` 缺少的 per-bodyPart 选项：
- `whatChanged-O` per bodyPart（SHOULDER/ELBOW 无 "joint ROM"）
- `whatChanged-S` per bodyPart（NECK 多 headache/migraine/dizziness）
- `painArea` per bodyPart（SHOULDER 6 选项 vs KNEE 不同）
- `adlItems` per bodyPart（已有 BODY_PART_ADL）
- `radiation` per bodyPart（已有部分）

### 实现步骤（修订）

#### Phase 1: HTML 包装工具 + 选项集补全
- `html-wrapper.ts`: `wrapSingle(value, options)`, `wrapMulti(values, options)`, `wrapStatic(text)`
- 补全 per-bodyPart 选项映射（whatChanged-O, whatChanged-S, painArea）
- 单元测试

#### Phase 2: TX Assessment + Plan HTML 输出
- `generateAssessmentTX` 加 format 参数
- `generatePlanTX` 加 format 参数
- 最简单的 section，只有 13 个字段
- 单元测试：输出包含正确的 ppnSelectCombo span

#### Phase 3: TX Subjective HTML 输出
- `generateSubjectiveTX` 加 format 参数
- 23 个字段，嵌套结构需要注意
- 单元测试

#### Phase 4: 集成 + IE
- `exportSOAPAsText` → `exportSOAP(context, format)`
- batch-generator 同时生成 text + html
- BatchVisit.generated 加 html 字段
- IE 的 generate*() 函数加 format 参数（86 字段，工作量最大）

## 风险

1. ~~模板 HTML 嵌套复杂~~ → 修订方案不需要解析模板
2. 不同 bodyPart 的选项集差异需要逐一补全
3. 模板拼写不一致 → 只影响 section marker，修订方案不依赖 section marker
4. TX Objective 无模板 → 继续用 `<p>` 包装
5. Subjective 的嵌套 span 结构（emotionalState 包裹多层）需要精确复现
6. 模板 HTML 中 "similar symptom(s) as last visit" 仍存在 → 需要决定是否更新模板文件

## 执行状态（2026-03-04）

- 状态: 已执行完成（P0/P1/MEDIUM 全部落地）
- 证据: 详见 `.claude-state/output-check-plan-v2.md` 第 7 节
- 回归: `npx jest --runInBand` 通过（`87/87 suites`, `2109/2109 tests`, `30/30 snapshots`）
