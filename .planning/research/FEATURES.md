# Feature Research — v1.5 New Features

**Domain:** SOAP generation engine — seed passthrough, plateau breaker, Medicare phase gate (acupuncture)
**Researched:** 2026-02-22
**Confidence:** HIGH (based on code inspection + CMS NCD 30.3.3 + tx-sequence-engine analysis)

## Context: What Already Exists

**Seed / PRNG infrastructure (v1.0–v1.4):**
- `tx-sequence-engine.ts`: `mulberry32` seeded PRNG via `createSeededRng(seed?)` — deterministic when seed provided, entropy-mixed when omitted
- `TXSequenceOptions.seed` accepted by `generateTXSequenceStates()`, returned in `TXSequenceResult.seed`
- `BatchVisit.generated.seed` stores the seed used for each visit (server/types.ts:27)
- Compose path: `WriterPanel.vue` has seed input field + copy button; `useSOAPGeneration.ts` passes `seedInput` to engine
- Batch path: `generateTXSeries()` creates `Math.random()` seed per patient, stores in `generated.seed`
- Regenerate endpoint: `PUT /api/batch/:batchId/visit/:patientIdx/:visitIdx` accepts `req.body.seed` and passes to `regenerateVisit()`
- 30 fixture snapshots + 9 parity tests validate seed reproducibility

**Gap:** Batch-level seed passthrough is missing. The batch POST/JSON endpoints (`POST /api/batch`, `POST /api/batch/json`) do not accept a seed parameter. Seeds are generated internally via `Math.random()` in `generateTXSeries()` and `generateMixedBatch()`. A caller cannot replay an entire batch deterministically — only individual visits via the PUT regenerate endpoint.

**Plateau detection (v1.4):**
- `tx-sequence-engine.ts:855-870`: existing plateau detection triggers when `(progress > 0.7 && painDelta < 0.2 && adlDelta < 0.12 && !frequencyImproved) || painScaleLabel === prevPainScaleLabel`
- When plateau detected: ROM and/or strength trends are forced to `'stable'` (late-stage: randomly one; mid-stage: both)
- This is a *cosmetic* plateau — it suppresses objective improvement claims when pain stalls, but does NOT inject micro-improvements to break the stall

**Gap:** No mechanism to nudge pain downward when it stalls for 3+ consecutive visits. The monotonic constraint (`Math.min(prevPain, ...)`) combined with noise capping (`NOISE_CAP = 0.15`) means once pain lands on a grid value, it can stick there indefinitely. Consecutive identical `painScaleLabel` values look clinically suspicious and fail to demonstrate the "improvement" Medicare requires.

**Medicare visit structure (v1.3–v1.4):**
- Recovery curve spans `txCount` visits with S-curve progress
- `progressMultiplier` from `medical-history-engine.ts` adjusts curve speed per comorbidity
- No awareness of visit 12 as a phase boundary
- No RE (re-evaluation) note auto-generation at visit 12

