# Project Research Summary

**Project:** soap-system v1.1 — Playwright automation stability
**Domain:** Browser automation resilience — MDLand EHR SOAP submission
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

This milestone adds retry/recovery, structured error reporting, and adaptive timeouts to an existing Playwright automation that submits SOAP notes to MDLand EHR. The system already works end-to-end; the goal is making it production-reliable when MDLand is slow or flaky. The recommended approach is minimal: add a `TIMEOUTS` constants object, an error kind enum, a `withRetry` wrapper in the child process, and JSON line event emission on stdout — all without changing the spawn model or adding a message queue.

The critical constraint is that MDLand is not idempotent. ICD/CPT codes are appended, not replaced. Any retry that does not first call `closeVisit()` and re-navigate from the waiting room will produce duplicate billing codes — a HIGH-cost manual recovery situation. Error classification must be implemented before retry logic: retrying a session-expired error wastes time and risks data corruption, while skipping a timeout error abandons a visit that would succeed on the second attempt.

The stack additions are minimal: `async-retry` for the retry wrapper (CJS-compatible, unlike `p-retry` v7 which is ESM-only and will break this project), and `pino` for structured logging. The architecture stays as-is — JSON lines on the existing stdout pipe give the parent process structured per-visit results without changing spawn options or adding IPC.

---

## Key Findings

### Recommended Stack

The project is CJS (no `"type": "module"`), which rules out `p-retry` v7+. Use `async-retry@1.3.3` for retry with exponential backoff. Add `pino@10.3.1` for structured JSON logging — it replaces `console.log` calls with filterable, level-aware output. No other new dependencies are needed; Playwright's per-action `{ timeout }` option handles adaptive timeouts natively.

**Core technologies:**
- `async-retry@1.3.3`: per-visit retry with backoff — CJS-native, no ESM friction
- `pino@10.3.1`: structured JSON logging — replaces unstructured `console.log`, carries `batchId`/`visitId` context
- `pino-http@11.0.0`: Express request logging — pairs with pino for consistent log format
- Playwright per-action `{ timeout }`: adaptive timeouts — no new library, built into Playwright API

### Expected Features

**Must have (table stakes):**
- Configurable per-operation timeouts (`TIMEOUTS` constants) — global 30s is wrong for both 500ms clicks and 20s TinyMCE init
- Step-level error context (`failedStep` in `VisitResult`) — "visit failed" is not actionable; "failed at: saveSOAP" is
- Error classification (transient vs permanent) — required gate before any retry logic is written
- Per-visit retry with exponential backoff (2 attempts, 2s/4s delays) — recovers ~60-80% of flaky iframe failures

**Should have (v1.x after validation):**
- Progress events emitted as JSON lines to stdout — enables structured frontend display
- Session expiry fast-fail — stop entire batch immediately on auth failure

**Defer (v2+):**
- Visit-level idempotency check — only if double-submission incidents are reported in production
- Adaptive timeout scaling — only if timeout failures persist after per-step tuning

### Architecture Approach

The existing spawn model (parent `automation-runner.ts` → child `mdland-automation.ts` via stdio pipe) is correct and should not change. Structured communication is achieved by emitting JSON lines on stdout — lines starting with `{` are parsed as events, all others are appended to the log buffer as before. Retry logic belongs in the child (not the parent) because the browser context lives there; parent-level retry would require killing and re-spawning the browser, losing session state. A new `automation-types.ts` file provides shared types for both parent and child.

**Major components:**
1. `automation-types.ts` (new) — `AutomationEvent`, `VisitResult` with `attempts`/`failedStep`, `AutomationErrorKind` enum
2. `mdland-automation.ts` (modify) — add `emit()`, `withRetry()` wrapper, per-step `TIMEOUTS` constants, error classification
3. `automation-runner.ts` (modify) — add JSON line parser, populate `visitResults[]` on job state
4. `automate.ts` (minor modify) — expose `visitResults` in GET response

### Critical Pitfalls

1. **Non-idempotent retry creates duplicate ICD/CPT codes** — before any retry, call `closeVisit()` then re-navigate from waiting room; read existing codes before adding
2. **Stale execution context after failed save** — wrap every `page.evaluate()` to detect "Execution context was destroyed"; trigger full page-state reset, never propagate as visit failure
3. **Error classification collapse** — implement `AutomationErrorKind` enum before retry; session-expired must stop the batch, not retry; timeout must retry, not skip
4. **Progress lost on child process crash** — write `data/automation-progress-{batchId}.json` after each visit; skip completed visits on re-run
5. **PHI in error logs/screenshots** — use stable visit keys (`${patientName}-${dos}`) in error strings, not patient names; name screenshots with `visitKey-timestamp.png`

