import {
  parseHeader,
  parseOptumNote,
  splitVisitRecords,
} from "../parser";

function buildMinimalIEText(): string {
  const header =
    "DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2026 Printed on: 01/16/2026";
  const body = `
01/15/2026
Subjective:
INITIAL EVALUATION
Patient c/o Chronic Dull, Aching pain on lower back area without radiation for 3 month(s). The pain is associated with muscles soreness (scale as 70%). There is moderate difficulty with ADLs like Standing for long periods of time, Sitting for long periods of time.
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

describe("optum parser smoke", () => {
  it("parseHeader parses pattern-A header", () => {
    const text =
      "DOE, JOHN (DOB: 01/01/1980 ID: 1234567890) Date of Service: 01/15/2026 Printed on: 01/16/2026";
    const header = parseHeader(text);
    expect(header).not.toBeNull();
    expect(header?.patient.name).toBe("DOE, JOHN");
    expect(header?.patient.patientId).toBe("1234567890");
    expect(header?.dateOfService).toBe("01/15/2026");
  });

  it("splitVisitRecords finds Subjective blocks", () => {
    const block = `
Subjective:
Follow up visit
Patient c/o Chronic Dull pain on lower back area without radiation associated with muscles soreness (scale as 70%).
Pain Scale: 7 /10
Pain Frequency: Frequent (symptoms occur between 51% and 75% of the time)
Objective:
Inspection: local skin no damage or rash
Assessment:
The patient continues treatment.
Plan:
Today's treatment principles:
focus on promote circulation.
Documentation
`.repeat(2);
    const parts = splitVisitRecords(block);
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it("parseOptumNote returns failure on non-note text", () => {
    const result = parseOptumNote("hello world");
    expect(result.success).toBe(false);
    expect(result.document).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("parseOptumNote parses a minimal IE note", () => {
    const result = parseOptumNote(buildMinimalIEText());
    expect(result.success).toBe(true);
    expect(result.document).toBeDefined();
    expect(result.document?.visits.length).toBe(1);
    expect(result.document?.visits[0].subjective.visitType).toBe(
      "INITIAL EVALUATION",
    );
    expect(result.document?.visits[0].subjective.painFrequency).toBe(
      "Frequent",
    );
  });
});

