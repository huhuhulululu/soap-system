# Phase 13: Recovery Curve & Goals Calibration - Research

**Researched:** 2026-02-22
**Domain:** SOAP engine internals — progress curve shaping + goals calculation
**Confidence:** HIGH

## Summary

Phase 13 addresses two tightly coupled problems: (1) the TX sequence engine's progress curve treats all patients identically regardless of treatment length, and (2) the goals calculator sets unrealistically optimistic long-term targets for chronic pain patients.

The current engine (tx-sequence-engine.ts, 1,216 LOC) uses a `sqrt + smoothstep` S-curve for progress, modulated by a `progressMultiplier` from medical history. But it has no concept of "chronic-aware" pacing — a 20-visit chronic patient follows the same curve shape as a 3-visit acute patient. The goals calculator (goals-calculator.ts) uses `OPTIMAL_END_RATIO = 0.25`, meaning pain 8 → LT target 2 (75% improvement), and Strength/ROM goals can reach near-normal values (4+/5, 95% ROM). For chronic pain patients (txCount ≥ 16), this is clinically unrealistic.

Both changes are confined to two files (`goals-calculator.ts` and `tx-sequence-engine.ts`) plus snapshot regeneration. The critical constraint is PRNG sequence preservation — any new `rng()` call inside the engine loop shifts all 30 fixture snapshots.

**Primary recommendation:** Implement chronic-aware curve as a `progressMultiplier` dampener (no new rng() calls needed), and cap goals in `calculateDynamicGoals` with a `chronicAware` flag. Regenerate snapshots once at the end.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRV-01 | Recovery curve spreads improvement across 20 visits with chronic-aware variant (slower progression for txCount ≥ 16) | Chronic dampener applied to existing `progressMultiplier` in tx-sequence-engine.ts; no new rng() calls; curve flattening via reduced multiplier + optional late-stage ceiling |
| CRV-02 | Long-term goals reflect realistic 30-50% improvement for chronic pain (not 75%), Strength/ROM never fully normal | Goals calculator gains `chronicAware` parameter; LT pain target capped at 50% reduction; Strength capped at 4/5; ROM capped at 80% |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. This phase modifies two existing pure-TypeScript modules:

| Module | LOC | Purpose | Modification Scope |
|--------|-----|---------|-------------------|
| `tx-sequence-engine.ts` | 1,216 | PRNG-driven TX visit state generation | Progress curve dampening for txCount ≥ 16 |
| `goals-calculator.ts` | 233 | IE goals (ST/LT targets) | Chronic-aware caps on LT targets |

### Supporting

| Module | Purpose | Impact |
|--------|---------|--------|
| `normalize-generation-context.ts` | Sole context entry point | May need to pass `txCount` to goals if IE generation needs it |
| `soap-generator.ts` | Calls `calculateDynamicGoals` at L1318 | Needs to pass chronic flag or txCount |
| `fixture-snapshots.test.ts` | 30 regression snapshots | Must regenerate after engine changes |
| `parity-diff.test.ts` | 9 parity tests (seeds 200001-200009) | Must still pass after changes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| progressMultiplier dampening | Separate chronic curve function | More code, same effect; dampener is simpler and doesn't add rng() calls |
| chronicAware flag on goals | txCount-based auto-detection | Flag is explicit; auto-detection couples goals to engine internals |
| Multi-phase curve (acute/corrective/maintenance) | Single dampened curve | Multi-phase is out of scope per REQUIREMENTS.md |

## Architecture Patterns

### Pattern 1: Chronic Dampener on Progress Curve

**What:** When `txCount ≥ 16`, apply a dampening factor to the existing `progressMultiplier`, slowing the S-curve so improvement spreads across all 20 visits instead of front-loading.

**When to use:** CRV-01 implementation.

**Current code (tx-sequence-engine.ts L640-641):**
```typescript
const progressMultiplier = inferProgressMultiplier(medHistory, context.age)
```

**Proposed pattern:**
```typescript
const baseMultiplier = inferProgressMultiplier(medHistory, context.age)
// CRV-01: chronic-aware dampener — slower progression for long courses
const chronicDampener = txCount >= 16 ? 0.82 : 1.0
const progressMultiplier = baseMultiplier * chronicDampener
```