---

## Implications for Roadmap

Based on research, the dependency chain is strict: types → error classification → timeouts → retry. These cannot be reordered safely.

### Phase 1: Shared Types + Error Classification
**Rationale:** Everything else depends on `AutomationErrorKind` and the extended `VisitResult` type. Error classification must exist before retry logic is written — otherwise retry conditions are guesswork.
**Delivers:** `automation-types.ts` with `AutomationErrorKind`, extended `VisitResult` (adds `failedStep`, `attempts`), `isPermanentError()` guard
**Addresses:** Error classification (P1), step-level error context (P1)
**Avoids:** Retrying session-expired errors; collapsing all failures into one category

### Phase 2: Adaptive Timeouts
**Rationale:** Safe to add independently (no dependencies on retry). Immediate stability improvement with zero risk of data corruption. Establishes named constants that retry logic will reference for timeout scaling.
**Delivers:** `TIMEOUTS` constants object in `mdland-automation.ts`; `page.setDefaultTimeout` replaced with per-action `{ timeout }` overrides
**Addresses:** Configurable timeouts (P1)
**Avoids:** Global timeout inflation masking per-step failures; TinyMCE init failures on slow days

### Phase 3: Retry + Backoff + JSON Line Events
**Rationale:** Can only be implemented correctly after Phase 1 (error kinds) and Phase 2 (timeout constants for retry scaling). This is the core deliverable of the milestone.
**Delivers:** `withRetry()` wrapper in child; `closeVisit()` + re-navigation before each retry attempt; exponential backoff (2s/4s); JSON line `emit()` function; parent JSON line parser; `visitResults[]` on job state; progress file written after each visit
**Addresses:** Per-visit retry + backoff (P1), progress events (P2), crash recovery
**Avoids:** Duplicate ICD/CPT from non-idempotent retry; stale execution context; progress lost on crash

### Phase Ordering Rationale

- Types first because both parent and child import from `automation-types.ts` — it has no dependencies and unblocks everything
- Error classification before retry because `isPermanentError()` is the gate condition in `withRetry()`
- Timeouts before retry because retry uses timeout multipliers (`1 + attempt * 0.5`) that reference the `TIMEOUTS` constants
- Retry last because it is the highest-risk change and requires all prior work to be correct

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1:** Enum + interface extension — standard TypeScript, no research needed
- **Phase 2:** Per-action timeout constants — Playwright API is well-documented, HIGH confidence
- **Phase 3:** `withRetry` wrapper pattern — well-documented in `async-retry` docs; JSON lines is a standard pattern

No phases require `/gsd:research-phase` — all patterns are well-established and the codebase has been directly analyzed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm registry versions verified; ESM/CJS compatibility confirmed for `async-retry` vs `p-retry` |
| Features | HIGH | Based on direct code inspection of `mdland-automation.ts` (1296 lines) |
| Architecture | HIGH | Direct source read of all 3 relevant files; JSON lines pattern is well-established |
| Pitfalls | HIGH | Derived from direct codebase analysis + MDLand-specific iframe behavior observed in code |

**Overall confidence:** HIGH

### Gaps to Address

- **TinyMCE exact timeout value:** Current code uses `timeout: 20000` for TinyMCE init. Whether 20s is sufficient on slow days is unknown without production timing data. Start with 25s and tune down.
- **`isPermanentError()` completeness:** The error message patterns for MDLand-specific permanent failures (e.g., "Patient not found", "Visit already closed") need to be verified against actual MDLand error strings during implementation.
- **Progress file location:** `data/automation-progress-{batchId}.json` assumes `DATA_DIR` is writable. Verify against Phase 3 batch-store implementation.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `scripts/playwright/mdland-automation.ts`, `server/services/automation-runner.ts`, `server/routes/automate.ts`
- npm registry: `async-retry@1.3.3`, `pino@10.3.1`, `pino-http@11.0.0` versions verified 2026-02-22
- Playwright API docs: per-action `{ timeout }` option on all locator methods

### Secondary (MEDIUM confidence)
- [Pino vs Winston comparison](https://betterstack.com/community/comparisons/pino-vs-winston/) — pino performance advantage
- [Playwright timeout patterns](https://circleci.com/blog/mastering-waits-and-timeouts-in-playwright/) — per-action timeout approach
- [Playwright flaky test patterns](https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/) — retry and reset strategies

### Tertiary (LOW confidence)
- [EHR double data entry risks](https://www.anisolutions.com/2026/02/10/reducing-double-data-entry-in-ehr-with-integration/) — general EHR idempotency concerns (MDLand-specific behavior confirmed via code inspection)

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
