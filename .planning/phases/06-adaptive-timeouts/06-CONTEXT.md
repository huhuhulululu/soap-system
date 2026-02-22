# Phase 6: Adaptive Timeouts - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the global 30s default timeout with per-operation timeout constants. Each automation step gets a timeout calibrated to its actual operation speed. No retry logic (Phase 7), no error classification changes (Phase 5 done).

</domain>

<decisions>
## Implementation Decisions

### Timeout value tiers
- Claude decides the number of tiers and specific values based on actual code analysis
- Current hardcoded values: 10s, 15s, 20s, 30s — use as baseline reference
- Claude decides granularity (per-function vs per-operation-type grouping)
- Claude decides naming style (by operation vs by duration)

### Slow day tolerance
- Claude decides whether to use fixed timeouts + retry fallback or timeout scaling on retry
- Claude decides grace period behavior (immediate error vs brief extension)
- Phase 7 retry is the primary recovery mechanism for timeout failures

### Configuration
- Support environment variable override via single multiplier: `TIMEOUT_MULTIPLIER`
- Default multiplier is 1.0 (no change)
- Example: `TIMEOUT_MULTIPLIER=1.5` scales all timeouts by 1.5x for slow days
- No per-timeout environment variables — keep it simple

### Claude's Discretion
- Exact timeout values for each operation
- Number of tiers and grouping strategy
- Global setDefaultTimeout handling (remove vs set reasonable default)
- Constant naming convention
- Grace period / tolerance behavior

</decisions>

<specifics>
## Specific Ideas

- Single `TIMEOUTS` constants object as the source of truth
- All `{ timeout: N }` hardcoded values replaced with named constants
- TIMEOUT_MULTIPLIER env var for production tuning without code changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-adaptive-timeouts*
*Context gathered: 2026-02-22*
