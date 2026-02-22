# Architecture

**Analysis Date:** 2026-02-22

## Pattern Overview

**Overall:** Layered pipeline architecture with separation between data parsing, generation, validation, and API serving.

**Key Characteristics:**
- Modular layer separation: Parser → Generator → Validator → Auditor
- Immutable data patterns throughout (no mutations)
- Context-driven generation with TCM knowledge base
- Three-tier audit system for quality assurance
- Express API server with batch processing capabilities

## Layers

**Parser Layer:**
- Purpose: Extract and normalize clinical data from Excel/JSON input
- Location: `src/parser/`, `server/services/excel-parser.ts`
- Contains: Rule engine, weight system, dropdown parsing, template logic
- Depends on: Shared types, field parsers, template rules
- Used by: Batch generator, SOAP generation pipeline

**Generator Layer:**
- Purpose: Create complete SOAP notes from parsed clinical context
- Location: `src/generator/`
- Contains: SOAP generator, TX sequence engine, goals calculator, objective patch
- Depends on: Parser layer, knowledge base, shared constants
- Used by: Batch generator, API routes

**Knowledge Layer:**
- Purpose: Provide TCM patterns, medical history inference, clinical mappings
- Location: `src/knowledge/`
- Contains: TCM patterns, medical history engine, ICD/CPT catalogs
- Depends on: Core types
- Used by: Generator, batch generator context building

**Validator Layer:**
- Purpose: Self-check generated SOAP text for compliance
- Location: `src/validator/`, `parsers/optum-note/`
- Contains: Output validator, note parser, rule checker
- Depends on: Parser layer
- Used by: Generator post-processing

**Auditor Layer:**
- Purpose: Multi-tier quality assurance (rule compliance, medical logic, case similarity)
- Location: `src/auditor/`
- Contains: Layer1 (rules), Layer2 (medical logic), Layer3 (similarity)
- Depends on: Validator, knowledge base
- Used by: Optional post-generation audit

**API/Server Layer:**
- Purpose: HTTP endpoints for batch processing and automation
- Location: `server/`
- Contains: Express app, routes, services, batch store
- Depends on: Generator, parser, validator
- Used by: Frontend, external clients

## Data Flow

**Batch Processing Flow:**

1. Client uploads Excel file → `POST /api/batch`
2. `excel-parser.ts` parses rows → `ExcelRow[]`
3. `buildPatientsFromRows()` normalizes → `BatchPatient[]` with `BatchVisit[]`
4. `generateMixedBatch()` processes each visit:
   - Build `GenerationContext` from patient clinical data
   - Call `exportSOAPAsText()` or `exportTXSeriesAsText()`
   - Split result via `splitSOAPText()` → S/O/A/P sections
   - Optionally patch via `patchSOAPText()`
   - Store in `visit.generated`
5. `saveBatch()` persists to `.batch-data/` directory
6. Response includes batch ID and generation summary

**Single Visit Regeneration:**

1. Client calls `PUT /api/batch/:batchId/visit/:patientIdx/:visitIdx`
2. Retrieve batch and specific visit
3. Call `regenerateVisit()` with optional seed
4. Update batch immutably (spread operator)
5. Save and return regenerated SOAP

**State Management:**
- Batch state stored in `.batch-data/` as JSON files (LRU cache with 32 batch limit)
- No database; in-memory during request lifecycle
- Immutable updates: spread operators for patient/visit arrays
- Confirmed batches marked with `confirmed: true` flag

## Key Abstractions

**GenerationContext:**
- Purpose: Encapsulates all clinical parameters needed for SOAP generation
- Examples: `server/services/batch-generator.ts` line 24-75
- Pattern: Immutable object passed through generator pipeline

**BatchVisit:**
- Purpose: Represents single clinical visit with generated SOAP
- Examples: `server/types.ts` lines 8-30
- Pattern: Readonly properties, `generated` field holds S/O/A/P text + seed

**RuleContext:**
- Purpose: Provides rule engine with patient/clinical context for weight calculations
- Examples: `src/parser/rule-engine.ts` lines 19-80
- Pattern: Optional nested structure for flexible rule evaluation

**TemplateFile:**
- Purpose: Represents parsed template with dropdown fields and raw content
- Examples: `src/types/index.ts` lines 319-327
- Pattern: Maps to body part/pattern, contains field definitions

## Entry Points

**API Server:**
- Location: `server/index.ts`
- Triggers: `npm start` or Docker container startup
- Responsibilities: Create Express app, attach CORS/auth/rate limiting, mount batch/automate routers

**Batch Router:**
- Location: `server/routes/batch.ts`
- Triggers: HTTP requests to `/api/batch/*`
- Responsibilities: Handle file upload, Excel parsing, batch generation, visit regeneration

**Automate Router:**
- Location: `server/routes/automate.ts`
- Triggers: HTTP requests to `/api/automate/*`
- Responsibilities: Browser automation for login/scraping workflows

**SOAP Generator:**
- Location: `src/generator/soap-generator.ts`
- Triggers: Called from `batch-generator.ts` for each visit
- Responsibilities: Generate complete SOAP note text from context

## Error Handling

**Strategy:** Try-catch at API layer, throw descriptive errors, return JSON error responses

**Patterns:**
- API routes wrap logic in try-catch, return `{ success: false, error: message }`
- Generator functions throw `Error` with descriptive messages
- Parser validates input and throws on invalid Excel format
- Validator returns `ValidationResult` with error array (non-throwing)

## Cross-Cutting Concerns

**Logging:** Console output via `process.stdout.write()` for server startup; no structured logging framework

**Validation:**
- Input validation in parser (Excel row schema)
- Output validation in validator layer (SOAP text compliance)
- Rule engine validates dropdown selections against weights

**Authentication:**
- JWT cookie (`rbmeds_token`) with `ac_access` claim
- Fallback to `x-api-key` header
- Checked in `requireAuth()` middleware before protected routes

---

*Architecture analysis: 2026-02-22*
