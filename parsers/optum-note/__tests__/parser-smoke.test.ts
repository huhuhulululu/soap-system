import {
  parseHeader,
  parseOptumNote,
  parseProcedureCodes,
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

  it("parseProcedureCodes captures CPT split across page by header line (regression: ZHENG, GUOBIN 07/16 97814)", () => {
    // 模拟 pdfjs 提取 Optum note 跨页后的 visit block：前两个 CPT 在页尾，
    // 页眉（患者 header + Printed on）插入后，第三个 CPT (97814) 在下一页首行。
    // Bug: 原正则 `(?=\n\n|Printed on|$)` 把 section 在 "Printed on" 前截断，丢失 97814。
    const block = `Subjective: Follow up visit
Patient still c/o Dull pain on lower back.
Pain Scale: 7 /10
Pain frequency: Frequent
Objective: Inspection: local skin no damage or rash
Assessment: The patient continues treatment.
Plan: Today's treatment principles
Diagnosis Code: (1) Low back pain, unspecified(M54.50)
Procedure Code: (1) ACUP 1/> W/ESTIM 1ST 15 MIN(97813)
(2) ACUP 1/> W/O ESTIM EA ADD 15(97811)
ZHENG, GUOBIN (DOB: 12/26/1955 ID: 1002305650) Date of Service: 07/16/2025 Printed on: 04/17/2026
(3) ACUP 1/> W/ESTIM EA ADDL 15(97814)`;
    const codes = parseProcedureCodes(block);
    const cpts = codes.map((c) => c.cpt);
    expect(cpts).toContain("97813");
    expect(cpts).toContain("97811");
    expect(cpts).toContain("97814");
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

