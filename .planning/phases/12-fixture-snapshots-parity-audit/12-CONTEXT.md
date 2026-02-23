# Phase 12: Fixture Snapshots & Parity Audit - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Pre-work phase before engine modifications (Phases 13-14). Captures 30 regression baseline fixture snapshots, audits Strength/ROM generation consistency across compose/batch/realistic-patch modes, and establishes batch/compose parity through a shared `normalizeGenerationContext()` function. Existing SOAP generator logic is correct and must not be rewritten or deviated from.

</domain>

<decisions>
## Implementation Decisions

### Fixture 覆盖策略
- 30 个 fixture 覆盖早期(1-3)、中期(8-12)、晚期(18-20) 就诊次数
- 身体部位分布、边界情况（疼痛极端值、bilateral、首次就诊等）由 Claude 根据代码中支持的部位合理分配
- 确定性策略由 Claude 决定（固定 seed 或固定输入数据）

### 审计报告格式
- 单独的 Markdown 报告文件
- 全量记录并标记：一致的标 ✅，不一致的标 ❌
- 报告内容组织方式由 Claude 决定（按部位或按模式分组）
- 报告存放位置由 Claude 决定

### 一致性定义
- S/O/A/P 内容级别一致（结构等价），允许格式差异（空行、空格）
- Parity 测试时 seed 必须统一，两条路径用同一个 seed 对比
- 审计发现的 batch/compose context 构建差异必须全部修复，零差异目标
- 差异来源是 `buildContext()`（batch）和 `generationContext` computed（compose）对 GenerationContext 的字段映射/默认值不同

### 归一化边界
- `normalizeGenerationContext()` 包含推断逻辑：TCM 证型推断 + initialState 构建
- 推荐但允许覆盖：compose 端用户手动选择的值可以覆盖推断结果
- 输入输出形状由 Claude 决定
- 文件位置由 Claude 决定（需要被 server 和 frontend 两端引用）

### 执行顺序
- 先拍快照确认基线 → 再加 normalize 层 → 再验证快照不变

### Claude's Discretion
- Fixture 身体部位分布和边界情况选择
- 确定性策略（seed 管理方式）
- 审计报告内容组织方式和存放位置
- `normalizeGenerationContext()` 的输入输出接口设计
- `normalizeGenerationContext()` 的文件位置

</decisions>

<specifics>
## Specific Ideas

- 现有 SOAP generator 逻辑是正确的，不可猜测重写和偏离——normalize 是在现有逻辑之上加标准化入口层
- batch 端 `buildContext()` 包含 TCM 推断，compose 端由用户表单填写——normalize 需要统一这两条路径
- 两条路径都调用同一个 `exportSOAPAsText()` / `exportTXSeriesAsText()`，差异只在 GenerationContext 构建方式

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-fixture-snapshots-parity-audit*
*Context gathered: 2026-02-22*
