# Codebase Structure

**Analysis Date:** 2026-02-22

## Directory Layout

```
soap-system/
├── server/                 # Express API server
│   ├── index.ts           # App factory, middleware setup
│   ├── types.ts           # Batch-related types
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic
│   ├── store/             # Data persistence
│   └── __tests__/         # Route/service tests
├── src/                   # Core SOAP generation domain
│   ├── types/             # Core type definitions
│   ├── parser/            # Parse clinical data → structured format
│   ├── generator/         # Generate SOAP notes from context
│   ├── knowledge/         # Medical domain knowledge (TCM patterns)
│   ├── auditor/           # Multi-layer validation
│   ├── validator/         # Output validation
│   ├── shared/            # Shared catalogs (ICD, CPT, body parts)
│   └── __tests__/         # Unit tests
├── parsers/               # Parser implementations (Optum, etc.)
├── frontend/              # React/Next.js UI (separate package)
├── scripts/               # Utility scripts
├── templates/             # Excel template files
├── .batch-data/           # Runtime batch storage (generated)
├── .planning/             # GSD planning documents
├── package.json           # Dependencies, test config
├── tsconfig.json          # TypeScript configuration
└── vitest.config.ts       # Vitest configuration
```

## Directory Purposes

**server/:**
- Purpose: Express API server for batch processing and automation
- Contains: Route handlers, services, data store, middleware
- Key files: `index.ts` (entry point), `types.ts` (batch types)

**server/routes/:**
- Purpose: HTTP endpoint handlers
- Contains: `batch.ts` (upload, generate, confirm), `automate.ts` (automation control)
- Key files: Route factory functions that return Express Router instances

**server/services/:**
- Purpose: Business logic orchestration
- Contains: `batch-generator.ts` (SOAP generation), `excel-parser.ts` (file parsing), `automation-runner.ts` (Playwright), `text-to-html.ts` (formatting)
- Key files: Service functions called by routes

**server/store/:**
- Purpose: Data persistence layer
- Contains: `batch-store.ts` (in-memory cache + JSON file storage)
- Key files: LRU cache management, batch CRUD operations

**src/:**
- Purpose: Core SOAP generation domain logic
- Contains: Parser, Generator, Knowledge, Auditor, Validator, Shared utilities
- Key files: Type definitions, generation engines, medical knowledge

**src/parser/:**
- Purpose: Parse clinical data into structured format
- Contains: Rule engine, weight system, template logic, dropdown parsing
- Key files: `rule-engine.ts`, `weight-system.ts`, `template-logic-rules.ts`

**src/generator/:**
- Purpose: Generate SOAP notes from clinical context
- Contains: SOAP generator, TX sequence engine, goals calculator, objective patch
- Key files: `soap-generator.ts` (main), `tx-sequence-engine.ts` (multi-visit TX)

**src/knowledge/:**
- Purpose: Medical domain knowledge and inference
- Contains: TCM pattern definitions, medical history engine
- Key files: `tcm-patterns.ts`, `medical-history-engine.ts`

**src/auditor/:**
- Purpose: Multi-layer validation of generated notes
- Contains: Layer 1 (basic), Layer 2 (clinical), Layer 3 (advanced), Baselines
- Key files: Organized by validation layer

**src/shared/:**
- Purpose: Shared catalogs and constants
- Contains: ICD codes, CPT codes, body part mappings, severity levels, TCM mappings
- Key files: `icd-catalog.ts`, `cpt-catalog.ts`, `body-part-constants.ts`

**frontend/:**
- Purpose: React/Next.js web UI
- Contains: Separate npm package with own dependencies
- Key files: Entry point, components, pages

**parsers/:**
- Purpose: Insurance-specific parsers
- Contains: Optum parser and other implementations
- Key files: Parser modules for different data sources

**scripts/:**
- Purpose: Utility and automation scripts
- Contains: Playwright scripts, data processing utilities
- Key files: Organized by purpose

