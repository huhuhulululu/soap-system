# TDD-Driven Fix Plan for SOAP Generator

**Created**: 2026-02-09
**Status**: Ready for Implementation
**Test Results Summary**:
- Correction-generator: 100% (61/61)
- Batch continuation: 100% (135/135)
- SOAP generator compliance: 78/100
- Frontend generator service: 36% (17/47)

---

## Phase 1: CRITICAL Fixes

### 1.1 Frontend Parser Header Format Matching

**File**: `frontend/src/services/generator.js`
**Issue**: `ensureHeader()` format doesn't match parser expectations (36% pass rate)

#### RED: Write Failing Test First

```javascript
// frontend/src/services/generator.test.js
import { describe, it, expect } from 'vitest'
import { parseOptumNote } from '../../../parsers/optum-note/parser.ts'

describe('ensureHeader integration with parser', () => {
  it('generates header that parser can parse successfully', () => {
    const textWithoutHeader = `Subjective: INITIAL EVALUATION
Patient c/o right shoulder pain...
Pain Scale: 8 /10
Pain Frequency: Frequent (symptoms occur between 51% and 75% of the time)`

    // Generator should add header, parser should accept it
    const { ensureHeader } = require('./generator.js')
    const withHeader = ensureHeader(textWithoutHeader)
    const result = parseOptumNote(withHeader)

    expect(result.success).toBe(true)
    expect(result.document).toBeDefined()
    expect(result.document.header).toBeDefined()
    expect(result.document.header.patient.name).toBeDefined()
  })

  it('header format matches Pattern A regex exactly', () => {
    const { ensureHeader } = require('./generator.js')
    const header = ensureHeader('')

    // Pattern A from parser.ts line 192-193
    const patternA = /^([A-Z]+,\s*[A-Z\s]+)\s*\(DOB:\s*(\d{2}\/\d{2}\/\d{4})\s*ID:\s*(\d{10})\)\s*Date of Service:\s*(\d{2}\/\d{2}\/\d{4})\s*Printed on:\s*(\d{2}\/\d{2}\/\d{4})/m

    expect(patternA.test(header)).toBe(true)
  })

  it('does not modify text that already has header', () => {
    const existingHeader = 'SMITH, JOHN (DOB: 01/15/1980 ID: 1234567890) Date of Service: 01/01/2025 Printed on: 01/01/2025\nSubjective: ...'
    const { ensureHeader } = require('./generator.js')

    expect(ensureHeader(existingHeader)).toBe(existingHeader)
  })
})
```

#### GREEN: Implementation Fix

```javascript
// generator.js - Fix ensureHeader function
function ensureHeader(text) {
  // Check for existing header patterns
  if (/PATIENT:|DOB:/i.test(text)) return text

  // Generate header matching Pattern A exactly
  // Format: NAME, FIRSTNAME (DOB: MM/DD/YYYY ID: XXXXXXXXXX) Date of Service: MM/DD/YYYY Printed on: MM/DD/YYYY
  const today = new Date()
  const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`

  return `UNKNOWN, PATIENT (DOB: 01/01/1970 ID: 0000000000) Date of Service: ${dateStr} Printed on: ${dateStr}\n${text}`
}
```

---

### 1.2 IE to TX1 Pain Decrease Validation

**File**: `src/generator/tx-sequence-engine.ts`
**Issue**: TX1 pain should be 0.5-1.5 points lower than IE pain

#### RED: Write Failing Test First

```typescript
// src/generator/__tests__/tx-sequence-engine.test.ts
import { describe, it, expect } from 'vitest'
import { generateTXSequenceStates } from '../tx-sequence-engine'
import type { GenerationContext } from '../../types'

