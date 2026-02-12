# 四代理训练任务（Round 1）

## 执行说明

- 严格角色分工：规则掌握者 / 编写者 / 检查者 / 审计员
- 每个任务必须产出证据：`rule_id | file | test_or_text_snippet | pass/fail | reason`
- 推荐门禁命令：
  - `cd frontend && npm test`
  - `cd frontend && BULK_SEED_COUNT=100 npx vitest run engine-random`

## 12 个任务（首轮）

1. 规则掌握者：从 `frontend/src/engine-random.test.ts` 提取全部“单调性规则”，生成 `X-*` 编号清单。
2. 编写者：在 `frontend/src/views/WriterView.vue` 新增一个已存在字段展示，不改引擎。
3. 检查者：验证任务 2 是否触发任何 `S-001` 违规，给证据。
4. 审计员：审计任务 1-3 交付格式是否完整，给 `pass/reject`。
5. 编写者：将一个已有字段正确贯通到 `generationContext`，并在 IE 文本体现。
6. 检查者：核对该字段是否被硬编码覆盖，引用测试和文本证据。
7. 规则掌握者：新增“仅 TX 模式推断约束”规则条目，标记 severity。
8. 编写者：在 `frontend/src/services/generator.js` 的 `parseSummary` 增加可观测字段，不影响生成。
9. 检查者：跑 `npm test` 与 `BULK_SEED_COUNT=100 npx vitest run engine-random`，报告风险。
10. 审计员：审计第 5-9 步是否满足“规则先冻结再开发”。
11. 编写者：修复检查者指出的最高优先级 1 个违规点（最小改动）。
12. 审计员：最终裁决并输出“可发布/驳回 + 阻断项”。

