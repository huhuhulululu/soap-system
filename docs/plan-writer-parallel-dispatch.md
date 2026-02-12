# 编写页三步流程 — 多代理并行执行分派

依据 `docs/plan-writer-three-step-ux.md` v2，将实施拆成可并行与串行任务。

---

## 并行任务（Phase 0，三路同时执行）

以下 3 个任务**互不修改同一文件**，可同时由 3 个代理执行。每个代理只创建/修改指定文件。

### 代理 A：`useWriterFields.ts`

**目标文件**：`frontend/src/composables/useWriterFields.ts`（新建）

**职责**：从 `WriterView.vue` 提取并实现以下内容，导出为 composable。

- **入参**：`whitelist: Record<string, string[]>`（调用方传入，与现有 `import whitelist from '../data/whitelist.json'` 一致）。
- **初始化**：用 `Object.keys(whitelist).forEach` 初始化 `fields`（reactive），规则与现有一致（MULTI_SELECT 为数组，否则取 opts[0] 或 ''）。
- **导出**：
  - `fields`（reactive）
  - 常量 Set：`FIXED_FIELDS`、`TX_ONLY_FIELDS`、`REQUIRED_FIELDS`、`RULE_FIELDS`、`MERGED_FIELDS`、`DERIVED_FIELDS`、`MULTI_SELECT_FIELDS`
  - 常量对象：`FIELD_LABELS`
  - 函数：`fieldTag(fp)`、`fieldLabel(path)`、`getRecommendedOptions(fieldPath)`、`getNestedValue(obj, path)`
- **依赖**：在 composable 内 `import { TEMPLATE_ONLY_RULES } from '../../../src/parser/template-logic-rules.ts'`，用于 `getRecommendedOptions`。
- **不包含**：不包含 `onPatternFieldChange`、refs（如 `localPatternManuallySet`）、watch、`bodyPart`/`noteType` 等；仅字段与规则相关。

**参考**：`WriterView.vue` 约 L82–L217（FIXED_FIELDS 至 getNestedValue）。

---

### 代理 B：`useSOAPGeneration.ts`

**目标文件**：`frontend/src/composables/useSOAPGeneration.ts`（新建）

**职责**：从 `WriterView.vue` 提取生成与复制逻辑，以「接收 refs/reactive」方式实现，不直接依赖 WriterView 文件。

- **入参**：一个 options 对象，包含：
  - `fields`（reactive）
  - `noteType`、`txCount`、`bodyPart`、`laterality`、`insuranceType`、`recentWorseValue`、`recentWorseUnit`、`patientAge`、`patientGender`、`secondaryBodyParts`、`medicalHistory`（均为 ref）
  - `derivedSeverity`、`currentPain`（computed 或 ref，由调用方传入）
- **导出**：
  - `generationContext`（computed）
  - `generatedNotes`、`copiedIndex`、`currentSeed`、`seedInput`、`seedCopied`（ref）
  - `generate(useSeed?)`、`copySeed`、`regenerate`、`splitSOAP(text)`、`copySection(idx, sectionKey)`、`isCopied(idx, sectionKey)`、`copyNote(idx)`、`copyAll()`
- **依赖**：在 composable 内 import `generateTXSequenceStates`、`exportSOAPAsText`。
- **注意**：`generationContext` 的构建与现有 WriterView 完全一致（字段路径、默认值、recentWorse 等）。

**参考**：`WriterView.vue` 约 L331–L500（generationContext 至 copyAll）。

---

### 代理 C：`useDiffHighlight.ts`

**目标文件**：`frontend/src/composables/useDiffHighlight.ts`（新建）

**职责**：从 `WriterView.vue` 提取 diff 与摘要逻辑，仅依赖「笔记列表」与「当前索引」，不依赖 fields/refs。

- **入参**：`generatedNotes`（Ref 或 getter，类型为 `Array<{ text: string, type: string, state?: object, _open?: boolean }>`）。
- **导出**：
  - `shortFreq(f)`、`shortSpasm(s)`、`shortTight(t)`、`shortTender(t)`（辅助）
  - `getNoteSummary(note, idx)`（返回 `{ values, trends }` 或 null）
  - `diffLineWords(curLine, prevLine)`（返回 `{ text, hl }[]`）
  - `getDiffLines(idx)`（返回每行 segments 数组）