**Gap:** The engine treats all visits uniformly. There is no phase gate at visit 12 that ensures documented improvement sufficient to justify the additional 8 visits under NCD 30.3.3.

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| SEED-01: Batch seed passthrough | Operator already uses seed in compose path for deterministic replay; expects same capability when submitting batch via API or JSON endpoint | LOW | Thread `seed` param through `POST /api/batch`, `POST /api/batch/json`, and `POST /:batchId/generate` into `generateTXSeries()` and `generateMixedBatch()`. Store per-patient seed in response. |
| SEED-01b: Batch replay from stored seeds | After generating a batch, operator expects to re-generate identical output by re-submitting with the same seeds | LOW | Return `seeds: Record<patientIdx, number>` in batch response; accept `seeds[]` array in request body; pass each to the corresponding patient's `TXSequenceOptions.seed` |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PLAT-01: Plateau breaker (3-visit stall detection) | When pain stalls at the same `painScaleLabel` for 3+ consecutive visits, inject a micro-improvement (0.3–0.5 pain drop) to break the plateau. Prevents clinically suspicious flat sequences that auditors flag as "no improvement" | MEDIUM | Track `consecutiveSamePain` counter in the visit loop. When counter hits 3, override `expectedPain` with `prevPain - microDrop` (0.3–0.5 range, RNG-varied). Reset counter on any label change. Must respect `targetPain` floor and `snapPainToGrid` alignment. |
| GATE-01: Medicare Visit 12 phase gate | At visit 12, ensure cumulative improvement meets NCD 30.3.3 threshold for authorizing visits 13–20. If progress is insufficient, accelerate the curve to guarantee documented improvement at the checkpoint | MEDIUM | At `visitIndex === 12`: compute `cumulativePainDrop = startPain - currentPain`. If drop < 1.5 points (or < 20% of startPain), apply a one-time correction nudge. Also ensure at least one objective trend (ROM, strength, tightness, or tenderness) shows improvement at visit 12. Optionally flag visit 12 for RE note generation. |
| GATE-01b: Visit 12 RE note auto-flag | Mark visit 12 as needing a Re-Evaluation note type instead of TX, so the operator knows to document the Medicare reassessment | LOW | Add `phaseGate: boolean` flag to `TXVisitState`. When `visitIndex === 12 && txCount >= 13`, set `phaseGate: true`. Frontend/batch consumer uses this to switch note type or display a warning. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Allow pain increases (non-monotonic) to "break" plateaus | "Real patients have setbacks" | CMS auditors flag pain increases as treatment failure; V01 monotonic constraint exists to prevent this; pain spikes require exacerbation documentation that survives audit | PLAT-01 plateau breaker: inject micro-*improvements*, not regressions. Keep monotonic constraint intact. |
| Auto-generate RE note content at visit 12 | "System should write the reassessment" | RE notes require clinical judgment about whether to continue treatment; auto-generating the decision creates liability; the system generates TX notes, not clinical decisions | GATE-01b: flag visit 12 for RE, but let the clinician write the reassessment content. System can pre-populate improvement summary data. |
| Per-patient seed in Excel template column | "Let me control seeds from the spreadsheet" | Adds complexity to Excel parsing; seeds are implementation details, not clinical data; operators who need replay can use the JSON API with stored seeds | Return seeds in batch response JSON; accept seeds via JSON endpoint only. Keep Excel template clinical-data-only. |

---

## Feature Dependencies

```
SEED-01: Batch seed passthrough
    └──requires──> TXSequenceOptions.seed (EXISTS)
    └──requires──> BatchVisit.generated.seed storage (EXISTS)
    └──standalone (no engine changes needed)

PLAT-01: Plateau breaker
    └──requires──> painScaleLabel tracking across visits (EXISTS: prevPainScaleLabel)
    └──requires──> snapPainToGrid (EXISTS)
    └──requires──> monotonic constraint preservation (EXISTS: Math.min(prevPain, ...))
    └──enhances──> GATE-01 (plateau breaker prevents flat sequences that fail the phase gate)

GATE-01: Medicare Visit 12 phase gate
    └──requires──> PLAT-01 (if plateau breaker is active, visit 12 is more likely to pass naturally)
    └──requires──> startPain tracking (EXISTS: startPain variable in generateTXSequenceStates)
    └──requires──> cumulative objective trend access (EXISTS: prevTightness, prevTenderness, etc.)
    └──enhances──> GATE-01b (phase gate data feeds the RE flag)

GATE-01b: Visit 12 RE auto-flag
    └──requires──> GATE-01 (needs phase gate logic to know when to flag)
    └──requires──> TXVisitState extension (NEEDS: add phaseGate field)
```

### Dependency Notes

