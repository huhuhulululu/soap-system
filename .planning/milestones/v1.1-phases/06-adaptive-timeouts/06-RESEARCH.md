# Phase 6: Adaptive Timeouts - Research

**Researched:** 2026-02-22
**Domain:** Playwright timeout configuration — per-operation constants
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Support `TIMEOUT_MULTIPLIER` env var (single multiplier, default 1.0)
- Single `TIMEOUTS` constants object as source of truth
- All `{ timeout: N }` hardcoded values replaced with named constants
- No per-timeout environment variables

### Claude's Discretion
- Exact timeout values for each operation
- Number of tiers and grouping strategy
- Global `setDefaultTimeout` handling (remove vs set reasonable default)
- Constant naming convention
- Grace period / tolerance behavior

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TMO-01 | Each automation step uses operation-specific timeout instead of global 30s default | Replace `timeout: 30000` in `DEFAULT_OPTIONS` and all 9 inline `{ timeout: N }` values with named constants from a single `TIMEOUTS` object |
</phase_requirements>

---

## Current Timeout Landscape

Every timeout found in `scripts/playwright/mdland-automation.ts`:

| Line | Value | Type | Operation | Method |
|------|-------|------|-----------|--------|
| 110 | 30000 | global default | `DEFAULT_OPTIONS.timeout` → `page.setDefaultTimeout()` | `init()` |
| 192 | (uses options.timeout) | global apply | `page.setDefaultTimeout(this.options.timeout)` | `init()` |
| 222 | 15000 | `page.goto` timeout | Navigate to MDLand main page | `validateSession()` |
| 226 | 3000 | `waitForTimeout` | Wait after navigation before checking login | `validateSession()` |
| 251 | 10000 | `waitForSelector` | Wait for workarea0 iframe | `validateSession()` |
| 291 | 10000 | `waitForFunction` | Wait for WL div visible | `clickWaitingRoom()` |
| 293 | 1000 | `waitForTimeout` | Settle after WL opens | `clickWaitingRoom()` |
| 331 | 500 | `waitForTimeout` | Settle after radio click | `clickOnePatient()` |
| 347 | 200 | `waitForTimeout` | Settle after input fill | `searchPatient()` |
| 355 | 10000 | `waitFor` | Wait for search results | `searchPatient()` |
| 359 | 500 | `waitForTimeout` | Settle after search | `searchPatient()` |
| 395 | 2000 | `waitForTimeout` | Settle after patient selected | `selectPatient()` |
| 425 | 1500 | `waitForTimeout` | Settle after sort click | `sortByApptTime()` |
| 530 | 15000 | `waitForFunction` | Wait for ov_doctor_spec URL | `openVisit()` |
| 532 | 2000 | `waitForTimeout` | Settle after visit opens | `openVisit()` |
| 562 | 15000 | `waitForFunction` | Wait for ov_icdcpt URL | `navigateToICD()` |
| 564 | 1000 | `waitForTimeout` | Settle after ICD page loads | `navigateToICD()` |
| 610 | 500 | `waitForTimeout` | Settle after ICD codes added | `addICDCodes()` |
| 687 | 500 | `waitForTimeout` | Settle after CPT codes added | `addCPTCodes()` |
| 711 | 2000 | `waitForTimeout` | Settle after letsGo() call | `saveDiagnose()` |
| 718 | 15000 | `waitForFunction` | Wait for ov_icdcpt reload after save | `saveDiagnose()` |
| 752 | 20000 | `waitForFunction` | Wait for TinyMCE init in ptnote | `navigateToPTNote()` |
| 754 | 1000 | `waitForTimeout` | Settle after PT Note loads | `navigateToPTNote()` |
| 857 | 3000 | `waitForTimeout` | Settle after SavePage click | `saveSOAP()` |
| 864 | 15000 | `waitForFunction` | Wait for ptnote readyState complete | `saveSOAP()` |
| 890 | 15000 | `waitForFunction` | Wait for checkout URL | `navigateToCheckout()` |
| 892 | 1000 | `waitForTimeout` | Settle after checkout loads | `navigateToCheckout()` |
| 941 | 3000 | `waitForTimeout` | Settle after billing click | `generateBilling()` |
| 973 | 10000 | `waitForFunction` | Wait for emptyarea URL after close | `closeVisit()` |
| 976 | 1000 | `waitForTimeout` | Settle after visit closed | `closeVisit()` |

**Total:** 1 global default + 29 inline timeout usages across 11 methods.

---

## Global Default

- **Where set:** `DEFAULT_OPTIONS.timeout = 30000` (L110), applied via `this.page.setDefaultTimeout(this.options.timeout)` (L192)
- **Effect:** Any Playwright action without an explicit `{ timeout: N }` falls back to 30s
- **Problem:** Inflated default masks slow operations and makes fast operations appear to succeed even when they hang for up to 30s before failing

---

## Operation Speed Categories

Based on what each operation actually does:

**FAST — UI interactions, no network/render wait (200–500ms settle)**
- `clickOnePatient()` settle: 500ms
- `searchPatient()` input fill settle: 200ms
- `searchPatient()` post-search settle: 500ms
- `addICDCodes()` settle: 500ms
- `addCPTCodes()` settle: 500ms
- `navigateToICD()` settle: 1000ms
- `navigateToPTNote()` settle: 1000ms
- `navigateToCheckout()` settle: 1000ms
- `closeVisit()` settle: 1000ms

