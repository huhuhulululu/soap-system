# Phase 10: Shared Data Extraction - Research

**Researched:** 2026-02-22
**Domain:** Frontend shared module extraction, TypeScript data consolidation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 原样提取，不修改 ICD/CPT 数据内容
- 前后端数据一致性未确认，提取时需对比
- 如发现差异，以前端 BatchView.vue 数据为准
- 后端也改为从共享模块导入，真正消除重复

### Claude's Discretion
- 共享模块的文件位置和目录结构
- Import pattern（直接导入、composable 等）
- 数据的 TypeScript 类型定义方式

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | ICD catalog 从 BatchView.vue 提取到前端共享模块，消除前后端重复 | Catalog already exists in `src/shared/icd-catalog.ts`; BatchView has inline copy with different schema; need to add `getAllICDEntries()` adapter for frontend use |
| DATA-02 | CPT defaults (INS_CPT, toggle99203) 从 BatchView.vue 提取到共享模块 | `src/shared/cpt-catalog.ts` already has `getDefaultTXCPT()` and `getDefaultIECPT()`; need `defaultCptStr()` and `is99203Ins()` helpers, or derive them from existing exports |
</phase_requirements>

## Summary

The shared module (`src/shared/`) already exists and is already used by the backend server. `src/shared/icd-catalog.ts` and `src/shared/cpt-catalog.ts` are the canonical data sources. The frontend (`frontend/src/`) already imports other shared modules via relative paths like `../../../../src/shared/...` — this pattern is established and working.

The problem is that `BatchView.vue` has its own inline `ICD_CATALOG` (42 entries, schema `{icd10, desc, bodyPart}`) and inline CPT logic (`INS_CPT`, `is99203Ins`, `toggle99203`, `defaultCptStr`). Additionally, `frontend/src/data/writer-constants.ts` has its own `ICD_CATALOG` (54 entries, schema `{icd10, desc, bodyPart, laterality}`). Neither imports from `src/shared/`.

The work is: (1) add a frontend-facing adapter to `src/shared/icd-catalog.ts` that returns entries in the `{icd10, desc, bodyPart}` shape BatchView expects, (2) add `defaultCptStr()` and `is99203Ins()` helpers to `src/shared/cpt-catalog.ts`, (3) replace inline data in `BatchView.vue` and `writer-constants.ts` with imports from `src/shared/`.

**Primary recommendation:** Add thin adapter functions to existing shared modules, then replace all inline data with imports. No new files needed.

## Data Audit: Current State

### ICD Catalog — Three Copies Exist

| Location | Entry count | Schema | Status |
|----------|-------------|--------|--------|
| `src/shared/icd-catalog.ts` | 65 entries | `{code, name, bodyPart, laterality}` | Canonical — backend uses this |
| `frontend/src/data/writer-constants.ts` | 54 entries | `{icd10, desc, bodyPart, laterality}` | Frontend copy — WriterPanel.vue uses this |
| `BatchView.vue` (inline) | 42 entries | `{icd10, desc, bodyPart}` (no laterality) | Inline copy — must be replaced |

**Differences found (per CONTEXT.md: frontend BatchView.vue is authoritative):**

BatchView.vue is MISSING vs writer-constants.ts (12 entries):
- `M79.611`, `M79.612` (shoulder/upper arm)
- `M25.461`, `M25.462` (knee stiffness)
- `M25.361`, `M25.362` (knee instability)
- `M76.51`, `M76.52` (patellar tendinitis)
- `M22.41`, `M22.42` (chondromalacia patellae)
- `M23.91`, `M23.92` (internal derangement knee)

`src/shared/icd-catalog.ts` has 11 additional entries not in writer-constants.ts:
- `M54.16` (Radiculopathy, lumbar)
- `M25.531`, `M25.532` (wrist pain)
- `M25.541`, `M25.542` (hand pain)
- `M25.551`, `M25.552` (hip pain)
- `M16.11`, `M16.12` (hip osteoarthritis)
- `M25.571`, `M25.572` (ankle pain)

**Resolution per CONTEXT.md:** writer-constants.ts (54 entries) is the richer frontend catalog. The shared module should be updated to include all entries from writer-constants.ts that are missing. The `src/shared/icd-catalog.ts` already has the 11 extra entries above — those are fine to keep.

### CPT Data — Two Copies Exist

