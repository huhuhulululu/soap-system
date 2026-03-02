# TX 数据源统一 — 执行计划

> 基线文档: `MEMORY.md` 签收版 (2026-03-02)
> 问题总数: 20 成立 + 2 部分成立 + 1 已修复
> 约束: `rng()` 调用顺序不可变；需先让 fixture 测试可被执行（testMatch 覆盖）再把 snapshot 作为门禁

---

## Phase 1: Assessment / Objective 一致性（问题 #1 #2 #3 #4 #5）

### Task 1.1 — ROM 趋势与渲染对齐（#1）

**问题**: `romTrend` 基于 `romDeficit` float 比较判定 `improved/slightly improved/stable`，但渲染层用 `pain → severity band → pickTemplateROMDegrees` 独立计算角度，两者脱节。

**修复方案**:
- `soap-generator.ts` 的 `generateObjective()` ROM 渲染段，改为优先读 `visitState.soaChain.objective.romTrend`
- 当 `romTrend === 'improved'` 时，确保渲染的角度比上次更大（或至少跨一个 severity band）
- 当 `romTrend === 'slightly improved'` 时，角度允许小步提升
- 当 `romTrend === 'stable'` 时，角度保持不变

> 备注: 当前 objective ROM trend 枚举不含 `worsened`，不要在本任务中引入该分支。

**涉及文件**:
- `src/generator/soap-generator.ts` — ROM 渲染段 (~L1354-1404)
- `src/shared/rom-from-template.ts` — 可能需要新增 `pickDegreesByTrend()` 辅助函数

**验证**: 批量扫描 120 seeds × 7 部位，`romTrend` 与实际角度变化方向一致率 = 100%

---

### Task 1.2 — tightness trend reconciliation（#5）

**问题**: tenderness 和 spasm 有 reconciliation 逻辑（trend 与 grading 不一致时修正），tightness 没有。

**修复方案**:
- 在 `tx-sequence-engine.ts` 的 reconciliation 段（~L1676-1724），为 tightness 添加与 tenderness/spasm 相同模式的 reconciliation
- `tightnessTrend in {'reduced','slightly reduced'}` 时，tightnessGrade 必须 ≤ 上次值
- `tightnessTrend === 'stable'` 时，tightnessGrade 不变

**涉及文件**:
- `src/generator/tx-sequence-engine.ts` — reconciliation 段

**约束**: 新 `rng()` 调用（如有）必须追加在循环末尾

**验证**: 批量扫描确认 tightnessTrend 与 tightnessGrade 变化方向一致率 = 100%

---

### Task 1.3 — output-cap defer 后 Assessment 全量回补（#3）

**问题**: output-cap 把低优先级维度 defer 后，只对 `symptomScale` 做了 post-cap patch，其他被 defer 的维度（tightness、tenderness、spasm、frequency 等）的 Assessment 文本仍保留了 defer 前的描述。

**修复方案**:
- `tx-sequence-engine.ts` L1845-1861 的 post-cap patch 段，扩展为遍历所有被 defer 的维度
- 对每个 deferred 维度，将 `soaChain.assessment` 中对应的 `response`/`findingType` 回写为 stable/unchanged
- 或者：将 `deriveAssessmentFromSOA` 调用移到 output-cap 之后（更彻底）

**涉及文件**:
- `src/generator/tx-sequence-engine.ts` — output-cap 段 (~L1784-1861)

**验证**: 批量扫描确认 deferred 维度不出现在 Assessment 的 improvement 描述中

---

### Task 1.4 — whatChanged fallback 修正（#2）

**问题**: `whatChanged` 在无明确变化维度时 fallback 到 `"pain"`，即使 pain 实际未下降。

**修复方案**:
- `tx-sequence-engine.ts` L413-416，fallback 改为从实际有变化的维度中选取
- 如果确实没有任何维度变化（全 stable），`whatChanged` 应回退到模板允许值 `"as last time visit"`
- 确保 fallback 值在 `TEMPLATE_TX_WHAT_CHANGED` 的 10 个选项范围内

**涉及文件**:
- `src/generator/tx-sequence-engine.ts` — whatChanged 计算段

**验证**: 批量扫描确认 `whatChanged` 值与实际变化维度匹配

---

### Task 1.5 — response 与输出维度一致性（#4）

**问题**: `response` 写 `"reducing spasm"` 但 spasm grading 与上次相同。

**修复方案**:
- 此问题的根因是 Task 1.3（output-cap defer 后未回补）和 Task 1.2（reconciliation 缺失）
- 完成 1.2 和 1.3 后，验证此问题是否自动消除
- 如仍存在，在 `deriveAssessmentFromSOA` 中增加 response 与实际 grading 变化的交叉校验

