# 审计红队演练模板

## 1. 演练信息

- exercise_id: RT-YYYYMMDD-01
- rule_version: R1.x
- auditor: ______
- checker: ______
- scope: ______

## 2. 红队挑战清单

每条挑战必须包含：

- challenge_id
- target_rule_id
- original_finding
- counter_evidence
- expected_decision

示例：

```text
[challenge]
challenge_id: CH-01
target_rule_id: X-003
original_finding: "A 段与 O 段不一致"
counter_evidence: "O 段实际为 stable，A 段 remained the same 合法"
expected_decision: finding_overturned
```

## 3. 裁决结果

```text
[red_team_result]
total_challenges: __
upheld: __
overturned: __
checker_adjustments:
- ...
systemic_gaps:
- ...
decision: pass|reject
```

## 4. 后续动作

- [ ] 更新规则解释文档
- [ ] 更新检查清单
- [ ] 更新审计抽检策略
- [ ] 加入回归测试样本

