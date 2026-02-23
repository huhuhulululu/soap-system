# Architecture Research — v1.5 New Features Integration

**Domain:** Seed passthrough, plateau breaker, Medicare Visit 12 phase gate
**Researched:** 2026-02-22
**Milestone:** v1.5 — Engine & UX Completion (SEED-01, PLAT-01, GATE-01)
**Confidence:** HIGH (all source files read directly, data flow traced end-to-end)

---

## Current Architecture (Relevant Subset)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Vue 3)                            │
│  ┌──────────────────┐  ┌──────────────────────────────────────┐    │
│  │  BatchView.vue    │  │ useSOAPGeneration.ts (composable)    │    │
│  │  (upload/review)  │  │ seedInput, currentSeed, generate()   │    │
│  └────────┬─────────┘  └──────────────┬──────────────────────┘    │
│           │ POST /api/batch            │ direct import              │
├───────────┴────────────────────────────┴──────────────────────────┤
│                     Server (Express 5)                              │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐   │
│  │ batch.ts     │  │ batch-generator.ts                        │   │
│  │ (routes)     │──│ generateBatch / generateMixedBatch        │   │
│  │              │  │ generateTXSeries / generateSingleVisit    │   │
│  └──────────────┘  └──────────────┬───────────────────────────┘   │
│                                    │                               │
├────────────────────────────────────┴──────────────────────────────┤
│                     Shared Engine (src/)                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ normalizeGenerationContext()  ← sole entry point (both paths)│  │
│  └──────────────┬──────────────────────────────────────────────┘  │
│  ┌──────────────┴──────────────────────────────────────────────┐  │
│  │ tx-sequence-engine.ts (1,216 LOC)                            │  │
│  │  createSeededRng() → mulberry32 PRNG                         │  │
│  │  generateTXSequenceStates() → TXVisitState[]                 │  │
│  │  plateau detection (lines 855-870) — ROM/strength freeze     │  │
│  └──────────────┬──────────────────────────────────────────────┘  │
│  ┌──────────────┴──────────┐  ┌────────────────────────────────┐  │
│  │ soap-generator.ts       │  │ goals-calculator.ts             │  │
│  │ exportTXSeriesAsText()  │  │ calculateDynamicGoals()         │  │
│  │ exportSOAPAsText()      │  │ (recovery curve, ST/LT goals)  │  │
│  └─────────────────────────┘  └────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ soap-constraints.ts — V01-V09, T01-T09, X1-X3 validators    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 30 fixture snapshots + 9 parity diffs (regression guard)     │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Seed Passthrough (SEED-01)

### Problem

Compose path has full seed control — `seedInput`, `currentSeed`, `copySeed()`, `regenerate()` in `useSOAPGeneration.ts`. Batch path generates random seeds at two points and discards them:

1. `generateSingleVisit()` (line 62): `Math.floor(Math.random() * 100000)` — seed created but never passed to engine (IE/RE notes are seedless)
2. `generateTXSeries()` (line 96): `Math.floor(Math.random() * 100000)` — seed passed to `TXSequenceOptions` but not persisted for replay

The `regenerateVisit()` function (line 324) accepts an optional `seed` param and passes it to `generateSingleVisit()`, but `generateSingleVisit` never forwards the seed to the engine — it's stored in `generated.seed` but not used for PRNG initialization.

### Root Cause

