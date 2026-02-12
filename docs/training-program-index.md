# SOAP 四代理训练总索引（优化版）

## 1. 训练目标

- 建立可持续的四角色协作链：规则掌握者 -> 编写者 -> 检查者 -> 审计员。
- 保证三条核心红线始终不破：
  - TX 单调性
  - SOA 链一致性
  - S/O/A/P 完整性

## 2. 优化后的三阶段推进（替代“只按轮次顺推”）

### Phase A：基础闭环（Round 1-2）

- 目标：统一规则口径与证据格式，跑通单轮闭环。
- 入口条件：规则模板和任务模板已创建。
- 出口条件：
  - R1/R1.1 规则版本可追溯
  - 至少完成 3 轮 pass/reject 演练
  - `npm test` + `BULK_SEED_COUNT=100` 连续通过

### Phase B：并行与抗压（Round 3-5）

- 目标：并行任务、冲突仲裁、异常注入、红队审计可稳定执行。
- 入口条件：Phase A 出口条件全部满足。
- 出口条件：
  - 并行 A/B/C 任务可交付
  - 冲突仲裁单执行率 100%
  - 漏检率 <= 5%，误报率 <= 10%

### Phase C：运营化（Round 6-7）

- 目标：SOP 定版 + KPI 运营 + 自动化审计门禁。
- 入口条件：Phase B 出口条件全部满足。
- 出口条件：
  - R2.0 定版
  - 自动化审计流水线可阻断失败发布
  - 季度复训机制已落地

## 3. 关键路径（必须严格顺序）

1. 规则冻结（Rule Master）
2. 编写产出（Writer）
3. 规则核验（Checker）
4. 审计裁决（Auditor）
5. 回归门禁（测试命令）

任一步失败，禁止进入下一步。

## 4. 并行优化策略（减少互相等待）

- `Writer` 与 `Checker` 可并行迭代，但都不得越过规则版本边界。
- `Auditor` 提前介入抽检，不等到末尾才发现流程缺陷。
- 每角色 WIP 上限：同一时间最多 2 个任务，防止积压。

## 5. 执行节奏（建议）

- 每日：15 分钟站会，只报阻断项与风险。
- 每周：一次回归健康检查（测试 + 指标）。
- 每月：一次 KPI 复盘。
- 每季度：一次 Round 6 级别复训与认证复核。

## 6. 文档导航

- 总手册：`docs/agent-training-frontend-writer.md`
- 规则模板：`docs/rulebook-r1-template.md`
- Round 1：`docs/training-tasks-round1.md`
- Round 2：`docs/training-tasks-round2.md`
- Round 3：`docs/training-tasks-round3.md`
- Round 4：`docs/training-tasks-round4.md`
- Round 5：`docs/training-tasks-round5.md`
- Round 6：`docs/training-tasks-round6.md`
- Round 7：`docs/training-tasks-round7.md`

## 7. 模板导航

- 规则变更单：`docs/rule-change-request-template.md`
- 审计抽检清单：`docs/audit-sampling-checklist.md`
- 发布运行手册：`docs/release-runbook-template.md`
- 红队审计模板：`docs/red-team-audit-template.md`
- 毕业认证模板：`docs/agent-certification-template.md`
- KPI 面板模板：`docs/ops-kpi-dashboard-template.md`
- 自动化审计流水线：`docs/automated-audit-pipeline-template.md`

## 8. 通用门禁命令

```bash
cd frontend && npm test
cd frontend && BULK_SEED_COUNT=100 npx vitest run engine-random
```

## 9. 全局阻断条件（任一触发即 reject）

- critical 规则违规未关闭
- 单调性/SOA/SOAP 完整性被破坏
- 证据链缺失或不可追溯
- 回归未跑完或结果不通过

## 10. 本周落地清单（立即执行）

1. 按 Phase A 启动，先完成 R1 规则冻结。
2. 跑 Round 1 全流程并留档。
3. 跑 Round 2（含规则变更单 + 失败复盘卡）。
4. 连续 3 次回归全绿后，再进入 Phase B。

