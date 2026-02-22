# Feature Research

**Domain:** Browser automation stability — Playwright EHR submission (MDLand)
**Researched:** 2026-02-22
**Confidence:** HIGH (based on code inspection + verified patterns)

## Context: What Already Exists

The existing `mdland-automation.ts` has:
- Per-visit `try/catch` that catches errors and continues to next visit (non-fatal)
- `console.log` step logging (no structure, no machine-readable events)
- Hardcoded `waitForTimeout` calls: 500ms, 1000ms, 2000ms, 3000ms scattered throughout
- Single global `timeout: 30000` on `page.setDefaultTimeout`
- Error screenshot on failure (good)
- No retry of any kind — one failure = that visit is permanently skipped
- `VisitResult` captures `success`, `error`, `duration` but no step-level detail

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the operator expects from any production automation. Missing these means visits silently fail with no recovery path.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-visit retry (1-2 attempts) | Transient DOM timing failures are common in iframe-heavy EHRs; one retry recovers ~60-80% of flaky failures | LOW | Wrap `processVisit` call; re-navigate to visit before retry |
| Error classification (transient vs permanent) | Determines whether to retry or skip; retrying a "patient not found" wastes time and risks data corruption | LOW | String-match on error message: timeout/not found in DOM = transient; "Patient not found" = permanent |
| Step-level error context | `"Visit failed"` is useless for debugging; `"failed at: navigateToICD → diagnose iframe not accessible"` is actionable | LOW | Add `currentStep` string to `processVisit` scope, include in `VisitResult.error` |
| Structured `VisitResult` with step detail | Downstream reporting (API status endpoint) needs machine-readable failure info, not log-scraping | LOW | Extend existing `VisitResult` interface with `failedStep?: string` and `retryCount: number` |
| Configurable per-operation timeouts | `waitForFunction` on TinyMCE load needs 20s; `waitForTimeout` polite delays need 500ms; one global 30s is wrong for both | MEDIUM | Replace scattered hardcoded values with a `TIMEOUTS` constants object; different values per operation class |

### Differentiators (Competitive Advantage)

Features that meaningfully improve reliability beyond baseline retry.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Exponential backoff on retry | Avoids hammering a slow EHR server; gives MDLand time to recover from transient state | LOW | `delay = baseDelay * 2^attempt` with jitter; base 2s, max 8s, 2 retries = max 18s added per visit |
| Progress events emitted to stdout | Enables the `automation-runner.ts` log buffer to show structured progress (e.g. `STEP:navigateToICD:start`) rather than raw console.log; frontend can parse and display | MEDIUM | Emit JSON lines to stdout: `{"event":"step","step":"navigateToICD","status":"start","visitIdx":2}` |
| Visit-level idempotency check | Before retrying a visit, verify it wasn't partially saved (check if SOAP already has content); prevents double-submission | HIGH | Requires reading back TinyMCE content after navigation — complex iframe traversal; defer unless double-submit incidents occur |
| Adaptive timeout scaling | Detect slow network (first navigation took 2x expected) and scale subsequent timeouts proportionally | HIGH | Requires baseline measurement + runtime multiplier; significant complexity for marginal gain on a single-server deployment |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Circuit breaker (stop batch after N consecutive failures) | Prevents wasted time if session expires mid-batch | A session expiry already causes every visit to fail with the same error — a circuit breaker adds complexity without new information | Detect session expiry error class specifically and `process.exit(1)` immediately; already partially done in `validateSession` |
| Per-step retry (retry individual steps like `navigateToICD`) | Seems more granular | Steps within a visit are stateful — retrying `saveSOAP` after partial save risks duplicate data; the visit is the correct atomic unit | Retry at visit level only; re-open the visit fresh from the waiting room list |
| Parallel visit processing | Speed | MDLand is a single-session EHR; parallel page operations on the same `BrowserContext` will corrupt iframe state | Keep sequential; optimize timeout values instead |
| Persistent retry queue (Redis/file) | Resume after crash | File-based storage adds complexity; the batch already tracks `status: 'done'` per visit; re-running the automation with a filtered batch is simpler | Filter already-completed visits at batch load time |

---

## Feature Dependencies

```
Per-visit retry
    └──requires──> Error classification (need to know if retry is safe)
    └──requires──> Step-level error context (need to know where to re-enter)

Progress events
    └──enhances──> Step-level error context (same step tracking, different output)

Exponential backoff
    └──requires──> Per-visit retry (backoff is meaningless without retry)

Configurable timeouts
    └──standalone (no dependencies, safe to add first)
```

### Dependency Notes

- Per-visit retry requires error classification: retrying a permanent error (wrong patient DOB, missing visit row) wastes time and risks side effects. Classification must come first.
- Progress events and step-level error context share the same `currentStep` tracking variable — implement together, zero extra cost.
- Exponential backoff is an enhancement to retry, not a separate feature. Implement in the same change.

---

## MVP Definition

### Launch With (this milestone)

- [x] Configurable timeouts (`TIMEOUTS` constants object) — zero risk, immediate stability improvement
- [x] Step-level error context (`failedStep` in `VisitResult`) — zero risk, high debug value
- [x] Error classification (transient vs permanent) — required gate for safe retry
- [x] Per-visit retry with exponential backoff (2 attempts, 2s/4s delays) — core ask of this milestone

### Add After Validation (v1.x)

- [ ] Progress events to stdout — add when frontend needs live step display, not before
- [ ] Session expiry fast-fail — add if session expiry mid-batch is observed in production

### Future Consideration (v2+)

- [ ] Visit-level idempotency check — only if double-submission incidents are reported
- [ ] Adaptive timeout scaling — only if timeout failures persist after configurable timeouts are tuned

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Configurable timeouts | HIGH | LOW | P1 |
| Step-level error context | HIGH | LOW | P1 |
| Error classification | HIGH | LOW | P1 |
| Per-visit retry + backoff | HIGH | LOW | P1 |
| Progress events to stdout | MEDIUM | MEDIUM | P2 |
| Session expiry fast-fail | MEDIUM | LOW | P2 |
| Visit idempotency check | LOW | HIGH | P3 |
| Adaptive timeout scaling | LOW | HIGH | P3 |

---

## Sources

- Code inspection: `/scripts/playwright/mdland-automation.ts` (existing implementation baseline)
- Playwright retry docs: https://playwright.dev/docs/test-retries
- Exponential backoff pattern: https://www.caduh.com/blog/timeouts-retries-and-backoff
- Error classification (transient vs permanent): https://easyparser.com/blog/api-error-handling-retry-strategies-python-guide
- Browser automation error boundaries: https://moldstud.com/articles/p-the-importance-of-error-boundaries-in-puppeteer-best-practices-explained

---
*Feature research for: Playwright automation stability (retry/recovery, error reporting, timeouts)*
*Researched: 2026-02-22*
