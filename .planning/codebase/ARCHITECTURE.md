# Architecture

**Analysis Date:** 2026-02-22

## Pattern Overview

**Overall:** Layered architecture with domain-driven design

**Key Characteristics:**
- Separation of concerns: API layer → Services → Core domain logic
- Immutable data patterns throughout (no mutations)
- Batch processing pipeline for SOAP note generation
- Multi-mode operation (full, soap-only, continue)
- Headless automation integration via Playwright

## Layers

**API Layer (Express):**
- Purpose: HTTP request handling, authentication, routing
- Location: `server/index.ts`, `server/routes/`
- Contains: Route handlers, middleware (auth, CORS, rate limiting)
- Depends on: Services, Store
- Used by: Frontend, external clients

**Service Layer:**
- Purpose: Business logic orchestration
- Location: `server/services/`
- Contains: `batch-generator.ts` (SOAP generation), `excel-parser.ts` (file parsing), `automation-runner.ts` (Playwright orchestration), `text-to-html.ts` (formatting)
- Depends on: Core domain (`src/`), Store
- Used by: Routes

**Core Domain (SOAP Generation):**
- Purpose: Medical note generation logic
- Location: `src/`
- Contains: Parser, Generator, Knowledge, Auditor, Validator, Shared utilities
- Depends on: Types, Shared catalogs
- Used by: Services

**Store Layer:**
- Purpose: Data persistence (in-memory + file)
- Location: `server/store/batch-store.ts`
- Contains: Batch caching (LRU, max 50), JSON file persistence
- Depends on: Types
- Used by: Routes, Services

**Knowledge Layer:**
- Purpose: Medical domain knowledge
- Location: `src/knowledge/`
- Contains: TCM pattern inference, medical history engine
- Depends on: Types, Shared catalogs
- Used by: Generator

## Data Flow

**Batch Upload & Generation:**

1. Client uploads Excel file → `POST /api/batch`
2. `batch.ts` route receives file
3. `excel-parser.parseExcelBuffer()` → extracts rows
4. `buildPatientsFromRows()` → creates BatchPatient objects with visits
5. `generateMixedBatch()` → iterates patients/visits
6. For each visit: `buildContext()` → `exportSOAPAsText()` → `splitSOAPText()`
7. Results stored in `visit.generated` (immutable update)
8. `saveBatch()` → memory cache + JSON file
9. Response: batch summary with generation stats

**Automation Flow:**

1. Client uploads MDLand cookies → `POST /api/automate/cookies`
2. `saveCookies()` → encrypted storage
3. Client confirms batch → `POST /api/batch/:id/confirm`
4. Client triggers automation → `POST /api/automate/:batchId`
5. `startAutomation()` → spawns Playwright subprocess
6. Subprocess reads batch data, iterates visits, submits to MDLand
7. Status polled via `GET /api/automate/:batchId`

**State Management:**
- Batches: Immutable objects stored in memory cache + JSON files
- Updates: Create new objects, never mutate existing (e.g., `{ ...batch, patients: updatedPatients }`)
- Visits: Regeneration creates new visit object with updated `generated` field
- Cookies: Encrypted file storage, loaded on automation start

## Key Abstractions

**BatchData:**
- Purpose: Container for all patient/visit data in a batch
- Examples: `server/types.ts` (BatchData, BatchPatient, BatchVisit)
- Pattern: Immutable record types with readonly fields

**GenerationContext:**
- Purpose: Input parameters for SOAP generation
- Examples: `src/types/index.ts` (GenerationContext)
- Pattern: Structured context object passed through generation pipeline

**SOAPNote:**
- Purpose: Complete SOAP note structure
- Examples: `src/types/index.ts` (SOAPNote with header, S/O/A/P sections)
- Pattern: Typed interface with nested sections

**TCMPattern:**
- Purpose: Traditional Chinese Medicine pattern definitions
- Examples: `src/knowledge/tcm-patterns.ts`
- Pattern: Catalog of patterns with tongue/pulse/treatment data

## Entry Points

**Server Entry:**
- Location: `server/index.ts`
- Triggers: `npm start` or direct execution
- Responsibilities: Create Express app, setup middleware, register routes, start listening

**Batch Route:**
- Location: `server/routes/batch.ts`
- Triggers: POST/GET/PUT requests to `/api/batch/*`
- Responsibilities: File upload, batch creation, visit regeneration, confirmation

**Automate Route:**
- Location: `server/routes/automate.ts`
- Triggers: POST/GET requests to `/api/automate/*`
- Responsibilities: Cookie management, automation job control, status polling

**SOAP Generator:**
- Location: `src/generator/soap-generator.ts`
- Triggers: Called by `batch-generator.generateSingleVisit()`
- Responsibilities: Generate complete SOAP text from context

## Error Handling

**Strategy:** Try-catch at route level, throw descriptive errors from services

**Patterns:**
- Routes catch errors and return `{ success: false, error: message }` JSON
- Services throw Error with descriptive messages
- Validation errors caught early (file type, required fields)
- Batch not found → 404
- Unauthorized → 401/403
- Rate limit exceeded → 429 (via express-rate-limit)

## Cross-Cutting Concerns

**Logging:** Console output only (no structured logging framework)

**Validation:**
- File type validation in multer (xlsx/xls only)
- Excel row schema validation in `buildPatientsFromRows()`
- JWT/API key validation in `requireAuth()` middleware

**Authentication:**
- JWT cookie (`rbmeds_token`) with `ac_access` claim
- Fallback to `x-api-key` header
- Both optional if no secrets configured (dev mode)

**Rate Limiting:**
- General API: 60 requests/minute
- Login endpoint: 5 requests/15 minutes
- Applied via `express-rate-limit` middleware

---

*Architecture analysis: 2026-02-22*
