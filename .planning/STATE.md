# Project State

## Status
v1.1 Automation Stability — PHASE 5 COMPLETE

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Batch-generate compliant SOAP notes from minimal input
**Current focus:** v1.1 Automation Stability — Phase 6: Adaptive Timeouts

## Current Position
Phase: 6 (Adaptive Timeouts)
Plan: TBD
Status: Not started
Last activity: 2026-02-22 — Phase 5 completed

```
[Phase 5] [x] → [Phase 6] [ ] → [Phase 7] [ ]
```

## Performance Metrics
- Phases complete: 1/3 (v1.1)
- Requirements mapped: 7/7

## Accumulated Context

### Key Decisions
- Error classification (ERR-01) must precede retry logic — `isPermanentError()` is the gate condition in `withRetry()`
- Timeouts (TMO-01) before retry because retry uses timeout multipliers referencing `TIMEOUTS` constants
- Retry belongs in child process (`mdland-automation.ts`), not parent — browser context lives there
- Use `async-retry@1.3.3` (CJS-native); `p-retry` v7+ is ESM-only and will break this project
- JSON lines on existing stdout pipe — lines starting with `{` parsed as events, others appended to log buffer

### Critical Constraints
- MDLand is non-idempotent: ICD/CPT codes are appended, not replaced — every retry MUST call `closeVisit()` and re-navigate before re-attempting
- Session-expired errors must stop the batch (ERR-03), never retry

### Blockers
None

## Session Continuity
- Branch: v1.1-ux
- Next action: `/gsd:plan-phase 6`
