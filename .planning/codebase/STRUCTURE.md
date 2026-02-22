# Codebase Structure

**Analysis Date:** 2026-02-22

## Directory Layout

```
soap-system/
├── src/                    # Core SOAP generation engine (TypeScript)
│   ├── types/              # Type definitions
│   ├── shared/             # Shared constants, catalogs, mappings
│   ├── parser/             # Rule engine, weight system, template parsing
│   ├── generator/          # SOAP note generation logic
│   ├── knowledge/          # TCM patterns, medical history inference
│   ├── validator/          # Output validation
│   └── auditor/            # Three-tier quality audit system
├── server/                 # Express API server
│   ├── index.ts            # App factory, middleware setup
│   ├── types.ts            # Batch processing types
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic (Excel parsing, batch generation)
│   ├── store/              # Batch persistence (LRU cache)
│   └── __tests__/          # Server tests
├── parsers/                # External parser modules (Optum, etc.)
├── frontend/               # Vue.js frontend (separate package)
├── templates/              # Excel templates, SOAP templates
├── scripts/                # Utility scripts
├── .batch-data/            # Runtime batch storage (LRU, 32 batch limit)
├── .planning/              # GSD planning documents
├── package.json            # Root dependencies (Express, ExcelJS, etc.)
├── tsconfig.json           # TypeScript configuration
├── vitest.config.ts        # Vitest configuration
└── docker-compose.yml      # Docker orchestration
```

## Directory Purposes

**src/types:**
- Purpose: Central type definitions for entire system
- Contains: SOAP structure, enums (NoteType, BodyPart, etc.), validation types
- Key files: `src/types/index.ts`

**src/shared:**
- Purpose: Shared constants and lookup tables
- Contains: ICD-10 catalog, CPT codes, TCM mappings, body part constants, severity levels
- Key files: `src/shared/icd-catalog.ts`, `src/shared/cpt-catalog.ts`, `src/shared/body-part-constants.ts`

**src/parser:**
- Purpose: Parse clinical input and calculate option weights
- Contains: Rule engine, weight system, dropdown parser, template logic rules
- Key files: `src/parser/rule-engine.ts`, `src/parser/weight-system.ts`, `src/parser/template-logic-rules.ts`

**src/generator:**
- Purpose: Generate complete SOAP notes from context
- Contains: SOAP generator, TX sequence engine, goals calculator, objective patch
- Key files: `src/generator/soap-generator.ts`, `src/generator/tx-sequence-engine.ts`

**src/knowledge:**
- Purpose: Medical knowledge base for inference
- Contains: TCM pattern definitions, medical history engine
- Key files: `src/knowledge/tcm-patterns.ts`, `src/knowledge/medical-history-engine.ts`

**src/validator:**
- Purpose: Validate generated SOAP text
- Contains: Output validator, integration with Optum parser
- Key files: `src/validator/output-validator.ts`

**src/auditor:**
- Purpose: Multi-tier quality assurance
- Contains: Layer1 (rule compliance), Layer2 (medical logic), Layer3 (case similarity)
- Key files: `src/auditor/index.ts`, `src/auditor/layer1/`, `src/auditor/layer2/`, `src/auditor/layer3/`

**server/:**
- Purpose: HTTP API server
- Contains: Express app, batch routes, automation routes, services
- Key files: `server/index.ts`, `server/routes/batch.ts`, `server/services/batch-generator.ts`

**server/services:**
- Purpose: Business logic for batch processing
- Contains: Excel parser, batch generator, text-to-HTML converter, automation runner
- Key files: `server/services/excel-parser.ts`, `server/services/batch-generator.ts`

**server/store:**
- Purpose: Batch data persistence
- Contains: LRU cache implementation for batch storage
- Key files: `server/store/batch-store.ts`

**parsers/:**
- Purpose: External parser modules (Optum note format, etc.)
- Contains: Note parser, checker, type definitions
- Key files: `parsers/optum-note/parser.ts`, `parsers/optum-note/checker/note-checker.ts`

**frontend/:**
- Purpose: Vue.js web interface
- Contains: Components, composables, tests
- Key files: `frontend/src/App.vue`, `frontend/src/composables/useSOAPGeneration.ts`

**templates/:**
- Purpose: Template files for SOAP generation and Excel input
- Contains: Excel batch template, SOAP section templates
- Key files: `templates/batch-template.xlsx`

