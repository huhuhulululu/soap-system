# SOAP 四代理训练总索引

## 1. 训练目标

- 建立可持续的四角色协作链：规则掌握者 -> 编写者 -> 检查者 -> 审计员。
- 保证三条核心红线始终不破：
  - TX 单调性（pain/severity/frequency/spasm/symptomScale 不升，progress 不降）
  - SOA 链一致性（S/O/A 语义联动，O 改善时 A 不得写 `remained the same`）
  - S/O/A/P 完整性（IE/TX 文本必须包含四段）

## 2. 四角色交付契约（贯穿所有 Round）

每个角色每轮产出必须遵循统一格式（详见总手册 9.4 节）：

```text
[role]
rule_version: <规则版本号>
input: <输入范围>
output: <产出>
violations: <违规列表/无>
evidence: <文件/测试/日志>
risk: <风险>
decision: <仅审计员填写: pass/reject>
```

Round 1 证据行格式：`rule_id | file | test_or_text_snippet | pass/fail | reason`

## 3. 规则版本演进路线

```
R1（Round 1）
 └─ R1.1（Round 2：至少 3 条变更 + 变更单）
     └─ R1.2（Round 4：仅小幅调整 + 高风险标注）
         └─ R1.3-hotfix（Round 5：临时约束补丁，附回收条件）
             └─ R2.0（Round 6：整合所有 R1.x 有效变更，清理临时 hotfix）
                 └─ KPI v1（Round 7：运营指标口径定版）
```

每次版本升级必须提交规则变更单（`docs/rule-change-request-template.md`）。

## 4. 三阶段推进

### Phase A：基础闭环（Round 1-2）

- 目标：统一规则口径与证据格式，跑通单轮闭环。
- 入口条件：
  - `docs/rulebook-r1-template.md` 已填写并冻结
  - 各 Round 任务模板已创建
- 出口条件：
  - R1.1 规则版本可追溯，变更单已归档
  - 至少完成 3 轮 pass/reject 演练（含至少 1 次 reject + 返工闭环）
  - 回归命令连续 3 次全绿
- 失败处理：原地修复，不回退。审计员出具阻断项清单，Writer/Checker 逐项关闭后重新提交。

### Phase B：并行与抗压（Round 3-5）

Round 3（并行冲突）→ Round 4（发布回滚）→ Round 5（红队对抗），三轮递进关系：
- Round 3 验证多任务并行下规则不漂移
- Round 4 验证发布流程（灰度 10%→50%→100% + 回滚演练）在压力下可控
- Round 5 用对抗样本和故障注入压测整个链路韧性

- 入口条件：Phase A 出口条件全部满足。
- 出口条件：
  - 并行 A/B/C 任务均有独立证据链
  - 冲突仲裁单执行率 100%
  - 回滚演练成功且可复现
  - 漏检率 <= 3%，误报率 <= 10%（以 Round 5 放行条件为准）
  - 红队审计报告完整且可追溯
- 失败处理：
  - 单 Round 失败：修复后重跑该 Round，不跳过。
  - 若连续 2 轮同类问题（如漏检率超标），回退到 Phase A 补训相关角色。

### Phase C：运营化（Round 6-7）

- 目标：SOP 定版 + KPI 运营 + 自动化审计门禁。
- 入口条件：Phase B 出口条件全部满足。
- 出口条件：
  - R2.0 定版，无未归档临时规则
  - 四角色毕业评分均 >= 80/100，审计员错误放行率 = 0（见认证模板）
  - 自动化审计流水线可在 PR/合并/发布三个节点阻断失败
  - KPI v1 发布并完成基线采样
  - 季度复训机制已落地：有明确的复训日期、复训内容、认证复核流程
- 失败处理：
  - 毕业考核不通过：审计员出具 `remediation_plan` + `retest_date`，补训后重考。
  - KPI 基线不达标：延长 Phase C 运行周期，不进入正式运营。

## 5. 关键路径（每轮必须严格顺序）

1. 规则冻结（Rule Master）
2. 编写产出（Writer）
3. 规则核验（Checker）
4. 审计裁决（Auditor）
5. 回归门禁（测试命令）

任一步失败，禁止进入下一步。失败后的处理：
- 步骤 1 失败：规则版本有歧义或缺失 → Rule Master 重新发布并通知全员。
- 步骤 2-3 失败：Writer 修复 → Checker 复检 → 循环直到违规清单关闭。
- 步骤 4 失败：Auditor 出具阻断项 → 回到步骤 2 返工。
- 步骤 5 失败：定位失败测试 → 出复盘卡（Round 2+ 模板）→ 修复后重跑。

## 6. 争议升级路径

- Checker 与 Writer 对违规判定有分歧 → Rule Master 裁决（引用规则条文）。
- Checker 与 Auditor 结论不一致 → Auditor 有最终裁决权，但必须书面说明理由。
- Rule Master 的规则本身有争议 → 提交规则变更单走正式流程，当前轮次按现行版本执行。

