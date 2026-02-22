# Roadmap — v1.0 Production Hardening

## Phase 1: Auth & Access Control ✓
**Goal:** Lock down API access with JWT + API key auth, CORS, rate limiting
**Status:** Complete

## Phase 2: Data Security ✓
**Goal:** Migrate to exceljs, encrypt cookies, non-root Docker, TLS ready
**Status:** Complete

## Phase 3: Storage & Reliability ✓
**Goal:** DATA_DIR + LRU batch store, TS 0 errors, healthchecks, lazy routes
**Status:** Complete

## Phase 4: Security Hardening & Stability
**Goal:** Fix security gaps (Excel validation, CSRF) and known bugs (type safety, pain parser, env validation)
**Status:** Planned
**Requirements:** [SEC-1, SEC-2, SEC-3, BUG-1, BUG-2]
**Plans:** 2/2 plans complete

Plans:
- [ ] 04-01-PLAN.md — Excel magic bytes validation, 5MB limit, pain parser type safety, auditor nullish coalescing
- [ ] 04-02-PLAN.md — CSRF double-submit cookie middleware, production env validation
