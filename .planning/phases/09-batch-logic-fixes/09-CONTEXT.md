# Phase 9: Batch Logic Fixes - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix IE/CPT logic across three batch modes (full, soap-only, continue). Change includeIE defaults, unify IE CPT rules, and ensure correct visit ordering by appointment time.

</domain>

<decisions>
## Implementation Decisions

### includeIE 默认值规则
- Full 模式：默认 true，用户可在 Excel 中覆盖
- Soap-only 模式：默认 true（从 false 改为 true），用户可在 Excel 中覆盖
- Continue 模式：强制 false，不可改，不生成 IE visit

### IE CPT 规则（所有模式统一）
- IE visit CPT = TX CPT + 99203（HF/VC 保险时自动追加）
- 99203 是唯一需要特殊处理的 CPT code
- TX visit 统一过滤掉 99203（所有模式）
- 当前代码中 `getDefaultIECPT` 未被调用，需要修复

### IE visit 字段规格
- IE 与 TX 的字段差异仅三个：noteType='IE', dos=1, txNumber=null
- IE 是该保险下治疗的第一个 visit
- Excel 新增 IE Date 列，客户填写 IE 预约日期

### Visit 排序与操作顺序
- MDLand 操作时需读取预约时间，按时间先后顺序处理 visit
- IE visit 对应客户输入的 IE 日期

### Continue 模式特殊行为
- 不包含 IE visit（强制 includeIE=false）
- TX visit CPT 逻辑与其他模式一致
- 需要客户输入开始日期，从该预约日期正序接续
- 用户提供上次 SOAP 信息，系统接续生成

### 已有 batch 处理
- 不需要数据迁移，只改解析逻辑
- 下次重新解析 Excel 时自动用新默认值

### Claude's Discretion
- `getDefaultIECPT` 的具体集成方式
- Continue 模式接续 SOAP 的数据结构设计
- Excel IE Date 列的解析格式和校验逻辑

</decisions>

<specifics>
## Specific Ideas

- IE CPT 构建方式：TX CPT 基础上追加 99203（不是独立列表）
- Continue 模式的「接续」：用户会提供上次 SOAP 信息，系统从指定日期正序生成所需数量
- 预约时间排序对 MDLand 批量操作至关重要

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-batch-logic-fixes*
*Context gathered: 2026-02-22*
