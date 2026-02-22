# Phase 4: Security Hardening & Stability - Research

**Researched:** 2026-02-22
**Domain:** Express security middleware, file validation, type safety, env validation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- File size limit reduced to 5MB (from 10MB)
- All clients must provide CSRF token — no exemptions for API key clients
- CSRF failure returns generic 403 with no detail (silent rejection)
- Pain parser: return default value + log warning on unexpected data format

### Claude's Discretion
- Validation depth (magic bytes vs structural), failure handling, .xls support decision
- CSRF pattern choice (double-submit vs synchronizer), token delivery mechanism
- API error response detail level, security event log destination, auditor undefined handling strategy
- Production fail-fast vs graceful degradation, required env var list, dev mode behavior, startup config summary

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-1 | Upload endpoint must verify file magic bytes (PK zip header), not just extension | Magic bytes check: XLSX/XLS headers documented below; inline in multer fileFilter |
| SEC-2 | State-changing endpoints (POST/PUT) must validate CSRF token via double-submit cookie pattern. Machine clients (x-api-key) exempt. NOTE: CONTEXT.md overrides — no exemptions | Double-submit cookie pattern: no server state, cookie + header comparison |
| SEC-3 | Production mode must fail fast if SHARED_JWT_SECRET or COOKIE_ENCRYPTION_KEY missing | Startup validation before `app.listen()` in server/index.ts |
| BUG-1 | Replace `as any` in extractPainCurrent() with proper type guard. Log warnings on fallback | Type guard pattern for `unknown` input; `console.warn` on fallback path |
| BUG-2 | Fix undefined propagation in auditor layer1 (lines 55, 76, 97) with nullish coalescing defaults | Lines use `?.options \|\| []` — already safe; real fix is `?? []` (nullish vs falsy) |
</phase_requirements>

---

## Summary

Phase 4 addresses five targeted fixes across three files. No new dependencies are required — all changes use Node.js built-ins and existing packages already in `package.json`. The work is self-contained and low-risk.

SEC-1 adds a 4-byte magic bytes check in the multer `fileFilter` in `server/routes/batch.ts`. XLSX files are ZIP archives (PK header `50 4B 03 04`); legacy `.xls` files use the Compound Document header (`D0 CF 11 E0`). The check reads `buffer.slice(0, 4)` from `req.file.buffer` — but multer's `fileFilter` runs before the buffer is available. The correct approach is a post-upload validation step inside the route handler, after `req.file` is confirmed present.

SEC-2 implements CSRF via the double-submit cookie pattern: server sets a random token as a cookie, client echoes it in a request header, server compares them. No session store needed. The user locked "no exemptions" — the `x-api-key` path in `requireAuth` still passes auth, but CSRF middleware runs independently on all POST/PUT routes. The middleware is a small inline function in `server/index.ts`.

SEC-3, BUG-1, and BUG-2 are single-function fixes: env validation before `app.listen()`, type guard replacing `as any` in `extractPainCurrent`, and `?? []` replacing `|| []` in auditor layer1 lines 55/76/97.

**Primary recommendation:** Implement all five fixes as inline code changes — no new npm packages needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` | built-in | Generate CSRF token (randomBytes) | No dependency, cryptographically secure |
| `cookie-parser` | ^1.4.7 (already installed) | Read CSRF cookie in middleware | Already in use for JWT cookie |
| `express` | ^5.2.1 (already installed) | Middleware registration | Already the server framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | — | — | All fixes use existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline double-submit | `csrf` npm package | `csrf` package is deprecated (last release 2022, marked unmaintained); hand-rolling double-submit is 15 lines and well-understood |
| Inline double-submit | `csurf` npm package | `csurf` is deprecated since 2023; Express team recommends implementing directly |
| `crypto.randomBytes` | `uuid` | `uuid` adds a dependency; `crypto.randomBytes` is built-in and sufficient |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
No structural changes. All edits are in-place:
```
server/
├── index.ts          — SEC-2 (CSRF middleware), SEC-3 (env validation)
├── routes/
│   └── batch.ts      — SEC-1 (magic bytes check, 5MB limit)
src/shared/
└── field-parsers.ts  — BUG-1 (type guard in extractPainCurrent)
src/auditor/layer1/
└── index.ts          — BUG-2 (nullish coalescing on lines 55, 76, 97)
```

### Pattern 1: Magic Bytes Validation (SEC-1)

**What:** Read first 4 bytes of uploaded buffer after multer stores it in memory. Compare against known file signatures.
**When to use:** After `req.file` is confirmed present, before passing buffer to `parseExcelBuffer`.

```typescript
// In server/routes/batch.ts, inside POST / handler, after req.file check
const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // ZIP/XLSX
const XLS_MAGIC  = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) // Compound Doc

function isValidExcelBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false
  const header = buf.slice(0, 4)
  return header.equals(XLSX_MAGIC) || header.equals(XLS_MAGIC)
}
```

Decision point on `.xls` support: the current multer `fileFilter` allows `.xls`. The magic bytes check should mirror this — include `XLS_MAGIC` unless the decision is to drop `.xls`. Given CONTEXT.md leaves this to Claude's discretion: **keep `.xls` support** (existing users may have `.xls` files; ExcelJS handles both).

**Multer limit change:** Update `limits: { fileSize: 10 * 1024 * 1024 }` → `limits: { fileSize: 5 * 1024 * 1024 }` (locked decision).

### Pattern 2: Double-Submit Cookie CSRF (SEC-2)

**What:** On first request (or token absent), server sets `csrf_token` cookie (HttpOnly: false, so JS can read it). Client sends token back in `x-csrf-token` header. Middleware compares cookie value to header value.

**Why double-submit (not synchronizer):** No server-side session storage needed. Stateless. Appropriate for this API which uses JWT cookies, not sessions.

**Token generation:**
```typescript
import { randomBytes } from 'crypto'

function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}
```

**Middleware:**
```typescript
function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  // Ensure token cookie exists
  if (!req.cookies.csrf_token) {
    res.cookie('csrf_token', generateCsrfToken(), {
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    })
  }

  // Validate on state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const cookieToken = req.cookies.csrf_token
    const headerToken = req.headers['x-csrf-token']
    if (!cookieToken || cookieToken !== headerToken) {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }
  }
  next()
}
```

**Registration in `createApp()`:** Apply after `cookieParser()`, before protected routes. Per locked decision, no exemptions — applies to all POST/PUT including `x-api-key` clients.

**Cookie attributes:**
- `HttpOnly: false` — client JS must read it to echo in header (required for double-submit)
- `SameSite: strict` — primary CSRF defense layer
- `Secure: true` in production (server runs behind HTTPS via nginx)
- No `path` restriction — applies to all `/api/` routes

**Token refresh:** Reuse existing token per session (cookie persists). No rotation needed for this use case.

### Pattern 3: Env Startup Validation (SEC-3)

**What:** Before `app.listen()`, check required env vars. In production, throw and exit. In dev, warn.

```typescript
const REQUIRED_PROD_VARS = ['SHARED_JWT_SECRET', 'COOKIE_ENCRYPTION_KEY'] as const

function validateEnv(): void {
  if (process.env.NODE_ENV !== 'production') return
  const missing = REQUIRED_PROD_VARS.filter(v => !process.env[v])
  if (missing.length > 0) {
    process.stderr.write(`FATAL: Missing required env vars: ${missing.join(', ')}\n`)
    process.exit(1)
  }
}
```

Call `validateEnv()` at the top of the `if (require.main === module)` block, before `createApp()`.

**Dev mode behavior (Claude's discretion):** Silent pass — dev runs without secrets for local testing. No warning needed; the missing-secret paths in `requireAuth` already fall through gracefully.

### Pattern 4: Type-Safe Pain Parser (BUG-1)

**What:** Replace `as any` cast with a proper type guard that narrows `unknown` to the expected shape.

**Current code (field-parsers.ts line 30):**
```typescript
const ps = painScale as Record<string, any>  // WRONG
```

**Fixed code:**
```typescript
export function extractPainCurrent(painScale: unknown): number {
  if (!painScale || typeof painScale !== 'object') return warnDefault('not an object')
  const ps = painScale as Record<string, unknown>
  if (typeof ps['current'] === 'number') return ps['current']
  if (typeof ps['value'] === 'number') return ps['value']
  const range = ps['range']
  if (range && typeof range === 'object') {
    const max = (range as Record<string, unknown>)['max']
    if (typeof max === 'number') return max
  }
  return warnDefault('no recognized key')
}

