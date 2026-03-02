# 四代理运营 KPI 面板模板

## 1. 基础信息

- period: YYYY-MM (weekly/monthly/quarterly)
- rule_version: R2.x
- owner: Auditor

## 2. 质量指标

- critical 漏检数（目标 0）
- high 漏检率（目标 < 3%）
- 误报率（目标 < 10%）
- 审计错误放行率（目标 0）
- 回归失败率（目标 < 2%）

## 3. 效率指标

- 单需求平均闭环时长（小时）
- 首次通过率（Writer）
- 规则冻结到发布平均周期
- 回滚恢复时长（分钟）

## 4. 风险指标

- 规则冲突数
- 高频争议规则 Top 5
- hotfix 次数
- 审计阻断次数

## 5. 趋势与结论

```text
[kpi_summary]
quality_status: green|yellow|red
efficiency_status: green|yellow|red
risk_status: green|yellow|red
top_issues:
- ...
actions_next_period:
- ...
```