**涉及文件**:
- `src/generator/tx-sequence-engine.ts` — `deriveAssessmentFromSOA` (~L323-530)

**验证**: 批量扫描 600 seeds × 7 部位，response 提及的维度与实际 grading 变化一致率 = 100%

---

## Phase 2: 渲染层数据源统一（问题 #6 #8 #9 #10 #11 #14 #15）

### Task 2.1 — adlItems 消费（#6）

**问题**: 引擎计算了 `adlItems` 数量变化，但渲染层 `generateSubjectiveTX` 固定 `slice(0, 3)`（LBP）。

**修复方案**:
- `soap-generator.ts` `generateSubjectiveTX` 中 ADL 段，改为读 `visitState.adlItems`
- 如 `visitState.adlItems` 存在，直接使用其列表
- 如不存在（兼容），fallback 到当前逻辑

**涉及文件**:
- `src/generator/soap-generator.ts` — `generateSubjectiveTX` ADL 段 (~L1809-1869)

**验证**: 批量扫描确认 ADL 数量随 visit 递减

---

### Task 2.2 — needlePoints 消费（#8）

**问题**: 引擎选了穴位但渲染层 `generateNeedleProtocol` 独立重选。

**修复方案**:
- `soap-generator.ts` `generateNeedleProtocol` 改为优先读 `visitState.needlePoints`
- 如存在，直接使用；如不存在，fallback 到当前逻辑

**涉及文件**:
- `src/generator/soap-generator.ts` — `generateNeedleProtocol` (~L2092-2170)

**验证**: 批量扫描确认引擎穴位与渲染穴位一致

---

### Task 2.3 — generatePlanTX 接收 visitState（#9 #14）

**问题**: `generatePlanTX(context)` 不接收 `visitState`，`painScale` 硬编码 7。

**修复方案**:
- 函数签名改为 `generatePlanTX(context, visitState)`
- 用 `visitState.painScaleCurrent`（无则 fallback `context.painCurrent`）替代硬编码 `painScale: 7`
- 用 `visitState.treatmentFocus` 驱动 Plan 中的治疗重点描述
- 更新所有调用点

**涉及文件**:
- `src/generator/soap-generator.ts` — `generatePlanTX` (~L2043-2075) + 调用点

**验证**:
- 批量扫描确认 Plan 不再全程固定（同病例多次 TX 的 Plan 可随 visitState 变化）
- 代码审查确认 `WeightContext.painScale` 来源为当次 visit（不再硬编码 7）

---

### Task 2.4 — symptomType 从 context 获取（#15）

**问题**: 引擎 `symptomType` 硬编码 `"soreness"`，IE 用 `context.associatedSymptoms[0]`。

**修复方案**:
- `tx-sequence-engine.ts` L940，改为从 `context.associatedSymptoms[0]` 或 IE 初始值获取
- 确保与 IE Assessment 中的 symptomType 一致

**涉及文件**:
- `src/generator/tx-sequence-engine.ts` — symptomType 赋值段

**验证**: 批量扫描确认 TX symptomType 与 IE 一致

---

### Task 2.5 — objectiveFactors / soaChain.subjective 消费（#10 #11）

**问题**: 引擎生成了 `objectiveFactors` 和 `soaChain.subjective.*` 但渲染层未消费。

**修复方案**:
- 评估这些字段的设计意图
- `objectiveFactors`: 如果是给 Objective 段用的，在 `generateObjective` 中消费
- `soaChain.subjective.*`: 在 `generateSubjectiveTX` 中用于驱动 Subjective 文本
- 如果确认是预留字段暂不需要，标记为 `@todo` 并在代码注释中说明

**涉及文件**:
- `src/generator/soap-generator.ts` — 多处

**验证**: 代码审查确认消费路径或明确标记

---

### Task 2.6 — aggravatingItems 计算优化（模板对齐优化）

**问题**: TX 模板本身不输出 aggravating factors，但引擎仍每次计算 `aggravatingItems`。

**修复方案**:
- 在 TX 引擎路径中移除或按需惰性计算 `aggravatingItems`
- 渲染层不新增消费（保持与 TX 模板一致）
- 如为兼容保留字段，补注释说明“当前不用于渲染”

**涉及文件**:
- `src/generator/tx-sequence-engine.ts` — aggravatingItems 计算段 (~L1146-1154)
- `src/generator/tx-sequence-engine.ts` — `TXVisitState` 字段定义（如需调整）

**验证**:
- 代码审查确认 TX 渲染输出无变化
- profile 或日志确认无效计算减少

---

