# Coding Conventions

**Analysis Date:** 2026-02-22

## Naming Patterns

**Files:**
- `camelCase.ts` for implementation files: `field-parsers.ts`, `soap-generator.ts`, `rule-engine.ts`
- `kebab-case.test.ts` for test files: `field-parsers.test.ts`, `sequence-rules.test.ts`
- `UPPERCASE_SNAKE_CASE` for constants: `BODY_PART_MUSCLES`, `INSURANCE_NEEDLE_MAP`, `SEVERITY_ORDER`

**Functions:**
- `parse*()` prefix for text → enum/type conversion: `parseAdlSeverity()`, `parseGoalPainTarget()`, `parseProgressStatus()`
- `extract*()` prefix for text → numeric extraction: `extractPainCurrent()`, `extractProgressReasons()`
- `compare*()` prefix for value comparisons: `compareSeverity()`
- `calculate*()` prefix for computations: `calculateDynamicGoals()`, `calculateWeights()`
- `generate*()` prefix for creation: `generateDocument()`, `generateTXSequenceStates()`, `exportSOAPAsText()`
- `assert*()` prefix for validation: `assertTemplateSupported()`
- camelCase for all function names

**Variables:**
- camelCase for all variables: `painCurrent`, `bodyPart`, `severityLevel`, `laterality`
- Descriptive names reflecting domain: `chronicityLevel`, `associatedSymptom`, `relievingFactors`
- Abbreviated names in tight loops only: `ps` for painScale, `r` for result in normalization

**Types:**
- PascalCase for interfaces: `SOAPNote`, `GenerationContext`, `RuleContext`, `VisitRecord`
- PascalCase for type aliases: `NoteType`, `InsuranceType`, `BodyPart`, `SeverityLevel`
- Suffix `Level` for severity/intensity types: `SeverityLevel`, `ChrionicityLevel`
- Suffix `Type` for discriminated unions: `NoteType`, `InsuranceType`, `DropdownType`

## Code Style

**Formatting:**
- No explicit linter/formatter config detected in root
- Vitest configured with globals enabled (`vitest.config.ts`)
- Jest preset: `ts-jest` with `testEnvironment: node`
- TypeScript strict mode implied by type annotations throughout

**Linting:**
- No `.eslintrc` or `.prettierrc` in root directory
- Codebase uses TypeScript for type safety
- Comments use JSDoc format with `/**` blocks

## Import Organization

**Order:**
1. Type imports: `import type { SOAPNote, NoteType } from '../types'`
2. Standard library imports: `import type { LogicRule } from './logic-rules'`
3. Relative imports: `import { getTemplateAlignedRules } from './template-rule-whitelist'`
4. Side effects: None observed

**Path Aliases:**
- No path aliases configured; uses relative paths throughout
- Imports use `../` for parent directory navigation
- Imports use `./` for same-directory files

## Error Handling

**Patterns:**
- Throw descriptive errors with context: `throw new Error('Unsupported ${mode} body part "${context.primaryBodyPart}". Allowed: ${allowed}.')`
- Validation errors include allowed values: `throw new Error(\`Invalid CPT format: "${trimmed}". Expected format: 97810 or 97810x3\`)`
- Initialization errors check preconditions: `throw new Error('Whitelist not initialized. Call setWhitelist() first.')`
- No try-catch blocks observed in source; errors propagate to caller
- Default fallback values for parsing failures: `return 7` for invalid pain scales, `return 'mild'` for unknown severity

## Logging

**Framework:** No logging framework detected; no console statements in `/src` directory

**Patterns:**
- No logging in production code
- Test files use `describe()` and `it()` for structure (Vitest/Jest)
- Comments document complex logic instead of logging

## Comments

**When to Comment:**
- JSDoc blocks for exported functions with parameters and return types
- Inline comments for non-obvious logic: `// PDF renderers sometimes split at capital letter boundaries`
- Section headers with `// ============ Section Name ============` for file organization
- Comments in Chinese for domain-specific logic: `// 中医证型`, `// 患者信息`

**JSDoc/TSDoc:**
- Used for all exported functions: `/** Extract pain current from VisitRecord.subjective.painScale */`
- Includes parameter descriptions and return type
- Documents edge cases: `// Handles three formats: { current }, { value }, { range: { max } }`

## Function Design

**Size:**
- Typical functions 20-50 lines
- Largest files: `soap-generator.ts` (2280 lines), `tx-sequence-engine.ts` (1215 lines)
- Complex logic split into helper functions: `normalizePdfText()`, `assertTemplateSupported()`

**Parameters:**
- Single object parameter for complex functions: `function makeContext(overrides = {})`
- Destructuring in function signatures: `{ painStart: 8, bodyPart: 'LBP', ...config }`
- Default parameters for optional values: `overrides = {}`

**Return Values:**
- Explicit return types in function signatures
- Null for missing values: `return null` in `parseGoalPainTarget()`
- Default fallback values: `return 7` for invalid inputs
- Objects for multiple return values: `{ errors, summary, scoring }`

## Module Design

**Exports:**
- Named exports for functions: `export function extractPainCurrent()`
- Type exports: `export type NoteType = 'IE' | 'TX' | 'RE' | 'NEW_IE'`
- Interface exports: `export interface SOAPNote { ... }`
- Constants exported: `export const BODY_PART_NAMES: Record<BodyPart, string>`

**Barrel Files:**
- `src/types/index.ts` exports all type definitions
- `parsers/optum-note/index.ts` exports parser entry points
- `src/shared/__tests__/` co-located with implementation

---

*Convention analysis: 2026-02-22*
