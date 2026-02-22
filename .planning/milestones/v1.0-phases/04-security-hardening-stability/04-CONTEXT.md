# Phase 4: Security Hardening & Stability - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix security gaps in the API layer (Excel validation, CSRF protection) and stabilize known bugs (type-safe parsers, auditor optional chaining, env validation). No new features, no architecture changes.

</domain>

<decisions>
## Implementation Decisions

### Upload Validation
- File size limit reduced to 5MB (from 10MB)
- Claude's Discretion: validation depth (magic bytes vs structural), failure handling, .xls support decision

### CSRF Protection
- All clients must provide CSRF token — no exemptions for API key clients
- CSRF failure returns generic 403 with no detail (silent rejection)
- Claude's Discretion: CSRF pattern choice (double-submit vs synchronizer), token delivery mechanism

### Error & Fallback Behavior
- Pain parser: return default value + log warning on unexpected data format
- Claude's Discretion: API error response detail level, security event log destination, auditor undefined handling strategy

### Startup Policy
- Claude's Discretion: production fail-fast vs graceful degradation, required env var list, dev mode behavior, startup config summary

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-security-hardening-stability*
*Context gathered: 2026-02-22*
