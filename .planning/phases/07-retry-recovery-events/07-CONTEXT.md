# Phase 7: Retry, Recovery & Events - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Failed visits automatically retry with clean state, session expiry stops the batch immediately, and every visit outcome is emitted as a structured event. Depends on Phase 5 (Error Classification) and Phase 6 (Adaptive Timeouts).

</domain>

<decisions>
## Implementation Decisions

### Event Payload Design
- Events must serve dual purpose: parent process real-time consumption AND log/post-analysis
- Event granularity: Claude's Discretion
- Field richness per event type: Claude's Discretion
- Output format (NDJSON vs prefixed): Claude's Discretion

### Recovery Flow
- "Close current visit" = same tab navigate back to waiting room (page.goto), NOT close/reopen tab
- No extra state cleanup needed — navigation alone resets state (simplest approach)
- Retry timing after navigation: Claude's Discretion
- Single patient retry exhaustion → skip and continue to next patient, do NOT interrupt batch

### Error → Action Mapping
- Directly reuse Phase 5's error classification system — no additional granularity needed
- transient errors → retry (up to 2 times, 2s then 4s delay)
- ALL fatal errors → immediately stop entire batch (not just session-expired)
- Which non-fatal/non-transient errors also retry: Claude's Discretion
- Mapping storage location (hardcoded vs config): Claude's Discretion

### Failure & Summary Reporting
- Batch summary includes: total, passed, failed, skipped counts + failure details per patient
- Failed patient details include full retry history (each attempt's error, not just final)
- Time tracking: total batch duration + per-visit duration
- Batch abort summary format (normal vs aborted): Claude's Discretion

### Claude's Discretion
- Event type granularity (3 types vs more fine-grained)
- JSON field design per event type
- Output format choice
- Retry timing strategy after navigation
- Whether unknown errors trigger retry
- Error→action mapping storage approach
- Aborted batch summary format

</decisions>

<specifics>
## Specific Ideas

- Events consumed by both parent process (real-time UI/progress) and logs (post-analysis) — design for both
- Retry history in failure details helps debug intermittent issues
- Per-visit duration helps identify slow cases for optimization

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-retry-recovery-events*
*Context gathered: 2026-02-22*
