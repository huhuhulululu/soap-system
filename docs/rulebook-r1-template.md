# R1 Rulebook (SOAP Writer/Checker)

## Meta

- rule_version: R1
- owner: Rule Master
- effective_date: YYYY-MM-DD
- scope: `/writer` `/continue` + generator core

## Rule Format

- rule_id: `X-001`
- category: `S|O|A|P|X`
- title: 简短规则名
- description: 可执行规则描述
- severity: `critical|high|medium|low`
- source_of_truth: file path(s)
- verification_method: test name / deterministic check
- evidence_example: 文本片段或断言示例
- forbidden_change: 禁止的改法
- notes: 备注

## Seed Rules (初始化建议)

- rule_id: `X-001`
- category: `X`
- title: TX pain 单调不升
- description: TX 序列中 `painScaleCurrent` 不得上升
- severity: `critical`
- source_of_truth: `src/generator/tx-sequence-engine.ts`, `frontend/src/engine-random.test.ts`
- verification_method: engine-random monotonic tests
- evidence_example: `states[i].painScaleCurrent <= states[i-1].painScaleCurrent`
- forbidden_change: 在后期 visit 强制提高 pain

- rule_id: `X-002`
- category: `X`
- title: Severity 单调不升
- description: `severityLevel` 不得较前一访视变重
- severity: `critical`
- source_of_truth: `src/generator/tx-sequence-engine.ts`, `frontend/src/engine-random.test.ts`
- verification_method: `SEVERITY_ORDER` 比较
- evidence_example: `idx(cur) <= idx(prev)`
- forbidden_change: 手工覆盖 severity 与 pain 关系

- rule_id: `X-003`
- category: `X`
- title: SOA 链一致
- description: Objective 改善时 Assessment 不得写 `remained the same`
- severity: `high`
- source_of_truth: `src/generator/tx-sequence-engine.ts`, `frontend/src/engine-random.test.ts`
- verification_method: `soaChain` 联动断言
- evidence_example: `romTrend!=stable => physicalChange!=remained the same`
- forbidden_change: A 段固定模板不看 O 段状态

- rule_id: `X-004`
- category: `X`
- title: S/O/A/P 完整性
- description: IE/TX 文本必须包含 `Subjective`/`Objective`/`Assessment`/`Plan`
- severity: `critical`
- source_of_truth: `src/generator/soap-generator.ts`, `frontend/src/engine-random.test.ts`
- verification_method: keyword + length check
- evidence_example: `tx.includes('Subjective')...`
- forbidden_change: 返回截断文本

- rule_id: `S-001`
- category: `S`
- title: 用户输入优先
- description: pain/duration/radiation/painTypes 必须体现用户输入或合法继承
- severity: `critical`
- source_of_truth: `frontend/src/views/WriterView.vue`, `frontend/src/engine.test.ts`
- verification_method: IE/TX 文本包含断言
- evidence_example: `Current: {inputPain}`
- forbidden_change: 硬编码默认值覆盖输入

