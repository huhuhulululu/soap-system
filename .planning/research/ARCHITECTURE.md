# Architecture Patterns

**Domain:** Playwright browser automation with child process IPC
**Researched:** 2026-02-22
**Milestone:** v1.1 — Retry/recovery, structured error reporting, adaptive timeouts

---

## Current Architecture (Baseline)

```
Express API (automate.ts)
    │
    ▼
automation-runner.ts          ← parent process, singleton lock
    │  spawn('npx tsx ...')
    │  stdio: ['ignore', 'pipe', 'pipe']
    ▼
mdland-automation.ts          ← child process, Playwright engine
    │  console.log() → stdout
    │  console.error() → stderr
    ▼
MDLand (browser, iframes)
```

**Communication today:** unstructured text lines on stdout/stderr. Parent appends every line to `logs[]` (500-line ring buffer). No semantic parsing — parent cannot distinguish "visit failed" from "debug message".

**Error handling today:** `processVisit()` has a try/catch that returns `{ success: false, error: msg }`. The child exits with code 1 if any visit failed. Parent maps exit code 0 → `done`, non-zero → `failed`. No retry, no step-level detail surfaced to the API.

**Timeouts today:** `DEFAULT_OPTIONS.timeout = 30000` set once on `page.setDefaultTimeout()`. All Playwright operations inherit this. No per-operation tuning, no backoff.

---

## Recommended Architecture

### Core Decision: stdout JSON Lines (not IPC)

Use newline-delimited JSON on stdout for structured events. The child already writes to stdout; the parent already reads it line-by-line. Adding a JSON envelope requires zero new IPC mechanism and zero new dependencies.

```
child stdout line:
  {"type":"visit_result","patient":"John","dos":20240115,"success":false,"step":"fillSOAP","error":"Timeout 30000ms","duration":31200,"attempt":1}

child stdout line:
  {"type":"progress","completed":3,"total":10}

child stdout line:
  {"type":"batch_summary","succeeded":8,"failed":2,"totalMs":142000}
```

Plain text lines (no leading `{`) are still appended as-is — backward compatible with existing log display.

**Why not Node IPC (`process.send`):** The child is spawned with `stdio: ['ignore', 'pipe', 'pipe']`. Adding IPC requires changing spawn options to include `'ipc'` channel AND the child must call `process.send()`. This is a larger change with no benefit over JSON lines for this use case. JSON lines are also easier to grep in logs.

**Why not stderr for errors:** stderr is already prefixed `[stderr]` and mixed into the same log array. Separating structured events onto stdout keeps the parsing boundary clean.

---

## Component Boundaries

| Component | Responsibility | Modify or Create |
|-----------|---------------|-----------------|
| `automation-runner.ts` | Spawn child, parse JSON lines, orchestrate retries, expose structured job state | **Modify** |
| `mdland-automation.ts` | Emit JSON line events, implement per-step timeouts, attempt tracking | **Modify** |
| `automate.ts` | Expose `visitResults[]` in GET response | **Modify** (minor) |
| `automation-types.ts` | Shared event/result types used by both parent and child | **Create** |

---

## Data Flow Changes

### Child → Parent (structured events)

Child emits JSON lines to stdout at key moments:

```
VISIT_START   → {type:"visit_start", patient, dos, attempt}
VISIT_RESULT  → {type:"visit_result", patient, dos, success, step, error, duration, attempt}
PROGRESS      → {type:"progress", completed, total}
BATCH_SUMMARY → {type:"batch_summary", succeeded, failed, totalMs}
```

Parent parses each stdout line:
- If `line.startsWith('{')` → try `JSON.parse`, route by `type`
- Otherwise → append to `logs[]` as plain text (existing behavior preserved)

### Retry Orchestration: Child Process

Retry logic belongs in the child (`mdland-automation.ts`), not the parent. Reasons:

1. The browser context is alive in the child. Retrying from the parent means killing and re-spawning the entire browser — expensive and loses session state.
2. The child already has `processVisit()` as a discrete unit. Wrapping it in a retry loop is a 10-line change.
3. The parent's job is process lifecycle, not visit-level logic.

Retry strategy for `processVisit()`:

```
attempt 1 → fail → closeVisit() → wait 2s → attempt 2 → fail → closeVisit() → wait 4s → attempt 3 → record final failure
```

Max attempts: 3 (configurable via CLI arg `--max-retries`). Exponential backoff: `2^attempt * 1000ms`. Only retry on transient errors (timeout, element not found). Do not retry on session-expired or patient-not-found errors — these are permanent failures.

### Adaptive Timeouts

Replace the single `page.setDefaultTimeout(30000)` with per-operation timeouts passed explicitly:

```typescript
const TIMEOUTS = {
  navigation: 15000,   // page.goto, waitForNavigation
  element:    10000,   // waitForSelector, locator.click
  network:    20000,   // fetch-heavy operations (search results)
  save:       15000,   // form save operations
  billing:    20000,   // billing generation (slowest step)
}
```

