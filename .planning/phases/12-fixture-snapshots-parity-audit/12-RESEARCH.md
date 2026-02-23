# Phase 12: Fixture Snapshots & Parity Audit - Research

**Researched:** 2026-02-22
**Domain:** SOAP generation engine determinism, snapshot testing, batch/compose parity
**Confidence:** HIGH

## Summary

Phase 12 is a pre-work phase that must complete before any engine modifications (Phases 13-14). It has two pillars: (1) capture 30 regression baseline fixture snapshots of the current engine output, and (2) audit and fix the batch/compose parity gap through a shared `normalizeGenerationContext()` function.

The codebase has a seeded PRNG (`mulberry32`) in `tx-sequence-engine.ts` that makes TX generation fully deterministic given the same seed + `GenerationContext` + `TXSequenceOptions`. The parity gap is well-scoped: compose (`useSOAPGeneration.ts`) and batch (`batch-generator.ts`) construct `GenerationContext` and `TXSequenceOptions.initialState` differently — compose omits `tightness/tenderness/spasm` from `initialState` and relies on user-selected TCM patterns, while batch infers TCM patterns via `inferLocalPatterns()`/`inferSystemicPatterns()` and hardcodes `tightness/tenderness/spasm` from pain level. Both paths converge at the same downstream functions (`exportSOAPAsText` / `exportTXSeriesAsText`), so the fix is purely at the context-construction layer.

**Primary recommendation:** Build `normalizeGenerationContext()` in `src/shared/` (importable by both server and frontend), capture fixtures using fixed seeds against the current engine, then refactor both paths to use the normalizer, and verify fixtures remain green.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 30 个 fixture 覆盖早期(1-3)、中期(8-12)、晚期(18-20) 就诊次数
- 身体部位分布、边界情况（疼痛极端值、bilateral、首次就诊等）由 Claude 根据代码中支持的部位合理分配
- 确定性策略由 Claude 决定（固定 seed 或固定输入数据）
- 审计报告格式：单独的 Markdown 报告文件，全量记录并标记：一致的标 ✅，不一致的标 ❌
- 报告内容组织方式由 Claude 决定（按部位或按模式分组）
- 报告存放位置由 Claude 决定
- S/O/A/P 内容级别一致（结构等价），允许格式差异（空行、空格）
- Parity 测试时 seed 必须统一，两条路径用同一个 seed 对比
- 审计发现的 batch/compose context 构建差异必须全部修复，零差异目标
- 差异来源是 `buildContext()`（batch）和 `generationContext` computed（compose）对 GenerationContext 的字段映射/默认值不同
- `normalizeGenerationContext()` 包含推断逻辑：TCM 证型推断 + initialState 构建
- 推荐但允许覆盖：compose 端用户手动选择的值可以覆盖推断结果
- 输入输出形状由 Claude 决定
- 文件位置由 Claude 决定（需要被 server 和 frontend 两端引用）
- 先拍快照确认基线 → 再加 normalize 层 → 再验证快照不变

### Claude's Discretion
- Fixture 身体部位分布和边界情况选择
- 确定性策略（seed 管理方式）
- 审计报告内容组织方式和存放位置
- `normalizeGenerationContext()` 的输入输出接口设计
- `normalizeGenerationContext()` 的文件位置

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUD-02 | 30 reference seed fixture snapshots captured before any engine modification to detect regressions | Fixed-seed PRNG (`mulberry32`) enables deterministic output; Vitest 4.x `toMatchSnapshot()` provides file-based snapshot testing; 30 fixtures across 7 supported body parts × 3 visit phases × edge cases |
| AUD-01 | Strength/ROM generation logic audited for consistency across compose mode, batch mode, and realistic patch | `objective-patch.ts` applies post-processing to Strength/ROM; audit compares raw vs patched output across all 3 modes; `patchSOAPText()` is the sole divergence point |
| PAR-01 | Same patient data produces identical SOAP output via batch mode and compose mode | Parity gap identified: compose omits `tightness/tenderness/spasm` from `initialState`, batch hardcodes them; TCM pattern source differs; `normalizeGenerationContext()` unifies both |
| PAR-02 | Shared `normalizeGenerationContext()` function standardizes input for both generation paths | Function placed in `src/shared/` for dual import; encapsulates TCM inference + initialState construction + default resolution |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner + snapshot testing | Already in project; `toMatchSnapshot()` for file-based snapshots |
| mulberry32 (internal) | N/A | Seeded PRNG in `tx-sequence-engine.ts` | Already provides deterministic generation — same seed = same output |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `template-rule-whitelist` (internal) | N/A | Whitelist initialization for tests | Must call `setWhitelist(whitelistData)` in `beforeAll` for any test that calls `exportSOAPAsText` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest file snapshots | Inline snapshots (`toMatchInlineSnapshot`) | File snapshots better for 30 large SOAP texts — keeps test file readable |
| JSON fixture files | Vitest `.snap` files | `.snap` is auto-managed by Vitest, less manual maintenance |

