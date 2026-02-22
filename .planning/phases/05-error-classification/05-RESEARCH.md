# Phase 5: Error Classification - Research

**Researched:** 2026-02-22
**Domain:** TypeScript error classification — Playwright automation error handling
**Confidence:** HIGH

## Summary

Phase 5 is a pure TypeScript task: create a shared types file and add an error classification guard. No new libraries are needed. The existing `VisitResult` interface (in `mdland-automation.ts` L96-103) needs two new fields: `failedStep?: string` and `attempts: number`. A new `AutomationErrorKind` type and `isPermanentError()` guard function are the core deliverables.

The current `processVisit()` catch block (L1061-1081) collapses all errors into a single `errorMsg` string with no step context. Phase 5 adds a `currentStep` variable that is updated before each step call, so when the catch fires, `currentStep` is the name of the step that failed. This is a 3-line change to `processVisit()`.

The `isPermanentError()` guard must match against known MDLand error strings. From code inspection, the permanent error patterns are: `"Session expired"` (from `validateSession()`), `"Patient not found:"` (L396), and `"Visit #N not found"` (L527). Playwright `TimeoutError` and element-not-found errors (`"not found"` in message, `"not accessible"`) are transient.

**Primary recommendation:** Create `server/services/automation-types.ts` with the shared types, then make minimal edits to `mdland-automation.ts` to add `currentStep` tracking and `failedStep` in the return value.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ERR-01 | Automation classifies errors as transient (timeout, element not found) or permanent (session expired, patient not found) | `isPermanentError()` string-matches against known MDLand error patterns; Playwright `TimeoutError` name used for timeout classification |
| ERR-02 | Failed visits report which step failed (e.g., fillSOAP, addICD, checkout) in VisitResult | `currentStep` variable updated before each step call in `processVisit()`; included as `failedStep` in the returned `VisitResult` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (existing) | project version | Type definitions, enum/union types | Already in project; no new dep needed |

### Supporting
None — this phase requires zero new dependencies.

**Installation:** none required

## Architecture Patterns

### Recommended Project Structure
```
server/services/
└── automation-types.ts   # NEW: shared types for parent + child

scripts/playwright/
└── mdland-automation.ts  # MODIFY: add currentStep tracking + failedStep in VisitResult
```

### Pattern 1: AutomationErrorKind as string union (not enum)
**What:** A string literal union type for error classification
**When to use:** When the values need to be readable in JSON output and logs
**Example:**
```typescript
// automation-types.ts
export type AutomationErrorKind =
  | 'session_expired'   // cookies invalid — stop batch (ERR-03)
  | 'patient_not_found' // EHR business logic — skip, do not retry
  | 'visit_not_found'   // EHR business logic — skip, do not retry
  | 'timeout'           // network/render slow — retry with backoff
  | 'element_not_found' // selector missing — retry with page reset
  | 'unknown'

export function isPermanentError(kind: AutomationErrorKind): boolean {
  return kind === 'session_expired'
    || kind === 'patient_not_found'
    || kind === 'visit_not_found'
}
```

### Pattern 2: classifyError() maps error messages to kinds
**What:** A pure function that inspects error message strings and returns a kind
**When to use:** Called in the `processVisit()` catch block
**Example:**
```typescript
// automation-types.ts
export function classifyError(err: unknown): AutomationErrorKind {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  if (msg.includes('Session expired') || msg.includes('session expired')) return 'session_expired'
  if (msg.includes('Patient not found')) return 'patient_not_found'
  if (msg.includes('Visit #') && msg.includes('not found')) return 'visit_not_found'
  if (name === 'TimeoutError' || msg.includes('Timeout') || msg.includes('timeout')) return 'timeout'
  if (msg.includes('not found') || msg.includes('not accessible') || msg.includes('not available')) return 'element_not_found'
  return 'unknown'
}
```

### Pattern 3: currentStep tracking in processVisit()
**What:** A mutable local variable updated before each step; captured in catch
**When to use:** Inside `processVisit()` — the only place step sequencing happens
**Example:**
```typescript
async processVisit(patient: PatientData, visit: VisitData): Promise<VisitResult> {
  const start = Date.now()
  let currentStep = 'init'

  try {
    if (this.mode !== 'soap-only') {
      currentStep = 'navigateToICD'; await this.navigateToICD()
      currentStep = 'addICDCodes';   await this.addICDCodes(visit.icdCodes)
      currentStep = 'addCPTCodes';   await this.addCPTCodes(visit.cptCodes)
      currentStep = 'saveDiagnose';  await this.saveDiagnose()
    }
    currentStep = 'navigateToPTNote'; await this.navigateToPTNote()
    currentStep = 'fillSOAP';         await this.fillSOAP(visit.generated.soap, visit.generated.html)
    currentStep = 'saveSOAP';         await this.saveSOAP()
    if (this.mode !== 'soap-only') {
      currentStep = 'navigateToCheckout'; await this.navigateToCheckout()
      currentStep = 'generateBilling';    await this.generateBilling()
    }
    currentStep = 'closeVisit'; await this.closeVisit()
    return { ...existingFields, success: true, duration: Date.now() - start, attempts: 1 }
  } catch (err) {
    const errorKind = classifyError(err)
    return { ...existingFields, success: false, error: msg, failedStep: currentStep, errorKind, duration: Date.now() - start, attempts: 1 }
  }
}
```