**Why this works:**
- `progressMultiplier` is already used at L736: `(progressBase * progressMultiplier) + progressNoise`
- Reducing it from 1.0 to ~0.82 flattens the S-curve, spreading improvement across more visits
- Zero new `rng()` calls — PRNG sequence unchanged within the loop
- The dampener is applied BEFORE the loop, so it's a single multiplication

**Tuning range:** 0.78–0.85 for the dampener. At 0.82:
- Visit 10/20 (midpoint): progress ≈ 0.55 instead of 0.67
- Visit 15/20: progress ≈ 0.72 instead of 0.85
- Visit 20/20: progress ≈ 0.82 instead of 1.0 (never reaches "fully recovered")

### Pattern 2: Chronic-Aware Goals Caps

**What:** When generating IE goals for chronic patients, cap LT targets to reflect 30-50% improvement instead of 75%.

**Current code (goals-calculator.ts L72-73):**
```typescript
const ST_PROGRESS = 0.55
const OPTIMAL_END_RATIO = 0.25  // Pain 8 → LT 2 (75% improvement)
```

**Proposed pattern:**
```typescript
// Default (acute/sub-acute): 75% improvement
const OPTIMAL_END_RATIO = 0.25

// CRV-02: chronic-aware caps
const CHRONIC_END_RATIO = 0.55  // Pain 8 → LT 4-5 (38-50% improvement)
const CHRONIC_STRENGTH_CAP = '4/5'  // Never fully normal
const CHRONIC_ROM_CAP = '80%'       // Never fully normal
```

**Interface change to `calculateDynamicGoals`:**
```typescript
export function calculateDynamicGoals(
  severity: SeverityLevel,
  bp: BodyPart,
  symptomType: string = 'soreness',
  painOverride?: number,
  chronicAware?: boolean  // NEW — appended parameter, backward compatible
): DynamicGoals
```

### Pattern 3: Snapshot Regeneration Strategy

**What:** After all engine/goals changes, regenerate snapshots in a single pass.

**Steps:**
1. Run existing 30 snapshots — they WILL fail (expected)
2. Run `npx vitest run src/generator/__fixtures__/fixture-snapshots.test.ts --update`
3. Run parity tests — they should still pass (same input → same output on both paths)
4. Manually verify a sample of regenerated snapshots for clinical plausibility

### Anti-Patterns to Avoid

- **Adding rng() calls inside the loop:** Shifts entire PRNG sequence for all 30 fixtures. The chronic dampener MUST be computed before the loop.
- **Conditional rng() calls:** `if (chronic) { rng() }` is even worse — different fixtures would diverge at different points.
- **Modifying progress calculation formula:** The `sqrt + smoothstep` shape is well-tested. Dampening the multiplier preserves the shape while scaling the amplitude.
- **Coupling goals to txCount at IE generation time:** IE is generated before TX count is known in some flows. Use an explicit `chronicAware` flag instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Curve shaping | Custom sigmoid/logistic function | Existing `sqrt + smoothstep` with dampened multiplier | Already tested, PRNG-safe |
| Clinical improvement ranges | Lookup tables per condition | Ratio-based caps (CHRONIC_END_RATIO) | Simpler, fewer magic numbers |
| Snapshot diffing | Manual text comparison | Vitest `--update` + `toMatchSnapshot()` | Already in place, battle-tested |

**Key insight:** The existing progress curve infrastructure is sound. CRV-01 is a parameter tuning problem, not an algorithm redesign.

## Common Pitfalls

### Pitfall 1: PRNG Sequence Shift
**What goes wrong:** Adding a single `rng()` call inside the for-loop shifts every subsequent random value, breaking all 30 fixture snapshots in unpredictable ways.
**Why it happens:** Mulberry32 PRNG is sequential — call N+1 depends on call N.
**How to avoid:** All chronic-aware logic must use deterministic calculations (no rng). The dampener is a pure multiplication applied before the loop.
**Warning signs:** More than 5 fixture snapshots changing when only curve shape should differ.

