# Codex Phase 2 Audit — Week 2 Plan v1

Verdict: **REJECT** (1 CRITICAL + 3 HIGH + 3 MEDIUM + 1 LOW)
Agent: ac5241cbde0ad05d4

## Findings

### CRITICAL
**C1 AC4/HALT 期待 55/55 snapshot 全变 — 错**
- 4 条 IE/RE fixture 走 `exportSOAP(context, undefined, 'text')` 路径（fixture-snapshots.test.ts:87-95）
- 这条路径不经 `generateTXSequenceStates`，不用 main/sub rng 的 stage 循环
- 影响：`LBP-IE-new-patient`, `KNEE-IE-existing-patient`, `SHOULDER-RE-midcourse`, `NECK-RE-latecourse` — 这 4 条 snapshot 应保持 0-diff
- Fix: AC4 改为 "51 TX snapshot 变 + 4 IE/RE 0-diff"；HALT 反之

### HIGH
**H2 `computeGoalPaths` init-time 仍用 main rng 跨 kind 耦合**
- engine-init.ts:268 调 `computeGoalPaths(..., rng)`
- goal-path-calculator.ts:145-305 此 rng 用于 pain/tightness/tenderness/spasm/strength/frequency/symptomScale/ADL/global 所有 kind
- 影响："改一个 sub-engine 算法不影响其他" 在 init 层不成立
- Fix 选项：
  - (a) AC 诚实承认 "stage-runtime 独立，init-time 仍耦合" — 最简
  - (b) 把 computeGoalPaths 也做 kind split — 大工程，超 W2 scope
  - 推荐 (a) + 记 ADR 作为已知限制，留给 W2+ 或 W3 处理

**H3 Stage 4b 针灸选择 rng 无 kind 归属**
- stage4-objective-state.ts:443-449 `pickMultiple(..., rng)` for `_legacyPick` 针灸组
- 5 现有 kind 无自然对应
- Fix: 显式指定 `subRng.muscles`（针灸作用于肌肉点，语义相近）；plan 列清此处

**H4 P14 声称 engine-level 实现是 stage-level**
- Roadmap 原文："换一个 sub-engine 的 seed 不影响其他 sub-engine 输出"
- Plan 诚实承认全序列 accumulator 耦合 → fallback to stage-level
- Fix: P14 明确标为 **stage-level isolation**；另加 P15 做 "end-to-end mutation consistency"（承认耦合但断言 hash of non-target fields 不变的情况——可能失败，作为 intent_gap 文档化）

### MEDIUM
**M5 rng() 调用清单错**
- Stage 1 实际 7 pulls (progressNoise + 5 objectiveFactors + `_painRng`)，plan 写 8
- Stage 2 实际 3 pulls (`_adlRng1`, `_adlRng2`, `_freqRng`)，plan 写 4
- Fix: 重数，校准 AC1 的 38 → 37（或查 stage3/4 是否也偏）

**M6 `mainSeed = options.seed` 伪代码错**
- `options.seed` 可能 undefined；`createSeededRng` 内部生成具体 seed 存为 `actualSeed`
- 当前 engine-init.ts:379 存 `mainSeed: actualSeed`
- Fix: Step 2 伪代码改为 `deriveSubSeed(consts.mainSeed, kind, visitIndex)`

**M7 16 fixture signoff 不覆盖 W1 新 13 条**
- tier-b-step-1 原 list 基于 30 条
- W1 加了 13 条（IE/RE 4, multi-bodypart 2, continue 1, assoc-symptom 4, demographics 2）
- W2 snapshot 变化范围是 51 TX 条，其中包含 W1 新 9 TX 条未覆盖
- Fix: 16 扩到 19-20：原 16 + W1 加的 3-4 条（挑 multi-bodypart, continue, new assoc-symptom 代表）

### LOW
**L8 Stage 1 pain 归类 rationale 错**
- objectiveFactors (sleep/work/weather) **不直接**流入 muscle outputs；muscles 输出来自 initialMuscles + severityLevel
- 归 pain 的决策可接受，但 rationale 需改
- Fix: 改措辞为 "pain 是 stage1 主输出；objectiveFactors 作为 pain-stream 的副产品归 pain"
