---
phase: 04-security-hardening-stability
plan: 01
subsystem: api
tags: [multer, file-upload, magic-bytes, type-safety, validation]

requires: []
provides:
  - Magic bytes validation rejecting non-Excel uploads with 400
  - 5MB upload size limit enforced by multer
  - Type-safe extractPainCurrent with stderr warning on fallback
  - Auditor layer1 using nullish coalescing for option defaults
affects: [batch-upload, field-parsers, auditor]

tech-stack:
  added: []
  patterns:
    - "Magic bytes check in route handler (not fileFilter) — buffer only available post-upload"
    - "warnFallback helper writes to process.stderr, not console.warn"
    - "?? over || for option defaults where empty-string/0 are valid values"

key-files:
  created: []
  modified:
    - server/routes/batch.ts
    - src/shared/field-parsers.ts
    - src/auditor/layer1/index.ts

key-decisions:
  - "5MB upload limit (down from 10MB) — sufficient for clinical Excel files"
  - "Magic bytes check in route handler not fileFilter — fileFilter has no buffer access"
  - "Keep XLS_MAGIC alongside XLSX_MAGIC — existing users may have .xls files"
  - "process.stderr.write over console.warn — coding style prohibits console.* statements"

patterns-established:
  - "isValidExcelBuffer: pure function, module-level magic byte constants as Buffer"
  - "Type guard pattern: check typeof before casting to Record<string, unknown>"

requirements-completed: [SEC-1, BUG-1, BUG-2]

duration: 2min
completed: 2026-02-22
---

# Phase 4 Plan 01: Security Hardening & Stability Summary

**Magic bytes Excel validation (5MB limit, XLSX/XLS), type-safe pain parser with stderr fallback, and nullish coalescing in auditor layer1**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T08:51:42Z
- **Completed:** 2026-02-22T08:53:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Non-Excel files (wrong magic bytes) now rejected with 400 before any parsing
- Upload limit reduced from 10MB to 5MB
- `extractPainCurrent` uses `Record<string, unknown>` with proper type guards, no `as any`
- Fallback path in pain parser writes warning to stderr
- Auditor layer1 uses `??` (nullish coalescing) instead of `||` on all three option-default lines

## Task Commits

1. **Task 1: Magic bytes validation + 5MB limit** - `8d91ad3` (feat)
2. **Task 2: Type-safe pain parser + auditor nullish coalescing** - `f593282` (fix)

## Files Created/Modified
- `server/routes/batch.ts` - Added `isValidExcelBuffer`, XLSX/XLS magic constants, 5MB limit, 400 guard in POST handler
- `src/shared/field-parsers.ts` - Replaced `as any` with `Record<string, unknown>` + type guards, added `warnFallback`
- `src/auditor/layer1/index.ts` - Replaced `|| []` with `?? []` on lines 55, 76, 97

## Decisions Made
- Magic bytes check placed in route handler (not multer `fileFilter`) because `fileFilter` runs before the buffer is available in memory storage
- Kept both XLSX and XLS magic bytes — existing users may upload legacy `.xls` files
- Used `process.stderr.write` for fallback warning per coding style (no `console.*`)

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SEC-1, BUG-1, BUG-2 complete
- Ready for plan 02 (remaining security hardening tasks)

---
*Phase: 04-security-hardening-stability*
*Completed: 2026-02-22*