**Installation:**
No new dependencies needed. Everything is already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── generator/
│   ├── __fixtures__/           # NEW: 30 fixture snapshot tests
│   │   ├── fixture-snapshots.test.ts
│   │   └── __snapshots__/      # Auto-generated by Vitest
│   ├── soap-generator.ts       # Unchanged
│   └── tx-sequence-engine.ts   # Unchanged
├── shared/
│   ├── normalize-generation-context.ts  # NEW: shared normalizer
│   └── ...existing shared modules
server/
├── services/
│   └── batch-generator.ts      # Refactored to use normalizer
frontend/
├── src/
│   └── composables/
│       └── useSOAPGeneration.ts # Refactored to use normalizer
```

### Pattern 1: Fixed-Seed Deterministic Fixtures
**What:** Each fixture uses a hardcoded seed + hardcoded `GenerationContext` to produce byte-identical output on every run.
**When to use:** Regression testing for deterministic generators.
**Key insight:** The engine's `createSeededRng(seed)` with `mulberry32` guarantees identical PRNG sequences. Any new `rng()` call in the engine loop shifts the entire sequence — this is why fixtures must be captured BEFORE engine changes.

```typescript
// Pattern from existing engine.test.ts
const SEED = 378146595

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
    ...overrides,
  }
}
```

### Pattern 2: Normalization Layer (Adapter Pattern)
**What:** A pure function that takes raw input (from either compose form or batch Excel) and produces a canonical `{ context: GenerationContext, options: TXSequenceOptions }` pair.
**When to use:** When multiple entry points must produce identical downstream behavior.

```typescript
// Recommended shape
interface NormalizeInput {
  // Required fields (both paths provide these)
  noteType: NoteType
  insuranceType: InsuranceType
  primaryBodyPart: BodyPart
  laterality: Laterality
  painCurrent: number
  age?: number
  gender?: string
  medicalHistory?: string[]

  // Optional overrides (compose user selections take priority)
  localPattern?: string
  systemicPattern?: string
  tightness?: number
  tenderness?: number
  spasm?: number
  // ...other fields
}

interface NormalizeOutput {
  context: GenerationContext
  initialState: TXSequenceOptions['initialState']
}

