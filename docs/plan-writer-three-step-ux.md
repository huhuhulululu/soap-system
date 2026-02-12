# 编写页三步流程 UI/UX 重设计计划（v2 优化版）

**目标**：先填写必填项 (*)，再审核引擎推导项 (R)，最后一键生成 SOAP。不实施，仅计划。

**变更性质**：结构性重构（删除 S/O/A/P 动态循环 + 推导摘要区，重建为三步分区），但不改数据流与生成逻辑。

---

## 1. 设计原则

- **角色区分**：`*` = 用户必填；`R` = 引擎推导、用户审核/可改。
- **流程线性**：第一步 → 第二步 → 第三步，避免混在一起。
- **审核为主**：R 项以「展示当前值 + 需要时再改」为主，不强调「填表」。
- **数据流不变**：沿用现有 `fields`、`REQUIRED_FIELDS`、`RULE_FIELDS`、`generationContext`、生成逻辑，仅改布局与信息分组。

---

## 2. 三步定义

| 步骤 | 名称       | 用户动作           | 内容说明 |
|------|------------|--------------------|----------|
| 1    | 填写必填项 | 填写/选择          | 仅 `*` 字段 + 基础/患者/评估参数 |
| 2    | 审核 R 项  | 查看、必要时点「改」| 仅 `R` 字段，统一审核列表 |
| 3    | 生成 SOAP  | 点「生成 IE/TX」   | Seed 输入 + 生成按钮，结果在右侧 |

---

## 3. 步骤交互模式

### 3.1 呈现方式：全部可见 + Stepper 导航条

三个步骤区块全部在左栏内垂直排列，用户可自由滚动浏览。左栏顶部固定一个 **Stepper 导航条**（三个数字圆点 + 标签），点击可锚点跳转到对应步骤区块。

选择此方案的理由：
- 改动最小，不需要引入向导状态机
- 用户可随时回看/修改任意步骤
- Stepper 提供步骤感和进度感

### 3.2 步骤校验规则

| 时机 | 校验内容 | 失败行为 |
|------|----------|----------|
| 点击「生成」按钮时 | 所有 `REQUIRED_FIELDS` 中的字段非空/非默认 | 滚动到第一个空字段，红框高亮 + Toast 提示 |
| 第二步区块可见时 | 无强制校验 | R 项始终有引擎默认值，无需校验 |

不需要禁用步骤：R 项始终有引擎推导的默认值，用户可以跳过审核直接生成。校验仅在生成时触发。

---

## 4. 第一步：填写必填项 (*)

### 4.1 包含内容

**4.1.1 基础设置（保持现有卡片）**

| 字段 | 数据源 | UI 类型 |
|------|--------|---------|
| 保险类型 | `insuranceType` ref | 下拉 |
| 部位 | `bodyPart` ref | 下拉 |
| 侧别 | `laterality` ref（按部位条件显示） | 按钮组 |
| CPT Code | `cptCode` ref | 下拉 |
| 笔记类型 | `noteType` ref | 下拉 (IE/TX) |
| TX 数量 | `txCount` ref（仅 TX 时显示） | 数字输入 |

**4.1.2 患者信息（保持现有卡片）**

| 字段 | 数据源 | UI 类型 |
|------|--------|---------|
| 年龄 | `patientAge` ref | 数字输入 |
| 性别 | `patientGender` ref | 按钮组 |
| 次要部位 | `secondaryBodyParts` ref（可选） | 多选按钮 |
| 病史 | `medicalHistory` ref | 折叠多选面板 |

**4.1.3 评估参数（保持现有合并行卡片）**

| 字段 | fieldPath | 数据源 | 备注 |
|------|-----------|--------|------|
| 疼痛评分 W/B/C | `subjective.painScale.worst/best/current` | `fields` reactive | `REQUIRED_FIELDS` ✓ `MERGED_FIELDS` ✓ |
| 病程时长 | `subjective.symptomDuration.value/unit` | `fields` reactive | `REQUIRED_FIELDS` ✓ `MERGED_FIELDS` ✓ |
| 近期加重 | — | `recentWorseValue` / `recentWorseUnit` 独立 ref | **注意：不在 `fields` 中，不在 `REQUIRED_FIELDS` 中，复用 duration 的 whitelist** |
| 症状量表 | `subjective.symptomScale` | `fields` reactive | `REQUIRED_FIELDS` ✓ `MERGED_FIELDS` ✓ |
| 疼痛频率 | `subjective.painFrequency` | `fields` reactive | `REQUIRED_FIELDS` ✓ `MERGED_FIELDS` ✓ |

