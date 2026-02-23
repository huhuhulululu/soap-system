# Phase 11: Form UX & Validation - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

将 BatchView 表单的 Patient 单字段拆分为 Name + DOB，Gender/Side 下拉改为 segmented control toggle，优化表单布局比例，添加前端输入验证。不涉及新功能或新字段添加。

</domain>

<decisions>
## Implementation Decisions

### Name/DOB 拆分
- Patient 单字段拆为 Name 和 DOB 两个独立 input
- Name 保持 `LAST,FIRST` 单字段格式，placeholder 提示格式
- DOB 自由输入，支持 MM/DD/YYYY, MM-DD-YYYY, MMDDYYYY, MM/DD/YY
- DOB 在 blur 时自动格式化为 MM/DD/YYYY 标准格式

### Toggle tag 样式
- Gender (M/F) 和 Side (L/R/Bil) 改为 segmented control 外观
- 选中状态：深色填充（ink-800 风格，白色文字）
- 切换带过渡动画效果
- Gender 和 Side 都无默认值，强制用户选择

### 表单布局
- 单行紧凑：Name + DOB + Gender + Insurance + BodyPart + Side 一行
- 窄屏响应式堆叠（保持 sm: breakpoint 策略）

### 验证与错误反馈
- Blur 时验证单字段 + 提交时全量检查
- 所有必填字段都需前端验证（Name, DOB, Gender, Side, Insurance, BodyPart, ICD in full mode）
- 具体错误信息（如 DOB 格式错误提示支持的格式列表）

### Claude's Discretion
- 各字段宽度比例（按内容长度自动分配）
- 整体紧凑度（gap、padding、font-size 调整）
- 错误展示方式（inline、tooltip、border 等）

</decisions>

<specifics>
## Specific Ideas

- Segmented control 参考 iOS 风格，整体一个圆角框包裹选项
- 深色填充选中态和现有 ICD tag（ink-800 bg + white text）保持视觉一致
- DOB 格式化只在 blur 时触发，输入过程中不干预用户

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-form-ux-validation*
*Context gathered: 2026-02-22*
