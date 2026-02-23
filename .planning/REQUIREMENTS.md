# Requirements: SOAP Batch System

**Defined:** 2026-02-22
**Core Value:** Batch-generate compliant SOAP notes from minimal input

## v1.4 Requirements

Requirements for v1.4 UX & Engine Tuning. Each maps to roadmap phases.

### Form UX

- [ ] **UX-01**: User can select ICD codes before Body Part and Side, with ICD selection auto-filling Body Part and Side fields
- [ ] **UX-02**: Worst/Best/Current pain score fields are compacted to match actual character width (~60px)
- [ ] **UX-03**: Confirmed ICD codes display as chips on the right side of the form row, not above the field

### Generation Parity

- [ ] **PAR-01**: Same patient data produces identical SOAP output via batch mode and compose mode
- [ ] **PAR-02**: Shared `normalizeGenerationContext()` function standardizes input for both generation paths

### Recovery Curve

- [ ] **CRV-01**: Recovery curve spreads improvement across 20 visits with a chronic-aware variant (slower progression for txCount ≥ 16)
- [ ] **CRV-02**: Long-term goals reflect realistic 30-50% improvement for chronic pain patients (not 75%), with Strength/ROM never reaching fully normal values

### Assessment

- [ ] **ASS-01**: TX Assessment mentions specific improvements (ADL, pain, symptom) when the current visit shows measurable progress
- [ ] **ASS-02**: Cumulative progress tracking (IE → current visit) enables stronger assessment language at later visits
- [ ] **ASS-03**: All assessment output strictly follows existing template structure — no out-of-template statements

### Engine Audit

- [ ] **AUD-01**: Strength/ROM generation logic audited for consistency across compose mode, batch mode, and realistic patch
- [ ] **AUD-02**: 30 reference seed fixture snapshots captured before any engine modification to detect regressions

## Future Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Deferred

- **SEED-01**: Batch seed passthrough for deterministic regeneration via API
- **PLAT-01**: Plateau breaker — micro-improvement injection when pain stalls 3+ consecutive visits
- **GATE-01**: Visit 12 Medicare phase gate for NCD 30.3.3 compliance

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fuse.js fuzzy ICD search | 80 entries don't justify fuzzy search overhead |
| LLM-generated assessment text | Non-deterministic, breaks reproducibility, compliance risk |
| Body-part grouping headers in ICD dropdown | Only needed if catalog grows beyond ~100 codes |
| Zod batch form validation | Recommended for v1.5 parity layer |
| D3/Chart.js curve visualization | Not in scope; ApexCharts in deps if needed later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| PAR-01 | — | Pending |
| PAR-02 | — | Pending |
| CRV-01 | — | Pending |
| CRV-02 | — | Pending |
| ASS-01 | — | Pending |
| ASS-02 | — | Pending |
| ASS-03 | — | Pending |
| AUD-01 | — | Pending |
| AUD-02 | — | Pending |

**Coverage:**
- v1.4 requirements: 12 total
- Mapped to phases: 0
- Unmapped: 12 ⚠️

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after initial definition*
