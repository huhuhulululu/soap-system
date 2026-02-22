# Pitfalls Research

**Domain:** Playwright browser automation — adding retry/resilience to existing EHR submission system
**Researched:** 2026-02-22
**Confidence:** HIGH (based on direct codebase analysis + verified patterns)

---

## Critical Pitfalls

### Pitfall 1: Retry Without State Reset Creates Duplicate EHR Entries

**What goes wrong:**
A visit fails mid-way (e.g., after `addICDCodes` succeeds but `saveSOAP` times out). On retry, the code re-enters ICD codes into a form that already has them, creating duplicate billing codes in MDLand. The EHR has no deduplication — it appends whatever is submitted.

**Why it happens:**
The current `processVisit` flow is linear: ICD → SOAP → Checkout. If it fails at step 2, step 1 has already mutated EHR state. Retry naively re-runs from step 1. The page is not reset between attempts — `openVisit()` is not re-called, so the iframe state from the failed attempt persists.

**How to avoid:**
- Before any retry, call `closeVisit()` then re-navigate: `clickWaitingRoom()` → `searchPatient()` → `selectPatient()` → `openVisit()`. This reloads the iframe tree from scratch.
- Read current ICD/CPT state from the diagnose iframe before adding codes. If codes already exist, skip the add step.
- Track which steps completed per visit attempt. Only retry from the last failed step if the completed steps are idempotent (SOAP fill is safe to repeat; ICD add is not).

**Warning signs:**
- Retry succeeds but MDLand shows doubled ICD/CPT codes on the visit
- `addICDCodes` throws "already exists" or silently appends duplicates
- Billing amounts are doubled after a retry run

**Phase to address:** Retry/recovery phase — must be the first thing designed before any retry loop is written.

---

### Pitfall 2: Stale Execution Context After Navigation

**What goes wrong:**
After a failed `saveSOAP()` or `generateBilling()`, the page may have partially navigated. Any subsequent `page.evaluate()` call throws `Execution context was destroyed, most likely because of a navigation`. The retry attempt then fails with a confusing error that masks the original failure.

**Why it happens:**
`saveSOAP()` dispatches mouse events that trigger an AJAX save + iframe reload. If the save times out, the iframe is mid-reload. The `waitForTimeout(3000)` after billing is a fixed sleep that doesn't confirm the navigation completed. On retry, `page.evaluate()` runs against a destroyed context.

**How to avoid:**
- After any save/submit action, wait for a stable DOM signal (e.g., `waitForFunction` checking `readyState === 'complete'` on the target iframe) before proceeding.
- Wrap every `page.evaluate()` in a try/catch that detects `Execution context was destroyed` and triggers a full page-state reset rather than propagating the error as a visit failure.
- Never use `waitForTimeout` as the sole post-save guard. It is a race condition.

**Warning signs:**
- Error messages containing "Execution context was destroyed"
- Errors on the retry attempt that reference a different step than where the original failure occurred
- Screenshots showing a blank or loading iframe

**Phase to address:** Retry/recovery phase — the reset sequence must handle destroyed contexts explicitly.

---

### Pitfall 3: Hardcoded `timeout: 30000` Applied Globally Causes Cascading Failures

**What goes wrong:**
`DEFAULT_OPTIONS.timeout = 30000` is passed to `page.setDefaultTimeout()`. This applies to every `waitForSelector`, `waitForFunction`, and locator action. On a slow network day, TinyMCE initialization (currently `waitForFunction` with `timeout: 20000`) fails, which fails the entire visit. Increasing the global timeout to compensate causes slow failures to take 30s each, making a 20-visit batch take 10+ minutes just in timeout overhead.

**Why it happens:**
A single global timeout cannot fit both fast operations (clicking a button: should fail in 5s) and slow operations (TinyMCE init: legitimately needs 20s). The current code mixes both under one value.

**How to avoid:**
- Keep `page.setDefaultTimeout()` at a conservative value (10–15s) for UI interactions.
- Override per-operation for known slow steps: `waitForFunction(..., { timeout: 25000 })` for TinyMCE, `waitForFunction(..., { timeout: 20000 })` for post-save iframe reload.
- Do not "fix" flakiness by raising the global timeout. Diagnose which specific step is slow and tune only that step.

