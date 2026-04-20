import * as parserModule from "../../../parsers/optum-note/parser";
import * as checkerModule from "../../../parsers/optum-note/checker/note-checker";
import type { CheckOutput } from "../../../parsers/optum-note/checker/types";
import type { OptumNoteDocument } from "../../../parsers/optum-note/types";
import { isOutputValid, validateOutput } from "../output-validator";

function buildMinimalIEText(): string {
  const header =
    "DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2026 Printed on: 01/16/2026";
  const body = `
01/15/2026
Subjective:
INITIAL EVALUATION
Patient c/o Chronic Dull pain on lower back area without radiation for 3 month(s). The pain is associated with muscles soreness (scale as 70%). There is moderate difficulty with ADLs like Standing for long periods of time, Sitting for long periods of time.
Pain Scale: 8 /10
Pain Frequency: Frequent (symptoms occur between 51% and 75% of the time)
Objective:
Inspection: local skin no damage or rash
Assessment:
TCM Dx:
Lower back pain due to Qi Stagnation in local meridian.
Plan:
Today's treatment principles:
focus on promote circulation.
`;
  return `${header}\n${body}`.trim();
}

function makeMockDocument(): OptumNoteDocument {
  return {
    header: {
      patient: {
        name: "DOE, JOHN",
        dob: "01/01/1980",
        patientId: "1234567890",
        gender: "Male",
        age: 46,
        ageAsOfDate: "01/15/2026",
      },
      dateOfService: "01/15/2026",
      printedOn: "01/16/2026",
    },
    visits: [],
  };
}

