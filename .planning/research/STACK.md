# Stack Research

**Domain:** Seed passthrough, plateau breaker, Medicare phase gate (v1.5)
**Researched:** 2026-02-22
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

**No new packages required.** All three v1.5 features are implementable with existing dependencies and pure TypeScript logic.

| Feature | Implementation Approach | Existing Module | Why No New Dep |
|---------|------------------------|-----------------|----------------|
| Seed passthrough (SEED-01) | Thread `seed` from API request body → `generateTXSeries()` → `TXSequenceOptions.seed`, return `actualSeed` in response | `server/routes/batch.ts` → `server/services/batch-generator.ts` → `src/generator/tx-sequence-engine.ts` | `mulberry32` PRNG + `createSeededRng()` already exist. The plumbing gap is API→service, not algorithm. |
| Plateau breaker (PLAT-01) | Extend existing `plateau` detection block (line 855) to track consecutive stall count; when `stallCount >= 3`, inject micro-improvement via forced `painDelta` nudge or objective trend bump | `src/generator/tx-sequence-engine.ts` (lines 855-870) | Plateau detection already exists — it currently freezes ROM/strength trends. Breaker inverts this: instead of freezing, it forces a small improvement. Pure math, no library. |
| Medicare Visit 12 phase gate (GATE-01) | New pure function `evaluatePhaseGate(visits[0..11])` returning `{ improved: boolean, evidence: string[] }`. Wire into `generateTXSequenceStates()` at `i === 12` to decide whether visits 13-20 continue or halt | New file: `src/generator/phase-gate.ts` + integration in `tx-sequence-engine.ts` | NCD 30.3.3 rules are simple threshold checks (pain delta, objective trends). No external rule engine needed. |

### Supporting Libraries

No new supporting libraries needed.

| Considered | Why NOT Needed |
|------------|----------------|
| Zod (API input validation for seed) | Seed is a single `number \| undefined` — inline `typeof` + `Number.isInteger()` check is sufficient. Zod adds 13KB for one field. |
| `uuid` (for seed generation) | `createSeededRng()` already generates entropy-mixed seeds when none provided. UUID is overkill for a 32-bit PRNG seed. |
| `ajv` (JSON Schema for phase gate rules) | Phase gate rules are hardcoded from NCD 30.3.3 (12 visits / 90 days / improvement required). Not user-configurable, so schema validation adds no value. |
| `date-fns` (90-day window calculation) | Phase gate checks visit count, not calendar dates. The engine generates sequential visits without real dates. If date-awareness is added later, `date-fns` would be justified. |

### Development Tools

No new dev tools. Existing coverage:

| Tool | Already Installed | v1.5 Usage |
|------|-------------------|------------|
| Jest (backend) | `^29.7.0` | Unit tests for plateau breaker math, phase gate threshold logic, seed round-trip |
| Vitest (frontend) | `^4.0.18` | Parity tests confirming seed passthrough produces identical output |
| TypeScript | `^5.3.3` | New `PhaseGateResult` interface, extended `TXSequenceResult` type |

## Installation

```bash
# No installation needed for v1.5
# All features use existing dependencies
```

## Integration Points

### 1. Seed Passthrough (SEED-01)

Current gap: `generateTXSeries()` in `batch-generator.ts` (line 96) creates `seed: Math.floor(Math.random() * 100000)` — ignoring any caller-provided seed. The engine already supports `options.seed` and returns `actualSeed` in `TXSequenceResult`, but `exportTXSeriesAsText()` (line 2274) destructures only `{ states }`, discarding the seed.

Wire-through path:
```
API request body { seed?: number }
  → batch.ts reads req.body.seed (already done for PUT regenerate, line 189)
  → batch-generator.ts generateTXSeries() accepts seed param
  → TXSequenceOptions.seed = callerSeed ?? Math.floor(Math.random() * 100000)
  → tx-sequence-engine.ts createSeededRng(seed) (already works)
  → TXSequenceResult.seed returned (already works)
  → exportTXSeriesAsText() must return seed alongside TXSeriesTextItem[]
  → BatchVisit.generated.seed stores actualSeed (already typed)
  → GET /api/batch/:id response includes seed per visit (already in BatchVisit)
```

Changes required:
- `exportTXSeriesAsText()`: return `{ items: TXSeriesTextItem[], seed: number }` instead of bare array
- `batch-generator.ts` `generateTXSeries()`: accept optional `seed` param, pass through
- `batch-generator.ts` `generateTXSeries()`: capture returned `seed`, store in `visit.generated.seed`
- `batch.ts` POST `/api/batch` and POST `/api/batch/json`: read `req.body.seed`, pass to generator
- `batch-generator.ts` `generateContinueBatch()` and `generateMixedBatch()`: same seed threading