### Pattern 4: Extended VisitResult interface
**What:** Add `failedStep`, `errorKind`, `attempts` to the existing interface
**When to use:** Define in `automation-types.ts`; import in `mdland-automation.ts`
**Example:**
```typescript
// automation-types.ts
export interface VisitResult {
  readonly patient: string
  readonly visitIndex: number
  readonly noteType: string
  readonly success: boolean
  readonly error?: string
  readonly failedStep?: string        // ERR-02: which step failed
  readonly errorKind?: AutomationErrorKind  // ERR-01: transient or permanent
  readonly duration: number
  readonly attempts: number           // used by Phase 7 retry
}
```

### Anti-Patterns to Avoid
- **Enum instead of string union:** TypeScript `enum` compiles to an IIFE object; string unions are simpler, JSON-serializable, and sufficient here
- **Classifying at throw site:** Error messages are thrown deep in helper methods; classifying at the `processVisit()` catch boundary is simpler and keeps helpers clean
- **Regex for error matching:** Simple `includes()` is sufficient for these known MDLand error strings; regex adds complexity with no benefit

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error classification | Custom error class hierarchy | String union + `classifyError()` | MDLand errors are plain `throw new Error(msg)` strings; custom classes would require changing all throw sites |

**Key insight:** The error strings are already deterministic — MDLand throws the same messages every time. String matching is the correct tool.

## Common Pitfalls

### Pitfall 1: Incomplete permanent error patterns
**What goes wrong:** `isPermanentError()` misses a session-expired variant, causing Phase 7 retry to retry a dead session
**Why it happens:** MDLand may redirect to login with different URL patterns; `validateSession()` catches it at startup but mid-batch session expiry produces a different error message
**How to avoid:** Check both `"Session expired"` and `"session expired"` (case variants); also check for `"login"` in error messages as a fallback
**Warning signs:** Retry logic retrying the same visit 3 times with identical "Session expired" errors

### Pitfall 2: VisitResult defined in two places
**What goes wrong:** `mdland-automation.ts` has its own local `VisitResult` interface (L96-103); if `automation-types.ts` defines a new one, they diverge
**Why it happens:** The local interface is not exported; it's private to the child script
**How to avoid:** Remove the local `VisitResult` from `mdland-automation.ts` and import from `automation-types.ts` instead. One source of truth.
**Warning signs:** TypeScript errors about incompatible `VisitResult` shapes between files

### Pitfall 3: `attempts` field defaulting to 0
**What goes wrong:** Phase 7 retry reads `attempts` to track how many times a visit was tried; if Phase 5 sets it to `0` instead of `1`, retry counts are off by one
**How to avoid:** `processVisit()` always sets `attempts: 1` — it represents the first attempt. Phase 7 increments this on each retry.

## Code Examples

### Complete automation-types.ts
```typescript
// Source: direct codebase analysis of mdland-automation.ts L96-103, L396, L527

export type AutomationErrorKind =
  | 'session_expired'
  | 'patient_not_found'
  | 'visit_not_found'
  | 'timeout'
  | 'element_not_found'
  | 'unknown'

export interface VisitResult {
  readonly patient: string
  readonly visitIndex: number
  readonly noteType: string
  readonly success: boolean
  readonly error?: string
  readonly failedStep?: string
  readonly errorKind?: AutomationErrorKind
  readonly duration: number
  readonly attempts: number
}

export function classifyError(err: unknown): AutomationErrorKind {
  const msg = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ''
  if (msg.toLowerCase().includes('session expired')) return 'session_expired'
  if (msg.includes('Patient not found')) return 'patient_not_found'
  if (msg.includes('Visit #') && msg.includes('not found')) return 'visit_not_found'
  if (name === 'TimeoutError' || msg.toLowerCase().includes('timeout')) return 'timeout'
  if (msg.includes('not found') || msg.includes('not accessible') || msg.includes('not available')) return 'element_not_found'
  return 'unknown'
}

export function isPermanentError(kind: AutomationErrorKind): boolean {
  return kind === 'session_expired'
    || kind === 'patient_not_found'
    || kind === 'visit_not_found'
}
```

## Open Questions

1. **Mid-batch session expiry error message**
   - What we know: `validateSession()` at startup catches session expiry via login page detection; the error string is `"Session expired - redirected to login page"` (L241)
   - What's unclear: If session expires mid-batch (during `navigateToICD` or similar), does Playwright throw a `TimeoutError` (iframe never loads) or does MDLand redirect and produce a different error?
   - Recommendation: Implement `classifyError()` with both patterns; add a note in the code to verify mid-batch session expiry behavior in production

2. **`ehr_logic` error kind**
   - What we know: FEATURES.md mentions `ehr_logic` as a kind for "EHR rejected the data"
   - What's unclear: No current code throws an EHR-logic-specific error; all business errors are plain strings
   - Recommendation: Omit `ehr_logic` from Phase 5 — it has no current throw sites and adds complexity without a consumer. Add in a future phase if needed.

## Sources

### Primary (HIGH confidence)
- Direct code read: `/scripts/playwright/mdland-automation.ts` L96-103 (VisitResult), L396 (Patient not found), L527 (Visit not found), L1020-1082 (processVisit), L1274-1279 (session check)
- Direct code read: `/server/services/automation-runner.ts` L17-21 (AutomationJob), L56-64 (currentJob shape)
- `.planning/research/SUMMARY.md` — architecture decisions, stack choices, phase ordering rationale
- `.planning/research/PITFALLS.md` — Pitfall 4 (error classification collapse), error kind patterns
- `.planning/research/FEATURES.md` — feature dependency graph, MVP definition
- `.planning/REQUIREMENTS.md` — ERR-01, ERR-02 requirement text

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — Pattern 4 (VisitResult shape), component boundaries table

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; TypeScript string unions are well-established
- Architecture: HIGH — based on direct source read of all relevant files
- Pitfalls: HIGH — derived from actual error strings in the codebase

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain; MDLand error strings unlikely to change)
