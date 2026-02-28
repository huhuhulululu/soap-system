# Writer 表单 UI 刷新 — 融合 Batch 紧凑风格

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Batch 页面的紧凑布局、直接 chips、顶部工具栏等优点融合到 WriterPanel，同时保留 Writer 的三步引导、R 项审核、交叉校验等功能优势。

**Architecture:** 纯前端 UI 重构，只改 WriterPanel.vue 模板和少量样式。不改 composables、不改后端逻辑。

**Tech Stack:** Vue 3 + Tailwind CSS

---

## 改动范围

只改一个文件：`frontend/src/components/composer/WriterPanel.vue`（模板部分，509-1098 行）

## Critic 审查修正

- ✅ 保留 `expandedPanels` 和 `togglePanel`（病史面板仍在使用 line 664-698）
- ✅ causativeFactors 28 个选项太多，保留折叠面板；relievingFactors 11 个可平铺
- ✅ 删除笔记类型后基础设置 grid 调整为 2 列（保险 + 部位/侧别）
- ✅ 多选 chips 保留 shortLabel 截断长文本
- ✅ 侧别选择保持当前位置（已在部位 cell 内），不做额外移动

---

### Task 1: 顶部工具栏 — 把控制项从表单中提取到 header bar

**Files:**
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**目标:** 把 NoteType、TX数量、IE后TX数量、Realistic toggle、Seed 从表单内部移到顶部一行工具栏。

**Step 1:** 在 `<template>` 的 `<div class="max-w-7xl mx-auto px-6 py-8">` 内、`<div class="grid grid-cols-1 lg:grid-cols-12 gap-6">` 之前，插入顶部工具栏：

```html
<!-- Compact Header Bar -->
<div class="mb-4 flex items-center justify-between gap-3 flex-wrap">
  <h2 class="font-display text-lg font-bold text-ink-800">SOAP Writer</h2>
  <div class="flex items-center gap-2 flex-wrap">
    <!-- NoteType toggle -->
    <div class="flex rounded-lg border border-ink-200 overflow-hidden text-xs">
      <button v-for="m in [{k:'IE',l:'IE 初诊'},{k:'TX',l:'TX 复诊'}]" :key="m.k"
        @click="noteType = m.k"
        class="px-3 py-1.5 font-medium transition-colors cursor-pointer"
        :class="noteType === m.k ? 'bg-ink-800 text-white' : 'bg-white text-ink-500 hover:bg-paper-100'">
        {{ m.l }}
      </button>
    </div>
    <!-- TX/IE count -->
    <div v-if="noteType === 'TX'" class="flex items-center gap-1 text-xs">
      <span class="text-ink-500">TX:</span>
      <input type="number" v-model.number="txCount" min="1" max="11"
        class="w-12 px-1 py-1 border border-ink-200 rounded text-xs text-center" />
    </div>
    <div v-if="noteType === 'IE'" class="flex items-center gap-1 text-xs">
      <span class="text-ink-500">IE后TX:</span>
      <input type="number" v-model.number="ieTxCount" min="1" max="20"
        class="w-12 px-1 py-1 border border-ink-200 rounded text-xs text-center" />
    </div>
    <span class="text-ink-200">|</span>
    <!-- Realistic toggle -->
    <label class="flex items-center gap-1.5 cursor-pointer select-none">
      <button @click="realisticPatch = !realisticPatch" type="button"
        class="relative w-9 h-5 rounded-full transition-colors duration-200 ring-2"
        :class="realisticPatch ? 'bg-green-500 ring-green-300' : 'bg-red-400 ring-red-200'"
        role="switch" :aria-checked="realisticPatch">
        <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
          :class="realisticPatch ? 'translate-x-4' : ''"></span>
      </button>
      <span class="text-xs font-medium" :class="realisticPatch ? 'text-green-600' : 'text-red-500'">
        {{ realisticPatch ? '✓ Realistic' : '✗ Original' }}
      </span>
    </label>
    <span class="text-ink-200">|</span>
    <!-- Seed -->
    <input v-model="seedInput" type="text" placeholder="Seed"
      class="w-20 px-2 py-1 border border-ink-200 rounded-lg text-xs font-mono text-ink-600 placeholder:text-ink-300" />
  </div>
</div>
```

