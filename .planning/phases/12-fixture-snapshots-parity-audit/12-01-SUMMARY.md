---
phase: 12-fixture-snapshots-parity-audit
plan: 01
subsystem: testing
tags: [vitest, snapshots, prng, mulberry32, regression, parity-audit]

requires:
  - phase: 11-form-ux-validation
    provides: stable SOAP generation engine with no pending modifications
provides:
  - 30 deterministic fixture snapshot tests covering 7 TX body parts × 3 visit phases + 9 edge cases
  - Strength/ROM parity audit report across compose, batch, and realistic patch modes
  - Regression safety net for Phases 13-14 engine modifications
affects: [13-recovery-curve-normalization, 14-assessment-engine, 15-batch-ux-overhaul]

tech-stack:
  added: []
  patterns: [fixed-seed PRNG snapshot testing, fixture-data separation from test logic]

key-files:
  created:
    - src/generator/__fixtures__/fixture-data.ts
    - src/generator/__fixtures__/fixture-snapshots.test.ts
    - src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap
    - .planning/phases/12-fixture-snapshots-parity-audit/12-AUDIT-REPORT.md
  modified: []

key-decisions:
  - "Replaced HIP fixtures with SHOULDER-bilateral — HIP not in SUPPORTED_TX_BODY_PARTS"
  - "Used same setWhitelist() from non-browser template-rule-whitelist.ts — engine imports from this module"
  - "Compose initialState passes undefined for tightness/tenderness/spasm to match real compose behavior"

patterns-established:
  - "Fixture-data separation: definitions in fixture-data.ts, tests in fixture-snapshots.test.ts"
  - "makeContext/makeOptions factory pattern for consistent fixture construction"

requirements-completed: [AUD-02, AUD-01]

duration: 12min
completed: 2026-02-22
---

# Phase 12 Plan 01: Fixture Snapshots & Parity Audit Summary

**30 deterministic SOAP engine snapshot tests + Strength/ROM audit report showing 7/7 parity across compose and batch modes**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- 30 fixture snapshot tests pass green, covering all 7 TX-supported body parts across early/mid/late visit phases plus 9 edge cases (max/min pain, single visit, pacemaker, medical history, realistic patch, MIDDLE_BACK)
- Strength/ROM audit report confirms 7/7 body parts produce identical values between compose and batch modes
- Realistic patch produces expected lower Strength/ROM values via steeper ROM curve

## Task Commits

1. **Task 1: Create 30 fixture definitions and snapshot tests** - `4cf0a5d` (test)
2. **Task 2: Generate Strength/ROM audit report across 3 modes** - `a008027` (docs)

## Files Created/Modified
- `src/generator/__fixtures__/fixture-data.ts` - 30 fixture definitions with seeds 100001-100030
- `src/generator/__fixtures__/fixture-snapshots.test.ts` - Snapshot test runner with makeContext/makeOptions factories
- `src/generator/__fixtures__/__snapshots__/fixture-snapshots.test.ts.snap` - Auto-generated baseline snapshots (930KB)
- `.planning/phases/12-fixture-snapshots-parity-audit/12-AUDIT-REPORT.md` - Full Strength/ROM comparison with ✅/❌ markings

## Decisions Made
- HIP is not in `SUPPORTED_TX_BODY_PARTS` — replaced 3 HIP fixtures with SHOULDER-bilateral (different laterality/pain from core SHOULDER-left fixtures)
- Audit shows Strength/ROM values are identical between compose and batch because they're computed from pain+progress in soap-generator.ts, not from tightness/tenderness/spasm initialState
- Known parity gaps (tightness/tenderness/spasm, TCM patterns) affect Muscle Testing section but not Strength/ROM

## Deviations from Plan

### Auto-fixed Issues

**1. HIP not supported for TX generation**
- **Found during:** Task 1 (fixture snapshot tests)
- **Issue:** Plan specified HIP as one of 7 core body parts, but HIP is only in SUPPORTED_IE_BODY_PARTS, not SUPPORTED_TX_BODY_PARTS
- **Fix:** Replaced 3 HIP fixtures (16-18) with SHOULDER-bilateral variants at pain 8
- **Verification:** All 30 tests pass green
- **Committed in:** 4cf0a5d

---

**Total deviations:** 1 auto-fixed (blocking — unsupported body part)
**Impact on plan:** Minimal — still covers 7 distinct body part configurations with varied laterality/pain

## Issues Encountered
None beyond the HIP deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 30 snapshot baselines locked — any engine modification in Phases 13-14 that shifts PRNG sequence will be immediately detected
- Audit report documents current parity state for reference during normalizer implementation
- Zero modifications to existing engine files confirmed

---
*Phase: 12-fixture-snapshots-parity-audit*
*Completed: 2026-02-22*
