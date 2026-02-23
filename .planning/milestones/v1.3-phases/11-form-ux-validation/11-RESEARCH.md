# Phase 11: Form UX & Validation - Research

**Researched:** 2026-02-22
**Domain:** Vue 3 form UX — segmented controls, DOB parsing, inline validation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Name/DOB split:**
- Patient single field split into Name and DOB two independent inputs
- Name keeps `LAST,FIRST` single-field format, placeholder shows format
- DOB free input, supports MM/DD/YYYY, MM-DD-YYYY, MMDDYYYY, MM/DD/YY
- DOB auto-formats to MM/DD/YYYY on blur

**Toggle tag style:**
- Gender (M/F) and Side (L/R/Bil) changed to segmented control appearance
- Selected state: dark fill (ink-800 style, white text)
- Toggle has transition animation
- Gender and Side have NO default value — user must choose

**Form layout:**
- Single-row compact: Name + DOB + Gender + Insurance + BodyPart + Side on one line
- Narrow-screen responsive stacking (keep sm: breakpoint strategy)

**Validation and error feedback:**
- Validate single field on blur + full check on submit
- All required fields need frontend validation (Name, DOB, Gender, Side, Insurance, BodyPart, ICD in full mode)
- Specific error messages (e.g. DOB format error shows supported format list)

### Claude's Discretion
- Field width ratios (auto-allocated by content length)
- Overall compactness (gap, padding, font-size adjustments)
- Error display method (inline, tooltip, border, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | Name and DOB split into two independent inputs; DOB supports MM/DD/YYYY, MM-DD-YYYY, MMDDYYYY, MM/DD/YY auto-recognition | DOB normalization regex patterns documented below |
| UX-02 | Gender uses M/F toggle buttons replacing dropdown, selected state highlighted | Segmented control pattern already exists in BatchView (batchMode buttons) |
| UX-03 | Side uses L/B/R toggle buttons replacing dropdown, selected state highlighted | Same segmented control pattern as UX-02 |
| UX-04 | Form field sizes optimized by content proportion, compact layout with no wasted space | Tailwind grid col-span strategy documented below |
| VAL-01 | Frontend instant validation — patient format, required fields, ICD count limit, show error hints before submit | Vue 3 reactive validation pattern documented below |
</phase_requirements>

---

## Summary

Phase 11 is a pure frontend change to `BatchView.vue`. No new libraries are needed — the project already uses Vue 3 + Tailwind CSS 3 + Vite. The segmented control pattern already exists in the file (the `batchMode` and per-patient `mode` buttons at lines 783-784 and 839-840), so Gender/Side toggles are a direct copy of that pattern.

The critical data contract change is splitting the single `patient` field (`LAST,FIRST(MM/DD/YYYY)`) into two fields (`name` + `dob`) in the draft row object. The server's `ExcelRow` interface still uses `patient: string`, so the frontend must reassemble `NAME(MM/DD/YYYY)` before submitting. The `parsePatientNameDOB` function in `excel-parser.ts` (line 50-55) expects exactly `NAME(MM/DD/YYYY)` — this is the canonical format the backend requires.

Validation is purely frontend reactive state — no library needed. A `fieldErrors` ref object keyed by field name, populated on blur and cleared on input, is the minimal correct pattern for this use case.

**Primary recommendation:** Split draft row into `name`+`dob` fields, reassemble to `patient` string on submit; copy existing segmented control HTML for Gender/Side; add a `fieldErrors` reactive object for inline validation.

---

## Standard Stack

### Core (already in project — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vue 3 | ^3.4.0 | Reactivity, template | Already in use |
| Tailwind CSS | ^3.4.0 | Utility classes, design tokens | Already in use |
| Vite | ^5.0.0 | Build | Already in use |

**Installation:** None required.

---

## Architecture Patterns

### Pattern 1: Segmented Control (already in codebase)

The exact pattern to copy for Gender and Side already exists at BatchView.vue lines 783-784:

```html
<!-- Source: BatchView.vue line 783-784 (batchMode segmented control) -->
<div class="flex rounded-lg border border-ink-200 overflow-hidden text-xs">
  <button
    v-for="m in [{k:'M',l:'M'},{k:'F',l:'F'}]"
    :key="m.k"
    type="button"
    @click="updateField('gender', m.k)"
    class="px-3 py-1.5 font-medium transition-colors"
    :class="activeDraft.gender === m.k ? 'bg-ink-800 text-white' : 'bg-white text-ink-500 hover:bg-paper-100'"
  >{{ m.l }}</button>
</div>
```

For Side (L/B/R), same pattern with `[{k:'L',l:'L'},{k:'B',l:'B'},{k:'R',l:'R'}]`.

**No default value:** `EMPTY_ROW` must set `gender: ''` and `laterality: ''` (currently `'F'` and `'B'`).

### Pattern 2: DOB Normalization on Blur

Four input formats must normalize to `MM/DD/YYYY`:

```javascript
// Source: derived from CONTEXT.md locked decisions
function normalizeDOB(raw) {
  const s = raw.trim()
  // MMDDYYYY (8 digits)
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0,2)}/${s.slice(2,4)}/${s.slice(4)}`
  }
  // MM-DD-YYYY or MM-DD-YY
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/)
  if (dashMatch) {
    const [, m, d, y] = dashMatch
    const year = y.length === 2 ? `20${y}` : y
    return `${m.padStart(2,'0')}/${d.padStart(2,'0')}/${year}`
  }
  // MM/DD/YY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    return `${m.padStart(2,'0')}/${d.padStart(2,'0')}/20${y}`
  }
  // MM/DD/YYYY — already canonical, just pad
  const fullMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (fullMatch) {
    const [, m, d, y] = fullMatch
    return `${m.padStart(2,'0')}/${d.padStart(2,'0')}/${y}`
  }
  return s // return as-is if unrecognized (validation will catch it)
}
```

### Pattern 3: Draft Row Split + Submit Reassembly

The server `ExcelRow.patient` field expects `NAME(MM/DD/YYYY)` (parsed by `parsePatientNameDOB` at excel-parser.ts:50-55). The frontend draft must split this into two fields and reassemble on submit:

```javascript
// EMPTY_ROW change: split patient into name + dob
const EMPTY_ROW = () => ({
  name: '',   // replaces: patient: ''
  dob: '',    // new field
  gender: '', // was 'F' — no default per locked decision
  laterality: '', // was 'B' — no default per locked decision
  // ... rest unchanged
})

