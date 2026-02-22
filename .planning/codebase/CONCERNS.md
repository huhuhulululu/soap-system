# Codebase Concerns

**Analysis Date:** 2026-02-22

## Tech Debt

**Large monolithic files:**
- Issue: Several core files exceed 1200 lines, making them difficult to maintain and test
- Files:
  - `src/generator/soap-generator.ts` (2280 lines)
  - `src/generator/tx-sequence-engine.ts` (1215 lines)
  - `parsers/optum-note/checker/note-checker.ts` (1346 lines)
  - `parsers/optum-note/parser.ts` (1095 lines)
- Impact: Harder to locate bugs, increased cognitive load, difficult to test individual functions
- Fix approach: Extract cohesive functions into separate modules by responsibility (e.g., separate pain calculation, ROM calculation, strength calculation into dedicated files)

**Type safety gaps:**
- Issue: Use of `unknown` and `any` types in field parsers without proper validation
- Files: `src/shared/field-parsers.ts` (line 30: `const ps = painScale as Record<string, any>`)
- Impact: Runtime errors possible if data structure differs from assumptions; type checking bypassed
- Fix approach: Create strict type guards and validation schemas using zod or similar; replace `as any` with proper type narrowing

**Deprecated exports still in use:**
- Issue: `MUSCLE_MAP` and `ADL_MAP` marked `@deprecated` but still exported from `src/generator/soap-generator.ts`
- Files: `src/generator/soap-generator.ts` (lines 104-108)
- Impact: Confusion about which constants to use; potential for inconsistency if deprecated versions diverge
- Fix approach: Remove deprecated exports entirely; update all imports to use `BODY_PART_MUSCLES` and `BODY_PART_ADL` from `src/shared/body-part-constants.ts`

**Hardcoded magic numbers:**
- Issue: Pain thresholds, severity mappings, and demographic age cutoffs scattered throughout code
- Files:
  - `src/generator/soap-generator.ts` (lines 123-149: age cutoffs like 65, 35)
  - `parsers/optum-note/checker/note-checker.ts` (line 89: pain >= 7 threshold)
  - `src/generator/objective-patch.ts` (lines 31-38: ROM factor breakpoints)
- Impact: Difficult to adjust clinical parameters; inconsistent thresholds across modules
- Fix approach: Centralize all clinical parameters in `src/shared/clinical-constants.ts` with clear documentation

## Known Bugs

**Pain scale extraction fragility:**
- Symptoms: `extractPainCurrent()` returns default value 7 if data structure unexpected
- Files: `src/shared/field-parsers.ts` (lines 29-37)
- Trigger: When `painScale` is null, undefined, or has unexpected shape (e.g., `{ pain: 8 }` instead of `{ current: 8 }`)
- Workaround: Ensure all data sources normalize pain scale to one of three formats: `{ current }`, `{ value }`, or `{ range: { max } }`
- Fix approach: Add validation layer that logs warnings when fallback occurs; add test cases for all observed pain scale formats

**Optional chaining with undefined fallbacks:**
- Symptoms: Code uses `?.` operator but doesn't always handle undefined case explicitly
- Files: Multiple locations (e.g., `src/auditor/layer1/index.ts` lines 55, 76, 97)
- Trigger: When optional properties are undefined, code may proceed with undefined values
- Fix approach: Add explicit null checks before using optional values; use nullish coalescing with meaningful defaults

## Security Considerations

**No input validation on batch uploads:**
- Risk: Excel files uploaded via `/batch` endpoint not validated for malicious content or structure
- Files: `server/routes/batch.ts`, `server/services/excel-parser.ts`
- Current mitigation: File size limits via multer, CORS enabled
- Recommendations:
  - Add schema validation for Excel structure before parsing
  - Sanitize all text fields extracted from Excel
  - Add file type verification (check magic bytes, not just extension)
  - Implement rate limiting per user/IP (already present but verify configuration)

**Environment variable exposure risk:**
- Risk: `.env` file contains `COOKIE_ENCRYPTION_KEY` and `SHARED_JWT_SECRET` - if leaked, authentication compromised
- Files: `.env` (not in repo, but referenced in MEMORY.md)
- Current mitigation: `.env` in `.gitignore`
- Recommendations:
  - Rotate secrets immediately if any deployment logs are exposed
  - Use AWS Secrets Manager or similar for production
  - Add validation that required secrets are present at startup

**No CSRF protection on state-changing endpoints:**
- Risk: POST/PUT endpoints may be vulnerable to cross-site request forgery
- Files: `server/routes/batch.ts`, `server/routes/automate.ts`
- Current mitigation: CORS configured but CSRF tokens not implemented
- Recommendations: Add CSRF token validation to all state-changing endpoints

## Performance Bottlenecks

**Synchronous regex operations on large text:**
- Problem: `parsers/optum-note/parser.ts` uses multiple regex passes on full document text
- Files: `parsers/optum-note/parser.ts` (lines 266+)
- Cause: No streaming or chunked parsing; entire document loaded into memory and processed sequentially
- Improvement path: Implement line-by-line streaming parser; cache compiled regex patterns; consider lazy evaluation