**4.1.4 主观必填（`*` 标，且非合并、非固定）**

| 字段 | fieldPath | UI 类型 | 所属 Set |
|------|-----------|---------|----------|
| 放射痛 | `subjective.painRadiation` | 单选下拉 | `REQUIRED_FIELDS` |
| 疼痛类型 | `subjective.painTypes` | 多选面板（标签 + 展开） | `REQUIRED_FIELDS` + `MULTI_SELECT_FIELDS` |
| 伴随症状 | `subjective.associatedSymptoms` | 多选面板 | `REQUIRED_FIELDS` + `MULTI_SELECT_FIELDS` |
| 病因 | `subjective.causativeFactors` | 多选面板 | `REQUIRED_FIELDS` + `MULTI_SELECT_FIELDS` |
| 缓解因素 | `subjective.relievingFactors` | 多选面板 | `REQUIRED_FIELDS` + `MULTI_SELECT_FIELDS` |
| 加重因素 | `subjective.exacerbatingFactors` | 多选面板 | `REQUIRED_FIELDS` + `MULTI_SELECT_FIELDS`（**注：当前同时在 `BUTTON_GROUP_FIELDS` 中，为死代码，实施时清理**） |

### 4.2 UI 结构

- 步骤标题：**① 填写必填项**，副标题注明「`*` 为必填」。
- 保持现有 4 张卡片（基础设置、患者信息、评估参数、主观必填），仅将主观必填从 S/O/A/P 动态循环中提取为独立卡片。
- **第一步内不出现任何 R 字段**。

### 4.3 数据与逻辑

- 数据源不变：`fields`、`bodyPart`、`patientAge`、`medicalHistory` 等。
- 新增常量 `STEP1_SUBJECTIVE_FIELDS`，列出 4.1.4 的 6 个 fieldPath，模板中只渲染这 6 个。
- 第一步不新增 computed。

---

## 5. 第二步：审核 R 项

### 5.1 完整字段映射表

#### 只读展示（无「改」按钮）

| 字段 | 数据源 | 备注 |
|------|--------|------|
| Severity | `derivedSeverity` computed | 由 Pain Current 推导，纯展示 |

> **⚠ 代码修正**：原计划列出「体质 `assessment.generalCondition`」为只读 R 项，但代码中该字段在 `FIXED_FIELDS` 中（L86），完全隐藏不渲染。若要在第二步展示，需先从 `FIXED_FIELDS` 移出并加入 `RULE_FIELDS`。**建议暂不展示**，保持 FIXED 状态，减少改动。

#### 可编辑（展示当前值，点击「改」展开）

| # | 字段 | fieldPath | UI 类型 | 条件 |
|---|------|-----------|---------|------|
| 1 | 局部证型 | `assessment.tcmDiagnosis.localPattern` | 单选下拉 | 始终 |
| 2 | 整体证型 | `assessment.tcmDiagnosis.systemicPattern` | 单选下拉 | 始终 |
| 3 | 舌象 | `objective.tonguePulse.tongue` | 单选下拉 | 始终 |
| 4 | 脉象 | `objective.tonguePulse.pulse` | 单选下拉 | 始终 |
| 5 | 紧张度 | `objective.muscleTesting.tightness.gradingScale` | 单选下拉 | 始终 |
| 6 | 压痛度 | `objective.muscleTesting.tenderness.gradingScale` | 单选下拉 | 始终 |
| 7 | 痉挛度 | `objective.spasmGrading` | 单选下拉 | 始终 |
| 8 | ROM 角度 | `objective.rom.degrees` | 单选下拉 | 始终 |
| 9 | 肌力 | `objective.rom.strength` | 单选下拉 | 始终 |
| 10 | 电刺激 | `plan.needleProtocol.electricalStimulation` | 单选下拉 | 始终 |
| 11 | ADL 活动 | `subjective.adlDifficulty.activities` | **多选面板**（内联展开标签） | 始终 |
| 12 | 症状变化 | `subjective.symptomChange` | 单选下拉 | **仅 TX** |
| 13 | 连接词 | `subjective.reasonConnector` | 单选下拉 | **仅 TX** |
| 14 | 原因 | `subjective.reason` | 单选下拉 | **仅 TX** |
| 15 | 疼痛评分(TX) | `subjective.painScale` | 单选下拉 | **仅 TX** |