## 7. 并行优化策略

- Writer 与 Checker 可并行迭代，但都不得越过规则版本边界。
- Auditor 提前介入抽检（Round 3+ 抽检率 >= 30%），不等到末尾才发现流程缺陷。
- 每角色 WIP 上限：同一时间最多 2 个任务，防止积压。

## 8. 角色 Onboarding

新角色入场顺序：

1. 读总手册：`docs/agent-training-frontend-writer.md`（含项目地图、调用链、硬约束）
2. 读规则模板：`docs/rulebook-r1-template.md`（理解规则格式与种子规则）
3. 读当前规则版本（Rule Master 提供最新冻结版本号）
4. 读本索引第 2 节（交付契约格式）
5. 从当前 Phase 对应的最低 Round 开始参与

系统提示词（可直接用）：见总手册第 6 节（单角色）和第 10 节（调度器）。

## 9. 执行节奏

- 每日：15 分钟站会，只报阻断项与风险。
- 每周：一次回归健康检查（测试 + 指标）。
- 每月：一次 KPI 复盘（参照 `docs/ops-kpi-dashboard-template.md`）。
- 每季度：一次 Round 6 级别复训与认证复核。

## 10. KPI 基线目标（Phase C 生效）

| 类别 | 指标 | 目标 |
|------|------|------|
| 质量 | critical 漏检数 | 0 |
| 质量 | high 漏检率 | < 3% |
| 质量 | 误报率 | < 10% |
| 质量 | 审计错误放行率 | 0 |
| 质量 | 回归失败率 | < 2% |
| 效率 | 单需求平均闭环时长 | 按团队基线 |
| 效率 | Writer 首次通过率 | 按团队基线 |
| 风险 | hotfix 次数 | 趋势下降 |
| 风险 | 审计阻断次数 | 趋势下降 |

详见 `docs/ops-kpi-dashboard-template.md`。

## 11. 文档导航

- 总手册（项目地图 + 调用链 + 硬约束 + 提示词）：`docs/agent-training-frontend-writer.md`
- 规则模板：`docs/rulebook-r1-template.md`

| Round | 文档 | Phase | 核心机制 |
|-------|------|-------|----------|
| 1 | `docs/training-tasks-round1.md` | A | 基础分工与闭环 |
| 2 | `docs/training-tasks-round2.md` | A | 规则变更 + 失败复盘 |
| 3 | `docs/training-tasks-round3.md` | B | 并行任务 + 冲突仲裁 |
| 4 | `docs/training-tasks-round4.md` | B | 灰度发布 + 回滚演练 |
| 5 | `docs/training-tasks-round5.md` | B | 异常注入 + 红队审计 |
| 6 | `docs/training-tasks-round6.md` | C | SOP 定版 + 毕业考核 |
| 7 | `docs/training-tasks-round7.md` | C | KPI 运营 + 自动化审计 |

## 12. 模板导航

| 模板 | 文档 | 首次使用 |
|------|------|----------|
| 规则变更单 | `docs/rule-change-request-template.md` | Round 2（R1→R1.1） |
| 回归失败复盘卡 | 内嵌于 `docs/training-tasks-round2.md` | Round 2 |
| 规则冲突仲裁单 | 内嵌于 `docs/training-tasks-round3.md` | Round 3 |
| 审计抽检清单 | `docs/audit-sampling-checklist.md` | Round 3（抽检率 >= 30%） |
| 发布运行手册 | `docs/release-runbook-template.md` | Round 4（灰度 + 回滚） |
| 红队审计模板 | `docs/red-team-audit-template.md` | Round 5 |
| 毕业认证模板 | `docs/agent-certification-template.md` | Round 6（评分 >= 80） |
| KPI 面板模板 | `docs/ops-kpi-dashboard-template.md` | Round 7 |
| 自动化审计流水线 | `docs/automated-audit-pipeline-template.md` | Round 7（PR/合并/发布触发） |

## 13. 通用门禁命令

```bash
cd frontend && npm test
cd frontend && BULK_SEED_COUNT=100 npx vitest run engine-random
```

自动化门禁（Phase C）：见 `docs/automated-audit-pipeline-template.md`，在 PR 创建、合并到主分支、发布前灰度三个节点自动触发。

## 14. 全局阻断条件（任一触发即 reject）

- critical 规则违规未关闭
- TX 单调性被破坏（pain/severity/frequency/spasm/symptomScale 上升或 progress 下降）
- SOA 链断裂（O 与 A 语义矛盾）
- S/O/A/P 任一段缺失
- 证据链缺失或不可追溯（无 rule_id、无文件路径、无测试断言）
- 回归未跑完或结果不通过
- 规则版本漂移（实现版本与冻结版本不一致）
