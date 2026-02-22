# Testing Patterns

**Analysis Date:** 2026-02-22

## Test Framework

**Runner:**
- Jest 29.7.0 (primary) - configured in `package.json`
- Vitest 4.0.18 (secondary) - `vitest.config.ts` with globals enabled
- Config: `package.json` jest section

**Assertion Library:**
- Jest built-in assertions: `expect()`

**Run Commands:**
```bash
npm test                 # Run all tests
npm run test:verbose    # Verbose output
npm run test:coverage   # Coverage report
npm run test:unit       # Unit tests only
npm run test:e2e        # E2E tests only
npm run test:all        # All test patterns
npm run test:watch      # Watch mode
```

## Test File Organization

**Location:**
- Co-located with implementation: `src/shared/__tests__/field-parsers.test.ts` next to `src/shared/field-parsers.ts`
- Separate test directories: `frontend/src/tests/checker/`, `frontend/src/tests/fixtures/`
- Pattern: `**/__tests__/**/*.test.ts` or `**/tests/**/*.spec.ts`

**Naming:**
- `.test.ts` suffix for test files: `field-parsers.test.ts`, `sequence-rules.test.ts`
- `.spec.ts` suffix also supported: `tests/**/*.spec.ts`
- Descriptive test names matching implementation: `engine.test.ts` for `engine.ts`

**Structure:**
```
src/shared/__tests__/
├── field-parsers.test.ts
├── icd-catalog.test.ts
├── cpt-catalog.test.ts
└── body-part-constants.test.ts

frontend/src/tests/
├── checker/
│   ├── sequence-rules.test.ts
│   ├── scoring.test.ts
│   ├── tx-rules.test.ts
│   └── integration.test.ts
└── fixtures/
    ├── generator.ts
    └── generator.smoke.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeAll } from 'vitest'

describe('Feature Name', () => {
  describe('Sub-feature', () => {
    it('should do X when Y', () => {
      expect(result).toBe(expected)
    })
  })
})
```

**Patterns:**
- Setup: `beforeAll()` for initialization (e.g., `setWhitelist(whitelistData)`)
- Teardown: Not observed; tests are stateless
- Assertion: `expect().toBe()`, `expect().toHaveLength()`, `expect().toContain()`
- Nested describes for logical grouping by feature/rule

## Mocking

**Framework:** Vitest/Jest built-in mocking

**Patterns:**
```typescript
// Test fixture generation
function makeContext(overrides = {}) {
  return {
    noteType: 'TX' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: 'LBP' as const,
    ...overrides
  }
}

// Error injection for testing
const doc = generateDocument({
  painStart: 8,
  injectErrors: [{ ruleId: 'IE02' }]
})
```

**What to Mock:**
- Test data generators: `generateDocument()`, `generatePerfectBatch()`
- Context builders: `makeContext()` with overrides
- Whitelist initialization: `setWhitelist(whitelistData)`

**What NOT to Mock:**
- Core business logic functions
- Validation/parsing functions
- Rule checking engines

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function with overrides
function generateDocument(config = {}) {
  return {
    painStart: 8,
    bodyPart: 'LBP',
    ...config
  }
}

// Context builder
function makeContext(overrides = {}) {
  return {
    noteType: 'TX' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: 'LBP' as const,
    laterality: 'bilateral' as const,
    ...overrides
  }
}
```

**Location:**
- `frontend/src/tests/fixtures/generator.ts` - Main test data generator
- `frontend/src/tests/fixtures/data/whitelist.json` - Whitelist test data
- Imported in test files: `import { generateDocument } from '../fixtures/generator'`

## Coverage

**Requirements:** 70% threshold enforced
```json
"coverageThreshold": {
  "global": {
    "branches": 70,
    "functions": 70,
    "lines": 70,
    "statements": 70
  }
}
```

**View Coverage:**
```bash
npm run test:coverage
```

**Collected from:**
- `src/**/*.ts`
- `parsers/**/*.ts`
- `server/**/*.ts`
- Excludes: `**/__tests__/**`, `**/*.test.ts`, `**/*.spec.ts`

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Test single function with various inputs
- Example: `extractPainCurrent()` tests handle `{ current }`, `{ value }`, `{ range: { max } }` formats
- Location: `src/shared/__tests__/field-parsers.test.ts`

**Integration Tests:**
- Scope: Cross-rule interactions, end-to-end flows
- Approach: Generate document → check → verify results
- Example: `frontend/src/tests/checker/integration.test.ts` tests perfect docs (0 errors, score 100) and injected errors
- Verifies: Multiple rule interactions, scoring calculations, grade assignment

**E2E Tests:**
- Framework: Playwright 1.58.2 (installed but not extensively used)
- Scope: Critical user flows
- Example: `frontend/src/e2e-score-audit.test.ts`
- Not primary focus; integration tests dominate

## Common Patterns

**Async Testing:**
```typescript
// Not extensively used; most tests are synchronous
// When needed, use async/await with expect()
it('async operation', async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})
```

**Error Testing:**
```typescript
// Test error conditions by injecting errors
it('triggers when pain increases between visits', () => {
  const doc = generateDocument({
    painStart: 8,
    injectErrors: [{ ruleId: 'V01' }]
  })
  const result = checkDocument({ document: doc })
  expect(result.errors.length).toBeGreaterThan(0)
})

// Test error messages
it('throws with descriptive message', () => {
  expect(() => {
    assertTemplateSupported(invalidContext)
  }).toThrow('Unsupported TX body part')
})
```

**Boundary Testing:**
```typescript
// Test edge cases and boundaries
it('returns 7 for null/undefined/empty', () => {
  expect(extractPainCurrent(null)).toBe(7)
  expect(extractPainCurrent(undefined)).toBe(7)
  expect(extractPainCurrent({})).toBe(7)
})

it('extracts min from range "5-6"', () => {
  expect(parseGoalPainTarget('5-6')).toBe(5)
})
```

**Deterministic Testing:**
```typescript
// Use fixed seeds for reproducible results
const SEED = 378146595

// Test with specific configurations
const ctx = makeContext({
  noteType: 'TX' as const,
  painCurrent: 8,
  painWorst: 9,
  painBest: 3
})
```

---

*Testing analysis: 2026-02-22*