"Adaptive" in this context means: on retry attempt N, multiply base timeout by `1 + (attempt * 0.5)`. Attempt 1 = 1x, attempt 2 = 1.5x, attempt 3 = 2x. This handles transient slowness without permanently inflating timeouts.

Pass timeouts explicitly to each Playwright call rather than relying on `setDefaultTimeout`. This makes each step's budget visible and independently tunable.

---

## Patterns to Follow

### Pattern 1: JSON Line Emission (child)

```typescript
function emit(event: AutomationEvent): void {
  process.stdout.write(JSON.stringify(event) + '\n')
}
```

One function, called at visit start/end and batch summary. No other changes to console.log usage.

### Pattern 2: JSON Line Parsing (parent)

```typescript
child.stdout?.on('data', (data: Buffer) => {
  for (const line of data.toString().split('\n').filter(l => l.trim())) {
    if (line.startsWith('{')) {
      try {
        const event = JSON.parse(line) as AutomationEvent
        handleEvent(event)
        continue
      } catch { /* fall through to plain log */ }
    }
    appendLog(line)
  }
})
```

### Pattern 3: Retry Wrapper (child)

```typescript
async function withRetry(
  fn: (attempt: number) => Promise<VisitResult>,
  maxAttempts: number
): Promise<VisitResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn(attempt)
    if (result.success || attempt === maxAttempts) return result
    if (isPermanentError(result.error)) return result
    await sleep(Math.pow(2, attempt) * 1000)
  }
  // unreachable
  throw new Error('retry exhausted')
}
```

### Pattern 4: Structured Job State (parent)

Extend `AutomationJob` to include `visitResults`:

```typescript
interface VisitResult {
  readonly patient: string
  readonly dos: number
  readonly success: boolean
  readonly step?: string        // which step failed
  readonly error?: string
  readonly duration: number
  readonly attempts: number
}

interface AutomationJob {
  // ... existing fields ...
  readonly visitResults: readonly VisitResult[]
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Retry in Parent via Re-spawn
**What:** Parent kills child on failure, re-spawns with `--resume-from` flag
**Why bad:** Loses browser context, re-authenticates, 30s+ overhead per retry, complex resume logic
**Instead:** Retry within the child's existing browser session

### Anti-Pattern 2: Global Timeout Inflation
**What:** Raise `page.setDefaultTimeout()` from 30s to 60s to reduce timeouts
**Why bad:** Doubles worst-case time for every stuck operation; masks real failures
**Instead:** Per-operation timeouts with retry-scaled multipliers

### Anti-Pattern 3: IPC Channel for Events
**What:** Add `ipc` to spawn stdio, use `process.send()` / `child.on('message')`
**Why bad:** Requires changing spawn options, adds Node IPC serialization, no benefit over JSON lines for this volume
**Instead:** JSON lines on existing stdout pipe

### Anti-Pattern 4: Permanent Error Retry
**What:** Retry all errors including "Session expired" or "Patient not found"
**Why bad:** Wastes time on errors that won't resolve without human intervention
**Instead:** `isPermanentError()` guard — skip retry for session/auth/not-found errors

---

## Scalability Considerations

This is a single-server, single-automation-at-a-time system. Scalability concerns are not relevant for this milestone. The singleton lock in `automation-runner.ts` is intentional and should not be removed.

---

## Build Order

Dependencies drive this order:

1. **`automation-types.ts`** (new) — defines `AutomationEvent`, `VisitResult` with `attempts` field, `AutomationJob` extension. No deps. Both parent and child import from here.

2. **`mdland-automation.ts`** (modify) — add `emit()`, per-operation timeouts, retry wrapper in `processVisit()`. Depends on types from step 1.

3. **`automation-runner.ts`** (modify) — add JSON line parser, populate `visitResults[]` on job state. Depends on types from step 1.

4. **`automate.ts`** (modify, minor) — `visitResults` is already on `AutomationJob` via step 3; GET response includes it automatically. Verify the shape is exposed correctly.

---

## Integration Points Summary

| Integration Point | Change Type | Files |
|-------------------|-------------|-------|
| stdout line parsing | Add JSON branch to existing data handler | `automation-runner.ts` L218-223 |
| Job state shape | Add `visitResults[]` field | `automation-runner.ts` L56-64 |
| Visit processing | Wrap `processVisit()` in retry loop | `mdland-automation.ts` L1020-1082 |
| Timeout values | Replace `setDefaultTimeout` with per-op constants | `mdland-automation.ts` L198 |
| Event emission | Add `emit()` calls at visit start/end | `mdland-automation.ts` L1020, L1054, L1073 |
| Shared types | New file | `server/services/automation-types.ts` |

---

## Sources

- Code analysis: `automation-runner.ts` (268 lines), `mdland-automation.ts` (1296 lines), `automate.ts` (167 lines) — HIGH confidence (direct source read)
- Node.js child_process stdio IPC vs pipe tradeoffs — HIGH confidence (Node.js docs, well-established pattern)
- Playwright per-locator timeout override — HIGH confidence (Playwright API: all locator methods accept `{ timeout }` option)
- JSON Lines format (ndjson) — HIGH confidence (standard pattern for structured logging in CLI tools)
