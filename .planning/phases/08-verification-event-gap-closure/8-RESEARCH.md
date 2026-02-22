# Phase 8: Verification & Event Gap Closure - Research

**Researched:** 2026-02-22
**Domain:** TypeScript unit testing + Node.js child process event emission
**Confidence:** HIGH

## Summary

Phase 8 closes two audit gaps from the v1.1 milestone review. ERR-01 and ERR-02 were marked "unverified" not because the implementation is missing — `classifyError()` and `failedStep` are fully implemented in Phase 5 — but because no tests exist to assert their correctness. The verification gap is a test coverage gap, not an implementation gap.

The pre-batch session expiry gap is a real code defect. In `main()` of `mdland-automation.ts`, when `validateSession()` returns `false`, the script calls `process.exit(1)` directly without emitting a `batch_summary` event. The parent runner (`automation-runner.ts`) therefore never receives a summary event for this failure path, leaving the job's `events` array empty on session-expired-before-batch-start scenarios.

The fix for the event gap is minimal: emit a `batch_summary` with `aborted: true` before `process.exit(1)` in the pre-batch session check. No new abstractions needed.

**Primary recommendation:** Write unit tests for `classifyError()` and `failedStep` population; add one `emitEvent()` call before the pre-batch `process.exit(1)`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-01 | `classifyError()` returns correct `AutomationErrorKind` for transient and permanent errors | `classifyError()` exists in `automation-types.ts` L71-86; needs unit tests asserting each classification branch |
| ERR-02 | Failed visits report which step failed (`failedStep`) in `VisitResult` | `currentStep` tracking exists in `processVisit()` L1098-1166; `failedStep: currentStep` returned on error L1165; needs unit tests |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (project-existing) | Unit test runner | Already used in project (`server/__tests__/`) |

No new dependencies required. All test infrastructure is already present.

**Installation:** none needed

## Architecture Patterns

### Current Implementation State (HIGH confidence — verified by direct code read)

`classifyError()` in `server/services/automation-types.ts` L71-86:
```typescript
export function classifyError(err: unknown): AutomationErrorKind {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  const lower = msg.toLowerCase()

  // Permanent errors (check first — more specific patterns)
  if (lower.includes('session expired')) return 'session_expired'
  if (msg.includes('Patient not found')) return 'patient_not_found'
  if (msg.includes('Visit #') && lower.includes('not found')) return 'visit_not_found'

  // Transient errors
  if (name === 'TimeoutError' || lower.includes('timeout')) return 'timeout'
  if (lower.includes('not found') || lower.includes('not accessible')) return 'element_not_found'

  return 'unknown'
}
```

`failedStep` tracking in `processVisit()` L1098-1166:
```typescript
let currentStep = 'init'
try {
  currentStep = 'navigateToICD'
  // ...
  currentStep = 'fillSOAP'
  // ...
} catch (err) {
  return {
    // ...
    failedStep: currentStep,
    errorKind: classifyError(err),
  }
}
```

### Pre-Batch Session Expiry Gap (HIGH confidence — verified by direct code read)

Current `main()` in `mdland-automation.ts` L1388-1396:
```typescript
const valid = await automation.validateSession();
if (!valid) {
  console.error('\nSession expired. Please re-run extract-cookies.ts');
  process.exit(1);  // <-- NO batch_summary emitted here
}
```

The `processBatch()` catch path at L1294-1297 correctly emits `batch_summary(aborted:true)` before re-throwing. But `validateSession()` runs before `processBatch()` is ever called, so that catch block is never reached.

Fix pattern — emit before exit:
```typescript
if (!valid) {
  console.error('\nSession expired. Please re-run extract-cookies.ts')
  emitEvent({
    type: 'batch_summary',
    total: 0, passed: 0, failed: 0, skipped: batchData.summary.totalVisits,
    durationMs: 0,
    aborted: true,
    abortReason: 'session_expired',
    failures: [],
    ts: Date.now(),
  })
  process.exit(1)
}
```

### Test Pattern (HIGH confidence — matches existing project tests)

Existing tests in `server/__tests__/` use vitest with direct function imports. No mocking framework needed for `classifyError()` — it is a pure function.

