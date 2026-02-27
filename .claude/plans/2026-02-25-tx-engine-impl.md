# TX 序列引擎重设计 — 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复现有引擎的 P0/P1 bug，将 10 条动态路径统一到离散调度框架下。

**Architecture:** 扩展 goal-path-calculator 从 3 维度到 10 维度，加变化预算分配器控制每次 visit 释放 2-3 个维度变化。所有修改必须保持 30 个 fixture snapshot 的 PRNG 序列兼容（先更新 snapshot 再改逻辑）。

**Tech Stack:** TypeScript, Vitest, PRNG (mulberry32)

**关键约束:** 新 rng() 调用必须追加在循环末尾，否则整个 PRNG 序列偏移导致 30 个 snapshot 全部失败。

---

## Phase 1: 独立 Bug 修复（可并行）

### Task A: ELBOW ADL 两组分支修复

**Files:**
- Modify: `src/generator/soap-generator.ts` (~line 1662)
- Test: `src/generator/__fixtures__/fixture-snapshots.test.ts`

**Step 1:** 在 soap-generator.ts 的 ADL 分支中，将 ELBOW 加入 SHOULDER/NECK 分支：
```typescript
// 改前:
} else if (bp === 'SHOULDER' || bp === 'NECK') {
// 改后:
} else if (bp === 'SHOULDER' || bp === 'NECK' || bp === 'ELBOW') {
```

**Step 2:** 跑 `npx vitest --run` 确认 fixture snapshot 变化合理（ELBOW case 的 ADL 输出会变）

**Step 3:** 更新受影响的 snapshot: `npx vitest --run -u`

**Step 4:** Commit: `fix: include ELBOW in two-group ADL branch`

---

### Task B: S-O-A 守卫条件加强

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (~line 1135-1147)
- Test: fixture snapshots

**Step 1:** 将守卫条件从 `painDelta <= 0` 改为 `painDelta < 0.3`：
```typescript
// 改前:
if (painDelta <= 0 && !objectiveImproved) {
// 改后:
if (painDelta < 0.3 && !objectiveImproved && !frequencyImproved && !adlImproved) {
```

**Step 2:** 跑测试，更新 snapshot

**Step 3:** Commit: `fix: strengthen S-O-A guard to require meaningful change for improvement`

---

### Task C: soaChain.objective 补充 spasmTrend

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (~line 1399-1404)

**Step 1:** 在 soaChain.objective 中添加 spasmTrend：
```typescript
objective: {
  tightnessTrend,
  tendernessTrend,
  spasmTrend,    // 新增
  romTrend,
  strengthTrend
},
```

**Step 2:** 跑测试确认通过（snapshot 不含 soaChain 内部结构，应该不变）

**Step 3:** Commit: `fix: add spasmTrend to soaChain.objective`

---

### Task D: 删除 associatedSymptom 降级逻辑

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` (~line 1226-1246)
- Test: fixture snapshots

**Step 1:** 删除 associatedSymptom 降级逻辑，改为直接继承 IE 的 associatedSymptom：
```typescript
// 删除整个降级 block，替换为:
const associatedSymptom = options.initialState?.associatedSymptom || context.associatedSymptom || 'soreness'
```

**Step 2:** 跑测试，更新 snapshot

**Step 3:** Commit: `fix: keep associatedSymptom fixed throughout TX series`

---

### Task E: deriveAssessmentFromSOA 添加 bodyPart 参数

**Files:**
- Modify: `src/generator/tx-sequence-engine.ts` — deriveAssessmentFromSOA 函数签名 + findingType/whatChanged 逻辑

**Step 1:** 给函数添加 bodyPart 参数，调用处传入 context.primaryBodyPart

**Step 2:** findingType 逻辑：SHOULDER/ELBOW 不输出 `joint ROM`，只用 `joint ROM limitation`

**Step 3:** whatChanged 逻辑：NECK 额外添加 dizziness/headache/migraine 选项

**Step 4:** 跑测试，更新 snapshot

**Step 5:** Commit: `fix: add bodyPart to deriveAssessmentFromSOA for per-part findingType/whatChanged`

---

## Phase 2: 核心架构 — 扩展离散调度（顺序执行）

### Task F: Strength 纳入 goal-path-calculator

**Files:**
- Modify: `src/generator/goal-path-calculator.ts` — 添加 strength 维度
- Modify: `src/generator/tx-sequence-engine.ts` — 用 goalPaths.strength 替代 prevStrengthDeficit
- Modify: `src/generator/objective-patch.ts` — bumpStrength 改为接收引擎传入的 grade

**核心:** Strength 走 computeDimensionPath，引擎输出离散 grade，objective-patch 不再独立重算。

---

### Task G: Pain/Frequency/SymptomScale/ADL 纳入 goal-path-calculator

**Files:**
- Modify: `src/generator/goal-path-calculator.ts` — 添加 7 个新维度
- Modify: `src/generator/tx-sequence-engine.ts` — 用 goalPaths 替代各自独立逻辑

**核心:** 所有 10 条路径统一用 distributeDrops + deconflict 调度。

---

### Task H: 变化预算分配器

**Files:**
- Create: `src/generator/change-budget-allocator.ts`
- Modify: `src/generator/tx-sequence-engine.ts` — 主循环用分配器控制释放

**核心:** 每次 visit 最多释放 2-3 个维度变化，超出的进缓冲队列。

---

## Phase 3: 语句系统优化（依赖 Phase 2）

### Task I: Reason 选择优化（shuffle bag + 匹配实际变化）

### Task J: tolerated/response 匹配实际 O 变化

### Task K: deriveAssessmentFromSOA 中性/负面分支
