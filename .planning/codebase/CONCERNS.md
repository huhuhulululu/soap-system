# Codebase Concerns

**Analysis Date:** 2026-02-22

## Tech Debt

**Large monolithic files (>1000 lines):**
- Issue: Multiple core files exceed 1000 lines, making them difficult to maintain and test
- Files:
  - `src/generator/soap-generator.ts` (2280 lines)
  - `src/generator/tx-sequence-engine.ts` (1215 lines)
  - `parsers/optum-note/checker/note-checker.ts` (1346 lines)
  - `parsers/optum-note/parser.ts` (1095 lines)
  - `ccnote/scraper.ts` (1007 lines)
- Impact: Reduced readability, harder to test individual functions, increased cognitive load
- Fix approach: Extract cohesive units into separate modules (e.g., separate ROM calculation, strength calculation, pain mapping logic)

**Type safety gaps with `as any` casts:**
- Issue: 30+ instances of `as any` type assertions bypass TypeScript safety
- Files:
  - `parsers/optum-note/checker/correction-generator.ts` (lines 201, 206, 311)
  - `parsers/optum-note/checker/bridge.ts` (lines 149, 177, 191)
  - `frontend/src/tests/fixtures/generator.ts` (lines 222, 226-228, 311, 438, 446, 460-461, 479-480, 486-487, 507-508, 565, 573)
  - `scripts/playwright/mdland-automation.ts` (lines 202, 502)
  - `ccnote/scraper.ts` (lines 93, 269, 361)
  - `server/index.ts` (line 29)
- Impact: Silent type errors, runtime failures, harder to refactor
- Fix approach: Define proper interfaces for visit records, pain scales, and window objects; use discriminated unions instead of casting

**Minimal error handling:**
- Issue: Only 3 explicit `throw new Error` statements in entire `src/` directory
- Files: `server/services/excel-parser.ts` (lines 47, 53)
- Impact: Silent failures, difficult debugging, poor user feedback
- Fix approach: Add comprehensive error handling with descriptive messages in all critical paths (parsing, generation, validation)

**Null/undefined returns without context:**
- Issue: Functions return `null` or `[]` without indicating why
- Files:
  - `src/shared/field-parsers.ts` (multiple null returns)
  - `src/generator/objective-patch.ts` (lines with null returns)
  - `src/auditor/layer1/index.ts` (5+ null returns)
- Impact: Callers can't distinguish between "not found" and "error", harder to debug
- Fix approach: Use Result types or throw descriptive errors instead of silent nulls

## Fragile Areas

**Optum note parser regex patterns:**
- Files: `parsers/optum-note/parser.ts` (lines 127, 266)
- Why fragile: Complex regex patterns for parsing medical documents are brittle to format changes
- Safe modification: Add comprehensive test cases for edge cases (missing fields, format variations); document regex intent with examples
- Test coverage: Parser has tests but edge cases may not be covered

**TX sequence engine state transitions:**
- Files: `src/generator/tx-sequence-engine.ts`
- Why fragile: Complex state machine with multiple visit-to-visit dependencies (pain progression, ROM changes, strength tracking)
- Safe modification: Add state validation before transitions; document state invariants; add integration tests for multi-visit sequences
- Test coverage: Needs integration tests for realistic visit sequences

**Rule engine condition evaluation:**
- Files: `src/parser/rule-engine.ts` (478 lines)
- Why fragile: Complex nested conditions for medical logic (pain→severity mapping, TCM pattern consistency)
- Safe modification: Add explicit condition validation; document all rule combinations; add property-based tests
- Test coverage: Unit tests exist but combinations may not be exhaustive

**Excel parser with dynamic field mapping:**
- Files: `server/services/excel-parser.ts` (500 lines)
- Why fragile: Maps arbitrary Excel columns to medical fields; aliasing logic (SHLDR→SHOULDER) could mask data entry errors
- Safe modification: Add validation warnings for ambiguous mappings; log all transformations; add test cases for common misspellings
- Test coverage: Basic parsing tested but edge cases (malformed dates, invalid body parts) need coverage

## Performance Bottlenecks

**Objective patch calculations on every generation:**
- Problem: `objective-patch.ts` recalculates ROM factors and strength grades for every note generation
- Files: `src/generator/objective-patch.ts` (692 lines)
- Cause: No caching of pain→ROM/strength mappings; interpolation calculations run repeatedly
- Improvement path: Pre-compute lookup tables for pain levels 0-10; cache results by (pain, bodyPart, difficulty) tuple

**Rule engine re-evaluates all conditions per field:**
- Problem: `rule-engine.ts` evaluates full condition tree for each dropdown field
- Files: `src/parser/rule-engine.ts` (478 lines)
- Cause: No memoization of condition results; context object recreated per field
- Improvement path: Memoize condition evaluation results; pre-filter applicable rules by field type

**Playwright automation full page traversal:**
- Problem: `mdland-automation.ts` traverses entire DOM for each interaction
- Files: `scripts/playwright/mdland-automation.ts` (1295 lines)
- Cause: No caching of element selectors; repeated DOM queries
- Improvement path: Cache element references; use event listeners instead of polling