### Pitfall 2: Goals-Engine Misalignment
**What goes wrong:** Goals say "LT pain target: 4-5" but the engine's progress curve still drives pain down to 2.
**Why it happens:** The engine reads `longTermTarget` from `context.previousIE.plan.longTermGoal.painScaleTarget` (L633). If goals are capped but the engine's own `ltFallback` isn't updated, the fallback overrides the cap.
**How to avoid:** Update `ltFallback` calculation in tx-sequence-engine.ts to respect chronic-aware caps. The fallback at L625-627 uses `OPTIMAL_END_RATIO` equivalent math — it must use `CHRONIC_END_RATIO` when txCount ≥ 16.
**Warning signs:** Late-visit pain values dropping below the LT goal target.

### Pitfall 3: Fixture Snapshot Churn
**What goes wrong:** Regenerating snapshots after each small change creates massive git diffs and makes review impossible.
**Why it happens:** Each snapshot is a full SOAP note text (~2KB). 30 snapshots × 20 visits = huge diff.
**How to avoid:** Make ALL engine changes first, then regenerate snapshots exactly once. Commit the snapshot update as a single atomic commit.
**Warning signs:** Multiple snapshot regeneration commits in the PR.

### Pitfall 4: Backward Incompatibility in Goals API
**What goes wrong:** Existing callers of `calculateDynamicGoals` break because signature changed.
**Why it happens:** Adding required parameters to an existing function.
**How to avoid:** `chronicAware` must be optional with default `false`. Only one call site (soap-generator.ts L1318) needs updating.
**Warning signs:** TypeScript compilation errors in soap-generator.ts or tests.

### Pitfall 5: Strength/ROM Caps Breaking Parity
**What goes wrong:** Compose path and batch path produce different Strength/ROM values after capping.
**Why it happens:** If the cap is applied in goals but not in the engine's ROM/Strength deficit calculations, the text output diverges.
**How to avoid:** Caps are in goals-calculator.ts (IE generation only). The engine's ROM/Strength progression is independent — it's driven by `romProgress` and `strengthProgress` multipliers, not by goal targets. The chronic dampener naturally slows ROM/Strength improvement via reduced `progress`.
**Warning signs:** Parity test `Strength/ROM identical` failing.

## Code Examples

### CRV-01: Chronic Dampener (tx-sequence-engine.ts)

```typescript
// Before the loop (after L641, before L644)
// CRV-01: chronic-aware curve — slower progression for txCount ≥ 16
const chronicDampener = txCount >= 16 ? 0.82 : 1.0
const progressMultiplier = baseMultiplier * chronicDampener

// Also update ltFallback to align with chronic goals (after L625)
const chronicEndRatio = txCount >= 16 ? 0.55 : 0.25
const ltFallback = ieStartPain <= 6
  ? 1
  : Math.ceil(Math.max(2, ieStartPain * chronicEndRatio))
```

### CRV-02: Chronic Goals Caps (goals-calculator.ts)

```typescript
function calculatePainGoals(
  painCurrent: number,
  bp: BodyPart,
  chronicAware: boolean = false
): { st: string; lt: string } {
  if (painCurrent <= 3) return { st: '1', lt: '1' }
  if (painCurrent <= 6) return { st: '2', lt: '1' }

  const endRatio = chronicAware ? 0.55 : OPTIMAL_END_RATIO
  const optimalEnd = Math.max(2, painCurrent * endRatio)
  // ... rest unchanged
}

function calculateStrengthGoals(
  current: string = '3+/5',
  chronicAware: boolean = false
): { st: string; lt: string } {
  // ... existing logic ...
  // CRV-02: chronic patients never reach fully normal
  if (chronicAware) {
    const cap = (v: number) => Math.min(4, v)  // cap at 4/5
    const stVal = cap(Math.min(5, val + 0.5))
    const ltVal = cap(Math.min(5, val + 1.0))
    // ...
  }
}

function calculateROMGoals(
  severity: SeverityLevel,
  chronicAware: boolean = false
): { st: string; lt: string } {
  // CRV-02: chronic cap — never reaches >80%
  if (chronicAware) {
    const map: Record<string, { st: string; lt: string }> = {
      'severe': { st: '45%', lt: '60%' },
      'moderate to severe': { st: '55%', lt: '70%' },
      'moderate': { st: '50%', lt: '60%' },
      'mild to moderate': { st: '45%', lt: '55%' },
      'mild': { st: '45%', lt: '55%' },
    }
    return map[severity] || { st: '55%', lt: '70%' }
  }
  // ... existing non-chronic logic
}
```