export function normalizeGenerationContext(input: NormalizeInput): NormalizeOutput
```

### Pattern 3: Content-Level Parity Comparison
**What:** Compare S/O/A/P sections independently, normalizing whitespace, to detect structural differences while ignoring formatting.
**When to use:** Parity tests between batch and compose output.

```typescript
function normalizeSOAPText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')  // trailing whitespace
    .replace(/\n{3,}/g, '\n\n')  // collapse multiple blank lines
    .trim()
}
```

### Anti-Patterns to Avoid
- **Mutating GenerationContext after construction:** The normalizer must return a new object; callers must not modify it afterward.
- **Adding rng() calls to tx-sequence-engine.ts:** Any new call shifts the entire PRNG sequence and breaks all 30 fixtures. This is explicitly deferred to Phase 13-14.
- **Testing against string literals:** Use Vitest snapshots, not hardcoded expected strings — SOAP output is too large and complex for inline assertions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot management | Custom JSON fixture files with manual comparison | Vitest `toMatchSnapshot()` | Auto-updates, diff display, CI-friendly |
| PRNG | Custom random function | Existing `mulberry32` via `createSeededRng` | Already battle-tested in the engine |
| Text normalization for comparison | Regex-heavy custom normalizer | Simple whitespace normalizer + section splitter | Only whitespace/blank-line differences are allowed per user decision |

**Key insight:** The engine is already deterministic. The only non-determinism comes from `Math.random()` in `batch-generator.ts` seed generation (`Math.floor(Math.random() * 100000)`). Fixtures bypass this by providing explicit seeds.

## Common Pitfalls

### Pitfall 1: Whitelist Not Initialized in Tests
**What goes wrong:** `exportSOAPAsText` calls `getTemplateOptionsForField` which returns empty arrays if whitelist isn't loaded, producing empty/broken SOAP output.
**Why it happens:** Server-side tests use `template-rule-whitelist.ts` (reads filesystem), but fixture tests in `src/generator/` may not have access to template files.
**How to avoid:** Use `setWhitelist(whitelistData)` in `beforeAll`, importing from `frontend/src/data/whitelist.json` (pre-built JSON). This is the established pattern in `engine.test.ts`.
**Warning signs:** Empty strings in generated SOAP sections, or "No options for field" errors.

### Pitfall 2: PRNG Sequence Sensitivity
**What goes wrong:** Adding, removing, or reordering ANY `rng()` call in `tx-sequence-engine.ts` shifts the entire output sequence for all subsequent visits.
**Why it happens:** `mulberry32` is a sequential PRNG — each call advances the internal state.
**How to avoid:** Fixtures capture the CURRENT engine output. Phase 12 must NOT modify the engine. Phases 13-14 will intentionally break fixtures and re-capture.
**Warning signs:** Multiple fixture failures after a seemingly small change.

### Pitfall 3: Compose vs Batch initialState Divergence
**What goes wrong:** Compose path omits `tightness`, `tenderness`, `spasm` from `initialState`, causing `tx-sequence-engine.ts` to fall back to pain-derived defaults (lines 653-655). Batch path hardcodes `painCurrent >= 7 ? 3 : 2`. These produce DIFFERENT values for pain levels 5-6 (compose derives from `severityToInit` map, batch uses threshold).
**Why it happens:** The two paths were developed independently.
**How to avoid:** `normalizeGenerationContext()` must compute `tightness/tenderness/spasm` using a single canonical formula, then both paths use it.
**Warning signs:** Parity test shows different Objective section content for same patient data.

### Pitfall 4: TCM Pattern Inference Asymmetry
**What goes wrong:** Batch calls `inferLocalPatterns()` + `inferSystemicPatterns()` to derive TCM patterns from clinical data. Compose uses whatever the user selected in the form (which may differ from inference).
**Why it happens:** Compose is interactive (user picks patterns), batch is automated (patterns inferred).
**How to avoid:** `normalizeGenerationContext()` runs inference as default, but allows explicit overrides. Compose passes user selections as overrides; batch passes nothing (uses inference). For parity testing, both paths must use the same input — either both infer or both use explicit values.
**Warning signs:** Different Assessment section TCM diagnosis text.

### Pitfall 5: Snapshot File Location
**What goes wrong:** Vitest stores snapshots in `__snapshots__/` relative to the test file. If the test file moves, snapshots are orphaned.
**Why it happens:** Vitest convention.
**How to avoid:** Place fixture test in `src/generator/__fixtures__/` and commit the `__snapshots__/` directory. The phase description explicitly requires this location.
**Warning signs:** `vitest --update` creates new snapshot files instead of updating existing ones.

## Code Examples

### Fixture Test Structure (30 snapshots)
```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { exportSOAPAsText, exportTXSeriesAsText } from '../soap-generator'
import { setWhitelist } from '../../parser/template-rule-whitelist'
import whitelistData from '../../../frontend/src/data/whitelist.json'

beforeAll(() => { setWhitelist(whitelistData) })

// Each fixture: fixed context + fixed seed → deterministic output
const FIXTURES = [
  { name: 'LBP-bilateral-early-3tx', bodyPart: 'LBP', laterality: 'bilateral', txCount: 3, seed: 100001, pain: 8 },
  { name: 'SHOULDER-left-mid-10tx', bodyPart: 'SHOULDER', laterality: 'left', txCount: 10, seed: 100002, pain: 7 },
  // ... 28 more
] as const

