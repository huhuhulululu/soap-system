# Project State

## Status
v1.3 Form UX & Shared Data — IN PROGRESS

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Batch-generate compliant SOAP notes from minimal input
**Current focus:** v1.3 — Form UX optimization + shared data extraction

## Current Position
Milestone: v1.3 in progress
Phase: 11-form-ux-validation — Plan 01 complete
Next action: /gsd:plan-phase 11 (plan 02 if exists, else next phase)
Last activity: 2026-02-23 — 11-01 form UX validation complete

## Performance Metrics
- v1.0: 4 phases complete (Production Hardening)
- v1.1: 4 phases, 5 plans complete (Automation Stability)
- v1.2: 1 phase, 1 plan complete (Batch Logic)
- v1.3: phase 10 plan 01 complete (Shared Data Extraction), phase 11 plan 01 complete (Form UX)

## Accumulated Context

### Critical Constraints
- MDLand is non-idempotent: ICD/CPT codes are appended, not replaced
- Session-expired errors must stop the batch (ERR-03), never retry
- Single server deployment (Oracle Cloud)
- BatchView.vue is 1,697 lines — primary refactor target

### Blockers
None

## Decisions
- 10-01: ICDCatalogEntry adapter maps code→icd10, name→desc without renaming backend fields
- 10-01: CPT helpers delegate to getDefaultTXCPT/getDefaultIECPT — no data duplication
- 11-01: No default values for gender/laterality — empty string forces explicit selection
- 11-01: submitDrafts maps drafts inline to add patient string — name+dob stay separate in state

## Session Continuity
- Branch: v1.1-ux
- Next action: Continue phase 11 or next phase
- Last session: 2026-02-23 — Completed 11-01-PLAN.md