**Weight calculation in rule engine:**
- Problem: `calculateWeights()` iterates through all rules for every option, potentially O(n²) complexity
- Files: `src/parser/weight-system.ts` (421 lines)
- Cause: No indexing or memoization of rule results
- Improvement path: Cache rule evaluation results; build rule index by condition type; implement early exit for high-confidence matches

**No pagination on batch results:**
- Problem: All batch results loaded into memory at once
- Files: `server/services/batch-generator.ts` (378 lines)
- Cause: Results array grows unbounded
- Improvement path: Implement cursor-based pagination; stream results to client; add result expiration

## Fragile Areas

**Optum note parser:**
- Files: `parsers/optum-note/parser.ts`, `parsers/optum-note/checker/note-checker.ts`
- Why fragile: Regex-based parsing of unstructured text; sensitive to formatting changes in source documents; multiple hardcoded patterns
- Safe modification: Add comprehensive test fixtures for each document format variant; add logging for parse failures; implement fallback patterns
- Test coverage: Gaps in edge cases (malformed dates, missing fields, unusual spacing)

**TX sequence engine state machine:**
- Files: `src/generator/tx-sequence-engine.ts` (1215 lines)
- Why fragile: Complex state transitions with many conditional branches; pain/ROM/strength calculations interdependent
- Safe modification: Add state validation at each transition; extract state machine logic into separate module; add invariant checks
- Test coverage: Missing tests for edge cases (pain jumps, ROM plateaus, strength regressions)

**Medical history inference engine:**
- Files: `src/knowledge/medical-history-engine.ts` (420 lines)
- Why fragile: Heuristic-based inference with many special cases; clinical assumptions may not hold for all patients
- Safe modification: Add confidence scores to inferences; log assumptions; allow overrides; add audit trail
- Test coverage: Limited test coverage for edge cases (unusual medical histories, contradictory symptoms)

## Scaling Limits

**In-memory batch processing:**
- Current capacity: Batch size limited by available memory; no streaming
- Limit: Breaks at ~10,000 records (estimated) depending on note complexity
- Scaling path: Implement job queue (Bull, RabbitMQ); stream results to database; add progress tracking

**Single-threaded rule evaluation:**
- Current capacity: ~100 options evaluated per second (estimated)
- Limit: Breaks at high concurrency (>10 simultaneous requests)
- Scaling path: Implement worker pool; cache rule results; parallelize independent evaluations

**No database for caching:**
- Current capacity: All data in-memory; no persistence between requests
- Limit: Breaks on server restart; no audit trail
- Scaling path: Add Redis for caching; add PostgreSQL for audit logs and batch history

## Dependencies at Risk

**Playwright (1.58.2):**
- Risk: Heavy dependency for automation; adds 200MB+ to Docker image
- Impact: Slow deployments; large container size; maintenance burden
- Migration plan: Consider headless-chrome or puppeteer if automation is optional; or move to separate service

**ExcelJS (4.4.0):**
- Risk: Large dependency; potential security issues in XML parsing
- Impact: Vulnerability surface for malicious Excel files
- Migration plan: Monitor for updates; consider lightweight alternative if only basic XLSX support needed

**Express (5.2.1):**
- Risk: Major version; breaking changes possible
- Impact: Dependency updates may require code changes
- Migration plan: Pin to 5.x; monitor release notes; test updates in staging

## Missing Critical Features

**No audit logging:**
- Problem: No record of who generated which notes, when, or what changes were made
- Blocks: Compliance requirements; debugging user issues; security investigation
- Fix approach: Add audit table; log all generation requests with user, timestamp, input, output hash

**No error recovery for batch jobs:**
- Problem: If batch job fails mid-way, no way to resume or retry individual records
- Blocks: Large batch processing; production reliability
- Fix approach: Implement job queue with retry logic; add checkpoint system; allow partial batch completion

**No version control for generated notes:**
- Problem: Can't compare versions or see what changed between edits
- Blocks: Audit trail; user confidence; debugging
- Fix approach: Add version history table; implement diff view; allow rollback

## Test Coverage Gaps

**Parser edge cases:**
- What's not tested: Malformed dates, missing required fields, unusual spacing, non-ASCII characters
- Files: `parsers/optum-note/parser.ts`, `parsers/optum-note/checker/note-checker.ts`
- Risk: Parser may crash or produce incorrect results on real-world data
- Priority: High

**Weight system edge cases:**
- What's not tested: Empty rule sets, conflicting rules, extreme weight values, circular dependencies
- Files: `src/parser/weight-system.ts`, `src/parser/rule-engine.ts`
- Risk: Unexpected behavior in edge cases; incorrect option selection
- Priority: High

**Concurrent request handling:**
- What's not tested: Multiple simultaneous batch uploads, race conditions in state updates
- Files: `server/routes/batch.ts`, `server/services/batch-generator.ts`
- Risk: Data corruption or lost updates under load
- Priority: Medium

**Error handling paths:**
- What's not tested: Network failures, timeout scenarios, malformed API responses
- Files: `server/services/automation-runner.ts`, `server/routes/automate.ts`
- Risk: Unhandled exceptions crash server or leave system in inconsistent state
- Priority: Medium

---

*Concerns audit: 2026-02-22*
