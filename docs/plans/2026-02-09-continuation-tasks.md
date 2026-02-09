# 续写功能 Task 清单

> 基于 `2026-02-09-continuation-design.md`，严格按依赖关系排序

## 原则约束

- 不修改 `soap-generator.ts`
- 新参数全部 optional，现有 47 测试必须通过
- 每个 task 完成后立即验证

---

## Task 1: whitelist 浏览器化（P0 阻塞项）

**改动文件**: `src/parser/template-rule-whitelist.ts`

**做什么**:
1. 导出 `normalizeOption` 函数（`setWhitelist` 重建 Map 时需要）
2. 加 `setWhitelist(data: Record<string, string[]>)` 函数：
   - 从 JSON 重建 `TemplateWhitelist`
   - `allowedFields = new Set(Object.keys(data))`
   - `optionsByField = new Map(entries.map(([field, opts]) => [field, new Map(opts.map(o => [normalizeOption(o), o]))]))`
   - 赋值给 `cachedWhitelist`
3. `getWhitelist()` 逻辑不变（有 cache 直接返回，无 cache 才 build）

**验证**:
```bash
npx jest --no-coverage  # 47/47 pass
```

**不做什么**: 不改 `buildTemplateWhitelist`，不改 `getWhitelist` 的 fallback 逻辑

---

## Task 2: 预构建脚本

**新建文件**: `scripts/build-whitelist.ts`

**做什么**:
1. 调用 `getAllTemplateFieldPaths()` + `getTemplateOptionsForField()` 
2. 序列化为 `Record<string, string[]>` JSON
3. 写入 `frontend/src/data/whitelist.json`

**验证**:
```bash
npx tsx scripts/build-whitelist.ts
# 确认 frontend/src/data/whitelist.json 存在，35 字段，753 选项
```

**交叉验证**: 用 `setWhitelist` 加载 JSON 后，调用 `getTemplateOptionsForField` 对比原始结果一致

---

## Task 3: engine 续写参数（P0 核心改造）

**改动文件**: `src/generator/tx-sequence-engine.ts`

**做什么**:
1. `TXSequenceOptions` 加两个 optional 字段：
   ```typescript
   startVisitIndex?: number
   initialState?: {
     pain: number
     tightness: number
     tenderness: number
     spasm: number
     frequency: number
   }
   ```
2. `generateTXSequenceStates` 内部改造：
   - `startPain`: 有 `initialState` 时用 `initialState.pain`，否则不变
   - `prev*` 变量初始化：有 `initialState` 时用其值，否则不变
   - `startIdx = options.startVisitIndex || 1`
   - 循环 `for (let i = startIdx; i <= txCount; i++)`
   - progress 计算改为 local 曲线：
     ```typescript
     const remainingTx = txCount - startIdx + 1
     const localIndex = i - startIdx + 1
     const progressLinear = localIndex / remainingTx
     ```
   - `prevProgress` 初始化为 0（local 曲线从头开始）
   - pain 的 `expectedPain` 用 `initialState.pain` 作为起点（而非 IE 的 startPain）

**不做什么**: 不改 `startPain`/`targetPain` 的计算逻辑（仍从 `context.previousIE` 读取 targetPain）

**验证**:
```bash
npx jest --no-coverage  # 47/47 pass（不传新参数时行为不变）
```

手动验证：
```typescript
// startVisitIndex=4, initialState={pain:7,...}, txCount=11
// 应输出 8 个 visit，pain 从 7 平滑降到 ~5
```

---

## Task 4: 前端 generator 服务

**新建文件**: `frontend/src/services/generator.js`

**做什么**:
1. `initWhitelist()`: import JSON → `setWhitelist()`
2. `ensureHeader(text)`: 检测无 header 时注入假 header
3. `extractInitialState(visit)`: VisitRecord → `{ pain, tightness, tenderness, spasm, frequency }`
4. `formatIcdCpt(ieVisit, hasPacemaker, treatmentTime)`: 拼接 ICD/CPT 文本
5. `generateContinuation(text, options)`: 主函数
   - `options`: `{ insuranceType, treatmentTime, generateCount }`
   - 调用链: ensureHeader → parseOptumNote → findIE → bridgeToContext → 覆盖字段 → extractInitialState → generateTXSequenceStates → exportSOAPAsText → formatIcdCpt
   - 返回: `{ visits: [{ index, text, state }], context, ieVisit, existingTxCount }`

**依赖**: Task 1 + Task 2 + Task 3

**验证**: Vite dev server 启动后，浏览器 console 无报错，import 链正常

---

## Task 5: ContinuePanel.vue

**新建文件**: `frontend/src/components/ContinuePanel.vue`

**做什么**:
1. 粘贴区: `<textarea>` 输入 IE+TX 文本
2. 解析摘要: 解析后显示 bodyPart / laterality / localPattern / 已有 TX 数 / IE pain
3. 参数确认: insurance 下拉 / treatmentTime 下拉 / 生成数量（自动计算 `11 - existingTxCount`，可手动调）
4. 生成按钮 → 调用 `generateContinuation`
5. 结果区: 每个 TX 一个可折叠卡片，含复制按钮
6. 中文 UI

**依赖**: Task 4

---

## Task 6: App.vue tab 切换

**改动文件**: `frontend/src/App.vue`

**做什么**:
1. 顶部加 tab 栏: 验证 | 续写
2. tab 切换显示对应面板
3. insurance / treatmentTime 下拉移到各面板内部（两个 tab 独立控制）

**依赖**: Task 5

---

## 执行依赖图

```
Task 1 (whitelist setWhitelist)
  ↓
Task 2 (预构建 JSON)
  ↓
Task 3 (engine 续写参数)  ← 可与 Task 2 并行
  ↓
Task 4 (generator.js)     ← 依赖 1+2+3
  ↓
Task 5 (ContinuePanel)    ← 依赖 4
  ↓
Task 6 (App.vue tab)      ← 依赖 5
```

## 完成标准

- [x] Task 1-3: `npx jest --no-coverage` 9 suite 107 test pass（与改动前一致）
- [x] Task 2: `whitelist.json` 存在，35 字段 753 选项，setWhitelist 结果与原始完全一致
- [x] Task 4: 浏览器 Vite 编译通过，无 fs 相关报错
- [x] Task 5: ContinueView.vue 编译通过
- [x] Task 6: 路由 + tab 切换就绪
- [ ] 端到端验证: 浏览器中粘贴 IE+TX 文本 → 生成 TX → 复制
