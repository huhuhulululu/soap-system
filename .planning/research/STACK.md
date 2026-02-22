# Stack Research

**Domain:** Playwright automation stability — retry, error reporting, adaptive timeouts
**Researched:** 2026-02-22
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| async-retry | 1.3.3 | Per-step retry with exponential backoff | CJS-native, no ESM friction with this project's module system. Simple API: `retry(fn, { retries, factor, minTimeout })`. Battle-tested (sindresorhus lineage). |
| pino | 10.3.1 | Structured JSON logging | Fastest Node.js logger. CJS-compatible. JSON output by default — grep/filter step-level errors without parsing. Child loggers carry `batchId`/`visitId` context automatically. |
| pino-http | 11.0.0 | HTTP request logging middleware | Pairs with pino to log Express requests with same structured format. Adds `req.log` child logger per request. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/async-retry | 1.4.9 | TypeScript types for async-retry | Always — project is full TypeScript |

## Installation

```bash
# Core additions
npm install async-retry pino pino-http

# Types
npm install -D @types/async-retry
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| async-retry@1.3.3 | p-retry@7.1.1 | Only if project migrates to ESM (`"type": "module"` in package.json). p-retry v7 is ESM-only and will throw `ERR_REQUIRE_ESM` in this CJS project. |
| async-retry@1.3.3 | cockatiel@3.2.1 | If circuit-breaker or bulkhead patterns are needed later. Overkill for per-visit retry now. |
| pino@10.3.1 | winston | Never for this project. Winston is 5-10x slower, adds no value over pino for structured JSON output. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| p-retry@7+ | ESM-only. This project has no `"type": "module"` — `require()` will fail at runtime. | async-retry@1.3.3 |
| Custom `setTimeout` retry loops | No backoff, no jitter, no max-attempts enforcement — leads to thundering herd against MDLand. | async-retry with `factor: 2, minTimeout: 1000` |
| `console.log` for step errors | Unstructured, unsearchable, violates project coding style rules. | pino child logger with `{ step, visitId, batchId }` |
| Playwright `page.setDefaultTimeout()` globally | Overrides all timeouts uniformly — slow steps mask fast failures. | Per-action `{ timeout }` option on individual `page.click()` / `page.waitForSelector()` calls |

## Stack Patterns by Variant

**For per-visit retry (automation loop):**
- Use async-retry wrapping the per-visit automation function
- Pass `onFailedAttempt` callback to log attempt number + error to pino before retrying
- Set `retries: 3, factor: 2, minTimeout: 1500, maxTimeout: 10000`

**For adaptive timeouts:**
- No new library needed — Playwright's built-in per-action `timeout` option is sufficient
- Pattern: fast actions (click, fill) get 5000ms; navigation/load gets 30000ms; post-submit confirmation gets 15000ms
- Derive timeout from step type, not a single global value

**For structured error classification:**
- No new library needed — classify in application code using error message pattern matching
- Categories: `TIMEOUT | SELECTOR_NOT_FOUND | AUTH_EXPIRED | NETWORK | UNKNOWN`
- Attach `{ errorClass, step, attempt }` to pino log fields

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| async-retry@1.3.3 | Node.js 14+ | No peer dependency conflicts with current stack |
| pino@10.3.1 | Node.js 18+ | Project runs Node 20 in Docker — compatible |
| pino-http@11.0.0 | Express 5 | Tested with Express 5 middleware signature |

## Sources

- npm registry — async-retry@1.3.3, pino@10.3.1, pino-http@11.0.0, p-retry@7.1.1 versions verified 2026-02-22
- [p-retry ESM-only confirmation](https://www.npmjs.com/package/p-retry) — v7 `"type": "module"`, v4 CJS
- [Pino vs Winston comparison](https://betterstack.com/community/comparisons/pino-vs-winston/) — MEDIUM confidence (third-party, consistent with official pino benchmarks)
- [Playwright timeout patterns](https://circleci.com/blog/mastering-waits-and-timeouts-in-playwright/) — MEDIUM confidence (per-action timeout approach)
- [Playwright retry APIs](https://www.timdeschryver.dev/blog/the-different-retry-apis-from-playwright) — MEDIUM confidence (built-in retry scope)

---
*Stack research for: Playwright automation stability (retry, structured errors, adaptive timeouts)*
*Researched: 2026-02-22*