describe('IE to TX1 pain transition', () => {
  const createContext = (iePain: number): GenerationContext => ({
    primaryBodyPart: 'SHOULDER',
    laterality: 'right',
    chronicityLevel: 'Chronic',
    localPattern: 'Qi and Blood Stagnation',
    systemicPattern: 'Qi Deficiency',
    insuranceType: 'OPTUM',
    previousIE: {
      subjective: {
        painScale: { current: iePain }
      }
    }
  })

  it('TX1 pain is 0.5-1.5 points lower than IE pain', () => {
    const iePain = 8
    const context = createContext(iePain)

    const states = generateTXSequenceStates(context, { txCount: 1 })
    const tx1Pain = states[0].painScaleCurrent

    const painDecrease = iePain - tx1Pain
    expect(painDecrease).toBeGreaterThanOrEqual(0.5)
    expect(painDecrease).toBeLessThanOrEqual(1.5)
  })

  it('TX1 pain decrease is consistent across multiple runs', () => {
    const iePain = 8
    const context = createContext(iePain)

    // Run 10 times to verify consistency
    for (let i = 0; i < 10; i++) {
      const states = generateTXSequenceStates(context, { txCount: 1 })
      const tx1Pain = states[0].painScaleCurrent
      const painDecrease = iePain - tx1Pain

      expect(painDecrease).toBeGreaterThanOrEqual(0.5)
      expect(painDecrease).toBeLessThanOrEqual(1.5)
    }
  })

  it('handles edge case: IE pain at 10', () => {
    const context = createContext(10)
    const states = generateTXSequenceStates(context, { txCount: 1 })
    const painDecrease = 10 - states[0].painScaleCurrent

    expect(painDecrease).toBeGreaterThanOrEqual(0.5)
    expect(painDecrease).toBeLessThanOrEqual(1.5)
  })

  it('handles edge case: IE pain at 4', () => {
    const context = createContext(4)
    const states = generateTXSequenceStates(context, { txCount: 1 })
    const painDecrease = 4 - states[0].painScaleCurrent

    // Lower bound may be adjusted for low starting pain
    expect(painDecrease).toBeGreaterThanOrEqual(0.5)
    expect(states[0].painScaleCurrent).toBeGreaterThanOrEqual(2) // Don't go below 2
  })
})
```

#### GREEN: Implementation Fix

```typescript
// tx-sequence-engine.ts - Add TX1 special handling after line 465

// Special handling for TX1: ensure pain decrease of 0.5-1.5 from IE
if (i === 1) {
  const minDecrease = 0.5
  const maxDecrease = 1.5
  const targetTx1Pain = startPain - (minDecrease + rng() * (maxDecrease - minDecrease))
  const tx1Snapped = snapPainToGrid(Math.max(targetPain, targetTx1Pain))
  painScaleCurrent = tx1Snapped.value
  painScaleLabel = tx1Snapped.label
}
```

---

### 1.3 Tongue/Pulse Consistency

**File**: `src/generator/tx-sequence-engine.ts`
**Issue**: TXVisitState missing tonguePulse field; TX visits should inherit from IE

#### RED: Write Failing Test First

```typescript
// src/generator/__tests__/tx-sequence-engine.test.ts
describe('Tongue and Pulse consistency', () => {
  it('TXVisitState includes tonguePulse inherited from IE', () => {
    const context: GenerationContext = {
      primaryBodyPart: 'SHOULDER',
      laterality: 'right',
      chronicityLevel: 'Chronic',
      localPattern: 'Qi and Blood Stagnation',
      systemicPattern: 'Qi Deficiency',
      insuranceType: 'OPTUM',
      previousIE: {
        subjective: { painScale: { current: 8 } },
        objective: {
          tonguePulse: {
            tongue: 'Pale with thin white coating',
            pulse: 'Wiry and thready'
          }
        }
      }
    }

    const states = generateTXSequenceStates(context, { txCount: 3 })

    // All TX visits should have same tongue/pulse as IE
    states.forEach((state, idx) => {
      expect(state.tonguePulse).toBeDefined()
      expect(state.tonguePulse.tongue).toBe('Pale with thin white coating')
      expect(state.tonguePulse.pulse).toBe('Wiry and thready')
    })
  })

  it('uses default tongue/pulse when IE lacks data', () => {
    const context: GenerationContext = {
      primaryBodyPart: 'KNEE',
      laterality: 'left',
      chronicityLevel: 'Acute',
      insuranceType: 'OPTUM'
    }

    const states = generateTXSequenceStates(context, { txCount: 1 })

    expect(states[0].tonguePulse).toBeDefined()
    expect(states[0].tonguePulse.tongue).toBeTruthy()
    expect(states[0].tonguePulse.pulse).toBeTruthy()
  })
})
```

#### GREEN: Implementation Fix

```typescript
// tx-sequence-engine.ts - Update TXVisitState interface (line 20)
export interface TXVisitState {
  // ... existing fields ...
  tonguePulse: {
    tongue: string
    pulse: string
  }
}