```typescript
// server/__tests__/automation-types.test.ts
import { describe, it, expect } from 'vitest'
import { classifyError, isPermanentError } from '../services/automation-types'

describe('classifyError', () => {
  it('classifies session expired as permanent', () => {
    expect(classifyError(new Error('session expired'))).toBe('session_expired')
  })
  it('classifies TimeoutError as transient', () => {
    const err = new Error('timed out')
    err.name = 'TimeoutError'
    expect(classifyError(err)).toBe('timeout')
  })
})
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test runner | Custom assertion scripts | vitest (already in project) | Already configured, consistent with existing tests |

## Common Pitfalls

### Pitfall 1: Testing `failedStep` requires mocking Playwright
**What goes wrong:** `processVisit()` is a class method that calls Playwright APIs — you cannot unit test `failedStep` population by calling `processVisit()` directly without a browser.
**How to avoid:** Test `classifyError()` and `isPermanentError()` as pure functions (no mocking needed). For `failedStep`, verify the pattern exists in code (static analysis / grep) rather than runtime test, OR test a thin extracted helper if one is created.
**Warning signs:** Test file imports `playwright` — that's a sign you're testing too deep.

### Pitfall 2: `skipped` count in pre-batch summary
**What goes wrong:** Before `processBatch()` runs, `batchData` may not be loaded yet if session check happens before API fetch.
**How to avoid:** Check `main()` call order — `batchData` IS loaded before `validateSession()` is called (L1371-1396), so `batchData.summary.totalVisits` is available for the `skipped` field.

### Pitfall 3: `emitEvent` scope in `main()`
**What goes wrong:** `emitEvent()` is a module-level function (L173-175), accessible from `main()` — no refactoring needed.
**How to avoid:** Confirm `emitEvent` is not a class method before writing the fix. It is not — it is a standalone `function emitEvent(event: BatchEvent)`.

## Code Examples

### ERR-01 test cases to cover
```typescript
// Permanent errors
classifyError(new Error('session expired'))        // → 'session_expired'
classifyError(new Error('Patient not found'))      // → 'patient_not_found'
classifyError(new Error('Visit #3 not found'))     // → 'visit_not_found'

// Transient errors
const te = new Error('Timeout exceeded'); te.name = 'TimeoutError'
classifyError(te)                                  // → 'timeout'
classifyError(new Error('element not found'))      // → 'element_not_found'
classifyError(new Error('not accessible'))         // → 'element_not_found'

// Fallback
classifyError(new Error('unexpected crash'))       // → 'unknown'
classifyError('raw string error')                  // → 'unknown'
```

### ERR-02 verification approach
`failedStep` is populated by `currentStep` at the point of throw. Since `processVisit()` cannot be unit tested without Playwright, verification is:
1. Static: confirm `failedStep: currentStep` is present in the catch return (already verified — L1165)
2. The test for ERR-02 is a code-existence check, not a runtime test

## Open Questions

1. **Should ERR-02 have a runtime test?**
   - What we know: `processVisit()` requires Playwright; pure unit test is not feasible without mocking the entire class
   - What's unclear: Whether the project wants a mock-heavy test or accepts static verification
   - Recommendation: Accept static verification for ERR-02 (code already correct per Phase 5 summary); write runtime tests only for `classifyError()` (ERR-01) which is a pure function

## Sources

### Primary (HIGH confidence)
- Direct code read: `server/services/automation-types.ts` — `classifyError()`, `isPermanentError()`, `VisitResult` interface
- Direct code read: `scripts/playwright/mdland-automation.ts` — `processVisit()` `currentStep` tracking, `main()` pre-batch session check, `emitEvent()` function
- Direct code read: `.planning/phases/05-error-classification/05-01-SUMMARY.md` — Phase 5 delivery confirmation
- Direct code read: `.planning/phases/07-retry-recovery-events/07-VERIFICATION.md` — Phase 7 verification, gap identification

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated context confirming `processBatch` emits `batch_summary` on aborted path

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — vitest already in project, no new deps
- Architecture: HIGH — all code read directly, no inference
- Pitfalls: HIGH — gaps identified from direct code inspection

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable — no external dependencies)
