# Project State

## Status
v1.4 UX & Engine Tuning — Defining requirements

## Project Reference
See: .planning/PROJECT.md (updated 2026-02-22)

**Core value:** Batch-generate compliant SOAP notes from minimal input
**Current focus:** Defining requirements for v1.4

## Current Position
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-22 — Milestone v1.4 started

## Performance Metrics
- v1.0: 4 phases complete (Production Hardening)
- v1.1: 4 phases, 5 plans complete (Automation Stability)
- v1.2: 1 phase, 1 plan complete (Batch Logic)
- v1.3: 2 phases, 3 plans complete (Form UX & Shared Data)

## Accumulated Context

### Critical Constraints
- MDLand is non-idempotent: ICD/CPT codes are appended, not replaced
- Session-expired errors must stop the batch (ERR-03), never retry
- Single server deployment (Oracle Cloud)
- BatchView.vue is 1,697 lines — primary refactor target

### Blockers
None

## Decisions
(Cleared at milestone — full log in PROJECT.md Key Decisions table)

## Session Continuity
- Branch: v1.1-ux
- Next action: Define requirements
- Last session: 2026-02-22 — v1.4 milestone started
