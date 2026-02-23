---
phase: 11-form-ux-validation
plan: "02"
subsystem: ui
tags: [vue, form, validation, inline-errors]

requires:
  - phase: 11-form-ux-validation
    plan: "01"
    provides: name/dob split fields, segmented controls, normalizeDOB

provides:
  - fieldErrors reactive state per draft index
  - validateField blur-triggered per-field validation
  - validateAll submit guard with first-error navigation
  - Inline red border + error text on all required fields

affects: [batch-submit]

tech-stack:
  added: []
  patterns:
    - "fieldErrors: { [draftIndex]: { field?: errorMsg } } — immutable updates"
    - "validateAll returns false and switches activeIndex to first errored draft"
    - "clearFieldError called from updateField to clear on user input"

key-files:
  created: []
  modified:
    - frontend/src/views/BatchView.vue

key-decisions:
  - "ICD validation only in full mode — soap-only and continue modes skip ICD check"
  - "clearFieldError wired into updateField so all field changes auto-clear their error"
  - "handleDobBlur calls validateField after normalization so DOB error shows on blur"

requirements-completed: [VAL-01]

duration: 2min
completed: 2026-02-23
---

# Phase 11 Plan 02: Inline Validation Summary

**Blur-triggered per-field validation and submit guard with inline red border + error text on all required fields**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T00:53:46Z
- **Completed:** 2026-02-23T00:55:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `fieldErrors` ref tracks errors per draft index; `activeErrors` computed exposes current draft errors
- `validateField(key, value)` runs on blur for name and dob; gender/side/insurance/bodyPart clear on selection via `updateField`
- `validateAll()` validates all drafts on submit, collects errors, switches view to first errored draft
- `submitDrafts` guarded with `if (!validateAll()) return` as first line
- Red border (`:class` conditional `border-red-400`) and `text-xs text-red-500` error span on all 7 fields
- ICD error only shown when mode is `full`

## Task Commits

1. **Task 1: Add validation logic and inline error display** - `9358850` (feat)

## Files Created/Modified
- `frontend/src/views/BatchView.vue` - fieldErrors, activeErrors, validateField, clearFieldError, validateAll, submitDrafts guard, updateField clearFieldError call, template error display on all required fields

## Decisions Made
- ICD validation only in full mode — soap-only and continue modes skip ICD check
- clearFieldError wired into updateField so all field changes auto-clear their error
- handleDobBlur calls validateField after normalization so DOB error shows on blur

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None

## Next Phase Readiness
- All required fields validated on blur and submit
- Visual feedback complete: red border + error text below each field
- Ready for browser verification
