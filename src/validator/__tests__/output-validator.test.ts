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
});