### Caller Update (soap-generator.ts L1318)

```typescript
// Determine chronic-aware flag from context
// chronicityLevel is always available in GenerationContext
const isChronicAware = context.chronicityLevel === 'Chronic'
const goals = calculateDynamicGoals(severity, bp, symptomType, context.painCurrent, isChronicAware)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat progress (linear) | S-curve (sqrt + smoothstep) | v1.4 | Realistic early-fast/late-slow pattern |
| Static goals (hardcoded) | Dynamic goals (severity-based) | v1.4 | Goals match patient presentation |
| No medical history influence | progressMultiplier from history | v1.4 | Slower healing for comorbidities |
| **No chronic awareness** | **Needs chronic dampener** | **v1.5 (this phase)** | **Realistic 20-visit spread** |
| **75% LT improvement for all** | **Needs 30-50% cap for chronic** | **v1.5 (this phase)** | **Clinically realistic goals** |

## Open Questions

1. **Chronic threshold: txCount ≥ 16 or ≥ 12?**
   - What we know: CRV-01 spec says "txCount ≥ 16". Fixtures include 18 and 20 visit cases.
   - What's unclear: Whether 12-15 visit patients should get partial dampening.
   - Recommendation: Use hard threshold at 16 per spec. A graduated dampener (e.g., `Math.max(0.82, 1 - (txCount - 12) * 0.03)`) could be a future enhancement but adds complexity.

2. **How does chronicAware flag reach IE generation?**
   - What we know: `generatePlanIE` receives `GenerationContext` which has `chronicityLevel` but not `txCount`.
   - What's unclear: Whether to use `chronicityLevel === 'Chronic'` as proxy or pass txCount through context.
   - Recommendation: Use `chronicityLevel === 'Chronic'` for goals (CRV-02). It's already in context and semantically correct — chronic pain patients get conservative goals regardless of visit count. The curve dampener (CRV-01) uses `txCount` directly since it's in `TXSequenceOptions`.

3. **Dampener value tuning**
   - What we know: 0.82 gives ~18% slower progression. Medical history already applies 0.70-1.0 range.
   - What's unclear: Whether 0.82 produces clinically plausible visit-by-visit values for all 30 fixtures.
   - Recommendation: Implement with 0.82, then visually inspect the 20-visit fixture snapshots (seeds 100003, 100006, 100012, 100015, 100021, 100025, 100026). Adjust if late visits show too much or too little improvement.

## Sources

### Primary (HIGH confidence)
- `src/generator/tx-sequence-engine.ts` — Full source analysis of progress curve (L729-738), PRNG usage (26 rng() calls), and target calculation (L614-637)
- `src/generator/goals-calculator.ts` — Full source analysis of ST/LT goal computation, OPTIMAL_END_RATIO constant
- `src/generator/__fixtures__/fixture-data.ts` — 30 fixture definitions with seeds 100001-100030
- `src/generator/__fixtures__/fixture-snapshots.test.ts` — Snapshot test infrastructure
- `src/generator/__fixtures__/parity-diff.test.ts` — 9 parity tests with seeds 200001-200009
- `.planning/REQUIREMENTS.md` — CRV-01, CRV-02 requirement definitions
- `.planning/STATE.md` — PRNG constraint, fixture snapshot constraint, phase dependency (13 before 14)

### Secondary (MEDIUM confidence)
- Clinical pain management literature: 30-50% improvement is standard expectation for chronic pain (supports CRV-02 rationale)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, pure internal refactoring of two well-understood modules
- Architecture: HIGH — dampener pattern is minimal-risk, no PRNG sequence changes inside loop
- Pitfalls: HIGH — PRNG sensitivity is well-documented in STATE.md and verified by analyzing all 26 rng() call sites
- Goals calibration values: MEDIUM — specific numeric caps (0.55 ratio, 80% ROM, 4/5 Strength) need validation against fixture output

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, no external dependencies)
