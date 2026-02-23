---
status: complete
phase: 11-form-ux-validation
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md]
started: 2026-02-23T02:10:00Z
updated: 2026-02-23T02:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Name and DOB are separate fields
expected: Form Row 1 shows "Name" and "DOB" as two separate input fields (not a single "Patient" field). Name placeholder says "LAST,FIRST", DOB placeholder says "MM/DD/YYYY".
result: pass

### 2. DOB auto-format on blur
expected: Type "01152000" in DOB field, click/tab away. Value should auto-format to "01/15/2000". Also try "01-15-00" — should become "01/15/2000".
result: pass

### 3. Gender segmented control
expected: Gender shows as M / F toggle buttons (not a dropdown). Clicking M or F highlights it with dark background (ink-800). No gender pre-selected on a new patient.
result: pass

### 4. Side segmented control
expected: Side shows as Left / Bil / Right toggle buttons (not a dropdown). Clicking highlights selection. No side pre-selected on a new patient.
result: pass

### 5. Single-row compact layout
expected: At desktop/tablet width, all 6 fields (Name, DOB, Gender, Insurance, BodyPart, Side) fit on one row without wrapping.
result: pass

### 6. Name validation on blur
expected: Leave Name empty, click/tab away. Red border appears on Name field with "Name is required" error text below it.
result: pass

### 7. DOB validation on blur
expected: Type "abc" in DOB, click/tab away. Red border appears with format hint showing supported formats (MM/DD/YYYY, MM-DD-YYYY, MMDDYYYY, MM/DD/YY).
result: pass

### 8. Submit blocked with errors
expected: Leave required fields empty and click Submit. Form does NOT submit. Error indicators appear on missing fields. If errors are on a different patient tab, view switches to that patient.
result: pass

### 9. Errors clear on input
expected: After seeing a validation error (e.g., Name required), type a name. The red border and error text disappear immediately as you type.
result: pass

### 10. Submit sends correct format
expected: Fill Name="DOE,JOHN", DOB="01/15/2000", select Gender, Insurance, BodyPart, Side. Submit. Check network request — patient field should be "DOE,JOHN(01/15/2000)".
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