- **依赖**：无外部 parser/engine，仅用 `generatedNotes.value` 与 `note.state`、`note.text`。
- **注意**：`getNoteSummary` 内用到的 `generatedNotes.value[idx - 1]` 等，由入参的 ref 在调用时提供。

**参考**：`WriterView.vue` 约 L503–L694（shortFreq 至 getDiffLines）。

---

## 串行任务（集成 + Phase 1–4，单代理或主控顺序执行）

**前置条件**：代理 A、B、C 均已完成，且通过 lint/类型检查。

### 任务 D：WriterView 集成与三步 UI（Phase 1–4）

**目标文件**：`frontend/src/views/WriterView.vue`（修改）

**职责**：

1. **集成 Phase 0**  
   - 引入 `useWriterFields(whitelist)`、`useSOAPGeneration({ ... })`、`useDiffHighlight(generatedNotes)`。  
   - 从 WriterView 中**删除**已迁移到上述 3 个 composable 的代码（字段 Sets、fields 初始化、fieldTag/fieldLabel/getRecommendedOptions/getNestedValue；generationContext、generate、复制函数、generatedNotes/seedInput 等；shortFreq/shortSpasm/getNoteSummary/diffLineWords/getDiffLines）。  
   - 保留并继续使用：所有 ref（insuranceType、bodyPart、noteType 等）、watch（laterality、bodyPart、recommendedPatterns 等）、`derivedSeverity`/`currentPain`、`recommendedPatterns`/`recommendedLocalPatterns`、`expandedPanels`、`togglePanel`、`toggleOption`、`removeOption`、`shortLabel`、`fieldLabel`（若仍由 useWriterFields 提供则从 composable 取）、`onPatternFieldChange`、`derivedEditing`、`toggleDerivedEdit`。

2. **Phase 1**  
   - 定义 `STEP1_SUBJECTIVE_FIELDS`（6 个 fieldPath）。  
   - 用「① 填写必填项」包裹：基础设置、患者信息、评估参数三张卡片。  
   - 新增「主观必填」卡片，仅渲染 `STEP1_SUBJECTIVE_FIELDS`（多选/下拉沿用现有 UI）。

3. **Phase 2**  
   - 定义 `STEP2_REVIEW_CONFIG`（有序，含 path/readOnly/txOnly/isMulti）。  
   - 实现 `step2ReviewFields` computed（按 noteType 过滤 txOnly，按 whitelist 过滤）。  
   - 新增「② 审核 R 项」单一卡片：列表行（只读 / 可编辑 + 改），复用 `derivedEditing`；证型行下方保留病史推荐证型。

4. **Phase 3**  
   - 为 Seed + 生成按钮加「③ 生成 SOAP」标题。  
   - 删除：S/O/A/P 动态字段区、推导摘要区、`dynamicFields` computed、`DERIVED_FIELDS`/`derivedFieldList`、`BUTTON_GROUP_FIELDS`、`COMPACT_FIELDS`（按 v2 评估后删除）。

5. **Phase 4**  
   - 生成按钮点击时做 `REQUIRED_FIELDS` 校验；失败则滚动到首个空项 + 红框 + Toast。  
   - 确认 `generationContext` 与同 seed 生成结果与重构前一致。

6. **Stepper（可选在本任务或后续）**  
   - 左栏顶部增加 Stepper 导航条（① ② ③），点击锚点跳转；可用 `IntersectionObserver` 更新高亮。

**依赖**：仅依赖已存在的 `useWriterFields`、`useSOAPGeneration`、`useDiffHighlight` 及现有 router/whitelist/setWhitelist。

---

## 执行顺序建议

```
[ 代理 A ] ──┐
[ 代理 B ] ──┼── 并行 ──► 完成后 ──► [ 任务 D：集成 + Phase 1–4 ] 串行
[ 代理 C ] ──┘
```

- 不并行修改 `WriterView.vue`，避免冲突。  
- 任务 D 在 A/B/C 全部通过后再动 WriterView。

---

## 验收（任务 D 完成后）

- 编写页呈现 ① 填写必填项 → ② 审核 R 项 → ③ 生成 SOAP。  
- 第一步仅 * 与评估参数；第二步仅 R 列表；第三步 Seed + 生成。  
- 生成逻辑与同 seed 输出与重构前一致。  
- 若已做 Phase 0，WriterView 行数明显减少（目标约 500 行模板+步骤逻辑）。
