# SOAP System Requirements V2 (Interview Draft)

## How To Use
1. Read each question in order.
2. Fill `Answer:` under each question.
3. If unknown, write `TBD`.
4. After all answers are filled, this file will be converted into the final requirements spec.

## 1. Product Goal
Question: What is the single most important business goal of this system in the next 3 months?
Answer: Strictly generate SOAP output that matches the provided template, and validate user-provided notes to detect errors and provide correction guidance.

Question: Who is the primary user role for V2?
Answer: Multi-role users are supported, with doctors as the primary user.

Question: What are the top 3 pain points in the current version?
Answer:

## 2. Scope
Question: For V2, what must be included?
Answer: Human-readable text output for manual reading, with fixed SOAP structure (`S`/`O`/`A`/`P`) and section headers.

Question: For V2, what must be explicitly excluded?
Answer: Role-based permission differentiation is not required in V2.

Question: Should we keep both output modes (`structured SOAPNote` and `HTML template`), or keep only one?
Answer: Keep human-readable text output as required for manual reading.

## 3. Clinical Rules
Question: Which rule source is authoritative for V2 (`logic-rules.ts`, templates, or external document)?
Answer: Templates under `/Users/ping/Desktop/Code/2_8/templete` are the strict authoritative source.

Question: If rules conflict (insurance vs contraindication vs pattern), what is the priority order?
Answer: Conflicts should not exist. The system must strictly follow the template and defined clinical logic relationships.

Question: Do we need deterministic output (same input always same output)?
Answer: Output must vary based on patient-specific inputs (age, condition, occupation, lifestyle, and weighted logic). Different patients are expected to produce different SOAP results. For the exact same input, small output variation is acceptable. Across sequential notes for the same patient, SOAP should remain clinically consistent.

## 4. Data Model
Question: Which insurance types are valid in V2?
Answer: Existing supported insurance types except AETNA. AETNA is explicitly excluded.

Question: Do we need to officially support fields currently used in tests (for example `painScore`, `visitNumber`, `weather`, `changeFromLastVisit`)?
Answer: Only fields defined by the template are supported. No extra out-of-template fields are required.

Question: Should `GenerationContext` and `SOAPNote` be strict required fields, or allow partial input with defaults?
Answer: Strict required fields. Missing required template-derived fields must fail.

## 5. Generation Behavior
Question: Which note types are in scope (`IE`, `TX`, `RE`, `NEW_IE`)?
Answer: IE and TX are required in V2.

Question: Should TX include Objective section, or remain Subjective/Assessment/Plan focused?
Answer: TX must include the full SOAP structure (`S`/`O`/`A`/`P`). TX Objective (`O`) reuses the corresponding body-part IE Objective template structure and rules.

Question: Should generated text prioritize template fidelity or readability?
Answer: Prioritize strict template fidelity. Template typos/misspellings may be standardized/corrected.

## 6. Validation
Question: What validation level do we enforce by default (`hard fail`, `warn`, `info`)?
Answer: ERROR only.

Question: Should validator block outputs that violate insurance constraints?
Answer: Yes. Violations are `ERROR` and must block pass.

Question: Should validator auto-correct some fields, or only report issues?
Answer: Report issues and provide repaired full-section output (`S`/`O`/`A`/`P`) for correction. Preserve user writing style where possible.

## 7. Testing and Quality
Question: What is the minimum passing quality gate (for example all tests pass, typecheck pass, coverage target)?
Answer:

Question: Should old tests be preserved, rewritten, or replaced?
Answer: Preserve existing tests and fix them incrementally.

Question: What is the release acceptance checklist for V2?
Answer: The system can generate correct IE and TX notes according to the strict template source, and final acceptance is based on manual review.

## 8. Non-Functional Requirements
Question: Performance target per note generation (for example p95 under 100ms)?
Answer:

Question: Do we need auditability (why each option was selected)?
Answer:

Question: Any compliance or privacy requirements to enforce now?
Answer:

## 9. Migration Plan
Question: Do you want a phased migration or one-time refactor?
Answer: Phased migration.

Question: If phased, which module should be stabilized first (`types`, `rule-engine`, `generators`, `validator`)?
Answer: Generators first, with focus on stable template-aligned generation.

Question: What is the deadline for V2 freeze?
Answer: Today (2026-02-08).

## 10. Open Decisions
Question: Is there any existing document or template that should become the official source of truth?
Answer: `/Users/ping/Desktop/Code/2_8/templete` is the official source of truth.

Question: Which outputs are consumed downstream (EMR import, human editing, billing, analytics)?
Answer:

Question: Any hard backward-compatibility requirements?
Answer:

## 11. Execution Decisions (Confirmed)
Question: TX-to-IE Objective mapping policy?
Answer: TX `O` inherits from the corresponding IE `O` template by same body-part file mapping.

Question: Output carrier format?
Answer: Plain readable text output (HTML tags removed).

Question: Multi-select cardinality strategy?
Answer: Dynamic cardinality based on rule/weight logic.

Question: Final acceptance method?
Answer: Manual review.
