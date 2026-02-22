# Testing Patterns

**Analysis Date:** 2026-02-21

## Test Framework

**Runner:**
- Jest 29.7.0 (primary)
- Vitest 4.0.18 (secondary, used in frontend)
- Config: `package.json` jest config + `vitest.config.ts`

**Assertion Library:**
- Jest built-in `expect()` for Jest tests
- Vitest built-in `expect()` for Vitest tests

**Run Commands:**
```bash
npm test                    # Run all tests (Jest)
npm run test:verbose        # Jest with verbose output
npm run test:coverage       # Jest with coverage report
npm run test:unit           # Jest unit tests only
npm run test:e2e            # Jest E2E tests only
npm run test:all            # Jest all tests in __tests__ and tests/
npm run test:watch          # Jest watch mode
```

## Test File Organization

**Location:**
- Backend: `server/__tests__/` and `src/shared/__tests__/`
- Frontend: `frontend/src/tests/` and co-located with source (e.g., `engine.test.ts` next to `engine.ts`)
- Parsers: `parsers/optum-note/` (no dedicated test directory)

**Naming:**
- `*.test.ts` for Jest tests
- `*.spec.ts` for Jest tests (alternative)
- Both patterns supported by Jest config

**Structure:**
```
server/
├── __tests__/
│   ├── batch-store.test.ts
│   ├── batch-generator.test.ts
│   ├── excel-parser.test.ts
│   ├── text-to-html.test.ts
│   └── api-routes.test.ts
src/shared/
├── __tests__/
│   ├── field-parsers.test.ts
│   ├── cpt-catalog.test.ts
│   ├── icd-catalog.test.ts
│   └── body-part-constants.test.ts
frontend/src/
├── engine.test.ts
├── engine-random.test.ts
├── medical-history.test.ts
├── e2e-score-audit.test.ts
└── tests/
    ├── checker/
    │   ├── sequence-rules.test.ts
    │   ├── scoring.test.ts
    │   ├── tx-rules.test.ts
    │   ├── batch-scale.test.ts
    │   ├── ie-rules.test.ts
    │   ├── code-rules.test.ts
    │   ├── stress.test.ts
    │   ├── generator-rules.test.ts
    │   └── integration.test.ts
    ├── shared/
    │   └── shared-modules.test.ts
    └── fixtures/
        ├── debug-errors.test.ts
        └── generator.smoke.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('Feature/Module Name', () => {
  describe('Specific Behavior', () => {
    it('should do X when Y', () => {
      // Arrange
      const input = makeTestData()

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toBe(expectedValue)
    })
  })
})
```

**Patterns:**
- Setup: `beforeEach()` for test isolation (e.g., `clearAllBatches()`)
- Teardown: `afterEach()` not commonly used (tests are isolated)
- Assertion: Direct `expect()` calls, no custom matchers

**Example from `src/shared/__tests__/field-parsers.test.ts`:**
```typescript
describe('extractPainCurrent', () => {
    it('reads { current } format', () => {
        expect(extractPainCurrent({ current: 6 })).toBe(6)
    })

    it('reads { value } format', () => {
        expect(extractPainCurrent({ value: 5 })).toBe(5)
    })

    it('returns 7 for null/undefined/empty', () => {
        expect(extractPainCurrent(null)).toBe(7)
        expect(extractPainCurrent(undefined)).toBe(7)
        expect(extractPainCurrent({})).toBe(7)
    })
})
```

## Mocking

**Framework:** Jest built-in mocking (no external library)

**Patterns:**
```typescript
// Mock module
jest.mock('../path/to/module', () => ({
  functionName: jest.fn(() => mockValue)
}))

// Mock function
const mockFn = jest.fn()
mockFn.mockReturnValue(value)
mockFn.mockResolvedValue(asyncValue)
```

**What to Mock:**
- External API calls
- File system operations
- Database queries
- Time-dependent functions (use `jest.useFakeTimers()`)

**What NOT to Mock:**
- Pure utility functions (parse, calculate, filter)
- Type definitions
- Constants and mappings
- Internal module dependencies (test integration)

**Example from `server/__tests__/batch-store.test.ts`:**
```typescript
function makeBatch(id?: string): BatchData {
  return {
    batchId: id ?? generateBatchId(),
    createdAt: new Date().toISOString(),
    mode: 'full',
    confirmed: false,
    patients: [],
    summary: { totalPatients: 0, totalVisits: 0, byType: {} },
  }
}

describe('batch-store', () => {
  beforeEach(() => {
    clearAllBatches()  // Isolation via setup
  })
})
```

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function pattern
function makeContext(overrides = {}) {
  return {
    noteType: 'TX' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: 'LBP' as const,
    laterality: 'bilateral' as const,
    ...overrides
  }
}