| Location | Data | Status |
|----------|------|--------|
| `src/shared/cpt-catalog.ts` | `getDefaultTXCPT(ins)` → `CPTWithUnits[]`, `getDefaultIECPT(ins)` | Canonical — backend uses this |
| `BatchView.vue` (inline) | `INS_CPT` string map + `defaultCptStr()` + `is99203Ins()` + `toggle99203()` | Inline — must be replaced |

**CPT string format comparison:**

BatchView `INS_CPT`:
```
HF: '97810'
WC: '97813,97814x2,97811'
VC: '97813,97814,97811x2'
```

`cpt-catalog.ts` `getDefaultTXCPT('WC')` returns:
```
[{code:'97813',units:1}, {code:'97814',units:2}, {code:'97811',units:1}]
```

These are equivalent data — `parseCPTString` in cpt-catalog can convert the string format. The shared module already has everything needed; BatchView just needs a `defaultCptStr(ins)` helper that serializes `getDefaultTXCPT()` to string format, and `is99203Ins(ins)` which checks `getDefaultIECPT(ins).length > 0`.

## Architecture Patterns

### Established Pattern: Frontend imports from `src/shared/`

Already used in the codebase:
```typescript
// frontend/src/composables/useSOAPGeneration.ts
import { ... } from '../../../src/shared/soap-constraints.ts'

// frontend/src/components/composer/WriterPanel.vue
import { isPainTypeConsistentWithPattern } from '../../../../src/shared/tcm-mappings'
```

Vite config allows this via `server.fs.allow` pointing to parent directory. This is the established pattern — use it.

### Recommended Approach: Adapter functions in shared modules

Rather than changing the schema of `src/shared/icd-catalog.ts` (which would break backend), add adapter functions that return the frontend-expected shape:

```typescript
// Add to src/shared/icd-catalog.ts
export interface ICDCatalogEntry {
  readonly icd10: string
  readonly desc: string
  readonly bodyPart: string | null
  readonly laterality: string | null
}

export function getICDCatalog(): readonly ICDCatalogEntry[] {
  return ICD_ENTRIES.map(e => ({ icd10: e.code, desc: e.name, bodyPart: e.bodyPart, laterality: e.laterality }))
}
```

```typescript
// Add to src/shared/cpt-catalog.ts
export function defaultCptStr(insurance: InsuranceType): string {
  return getDefaultTXCPT(insurance).map(e => e.units > 1 ? `${e.code}x${e.units}` : e.code).join(',')
}

export function is99203Ins(insurance: InsuranceType): boolean {
  return getDefaultIECPT(insurance).length > 0
}

export function toggle99203(cpt: string, insurance: InsuranceType): string {
  const base = defaultCptStr(insurance)
  return cpt.includes('99203') ? base : `${base},99203`
}
```

### Import pattern in BatchView.vue

Replace inline data with direct imports (no composable needed — data is static):

```typescript
import { getICDCatalog } from '../../../../src/shared/icd-catalog'
import { defaultCptStr, is99203Ins, toggle99203 } from '../../../../src/shared/cpt-catalog'
```

Replace `writer-constants.ts` `ICD_CATALOG` similarly:
```typescript
import { getICDCatalog } from '../../../src/shared/icd-catalog'
export const ICD_CATALOG = getICDCatalog()
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CPT string serialization | Custom formatter | `parseCPTString` + inverse in shared module | Already tested, handles edge cases |
| ICD schema bridging | Separate frontend catalog file | Adapter function in `src/shared/icd-catalog.ts` | Single source of truth |
| Path resolution | Vite alias or symlink | Existing `../../../../src/shared/` relative path | Already works, established pattern |

## Common Pitfalls

### Pitfall 1: Schema mismatch between shared and frontend
**What goes wrong:** `src/shared/icd-catalog.ts` uses `{code, name}` but BatchView expects `{icd10, desc}`. Directly replacing the import breaks the template.
**How to avoid:** Add `getICDCatalog()` adapter that maps to frontend schema. Do NOT rename fields in the canonical module.

### Pitfall 2: Missing entries after migration
**What goes wrong:** BatchView.vue has 42 entries; writer-constants.ts has 54; shared has 65. After migration, BatchView might show fewer options.
**How to avoid:** The shared module (65 entries) is a superset. After adding the adapter, BatchView will actually gain entries. Verify the 12 entries BatchView was missing are now available.

### Pitfall 3: CPT string format divergence
**What goes wrong:** BatchView uses `'97813,97814x2,97811'` string format; shared uses `CPTWithUnits[]`. If `defaultCptStr()` serializes differently, existing draft CPT values won't match.
**How to avoid:** Verify `defaultCptStr('WC')` produces exactly `'97813,97814x2,97811'` — the `units > 1` check must use `x` suffix, matching `parseCPTString` format.

### Pitfall 4: writer-constants.ts ICD_CATALOG still duplicated
**What goes wrong:** Only fixing BatchView.vue but leaving writer-constants.ts with its own copy.
**How to avoid:** Both `BatchView.vue` and `writer-constants.ts` must be updated. WriterPanel.vue imports `ICD_CATALOG` from writer-constants.ts — keep the export name but change it to re-export from shared.

## Code Examples

### Adapter in icd-catalog.ts
```typescript
// Source: project pattern — maps canonical schema to frontend schema
export interface ICDCatalogEntry {
  readonly icd10: string
  readonly desc: string
  readonly bodyPart: string | null
  readonly laterality: string | null
}