**Step 2:** 删除原来表单内的以下元素（只删 DOM，不删 JS 变量）：
- 基础设置卡片中的"笔记类型" select 及其外层 div（line 599-605 的整个 `<div>` 块）
- TX数量 div（line 607-610 的整个 `<div v-if="noteType === 'TX'">`）
- IE后TX数量 div（line 611-614 的整个 `<div v-if="noteType === 'IE'">`）
- 第三步高级选项 `<details>` 块（line 950-971），包含 Seed input 和 Realistic toggle

**注意：** 不删除任何 JS ref/computed/function，只删模板 DOM 元素。

**Step 3:** 验证 — `npm run build` 确认无编译错误。

---

### Task 2: 基础设置卡片 — 删除笔记类型后调整布局

**Files:**
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**目标:** 笔记类型已移到顶部栏，基础设置卡片只剩保险和部位两个字段，保持 `grid-cols-2` 不变。

**Step 1:** 确认基础设置卡片（line ~532-615）的 `grid grid-cols-2 gap-3` 保持不变（删除笔记类型后正好 2 个子元素填 2 列）。

**Step 2:** 侧别选择保持当前位置不动（已在部位 cell 内部，line 587-597）。

**Step 3:** 验证 — `npm run build`。

---

### Task 3: 患者信息卡片 — Gender 用 M/F 缩写按钮 + 紧凑布局

**Files:**
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**Step 1:** 将 Gender 按钮文案改为缩写（line ~628-632）：
```html
{{ g === 'Male' ? 'M' : g === 'Female' ? 'F' : g }}
```

**Step 2:** 年龄 input 宽度从 `w-20` 改为 `w-16`，py 从 `py-2` 改为 `py-1.5`。

**Step 3:** 验证 — `npm run build`。

---

### Task 4: 评估参数卡片 — Pain 三值固定宽度 + 频率 inline pills

**Files:**
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**Step 1:** Pain 三值 select（line ~735-749）加 `w-[60px]`，外层容器保持 `grid grid-cols-3 gap-2`。

**Step 2:** 疼痛频率按钮（line ~786-795）：
- 容器从 `grid grid-cols-2 sm:grid-cols-4 gap-1` 改为 `flex flex-wrap gap-1`
- 按钮从 `rounded-md` 改为 `rounded-full`，加 `px-3`

**Step 3:** 验证 — `npm run build`。

---

### Task 5: 多选字段 — 按选项数量决定平铺或折叠

**Files:**
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**目标:**
- painTypes (13个) 和 associatedSymptoms (5个)：已经是直接展示，改为 `rounded-full` pill 风格
- relievingFactors (11个)：去掉折叠，直接平铺 pills
- causativeFactors (28个)：保留折叠面板（选项太多），但 pill 风格统一为 `rounded-full`

**注意：保留 `expandedPanels` reactive 和 `togglePanel` 函数，病史面板（line 664-698）仍在使用。**

**Step 1:** painTypes 和 associatedSymptoms 的按钮（line ~807-815）从 `rounded-md` 改为 `rounded-full`。

**Step 2:** 将 `MULTI_SELECT_FIELDS` 的折叠面板分支（line ~817-838）改为条件渲染：