**MEDIUM — Page navigation, iframe URL change (10–15s wait)**
- `validateSession()` goto: 15000ms
- `validateSession()` workarea0 selector: 10000ms
- `clickWaitingRoom()` WL div visible: 10000ms
- `searchPatient()` results appear: 10000ms
- `openVisit()` ov_doctor_spec URL: 15000ms
- `navigateToICD()` ov_icdcpt URL: 15000ms
- `saveDiagnose()` ov_icdcpt reload: 15000ms
- `saveSOAP()` ptnote readyState: 15000ms
- `navigateToCheckout()` checkout URL: 15000ms
- `closeVisit()` emptyarea URL: 10000ms

**SLOW — TinyMCE init, SOAP save, billing (20–30s wait)**
- `navigateToPTNote()` TinyMCE init: 20000ms (currently the highest explicit value)
- `saveSOAP()` settle after click: 3000ms (SOAP save is slow — server round-trip)
- `generateBilling()` settle: 3000ms (billing generation is slow)
- `selectPatient()` settle: 2000ms (MDLand re-renders patient panel)
- `openVisit()` settle: 2000ms (ov_doctor_spec full render)
- `saveDiagnose()` settle: 2000ms (letsGo() triggers server save)
- `sortByApptTime()` settle: 1500ms (table re-sort)
- `validateSession()` post-nav wait: 3000ms

---

## Phase 5 Integration Points

Phase 5 (`automation-types.ts`) classifies `TimeoutError` as `errorKind: 'timeout'` (transient). This means:

- When a named timeout constant fires and Playwright throws `TimeoutError`, `classifyError()` already handles it correctly — no changes needed to `automation-types.ts`
- `isPermanentError('timeout')` returns `false` — Phase 7 retry will retry timeout failures
- The `failedStep` field (set by `currentStep` tracking) will identify which specific step timed out, giving Phase 7 the context to retry intelligently

No changes to `automation-types.ts` are needed for Phase 6.

---

## Existing Patterns

**No existing constants file for timeouts.** The only shared constants file is `server/services/automation-types.ts` (error types + VisitResult). There is no `constants.ts`, `config.ts`, or similar in either `scripts/playwright/` or `server/services/`.

**`DEFAULT_OPTIONS` pattern** (L103–111): The automation already uses a typed options object. The `timeout` field there is the global default. This is the natural place to see the pattern — but it's a single value, not per-operation.

**`SELECTORS` const object** (L117–151): The codebase already uses a named constants object pattern for selectors. `TIMEOUTS` follows the same pattern.

---

## Implementation Considerations

**Where to define `TIMEOUTS`:** In `scripts/playwright/mdland-automation.ts` itself, near the top alongside `SELECTORS`. It does not need to be in `server/services/` since it's only consumed by the automation script. No cross-process sharing needed.

**`TIMEOUT_MULTIPLIER` application:** Must be applied at read time, not definition time. The multiplier is an env var read once at module load:

```typescript
const MULTIPLIER = parseFloat(process.env.TIMEOUT_MULTIPLIER ?? '1') || 1

const TIMEOUTS = {
  // wait values
  NAV_PAGE:    Math.round(15000 * MULTIPLIER),
  TINYMCE:     Math.round(20000 * MULTIPLIER),
  IFRAME_LOAD: Math.round(15000 * MULTIPLIER),
  CLOSE_VISIT: Math.round(10000 * MULTIPLIER),
  SEARCH:      Math.round(10000 * MULTIPLIER),
  // settle values (waitForTimeout — these scale too for slow days)
  SETTLE_SLOW:   Math.round(3000 * MULTIPLIER),
  SETTLE_MEDIUM: Math.round(2000 * MULTIPLIER),
  SETTLE_FAST:   Math.round(1000 * MULTIPLIER),
  SETTLE_QUICK:  Math.round(500  * MULTIPLIER),
  SETTLE_MICRO:  Math.round(200  * MULTIPLIER),
} as const
```

**`setDefaultTimeout` handling:** Keep it but set it to a high safety-net value (e.g., `TIMEOUTS.NAV_PAGE`) rather than removing it. Removing it would cause Playwright to use its own default (30s). Setting it to `NAV_PAGE` (15s) means any unlabeled action gets a reasonable cap, not an inflated 30s.

**`DEFAULT_OPTIONS.timeout` field:** Can be removed or kept as a passthrough. Since `TIMEOUTS` is now the source of truth and `setDefaultTimeout` is called with a named constant, the `timeout` field in `AutomationOptions` becomes redundant. Safest: remove it from the interface and the `DEFAULT_OPTIONS` object, call `setDefaultTimeout(TIMEOUTS.NAV_PAGE)` directly in `init()`.

**`waitForTimeout` settle values:** These are not Playwright action timeouts — they are deliberate pauses. They should still scale with `MULTIPLIER` since slow days mean MDLand renders slower too.

**Risk — over-tight TinyMCE timeout:** The 20s TinyMCE wait (L752) is already the tightest it can be for a slow MDLand instance. Do not reduce it. If anything, consider 25s as the named constant value.

**Risk — `validateSession()` 3s wait (L226):** This is a fixed pause before checking for login form. It should not be reduced below 2s or session checks will false-positive on slow loads.

---

## Sources

### Primary (HIGH confidence)
- Direct read: `/scripts/playwright/mdland-automation.ts` — all 30 timeout usages catalogued line by line
- Direct read: `/server/services/automation-types.ts` — Phase 5 error classification, `timeout` kind
- Direct read: `.planning/phases/06-adaptive-timeouts/06-CONTEXT.md` — locked decisions

**Research date:** 2026-02-22
**Valid until:** 2026-03-22