function warnDefault(reason: string): number {
  // Use process.stderr to avoid console.log (coding style rule)
  process.stderr.write(`[field-parsers] extractPainCurrent fallback (${reason}), returning 7\n`)
  return 7
}
```

Note: coding style rules prohibit `console.log`. Use `process.stderr.write` for the warning log.

### Pattern 5: Auditor Nullish Coalescing (BUG-2)

**What:** Lines 55, 76, 97 use `?.options || []`. The `||` operator treats empty array `[]` as falsy — but `[].length === 0` is truthy for `||`. Actually `[]` is truthy in JS, so `|| []` is fine for empty arrays. The real issue: `|| []` also replaces `0`, `false`, `''` — but `options` is always an array here. The semantic fix is `?? []` (nullish coalescing) which only replaces `null`/`undefined`, not falsy values.

**Current (lines 55, 76, 97):**
```typescript
const valid = templateOptions.chronicityLevel?.options || []
const valid = templateOptions.severityLevel?.options || []
const valid = templateOptions.generalCondition?.options || []
```

**Fixed:**
```typescript
const valid = templateOptions.chronicityLevel?.options ?? []
const valid = templateOptions.severityLevel?.options ?? []
const valid = templateOptions.generalCondition?.options ?? []
```

This is the minimal correct fix per BUG-2. The `??` operator is semantically precise: only falls back when the value is `null` or `undefined`.

### Anti-Patterns to Avoid

- **Setting CSRF cookie as HttpOnly: true:** Client JS cannot read it, breaking double-submit pattern.
- **Checking magic bytes in multer `fileFilter`:** `fileFilter` receives `file` metadata only, not buffer content. Buffer is only available after upload completes.
- **Using `csurf` or `csrf` npm packages:** Both deprecated. Inline implementation is 15 lines and has no maintenance risk.
- **Throwing on missing env vars in `createApp()`:** `createApp()` is called in tests. Validation must only run in the `require.main === module` block.
- **Using `console.warn` in field-parsers.ts:** Coding style rules prohibit `console.log` (and by extension `console.warn`). Use `process.stderr.write`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSRF token generation | Custom entropy source | `crypto.randomBytes` (built-in) | Cryptographically secure, no deps |
| Magic bytes comparison | String comparison | `Buffer.equals()` | Handles binary correctly |

**Key insight:** All five fixes are small, targeted changes. The temptation to add a CSRF library should be resisted — both major options (`csurf`, `csrf`) are deprecated.

---

## Common Pitfalls

### Pitfall 1: CSRF Cookie Readable by JS
**What goes wrong:** Setting `HttpOnly: true` on the CSRF cookie breaks double-submit — the browser cannot read the cookie to echo it in the header.
**Why it happens:** Developers conflate CSRF cookie with session cookie security model.
**How to avoid:** CSRF cookie must be `HttpOnly: false`. The security comes from `SameSite: strict` + same-origin header requirement.
**Warning signs:** Frontend gets 403 on all POST requests after CSRF is added.

### Pitfall 2: Magic Bytes Check in fileFilter
**What goes wrong:** `multer`'s `fileFilter` callback receives only `req`, `file` (metadata), and `cb`. The buffer is not yet available.
**Why it happens:** Assuming fileFilter has access to file content.
**How to avoid:** Do magic bytes check inside the route handler after `req.file` is populated.
**Warning signs:** `req.file.buffer` is undefined inside fileFilter.

### Pitfall 3: Env Validation in createApp()
**What goes wrong:** Tests call `createApp()` without env vars set, causing test suite to crash or exit.
**Why it happens:** Putting startup validation in the factory function instead of the entry point.
**How to avoid:** Call `validateEnv()` only in `if (require.main === module)` block.
**Warning signs:** Jest tests fail with `process.exit` or missing env var errors.

### Pitfall 4: CSRF Token Rotation Breaking Concurrent Requests
**What goes wrong:** Rotating CSRF token on every request invalidates in-flight requests.
**Why it happens:** Over-engineering token lifecycle.
**How to avoid:** Issue token once per session (cookie lifetime). No rotation needed for this use case.

### Pitfall 5: `|| []` vs `?? []` Semantic Difference
**What goes wrong:** `|| []` replaces any falsy value including `0`, `false`, `''`. For an `options` array this is harmless, but `??` is the semantically correct operator for "use default when null/undefined".
**Why it happens:** Habit of using `||` for defaults before nullish coalescing was available.
**How to avoid:** Use `??` when the intent is "default on null/undefined only".

---

## Code Examples

### SEC-1: Complete Magic Bytes Validation
```typescript
// server/routes/batch.ts — inside POST / handler
const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const XLS_MAGIC  = Buffer.from([0xd0, 0xcf, 0x11, 0xe0])

function isValidExcelBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false
  const header = buf.slice(0, 4)
  return header.equals(XLSX_MAGIC) || header.equals(XLS_MAGIC)
}

// In route handler, after req.file check:
if (!isValidExcelBuffer(req.file.buffer)) {
  res.status(400).json({ success: false, error: 'Invalid file format' })
  return
}
```

### SEC-2: Complete CSRF Middleware
```typescript
// server/index.ts
import { randomBytes } from 'crypto'

