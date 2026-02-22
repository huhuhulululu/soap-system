---
phase: 07-retry-recovery-events
plan: "01"
subsystem: automation
tags: [playwright, retry, ndjson, events, typescript]

requires:
  - phase: 06-adaptive-timeouts
    provides: TIMEOUTS constants used in retry delays and navigation

provides:
  - withRetry() method with 2-retry / 2s+4s backoff and waiting-room reset
  - emitEvent() NDJSON writer for visit_start, visit_result, batch_summary
  - AttemptRecord and BatchEvent types in automation-types.ts
  - Fatal-stop on permanent errors (session_expired, patient_not_found, visit_not_found)

affects: [parent-process-consumer, batch-api, automation-service]

tech-stack:
  added: []
  patterns:
    - "NDJSON event stream on stdout — lines starting with { are parsed as events by parent"
    - "withRetry wraps processVisit — caller never calls processVisit directly"
    - "Permanent errors propagate via throw from processPatient to processBatch catch block"

key-files:
  created: []
  modified:
    - server/services/automation-types.ts
    - scripts/playwright/mdland-automation.ts

key-decisions:
  - "withRetry calls processVisit (not openVisit+processVisit) — processVisit already handles closeVisit in its catch; retry reset does full page.goto + clickWaitingRoom + re-search sequence"
  - "unknown errorKind treated as retryable — safer to retry than skip"
  - "emitEvent uses process.stdout.write not console.log — parent detects JSON by { prefix"
  - "processBatch emits batch_summary on both normal and aborted paths before re-throwing"

patterns-established:
  - "Event emission: emitEvent({ type, ...fields, ts: Date.now() }) at visit_start and visit_result"
  - "Retry history: AttemptRecord[] accumulated only on failure, undefined on first-attempt success"

requirements-completed: [RET-01, RET-02, ERR-03, OBS-01]

duration: 2min
completed: 2026-02-22
---

# Phase 7 Plan 01: Retry Recovery Events Summary

**Transient-error retry with 2s/4s backoff, waiting-room reset between attempts, and NDJSON event emission for visit_start, visit_result, and batch_summary**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T11:13:50Z
- **Completed:** 2026-02-22T11:15:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- AttemptRecord and BatchEvent types added to automation-types.ts; VisitResult gains optional retryHistory
- withRetry() retries transient errors up to 2 times with 2s then 4s delays, resetting via page.goto + full patient re-search before each retry
- emitEvent() writes NDJSON to process.stdout for visit_start, visit_result, and batch_summary
- Permanent errors (session_expired, patient_not_found, visit_not_found) abort the batch immediately via throw propagation

## Task Commits

1. **Task 1: Add AttemptRecord and BatchEvent types** - `e887414` (feat)
2. **Task 2: Add withRetry, emitEvent, fatal-stop** - `bc0e809` (feat)

## Files Created/Modified
- `server/services/automation-types.ts` - Added AttemptRecord interface, BatchEvent discriminated union, retryHistory field on VisitResult
- `scripts/playwright/mdland-automation.ts` - Added emitEvent(), withRetry(), updated processPatient() and processBatch()

## Decisions Made
- withRetry calls processVisit directly (not openVisit+processVisit) — processVisit handles closeVisit in its catch block; the retry reset sequence (page.goto + clickWaitingRoom + re-search + openVisit) handles re-entry
- unknown errorKind is retryable — safer to retry than skip an unknown failure
- processBatch emits batch_summary on both normal completion and fatal abort before re-throwing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Retry and event emission complete; parent process can now parse NDJSON lines from child stdout
- batch_summary provides total/passed/failed/skipped counts and full retry history for failed visits

---
*Phase: 07-retry-recovery-events*
*Completed: 2026-02-22*
