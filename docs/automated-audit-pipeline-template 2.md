# 自动化审计流水线模板

## 1. 触发时机

- Pull Request 创建/更新
- 合并到主分支前
- 发布前灰度阶段

## 2. 流水线阶段

1. 规则版本检查
- 校验是否声明 `rule_version`
- 校验是否存在未审批规则变更

2. 测试门禁
- `cd frontend && npm test`
- `cd frontend && BULK_SEED_COUNT=100 npx vitest run engine-random`

3. 证据完整性检查
- 检查是否有 Checker 报告
- 检查是否有 Auditor 结论
- 检查是否包含关键规则证据

4. 风险策略
- 若 `critical` 违规未关闭 => fail
- 若缺失审计结论 => fail
- 若规则版本漂移 => fail

## 3. 流水线输出

```text
[pipeline_result]
rule_version: R2.x
test_status: pass|fail
evidence_status: pass|fail
risk_status: pass|fail
blocking_issues:
- ...
final_gate: pass|reject
```

## 4. 失败处理

- 自动通知：Rule Master / Writer / Checker / Auditor
- 要求补充：缺失证据、未关闭阻断项、规则审批状态
- 失败后不得进入发布阶段

