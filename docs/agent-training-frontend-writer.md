# Frontend 编写功能 Agent 培训手册

## 1. 目标

训练一个能在本项目中稳定改造“编写”功能（`/writer`）的工程型 Agent，要求：

- 能定位并修改前端 UI 与生成链路。
- 不破坏 SOAP 生成规则与 TX 纵向一致性。
- 每次改动都能通过现有测试门禁。

---

## 2. 项目最小地图（只看与编写功能相关）

- 前端入口与路由：
  - `frontend/src/App.vue`
  - `frontend/src/router/index.js`
- 编写页（手工参数生成 IE/TX）：
  - `frontend/src/views/WriterView.vue`
- 续写页（粘贴 IE/TX 文本后续写）：
  - `frontend/src/views/ContinueView.vue`
  - `frontend/src/services/generator.js`
- 生成核心（跨 frontend 引用）：
  - `src/generator/tx-sequence-engine.ts`
  - `src/generator/soap-generator.ts`
- 规则/白名单：
  - `frontend/src/data/whitelist.json`
  - `src/parser/template-rule-whitelist.browser.ts`
  - `src/parser/template-logic-rules.ts`
- 回归测试：
  - `frontend/src/engine.test.ts`
  - `frontend/src/engine-random.test.ts`
  - `frontend/src/medical-history.test.ts`

---

## 3. 编写功能真实调用链

`WriterView.vue` 中用户输入参数后，调用链为：

1. 组装 `generationContext`（noteType、bodyPart、pain、病史等）。
2. 组装 `initialState`（pain/frequency/symptomScale/painTypes/associatedSymptom）。
3. 调 `generateTXSequenceStates(...)` 生成 TX 状态序列。
4. 用 `exportSOAPAsText(context, state)` 产出文本。
5. UI 展示与复制（分段复制、整段复制、seed 复现）。

关键点：

- `setWhitelist(whitelist)` 必须在页面初始化后可用，否则规则选项会缺失。
- `WriterView` 有一部分“推导字段”不走常规动态字段列表，改 UI 时要保留。
- seed 是可复现能力核心，不要破坏 `generate/regenerate/copySeed` 路径。

---

## 4. Agent 必须遵守的硬约束

1. 不要绕过 `tx-sequence-engine` 直接手写 TX 文本逻辑。
2. 不要在前端随意新增默认值覆盖用户输入（pain/duration/radiation/painTypes 等）。
3. 不要破坏 TX 单调性预期：
   - pain、severity、frequency、spasm、symptomScale 纵向不升；
   - progress 纵向不减。
4. 不要破坏 SOA 链一致性（S/O/A 语义联动）。
5. 改动白名单字段时，必须同时检查：
   - `WriterView` 字段渲染/分组；
   - `generationContext` 映射；
   - 相关测试断言。
6. 对“仅 TX 续写模式”保留推断逻辑，不可回退到必须有 IE 的强依赖。

---

## 5. 标准改动流程（给 Agent 执行）

1. 先读代码，再改代码：
   - `frontend/src/views/WriterView.vue`
   - `frontend/src/services/generator.js`
   - `src/generator/tx-sequence-engine.ts`
   - `src/generator/soap-generator.ts`
2. 改动尽量收敛在一个链路层（UI 层或引擎层），避免跨层混改。
3. 如需新增字段，先确认字段来源：
   - 是否在 `whitelist.json`；
   - 是否需要进入 `generationContext`；
   - 是否属于 `initialState` 继承字段。
4. 跑回归测试（至少以下命令）：
   - `cd frontend && npm test`
   - `cd frontend && BULK_SEED_COUNT=100 npx vitest run engine-random`
5. 输出变更说明时必须包含：
   - 改动文件清单；
   - 行为变化；
   - 风险点；
   - 测试结果。

---

## 6. 训练 Agent 的推荐系统提示词（可直接用）

