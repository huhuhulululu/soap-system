# Remove Swell Mentions From Generated Output Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent generated SOAP plain text from proactively emitting `swell`, `swollen`, or `swelling` wording while preserving existing HTML option pools and dropdown content exactly as-is.

**Architecture:** Keep template truth sources and HTML dropdown arrays unchanged. Implement a narrow plain-text render safeguard inside `src/generator/soap-generator.ts` so only text output is normalized. Follow strict TDD: one behavior per test, verify RED before every GREEN step, and do not implement any suppression path that lacks its own failing test.

**Tech Stack:** TypeScript, Jest, shared SOAP generator, Vue frontend consuming text output.

---

## Current Findings

- `reduced joint stiffness and swelling` can still be emitted as a TX `reason` in generated text.
- `joint swelling` is the default KNEE `Inspection` text and is rendered into plain text output.
- `with local swollen` is preserved in template radiation pools and can appear in plain text if selected or inherited.
- HTML output must retain swelling-related option strings because the requirement is to preserve template/HTML fidelity.
- Renderer-level suppression is preferable because `/composer`, `/continue`, and any other `exportSOAPAsText(...)` caller converge there.

## TDD Guardrails

- No production code until a targeted test fails for that exact behavior.
- One behavior per test. No combined “text suppression + HTML preservation” assertions in the same RED step.
- Verify the test fails for the expected reason before touching production code.
- Implement only enough code to satisfy the currently failing test.
- If a potential behavior lacks a failing test, it is out of scope for this change.

## Scope for This Change

### In scope

- Suppress plain-text emission of:
  - `reduced joint stiffness and swelling`
  - `joint swelling`
  - `with local swollen`
- Preserve all HTML option pools and template arrays unchanged.
- Cover direct writer output and continue-mode inherited text via renderer-level tests.

### Out of scope

- Removing swelling-related entries from `src/shared/template-options.ts`
- Removing options from `frontend/src/data/whitelist.json`
- Global sanitization of tongue-related `swollen` TCM wording
- Any TX engine monotonicity/progress rule changes
- Any parser acceptance changes for pre-existing notes containing swelling text

---

### Task 1: RED for plain-text reason suppression

**Files:**
- Create: `src/generator/__tests__/text-output-swell-suppression.test.ts`
- Modify: `src/generator/soap-generator.ts`

**Step 1: Write the failing test**

Add one focused test that checks only TX `reason` rendering in plain text:

```ts
import { exportSOAPAsText } from "../soap-generator";

test("plain text suppresses swelling reason wording", () => {
  const context: any = {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "KNEE",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    painWorst: 9,
    painBest: 3,
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    painRadiation: "without radiation",
    painFrequency: "Constant (symptoms occur between 76% and 100% of the time)",
    symptomScale: "70%",
    medicalHistory: [],
    secondaryBodyParts: [],
    seed: 42,
  };

  const visitState: any = {
    visitIndex: 1,
    symptomChange: "improvement of symptom(s)",
    reasonConnector: "because of",
    reason: "reduced joint stiffness and swelling",
  };

  const text = exportSOAPAsText(context, visitState);

  expect(text).not.toContain("reduced joint stiffness and swelling");
  expect(text).toContain("reduced level of pain");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses swelling reason wording"`

Expected: FAIL because plain text still contains `reduced joint stiffness and swelling`.

**Step 3: Write the minimal implementation**

In `src/generator/soap-generator.ts`, add the smallest plain-text-only branch needed to normalize the `reason` field:

```ts
function suppressSwellReasonInText(value?: string): string | undefined {
  if (value === "reduced joint stiffness and swelling") {
    return "reduced level of pain";
  }
  return value;
}
```

Apply it only in plain-text TX reason rendering, not in HTML mode.