describe("output-validator", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns PARSE_FAIL when note cannot be parsed", () => {
    const result = validateOutput("this is not a SOAP note");
    expect(result.valid).toBe(false);
    expect(result.errors[0].ruleId).toBe("PARSE_FAIL");
    expect(result.summary.critical).toBe(1);
    expect(result.summary.total).toBe(1);
  });

  it("runs parser+checker chain for parseable note", () => {
    const result = validateOutput(buildMinimalIEText());
    expect(result.errors.some((e) => e.ruleId === "PARSE_FAIL")).toBe(false);
    expect(result.summary.total).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });

  it("returns valid=true when checker has only non-blocking severities", () => {
    const doc = makeMockDocument();
    jest.spyOn(parserModule, "parseOptumNote").mockReturnValue({
      success: true,
      document: doc,
      errors: [],
      warnings: [],
    });

    const checkerOutput: CheckOutput = {
      patient: doc.header.patient,
      summary: {
        totalVisits: 0,
        visitDateRange: { first: doc.header.dateOfService, last: doc.header.dateOfService },
        errorCount: { critical: 0, high: 0, medium: 0, low: 1, total: 1 },
        scoring: {
          ieConsistency: 100,
          txConsistency: 100,
          timelineLogic: 100,
          totalScore: 100,
          grade: "PASS",
        },
      },
      timeline: [],
      errors: [
        {
          id: "LOW-1",
          ruleId: "LOW_RULE",
          severity: "LOW",
          visitDate: doc.header.dateOfService,
          visitIndex: 0,
          section: "S",
          field: "field",
          ruleName: "low",
          message: "low severity",
          expected: "x",
          actual: "y",
        },
      ],
      corrections: [],
    };

    jest.spyOn(checkerModule, "checkDocument").mockReturnValue(checkerOutput);

    const result = validateOutput("mocked text");
    expect(result.valid).toBe(true);
    expect(result.summary.low).toBe(1);
    expect(result.summary.high).toBe(0);
    expect(isOutputValid("mocked text")).toBe(true);
  });

  // ── AC7 additional coverage ──

  function mockCheckerErrors(errors: CheckOutput["errors"]): void {
    const doc = makeMockDocument();
    jest.spyOn(parserModule, "parseOptumNote").mockReturnValue({
      success: true,
      document: doc,
      errors: [],
      warnings: [],
    });
    jest.spyOn(checkerModule, "checkDocument").mockReturnValue({
      patient: doc.header.patient,
      summary: {
        totalVisits: 0,
        visitDateRange: { first: doc.header.dateOfService, last: doc.header.dateOfService },
        errorCount: { critical: 0, high: 0, medium: 0, low: 0, total: errors.length },
        scoring: { ieConsistency: 100, txConsistency: 100, timelineLogic: 100, totalScore: 100, grade: "PASS" },
      },
      timeline: [],
      errors,
      corrections: [],
    });
  }

  const makeErr = (severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", id = `E-${severity}`): CheckOutput["errors"][0] => ({
    id,
    ruleId: `RULE-${severity}`,
    severity,
    visitDate: "01/15/2026",
    visitIndex: 0,
    section: "S",
    field: "x",
    ruleName: "r",
    message: `${severity} issue`,
    expected: "ok",
    actual: "bad",
  });

  it("happy path: no errors → valid=true, zero summary", () => {
    mockCheckerErrors([]);
    const result = validateOutput("mocked");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary).toEqual({ critical: 0, high: 0, medium: 0, low: 0, total: 0 });
  });

  it("CRITICAL blocks output (valid=false)", () => {
    mockCheckerErrors([makeErr("CRITICAL")]);
    const result = validateOutput("mocked");
    expect(result.valid).toBe(false);
    expect(result.summary.critical).toBe(1);
  });

  it("HIGH blocks output (valid=false)", () => {
    mockCheckerErrors([makeErr("HIGH")]);
    const result = validateOutput("mocked");
    expect(result.valid).toBe(false);
    expect(result.summary.high).toBe(1);
  });

  it("MEDIUM + LOW combined do NOT block output", () => {
    mockCheckerErrors([makeErr("MEDIUM"), makeErr("LOW"), makeErr("LOW")]);
    const result = validateOutput("mocked");
    expect(result.valid).toBe(true);
    expect(result.summary).toEqual({ critical: 0, high: 0, medium: 1, low: 2, total: 3 });
  });

  it("summary counts four severities independently", () => {
    mockCheckerErrors([
      makeErr("CRITICAL", "c1"),
      makeErr("CRITICAL", "c2"),
      makeErr("HIGH", "h1"),
      makeErr("MEDIUM", "m1"),
      makeErr("LOW", "l1"),
      makeErr("LOW", "l2"),
      makeErr("LOW", "l3"),
    ]);
    const result = validateOutput("mocked");
    expect(result.summary).toEqual({ critical: 2, high: 1, medium: 1, low: 3, total: 7 });
    expect(result.valid).toBe(false);
  });

  it("error mapping preserves ruleId/field/message/expected/actual", () => {
    mockCheckerErrors([
      {
        ...makeErr("HIGH"),
        ruleId: "ICD-001",
        field: "assessment.icd",
        message: "missing icd",
        expected: "M54.5",
        actual: "(none)",
      },
    ]);
    const result = validateOutput("mocked");
    expect(result.errors[0]).toEqual({
      ruleId: "ICD-001",
      severity: "HIGH",
      field: "assessment.icd",
      message: "missing icd",
      expected: "M54.5",
      actual: "(none)",
    });
  });

  it("text is passed through unchanged", () => {
    mockCheckerErrors([]);
    const input = "my soap\nmulti-line";
    expect(validateOutput(input).text).toBe(input);
  });

  it("isOutputValid matches validateOutput().valid across severities", () => {
    mockCheckerErrors([makeErr("MEDIUM")]);
    expect(isOutputValid("mocked")).toBe(validateOutput("mocked").valid);
    expect(isOutputValid("mocked")).toBe(true);

    jest.restoreAllMocks();
    mockCheckerErrors([makeErr("CRITICAL")]);
    expect(isOutputValid("mocked")).toBe(validateOutput("mocked").valid);
    expect(isOutputValid("mocked")).toBe(false);
  });

  it("isOutputValid returns false on PARSE_FAIL path without mock", () => {
    expect(isOutputValid("garbage nonsense no soap here")).toBe(false);
  });
});