渲染顺序：只读（Severity）→ 证型（1-2）→ 舌脉体格（3-9）→ 计划（10）→ 主观 R（11）→ TX 专属（12-15，仅 TX 模式）。

### 5.2 UI 结构

- 步骤标题：**② 审核 R 项**，副标题注明「`R` 为引擎推导，可点击「改」修改」。
- **单一审核卡片**，列表形式，每行一项：
  - 只读行：`[标签]` + `[当前值]`，无「改」按钮。
  - 可编辑行（默认态）：`[标签]` + `[当前值]` + `[改]` 按钮。
  - 可编辑行（编辑态）：`[标签]` + `[下拉/多选面板]` + `[确定]` 按钮。
- **单字段编辑模式**：同一时间只展开一个字段（复用 `derivedEditing` 逻辑）。
- **选择即保存**：单选下拉选择后自动收起；多选面板点击外部自动收起。无需额外确认按钮。
- IE 模式下不渲染 #12-15。
- 病史推荐证型信息保留在证型行下方（从现有推导摘要区迁移）。

### 5.3 视觉区分

| 行类型 | 背景 | 值样式 | 操作 |
|--------|------|--------|------|
| 只读 | `bg-paper-50` 浅灰底 | `text-ink-500` 灰色 | 无 |
| 可编辑（默认态） | `bg-white` 白底 | `text-ink-700` 深色 + 可点击感 | 「改」按钮 |
| 可编辑（编辑态） | `bg-white` 白底 + `ring-1 ring-ink-300` 边框高亮 | 下拉/面板 | 「确定」按钮 |

### 5.4 TCM 证型自动推导与步骤模型的交互

现有 watcher 逻辑：
- `bodyPart` 变化 → 重置 `localPatternManuallySet = false` → 触发 `recommendedLocalPatterns` watcher → 自动填充局部证型
- `medicalHistory` 变化 → 重置 `systemicPatternManuallySet = false` → 触发 `recommendedPatterns` watcher → 自动填充整体证型

步骤模型下的行为：
- **第一步改了部位/病史 → 第二步的证型值实时更新**（watcher 仍然生效）。
- **用户在第二步手动改了证型 → `manuallySet = true` → 回到第一步改部位/病史时，证型不被覆盖**（现有逻辑保持不变）。
- **例外**：改 `bodyPart` 会重置 `localPatternManuallySet = false`，此时局部证型会被重新推导覆盖。这是现有行为，保持不变。

### 5.5 数据与逻辑

- 新增常量 `STEP2_REVIEW_CONFIG`：有序数组，每项含 `{ path, readOnly, txOnly, isMulti }`。
- 新增 computed `step2ReviewFields`：按 `noteType` 过滤 `txOnly` 项，按 whitelist 过滤存在选项的 path，生成渲染数组。每项包含：`path`、`label`、`value`、`readOnly`、`isMulti`、`options`。
- 编辑状态：复用 `derivedEditing` ref（可改名为 `reviewEditing`），表示当前正在编辑的 path。

---

## 6. 第三步：生成 SOAP

### 6.1 包含内容

- **Seed 输入框**：用于复现，可选填。
- **主按钮**：文案为「生成 IE」或「生成 N 个 TX」（与当前 `noteType`、`txCount` 一致）。
- 点击后逻辑与现有 `generate()` 一致，结果在右侧栏展示，**不在此计划中改动**。

### 6.2 UI 结构