// Usage
const ctx = makeContext({ painCurrent: 6 })
```

**Location:**
- Inline in test files (no separate fixtures directory)
- Factory functions at top of test file
- JSON fixtures in `frontend/src/tests/data/` (e.g., `whitelist.json`)

**Example from `frontend/src/engine.test.ts`:**
```typescript
function makeContext(overrides = {}) {
  return {
    noteType: 'TX' as const,
    insuranceType: 'OPTUM' as const,
    primaryBodyPart: 'LBP' as const,
    laterality: 'bilateral' as const,
    localPattern: 'Qi Stagnation',
    systemicPattern: 'Kidney Yang Deficiency',
    chronicityLevel: 'Chronic' as const,
    severityLevel: 'moderate to severe' as const,
    painCurrent: 8,
    associatedSymptom: 'soreness' as const,
    ...overrides
  }
}
```

## Coverage

**Requirements:** 70% minimum (branches, functions, lines, statements)

**View Coverage:**
```bash
npm run test:coverage
# Generates coverage/ directory with HTML report
```

**Threshold Configuration (from `package.json`):**
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

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Location: `src/shared/__tests__/`, `server/__tests__/`
- Examples: `field-parsers.test.ts`, `batch-store.test.ts`
- Approach: Test pure functions with various inputs (happy path, edge cases, defaults)

**Integration Tests:**
- Scope: Multiple modules working together
- Location: `frontend/src/tests/checker/integration.test.ts`
- Approach: Test data flow through generators and validators

**E2E Tests:**
- Scope: Critical user flows
- Framework: Playwright (installed but not heavily used in test suite)
- Location: `frontend/src/e2e-score-audit.test.ts`
- Approach: Test complete workflows (generate note → validate → export)

**Smoke Tests:**
- Scope: Basic functionality verification
- Location: `frontend/src/tests/fixtures/generator.smoke.test.ts`
- Approach: Quick sanity checks for major features

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})
```

**Error Testing:**
```typescript
it('should throw on invalid input', () => {
  expect(() => functionThatThrows()).toThrow()
  expect(() => functionThatThrows()).toThrow(Error)
})
```

**Parameterized Testing:**
```typescript
describe('parseAdlSeverity', () => {
    it('maps all severity levels', () => {
        expect(parseAdlSeverity('mild')).toBe('mild')
        expect(parseAdlSeverity('moderate')).toBe('moderate')
        expect(parseAdlSeverity('severe')).toBe('severe')
    })
})
```

**Seeded Randomness (for reproducible tests):**
```typescript
const SEED = 378146595

it('generates reproducible results with same seed', () => {
  const r1 = generateTXSequenceStates(ctx, { seed: SEED })
  const r2 = generateTXSequenceStates(ctx, { seed: SEED })
  expect(r1.states).toEqual(r2.states)
})
```

**Example from `frontend/src/engine.test.ts`:**
```typescript
describe('Seed 可复现', () => {
    it('相同 seed + 输入 → 相同结果', () => {
      const ctx = makeContext()
      const opts = {
        txCount: 11, startVisitIndex: 1, seed: SEED,
        initialState: { pain: 8, associatedSymptom: 'soreness' }
      }
      const r1 = generateTXSequenceStates(ctx, opts)
      const r2 = generateTXSequenceStates(ctx, opts)
      expect(r1.seed).toBe(r2.seed)
      expect(r1.states.map(s => s.painScaleLabel)).toEqual(
        r2.states.map(s => s.painScaleLabel)
      )
    })
})
```

## Test Isolation

**Strategy:**
- Factory functions create fresh test data for each test
- `beforeEach()` resets shared state (e.g., `clearAllBatches()`)
- No global state pollution between tests
- Each test is independent and can run in any order

**Example from `server/__tests__/batch-store.test.ts`:**
```typescript
describe('batch-store', () => {
  beforeEach(() => {
    clearAllBatches()  // Reset before each test
  })

  it('saves and retrieves a batch', () => {
    const batch = makeBatch('test_batch_1')
    saveBatch(batch)
    const retrieved = getBatch('test_batch_1')
    expect(retrieved?.batchId).toBe('test_batch_1')
  })
})
```

---

*Testing analysis: 2026-02-21*