**templates/:**
- Purpose: Excel template files for batch upload
- Contains: `batch-template.xlsx` (downloadable template)
- Key files: Pre-formatted Excel with column headers

**.batch-data/:**
- Purpose: Runtime batch storage
- Contains: JSON files for each batch (auto-generated)
- Generated: Yes
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `server/index.ts`: Express app factory, middleware setup, route registration
- `server/routes/batch.ts`: Batch upload and generation endpoints
- `server/routes/automate.ts`: Automation control endpoints

**Configuration:**
- `package.json`: Dependencies, test config, scripts
- `tsconfig.json`: TypeScript compiler options
- `vitest.config.ts`: Vitest test runner config

**Core Logic:**
- `src/generator/soap-generator.ts`: Main SOAP generation engine
- `src/parser/rule-engine.ts`: Clinical data parsing rules
- `src/knowledge/tcm-patterns.ts`: TCM pattern definitions
- `server/services/batch-generator.ts`: Batch processing orchestration

**Testing:**
- `server/__tests__/`: Route and service tests
- `src/shared/__tests__/`: Shared utility tests
- `src/auditor/`: Validation layer tests

## Naming Conventions

**Files:**
- Services: `{domain}-{purpose}.ts` (e.g., `batch-generator.ts`, `automation-runner.ts`)
- Routes: `{resource}.ts` (e.g., `batch.ts`, `automate.ts`)
- Types: `index.ts` in types directory or `{domain}.ts` for specific types
- Tests: `{module}.test.ts` or `{module}.spec.ts`

**Directories:**
- Feature domains: lowercase (e.g., `parser`, `generator`, `knowledge`)
- Test directories: `__tests__` (co-located with source)
- Utility directories: `shared` for cross-cutting utilities

**Functions:**
- Generators: `generate{Noun}()` (e.g., `generateBatch()`, `generateBatchId()`)
- Parsers: `parse{Noun}()` (e.g., `parseExcelBuffer()`)
- Builders: `build{Noun}()` (e.g., `buildContext()`, `buildPatientsFromRows()`)
- Exporters: `export{Noun}()` (e.g., `exportSOAPAsText()`)
- Utilities: `{verb}{Noun}()` (e.g., `splitSOAPText()`, `calculateWeights()`)

**Variables:**
- camelCase for all variables and parameters
- Descriptive names: `batchId`, `patientIdx`, `visitIdx` (not `id`, `p`, `v`)
- Readonly collections: `readonly Type[]` in type definitions

**Types:**
- PascalCase for interfaces and types
- Suffix patterns: `Data`, `Context`, `Options`, `State` (e.g., `BatchData`, `GenerationContext`)
- Enums: PascalCase with UPPERCASE values (e.g., `NoteType = 'IE' | 'TX'`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/generator/` (if generation logic) or `server/services/` (if API logic)
- Routes: `server/routes/{resource}.ts`
- Tests: `server/__tests__/{feature}.test.ts` or `src/{domain}/__tests__/{feature}.test.ts`

**New Component/Module:**
- Implementation: `src/{domain}/{module}.ts` (follow existing domain structure)
- Types: Add to `src/types/index.ts` or create `src/{domain}/types.ts`
- Tests: Co-locate in `src/{domain}/__tests__/{module}.test.ts`

**Utilities:**
- Shared helpers: `src/shared/{utility}.ts`
- Service helpers: `server/services/{utility}.ts`
- Export from barrel file if used across modules

**New Validation Layer:**
- Location: `src/auditor/layer{N}/` (follow existing layer pattern)
- Pattern: Export validation function, register in auditor index

## Special Directories

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**.batch-data/:**
- Purpose: Runtime batch storage (JSON files)
- Generated: Yes (by `batch-store.ts`)
- Committed: No (in .gitignore)

**.planning/codebase/:**
- Purpose: GSD planning documents
- Generated: Yes (by GSD agents)
- Committed: Yes

**coverage/:**
- Purpose: Test coverage reports
- Generated: Yes (by jest)
- Committed: No

---

*Structure analysis: 2026-02-22*