// patientLabel: use name field
function patientLabel(d, i) {
  return d.name || `Patient ${i + 1}`
}

// submitDrafts: reassemble patient string before POST
const rows = drafts.value.map(d => ({
  ...d,
  patient: `${d.name}(${d.dob})`,
}))
```

### Pattern 4: Inline Validation (reactive, no library)

```javascript
const fieldErrors = ref({}) // { [draftIndex]: { name?: string, dob?: string, ... } }

function validateField(key, value) {
  const errors = { ...(fieldErrors.value[activeIndex.value] || {}) }
  if (key === 'name') {
    errors.name = value.trim() ? undefined : 'Name is required'
  }
  if (key === 'dob') {
    const canonical = normalizeDOB(value)
    errors.dob = /^\d{2}\/\d{2}\/\d{4}$/.test(canonical)
      ? undefined
      : 'DOB format: MM/DD/YYYY, MM-DD-YYYY, MMDDYYYY, or MM/DD/YY'
  }
  if (key === 'gender') {
    errors.gender = value ? undefined : 'Select gender'
  }
  if (key === 'laterality') {
    errors.laterality = value ? undefined : 'Select side'
  }
  fieldErrors.value = { ...fieldErrors.value, [activeIndex.value]: errors }
}

function validateAll() {
  // called before submit — returns true if all valid
}
```

Error display: red border (`border-red-400`) + small error text below field. This is the minimal inline pattern consistent with existing field styling.

### Pattern 5: Compact Single-Row Layout

Current Row 1 is `grid-cols-2 sm:grid-cols-6`. With Name+DOB split, the row needs more columns. Recommended: `grid-cols-2 sm:grid-cols-12` with col-span allocation:

| Field | sm:col-span | Rationale |
|-------|-------------|-----------|
| Name | 3 | Longest content (LAST,FIRST) |
| DOB | 2 | Fixed 10-char MM/DD/YYYY |
| Gender | 1 | 2 options, narrow |
| Insurance | 2 | 6 options, medium |
| BodyPart | 2 | Many options, medium |
| Side | 2 | 3 options, narrow-medium |

Total: 12 columns. On mobile (col-span-2 base), fields stack naturally.

### Anti-Patterns to Avoid

- **Validating on every keystroke:** Causes jarring UX. Validate on blur only; clear error on input.
- **Mutating draft objects directly:** Project coding style requires immutability — always use `updateField()` which spreads.
- **Reassembling patient string in multiple places:** Only reassemble in `submitDrafts` and `patientLabel` (display only).
- **Adding a validation library:** Overkill for 6 fields with simple rules. Hand-rolling is appropriate here.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Segmented control | Custom component | Copy existing batchMode button pattern | Already proven, consistent styling |
| DOB parsing | Complex date library | Simple regex normalization | Only 4 formats, no timezone/locale complexity |

---

## Common Pitfalls

### Pitfall 1: localStorage Draft Compatibility
**What goes wrong:** Existing saved drafts in localStorage use `patient` field. After split, loading old drafts will have `patient` but no `name`/`dob`.
**Why it happens:** `loadDrafts()` reads raw JSON from localStorage.
**How to avoid:** In `loadDrafts`, migrate old drafts: if `d.patient && !d.name`, parse `patient` into `name`+`dob` using the same regex as the server.
**Warning signs:** `activeDraft.name` is undefined after page reload.

### Pitfall 2: patientSummary Still References Old Fields
**What goes wrong:** `patientSummary()` at line 207-211 uses `d.patient` for display.
**How to avoid:** Update `patientSummary` to use `d.name` instead of `d.patient`.

### Pitfall 3: Gender/Side Empty Default Breaks Existing Saved Drafts
**What goes wrong:** Old drafts have `gender: 'F'` and `laterality: 'B'`. These are valid values, so no migration needed — they will display as selected in the new toggle UI.
**How to avoid:** No action needed for existing drafts. Only new `EMPTY_ROW()` changes defaults to `''`.

### Pitfall 4: DOB Blur Normalization Overwrites Valid Partial Input
**What goes wrong:** If user is still typing and focus leaves field, partial input gets normalized to garbage.
**How to avoid:** Only normalize if the result passes the canonical regex. If normalization fails, leave the raw value and show error.

### Pitfall 5: ICD Validation Mode Condition
**What goes wrong:** ICD is only required in `full` mode (line 896: `activeDraft.mode || batchMode`). Validation must respect this.
**How to avoid:** In `validateAll`, check `(activeDraft.mode || batchMode.value) === 'full'` before requiring ICD.

---

## Code Examples

### DOB Blur Handler
```javascript
// Source: derived from locked decisions in CONTEXT.md
function handleDobBlur() {
  const normalized = normalizeDOB(activeDraft.value.dob)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) {
    updateField('dob', normalized)
  }
  validateField('dob', normalized)
}
```

### Submit Guard
```javascript
async function submitDrafts() {
  if (!validateAll()) return  // show errors, abort
  loading.value = true
  const rows = drafts.value.map(d => ({
    ...d,
    patient: `${d.name}(${d.dob})`,
  }))
  // ... existing fetch logic using rows instead of drafts.value
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `patient: 'LAST,FIRST(MM/DD/YYYY)'` single field | `name: 'LAST,FIRST'` + `dob: 'MM/DD/YYYY'` split fields | Cleaner UX, same server contract |
| `<select>` for Gender/Side | Segmented control buttons | Faster selection, fewer clicks |
| No frontend validation | Blur + submit validation | Catches errors before server round-trip |

---

## Open Questions

1. **patientLabel in patient bucket list (line 1088)**
   - What we know: Currently shows `d.patient || Patient N`
   - What's unclear: Should it show `LAST,FIRST` or `LAST,FIRST (DOB)`?
   - Recommendation: Show `d.name || Patient N` — DOB not needed in list label

2. **Excel upload path (inputMode === 'excel')**
   - What we know: Excel rows still use `patient` field (ExcelRow interface unchanged)
   - What's unclear: Does the editor-mode split affect Excel upload parsing?
   - Recommendation: No change needed — Excel upload bypasses the editor draft entirely; `buildPatientsFromRows` reads `row.patient` directly from parsed Excel

---

## Sources

### Primary (HIGH confidence)
- BatchView.vue (lines 783-784, 839-840) — existing segmented control pattern
- excel-parser.ts (lines 50-55) — `parsePatientNameDOB` regex contract
- server/types.ts (lines 49-59, 76-103) — `BatchPatient` and `ExcelRow` interfaces
- tailwind.config.js — ink color palette, design tokens

### Secondary (MEDIUM confidence)
- CONTEXT.md locked decisions — user-confirmed implementation choices

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing
- Architecture: HIGH — patterns verified directly in codebase
- Pitfalls: HIGH — identified from direct code reading (localStorage, patientSummary, mode condition)

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable codebase, no fast-moving dependencies)