PRNG constraint (from PROJECT.md): "new rng() calls must append at end of loop" — seed passthrough doesn't add rng() calls, so no PRNG sequence risk.

### 2. Plateau Breaker (PLAT-01)

Current behavior (lines 855-870): when `plateau === true` (pain stalled + ADL stalled + frequency stalled, OR same painScaleLabel as previous visit), the engine freezes ROM and strength trends to `'stable'`. This prevents false improvement claims but creates clinically unrealistic flat sequences when pain stalls 3+ consecutive visits.

New behavior: track `consecutiveStalls` counter. When `consecutiveStalls >= 3`:
1. Force a micro pain nudge: `painScaleCurrent = Math.max(targetPain, prevPain - 0.5)` (half-step drop)
2. Allow ONE objective trend to show `'slightly improved'` (rotate: ROM → strength → tightness)
3. Reset `consecutiveStalls` to 0 after injection

Integration point — inside the main `for` loop, after the existing `plateau` block:
```typescript
// Existing (line 855):
const plateau = (progress > 0.7 && painDelta < 0.2 && ...) || painScaleLabel === prevPainScaleLabel

// New: track consecutive stalls
if (plateau) {
  consecutiveStalls++
} else {
  consecutiveStalls = 0
}

// Plateau breaker: inject micro-improvement after 3 consecutive stalls
if (consecutiveStalls >= 3) {
  // ... nudge pain, allow one objective trend, reset counter
}
```

PRNG impact: breaker logic uses existing `rng()` call to pick which objective trend to unfreeze. This call MUST be appended at the end of the plateau block to preserve PRNG sequence for non-plateau visits. Fixture snapshots will need regeneration after this change.

### 3. Medicare Visit 12 Phase Gate (GATE-01)

NCD 30.3.3 rules (from CMS):
- Initial phase: up to 12 visits in 90 days
- Additional 8 visits (max 20/year) ONLY if patient demonstrates improvement
- Treatment must be discontinued if patient is not improving or regressing

Phase gate evaluation — new pure function in `src/generator/phase-gate.ts`:
```typescript
interface PhaseGateInput {
  readonly visits: readonly TXVisitState[]  // visits 1-12
  readonly startPain: number
  readonly insuranceType: InsuranceType
}

interface PhaseGateResult {
  readonly passed: boolean
  readonly evidence: readonly string[]  // human-readable improvement markers
  readonly recommendation: 'continue' | 'discontinue' | 'not-applicable'
}
```

Improvement criteria (derived from NCD 30.3.3 + clinical practice):
- Pain reduction: `visit12.painScaleCurrent < startPain - 1` (at least 1-point drop over 12 visits)
- OR functional improvement: at least 2 of { ROM improved, strength improved, frequency reduced, ADL improved }
- If neither: `passed = false`, `recommendation = 'discontinue'`

Integration in `tx-sequence-engine.ts`:
```typescript
// At i === 12, after visit state is computed:
if (i === 12 && context.insuranceType === 'Medicare') {
  const gateResult = evaluatePhaseGate({ visits, startPain, insuranceType })
  // Attach to visit 12 state (new optional field on TXVisitState)
  // If !gateResult.passed: remaining visits get assessment text noting
  // "continued treatment pending re-evaluation" instead of standard improvement language
}
```

Type changes:
- `TXVisitState`: add optional `phaseGate?: PhaseGateResult`
- `TXSequenceResult`: no change (gate result lives on the visit state)
- `BatchVisit.generated`: no change (gate result serializes with the visit state in fullText)

The phase gate does NOT stop generation — it annotates. The clinician/reviewer decides whether to submit visits 13-20. This matches the NCD's intent: the determination is clinical, not automatic.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Inline `consecutiveStalls` counter | Sliding window average over N visits | Only if plateau detection needs to account for non-consecutive stalls (e.g., stall-improve-stall-stall). Current 3-consecutive rule is simpler and clinically sound. |
| Pure function `evaluatePhaseGate()` | Rule engine (e.g., `json-rules-engine`) | Only if phase gate rules become user-configurable or if multiple insurance types have different gate criteria. NCD 30.3.3 is a single static rule set. |
| Seed passthrough via request body | Seed in URL query param (`?seed=12345`) | Only for GET endpoints. POST body is correct for batch generation (seed is part of the generation config, not a resource identifier). |
| Annotate-only phase gate | Hard-stop generation at visit 12 | Only if the system should enforce compliance automatically. Current design leaves clinical judgment to the practitioner, which aligns with NCD 30.3.3's intent. |
| `exportTXSeriesAsText()` returns `{ items, seed }` | Add seed to each `TXSeriesTextItem` | Redundant — all items in a series share the same seed. One seed per series is sufficient. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `json-rules-engine` for phase gate | 45KB dependency for 3 threshold checks. NCD 30.3.3 rules are static and simple. Over-engineering. | Pure function with `if` statements |
| Redis/database for seed storage | Seeds are already stored in `BatchVisit.generated.seed` in the file-based batch store. No separate persistence needed. | Existing `batch-store.ts` LRU file store |
| Separate "plateau history" data structure | Adds complexity. A single `let consecutiveStalls = 0` counter inside the loop is sufficient. | Loop-local counter variable |
| LLM-generated phase gate assessment text | Non-deterministic output violates the audit trail requirement. Phase gate evidence must be reproducible. | Template strings with interpolated metrics |
| `crypto.randomUUID()` for seed generation | Seeds must be 32-bit integers for `mulberry32`. UUID is 128-bit and would need truncation, losing entropy benefit. | Existing `createSeededRng()` entropy mixing |
| Separate API endpoint for phase gate evaluation | Phase gate is evaluated during generation, not as a standalone query. Adding an endpoint creates a sync risk (gate result could diverge from actual generation). | Inline evaluation at visit 12 inside `generateTXSequenceStates()` |

