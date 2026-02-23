---
phase: 12-fixture-snapshots-parity-audit
plan: 02
subsystem: testing
tags: [normalizer, parity, generation-context, tcm-inference, initialState]

requires:
  - phase: 12-fixture-snapshots-parity-audit
    provides: 30 deterministic fixture snapshot baselines for regression safety
provides:
  - normalizeGenerationContext() shared pure function in src/shared/
  - Unified context-construction entry point for both batch and compose paths
  - Compose path now uses canonical tightness/tenderness/spasm formula
  - Compose path hasMetalImplant now checks both 'Metal Implant' and 'Joint Replacement'
affects: [12-fixture-snapshots-parity-audit, 13-recovery-curve-normalization, 14-assessment-engine]

tech-stack:
  added: []
  patterns: [shared normalizer adapter pattern, compose-override inference pattern]

key-files:
  created:
    - src/shared/normalize-generation-context.ts
  modified:
    - server/services/batch-generator.ts
    - frontend/src/composables/useSOAPGeneration.ts

key-decisions:
  - "Canonical tightness/tenderness/spasm formula is painCurrent >= 7 ? 3 : 2 (matches batch baseline, not engine severityToInit fallback)"
  - "Added associatedSymptoms (plural) to NormalizeInput so batch can pass full array for TCM inference"
  - "Compose user-selected localPattern/systemicPattern passed as overrides (undefined triggers inference)"

patterns-established:
  - "normalizeGenerationContext() is the sole context-construction entry point for both generation paths"
  - "NormalizeInput accepts optional overrides — omit for inference, provide for user selections"

requirements-completed: [PAR-02]

duration: 5min
completed: 2026-02-23
---

# Phase 12 Plan 02: Normalize Generation Context Summary

**Shared normalizeGenerationContext() unifying batch and compose context construction with TCM inference + canonical initialState formula**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 2

## Accomplishments
- normalizeGenerationContext() created as pure function in src/shared/ with TCM inference, initialState computation, and compose-override support
- Both batch-generator.ts and useSOAPGeneration.ts refactored to use normalizer as sole context-construction entry point
- All 30 fixture snapshots pass green (batch path output unchanged)
- Compose path parity gaps fixed: tightness/tenderness/spasm now use canonical formula, hasMetalImplant checks both 'Metal Implant' and 'Joint Replacement'

## Task Commits

1. **Task 1: Create normalizeGenerationContext() shared function** - `f0c4254` (feat)
2. **Task 2: Refactor batch-generator.ts and useSOAPGeneration.ts to use normalizer** - `50cfa68` (refactor)

## Files Created/Modified
- `src/shared/normalize-generation-context.ts` - Shared normalizer with NormalizeInput/NormalizeOutput interfaces
- `server/services/batch-generator.ts` - Replaced buildContext() + inline initialState with normalizer
- `frontend/src/composables/useSOAPGeneration.ts` - Replaced inline context computed + initialState with normalizer

## Decisions Made
- Used `painCurrent >= 7 ? 3 : 2` as canonical formula (not engine's `severityToInit` map) because fixtures were captured against batch path which uses this formula
- Added `associatedSymptoms` (plural array) to NormalizeInput to preserve batch path's full-array TCM inference behavior
- Compose passes user-selected TCM patterns as explicit overrides; omitting them triggers inference (same as batch)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- normalizeGenerationContext() ready for parity diff tests in Plan 03
- Both paths unified — Plan 03 can verify byte-identical output for same inputs

---
*Phase: 12-fixture-snapshots-parity-audit*
*Completed: 2026-02-23*