**Warning signs:**
- Batch runs taking significantly longer than expected with no visible errors
- Timeout errors on steps that previously succeeded (indicates the step got slower, not that the timeout is wrong)
- All timeouts failing at exactly the same duration (global timeout is masking per-step tuning)

**Phase to address:** Adaptive timeout phase — implement per-step timeout constants before tuning values.

---

### Pitfall 4: Error Classification Collapses All Failures Into One Category

**What goes wrong:**
The current `processVisit` catch block returns `{ success: false, error: errorMsg }` for every failure — session expired, element not found, network timeout, and EHR business logic errors all look identical. When building retry logic, the code retries session-expired errors (which will always fail until cookies are refreshed) and skips retryable network timeouts.

**Why it happens:**
`err instanceof Error ? err.message : String(err)` loses all structural information. The error message is a free-form string from Playwright or from `throw new Error(...)` calls scattered through the automation methods.

**How to avoid:**
Classify errors at the point of throw, not at the catch site. Use a small enum:
```typescript
type AutomationErrorKind =
  | 'session_expired'    // cookies invalid — stop entire batch
  | 'element_not_found'  // selector missing — retry with page reset
  | 'timeout'            // network/render slow — retry with backoff
  | 'ehr_logic'          // EHR rejected the data — skip, do not retry
  | 'unknown'
```
Map Playwright error messages to kinds: `TimeoutError` → `timeout`, `session expired` in URL → `session_expired`, `not found` in message → `element_not_found`.

**Warning signs:**
- Retry logic retrying session-expired visits (wastes time, always fails)
- Timeout errors being treated as permanent failures (skips visits that would succeed on retry)
- No way to distinguish "MDLand rejected the ICD code" from "page didn't load"

**Phase to address:** Structured error reporting phase — must precede retry logic. You cannot write correct retry conditions without error kinds.

---

### Pitfall 5: Child Process Model Loses Per-Visit Progress on Crash

**What goes wrong:**
The automation runs as a child process spawned by `automation-runner.ts`. If the process crashes (OOM, unhandled rejection, Playwright browser crash), `currentJob.status` becomes `'failed'` with no record of which visits succeeded before the crash. Re-running the batch re-processes all visits, including already-completed ones.

**Why it happens:**
`VisitResult[]` is accumulated in memory inside the child process. It is never written to disk or reported back to the parent process incrementally. The parent only sees stdout lines and the final exit code.

**How to avoid:**
- Write a progress file (e.g., `data/automation-progress-{batchId}.json`) after each visit completes, recording `{ visitKey, success, completedAt }`.
- On batch start, read the progress file and skip already-completed visits.
- The visit key must be stable: `${patientName}-${dos}-${noteType}` not array index.

**Warning signs:**
- After a crash, re-running the batch produces duplicate EHR entries for visits that completed before the crash
- No way to resume a partial batch without manual inspection of MDLand

