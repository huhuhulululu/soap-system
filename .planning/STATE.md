# Project State

## Current Phase
Phase 4: Security Hardening & Stability — Plan 02 complete

## Current Plan
Plan 03 of Phase 4

## Last Session
- **Stopped at:** Completed 04-01-PLAN.md (magic bytes + type-safety fixes)
- **Date:** 2026-02-22

## Decisions
- 5MB upload limit (down from 10MB) — sufficient for clinical Excel files
- Magic bytes check in route handler not fileFilter — fileFilter has no buffer access
- Keep XLS_MAGIC alongside XLSX_MAGIC — existing users may have .xls files
- process.stderr.write over console.warn — coding style prohibits console.* statements
- No CSRF exemption for x-api-key clients — all state-changing requests require matching cookie+header token
- validateEnv() placed in require.main block only — createApp() stays test-safe
- Cookie HttpOnly omitted (default false) so client JS can read csrf_token for header echo
