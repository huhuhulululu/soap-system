# Coding Conventions

**Analysis Date:** 2026-02-21

## Naming Patterns

**Files:**
- `*-parsers.ts` - Functions that parse/extract data from text
- `*-generator.ts` - Functions that generate output (SOAP notes, sequences)
- `*-engine.ts` - Complex state machines or orchestration logic
- `*-calculator.ts` - Functions that compute derived values
- `*-mappings.ts` - Constant lookup tables and mappings
- `*-constraints.ts` - Validation rules and constraints
- `*-validator.ts` - Validation/audit logic
- `*-store.ts` - Data persistence/storage operations
- `types.ts` - Type definitions for a module
- `index.ts` - Barrel exports

**Functions:**
- `parse*()` - Text → enum/type conversion (e.g., `parseAdlSeverity`, `parseProgressStatus`)
- `extract*()` - Text → numeric/structured value (e.g., `extractPainCurrent`, `extractProgressReasons`)
- `compare*()` - Compare two values (e.g., `compareSeverity`)
- `calculate*()` - Compute derived values (e.g., `calculateDynamicGoals`)
- `generate*()` - Create output (e.g., `generateBatchId`, `generateTXSequenceStates`)
- `filter*()` - Filter/select from collection (e.g., `filterADLByDemographics`)
- `*ToRank()` - Convert to numeric ranking (e.g., `severityToRank`)

**Variables:**
- camelCase for all variables, parameters, properties
- UPPERCASE_SNAKE_CASE for constants (e.g., `SEVERITY_ORDER`, `POSITIVE_PROGRESS_REASONS`)
- Prefix with `is`, `has`, `can` for booleans (e.g., `isConfirmed`, `hasError`)
- Suffix with `Map`, `List`, `Set` for collections (e.g., `ADL_MUSCLE_MAP`, `FREQUENCY_ORDER`)

**Types:**
- PascalCase for all types, interfaces, enums
- Suffix with `Level`, `Status`, `Type` for enums (e.g., `SeverityLevel`, `ProgressStatus`)
- Prefix with `I` for interfaces (optional, not consistently used)

## Code Style

**Formatting:**
- TypeScript strict mode enabled (`"strict": true` in tsconfig.json)
- Target: ES2018
- No explicit formatter configured (Prettier not in devDependencies)
- Manual formatting follows consistent indentation (2 spaces observed)

**Linting:**
- No ESLint config detected
- Relies on TypeScript compiler for type checking

## Import Organization

**Order:**
1. Type imports: `import type { Type } from 'module'`
2. Default imports: `import module from 'module'`
3. Named imports: `import { func, const } from 'module'`
4. Relative imports: `import { func } from '../path'`

**Path Aliases:**
- No path aliases configured in tsconfig.json
- Uses relative paths throughout (e.g., `../../src/generator/`)

**Example from `frontend/src/engine.test.ts`:**
```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { generateTXSequenceStates } from '../../src/generator/tx-sequence-engine'
import { exportSOAPAsText } from '../../src/generator/soap-generator'
import whitelistData from './data/whitelist.json'
```

## Error Handling

**Patterns:**
- Throw descriptive Error objects with context
- No try-catch blocks in most utility functions (errors propagate)
- Validation happens at entry points (API routes, generators)
- Defensive defaults for missing/invalid input (e.g., `return 7` for invalid pain scale)

**Example from `src/shared/field-parsers.ts`:**
```typescript
export function extractPainCurrent(painScale: unknown): number {
    const ps = painScale as Record<string, any>
    if (!ps || typeof ps !== 'object') return 7
    if (typeof ps.current === 'number') return ps.current
    if (typeof ps.value === 'number') return ps.value
    if (typeof ps.range?.max === 'number') return ps.range.max
    return 7  // Safe default
}
```

## Logging

**Framework:** No logging framework detected (no winston, pino, bunyan)

**Patterns:**
- No console.log statements in production code
- Tests use `expect()` assertions instead of logging
- Errors are thrown with descriptive messages

## Comments

**When to Comment:**
- JSDoc blocks for public functions explaining purpose, parameters, return values
- Inline comments for complex logic or non-obvious decisions
- Section headers with `// ============ Section Name ============` for organization

**JSDoc/TSDoc:**
- Used extensively in `src/shared/field-parsers.ts`
- Documents source of merged functions and edge cases
- Example:
```typescript
/**
 * 从 VisitRecord.subjective.painScale 提取当前疼痛值。
 * 处理三种格式：{ current }, { value }, { range: { max } }
 *
 * 合并自 note-checker.ts:24, bridge.ts:70, correction-generator.ts:16
 */
export function extractPainCurrent(painScale: unknown): number {
```

## Function Design

**Size:**
- Typical functions 20-50 lines
- Larger functions (100+ lines) in generators and engines
- Max observed: `exportSOAPAsText` and `generateTXSequenceStates` (200+ lines)

**Parameters:**
- Use object parameters for functions with 3+ arguments
- Example: `generateTXSequenceStates(ctx, { txCount, startVisitIndex, seed, initialState })`

**Return Values:**
- Explicit return types on all functions
- Nullable returns use `| null` (e.g., `parseGoalPainTarget(): number | null`)
- Tuple returns for multiple values (e.g., `{ positive: string[], negative: string[] }`)

## Module Design

**Exports:**
- Named exports for functions and types
- Barrel files (`index.ts`) re-export from subdirectories
- Example from `parsers/optum-note/index.ts`:
```typescript
export { parseOptumNote } from './parser'
export type { OptumNoteResult } from './types'
```

**Barrel Files:**
- Used in `parsers/optum-note/`, `src/generator/`, `src/auditor/`
- Simplify imports: `import { func } from '../module'` instead of `../module/subdir/file`

## Immutability

**Pattern:**
- Spread operator for object updates: `{ ...obj, field: newValue }`
- Array methods that don't mutate: `.map()`, `.filter()`, `.concat()`
- No direct property assignment on objects passed as parameters

**Example from `server/__tests__/batch-store.test.ts`:**
```typescript
const batch2 = { ...batch1, confirmed: true }  // Immutable update
saveBatch(batch2)
```

## Type Safety

**Strict Mode:**
- All files compiled with `"strict": true`
- No implicit `any` types
- Explicit type annotations on function parameters and returns
- Type guards used for runtime validation

**Example:**
```typescript
export function extractPainCurrent(painScale: unknown): number {
    const ps = painScale as Record<string, any>
    if (!ps || typeof ps !== 'object') return 7
    // Type narrowing after guard
}
```

---

*Convention analysis: 2026-02-21*