- 步骤标题：**③ 生成 SOAP**。
- 一行：Seed 输入框 + 主按钮。
- 右侧结果区保持现有行为。

### 6.3 数据与逻辑

- 无变更：继续使用 `seedInput`、`generate()`、`generatedNotes`、`currentSeed` 等。

---

## 7. 需要移除或收缩的现有区块

| 区块 | 当前位置 | 处理 | 原因 |
|------|----------|------|------|
| 动态字段区（S/O/A/P 循环） | L878-961 | **删除** | `*` 字段纳入第一步，`R` 字段纳入第二步 |
| 推导摘要区 | L964-1000 | **删除** | 内容合并进第二步审核列表 |
| Seed + 生成按钮 | L1002-1009 | **保留**，归属第三步 | 加步骤标题即可 |
| `dynamicFields` computed | L318-329 | **删除** | 不再需要 S/O/A/P 分组 |
| `DERIVED_FIELDS` Set + `derivedFieldList` | L291-299 | **删除** | 合并进 `STEP2_REVIEW_CONFIG` |
| `BUTTON_GROUP_FIELDS` Set | L313-315 | **删除** | 两个成员均为死代码（`exacerbatingFactors` 被 MULTI_SELECT 优先匹配，`chronicityLevel` 在 FIXED 中） |
| `COMPACT_FIELDS` Set | L308-310 | **评估** | `subjective.painScale` 在 TX 模式下由第二步渲染；`subjective.symptomScale` 在第一步合并行渲染。可能不再需要 |

---

## 8. 左栏整体结构

```
左栏
├── [Stepper 导航条] ① 填写 · ② 审核 · ③ 生成（固定在顶部）
│
├── ① 填写必填项 *
│   ├── 基础设置卡片（保险、部位、侧别、CPT、笔记类型、TX 数量）
│   ├── 患者信息卡片（年龄、性别、次要部位、病史）
│   ├── 评估参数卡片（疼痛 W/B/C、病程、近期加重、症状量表、疼痛频率）
│   └── 主观必填卡片（放射痛、疼痛类型、伴随症状、病因、缓解、加重）
│
├── ② 审核 R 项
│   └── 审核卡片
│       ├── [只读] Severity (Pain → 推导)
│       ├── [可编辑] 局部证型、整体证型（+ 病史推荐提示）
│       ├── [可编辑] 舌象、脉象、紧张度、压痛度、痉挛度、ROM、肌力
│       ├── [可编辑] 电刺激
│       ├── [可编辑] ADL 活动（多选）
│       └── [可编辑, 仅TX] 症状变化、连接词、原因、疼痛评分
│
└── ③ 生成 SOAP
    └── Seed 输入 + 「生成 IE」/「生成 N 个 TX」按钮
```

右栏：生成结果列表（现有逻辑不变）。

---

## 9. 视觉规范

### 9.1 Stepper 导航条

- 三个圆形数字指示器（① ② ③），水平排列，间以连接线。
- 当前可见步骤高亮（`bg-ink-800 text-paper-50`），其余为浅色（`bg-ink-100 text-ink-500`）。
- 点击跳转到对应步骤锚点（`scrollIntoView({ behavior: 'smooth' })`）。
- 使用 `IntersectionObserver` 监听步骤区块可见性，自动更新高亮状态。

### 9.2 步骤标题

- 格式：`[数字圆点] 步骤名称`，如 `① 填写必填项`。
- 字体：`text-sm font-semibold text-ink-700`，与现有卡片标题一致。
- 步骤间距：`mt-6`（比卡片间距 `space-y-4` 更大，形成视觉分组）。

### 9.3 审核列表行

- 行高：`py-2`，行间用 `border-b border-ink-50` 分隔。
- 标签列宽度固定 `w-20`，值列 `flex-1`。
- 「改」按钮：`text-[10px] text-ink-400 hover:text-ink-600`，与现有推导摘要区一致。

---

## 10. 实施步骤（建议顺序）

### Phase 0：前置重构（降低单文件复杂度）

