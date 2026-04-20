# Tier A + Tier B step 1 Refactor — Archive

**Delivered**: 2026-04-19
**Branch**: clean-release
**Commits**: c961766..78f0b6d (13 commits)

## Contents

| File | Purpose |
|------|---------|
| `architecture-diagnosis.md` | Initial architect agent diagnosis of SOAP System (5K LOC TX engine, 21 macOS dupes, cycle, etc.) |
| `plan-v5.md` | Frozen implementation plan after 4 rounds of Codex adversarial review |
| `tx-engine-state-flow.md` | B1.1 state flow map — 5 tables covering EngineState / VisitAccumulator / true-vs-display / stage→field / uncovered domains. **Keep this document — Tier B step 2 (sub-seed runtime wiring) starts here.** |
| `codex-audit-phase2-4-rounds.md` | Phase 2 adversarial review transcripts (4 rounds of rejection → refine → freeze) |
| `codex-phase5-review.json` | Phase 5 diff review (2 findings: sub-seed not wired, fuzz weak — addressed in final commit) |
| `canonicalize-log.md` | Phase A1 decision log for 21 `* 2.*` macOS duplicate files |
| `snapshot-rebaseline-signoff.md` | Phase B1.7 — auto-approved (snapshot byte-identical, no rebaseline performed) |
| `verify-log.md` | Phase 6 fresh-evidence verification of every AC |
| `pipeline-state-final.json` | Final codex-6 pipeline state (all 5 manual gates approved) |

## Key Outcomes

- `generateTXSequenceStates` body: 1010 LOC → 105 LOC (-90%)
- `tx-sequence-engine.ts ↔ soap-generator.ts` circular import broken
- `objectiveMuscleSeed` moved to `src/shared/muscle-seed.ts`
- 4 body-part constants moved to `src/shared/body-part-constants.ts`
- `auditor/layer1/index.ts` fs.readFileSync → lazy + `__dirname`
- pdfjs worker self-hosted via Vite `?url`; CSP tightened (no cdn.jsdelivr)
- 21 macOS `* 2.*` duplicates canonicalized
- ARCHITECTURE.md bumped to v2.4.1 (doc/code drift eliminated)
- 6 property-based fuzz tests added (fast-check, 300 runs)
- Sub-seed infrastructure (`src/shared/sub-seed.ts`) ready for Tier B step 2

## Residual Work (Tier B step 2+)

1. **Sub-seed runtime wiring** — plug `deriveSubSeed` into each stage's RNG. Will produce a one-time snapshot rebaseline that 16 fixtures must human-review.
2. **Split `soap-generator.ts`** (still 3000+ LOC) — same staged approach.
3. **Split `BatchView.vue`** (1673 LOC SFC) — componentize.
4. **Rewrite `note-checker.ts`** (1962 LOC) as rule registry.
5. **Auditor tests** — 0 coverage currently.
6. **Finalize `pdf_smoke_signoff`** — user browser-upload PDF + CSP console check.

## Process Notes

- **codex-6 pipeline ran 4 rounds of Phase 2 Codex challenge** before plan freeze. Each round surfaced genuine spec gaps; final v5 had zero critical findings in Phase 5 diff review.
- **Sub-seed deferred from runtime** — original plan AC-B3 was ambiguous (infrastructure vs runtime wiring). Chose infrastructure-only for step 1 to preserve snapshot byte-equivalence; runtime wiring slated for step 2.
- **Stage 4 internally split 4a + 4b** — original code interleaved objective numeric (early loop) with narrative (mid loop) with objective grading (late loop). To preserve PRNG order, stages 4a and 4b bookend stage 3 in the orchestrator, while maintaining a single logical "objectiveState" stage in the types contract.
