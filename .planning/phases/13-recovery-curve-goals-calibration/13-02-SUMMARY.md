---
phase: 13-recovery-curve-goals-calibration
plan: 02
subsystem: generator
tags: [tx-sequence-engine, chronic-dampener, prng, recovery-curve]

requires:
  - phase: 12-fixture-snapshots-parity-audit
    provides: "30 fixture snapshots + normalizeGenerationContext()"
provides:
  - "chronicDampener (0.82) on progressMultiplier for txCount >= 16"
  - "chronicEndRatio (0.55) in ltFallback for txCount >= 16"
  - "Unit tests verifying chronic dampener behavior (5 tests)"
affects: [13-03-snapshot-regeneration, 14-assessment-reflection]

tech-stack:
  added: []
  patterns: ["pre-loop deterministic calculation for PRNG safety"]

key-files:
  created:
    - src/generator/tx-sequence-engine-chronic.test.ts
  modified:
    - src/generator/tx-sequence-engine.ts

key-decisions:
  - "Chronic threshold at txCount >= 16 (aligns with clinical chronic treatment length)"
  - "Dampener 0.82 slows S-curve without flattening it entirely"
  - "chronicEndRatio 0.55 matches goals-calculator chronic caps"

patterns-established:
  - "Pre-loop multiplicative dampener pattern: compute before for-loop, never add rng() inside loop"

requirements-completed: [CRV-01]

duration: 3min
completed: 2026-02-23
---

# Phase 13 Plan 02: Chronic Dampener on Engine Progress Curve Summary

**chronicDampener (0.82) slows progress curve for txCount >= 16, ltFallback uses 0.55 ratio for chronic patients**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T04:51:37Z
- **Completed:** 2026-02-23T04:54:08Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Chronic patients (txCount >= 16) now have dampened progress curve (0.82x multiplier)
- ltFallback aligned with goals-calculator chronic caps (0.55 ratio vs 0.25)
- Zero new rng() calls — PRNG sequence fully preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing tests for chronic dampener** - `4dc0b73` (test)
2. **Task 2: GREEN — Implement chronic dampener + ltFallback** - `7834e98` (feat)

## Files Created/Modified
- `src/generator/tx-sequence-engine-chronic.test.ts` - 5 unit tests for chronic dampener behavior
- `src/generator/tx-sequence-engine.ts` - chronicDampener + chronicEndRatio before for-loop

## Decisions Made
- Chronic threshold at txCount >= 16 (per plan specification)
- Both changes placed before the for-loop as pure deterministic calculations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 9 fixture snapshots fail due to changed ltFallback values for chronic seeds — expected, will be regenerated in plan 13-03.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 13-03 (snapshot regeneration + parity verification)
- Fixture snapshots need `--update` to capture new chronic curve values

---
*Phase: 13-recovery-curve-goals-calibration*
*Completed: 2026-02-23*