## Security Considerations

**JWT secret fallback to API key:**
- Risk: If JWT verification fails, system falls back to x-api-key without logging
- Files: `server/index.ts` (lines 32-34)
- Current mitigation: Rate limiting on login endpoint
- Recommendations:
  - Log all auth failures with timestamp and source IP
  - Add metrics for failed JWT attempts
  - Consider disabling API key fallback in production

**No input validation on Excel uploads:**
- Risk: Malformed Excel files could cause crashes or unexpected behavior
- Files: `server/services/excel-parser.ts`
- Current mitigation: Basic type checking on body parts and insurance types
- Recommendations:
  - Add file size limits
  - Validate all numeric fields (age, pain scale, dates)
  - Add try-catch around ExcelJS parsing
  - Sanitize patient names before storage

**CORS origin hardcoded to environment variable:**
- Risk: If CORS_ORIGIN env var is misconfigured, could allow unauthorized cross-origin requests
- Files: `server/index.ts` (line 59)
- Current mitigation: Defaults to localhost
- Recommendations:
  - Validate CORS_ORIGIN is a valid URL
  - Log CORS rejections
  - Consider allowlist instead of single origin

**No rate limiting on batch generation endpoint:**
- Risk: Malicious users could generate unlimited notes, consuming resources
- Files: `server/routes/batch.ts` (implied)
- Current mitigation: General API rate limiter (60 req/min)
- Recommendations:
  - Add per-user rate limiting
  - Limit batch size (max notes per request)
  - Add request timeout

## Test Coverage Gaps

**Generator logic untested for edge cases:**
- What's not tested: ROM calculations with extreme pain values, strength grade transitions, multi-visit state consistency
- Files: `src/generator/soap-generator.ts`, `src/generator/tx-sequence-engine.ts`
- Risk: Silent failures in medical note generation could produce clinically incorrect notes
- Priority: HIGH

**Parser edge cases not covered:**
- What's not tested: Malformed dates, missing required fields, invalid body part combinations
- Files: `parsers/optum-note/parser.ts`, `server/services/excel-parser.ts`
- Risk: Parser crashes or produces incomplete data
- Priority: HIGH

**No E2E tests for full workflow:**
- What's not tested: Complete flow from Excel upload → batch generation → export
- Files: Server routes, batch processing
- Risk: Integration issues between components go undetected
- Priority: MEDIUM

**Checker validation rules not exhaustively tested:**
- What's not tested: All 20+ validation rules (IE01-IE07, TX01-TX10) with realistic data combinations
- Files: `parsers/optum-note/checker/note-checker.ts`
- Risk: Invalid notes pass validation or valid notes are rejected
- Priority: MEDIUM

## Scaling Limits

**In-memory batch processing:**
- Current capacity: Batch size limited by available memory (no explicit limit found)
- Limit: Large batches (1000+ notes) could cause OOM
- Scaling path: Implement streaming batch processing; process notes one at a time; add queue system for large batches

**No database for visit history:**
- Current capacity: All data stored in memory or Excel files
- Limit: Can't retrieve historical notes or track patient progress over time
- Scaling path: Add database (PostgreSQL) for persistent storage; implement visit history queries

**Single-threaded Node.js processing:**
- Current capacity: CPU-bound generation tasks block event loop
- Limit: High concurrent requests will queue up
- Scaling path: Use worker threads for generation; implement request queuing with priority

## Dependencies at Risk

**ExcelJS for Excel parsing:**
- Risk: Large dependency; potential security issues in file parsing
- Impact: Malformed Excel files could crash server
- Migration plan: Consider `xlsx` (lighter) or add strict file validation before parsing

**Playwright for automation:**
- Risk: Heavy dependency; requires browser binary; slow for large-scale automation
- Impact: Automation scripts are slow and resource-intensive
- Migration plan: Consider API-based approach if available; implement caching to reduce browser interactions

**No explicit version pinning in package.json:**
- Risk: Transitive dependencies could introduce breaking changes
- Impact: Builds could fail unexpectedly
- Migration plan: Use lockfile (package-lock.json or yarn.lock); audit dependencies regularly

## Missing Critical Features

**No audit logging:**
- Problem: No record of who generated which notes, when, or what changes were made
- Blocks: Compliance requirements, debugging user issues, detecting abuse
- Recommendation: Add audit log table with user, timestamp, action, and note ID

**No note versioning:**
- Problem: Can't track changes to notes or revert to previous versions
- Blocks: Collaborative editing, change tracking, compliance
- Recommendation: Implement version control for notes (store diffs or full snapshots)

**No export to EHR systems:**
- Problem: Notes must be manually copied to patient records
- Blocks: Workflow integration, reduces adoption
- Recommendation: Add HL7/FHIR export; integrate with common EHR APIs

**No user preferences/templates:**
- Problem: Each user must configure settings from scratch
- Blocks: Personalization, faster workflows
- Recommendation: Add user profile with saved preferences, custom templates

---

*Concerns audit: 2026-02-22*