## Phase 3: 模型与规则修正（问题 #13 #18）

### Task 3.1 — ROM severity 平滑过渡（#13）

**问题**: `getTemplateSeverityForPain()` 用 3/6 阈值导致 pain 从 6→5 时 ROM 角度跳变。

**修复方案**:
- 引入中间 severity 或线性插值
- 例如: pain 7-10 = severe, 5-6 = moderate, 3-4 = mild, 1-2 = minimal
- 或者: 直接用 `romDeficit` 百分比映射到角度范围，不经过离散 severity

**涉及文件**:
- `src/shared/rom-from-template.ts` — `getTemplateSeverityForPain`

**约束**: 改动后 Task 1.1 的 romTrend 对齐逻辑需同步验证

**验证**: 批量扫描确认 pain 连续下降时 ROM 角度单调递增（无跳变）

---

### Task 3.2 — frequency goals 从 patchedGoals 获取（#18）

**问题**: `st=1, lt=0` 硬编码。

**修复方案**:
- 从 `goalPathCalculator` 的输出或 `context` 中获取频率目标
- 如果业务上确实是固定值，改为常量并加注释说明

**涉及文件**:
- `src/generator/tx-sequence-engine.ts` — frequency goals 赋值段 (~L982-983)

**验证**: 代码审查确认来源合理

---

## Phase 4: 测试体系修复

### Task 4.1 — fixture testMatch 配置修正（前置，先于 Phase 1）

**问题**: `package.json` 的 `testMatch` 只匹配 `__tests__/**/*.test.ts`，fixture 在 `__fixtures__/`。

**修复方案**:
- 更新 `testMatch` 或 `testPathPattern` 包含 `__fixtures__`
- 或将 fixture 测试入口移到 `__tests__/` 下

**涉及文件**:
- `package.json` 或 `jest.config.*` 或 `vitest.config.*`

**验证**: `npm test` 能发现并运行 fixture 测试

---

### Task 4.2 — 30 fixture snapshot 更新

**问题**: Phase 1-3 的引擎改动会导致 fixture snapshot 不匹配。

**修复方案**:
- Phase 1-3 全部完成后，运行 fixture 测试并更新 snapshot
- 人工审查新 snapshot 确认临床合理性

**约束**: 必须在所有引擎改动完成后一次性更新，不能中途更新

**验证**: 30 个 fixture 全部通过

---

### Task 4.3 — 失败测试修复

**问题**: 48 个测试失败，主要是 Vitest/Jest 混用 + 类型不匹配。

**修复方案**:
- 统一测试框架（建议全部迁移到 Vitest 或全部 Jest）
- 更新过时的测试输入类型（`associatedSymptom` → `associatedSymptoms` 等）
- 修复 server 测试的环境依赖

**涉及文件**:
- `test/` 目录下多个文件
- `package.json` 测试配置

**验证**: `npm test` 全部通过

---

## 执行顺序与依赖

```
Pre-Phase（先执行）:
  4.1 fixture config（让 __fixtures__ 测试可被发现）

Phase 1 (串行):
  1.2 tightness reconciliation
  → 1.3 output-cap 全量回补
  → 1.4 whatChanged fallback
  → 1.1 ROM 趋势对齐
  → 1.5 response 一致性验证（依赖 1.2 + 1.3）

Phase 2 (可并行):
  2.1 adlItems ─┐
  2.2 needlePoints ─┤─ 互相独立
  2.3 generatePlanTX ─┤
  2.4 symptomType ─┤
  2.5 objectiveFactors ─┤
  2.6 aggravatingItems 优化 ─┘

Phase 3 (串行):
  3.1 ROM severity 平滑（依赖 Phase 1.1 完成）
  → 3.2 frequency goals

Phase 4 (最后):
  4.2 snapshot 更新 → 4.3 失败测试修复
```

## 风险点

1. **PRNG 序列偏移**: 任何新 `rng()` 调用必须追加在循环末尾，否则 30 个 fixture 全部偏移
2. **output-cap 改动范围大**: Task 1.3 是最高风险任务，可能影响所有维度的 Assessment 输出
3. **ROM 双重改动**: Task 1.1 + 3.1 都改 ROM，需要协调
4. **测试框架统一**: Task 4.3 工作量可能超预期

## 预估工时

| Phase | 预估 | 说明 |
|-------|------|------|
| Phase 1 | 3-4h | 引擎核心逻辑，需要谨慎 |
| Phase 2 | 2-3h | 渲染层改动，相对独立 |
| Phase 3 | 1-2h | 模型调整 |
| Phase 4 | 2-3h | 测试修复，工作量不确定 |
| 总计 | 8-12h | |
