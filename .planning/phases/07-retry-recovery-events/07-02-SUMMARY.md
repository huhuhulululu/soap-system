---
phase: 07-retry-recovery-events
plan: "02"
subsystem: api
tags: [automation, ndjson, events, child-process, typescript]

requires:
  - phase: 07-01
    provides: BatchEvent type in automation-types.ts and NDJSON emission from child process

provides:
  - JSON event parsing from child stdout in automation-runner.ts
  - AutomationJob.events array for API consumers

affects: [api-routes, automation-status-endpoint]

tech-stack:
  added: []
  patterns: ["NDJSON line detection: lines starting with '{' parsed as BatchEvent, others logged as plain text"]

key-files:
  created: []
  modified:
    - server/services/automation-runner.ts

key-decisions:
  - "JSON lines are also passed to appendLog for debug visibility — events and logs are not mutually exclusive"

patterns-established:
  - "NDJSON detection: startsWith('{') + JSON.parse with catch fallback to plain log"

requirements-completed: [OBS-01]

duration: 3min
completed: 2026-02-22
---

# Phase 7 Plan 02: Structured Event Parsing in Automation Runner Summary

**Parent process parses NDJSON BatchEvent lines from child stdout into AutomationJob.events array while preserving plain log behavior**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T11:18:32Z
- **Completed:** 2026-02-22T11:21:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Imported BatchEvent type into automation-runner.ts
- Added `events: readonly BatchEvent[]` to AutomationJob interface
- stdout handler now detects JSON lines and pushes parsed BatchEvent objects to currentJob.events
- All three AutomationJob return sites include the events field

## Task Commits

1. **Task 1: Add events field and JSON parsing to automation-runner.ts** - `7cae8e8` (feat)

## Files Created/Modified
- `server/services/automation-runner.ts` - Added BatchEvent import, events field, JSON line detection in stdout handler

## Decisions Made
- JSON lines are also forwarded to appendLog (not skipped) — events and logs serve different consumers but both benefit from the data

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AutomationJob.events is populated in real-time as child emits NDJSON lines
- API routes can now expose events array to frontend consumers
- Phase 7 complete — v1.1 all phases done

---
*Phase: 07-retry-recovery-events*
*Completed: 2026-02-22*