1. 从 WriterView.vue（1,101 行）提取 composable：
   - `useWriterFields.ts`：字段初始化、`fields` reactive、所有 Field Set 常量（REQUIRED/RULE/MULTI_SELECT/MERGED 等）、`fieldTag()`、`fieldLabel()`、`getRecommendedOptions()`。
   - `useSOAPGeneration.ts`：`generate()`、`generationContext` computed、`generatedNotes`、`seedInput`、`currentSeed`、复制相关函数。
   - `useDiffHighlight.ts`：`diffLineWords()`、`getDiffLines()`、`getNoteSummary()` 及辅助函数。
2. WriterView.vue 缩减到约 500 行（模板 + 步骤逻辑）。

### Phase 1：第一步区块

1. 定义 `STEP1_SUBJECTIVE_FIELDS` 常量（6 个 fieldPath）。
2. 将现有基础设置、患者信息、评估参数卡片包裹在「第一步」区块内。
3. 新增「主观必填」卡片，渲染 `STEP1_SUBJECTIVE_FIELDS`（复用现有多选面板 + 下拉 UI）。

### Phase 2：第二步区块

1. 定义 `STEP2_REVIEW_CONFIG` 常量。
2. 实现 `step2ReviewFields` computed。
3. 新增审核卡片模板（列表 + 编辑态切换）。
4. 迁移病史推荐证型展示到证型行下方。

### Phase 3：第三步区块 + 清理

1. 给现有 Seed + 生成按钮加步骤标题。
2. 删除 S/O/A/P `dynamicFields` 循环区块。
3. 删除推导摘要区。
4. 删除 `dynamicFields` computed、`DERIVED_FIELDS`、`BUTTON_GROUP_FIELDS`、`COMPACT_FIELDS`（评估后）。
5. 新增 Stepper 导航条 + `IntersectionObserver` 逻辑。

### Phase 4：校验 + 收尾

1. 实现生成按钮点击时的 `REQUIRED_FIELDS` 校验。
2. 验证 `generationContext` 输出与重构前完全一致。
3. 用现有 seed 复现测试，确认生成结果不变。

---

## 11. 验收预期

- 用户打开编写页，能按 ① → ② → ③ 顺序操作。
- Stepper 导航条显示三步，点击可跳转。
- 第一步只看到必填项与评估参数，无 R 项。
- 第二步只看到 R 项列表，可读可改，IE 下无 TX 专属 4 项。
- 第二步证型值随第一步的部位/病史变化实时更新。
- 第三步仅 Seed + 生成按钮，点击后右侧出现与当前一致的结果。
- 生成逻辑、`generationContext`、后端调用均无变更。
- 用相同 seed 生成的结果与重构前完全一致。

---

## 12. 与原计划的差异摘要

| 项目 | 原计划 | 优化后 |
|------|--------|--------|
| 变更性质 | "最小改动" | 明确为"结构性重构，数据流不变" |
| 步骤交互模式 | 未定义 | 全部可见 + Stepper 导航条 |
| 步骤校验 | 未定义 | 生成时校验 REQUIRED_FIELDS |
| 体质字段 | 列为只读 R 项 | 移除（在 FIXED_FIELDS 中，保持隐藏） |
| 加重因素 UI | 标为"多选" | 明确为多选面板（清理 BUTTON_GROUP 死代码） |
| 近期加重数据源 | 标为 `*` | 明确为独立 ref（不在 fields/REQUIRED_FIELDS 中） |
| TCM watcher 交互 | 未说明 | 明确步骤间实时联动规则 |
| 审核列表编辑交互 | 仅"点击改展开" | 明确单字段模式、选择即保存、多选内联展开 |
| 视觉规范 | 未定义 | 定义 Stepper、步骤标题、审核行样式 |
| 前置重构 | 无 | Phase 0 拆分 composable（1,101 行 → ~500 行） |
| 字段映射 | 文字描述 | 完整表格（fieldPath + 数据源 + UI 类型 + Set 归属） |
| 死代码清理 | 未提及 | 标记 BUTTON_GROUP_FIELDS、COMPACT_FIELDS 待清理 |

---

**文档版本**：v2 优化版，仅计划，不实施。
**涉及文件**：`frontend/src/views/WriterView.vue`（模板 + 步骤逻辑）、新增 composable 文件（Phase 0）。