**Step 4: Run test to verify it passes**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses swelling reason wording"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/generator/__tests__/text-output-swell-suppression.test.ts src/generator/soap-generator.ts
git commit -m "fix: suppress swelling reason wording in plain text"
```

---

### Task 2: RED for plain-text inspection suppression

**Files:**
- Modify: `src/generator/__tests__/text-output-swell-suppression.test.ts`
- Modify: `src/generator/soap-generator.ts`

**Step 1: Write the failing test**

Add a second focused test for inherited/default inspection text:

```ts
test("plain text suppresses joint swelling inspection wording", () => {
  const context: any = {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "KNEE",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    painWorst: 9,
    painBest: 3,
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    painRadiation: "without radiation",
    painFrequency: "Constant (symptoms occur between 76% and 100% of the time)",
    symptomScale: "70%",
    medicalHistory: [],
    secondaryBodyParts: [],
    seed: 42,
  };

  const visitState: any = {
    visitIndex: 1,
    inspection: "joint swelling",
  };

  const text = exportSOAPAsText(context, visitState);

  expect(text).not.toContain("Inspection: joint swelling");
  expect(text).toContain("Inspection: local skin no damage or rash");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses joint swelling inspection wording"`

Expected: FAIL because KNEE inspection is still rendered as `joint swelling`.

**Step 3: Write the minimal implementation**

Add the smallest plain-text-only normalization for `inspection`:

```ts
function suppressSwellInspectionInText(value?: string): string | undefined {
  if (value === "joint swelling") {
    return "local skin no damage or rash";
  }
  return value;
}
```

Apply it only where `Inspection:` plain text is rendered.

**Step 4: Run test to verify it passes**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses joint swelling inspection wording"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/generator/__tests__/text-output-swell-suppression.test.ts src/generator/soap-generator.ts
git commit -m "fix: suppress swelling inspection wording in plain text"
```

---

### Task 3: RED for plain-text radiation suppression

**Files:**
- Modify: `src/generator/__tests__/text-output-swell-suppression.test.ts`
- Modify: `src/generator/soap-generator.ts`

**Step 1: Write the failing test**

Add a third focused test for the KNEE radiation value:

```ts
test("plain text suppresses with local swollen radiation wording", () => {
  const context: any = {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: "KNEE",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate to severe",
    painCurrent: 8,
    painWorst: 9,
    painBest: 3,
    painTypes: ["Dull", "Aching"],
    associatedSymptoms: ["soreness"],
    painRadiation: "with local swollen",
    painFrequency: "Constant (symptoms occur between 76% and 100% of the time)",
    symptomScale: "70%",
    medicalHistory: [],
    secondaryBodyParts: [],
    seed: 42,
  };

  const text = exportSOAPAsText(context, { visitIndex: 1 } as any);

  expect(text).not.toContain("with local swollen");
  expect(text).toContain("without radiation");
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses with local swollen radiation wording"`

Expected: FAIL because Subjective still renders `with local swollen`.

**Step 3: Write the minimal implementation**

Add the smallest plain-text-only normalization for `radiation`:

```ts
function suppressSwellRadiationInText(value?: string): string | undefined {
  if (value === "with local swollen") {
    return "without radiation";
  }
  return value;
}
```

Apply it only in the plain-text Subjective render path.

**Step 4: Run test to verify it passes**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses with local swollen radiation wording"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/generator/__tests__/text-output-swell-suppression.test.ts src/generator/soap-generator.ts
git commit -m "fix: suppress swelling radiation wording in plain text"
```

---

### Task 4: RED for continue-mode inherited inspection behavior

**Files:**
- Modify: `src/generator/__tests__/text-output-swell-suppression.test.ts`
- Modify: `src/generator/soap-generator.ts`

**Step 1: Write the failing test**

Add a fourth focused test proving inherited continue-style inspection input is also suppressed by the renderer:

```ts
test("plain text suppresses inherited joint swelling inspection wording", () => {
  const context: any = {
    noteType: "TX",
    insuranceType: "OPTUM",
    primaryBodyPart: "KNEE",
    laterality: "bilateral",
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic",
    severityLevel: "moderate",
    painCurrent: 6,
    painWorst: 8,
    painBest: 3,
    painTypes: ["Dull"],
    associatedSymptoms: ["soreness"],
    painRadiation: "without radiation",
    painFrequency: "Frequent (symptoms occur between 51% and 75% of the time)",
    symptomScale: "60%-70%",
    previousIE: {},
  };

  const inheritedVisitState: any = {
    visitIndex: 4,
    inspection: "joint swelling",
  };

  const text = exportSOAPAsText(context, inheritedVisitState);

  expect(text).not.toContain("joint swelling");
  expect(text).toContain("local skin no damage or rash");
});
```

**Step 2: Run test to verify it fails or confirm existing implementation already covers it**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses inherited joint swelling inspection wording"`

Expected:
- If FAIL: implement only the missing inherited path handling
- If PASS: do not add more code; record that Task 2 implementation already covered this path

**Step 3: Write minimal implementation only if RED occurred**

If the test failed, patch only the uncovered plain-text inspection branch. If it already passed, leave production code unchanged.

**Step 4: Run test to verify it passes**

Run: `npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i --testNamePattern="plain text suppresses inherited joint swelling inspection wording"`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/generator/__tests__/text-output-swell-suppression.test.ts src/generator/soap-generator.ts
git commit -m "test: cover inherited swelling suppression in plain text"
```

---

### Task 5: Guardrail for HTML preservation

**Files:**
- Modify: `src/generator/__tests__/export-soap-html.test.ts`
- Test: `src/shared/__tests__/template-options.test.ts`

**Step 1: Write or keep a dedicated HTML preservation assertion**

Ensure `src/generator/__tests__/export-soap-html.test.ts` contains a test that checks only HTML fidelity for the KNEE radiation dropdown:

```ts
it("html keeps original knee swelling option in dropdown pool", () => {
  const html = exportSOAP(makeTxContext("KNEE"), undefined, "html");
  expect(html).toContain(
    "ppnSelectComboSingle without radiation|with radiation to R leg|with radiation to L leg|with radiation to BLLE|with radiation to toes|with local swollen",
  );
});
```

**Step 2: Run test to verify it passes before and after implementation**

Run: `npx jest src/generator/__tests__/export-soap-html.test.ts -i --testNamePattern="html keeps original knee swelling option in dropdown pool"`

Expected: PASS both before and after the text-only change.

**Step 3: Run template-array guardrail test**

Run: `npx jest src/shared/__tests__/template-options.test.ts -i --testNamePattern="uses template-extracted TX radiation options and input types"`

Expected: PASS, proving the original array still contains `with local swollen`.

**Step 4: Commit**

```bash
git add src/generator/__tests__/export-soap-html.test.ts src/shared/__tests__/template-options.test.ts
git commit -m "test: keep swelling options in html template pools"
```

---

### Task 6: Final refactor and regression pass

**Files:**
- Modify: `src/generator/soap-generator.ts`
- Test: `src/generator/__tests__/text-output-swell-suppression.test.ts`
- Test: `src/generator/__tests__/export-soap-html.test.ts`
- Test: `src/shared/__tests__/template-options.test.ts`

**Step 1: Refactor only after all RED→GREEN steps are complete**

If duplication exists, merge the tiny suppression helpers into one clearly named internal utility, but do not expand scope beyond covered behaviors.

**Step 2: Run focused tests**

Run:

```bash
npx jest src/generator/__tests__/text-output-swell-suppression.test.ts -i
npx jest src/generator/__tests__/export-soap-html.test.ts -i
npx jest src/shared/__tests__/template-options.test.ts -i
```

Expected: PASS.

**Step 3: Run a broader generator regression slice**

Run: `npm test -- --runInBand src/generator`

Expected: PASS, or unrelated pre-existing failures only.

**Step 4: Manual smoke-check**

Verify:
- `/composer` write mode KNEE plain text has no `swell*`
- `/continue` plain text has no inherited `joint swelling`
- HTML export/view still shows original swelling dropdown options

**Step 5: Commit**

```bash
git add src/generator/soap-generator.ts src/generator/__tests__/text-output-swell-suppression.test.ts src/generator/__tests__/export-soap-html.test.ts src/shared/__tests__/template-options.test.ts
git commit -m "refactor: finalize swell suppression for plain text only"
```

---

## Explicitly Deferred

- `joints swelling` in assessment `findingType` is deferred until a real failing test proves it can reach current plain-text output.
- TCM tongue text containing `swollen` is deferred because it changes medical semantics and is outside the current requirement.
- Any removal of swelling strings from source template pools is deferred because it would violate the HTML-preservation requirement.

## Risks and Decision Notes

- **Reason index risk:** do not remove entries from `TEMPLATE_TX_REASON`; fixed indices are used elsewhere.
- **HTML fidelity risk:** changing source arrays would break the requirement and existing HTML tests.
- **Semantic risk:** global string replacement is forbidden because it could corrupt unrelated medical text.
- **TDD risk:** adding suppression for uncovered fields is not allowed; every production branch must trace back to a failing test.

## Definition of Done

- Plain-text SOAP output no longer proactively emits covered swelling wording from `reason`, `inspection`, or `radiation`.
- Continue-mode inherited inspection text is also covered by tests.
- HTML export still includes the original swelling-related option strings.
- Template source pools remain unchanged.
- Every production change is justified by its own verified failing test.
