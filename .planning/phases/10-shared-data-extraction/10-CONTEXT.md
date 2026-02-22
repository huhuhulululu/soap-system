# Phase 10: Shared Data Extraction - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

将 ICD catalog 和 CPT defaults (INS_CPT, toggle99203) 从 BatchView.vue 提取到前端共享模块，前后端统一从共享模块导入，消除数据重复。

</domain>

<decisions>
## Implementation Decisions

### Data accuracy
- 原样提取，不修改 ICD/CPT 数据内容
- 前后端数据一致性未确认，提取时需对比
- 如发现差异，以前端 BatchView.vue 数据为准
- 后端也改为从共享模块导入，真正消除重复

### Claude's Discretion
- 共享模块的文件位置和目录结构
- Import pattern（直接导入、composable 等）
- 数据的 TypeScript 类型定义方式

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-shared-data-extraction*
*Context gathered: 2026-02-22*
