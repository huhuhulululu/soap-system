---
phase: 06-adaptive-timeouts
plan: "01"
subsystem: infra
tags: [playwright, timeouts, automation, mdland]

requires:
  - phase: 05-error-classification
    provides: classifyError and VisitResult types used by mdland-automation.ts

provides:
  - TIMEOUTS named constants object with 10 timeout values
  - TIMEOUT_MULTIPLIER env var support for scaling all timeouts
  - Zero hardcoded timeout numbers in mdland-automation.ts

affects: [07-retry-logic]

tech-stack:
  added: []
  patterns:
    - "All timeouts centralized in TIMEOUTS const, scaled by MULTIPLIER at module load"
    - "MULTIPLIER = parseFloat(env) with NaN fallback to 1"

key-files:
  created: []
  modified:
    - scripts/playwright/mdland-automation.ts

key-decisions:
  - "MULTIPLIER applied at const initialization (Math.round) so all TIMEOUTS values are pre-scaled integers"
  - "Removed timeout field from AutomationOptions — page default timeout now always TIMEOUTS.NAV_PAGE"

patterns-established:
  - "Timeout scaling: TIMEOUT_MULTIPLIER env var, default 1.0, NaN-safe"

requirements-completed: [TMO-01]

duration: 4min
completed: 2026-02-22
---

# Phase 6 Plan 01: Adaptive Timeout Constants Summary

**TIMEOUTS named-constant object with 10 values and TIMEOUT_MULTIPLIER env var scaling, replacing all 29 hardcoded timeout numbers in mdland-automation.ts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T10:29:39Z
- **Completed:** 2026-02-22T10:33:26Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added MULTIPLIER const (reads TIMEOUT_MULTIPLIER env, NaN-safe, default 1.0)
- Added TIMEOUTS object with 10 named constants, each pre-scaled by MULTIPLIER
- Removed `timeout` field from AutomationOptions and DEFAULT_OPTIONS
- Replaced all 29 inline timeout numbers with TIMEOUTS.* references across 11 methods

## Task Commits

1. **Task 1 + 2: Add TIMEOUTS constants and replace all inline values** - `ad280a2` (feat)

## Files Created/Modified
- `scripts/playwright/mdland-automation.ts` - TIMEOUTS block added after SELECTORS, all 29 inline timeouts replaced

## Decisions Made
- MULTIPLIER applied at const initialization so TIMEOUTS values are pre-scaled integers — no per-call multiplication overhead
- Removed `timeout` from AutomationOptions entirely; page default is always TIMEOUTS.NAV_PAGE

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- TIMEOUTS constants ready for Phase 7 retry logic to reference (e.g., timeout multipliers in retry backoff)
- TIMEOUT_MULTIPLIER env var available for operators on slow MDLand days without code changes

---
*Phase: 06-adaptive-timeouts*
*Completed: 2026-02-22*
