# Phase 14: Assessment Reflection - Research

**Researched:** 2026-02-23
**Domain:** TX Assessment text generation — specificity + cumulative tracking
**Confidence:** HIGH

## Summary

Phase 14 enriches the TX Assessment section so it reflects specific improvements observed in S/O data rather than using generic template phrases. Currently `deriveAssessmentFromSOA()` in tx-sequence-engine.ts picks from a small set of options based on pain delta and frequency. The assessment text in `generateAssessmentTX()` (soap-generator.ts) fills a fixed template structure using `visitState.soaChain.assessment.*` fields.

The three requirements (ASS-01, ASS-02, ASS-03) are tightly scoped:

1. **ASS-01** — When measurable progress exists (pain drop, ADL improvement, frequency change), the assessment should mention the *specific* type of improvement, not just "improvement of symptom(s)". This maps to smarter selection of `whatChanged` and `present` fields from existing template options.

2. **ASS-02** — Cumulative progress tracking (IE baseline → current visit) enables stronger assessment language at later visits. A visit at 70% progress with cumulative pain drop of 4+ points should use "decreased" instead of "slightly decreased". This requires passing cumulative deltas into `deriveAssessmentFromSOA()`.

3. **ASS-03** — All output must use existing template option strings. No free-text generation. This is a constraint, not a feature — it means we only change *selection logic*, not the option arrays.

## Architecture Analysis

### Current Flow

```
tx-sequence-engine.ts (loop per visit)
  → computes painDelta, adlDelta, frequencyImproved, objective trends
  → calls deriveAssessmentFromSOA({ painDelta, adlDelta, frequencyImproved, visitIndex, objective*Trend })
  → returns { present, patientChange, whatChanged, physicalChange, findingType }
  → stored in visitState.soaChain.assessment

soap-generator.ts generateAssessmentTX()
  → reads visitState.soaChain.assessment.* fields
  → fills template: "presents with {present} The patient has {patientChange} {whatChanged}, physical finding has {physicalChange} {findingType}."
```

### What Changes

1. **deriveAssessmentFromSOA()** gains cumulative context parameters:
   - `cumulativePainDrop`: total pain reduction from IE baseline (e.g., 8 → 4 = 4.0)
   - `progress`: 0-1 normalized visit progress
   - `totalVisits`: total visit count for context

2. **Selection logic** becomes progress-aware:
   - Early visits (progress < 0.34): conservative — "slight improvement", "slightly decreased"
   - Mid visits (0.34-0.67): specific — mentions ADL/frequency/pain based on which improved most
   - Late visits (> 0.67): cumulative — uses stronger language when cumulative evidence supports it

3. **whatChanged rotation** becomes evidence-based instead of visitIndex modulo:
   - If frequency improved this visit → "pain frequency" (existing hard rule, kept)
   - If ADL improved significantly → "difficulty in performing ADLs"
   - If pain dropped significantly → "pain" or "pain duration"
   - If objective findings improved → "muscles tightness" / "joint ROM" etc.
   - Rotation uses visitIndex only as tiebreaker among equally-valid options

4. **findingType** gains cumulative awareness:
   - When multiple objective metrics improved, prioritize the one with most cumulative change
   - Late visits with strong cumulative ROM improvement → "joint ROM" (not "joint ROM limitation")

### Files Modified

| File | Change | Risk |
|------|--------|------|
| `tx-sequence-engine.ts` | Expand `deriveAssessmentFromSOA()` params + logic; pass cumulative data from loop | MEDIUM — must not add rng() calls |
| `fixture-snapshots.test.ts.snap` | Regenerate — assessment text will change | LOW — expected |
| `parity-diff.test.ts` | May need snapshot update if parity output changes | LOW |

### Files NOT Modified

| File | Reason |
|------|--------|
| `soap-generator.ts` | Template structure unchanged (ASS-03); only the *values* fed into it change |
| `template-logic-rules.ts` | Rule engine weights unchanged |
| `goals-calculator.ts` | Goals are Plan section, not Assessment |

## Critical Constraints

1. **No new rng() calls** in the engine loop — PRNG sequence sensitive
2. **All assessment text must come from existing TX_*_OPTIONS arrays** (ASS-03)
3. **30 fixture snapshots will change** — this is expected since assessment text changes; must regenerate
4. **deriveAssessmentFromSOA is pure** — no side effects, deterministic from inputs

## Implementation Strategy

**3 plans:**

1. **14-01**: TDD — Expand `deriveAssessmentFromSOA()` with cumulative params + progress-aware selection logic. Unit tests for all selection paths.
2. **14-02**: TDD — Wire cumulative tracking in engine loop (compute cumulativePainDrop from IE baseline, pass to deriveAssessmentFromSOA). Integration tests.
3. **14-03**: Snapshot regeneration + parity verification (same pattern as 13-03).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ASS-01 | TX Assessment mentions specific improvements (ADL, pain, symptom) when current visit shows measurable progress | Smarter `whatChanged` selection in `deriveAssessmentFromSOA()` based on which metric improved most, using existing template options |
| ASS-02 | Cumulative progress tracking (IE → current visit) enables stronger assessment language at later visits | New `cumulativePainDrop` + `progress` params passed from engine loop; thresholds gate "decreased" vs "slightly decreased" |
| ASS-03 | All assessment output strictly follows existing template structure — no out-of-template statements | Constraint enforced by design: only selection logic changes, option arrays untouched |
</phase_requirements>