```html
<template v-else-if="MULTI_SELECT_FIELDS.has(fieldPath)">
  <!-- 选项少(≤15)：直接平铺 pills -->
  <div v-if="(whitelist[fieldPath] || []).length <= 15" class="space-y-1">
    <label class="text-xs text-ink-500 font-medium">{{ fieldLabel(fieldPath) }}</label>
    <div class="flex flex-wrap gap-1.5">
      <button v-for="opt in whitelist[fieldPath]" :key="opt"
        @click="toggleOption(fieldPath, opt)"
        class="px-2.5 py-1 text-xs font-medium rounded-full border transition-colors duration-150 cursor-pointer"
        :class="fields[fieldPath].includes(opt)
          ? 'bg-ink-800 text-paper-50 border-ink-800'
          : 'border-ink-200 text-ink-500 hover:border-ink-400'">
        {{ shortLabel(opt, 28) }}
      </button>
    </div>
  </div>
  <!-- 选项多(>15)：保留折叠面板 -->
  <div v-else class="space-y-1">
    <div class="flex items-center justify-between">
      <label class="text-xs text-ink-500 font-medium">{{ fieldLabel(fieldPath) }}</label>
      <button @click="togglePanel(fieldPath)" class="text-xs text-ink-600 hover:text-ink-600 px-2 py-1 rounded-md hover:bg-paper-100 cursor-pointer min-h-[28px]">
        {{ expandedPanels[fieldPath] ? '收起' : '编辑' }}
      </button>
    </div>
    <div class="flex flex-wrap gap-1 min-h-[1.5rem]">
      <span v-for="opt in fields[fieldPath]" :key="opt"
        class="inline-flex items-center gap-1 text-xs pl-2 pr-1 py-0.5 rounded-full bg-ink-800 text-paper-50">
        {{ shortLabel(opt, 28) }}
        <button @click="removeOption(fieldPath, opt)"
          class="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-ink-600 transition-colors">
          <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </span>
      <span v-if="fields[fieldPath].length === 0" class="text-[11px] text-ink-500 italic py-0.5">未选择</span>
    </div>
    <div v-show="expandedPanels[fieldPath]" class="border border-ink-150 rounded-lg p-2 bg-paper-50 max-h-32 overflow-y-auto">
      <div class="flex flex-wrap gap-1">
        <button v-for="opt in whitelist[fieldPath]" :key="opt" @click="toggleOption(fieldPath, opt)"
          class="text-[11px] px-2 py-1 rounded-full border transition-colors duration-150 cursor-pointer"
          :class="fields[fieldPath].includes(opt) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:bg-paper-100'"
          :title="opt">{{ shortLabel(opt) }}</button>
      </div>
    </div>
  </div>
</template>
```

**Step 3:** 验证 — `npm run build`。

---

### Task 6: 慢性程度 — 改为 inline pills

**Files:**
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**Step 1:** 慢性程度按钮容器（line ~703）从 `grid grid-cols-3 gap-1` 改为 `flex flex-wrap gap-1`，按钮从 `rounded-md` 改为 `rounded-full`，加 `px-3`。

**Step 2:** 验证 — `npm run build`。

---

### Task 7: 整体微调 + 提交

**Files:**
- Modify: `frontend/src/components/composer/WriterPanel.vue`

**Step 1:** 统一所有卡片的 padding 从 `p-4` 改为 `p-3`（更紧凑）。

**Step 2:** 第一步内部间距从 `space-y-3` 改为 `space-y-2`。

**Step 3:** 第三步的生成按钮区域，删除已移走的高级选项 `<details>` 块（Task 1 已删）。确认无残留。

**Step 4:** 运行 `npm run build` 确认无错误。

**Step 5:** 提交：
```bash
git add frontend/src/components/composer/WriterPanel.vue
git commit -m "refactor(ui): Writer 表单融合 Batch 紧凑风格

- 顶部工具栏: NoteType/TxCount/Realistic/Seed
- Gender: M/F 缩写按钮
- Pain: 固定宽度 select
- 频率/慢性: rounded-full pills
- 多选字段: ≤15选项直接平铺, >15保留折叠
- 统一 padding 和间距"
```
