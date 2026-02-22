# Project State

## Current Phase
Phase 4: Security Hardening & Stability — Plan 02 complete

## Current Plan
Plan 03 of Phase 4

## Last Session
- **Stopped at:** Completed 04-02-PLAN.md (CSRF + env validation)
- **Date:** 2026-02-22

## Decisions
- No CSRF exemption for x-api-key clients — all state-changing requests require matching cookie+header token
- validateEnv() placed in require.main block only — createApp() stays test-safe
- Cookie HttpOnly omitted (default false) so client JS can read csrf_token for header echo
