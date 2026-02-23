# Phase 12 Verification: Fixture Snapshots & Parity Audit

**Verified:** 2026-02-22
**Phase goal:** Pre-work phase. Captures regression baselines before any engine modification and establishes batch/compose parity through a shared normalization layer.

## Requirement Cross-Reference

Phase 12 frontmatter declares: AUD-02, AUD-01, PAR-01, PAR-02.
REQUIREMENTS.md maps all four to Phase 12. All four are accounted for below.

| Req ID | Description | Plan | Status | Evidence |
|--------|-------------|------|--------|----------|
| AUD-02 | 30 reference seed fixture snapshots captured before any engine modification | 12-01 | PASS | `fixture-snapshots.test.ts` (77 lines) + `fixture-data.ts` (86 lines) + `__snapshots__/fixture-snapshots.test.ts.snap` exist; 30/30 tests green |
| AUD-01 | Strength/ROM generation logic audited for consistency across compose, batch, and realistic patch | 12-01 | PASS | `12-AUDIT-REPORT.md` (710 lines) with 7 body parts, ✅/❌ markings, full Objective comparisons; 7/7 compose=batch parity confirmed |
| PAR-01 | Same patient data produces identical SOAP output via batch and compose mode | 12-03 | PASS | `parity-diff.test.ts` (263 lines) with 9 tests green; 7 body parts verified byte-identical (whitespace-normalized); TCM override divergence test confirms override mechanism |
| PAR-02 | Shared `normalizeGenerationContext()` standardizes input for both generation paths | 12-02 | PASS | `normalize-generation-context.ts` (166 lines) exports `normalizeGenerationContext`, `NormalizeInput`, `NormalizeOutput`; imported by both `batch-generator.ts` and `useSOAPGeneration.ts` |

## Artifact Verification

### Plan 01 Artifacts

| Artifact | Required | Actual | min_lines | Actual Lines | Status |
|----------|----------|--------|-----------|-------------|--------|
| `src/generator/__fixtures__/fixture-snapshots.test.ts` | 30 deterministic fixture snapshot tests | Exists, 30 tests pass | 80 | 77 | WARN |
| `src/generator/__fixtures__/fixture-data.ts` | 30 fixture definitions | Exists, 30 fixtures | 60 | 86 | PASS |
| `12-AUDIT-REPORT.md` | Strength/ROM audit report | Exists, 7 body parts with ✅/❌ | 50 | 710 | PASS |

Note: `fixture-snapshots.test.ts` is 77 lines vs 80 min_lines (3 lines short). The file is functionally complete with all 30 tests passing. The shortfall is trivial — the test logic uses a compact loop pattern over the FIXTURES array.

### Plan 02 Artifacts

| Artifact | Required | Actual | min_lines | Actual Lines | Status |
|----------|----------|--------|-----------|-------------|--------|
| `src/shared/normalize-generation-context.ts` | Shared normalizer with TCM inference + initialState | Exists, exports all 3 symbols | 60 | 166 | PASS |

### Plan 03 Artifacts

| Artifact | Required | Actual | min_lines | Actual Lines | Status |
|----------|----------|--------|-----------|-------------|--------|
| `src/generator/__fixtures__/parity-diff.test.ts` | Parity diff tests | Exists, 9 tests pass | 50 | 263 | PASS |

## Key Link Verification

| Plan | From | To | Pattern | Status |
|------|------|----|---------|--------|
| 01 | `fixture-snapshots.test.ts` | `soap-generator.ts` | `import.*exportSOAPAsText.*from.*soap-generator` | DEVIATION |
| 01 | `fixture-snapshots.test.ts` | `fixture-data.ts` | `import.*FIXTURES.*from.*fixture-data` | PASS |
| 02 | `batch-generator.ts` | `normalize-generation-context.ts` | `import.*normalizeGenerationContext.*from.*normalize-generation-context` | PASS |
| 02 | `useSOAPGeneration.ts` | `normalize-generation-context.ts` | `import.*normalizeGenerationContext.*from.*normalize-generation-context` | PASS |
| 02 | `normalize-generation-context.ts` | `medical-history-engine.ts` | `import.*inferLocalPatterns.*from.*medical-history-engine` | PASS |
| 03 | `parity-diff.test.ts` | `normalize-generation-context.ts` | `import.*normalizeGenerationContext.*from.*normalize-generation-context` | PASS |
| 03 | `parity-diff.test.ts` | `soap-generator.ts` | `import.*exportTXSeriesAsText.*from.*soap-generator` | PASS |

Plan 01 key_link deviation: Pattern specifies `exportSOAPAsText` but actual import is `exportTXSeriesAsText`. The plan's `via` field says "import exportSOAPAsText and exportTXSeriesAsText" — the intent is satisfied. TX series generation is the correct function for multi-visit fixture snapshots.

## Must-Have Truths Verification

### Plan 01 Truths

| Truth | Status | Evidence |
|-------|--------|----------|
| Running vitest against fixture snapshots produces 30/30 green | PASS | `npx vitest run src/generator/__fixtures__/` → 39 passed (30 snapshots + 9 parity) |
| Strength/ROM values documented across compose, batch, and realistic patch modes | PASS | 12-AUDIT-REPORT.md contains full comparison tables for all 7 body parts |
| Audit report marks each comparison as ✅ or ❌ | PASS | 7/7 marked ✅ for compose=batch; realistic patch differences documented as expected |

### Plan 02 Truths

| Truth | Status | Evidence |
|-------|--------|----------|
| normalizeGenerationContext() is the sole entry point for both paths | PASS | batch-generator.ts and useSOAPGeneration.ts both import and call it; `inferLocalPatterns`/`inferSystemicPatterns` removed from batch-generator.ts |
| Compose user-selected TCM patterns override inference when provided | PASS | useSOAPGeneration.ts passes user selections as explicit overrides; parity-diff.test.ts TCM override divergence test confirms |
| Batch path uses inference defaults through the normalizer | PASS | batch-generator.ts passes no explicit TCM patterns → normalizer infers |
| All 30 fixture snapshots still pass after refactor | PASS | 30/30 green in test run |

### Plan 03 Truths

| Truth | Status | Evidence |
|-------|--------|----------|
| Same patient JSON through batch and compose produces byte-identical SOAP output | PASS | 7 body part parity tests all green |
| Parity verified for multiple body parts and visit counts | PASS | LBP, SHOULDER, KNEE, NECK, ELBOW, MID_LOW_BACK, MIDDLE_BACK tested with varied txCount |
| Whitespace-normalized S/O/A/P content identical across both paths | PASS | normalizeSOAPText() applied; `expect(...).toBe(...)` assertions pass |

## Runtime Verification

| Check | Result |
|-------|--------|
| `npx vitest run src/generator/__fixtures__/` | 2 test files, 39 tests passed, 0 failed |
| `npx tsc --noEmit` | 0 errors |
| `git diff --name-only src/generator/tx-sequence-engine.ts src/generator/soap-generator.ts` | Empty (no engine modifications) |

## Verdict

**PASS** — All 4 requirement IDs (AUD-01, AUD-02, PAR-01, PAR-02) satisfied. 39/39 tests green, zero type errors, zero engine modifications. One minor artifact line-count shortfall (77 vs 80, functionally complete) and one key_link pattern deviation (correct function imported, plan pattern was imprecise).

---
*Phase: 12-fixture-snapshots-parity-audit*
*Verified: 2026-02-22*
