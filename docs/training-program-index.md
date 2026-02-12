# SOAP 四代理训练总索引（Round 1-7）

## 1. 目标

本索引用于统一管理四代理训练体系：

- 角色：规则掌握者 / 编写者 / 检查者 / 审计员
- 流程：规则冻结 -> 编写 -> 检查 -> 审计
- 结果：可持续生产、检查、监督 SOAP note 产出

## 2. 执行顺序（建议）

1. 先读总手册：`docs/agent-training-frontend-writer.md`
2. 初始化规则：`docs/rulebook-r1-template.md`
3. 按轮次训练：Round 1 -> Round 7
4. 每轮使用对应模板产出证据与结论
5. 审计员按放行条件做 `pass/reject`

## 3. 轮次导航

- Round 1（基础分工与闭环）：`docs/training-tasks-round1.md`
- Round 2（规则变更与失败复盘）：`docs/training-tasks-round2.md`
- Round 3（并行任务与冲突仲裁）：`docs/training-tasks-round3.md`
- Round 4（灰度发布与回滚演练）：`docs/training-tasks-round4.md`
- Round 5（异常注入与红队审计）：`docs/training-tasks-round5.md`
- Round 6（SOP 定版与毕业考核）：`docs/training-tasks-round6.md`
- Round 7（长期运营与自动化审计）：`docs/training-tasks-round7.md`

## 4. 模板导航

- 规则变更单：`docs/rule-change-request-template.md`
- 审计抽检清单：`docs/audit-sampling-checklist.md`
- 发布运行手册：`docs/release-runbook-template.md`
- 红队审计模板：`docs/red-team-audit-template.md`
- 毕业认证模板：`docs/agent-certification-template.md`
- KPI 面板模板：`docs/ops-kpi-dashboard-template.md`
- 自动化审计流水线：`docs/automated-audit-pipeline-template.md`

## 5. 每轮最小交付物（强制）

1. Rule Master：规则版本与变更说明
2. Writer：改动说明与测试结果
3. Checker：违规清单与证据
4. Auditor：放行/驳回结论与阻断项

## 6. 通用门禁命令

```bash
cd frontend && npm test
cd frontend && BULK_SEED_COUNT=100 npx vitest run engine-random
```

## 7. 全局放行标准

- critical 违规项全部关闭
- 单调性/SOA/SOAP 完整性无破坏
- 审计证据链完整且可追溯
- 回归测试全绿

## 8. 维护建议

- 每次规则升级必须同步更新索引中“轮次与模板引用”。
- 每月做一次 KPI 回顾，每季度做一次 Round 6 级别复训。
- 发现流程漂移时，以审计结论为准回退到上个稳定流程版本。