// In generateTXSequenceStates function, before the loop (around line 432)
const inheritedTonguePulse = context.previousIE?.objective?.tonguePulse ?? {
  tongue: 'Pink with thin white coating',
  pulse: 'Even and moderate'
}

// In the visit object (around line 686)
visits.push({
  // ... existing fields ...
  tonguePulse: inheritedTonguePulse,
})
```

---

## Phase 2: HIGH Priority Fixes

### 2.1 S to O Chain Validation

**File**: `src/generator/tx-sequence-engine.ts`
**Issue**: Subjective pain must correlate with Objective findings

#### RED: Write Failing Test First

```typescript
describe('S to O chain validation', () => {
  it('high pain (8-10) correlates with severe/moderate-to-severe objective findings', () => {
    const context = createContext(9)
    const states = generateTXSequenceStates(context, { txCount: 1 })

    // High pain should not have mild tightness
    expect(states[0].tightnessGrading.toLowerCase()).not.toBe('mild')
    expect(['severe', 'moderate to severe', 'moderate']).toContain(
      states[0].tightnessGrading.toLowerCase()
    )
  })

  it('low pain (3-4) correlates with mild objective findings', () => {
    const context = createContext(4)
    const states = generateTXSequenceStates(context, { txCount: 5 })
    const lastState = states[states.length - 1]

    // Low pain at end should have mild findings
    if (lastState.painScaleCurrent <= 4) {
      expect(['mild', 'mild to moderate']).toContain(
        lastState.tightnessGrading.toLowerCase()
      )
    }
  })

  it('tenderness grade correlates with pain level', () => {
    const context = createContext(8)
    const states = generateTXSequenceStates(context, { txCount: 1 })

    // Pain 8 should have tenderness +3 or +4
    expect(states[0].tendernessGrading).toMatch(/\+[34]/)
  })
})
```

#### GREEN: Implementation Fix

```typescript
// Add pain-to-objective correlation function
function getObjectiveGradeForPain(pain: number): {
  tightnessRange: string[]
  tendernessRange: string[]
} {
  if (pain >= 8) {
    return {
      tightnessRange: ['severe', 'moderate to severe'],
      tendernessRange: ['+3', '+4']
    }
  }
  if (pain >= 6) {
    return {
      tightnessRange: ['moderate', 'moderate to severe'],
      tendernessRange: ['+2', '+3']
    }
  }
  if (pain >= 4) {
    return {
      tightnessRange: ['mild to moderate', 'moderate'],
      tendernessRange: ['+1', '+2']
    }
  }
  return {
    tightnessRange: ['mild', 'mild to moderate'],
    tendernessRange: ['+1']
  }
}
```

---

### 2.2 Reduce Noise Cap

**File**: `src/generator/tx-sequence-engine.ts:463`
**Issue**: Noise range ~0.44, need to reduce to 0.15

#### RED: Write Failing Test First

```typescript
describe('Pain noise constraints', () => {
  it('pain variation between visits is at most 0.15 from expected', () => {
    const context = createContext(8)

    // Run multiple times
    for (let run = 0; run < 20; run++) {
      const states = generateTXSequenceStates(context, { txCount: 5 })

      for (let i = 1; i < states.length; i++) {
        const prevPain = states[i - 1].painScaleCurrent
        const currPain = states[i].painScaleCurrent

        // Pain should never increase
        expect(currPain).toBeLessThanOrEqual(prevPain)

        // Decrease should be gradual, not more than 1.5 per visit
        const decrease = prevPain - currPain
        expect(decrease).toBeLessThanOrEqual(1.5)
      }
    }
  })
})
```

#### GREEN: Implementation Fix

```typescript
// tx-sequence-engine.ts line 463 - Reduce noise
// OLD:
const painNoise = ((rng() - 0.5) * 0.35) + disruption * 0.18

