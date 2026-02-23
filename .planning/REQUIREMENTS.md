# Requirements: SOAP Batch System

**Defined:** 2026-02-22
**Core Value:** Batch-generate compliant SOAP notes from minimal input

## v1.5 Requirements

Requirements for v1.5 Engine & UX Completion. Each maps to roadmap phases.

### Recovery Curve

- [ ] **CRV-01**: Recovery curve spreads improvement across 20 visits with a chronic-aware variant (slower progression for txCount ≥ 16)
- [ ] **CRV-02**: Long-term goals reflect realistic 30-50% improvement for chronic pain patients (not 75%), with Strength/ROM never reaching fully normal values

### Assessment

- [ ] **ASS-01**: TX Assessment mentions specific improvements (ADL, pain, symptom) when the current visit shows measurable progress
- [ ] **ASS-02**: Cumulative progress tracking (IE → current visit) enables stronger assessment language at later visits
- [ ] **ASS-03**: All assessment output strictly follows existing template structure — no out-of-template statements

### Batch Form UX

- [ ] **UX-01**: User can select ICD codes before Body Part and Side, with ICD selection auto-filling Body Part and Side fields
- [ ] **UX-02**: Worst/Best/Current pain score fields are compacted to match actual character width (~60px)
- [ ] **UX-03**: Confirmed ICD codes display as chips on the right side of the form row, not above the field

### Seed Passthrough

- [ ] **SEED-01**: Batch API accepts optional seed per patient; response includes per-patient seeds used; replay with same seed produces identical SOAP output

### Plateau Breaker

- [ ] **PLAT-01**: When pain label is identical for 3+ consecutive visits, a micro-improvement (0.3-0.5 drop) is injected to break the plateau

### Medicare Phase Gate

- [ ] **GATE-01**: At visit 12 for Medicare patients, the note is annotated with cumulative improvement evidence per NCD 30.3.3 (validation-only, not curve modification)

## Future Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Deferred

- **GATE-01b**: Visit 12 RE note auto-flag — mark visit 12 for re-evaluation note type
- **PLAT-02**: Plateau breaker for non-pain metrics (ROM, strength stalls)
- **SEED-02**: Per-patient seed column in Excel template for batch upload

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fuse.js fuzzy ICD search | 80 entries don't justify fuzzy search overhead |
| LLM-generated assessment text | Non-deterministic, breaks reproducibility, compliance risk |
| Body-part grouping headers in ICD dropdown | Only needed if catalog grows beyond ~100 codes |
| Zod batch form validation | Deferred — inline check sufficient for seed field |
| D3/Chart.js curve visualization | Not in scope; ApexCharts in deps if needed later |
| json-rules-engine for phase gate | 45KB for 3 threshold checks — NCD 30.3.3 rules are static |
| Multi-phase recovery curve (acute/corrective/maintenance) | Complexity not justified for v1.5 |
| Auto-generated RE note content at visit 12 | Deferred to GATE-01b |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CRV-01 | — | Pending |
| CRV-02 | — | Pending |
| ASS-01 | — | Pending |
| ASS-02 | — | Pending |
| ASS-03 | — | Pending |
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| SEED-01 | — | Pending |
| PLAT-01 | — | Pending |
| GATE-01 | — | Pending |

**Coverage:**
- v1.5 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11 ⚠️

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after initial definition*