`generateSingleVisit()` calls `exportSOAPAsText(context)` which is seedless (IE/RE notes don't use PRNG). The `actualSeed` on line 62 is cosmetic — it's stored but never drives generation. For TX series, the seed IS used (`TXSequenceOptions.seed`) but there's no API path to replay a batch with the same seed.

### Integration Points

| Touch Point | Current | Change | Risk |
|-------------|---------|--------|------|
| `batch-generator.ts` `generateTXSeries()` | `Math.random()` seed | Accept optional `seed` param, return `actualSeed` from engine | LOW — additive param |
| `batch-generator.ts` `generateSingleVisit()` | Seed stored but unused | For IE/RE: seed is cosmetic (no PRNG). For TX regen: forward seed to engine | LOW |
| `batch-generator.ts` `generateBatch()` / `generateMixedBatch()` | No seed tracking | Collect seeds per-patient from `generateTXSeries` return, store in `BatchPatient` | LOW |
| `server/types.ts` `BatchPatient` | No `txSeed` field | Add `readonly txSeed?: number` | LOW |
| `server/types.ts` `BatchVisit.generated` | Has `seed: number` | Already present ✓ — just needs to be the real engine seed | NONE |
| `server/routes/batch.ts` PUT endpoint | Accepts `seed` in body | Already passes to `regenerateVisit()` ✓ | NONE |
| `server/routes/batch.ts` POST `/api/batch` | No seed in request | Add optional `seed` per patient in JSON body for replay | LOW |
| `useSOAPGeneration.ts` | Full seed control | No change needed ✓ | NONE |

### Data Flow (After)

```
Batch Upload (POST /api/batch)
    ↓
generateMixedBatch(batchData, realisticPatch)
    ↓
generateTXSeries(patient, txVisits, ieVisit, realisticPatch, patient.txSeed?)
    ↓                                                          ↑ optional replay
TXSequenceOptions { seed: patient.txSeed ?? Math.random() }
    ↓
generateTXSequenceStates() → { states, seed: actualSeed }
    ↓
actualSeed stored in BatchPatient.txSeed + each BatchVisit.generated.seed
    ↓
GET /api/batch/:id → response includes txSeed per patient
    ↓
PUT /api/batch/:batchId/visit/:p/:v { seed: txSeed } → deterministic replay
```

### Key Constraint

PRNG sequence integrity: `tx-sequence-engine.ts` line 90 in PROJECT.md — "new rng() calls must append at end of loop". Seed passthrough doesn't add rng() calls, it only controls the initial seed value. No PRNG sequence risk.

### What Changes vs What Doesn't

| Component | Changes? | Details |
|-----------|----------|---------|
| `tx-sequence-engine.ts` | NO | Already accepts `seed` in `TXSequenceOptions`, returns it in result |
| `soap-generator.ts` | NO | Passes options through to engine |
| `normalizeGenerationContext()` | NO | Context construction is seed-independent |
| `batch-generator.ts` | YES | Wire seed through `generateTXSeries`, store in patient |
| `server/types.ts` | YES | Add `txSeed` to `BatchPatient` |
| `server/routes/batch.ts` | YES | Accept seed in JSON body for replay |
| 30 fixture snapshots | NO | Seeds are hardcoded in fixture-data.ts, unaffected |
| 9 parity diffs | NO | Seeds are hardcoded (200001-200009), unaffected |

---

## Feature 2: Plateau Breaker (PLAT-01)

### Problem

Current plateau detection (tx-sequence-engine.ts lines 855-870):

```typescript
const plateau =
  (progress > 0.7 && painDelta < 0.2 && adlDelta < 0.12 && !frequencyImproved) ||
  painScaleLabel === prevPainScaleLabel
if (plateau) {
  // Freeze ROM and/or strength trends to 'stable'
}
```

This detects stalls but only suppresses ROM/strength improvement — it doesn't break the plateau. When pain stalls at the same label for 3+ consecutive visits (e.g., "7-6" → "7-6" → "7-6"), the generated notes become nearly identical in Subjective and Assessment sections. The `symptomChange` gets forced to `'similar symptom(s) as last visit'` (line 897-901) because `painDelta <= 0`.

### What "Plateau Breaker" Means

When pain is stuck at the same grid label for N consecutive visits (N ≥ 3), inject a micro-improvement that nudges pain to the next lower grid point. This ensures:
1. No 3+ consecutive identical pain labels
2. Assessment can say "improvement" instead of "similar"
3. Downstream monotonic constraints (V01-V04) remain satisfied

### Integration Points

| Touch Point | Current | Change | Risk |
|-------------|---------|--------|------|
| `tx-sequence-engine.ts` main loop | `prevPainScaleLabel` tracks last label | Add `consecutiveSameLabel` counter. When ≥ 3, force `rawPain` down by 0.3-0.5 | MEDIUM — affects PRNG sequence |
| `tx-sequence-engine.ts` plateau block | Freezes ROM/strength | Keep existing freeze logic, add pain nudge before it | MEDIUM |
| `soap-constraints.ts` V01 | Pain monotonic check | No change — nudge only decreases pain | NONE |
| `soap-constraints.ts` T02 | improvement + pain worsened | No change — nudge ensures painDelta > 0 when symptomChange = improvement | NONE |
| 30 fixture snapshots | Regression baselines | WILL BREAK for seeds where plateau occurs at visits 8+ | HIGH — expected, requires `--update` |

### Existing Plateau Detection vs New Breaker

```
CURRENT (lines 855-870):
  plateau detected → ROM/strength frozen to 'stable'
  pain stays same → symptomChange = 'similar'
  Result: identical-looking notes

PROPOSED:
  consecutiveSameLabel >= 3 → force pain down 0.3-0.5
  pain drops → painDelta > 0 → symptomChange = 'improvement'
  ROM/strength freeze still applies (plateau is real, just pain unstuck)
  Result: notes show gradual improvement even in plateau phase
```

### PRNG Sequence Impact

The plateau breaker does NOT add new `rng()` calls — it modifies `rawPain` calculation before the existing `snapPainToGrid()` call. The `consecutiveSameLabel` counter is a pure tracking variable (like `prevPainScaleLabel`). No PRNG sequence shift.

However, the changed pain value cascades through:
- `severityFromPain()` → different severity → different `pickSingle()` weights
- `painDelta` → different `symptomChange` selection
- `deriveAssessmentFromSOA()` → different assessment text

This means fixture snapshots WILL change for any seed where a 3+ visit plateau occurs. This is expected and correct — the snapshots should be updated after the feature is implemented.

### Data Flow (After)

```
tx-sequence-engine loop (visit i):
    ↓
rawPain = clamp(Math.min(prevPain, expectedPain + painNoise), targetPain, startPain)
    ↓
snapped = snapPainToGrid(rawPain)
    ↓
painScaleLabel === prevPainScaleLabel?
  YES → consecutiveSameLabel++
  NO  → consecutiveSameLabel = 0
    ↓
consecutiveSameLabel >= 3?
  YES → rawPain = prevPain - 0.4 (nudge)
         re-snap to grid
         consecutiveSameLabel = 0
  NO  → continue as before
    ↓
painDelta = prevPain - painScaleCurrent  (now > 0 after nudge)
    ↓
symptomChange selection (painDelta > 0 → eligible for 'improvement')
```

### What Changes vs What Doesn't

| Component | Changes? | Details |
|-----------|----------|---------|
| `tx-sequence-engine.ts` | YES | Add `consecutiveSameLabel` counter + nudge logic before snap |
| `soap-generator.ts` | NO | Consumes `TXVisitState` unchanged |
| `normalizeGenerationContext()` | NO | Unrelated to visit-level progression |
| `batch-generator.ts` | NO | Passes through to engine |
| `soap-constraints.ts` | NO | All monotonic rules still satisfied (pain only decreases) |
| 30 fixture snapshots | UPDATE | Re-snapshot after implementation |
| 9 parity diffs | NO | Parity still holds (both paths use same engine) |

---

## Feature 3: Medicare Visit 12 Phase Gate (GATE-01)

### Problem

Medicare NCD 30.3.3 requires re-evaluation at visit 12 for acupuncture. Currently, the engine generates TX1-TX20 as a continuous sequence with no structural break. A Medicare patient's visit 12 should trigger:

1. A "progress summary" in Assessment (cumulative improvement since IE)
2. A "continued treatment justified" statement in Plan
3. Optionally, a RE (Re-Evaluation) note type instead of TX at visit 12

### What "Phase Gate" Means

At visit 12 (configurable), the engine inserts compliance markers into the SOAP text:
- Assessment: "Patient has completed initial 12-visit course. Cumulative pain reduction: X→Y. Continued acupuncture treatment is medically necessary per NCD 30.3.3."
- Plan: "Re-evaluation performed. Treatment plan extended for visits 13-20."

This is NOT a separate note type — it's an enrichment of the TX12 note for Medicare patients.

### Scope Decision: Which Insurance Types?

Medicare-adjacent insurance types in the system: `ELDERPLAN`. Standard Medicare isn't in the `InsuranceType` union yet. The gate should trigger for:
- `ELDERPLAN` (Medicare Advantage)
- Future `MEDICARE` type if added

Non-Medicare types (`OPTUM`, `HF`, `WC`, `VC`, `NONE`) skip the gate entirely.

### Integration Points

| Touch Point | Current | Change | Risk |
|-------------|---------|--------|------|
| `tx-sequence-engine.ts` `TXVisitState` | No gate fields | Add `isPhaseGate: boolean` + `phaseGateSummary?: { ... }` to state | LOW — additive |
| `tx-sequence-engine.ts` main loop | No visit-12 awareness | Check `i === 12 && isMedicareType(ctx.insuranceType)` → set gate fields | LOW |
| `tx-sequence-engine.ts` `TXSequenceOptions` | No gate config | Add optional `phaseGateVisit?: number` (default 12) | LOW |
| `soap-generator.ts` `generateAssessmentTX()` | No gate text | When `state.isPhaseGate`, append NCD 30.3.3 compliance text | LOW |
| `soap-generator.ts` `generatePlanTX()` | No gate text | When `state.isPhaseGate`, append re-evaluation statement | LOW |
| `GenerationContext` (`src/types/index.ts`) | No Medicare flag | Add optional `isMedicare?: boolean` (derived from insuranceType) | LOW |
| `normalizeGenerationContext()` | No Medicare derivation | Derive `isMedicare` from `insuranceType === 'ELDERPLAN'` | LOW |
| `batch-generator.ts` | No gate awareness | No change — gate is engine-internal | NONE |
| `soap-constraints.ts` | No gate validation | Add optional `G01` rule: if Medicare + txCount ≥ 12, visit 12 must have gate | LOW |
| 30 fixture snapshots | No ELDERPLAN fixtures | Add 1-2 ELDERPLAN fixtures with txCount ≥ 12 | LOW |

### Data Flow (After)

```
tx-sequence-engine loop (visit i = 12):
    ↓
isMedicareType(context.insuranceType)?
  NO  → normal TX generation
  YES ↓
    ↓
Compute cumulative summary:
  cumulativePainDelta = startPain - painScaleCurrent
  cumulativeTightnessDelta = initTightness - currentTightness
  cumulativeTendernessDelta = initTenderness - currentTenderness
    ↓
TXVisitState.isPhaseGate = true
TXVisitState.phaseGateSummary = {
  cumulativePainDelta,
  initialPain: startPain,
  currentPain: painScaleCurrent,
  visitCount: 12,
  justification: 'NCD 30.3.3'
}
    ↓
soap-generator.ts:
  generateAssessmentTX() → appends compliance paragraph
  generatePlanTX() → appends re-evaluation statement
    ↓
Output: TX12 note with Medicare gate markers embedded in A and P sections
```

### New Types

```typescript
// In tx-sequence-engine.ts, extend TXVisitState:
interface PhaseGateSummary {
  readonly cumulativePainDelta: number
  readonly initialPain: number
  readonly currentPain: number
  readonly visitCount: number
  readonly justification: string
}

// TXVisitState additions:
isPhaseGate?: boolean
phaseGateSummary?: PhaseGateSummary
```

### What Changes vs What Doesn't

| Component | Changes? | Details |
|-----------|----------|---------|
| `tx-sequence-engine.ts` | YES | Gate detection at visit 12, cumulative summary computation, new state fields |
| `soap-generator.ts` | YES | Assessment + Plan text enrichment for gate visits |
| `normalizeGenerationContext()` | YES | Derive `isMedicare` flag |
| `src/types/index.ts` `GenerationContext` | YES | Add `isMedicare?: boolean` |
| `batch-generator.ts` | NO | Engine-internal, transparent to orchestrator |
| `server/routes/batch.ts` | NO | No API changes |
| `soap-constraints.ts` | YES | Optional G01 validation rule |
| 30 fixture snapshots | ADD | 1-2 new ELDERPLAN fixtures |
| 9 parity diffs | NO | Gate is deterministic (same seed → same gate) |

---

## New Components Summary

### Files to CREATE

None. All features integrate into existing files.

### Files to MODIFY

| File | Feature | Change Summary | LOC Estimate |
|------|---------|----------------|--------------|
| `src/generator/tx-sequence-engine.ts` | SEED-01 | No change (already supports seed) | 0 |
| `src/generator/tx-sequence-engine.ts` | PLAT-01 | `consecutiveSameLabel` counter + nudge (~15 lines) | +15 |
| `src/generator/tx-sequence-engine.ts` | GATE-01 | Phase gate detection + summary computation (~30 lines), `PhaseGateSummary` type (~10 lines) | +40 |
| `src/generator/soap-generator.ts` | GATE-01 | Assessment + Plan gate text (~25 lines) | +25 |
| `src/shared/normalize-generation-context.ts` | GATE-01 | `isMedicare` derivation (~3 lines) | +3 |
| `src/types/index.ts` | GATE-01 | `isMedicare` on `GenerationContext` (~1 line) | +1 |
| `server/services/batch-generator.ts` | SEED-01 | Wire seed through `generateTXSeries`, store in patient (~20 lines) | +20 |
| `server/types.ts` | SEED-01 | `txSeed` on `BatchPatient` (~1 line) | +1 |
| `server/routes/batch.ts` | SEED-01 | Accept seed in JSON body (~5 lines) | +5 |
| `src/shared/soap-constraints.ts` | GATE-01 | Optional G01 rule (~15 lines) | +15 |
| `src/generator/__fixtures__/fixture-data.ts` | GATE-01 | 1-2 ELDERPLAN fixture definitions | +20 |

### Files UNCHANGED

- `frontend/src/composables/useSOAPGeneration.ts` — already has full seed control
- `src/generator/goals-calculator.ts` — no impact from these 3 features
- `src/generator/objective-patch.ts` — ROM/Strength patching unaffected
- `src/shared/body-part-constants.ts` — no new body parts
- `src/shared/icd-catalog.ts` — no ICD changes
- `src/knowledge/medical-history-engine.ts` — no history inference changes

---

## Build Order

Dependencies drive this order. Each phase is independently testable.

### Phase 1: Seed Passthrough (SEED-01) — No engine changes

1. `server/types.ts` — Add `txSeed?: number` to `BatchPatient`
2. `server/services/batch-generator.ts` — Wire seed through `generateTXSeries()`, capture `actualSeed` from engine result, store in patient and visits
3. `server/routes/batch.ts` — Accept optional `seed` per patient in JSON body
4. Test: POST batch with seed → GET batch → verify seed present → PUT regenerate with same seed → verify identical output

**Why first:** Zero engine risk. Pure plumbing. Unblocks deterministic testing for Phase 2 and 3.

### Phase 2: Plateau Breaker (PLAT-01) — Engine change, PRNG-safe

5. `src/generator/tx-sequence-engine.ts` — Add `consecutiveSameLabel` counter before the existing plateau block (line ~855). When counter ≥ 3, nudge `rawPain` down by 0.3-0.5 and reset counter.
6. Run 30 fixture snapshots → expect failures → `--update` snapshots
7. Run 9 parity diffs → should still pass (both paths use same engine)
8. Manual audit: generate 20-visit sequences, verify no 3+ identical pain labels

**Why second:** Isolated engine change. No new types, no API changes. Snapshot update is expected and mechanical.

### Phase 3: Medicare Phase Gate (GATE-01) — Engine + generator + types

9. `src/types/index.ts` — Add `isMedicare?: boolean` to `GenerationContext`
10. `src/shared/normalize-generation-context.ts` — Derive `isMedicare` from `insuranceType`
11. `src/generator/tx-sequence-engine.ts` — Add `PhaseGateSummary` type, `isPhaseGate` + `phaseGateSummary` to `TXVisitState`, gate detection at visit 12
12. `src/generator/soap-generator.ts` — Assessment + Plan text enrichment for gate visits
13. `src/shared/soap-constraints.ts` — Optional G01 validation rule
14. `src/generator/__fixtures__/fixture-data.ts` — Add ELDERPLAN fixtures
15. Run full test suite, update snapshots if needed

**Why third:** Most files touched, most new types. Depends on Phase 1 (seed passthrough) for deterministic testing of gate behavior.

### Dependency Graph

```
Phase 1: SEED-01 (server-only, no engine)
    │
    ├──→ Phase 2: PLAT-01 (engine-only, snapshot update)
    │        │
    │        └──→ Phase 3: GATE-01 (engine + generator + types)
    │
    └──→ Phase 3 can also start after Phase 1 if Phase 2 is deferred
```

Phase 2 and Phase 3 are independent of each other but both benefit from Phase 1's seed passthrough for deterministic testing.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding rng() Calls in Plateau Breaker

**What:** Using `rng()` to determine nudge magnitude
**Why bad:** Shifts the entire PRNG sequence for all subsequent visits. Every fixture snapshot breaks unpredictably.
**Do this instead:** Use a fixed nudge (0.4) or derive from `prevPain - targetPain` ratio. No new rng() calls.

### Anti-Pattern 2: Hardcoding Visit 12 for Phase Gate

**What:** `if (i === 12) { ... }`
**Why bad:** Some Medicare plans require re-eval at visit 8 or 16. Clinics may have different protocols.
**Do this instead:** Use `options.phaseGateVisit ?? 12` so the gate visit is configurable per batch.

### Anti-Pattern 3: Mutating TXVisitState After Construction

**What:** Adding `isPhaseGate` by mutating the state object after `visits.push()`
**Why bad:** Violates immutability. The state is consumed by `soap-generator.ts` which may cache references.
**Do this instead:** Set `isPhaseGate` and `phaseGateSummary` in the state object literal before pushing to `visits[]`.

### Anti-Pattern 4: Separate Code Path for Medicare Notes

**What:** Creating a `generateMedicareTX()` function alongside `generateAssessmentTX()`
**Why bad:** Duplicates 90% of assessment logic. Diverges over time.
**Do this instead:** Add a conditional block inside `generateAssessmentTX()` that appends gate text when `state.isPhaseGate === true`. Same function, enriched output.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PLAT-01 breaks fixture snapshots | CERTAIN | LOW | Expected. Run `--update`, review diffs manually |
| PLAT-01 nudge too aggressive | MEDIUM | MEDIUM | Cap nudge at 0.5, floor at `targetPain`. Test with 20-visit chronic sequences |
| GATE-01 text too verbose for non-Medicare review | LOW | LOW | Gate text only appears for ELDERPLAN. Non-Medicare notes unchanged |
| SEED-01 seed collision across patients | LOW | NONE | Seeds are per-patient, not global. Collision produces identical notes for that patient only (acceptable) |
| GATE-01 visit 12 falls outside txCount | LOW | NONE | Gate only triggers when `i === phaseGateVisit && i <= txCount`. Short courses skip it |

---

## Sources

- `tx-sequence-engine.ts` lines 855-870: existing plateau detection logic
- `tx-sequence-engine.ts` lines 606-614: `createSeededRng()` seed handling
- `batch-generator.ts` lines 55-77: `generateSingleVisit()` seed flow
- `batch-generator.ts` lines 83-123: `generateTXSeries()` seed flow
- `useSOAPGeneration.ts` lines 117-172: compose path seed control
- `server/routes/batch.ts` lines 160-215: PUT regenerate endpoint
- `server/types.ts` lines 8-30: `BatchVisit.generated.seed` field
- `soap-constraints.ts` lines 175-311: V01-V09 monotonic validators
- `fixture-snapshots.test.ts`: 30 deterministic regression tests
- `parity-diff.test.ts`: 9 batch/compose parity tests
- Medicare NCD 30.3.3: acupuncture re-evaluation requirement at visit 12

---
*Architecture research for: v1.5 Seed Passthrough, Plateau Breaker, Medicare Phase Gate*
*Researched: 2026-02-22*
