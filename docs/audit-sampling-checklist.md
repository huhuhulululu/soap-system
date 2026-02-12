# 审计抽检清单（Round 3+）

## 抽检参数

- rule_version: ______
- sampling_ratio: ______ (建议 30%)
- sample_scope: A / B / C / all
- auditor: ______

## 抽检项

1. 规则一致性
- [ ] 每个需求均引用同一规则版本
- [ ] 无“未登记规则”被实际使用
- [ ] 禁改项未被触碰

2. 编写产出
- [ ] 改动范围最小且与需求匹配
- [ ] 无硬编码覆盖用户输入
- [ ] 未绕过 `generateTXSequenceStates` / `exportSOAPAsText`

3. 检查质量
- [ ] 每条结论有 `rule_id`
- [ ] 每条结论有证据路径或断言
- [ ] 严重级别划分合理

4. 回归与稳定性
- [ ] `npm test` 通过
- [ ] `BULK_SEED_COUNT=100` 通过
- [ ] 无新增 flaky 迹象

5. 文档与可追溯性
- [ ] 有规则变更单（若本轮有规则变更）
- [ ] 有冲突仲裁单（若本轮有冲突）
- [ ] 审计结论包含阻断项/放行理由

## 抽检结论

```text
[sampling_result]
pass_rate: __%
leakage_rate: __%
blocking_issues:
- ...
decision: pass|reject
follow_up:
- ...
```