## Stack Patterns by Variant

**If `insuranceType === 'Medicare'` and `txCount > 12`:**
- Evaluate phase gate at visit 12
- Attach `PhaseGateResult` to visit 12's `TXVisitState`
- Visits 13-20 assessment text includes "continued treatment following demonstrated improvement" when gate passes
- Visits 13-20 assessment text includes "continued treatment pending clinical re-evaluation" when gate fails

**If `insuranceType !== 'Medicare'`:**
- Phase gate evaluation skipped (`recommendation: 'not-applicable'`)
- No changes to visit generation or assessment text

**If caller provides `seed` in API request:**
- Deterministic mode: `createSeededRng(seed)` produces identical PRNG sequence
- Response includes same `seed` in `generated.seed` — caller can replay
- Plateau breaker and phase gate produce identical results for same seed (both are deterministic functions of PRNG state)

**If caller omits `seed`:**
- Entropy mode: `createSeededRng()` generates random seed from `Date.now() ^ Math.random() ^ hrtime`
- Response includes generated `seed` in `generated.seed` — caller can save and replay later

**If `consecutiveStalls >= 3` (plateau breaker fires):**
- One rng() call consumed to pick which objective trend to unfreeze
- Pain nudged by 0.5 (half grid step) — may or may not change `painScaleLabel` depending on snap
- `consecutiveStalls` resets to 0
- Next visit resumes normal progression

**If `consecutiveStalls < 3` (normal plateau):**
- Existing behavior preserved: ROM and strength trends frozen to `'stable'`
- No fixture snapshot impact

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| No new packages | N/A | All v1.5 changes are internal TypeScript additions |
| TypeScript `^5.3.3` | `PhaseGateResult` interface, extended `TXVisitState` | `readonly` tuples and optional fields work in 5.3+ |
| Express `^5.2.1` | Seed in `req.body` | Already parses JSON body via built-in middleware |
| Jest `^29.7.0` | Phase gate unit tests, plateau breaker tests | No new test runner features needed |

## Fixture Snapshot Impact

The plateau breaker changes the PRNG call sequence when `consecutiveStalls >= 3`. This means:
- 30 existing fixture snapshots will need regeneration for any fixture where a 3+ visit plateau occurs
- Parity diff tests (seeds 200001-200009) will also need regeneration
- Seed passthrough and phase gate do NOT affect PRNG sequence (passthrough is plumbing; gate is read-only evaluation)

Recommended approach: implement plateau breaker last, regenerate all snapshots once, then verify parity.

## Sources

- Codebase analysis — `src/generator/tx-sequence-engine.ts` (1216 lines, mulberry32 PRNG, plateau detection at line 855, createSeededRng at line 308)
- Codebase analysis — `server/services/batch-generator.ts` (332 lines, seed gap at line 96, generateTXSeries discards returned seed)
- Codebase analysis — `server/routes/batch.ts` (282 lines, seed already read for PUT regenerate at line 189, missing for POST batch)
- Codebase analysis — `src/generator/soap-generator.ts` (exportTXSeriesAsText at line 2264, destructures only `{ states }` discarding seed)
- Codebase analysis — `server/types.ts` (BatchVisit.generated.seed already typed at line 27)
- Codebase analysis — `src/generator/goals-calculator.ts` (233 lines, ST_PROGRESS/OPTIMAL_END_RATIO constants)
- [CMS NCD 30.3.3](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=373) — 12 visits initial, +8 if improving, 20/year max, discontinue if not improving
- [Medicare Acupuncture Coverage Guide](https://holisticbillingservices.com/ncd-3033-medicare-acupuncture-coverage/) — NCD 30.3.3 clinical interpretation

---
*Stack research for: Seed passthrough, plateau breaker, Medicare phase gate (v1.5)*
*Researched: 2026-02-22*
