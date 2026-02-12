# 发布运行手册模板（SOAP 系统）

## 1. 发布信息

- release_id: REL-YYYYMMDD-01
- rule_version: R1.x
- owner: Auditor
- scope: ______
- change_summary: ______

## 2. 发布前检查

- [ ] Rule Master 已冻结规则版本
- [ ] Writer 改动范围符合预期
- [ ] Checker 完成规则核验并给出证据
- [ ] Auditor 完成阻断项审计
- [ ] 回归通过：
  - [ ] `cd frontend && npm test`
  - [ ] `cd frontend && BULK_SEED_COUNT=100 npx vitest run engine-random`

## 3. 灰度策略

- phase_1: 10%
- phase_2: 50%
- phase_3: 100%

### 每阶段必看指标

- TX 单调性违规率（目标 0）
- SOA 链不一致率（目标 0）
- S/O/A/P 缺段率（目标 0）
- 高严重度规则违规数（目标 0）

## 4. 回滚触发器

满足任一条件立即回滚：

- 出现 `critical` 规则违规。
- 单调性/SOA/完整性任一指标 > 0。
- Checker 与 Auditor 结论不一致且无法在时限内裁决。

## 5. 回滚步骤

1. 标记当前发布状态为 `rollback_in_progress`。
2. 切回上一个稳定版本（记录版本号）。
3. 重新执行回归命令并保存结果。
4. 发布回滚通告与影响范围。

## 6. 审计签字

```text
[release_decision]
release_id: REL-YYYYMMDD-01
phase_reached: 10%|50%|100%
blocking_issues:
- ...
decision: pass|reject|rollback
auditor: ______
timestamp: ______
```