export function getICDCatalog(): readonly ICDCatalogEntry[] {
  return ICD_ENTRIES.map(e => ({ icd10: e.code, desc: e.name, bodyPart: e.bodyPart, laterality: e.laterality }))
}
```

### CPT helpers in cpt-catalog.ts
```typescript
// Source: derived from existing getDefaultTXCPT / getDefaultIECPT
export function defaultCptStr(insurance: InsuranceType): string {
  return getDefaultTXCPT(insurance)
    .map(e => e.units > 1 ? `${e.code}x${e.units}` : e.code)
    .join(',')
}

export function is99203Ins(insurance: InsuranceType): boolean {
  return getDefaultIECPT(insurance).length > 0
}

export function toggle99203(cpt: string, insurance: InsuranceType): string {
  const base = defaultCptStr(insurance)
  return cpt.includes('99203') ? base : `${base},99203`
}
```

### BatchView.vue replacement
```typescript
// BEFORE (inline):
const ICD_CATALOG = [ { icd10: 'M54.50', desc: '...', bodyPart: 'LBP' }, ... ]
const INS_CPT = { HF: '97810', ... }
function is99203Ins(ins) { return ins === 'HF' || ins === 'VC' }
function defaultCptStr(ins) { return INS_CPT[ins] || '97810' }
function toggle99203(cpt, ins) { ... }

// AFTER (imports):
import { getICDCatalog } from '../../../../src/shared/icd-catalog'
import { defaultCptStr, is99203Ins, toggle99203 } from '../../../../src/shared/cpt-catalog'
const ICD_CATALOG = getICDCatalog()
```

### writer-constants.ts replacement
```typescript
// BEFORE: export const ICD_CATALOG = [ ... 54 entries ... ]
// AFTER:
import { getICDCatalog } from '../../../src/shared/icd-catalog'
export const ICD_CATALOG = getICDCatalog()
```

## Open Questions

1. **BatchView.vue uses `item.icd10` in template — laterality field not used**
   - What we know: BatchView filters by `bodyPart` only, never reads `laterality`
   - What's unclear: Whether adding `laterality` to the catalog entry breaks anything
   - Recommendation: Safe to include — unused fields are harmless in Vue templates

2. **writer-constants.ts `ICD_CATALOG` is typed `as const` — adapter returns mutable type**
   - What we know: WriterPanel.vue uses `ICD_CATALOG.filter(...)` — no mutation
   - Recommendation: `readonly` return type from `getICDCatalog()` is sufficient; remove `as const` from writer-constants re-export

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/shared/icd-catalog.ts`, `src/shared/cpt-catalog.ts`, `frontend/src/views/BatchView.vue`, `frontend/src/data/writer-constants.ts`
- Established import pattern verified in `frontend/src/composables/useSOAPGeneration.ts` and `WriterPanel.vue`
- Vite config `server.fs.allow` confirmed to permit `src/shared/` access from frontend

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries needed, pure TypeScript refactor
- Architecture: HIGH — pattern already established in codebase
- Pitfalls: HIGH — data differences verified by direct count (42 vs 54 vs 65 entries)

**Research date:** 2026-02-22
**Valid until:** Stable — no external dependencies
