# Baseline at cb77431 (pre-Phase 4)

captured: 2026-04-20

## npm test
- Total: 96 suites / 2152 tests
- **Failing suites (9)**:
  1. src/generator/__tests__/negative-events-toggle.test.ts
  2. src/generator/__tests__/goal-driven-engine.test.ts
  3. src/generator/__tests__/granularity-phase-e.test.ts
  4. src/generator/__tests__/toggle-audit.test.ts
  5. src/generator/__tests__/objective-html.test.ts
  6. server/__tests__/batch-generator-compose.test.ts (suite load failure — TS err in soap-producer.ts)
  7. server/__tests__/soap-producer.test.ts (suite load failure)
  8. server/__tests__/api-routes.test.ts (suite load failure)
  9. server/__tests__/auth.test.ts (suite load failure)
- **Failing tests (7)**:
  - Negative events toggle (allowNegativeEvents) › on: allows negative events ≤ 10%
  - Goal-Driven Engine Integration › start=3 (Constant) should end within Frequent/Occasional, never Intermittent
  - Goal-Driven Engine Integration › start=1 (Occasional) should converge to Intermittent only
  - Goal-Driven Engine Integration › start=0 (Intermittent) should stay at Intermittent
  - 阶段E: Frequency 阈值调优 › 20-visit 序列中 frequency 唯一值 ≥ 3
  - 阶段E: Frequency 阈值调优 › Frequency 首次变化不晚于 visit 12
  - Audit: allowNegativeEvents=ON › negative events exist but ≤ 10%
- Snapshots: 42 passed

## tsc --noEmit
- 25 errors (all in `scripts/*.ts` + `server/services/soap-producer.ts`)
- 0 errors in `src/**` or `parsers/**` or test files

## AC8/AC9 语义
- AC8: final failing set ⊆ {above 9 suites / 7 tests}；新增测试全绿
- AC9: final tsc errors ≤ 25；allowed_writes 新文件 tsc 0 error