**.batch-data/:**
- Purpose: Runtime storage for batch processing results
- Contains: JSON files with batch data (LRU cache, max 32 batches)
- Generated: Yes
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `server/index.ts`: Express app factory, middleware setup, health check endpoint
- `src/generator/soap-generator.ts`: Main SOAP generation function
- `server/routes/batch.ts`: Batch API endpoints

**Configuration:**
- `package.json`: Dependencies, Jest/Vitest config, test paths
- `tsconfig.json`: TypeScript compiler options
- `vitest.config.ts`: Vitest test runner config
- `docker-compose.yml`: Docker services (app, optional services)

**Core Logic:**
- `src/generator/soap-generator.ts`: SOAP note generation
- `src/parser/rule-engine.ts`: Rule evaluation for weights
- `src/parser/weight-system.ts`: Weight calculation system
- `server/services/batch-generator.ts`: Batch processing orchestration
- `server/services/excel-parser.ts`: Excel file parsing

**Testing:**
- `src/**/__tests__/*.test.ts`: Unit tests (co-located)
- `server/__tests__/*.test.ts`: Server tests
- `frontend/src/**/*.test.ts`: Frontend tests

## Naming Conventions

**Files:**
- `*.ts`: TypeScript source files
- `*.test.ts`: Unit/integration tests (Jest/Vitest)
- `*.spec.ts`: Specification tests
- `*-engine.ts`: Core algorithm/logic files (e.g., `rule-engine.ts`, `tx-sequence-engine.ts`)
- `*-parser.ts`: Parser modules (e.g., `excel-parser.ts`, `dropdown-parser.ts`)
- `*-generator.ts`: Generation logic (e.g., `batch-generator.ts`, `soap-generator.ts`)
- `*-calculator.ts`: Calculation utilities (e.g., `goals-calculator.ts`)

**Directories:**
- `src/`: Core library code
- `server/`: Express server code
- `__tests__/`: Test files (co-located with source)
- `services/`: Business logic services
- `routes/`: API route handlers
- `store/`: Data persistence layer

**Functions:**
- camelCase for all functions and variables
- Prefix with `export` for public API
- Prefix with `function` for named functions (not arrow functions in exports)

**Types:**
- PascalCase for interfaces and types
- Suffix with `Type` for union types (e.g., `NoteType`, `BodyPart`)
- Suffix with `Result` for function return types (e.g., `ValidationResult`, `AuditReport`)

## Where to Add New Code

**New Feature (e.g., new SOAP section):**
- Primary code: `src/generator/soap-generator.ts` (add generation logic)
- Types: `src/types/index.ts` (add to SOAPNote interface)
- Tests: `src/generator/__tests__/soap-generator.test.ts`
- Shared constants: `src/shared/` (if needed)

**New Validation Rule:**
- Implementation: `src/validator/output-validator.ts` or `parsers/optum-note/checker/`
- Types: `src/validator/` or `parsers/optum-note/checker/types.ts`
- Tests: `src/validator/__tests__/` or `parsers/optum-note/checker/__tests__/`

**New API Endpoint:**
- Route handler: `server/routes/batch.ts` or `server/routes/automate.ts`
- Service logic: `server/services/` (create new file if needed)
- Types: `server/types.ts`
- Tests: `server/__tests__/api-routes.test.ts`

**New Knowledge Base Entry:**
- TCM patterns: `src/knowledge/tcm-patterns.ts`
- Medical history rules: `src/knowledge/medical-history-engine.ts`
- Catalogs: `src/shared/` (e.g., `icd-catalog.ts`)

**Utilities:**
- Shared helpers: `src/shared/` (create new file for domain-specific utilities)
- Parser utilities: `src/parser/` (for parsing-related helpers)
- Generator utilities: `src/generator/` (for generation-related helpers)

## Special Directories

**src/auditor/baselines:**
- Purpose: Baseline data for audit layer comparisons
- Generated: No
- Committed: Yes

**src/auditor/layer1, layer2, layer3:**
- Purpose: Three-tier audit system implementation
- Generated: No
- Committed: Yes

**server/__tests__:**
- Purpose: Server integration and unit tests
- Generated: No
- Committed: Yes

**.batch-data/:**
- Purpose: Runtime batch storage (LRU cache)
- Generated: Yes (created at runtime)
- Committed: No

**coverage/:**
- Purpose: Jest/Vitest coverage reports
- Generated: Yes (from `npm run test:coverage`)
- Committed: No

---

*Structure analysis: 2026-02-22*
