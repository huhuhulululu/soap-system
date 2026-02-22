# Phase 7: Retry, Recovery & Events - Research

**Researched:** 2026-02-22
**Domain:** Retry logic, batch control flow, structured event emission — TypeScript/Node.js child process
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- "Close current visit" = same tab navigate back to waiting room (page.goto), NOT close/reopen tab
- No extra state cleanup needed — navigation alone resets state (simplest approach)
- Single patient retry exhaustion → skip and continue to next patient, do NOT interrupt batch
- Directly reuse Phase 5's error classification system — no additional granularity needed
- transient errors → retry (up to 2 times, 2s then 4s delay)
- ALL fatal errors → immediately stop entire batch (not just session-expired)
- Batch summary includes: total, passed, failed, skipped counts + failure details per patient
- Failed patient details include full retry history (each attempt's error, not just final)
- Time tracking: total batch duration + per-visit duration
- Events must serve dual purpose: parent process real-time consumption AND log/post-analysis

### Claude's Discretion
- Event type granularity (3 types vs more fine-grained)
- JSON field design per event type
- Output format choice
- Retry timing strategy after navigation
- Whether unknown errors trigger retry
- Error→action mapping storage approach
- Aborted batch summary format

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RET-01 | Failed visits automatically retry up to 2 times with exponential backoff (2s/4s delay) | `async-retry@1.3.3` (CJS-native) provides `retries`, `minTimeout`, `factor` options; manual `setTimeout` is the fallback if no library added |
| RET-02 | Each retry closes the current visit and re-navigates from waiting room before re-attempting | `closeVisit()` + `page.goto(waitingRoomUrl)` before each retry attempt; locked decision: same tab navigation |
| ERR-03 | Session expiry stops the entire batch immediately instead of retrying remaining visits | `isPermanentError()` from Phase 5 gates retry; fatal error throws out of `processBatch()` loop |
| OBS-01 | Child process emits structured JSON line events on stdout for visit start, result, and batch summary | `process.stdout.write(JSON.stringify(event) + '\n')` — NDJSON on existing stdout pipe; parent already reads stdout line-by-line |
</phase_requirements>

## Summary

Phase 7 adds three behaviors to `mdland-automation.ts`: (1) a `withRetry()` wrapper around `processVisit()` that retries transient failures up to 2 times with 2s/4s delays, re-navigating to the waiting room before each retry; (2) a fatal-error fast-path that throws out of `processBatch()` when `isPermanentError()` returns true, stopping the batch immediately; (3) `emitEvent()` calls at visit start, visit result, and batch summary that write NDJSON lines to stdout.

The parent process (`automation-runner.ts`) already reads stdout line-by-line and appends to `currentJob.logs`. The only change needed there is to detect lines starting with `{` and parse them as structured events rather than plain log strings — enabling real-time consumption without a new IPC channel.

No new library is required. The retry delays (2s/4s) are short enough that a plain `await new Promise(r => setTimeout(r, delay))` is cleaner than adding `async-retry` as a dependency. STATE.md noted `async-retry@1.3.3` as the option if a library is preferred, but the manual approach is 3 lines and has zero dependency risk.

**Primary recommendation:** Implement retry manually with `setTimeout` in a `withRetry()` helper inside `mdland-automation.ts`. Emit NDJSON events via `process.stdout.write`. Parse events in `automation-runner.ts` by checking if a line starts with `{`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `setTimeout` (built-in) | — | Retry delay (2s/4s) | Zero deps; 2 fixed delays don't need a library |
| `process.stdout.write` (built-in) | — | NDJSON event emission | Already piped to parent; no new channel needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `async-retry` | 1.3.3 | Retry with backoff | Only if retry logic grows complex (jitter, max time); overkill for 2 fixed delays |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `setTimeout` | `async-retry@1.3.3` | async-retry adds a dep for no benefit at 2 fixed delays; manual is 3 lines |
| `process.stdout.write` NDJSON | Separate IPC channel | IPC requires protocol changes in parent; stdout pipe already exists |

**Installation:** none required (manual approach)

## Architecture Patterns

### Recommended Project Structure
```
scripts/playwright/
└── mdland-automation.ts   # MODIFY: add withRetry(), emitEvent(), fatal-stop logic

server/services/
└── automation-runner.ts   # MODIFY: parse JSON lines from stdout
└── automation-types.ts    # MODIFY: add event types (BatchEvent union)
```

### Pattern 1: withRetry() wraps processVisit()
**What:** A local async helper that calls `processVisit()`, checks the result, and retries on transient failure
**When to use:** Called from `processPatient()` instead of calling `processVisit()` directly
**Example:**
```typescript
// In mdland-automation.ts — replaces direct processVisit() call
async function withRetry(
  fn: () => Promise<VisitResult>,
  closeAndReset: () => Promise<void>,
  maxRetries = 2
): Promise<VisitResult> {
  const delays = [2000, 4000]
  let last!: VisitResult
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await closeAndReset()
      await new Promise(r => setTimeout(r, delays[attempt - 1]))
    }
    last = await fn()
    if (last.success || isPermanentError(last.errorKind ?? 'unknown')) break
  }
  return { ...last, attempts: last.attempts + (/* retry count */ 0) } // track attempts
}
```

### Pattern 2: Fatal error stops processBatch()
**What:** After each visit result, check if the error is permanent — if so, throw to abort the batch loop
**When to use:** Inside `processBatch()` after collecting each patient's results
**Example:**
```typescript
// In processBatch() — after processPatient() returns results
for (const result of patientResults) {
  if (!result.success && isPermanentError(result.errorKind ?? 'unknown')) {
    emitEvent({ type: 'batch_summary', aborted: true, reason: result.errorKind, ... })
    throw new Error(`Fatal error: ${result.errorKind} — batch aborted`)
  }
}
```

### Pattern 3: NDJSON event emission
**What:** `process.stdout.write(JSON.stringify(event) + '\n')` for each event
**When to use:** At visit start, visit result, and batch summary
**Example:**
```typescript
function emitEvent(event: BatchEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n')
}

// visit_start — before processVisit
emitEvent({ type: 'visit_start', patient, visitIndex, noteType, ts: Date.now() })

// visit_result — after withRetry returns
emitEvent({ type: 'visit_result', ...result, ts: Date.now() })

// batch_summary — at end of processBatch
emitEvent({ type: 'batch_summary', total, passed, failed, durationMs, failures, ts: Date.now() })
```

### Pattern 4: Parent parses JSON lines
**What:** In `automation-runner.ts`, detect lines starting with `{` and parse as events
**When to use:** In the `child.stdout.on('data')` handler — already exists
**Example:**
```typescript
// automation-runner.ts — existing stdout handler, add JSON detection
child.stdout?.on('data', (data: Buffer) => {
  const lines = data.toString().split('\n').filter(l => l.trim())
  for (const line of lines) {
    if (line.startsWith('{')) {
      try {
        const event = JSON.parse(line) as BatchEvent
        currentJob.events.push(event)  // or handle directly
      } catch { /* malformed — treat as plain log */ }
    }
    appendLog(line)
  }
})
```

### Pattern 5: Retry history in VisitResult
**What:** Add `retryHistory` field to `VisitResult` to capture each attempt's error
**When to use:** `withRetry()` accumulates attempt errors; final result includes the array
**Example:**
```typescript
// automation-types.ts — extend VisitResult
export interface AttemptRecord {
  readonly attempt: number
  readonly error: string
  readonly errorKind: AutomationErrorKind
  readonly durationMs: number
}

export interface VisitResult {
  // ... existing fields ...
  readonly attempts: number
  readonly retryHistory?: ReadonlyArray<AttemptRecord>  // populated on retry
}
```

### Anti-Patterns to Avoid
- **Retrying permanent errors:** `isPermanentError()` must be checked before scheduling a retry — never retry `session_expired`, `patient_not_found`, `visit_not_found`
- **Retrying without navigation reset:** MDLand is non-idempotent; ICD/CPT codes append on each attempt. `closeVisit()` + navigate to waiting room MUST precede every retry
- **Using `console.log` for events:** `console.log` goes to stdout but is not reliably parseable as NDJSON. Use `process.stdout.write` with explicit `\n` terminator
- **Throwing on single-patient retry exhaustion:** After 2 retries, mark the visit failed and continue to next patient — only fatal errors abort the batch

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff | Custom retry loop with complex state | Simple `for` loop + `setTimeout` | 2 fixed delays (2s/4s) need no library; `async-retry` adds dep for zero benefit |
| Event serialization | Custom binary protocol | `JSON.stringify` + `\n` (NDJSON) | Parent already reads stdout as text lines; NDJSON is the standard for line-delimited JSON |

**Key insight:** The retry requirements are simple enough (2 retries, 2 fixed delays, 1 reset action) that a library would add more complexity than it removes.

## Common Pitfalls

### Pitfall 1: ICD/CPT duplication on retry
**What goes wrong:** Retry re-runs `addICDCodes()` and `addCPTCodes()` on a visit that already had codes added in the first attempt — MDLand appends, not replaces
**Why it happens:** `processVisit()` starts from the current visit state, not a clean state
**How to avoid:** `closeVisit()` + `page.goto(waitingRoomUrl)` before every retry — this navigates away from the visit, discarding any partial state. The locked decision confirms this is the correct reset mechanism.
**Warning signs:** Duplicate ICD/CPT codes in MDLand after a retried visit

### Pitfall 2: `attempts` count off-by-one
**What goes wrong:** `VisitResult.attempts` reports 1 even after 2 retries
**Why it happens:** `processVisit()` always returns `attempts: 1`; `withRetry()` must override this with the actual attempt count
**How to avoid:** `withRetry()` returns `{ ...result, attempts: attemptNumber }` where `attemptNumber` is the loop counter (1-indexed)

### Pitfall 3: Fatal error not propagating through processPatient()
**What goes wrong:** `processPatient()` catches the fatal error internally and returns a failed result instead of re-throwing
**Why it happens:** `processPatient()` has its own try/catch or error handling
**How to avoid:** Fatal errors must propagate up to `processBatch()`. Either re-throw from `processPatient()` or check `isPermanentError()` in `processBatch()` after each patient's results are collected.

### Pitfall 4: stdout buffering swallows events
**What goes wrong:** Parent process doesn't receive events in real-time — they arrive in a burst at process end
**Why it happens:** Node.js stdout is line-buffered when piped; `process.stdout.write` with `\n` terminator forces flush per line
**How to avoid:** Always terminate each NDJSON line with `\n`. Do NOT use `console.log` (which adds `\n` but goes through a different buffer path). `process.stdout.write(JSON.stringify(event) + '\n')` is reliable.

### Pitfall 5: unknown errors — retry or not?
**What goes wrong:** An `unknown` error kind causes infinite retry or silent skip
**Why it happens:** `isPermanentError('unknown')` returns false, so `unknown` would retry by default
**How to avoid:** Treat `unknown` as retryable (same as transient) — it's safer to retry once than to silently skip. After retry exhaustion, mark failed and continue. This is Claude's discretion per CONTEXT.md.

## Code Examples

### withRetry() — complete implementation
```typescript
// In mdland-automation.ts
const RETRY_DELAYS = [2000, 4000] as const

async function withRetry(
  attemptFn: (attemptNum: number) => Promise<VisitResult>,
  resetFn: () => Promise<void>,
  maxRetries = 2
): Promise<VisitResult> {
  const history: AttemptRecord[] = []

  for (let i = 0; i <= maxRetries; i++) {
    if (i > 0) {
      await resetFn()
      await new Promise(r => setTimeout(r, RETRY_DELAYS[i - 1]))
    }
    const result = await attemptFn(i + 1)
    if (result.success || isPermanentError(result.errorKind ?? 'unknown')) {
      return { ...result, attempts: i + 1, retryHistory: history.length ? history : undefined }
    }
    history.push({
      attempt: i + 1,
      error: result.error ?? 'unknown',
      errorKind: result.errorKind ?? 'unknown',
      durationMs: result.duration,
    })
  }
  // Should not reach here — loop always returns on last iteration
  throw new Error('withRetry: exhausted retries without returning')
}
```

### emitEvent() + BatchEvent types
```typescript
// In automation-types.ts
export type BatchEvent =
  | { readonly type: 'visit_start'; readonly patient: string; readonly visitIndex: number; readonly noteType: string; readonly ts: number }
  | { readonly type: 'visit_result'; readonly result: VisitResult; readonly ts: number }
  | { readonly type: 'batch_summary'; readonly total: number; readonly passed: number; readonly failed: number; readonly durationMs: number; readonly aborted: boolean; readonly failures: ReadonlyArray<{ patient: string; visitIndex: number; error: string; retryHistory?: ReadonlyArray<AttemptRecord> }>; readonly ts: number }

// In mdland-automation.ts
function emitEvent(event: BatchEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n')
}
```

### processBatch() fatal-stop pattern
```typescript
// In processBatch() — after each patient
for (let i = 0; i < batchData.patients.length; i++) {
  const patientResults = await this.processPatient(batchData.patients[i], i === 0)
  allResults.push(...patientResults)

  const fatal = patientResults.find(r => !r.success && isPermanentError(r.errorKind ?? 'unknown'))
  if (fatal) {
    emitEvent({ type: 'batch_summary', aborted: true, ... })
    throw new Error(`Batch aborted: ${fatal.errorKind}`)
  }
}
```

### automation-runner.ts stdout event parsing
```typescript
// Existing handler — add JSON detection
child.stdout?.on('data', (data: Buffer) => {
  const lines = data.toString().split('\n').filter(l => l.trim())
  for (const line of lines) {
    if (line.startsWith('{')) {
      try {
        const event = JSON.parse(line) as BatchEvent
        currentJob.events.push(event)
      } catch { /* treat as plain log */ }
    }
    appendLog(line)
  }
})
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `console.log` for all output | NDJSON on stdout for structured events, `console.log` for debug | Parent can parse events without regex |
| Single attempt per visit | `withRetry()` with 2s/4s backoff | Transient failures auto-recover |
| Batch continues after session expiry | Fatal error aborts batch immediately | No wasted attempts on dead session |

## Open Questions

1. **`closeVisit()` navigation target for retry reset**
   - What we know: Locked decision says "same tab navigate back to waiting room (page.goto)". `clickWaitingRoom()` exists and navigates to the waiting room state.
   - What's unclear: Should `resetFn` call `clickWaitingRoom()` (which clicks a button) or `page.goto(waitingRoomUrl)` directly? The locked decision says `page.goto`.
   - Recommendation: Use `page.goto('https://web153.b.mdland.net/eClinic/clinic_main.aspx')` followed by `clickWaitingRoom()` — this matches the existing `validateSession()` navigation pattern and ensures a clean state.

2. **`events` field on AutomationJob in automation-runner.ts**
   - What we know: `AutomationJob` currently has `logs: readonly string[]` but no `events` field.
   - What's unclear: Should events be stored separately from logs, or is appending to logs sufficient for v1.1?
   - Recommendation: Add `events: readonly BatchEvent[]` to `AutomationJob` for clean separation. The parent API can then expose events directly without parsing log strings.

## Sources

### Primary (HIGH confidence)
- Direct code read: `/scripts/playwright/mdland-automation.ts` — full file, processVisit(), processBatch(), closeVisit(), validateSession()
- Direct code read: `/server/services/automation-runner.ts` — stdout handler (L218-229), AutomationJob shape
- Direct code read: `/server/services/automation-types.ts` — isPermanentError(), classifyError(), VisitResult
- `.planning/STATE.md` — Key Decisions: async-retry choice, JSON lines protocol, non-idempotent MDLand constraint
- `.planning/phases/07-retry-recovery-events/07-CONTEXT.md` — all locked decisions and discretion areas
- `npm info async-retry` — confirmed v1.3.3, CJS, no ESM issues

### Secondary (MEDIUM confidence)
- `.planning/phases/05-error-classification/05-RESEARCH.md` — isPermanentError() gate condition, attempts field design

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — manual setTimeout is built-in; no library needed
- Architecture: HIGH — based on direct source read of all relevant files; patterns derived from existing code structure
- Pitfalls: HIGH — ICD/CPT duplication pitfall confirmed by STATE.md "Critical Constraints"; others derived from code analysis

**Research date:** 2026-02-22
**Valid until:** 2026-03-22
