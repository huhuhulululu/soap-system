# 四代理毕业认证模板

## 1. 认证信息

- certification_id: CERT-YYYYMMDD-01
- rule_version: R2.0
- candidate_group: ______
- auditor: ______
- date: ______

## 2. 评分维度（100 分）

1. 规则掌握者（25 分）
- 规则可验证性（10）
- 版本管理准确性（10）
- 规则冲突处理质量（5）

2. 编写者（25 分）
- 规则遵循度（10）
- 最小改动与可维护性（10）
- 回归稳定性（5）

3. 检查者（25 分）
- 漏检率控制（10）
- 误报率控制（10）
- 证据完整性（5）

4. 审计员（25 分）
- 流程监督完整性（10）
- 阻断判断准确性（10）
- 风险前瞻与改进建议（5）

## 3. 量化门槛

- 每角色得分 >= 80/100（按其对应维度折算）
- 审计员错误放行率 = 0
- 关键规则（critical）漏检 = 0

## 4. 认证结论

```text
[cert_result]
rule_master_score: __
writer_score: __
checker_score: __
auditor_score: __
blocking_issues:
- ...
decision: pass|fail
remediation_plan:
- ...
retest_date: YYYY-MM-DD
```

