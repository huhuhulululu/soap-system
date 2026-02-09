# SOAP System V2 Final Specification

## 1. Goal
Build a SOAP system that:
1. Strictly generates SOAP notes based on the template source.
2. Validates provided notes, reports errors, and returns section-level repair suggestions.

## 2. Source Of Truth
1. Official template source: `/Users/ping/Desktop/Code/2_8/templete`
2. Allowed field set: only fields derived from templates.
3. Out-of-template fields are not part of V2 scope.

## 3. Users
1. Multi-role usage is supported.
2. Primary role is doctor.
3. Role-based permission differentiation is out of scope for V2.

## 4. In-Scope Note Types
1. `IE` and `TX` only.
2. `IE` and `TX` must both produce full `S/O/A/P` output.
3. `TX` Objective (`O`) must inherit from the corresponding body-part `IE` Objective template.

## 5. Output Requirements
1. Output format is plain readable text.
2. HTML tags from templates must be removed in generated output.
3. SOAP section structure must be explicit and fixed: `Subjective`, `Objective`, `Assessment`, `Plan`.
4. Template fidelity is strict, but template spelling mistakes may be standardized/corrected.

## 6. Clinical Logic Requirements
1. System must follow template structure and defined logic relations.
2. Rule conflicts are treated as invalid design and should be eliminated.
3. Different patients should produce different results based on weighted factors (age, condition, occupation, lifestyle, etc.).
4. For identical input, small output variation is acceptable.
5. Across sequential notes of the same patient, clinical consistency must be maintained.

## 7. Insurance Requirements
1. Valid insurance set excludes `AETNA`.
2. Insurance violations are `ERROR` and must block pass.

## 8. Validation Requirements
1. Default validation severity level: `ERROR` only.
2. Validation response format:
   1. Error field or sentence
   2. Reason
   3. Repaired full section (`S`/`O`/`A`/`P`)
3. Repair output should preserve user writing style whenever possible while correcting incorrect content.

## 9. Data Model Requirements
1. Required fields are strict.
2. Missing required template-derived fields must fail.
3. No partial-input fallback defaults for required fields.

## 10. Testing Strategy
1. Keep existing tests and fix incrementally.
2. Priority is to align tests with template-driven behavior.

## 11. Migration Strategy
1. Migration mode: phased.
2. Phase 1 priority: stabilize generators for template-aligned output.
3. V2 freeze deadline: `2026-02-08`.

## 12. Acceptance Criteria
1. System can generate correct `IE` and `TX` notes per strict template source.
2. Manual review is the final acceptance method.

## 13. Open Non-Blocking Items
1. Top 3 current pain points (TBD)
2. Minimum quality gate details (TBD)
3. Performance target (TBD)
4. Auditability depth (TBD)
5. Privacy/compliance constraints (TBD)
6. Downstream consumption targets (TBD)
7. Backward-compatibility boundaries (TBD)
