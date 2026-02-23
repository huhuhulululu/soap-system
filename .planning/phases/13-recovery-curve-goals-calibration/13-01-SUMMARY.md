---
phase: 13-recovery-curve-goals-calibration
plan: 01
subsystem: generator
tags: [goals-calculator, chronic-aware, recovery-curve, tdd]

requires:
  - phase: 12-fixture-snapshots-parity-audit
    provides: normalizeGenerationContext, 30 fixture snapshots baseline
provides:
  - Chronic-aware caps on pain, strength, ROM goals in goals-calculator
  - CHRONIC_END_RATIO constant for chronic pain LT calculation
  - chronicAware parameter on calculateDynamicGoals (backward compatible)
affects: [13-02, 13-03, 14-assessment-reflection]

tech-stack:
  added: []
  patterns: [chronic-aware goal caps, optional boolean parameter for backward compat]

key-files:
  created:
    - src/generator/goals-calculator.test.ts
  modified:
    - src/generator/goals-calculator.ts
    - src/generator/soap-generator.ts

key-decisions:
  - "CHRONIC_END_RATIO = 0.55 yields ~38-50% pain improvement for chronic patients (clinically realistic)"
  - "Chronic strength capped at 4/5 — chronic patients rarely achieve full recovery"
  - "Chronic ROM uses separate severity map with lower ceilings (max 70% for mod-severe)"

patterns-established:
  - "chronicAware optional boolean param pattern: defaults false, preserves backward compat"

requirements-completed: [CRV-02]

duration: 3min
completed: 2026-02-23
---

# Phase 13 Plan 01: Chronic-Aware Goals Caps Summary

**Chronic-aware caps on calculateDynamicGoals: pain LT uses CHRONIC_END_RATIO=0.55 (30-50% improvement), strength capped at 4/5, ROM capped via conservative severity map**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T04:51:33Z
- **Completed:** 2026-02-23T04:54:06Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Chronic pain LT target reflects 30-50% improvement (not 75%) via CHRONIC_END_RATIO = 0.55
- Chronic strength LT capped at 4/5 (never 4+)
- Chronic ROM uses conservative severity-based map (max 70% for moderate-to-severe)
- Non-chronic behavior completely unchanged (backward compatible)
- 9 unit tests covering all chronic vs non-chronic scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing tests for chronic-aware goals caps** - `d23e72b` (test)
2. **Task 2: GREEN — Implement chronic-aware caps + wire caller** - `c4e22dd` (feat)

_TDD plan: RED → GREEN cycle. No REFACTOR needed — implementation is clean._

## Files Created/Modified
- `src/generator/goals-calculator.test.ts` - 9 unit tests for chronic vs non-chronic goal calculation
- `src/generator/goals-calculator.ts` - CHRONIC_END_RATIO, chronicAware param on pain/strength/ROM/dynamic goals
- `src/generator/soap-generator.ts` - Passes chronicityLevel === 'Chronic' flag to calculateDynamicGoals

## Decisions Made
- CHRONIC_END_RATIO = 0.55 — yields ceil(8*0.55)=5 for pain 8, ceil(10*0.55)=6 for pain 10 (clinically realistic)
- Chronic strength uses separate format function that caps at '4' instead of '4+'
- Chronic ROM map: severe 60%, mod-severe 70%, moderate 60%, mild-to-moderate 55%, mild 55%

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for 13-02: Chronic dampener on engine progress curve + ltFallback alignment
- CHRONIC_END_RATIO and chronicAware pattern established for reuse in tx-sequence-engine

---
*Phase: 13-recovery-curve-goals-calibration*
*Completed: 2026-02-23*