```text
你是本仓库 frontend 编写功能（/writer）的维护 Agent。你的目标是在不破坏 SOAP 生成规则的前提下完成需求。

工作边界：
1) 编写功能主入口在 frontend/src/views/WriterView.vue；
2) 生成核心在 src/generator/tx-sequence-engine.ts 与 src/generator/soap-generator.ts；
3) 续写能力在 frontend/src/services/generator.js 与 frontend/src/views/ContinueView.vue。

强制规则：
- 不能绕过 generateTXSequenceStates/exportSOAPAsText。
- 不能引入与用户输入冲突的硬编码默认值。
- 必须保持 TX 纵向一致性（pain/severity/frequency/spasm/symptomScale 不上升，progress 不下降）。
- 必须保持 SOA 链逻辑一致。
- 每次改动后运行 frontend 测试并汇报结果。

执行方式：
- 先定位调用链和受影响字段，再修改最小闭环代码。
- 优先补充或更新现有测试，不新增无必要架构。
- 输出必须包含: 改动文件、行为变化、潜在风险、测试命令与结果。
```

---

## 7. 训练任务建议（从易到难）

1. UI 小改动：
   - 在 `WriterView` 增加一个现有字段的展示或复制交互，不改引擎。
2. 字段贯通改动：
   - 新增一个已有白名单字段到 `generationContext`，并验证 IE/TX 文本体现。
3. 续写链路改动：
   - 在 `generator.js` 的 `parseSummary` 增加一个可观测字段，不影响生成。
4. 引擎策略微调：
   - 在不破坏单调性的前提下微调某个趋势规则，并补测试。
5. 稳定性压测：
   - 执行 `BULK_SEED_COUNT=100/500`，定位失败模式并修复。

---

## 8. 验收标准

- 功能正确：目标行为在 `/writer` 或 `/continue` 页面可复现。
- 文本质量：S/O/A/P 完整，字段与输入一致。
- 纵向一致：随机测试与 bulk 测试通过。
- 可维护性：改动集中、注释简洁、无无关重构。

---

## 9. 多代理并行优化（规则驱动分工）

### 9.1 角色拆分（按你的业务链路）

- `规则掌握者`（Rule Master）
  - 维护“规则真相源”，定义可执行规则与禁改红线。
  - 对应资产：规则文档、白名单、单调性/SOA 规则清单。
- `编写者`（Writer）
  - 按规则生产 SOAP 内容与前端生成行为，不解释规则本身。
  - 对应资产：`WriterView`、生成参数映射、生成调用链。
- `检查者`（Checker）
  - 逐条核对产出是否符合规则，输出违规点与证据。
  - 对应资产：检查逻辑、校验用例、失败样本。
- `审计员`（Auditor）
  - 监督三者执行质量，审核流程完整性与最终可发布性。
  - 对应资产：审计基线、覆盖率、最终放行/驳回结论。

### 9.2 并行与串行关系（关键）

- 并行：
  - `编写者` 与 `检查者` 可并行迭代（边产出边核对）。
- 串行门禁：
  - `规则掌握者` 必须先冻结本轮规则版本；
  - `审计员` 必须最后签字放行。

### 9.3 单轮执行协议（固定顺序）

1. `规则掌握者` 发布本轮规则版本与禁改项。
2. `编写者` 按该版本实现/修改产出。
3. `检查者` 逐条对照规则核验并回传违规清单。
4. `编写者` 修复违规项并回交。
5. `审计员` 复核全链路证据并给出“放行/驳回”。

### 9.4 四角色交付契约（统一格式）

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

### 9.5 审计硬门槛（不满足即驳回）

- 任一规则无证据可追溯。
- 出现 TX 单调性破坏或 SOA 链断裂。
- 生成文本缺失 S/O/A/P 任一段。
- 测试未覆盖核心链路（`engine.test` / `engine-random` / `medical-history`）。

---

## 10. 多代理调度提示词（可直接复制）

```text
你是调度器。请按“规则驱动 4 角色”组织并行协作：规则掌握者、编写者、检查者、审计员。

目标：在不破坏 SOAP 规则的前提下完成需求，并保证可回归。

硬性约束：
1) 规则掌握者先冻结规则版本，再允许其余角色执行
2) 编写者只能按规则产出，不可私改规则
3) 检查者必须逐条核对并给出证据
4) 审计员必须基于证据给出 pass/reject
5) 所有角色禁止绕过 generateTXSequenceStates/exportSOAPAsText
6) 必须保持 TX 单调性和 SOA 链一致性

输出要求：
- 每个角色按统一契约回传：rule_version/input/output/violations/evidence/risk
- 审计员最终输出：放行结论、阻断原因、需返工项
```
