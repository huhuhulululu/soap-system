# Requirements: SOAP Batch System v1.3

**Defined:** 2026-02-22
**Core Value:** Batch-generate compliant SOAP notes from minimal input

## v1.3 Requirements

### Form UX

- [ ] **UX-01**: Name 和 DOB 分为两个独立输入框，DOB 支持 MM/DD/YYYY、MM-DD-YYYY、MMDDYYYY、MM/DD/YY 格式自动识别
- [ ] **UX-02**: Gender 用 M/F 标签按钮替代下拉框，选中高亮
- [ ] **UX-03**: Side 用 L/B/R 标签按钮替代下拉框，选中高亮
- [ ] **UX-04**: 表单字段尺寸按内容比例优化，紧凑布局无浪费空间

### Shared Data

- [ ] **DATA-01**: ICD catalog 从 BatchView.vue 提取到前端共享模块，消除前后端重复
- [ ] **DATA-02**: CPT defaults (INS_CPT, toggle99203) 从 BatchView.vue 提取到共享模块

### Validation

- [ ] **VAL-01**: 前端即时验证 — patient 格式、必填字段、ICD 数量限制，提交前显示错误提示

## Future Requirements

- BatchView.vue 组件拆分重构 (PatientForm, ReviewPanel, AutomationPanel)
- WriterPanel.vue 组件拆分重构

## Out of Scope

| Feature | Reason |
|---------|--------|
| BatchView 完整拆分重构 | 风险太大，v1.3 只提取数据模块 |
| 后端验证重写 | 现有后端验证工作正常 |
| 新增 body part 或 ICD 码 | 数据变更不在此 milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| UX-04 | — | Pending |
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| VAL-01 | — | Pending |

**Coverage:**
- v1.3 requirements: 7 total
- Mapped to phases: 0
- Unmapped: 7 ⚠️

---
*Requirements defined: 2026-02-22*
