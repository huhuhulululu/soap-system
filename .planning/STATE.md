# Project State

## Status
v1.1 Automation Stability — PHASE 7 COMPLETE

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Batch-generate compliant SOAP notes from minimal input
**Current focus:** v1.1 Automation Stability — Phase 7: Retry Recovery Events

## Current Position
Phase: 7 (Retry Recovery Events)
Plan: 07-02-PLAN.md (JSON Event Parsing in Runner) — COMPLETE
Status: Complete — all plans done
Last activity: 2026-02-22 — 07-02 executed

```
[Phase 5] [x] → [Phase 6] [x] → [Phase 7] [x]
```

## Performance Metrics
- Phases complete: 3/3 (v1.1)
- Requirements mapped: 7/7

## Accumulated Context

### Key Decisions
- Error classification (ERR-01) must precede retry logic — `isPermanentError()` is the gate condition in `withRetry()`
- Timeouts (TMO-01) before retry because retry uses timeout multipliers referencing `TIMEOUTS` constants
- Retry belongs in child process (`mdland-automation.ts`), not parent — browser context lives there
- Use `async-retry@1.3.3` (CJS-native); `p-retry` v7+ is ESM-only and will break this project
- JSON lines on existing stdout pipe — lines starting with `{` parsed as events, others appended to log buffer
- TIMEOUTS pre-scaled at module load (Math.round) — no per-call multiplication; TIMEOUT_MULTIPLIER env var for operators
- withRetry calls processVisit directly; retry reset does full page.goto + clickWaitingRoom + re-search + openVisit
- unknown errorKind treated as retryable — safer to retry than skip
- processBatch emits batch_summary on both normal and aborted paths before re-throwing

- JSON lines are also forwarded to appendLog — events and logs serve different consumers but both benefit from the data

### Critical Constraints
- MDLand is non-idempotent: ICD/CPT codes are appended, not replaced — every retry MUST call `closeVisit()` and re-navigate before re-attempting
- Session-expired errors must stop the batch (ERR-03), never retry

### Blockers
None

## Session Continuity
- Branch: v1.1-ux
- Next action: v1.1 complete — all phases done
- Last session: 2026-02-22 — 07-02 executed