**Phase to address:** Retry/recovery phase — progress persistence is a prerequisite for safe retry.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `waitForTimeout(2000)` as post-save guard | Simple, works most of the time | Race condition on slow days; masks real completion signal | Never — replace with `waitForFunction` |
| Global `console.log` for all output | Easy to read during dev | No log levels; can't filter errors from progress; child process stdout is the only channel | Never in production automation |
| Single `catch` block for all errors | Simple error handling | Cannot implement correct retry logic without error classification | Never once retry is added |
| Fixed `visitIndex` for visit mapping | Simple array access | Breaks if MDLand row order changes between visits; causes wrong-visit submission | Never — use stable visit key |
| `slowMo: 100` always on | Reduces race conditions | Adds ~2-5s per visit; 20 visits = 40-100s overhead | Acceptable for now; tune per environment |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MDLand TinyMCE | Calling `setContent` before `getInstanceById` returns non-null | Wait for `typeof tinyMCE.getInstanceById === 'function'` AND call `getInstanceById` and check result is non-null before setting content |
| MDLand iframe tree | Accessing `contentDocument` without checking `readyState` | Check `readyState === 'complete'` or wait for URL pattern before accessing nested iframe documents |
| MDLand `letsGo(2)` save | Assuming save is synchronous after call | Wait for iframe URL to cycle back to `ov_icdcpt` — the save triggers a server round-trip and iframe reload |
| MDLand session cookies | Reusing stale cookies silently | `validateSession()` only checks for `workarea0` presence; a session can be partially valid (page loads but actions fail). Check after first real action, not just on init. |
| Child process stdout | Treating all stdout as structured data | Playwright and tsx both write to stdout. Parse only lines matching a known prefix pattern for structured progress reporting. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `waitForTimeout` accumulation | Each visit takes 8-12s in sleeps alone (6 × 1-2s waits) | Replace with event-driven waits; keep sleeps only where MDLand has no observable completion signal | At 20+ visits per batch |
| Screenshot on every step | `--screenshot` flag creates 6+ PNGs per visit; disk fills on Oracle Cloud's limited storage | Screenshots only on error by default; `--screenshot` flag for debug runs only | At 50+ visits |
| Re-searching patient for every visit | `clickWaitingRoom` + `searchPatient` + `selectPatient` + `sortByApptTime` repeated N times per patient | Cache patient row state; only re-search if visit navigation fails | At 3+ visits per patient |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Temp cookie file `.tmp-cookies.json` left on disk after crash | Plaintext MDLand session credentials readable by any process | `cleanupTempCookies()` is called in `child.on('close')` but not if the parent process crashes. Add cleanup on `SIGTERM`/`SIGINT` in the child process itself. |
| Error messages including patient name + DOB in logs | PHI in log files | Structured errors should use visit keys (e.g., `visit-3`) not patient identifiers in error strings |
| Screenshot files named with patient name | PHI in filesystem | Name screenshots with `visitKey-timestamp.png` not `patient.name` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Retry logic:** Verify it calls `closeVisit()` + full re-navigation before re-attempting, not just re-calling `processVisit()` on the existing page state
- [ ] **Error classification:** Verify session-expired errors stop the batch immediately rather than retrying all remaining visits
- [ ] **Progress persistence:** Verify a crash mid-batch does not cause duplicate EHR entries on re-run
- [ ] **Timeout tuning:** Verify per-step timeouts are named constants, not magic numbers scattered through the code
- [ ] **ICD idempotency:** Verify retry reads existing codes before adding — MDLand appends, it does not replace
- [ ] **Structured errors:** Verify the parent process (automation-runner.ts) receives structured per-visit results, not just exit code 0/1

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate ICD/CPT from non-idempotent retry | HIGH | Manual MDLand review and deletion of duplicate codes per affected visit; no automated recovery possible |
| Stale execution context crash | LOW | Re-run batch with progress file; completed visits are skipped |
| Session expired mid-batch | LOW | Re-upload cookies, re-run; progress file skips completed visits |
| Wrong visit mapped (row order mismatch) | HIGH | Manual MDLand review; SOAP content in wrong visit requires manual correction |
| Temp cookie file left on disk | MEDIUM | `rm data/.tmp-cookies.json`; rotate MDLand session by re-logging in |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Duplicate EHR entries from non-idempotent retry | Retry/recovery — design idempotency check before retry loop | Run a visit twice; confirm MDLand shows codes only once |
| Stale execution context | Retry/recovery — add context-destroyed detection to reset handler | Simulate mid-save timeout; verify retry re-navigates cleanly |
| Global timeout masking per-step needs | Adaptive timeout — extract per-step timeout constants | Each step has a named timeout constant; no magic numbers |
| Error classification collapse | Structured error reporting — implement error kinds before retry | Verify session-expired stops batch; timeout triggers retry |
| Progress lost on crash | Retry/recovery — progress file written after each visit | Kill process mid-batch; re-run; verify no duplicate submissions |
| PHI in error logs/screenshots | Structured error reporting — use visit keys not patient names | Grep logs for patient name patterns; should return nothing |

---

## Sources

- Direct codebase analysis: `scripts/playwright/mdland-automation.ts`, `server/services/automation-runner.ts`
- Playwright execution context destruction: https://stackoverflow.com/questions/63523187/playwright-reload-page-after-navigation-if-certain-status-code
- Playwright flaky test patterns: https://betterstack.com/community/guides/testing/avoid-flaky-playwright-tests/
- Playwright timeout handling: https://www.lambdatest.com/blog/playwright-timeouts/
- Playwright session state pitfalls: https://www.testleaf.com/blog/playwright-ai-session-preservation-failure-triage-ci/
- EHR double data entry risks: https://www.anisolutions.com/2026/02/10/reducing-double-data-entry-in-ehr-with-integration/

---
*Pitfalls research for: Playwright automation retry/resilience — MDLand EHR SOAP submission*
*Researched: 2026-02-22*