function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

function csrfProtect(req: Request, res: Response, next: NextFunction): void {
  if (!req.cookies.csrf_token) {
    res.cookie('csrf_token', generateCsrfToken(), {
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    })
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const cookieToken = req.cookies.csrf_token as string | undefined
    const headerToken = req.headers['x-csrf-token'] as string | undefined
    if (!cookieToken || cookieToken !== headerToken) {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }
  }
  next()
}

// In createApp(), after cookieParser(), before protected routes:
app.use(csrfProtect)
```

### SEC-3: Env Startup Validation
```typescript
// server/index.ts — in if (require.main === module) block
const REQUIRED_PROD_VARS = ['SHARED_JWT_SECRET', 'COOKIE_ENCRYPTION_KEY'] as const

function validateEnv(): void {
  if (process.env.NODE_ENV !== 'production') return
  const missing = REQUIRED_PROD_VARS.filter(v => !process.env[v])
  if (missing.length > 0) {
    process.stderr.write(`FATAL: Missing required env vars: ${missing.join(', ')}\n`)
    process.exit(1)
  }
}
```

### BUG-1: Type-Safe extractPainCurrent
```typescript
// src/shared/field-parsers.ts
export function extractPainCurrent(painScale: unknown): number {
  if (!painScale || typeof painScale !== 'object') return warnFallback('not an object')
  const ps = painScale as Record<string, unknown>
  if (typeof ps['current'] === 'number') return ps['current']
  if (typeof ps['value'] === 'number') return ps['value']
  const range = ps['range']
  if (range && typeof range === 'object') {
    const max = (range as Record<string, unknown>)['max']
    if (typeof max === 'number') return max
  }
  return warnFallback('no recognized key')
}

function warnFallback(reason: string): number {
  process.stderr.write(`[field-parsers] extractPainCurrent fallback (${reason}), returning 7\n`)
  return 7
}
```

### BUG-2: Nullish Coalescing in Auditor Layer1
```typescript
// src/auditor/layer1/index.ts — lines 55, 76, 97
const valid = templateOptions.chronicityLevel?.options ?? []  // line 55
const valid = templateOptions.severityLevel?.options ?? []    // line 76
const valid = templateOptions.generalCondition?.options ?? [] // line 97
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `csurf` npm package | Inline double-submit | 2023 (csurf deprecated) | Must implement directly |
| `as any` type cast | Type guard with `unknown` | TypeScript 3.0+ | Proper narrowing, no runtime risk |
| `||` for null defaults | `??` nullish coalescing | TypeScript 3.7 / ES2020 | Semantically precise |

**Deprecated/outdated:**
- `csurf`: Deprecated 2023, security vulnerabilities unfixed, do not use.
- `csrf` (npm): Last release 2022, marked unmaintained.

---

## Open Questions

1. **CSRF token for the frontend client**
   - What we know: The frontend (served via nginx at `rbmeds.com/ac/`) makes POST requests to the API.
   - What's unclear: Does the frontend currently read cookies and set headers? If not, frontend changes are needed alongside the middleware.
   - Recommendation: The planner should note that frontend must be updated to read `csrf_token` cookie and send `x-csrf-token` header on all POST/PUT requests. This is outside the server scope but is a deployment dependency.

2. **`.xls` magic bytes decision**
   - What we know: Current multer filter allows `.xls`; ExcelJS supports it.
   - What's unclear: Whether any real users upload `.xls` files.
   - Recommendation: Keep `.xls` support (include `XLS_MAGIC` check). Removing it is a breaking change with no security benefit.

---

## Sources

### Primary (HIGH confidence)
- Node.js `crypto` docs — `randomBytes` API, verified behavior
- MDN Web Docs — `SameSite` cookie attribute, double-submit cookie pattern
- OWASP CSRF Prevention Cheat Sheet — double-submit cookie pattern recommendation
- ZIP file format spec — magic bytes `50 4B 03 04` (PK header)
- Compound Document Binary File Format — magic bytes `D0 CF 11 E0` (legacy XLS)
- TypeScript handbook — `unknown` type narrowing, type guards

### Secondary (MEDIUM confidence)
- Express.js docs — middleware registration order, `cookieParser` usage
- `csurf` GitHub — deprecation notice confirmed in README

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all changes use built-ins and already-installed packages
- Architecture: HIGH — patterns are well-established, verified against Node.js/Express docs
- Pitfalls: HIGH — verified against actual code read from codebase

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, 30-day validity)