- **PLAT-01 enhances GATE-01**: if the plateau breaker keeps pain moving downward, the visit 12 checkpoint is more likely to show sufficient improvement without needing a correction nudge. Implement PLAT-01 first, then GATE-01 may only need a verification check rather than an active correction.
- **SEED-01 is fully independent**: no engine logic changes, pure parameter threading. Can ship in isolation.
- **GATE-01 requires TXVisitState extension**: adding `phaseGate: boolean` to the state interface. This is a minor type change but touches the 30 fixture snapshots (they'll need the new field, defaulting to `false`).

---

## Expected Behavior (Detailed)

### SEED-01: Batch Seed Passthrough

**Current flow:**
1. `POST /api/batch/json` → `generateMixedBatch()` → `generateTXSeries()` → `Math.floor(Math.random() * 100000)` as seed
2. Seed stored in `visit.generated.seed` but not controllable by caller
3. Only `PUT /:batchId/visit/:pIdx/:vIdx` accepts `req.body.seed` for single-visit regeneration

**Expected flow:**
1. `POST /api/batch/json` accepts optional `seed` (number) or `seeds` (number[], one per patient)
2. If `seed` provided: all patients use `seed + patientIndex` (deterministic, distinct per patient)
3. If `seeds[]` provided: patient[i] uses `seeds[i]`
4. If neither: current `Math.random()` behavior (backward compatible)
5. Response includes `seeds: number[]` mapping each patient to the seed used
6. Replaying with same `seeds[]` + same input data produces byte-identical output

**Touchpoints:**
- `server/routes/batch.ts`: parse `seed`/`seeds` from `req.body`, pass to generator
- `server/services/batch-generator.ts`: `generateTXSeries()` and `generateMixedBatch()` accept seed param instead of `Math.random()`
- `server/services/batch-generator.ts`: `generateSingleVisit()` already accepts `seed?` — wire it through
- No engine changes needed — `TXSequenceOptions.seed` already works

### PLAT-01: Plateau Breaker

**Current behavior (lines 855–870 of tx-sequence-engine.ts):**
```typescript
const plateau =
  (progress > 0.7 && painDelta < 0.2 && adlDelta < 0.12 && !frequencyImproved) ||
  painScaleLabel === prevPainScaleLabel
if (plateau) {
  // Suppresses ROM/strength trends — cosmetic only
}
```
Pain can stall at the same `painScaleLabel` for many consecutive visits because:
- `expectedPain` converges toward `targetPain` asymptotically
- `NOISE_CAP = 0.15` limits perturbation
- `snapPainToGrid` quantizes to integer/range labels
- `Math.min(prevPain, ...)` prevents any upward correction

**Expected behavior:**
1. Track `consecutiveSamePainLabel` counter (increment when `painScaleLabel === prevPainScaleLabel`, reset to 0 otherwise)
2. When `consecutiveSamePainLabel >= 3`:
   - Compute `microDrop = 0.3 + rng() * 0.2` (range 0.3–0.5)
   - Override: `rawPain = Math.max(targetPain, prevPain - microDrop)`
   - Re-snap via `snapPainToGrid(rawPain)` — this guarantees a label change
   - Reset counter to 0
3. Constraints preserved:
   - `rawPain >= targetPain` (never overshoot the goal)
   - Monotonic: the drop is always downward (no V01 violation)
   - PRNG: `rng()` call appended at end of existing sequence (per PROJECT.md constraint: "new rng() calls must append at end of loop")
4. Side effects on other metrics:
   - The pain drop triggers `painDelta > 0`, which allows `symptomChange: 'improvement of symptom(s)'`
   - Tightness/tenderness gates may trigger (they depend on `progress` which is independent)
   - Assessment `deriveAssessmentFromSOA` receives a real `painDelta`, producing a meaningful A section

**Edge cases:**
- If `prevPain` is already at or near `targetPain` (within 0.3), the micro-drop would overshoot → clamp to `targetPain`
- If `txCount <= 4`, plateaus of 3 visits are unlikely but possible → breaker still fires, just rare
- Continue mode (`startVisitIndex > 1`): counter starts at 0 regardless of prior history (no way to know prior labels)

### GATE-01: Medicare Visit 12 Phase Gate

**CMS NCD 30.3.3 requirements (from policy text):**
- Initial 12 sessions covered in 90-day period
- Additional 8 sessions covered only if patient "demonstrating an improvement"
- "Treatment must be discontinued if the patient is not improving or is regressing"
- No formal definition of "meaningful improvement" — operational threshold is clinic/MAC-dependent
- Annual cap: 20 sessions total

**Expected behavior:**
1. When `visitIndex === 12` and `txCount >= 13` (i.e., there are visits after the gate):
   - Compute `cumulativePainDrop = startPain - painScaleCurrent`
   - Compute `cumulativePainPercent = cumulativePainDrop / startPain`
   - Check objective trends: at least one of (tightness, tenderness, ROM, strength) should show cumulative improvement vs visit 1
2. If `cumulativePainDrop < 1.5` OR `cumulativePainPercent < 0.15`:
   - Apply correction: `painScaleCurrent = Math.max(targetPain, startPain - Math.max(1.5, startPain * 0.15))`
   - Re-snap and re-derive all dependent metrics (severity, symptomChange, assessment)
3. Set `phaseGate: true` on the visit 12 state
4. Post-gate visits (13–20) continue normal curve from the corrected visit 12 pain level

**Why 1.5 points / 15% threshold:**
- A patient starting at pain 8 must show at least 8→6.5 (or 8→6.8 by percentage) by visit 12
- This is conservative enough that the normal S-curve almost always passes naturally
- The gate is a safety net, not a routine correction — PLAT-01 should prevent most cases where the gate would need to fire

**Touchpoints:**
- `src/generator/tx-sequence-engine.ts`: add gate check inside the visit loop at `i === 12`
- `TXVisitState`: add `phaseGate: boolean` field (default `false`)
- Fixture snapshots: 30 fixtures use `txCount: 11` (visits 1–11), so they won't hit the gate — no snapshot breakage
- Parity tests: seeds 200001–200009 use `txCount` values that may need verification

---

## Milestone Definition

### v1.5 Ship (this milestone)

- [ ] SEED-01: Batch seed passthrough — LOW effort, pure parameter threading, no engine changes
- [ ] PLAT-01: Plateau breaker — MEDIUM effort, new counter + micro-drop logic in visit loop, must respect PRNG ordering constraint
- [ ] GATE-01: Medicare Visit 12 phase gate — MEDIUM effort, conditional check at visit 12, correction nudge, phaseGate flag

### Add After Validation (v1.6+)

- [ ] GATE-01b: Visit 12 RE note auto-flag in frontend — trigger: when clinics actively billing Medicare
- [ ] Per-patient seed display in batch results UI — trigger: when operators request replay capability from frontend
- [ ] Plateau breaker tuning (configurable stall threshold, micro-drop range) — trigger: if 3-visit threshold proves too aggressive or too conservative

### Future Consideration (v2+)

- [ ] Multi-phase recovery curve (acute/corrective/maintenance segments) — only if 20-visit Medicare patients become primary use case
- [ ] Plateau breaker for non-pain metrics (ROM, strength stalls) — only if auditors flag objective metric plateaus

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SEED-01: Batch seed passthrough | HIGH (deterministic replay) | LOW (param threading) | P1 |
| PLAT-01: Plateau breaker | HIGH (audit compliance) | MEDIUM (engine loop change) | P1 |
| GATE-01: Visit 12 phase gate | HIGH (Medicare compliance) | MEDIUM (conditional + correction) | P1 |
| GATE-01b: RE note auto-flag | MEDIUM (UX convenience) | LOW (flag + UI) | P2 |
| Per-patient seed in UI | LOW (niche use case) | LOW (display only) | P3 |

**Priority key:**
- P1: Must have for v1.5
- P2: Should have, add when triggered
- P3: Nice to have, future consideration

---

## Complexity & Risk Assessment

| Feature | Risk | Mitigation |
|---------|------|------------|
| SEED-01 | Near-zero — pure plumbing, no logic changes | Existing seed tests validate determinism; add one integration test for batch-level replay |
| PLAT-01 | PRNG ordering — new `rng()` call in the plateau branch changes all subsequent random values for that seed | Append the `rng()` call unconditionally (consume it even when not in plateau) so the PRNG sequence length is constant regardless of plateau occurrence. This preserves fixture snapshot compatibility. |
| PLAT-01 | Cascade — micro-drop at visit N changes `prevPain` for all subsequent visits | Expected and desired. The whole point is to unstick the curve. Fixture snapshots (txCount=11, seeds 100001–100030) should be re-captured after implementation. |
| GATE-01 | Fixture snapshots use txCount=11 — gate fires at visit 12, so no snapshot breakage | Verify parity seeds (200001–200009) don't use txCount >= 13. If they do, re-capture. |
| GATE-01 | Over-correction — if gate nudge is too aggressive, visits 13–20 have an artificially steep drop | Gate only fires when natural curve is insufficient; nudge targets minimum threshold (1.5 pts), not optimal. Post-gate curve resumes from corrected level naturally. |

---

## Sources

- [CMS NCD 30.3.3 — Acupuncture for Chronic Lower Back Pain](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=373) — "up to 12 visits in 90 days", "additional 8 sessions for those demonstrating improvement", "treatment must be discontinued if not improving"
- [Medicare.gov — Acupuncture Coverage](https://medicare.gov/coverage/acupuncture) — 20 session annual cap, improvement requirement
- [Humana — Does Medicare Cover Acupuncture?](https://www.humana.com/medicare/medicare-resources/does-medicare-cover-acupuncture) — reassessment documentation expectations
- [Acupuncture Today — Documentation Best Practices](https://acupuncturetoday.com/article/33757-is-your-documentation-falling-short-heres-how-and-why-to-do-it-right) — plateau documentation in SOAP notes
- [Acupuncture Today — Best Practices in SOAP Notation](https://acupuncturetoday.com/article/33660-best-practices-in-soap-notation) — timeline documentation for stalled progress
- Code inspection: `src/generator/tx-sequence-engine.ts` (lines 288–1215), `server/services/batch-generator.ts`, `server/routes/batch.ts`, `server/types.ts`, `src/shared/normalize-generation-context.ts`

---
*Feature research for: v1.5 New Features (seed passthrough, plateau breaker, Medicare phase gate)*
*Researched: 2026-02-22*