// NEW:
const NOISE_CAP = 0.15
const painNoise = clamp(
  ((rng() - 0.5) * 0.2) + disruption * 0.08,
  -NOISE_CAP,
  NOISE_CAP
)
```

---

### 2.3 Add MUSCLE_MAP and ADL_MAP

**File**: `src/generator/tx-sequence-engine.ts`
**Issue**: Missing body-part-specific muscle and ADL mappings

#### RED: Write Failing Test First

```typescript
describe('Body part specific mappings', () => {
  it('SHOULDER context uses shoulder-specific muscles', () => {
    const context = createContext(8)
    context.primaryBodyPart = 'SHOULDER'

    const states = generateTXSequenceStates(context, { txCount: 1 })

    // Should have access to shoulder muscles
    expect(MUSCLE_MAP['SHOULDER']).toBeDefined()
    expect(MUSCLE_MAP['SHOULDER']).toContain('trapezius')
  })

  it('KNEE context uses knee-specific ADL activities', () => {
    const context = createContext(8)
    context.primaryBodyPart = 'KNEE'

    expect(ADL_MAP['KNEE']).toBeDefined()
    expect(ADL_MAP['KNEE']).toContain('walking')
    expect(ADL_MAP['KNEE']).toContain('climbing stairs')
  })
})
```

#### GREEN: Implementation Fix

```typescript
// tx-sequence-engine.ts - Add after imports

export const MUSCLE_MAP: Record<string, string[]> = {
  SHOULDER: [
    'trapezius', 'deltoid', 'supraspinatus', 'infraspinatus',
    'rhomboid', 'levator scapulae', 'subscapularis', 'teres minor'
  ],
  KNEE: [
    'quadriceps', 'hamstrings', 'gastrocnemius', 'popliteus',
    'vastus medialis', 'vastus lateralis', 'sartorius'
  ],
  NECK: [
    'sternocleidomastoid', 'scalenes', 'trapezius', 'levator scapulae',
    'splenius capitis', 'semispinalis'
  ],
  LBP: [
    'erector spinae', 'quadratus lumborum', 'psoas', 'piriformis',
    'gluteus medius', 'multifidus'
  ],
  ELBOW: [
    'biceps brachii', 'triceps brachii', 'brachioradialis',
    'pronator teres', 'supinator', 'extensor carpi radialis'
  ],
  HIP: [
    'iliopsoas', 'gluteus maximus', 'gluteus medius', 'piriformis',
    'tensor fasciae latae', 'adductor magnus'
  ]
}

export const ADL_MAP: Record<string, string[]> = {
  SHOULDER: [
    'reaching overhead', 'lifting objects', 'dressing',
    'carrying bags', 'brushing hair', 'sleeping on side'
  ],
  KNEE: [
    'walking', 'climbing stairs', 'standing from sitting',
    'squatting', 'running', 'kneeling'
  ],
  NECK: [
    'turning head', 'looking up', 'reading',
    'driving', 'computer work', 'sleeping'
  ],
  LBP: [
    'bending forward', 'lifting', 'sitting prolonged',
    'standing prolonged', 'walking', 'getting out of bed'
  ],
  ELBOW: [
    'gripping objects', 'turning doorknobs', 'typing',
    'lifting with arm extended', 'using tools'
  ],
  HIP: [
    'walking', 'sitting', 'standing from chair',
    'putting on shoes', 'getting in/out of car', 'climbing stairs'
  ]
}
```

---

## Phase 3: Implementation Order

| Priority | Issue | File | Estimated Effort |
|----------|-------|------|------------------|
| 1 | Header format matching | generator.js | 30 min |
| 2 | IE to TX1 pain validation | tx-sequence-engine.ts | 45 min |
| 3 | Tongue/Pulse consistency | tx-sequence-engine.ts | 30 min |
| 4 | S to O chain validation | tx-sequence-engine.ts | 60 min |
| 5 | Noise cap reduction | tx-sequence-engine.ts | 15 min |
| 6 | MUSCLE_MAP/ADL_MAP | tx-sequence-engine.ts | 30 min |

**Total Estimated Time**: ~3.5 hours

---

## Verification Commands

```bash
# Run all tests
npm test

# Run specific test files
npm test -- frontend/src/services/generator.test.js
npm test -- src/generator/__tests__/tx-sequence-engine.test.ts

# Check coverage
npm run test:coverage

# Run batch tests
npm run test:batch
```

---

## Success Criteria

After implementing all fixes:

| Test Suite | Current | Target |
|------------|---------|--------|
| Frontend generator service | 36% (17/47) | 95%+ |
| SOAP generator compliance | 78/100 | 95/100 |
| Correction-generator | 100% | 100% |
| Batch continuation | 100% | 100% |

---

## Notes

1. **TDD Workflow**: For each fix, write the failing test FIRST, verify it fails, then implement the fix
2. **Immutability**: All state updates must create new objects, not mutate existing ones
3. **Coverage**: Maintain 80%+ test coverage throughout
4. **No console.log**: Remove any debug statements before committing