describe('Fixture Snapshots', () => {
  for (const fx of FIXTURES) {
    it(`snapshot: ${fx.name}`, () => {
      const context = makeContext({ primaryBodyPart: fx.bodyPart, laterality: fx.laterality, painCurrent: fx.pain })
      const results = exportTXSeriesAsText(context, { txCount: fx.txCount, seed: fx.seed })
      const output = results.map(r => r.text).join('\n---VISIT---\n')
      expect(output).toMatchSnapshot()
    })
  }
})
```

### normalizeGenerationContext() Core Logic
```typescript
import { inferLocalPatterns, inferSystemicPatterns, inferCondition } from '../../knowledge/medical-history-engine'

export function normalizeGenerationContext(input: NormalizeInput): NormalizeOutput {
  // TCM inference (overridable)
  const localPattern = input.localPattern ?? inferLocalPatterns(
    input.painTypes ?? ['Dull', 'Aching'],
    [input.associatedSymptom ?? 'soreness'],
    input.primaryBodyPart,
    input.chronicityLevel ?? 'Chronic'
  )[0]?.pattern ?? 'Qi Stagnation'

  const systemicPattern = input.systemicPattern ?? inferSystemicPatterns(
    input.medicalHistory ?? [],
    input.age
  )[0]?.pattern ?? 'Kidney Yang Deficiency'

  // Canonical initialState computation
  const painCurrent = input.painCurrent ?? 8
  const initSeverity = severityFromPain(painCurrent)
  const severityToInit = { 'severe': 4, 'moderate to severe': 3.5, 'moderate': 3, 'mild to moderate': 2, 'mild': 1 }
  const initObjLevel = severityToInit[initSeverity] ?? 3

  const initialState = {
    pain: painCurrent,
    tightness: input.tightness ?? Math.round(initObjLevel),
    tenderness: input.tenderness ?? Math.round(initObjLevel),
    spasm: input.spasm ?? Math.round(initObjLevel),
    frequency: input.frequency ?? 3,
    associatedSymptom: input.associatedSymptom ?? 'soreness',
    symptomScale: input.symptomScale ?? '70%',
    painTypes: input.painTypes ?? ['Dull', 'Aching'],
  }

  // ... build full GenerationContext
  return { context, initialState }
}
```

### Parity Diff Test
```typescript
it('batch and compose produce identical output for same input', () => {
  const input = { /* canonical patient data */ }
  const seed = 999999

  // Path A: batch-style
  const batchCtx = buildContext(patient, visit)  // current batch path
  const batchResults = exportTXSeriesAsText(batchCtx, { txCount: 5, seed })

  // Path B: compose-style (via normalizer)
  const { context, initialState } = normalizeGenerationContext(input)
  const composeResults = exportTXSeriesAsText(context, { txCount: 5, seed, initialState })

  // Content-level comparison
  for (let i = 0; i < batchResults.length; i++) {
    expect(normalizeSOAPText(composeResults[i].text)).toBe(normalizeSOAPText(batchResults[i].text))
  }
})
```

## Identified Parity Gaps

Concrete differences between compose (`useSOAPGeneration.ts`) and batch (`batch-generator.ts`):

| Field | Compose | Batch | Impact |
|-------|---------|-------|--------|
| `initialState.tightness` | **MISSING** (engine defaults from pain) | `painCurrent >= 7 ? 3 : 2` | Different tightness grading in early visits |
| `initialState.tenderness` | **MISSING** (engine defaults from pain) | `painCurrent >= 7 ? 3 : 2` | Different tenderness grading in early visits |
| `initialState.spasm` | **MISSING** (engine defaults from pain) | `painCurrent >= 7 ? 3 : 2` | Different spasm grading in early visits |
| `localPattern` | User form selection | `inferLocalPatterns()` result | Different Assessment TCM diagnosis |
| `systemicPattern` | User form selection | `inferSystemicPatterns()` result | Different Assessment TCM diagnosis |
| `baselineCondition` | Not set | Not set (both rely on engine inference) | ✅ No gap |
| `medicalHistory` | From form `medicalHistory` ref | From `visit.history` | Same source, different plumbing |
| `hasPacemaker` | `medicalHistory.includes('Pacemaker')` | `history.includes('Pacemaker')` | ✅ Same logic |
| `hasMetalImplant` | `medicalHistory.includes('Joint Replacement')` | `history.includes('Metal Implant') \|\| history.includes('Joint Replacement')` | Compose misses 'Metal Implant' check |

## Fixture Distribution Recommendation

30 fixtures across 7 supported TX body parts, 3 visit phases, and edge cases:

| # | Body Part | Laterality | Pain | TX Count | Phase | Edge Case |
|---|-----------|-----------|------|----------|-------|-----------|
| 1-3 | LBP | bilateral | 8 | 3, 10, 20 | early/mid/late | — |
| 4-6 | SHOULDER | left | 7 | 3, 12, 20 | early/mid/late | — |
| 7-9 | KNEE | right | 9 | 3, 10, 18 | early/mid/late | — |
| 10-12 | NECK | bilateral | 6 | 3, 8, 20 | early/mid/late | — |
| 13-15 | ELBOW | left | 5 | 3, 10, 20 | early/mid/late | — |
| 16-18 | HIP | right | 8 | 3, 12, 18 | early/mid/late | — |
| 19-21 | MID_LOW_BACK | bilateral | 7 | 3, 10, 20 | early/mid/late | — |
| 22 | LBP | bilateral | 10 | 12 | full | Max pain |
| 23 | SHOULDER | bilateral | 3 | 12 | full | Min pain |
| 24 | KNEE | bilateral | 8 | 1 | single | First visit only |
| 25 | LBP | left | 8 | 20 | late | Unilateral LBP |
| 26 | SHOULDER | right | 9 | 20 | late | High pain + long course |
| 27 | NECK | bilateral | 8 | 12 | mid | With Pacemaker |
| 28 | LBP | bilateral | 7 | 12 | mid | With medical history (DM, HTN) |
| 29 | KNEE | left | 8 | 12 | mid | Realistic patch ON |
| 30 | MID_LOW_BACK | bilateral | 6 | 12 | mid | MIDDLE_BACK (TX-only body part) |

Each fixture uses a unique deterministic seed (e.g., 100001-100030).

## Open Questions

1. **Whitelist loading in `src/generator/__fixtures__/` tests**
   - What we know: `engine.test.ts` (in `frontend/src/`) imports `whitelistData` from `frontend/src/data/whitelist.json` and calls `setWhitelist()`. The server-side `template-rule-whitelist.ts` reads from filesystem.
   - What's unclear: Whether `src/generator/__fixtures__/` tests should use the browser path (`setWhitelist` + JSON) or the server path (filesystem). The `vitest.config.ts` at root level has no special alias configuration.
   - Recommendation: Use `setWhitelist()` + JSON import (browser path) — it's simpler, doesn't depend on template file paths, and is the established test pattern. **HIGH confidence** this works.

2. **MIDDLE_BACK support scope**
   - What we know: `MIDDLE_BACK` is in `SUPPORTED_TX_BODY_PARTS` but NOT in `SUPPORTED_IE_BODY_PARTS`. It's also not in `MUSCLE_MAP` in `tx-sequence-engine.ts`.
   - What's unclear: Whether MIDDLE_BACK TX generation works correctly without a MUSCLE_MAP entry.
   - Recommendation: Include one MIDDLE_BACK fixture (#30) to verify. If it fails, document in audit report. **MEDIUM confidence.**

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `tx-sequence-engine.ts` (1,216 LOC), `soap-generator.ts` (2,280 LOC), `batch-generator.ts` (378 LOC), `useSOAPGeneration.ts` (279 LOC)
- `engine.test.ts` — established test patterns with `setWhitelist()` + fixed seed
- `GenerationContext` interface in `src/types/index.ts` (lines 250-315)
- `TXSequenceOptions` interface in `tx-sequence-engine.ts` (lines 200-224)

### Secondary (MEDIUM confidence)
- Vitest 4.x snapshot testing — `toMatchSnapshot()` is stable API, verified by project's existing `vitest` dependency

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all tools already in project
- Architecture: HIGH — parity gaps precisely identified with line-level evidence, normalizer pattern is straightforward adapter
- Pitfalls: HIGH — PRNG sensitivity documented in STATE.md, whitelist requirement proven by existing tests
- Fixture distribution: MEDIUM — body part coverage is comprehensive but MIDDLE_BACK edge case needs validation

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, no external dependency changes expected)
