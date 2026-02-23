# Phase 15: Batch Form UX - Research

**Researched:** 2026-02-23
**Domain:** Frontend — BatchView.vue form layout and ICD interaction
**Confidence:** HIGH

## Summary

Phase 15 addresses three UX improvements to the batch form in `frontend/src/views/BatchView.vue` (1,754 LOC). All changes are frontend-only — no backend or engine modifications.

## Current Layout (Row 1 + Row 2)

```
Row 1: [Name 3col] [DOB 2col] [Gender 1col] [Insurance 2col] [BodyPart 2col] [Side 2col]
Row 2: [Visits 1col] [ICD 2col (chips above + search)] [CPT 2col] [Chronicity 1col]
Row 3: [Worst] [Best] [Current] [PainType] [AssocSymptom] [Radiation]
```

### UX-01: ICD-first selection with auto-fill

**Current:** ICD dropdown filters by `activeDraft.bodyPart` — user must select BodyPart first, then ICD.
**Target:** ICD selection comes first (no bodyPart filter initially). When user selects an ICD code, auto-fill BodyPart and Side from the catalog entry's `bodyPart`/`laterality` fields.

**Implementation:**
- Move ICD field to Row 1, before BodyPart/Side
- Remove bodyPart filter from `filteredIcdOptions` when bodyPart is empty
- In `selectIcd()`, auto-fill bodyPart and laterality from the selected ICD entry
- Keep bodyPart filter active when bodyPart is already set (user can still manually select bodyPart first)
- Map catalog laterality values: `'bilateral'` → `'B'`, `'left'` → `'L'`, `'right'` → `'R'`

### UX-02: Compact pain score fields

**Current:** Pain selects use `w-full` — they stretch to fill grid column (~150px+).
**Target:** ~60px width to match actual content (single/double digit numbers).

**Implementation:**
- Add `w-[60px]` to pain score `<select>` elements, remove `w-full`
- Keep label above at natural width

### UX-03: ICD chips on right side of form row

**Current:** Chips render in a `flex-wrap` div above the search input.
**Target:** Chips display to the right of the ICD search input, inline.

**Implementation:**
- Wrap ICD search + chips in a single flex row
- Search input on left (flex-1), chips on right
- Chips use `flex-shrink-0` to prevent wrapping

## Files Modified

| File | Change |
|------|--------|
| `frontend/src/views/BatchView.vue` | Form layout restructure + selectIcd auto-fill + pain width + chips position |

## Plan Structure

Single plan — all three changes are in the same template section and tightly coupled (moving ICD affects row layout which affects chips position).

