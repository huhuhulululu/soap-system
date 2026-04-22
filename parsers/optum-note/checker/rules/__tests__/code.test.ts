import { dx01 } from "../code/dx01";
import { dx02 } from "../code/dx02";
import { dx03 } from "../code/dx03";
import { dx04 } from "../code/dx04";
import { cpt01 } from "../code/cpt01";
import { cpt02 } from "../code/cpt02";
import { cpt03 } from "../code/cpt03";
import { makeCodeCtx, makeVisit, runCodeRule } from "./harness";

describe("DX03 missing ICD", () => {
  it("fires when one visit missing but others have", () => {
    const a = makeVisit({ diagnosisCodes: [] });
    const b = makeVisit(); // has codes
    const ctx = makeCodeCtx([a, b], 0);
    expect(runCodeRule(dx03, ctx)[0]?.ruleId).toBe("DX03");
  });
  it("silent in all-missing writer mode", () => {
    const a = makeVisit({ diagnosisCodes: [] });
    const b = makeVisit({ diagnosisCodes: [] });
    expect(runCodeRule(dx03, makeCodeCtx([a, b], 0))).toEqual([]);
  });
});

describe("DX01 ICD → bodyPart", () => {
  it("fires on wrong prefix for LBP", () => {
    const v = makeVisit({
      diagnosisCodes: [{ description: "knee", icd10: "S83.5" }],
    });
    expect(runCodeRule(dx01, makeCodeCtx([v], 0))[0]?.ruleId).toBe("DX01");
  });
});

describe("DX04 laterality suffix", () => {
  it("fires on suffix mismatch", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, laterality: "left" },
      diagnosisCodes: [{ description: "LBP", icd10: "M54.51" }], // left expects 2/92 suffix
    });
    expect(runCodeRule(dx04, makeCodeCtx([v], 0))[0]?.ruleId).toBe("DX04");
  });
});

describe("DX02 cross-visit drop", () => {
  it("fires when overlap < 50%", () => {
    const a = makeVisit({
      diagnosisCodes: [{ description: "x", icd10: "M54.53" }],
    });
    const b = makeVisit({
      diagnosisCodes: [{ description: "y", icd10: "M99.99" }],
    });
    expect(runCodeRule(dx02, makeCodeCtx([a, b], 1))[0]?.ruleId).toBe("DX02");
  });
});

describe("CPT01 missing CPT", () => {
  it("fires when visit missing but others present", () => {
    const a = makeVisit({ procedureCodes: [] });
    const b = makeVisit();
    expect(runCodeRule(cpt01, makeCodeCtx([a, b], 0))[0]?.ruleId).toBe("CPT01");
  });
});

describe("CPT02 plan vs codes", () => {
  it("fires plan=estim but only 97810", () => {
    const v = makeVisit({
      plan: { ...makeVisit().plan, electricalStimulation: true },
      procedureCodes: [{ description: "", cpt: "97810" }],
    });
    expect(runCodeRule(cpt02, makeCodeCtx([v], 0))[0]?.ruleId).toBe("CPT02");
  });
  it("fires plan=no estim but 97813 present", () => {
    const v = makeVisit({
      plan: { ...makeVisit().plan, electricalStimulation: false },
      procedureCodes: [{ description: "", cpt: "97813" }],
    });
    expect(runCodeRule(cpt02, makeCodeCtx([v], 0))[0]?.ruleId).toBe("CPT02");
  });
});

describe("CPT03 time vs units", () => {
  it("fires time>15 but 1 CPT", () => {
    const v = makeVisit({
      plan: { ...makeVisit().plan, treatmentTime: 30 },
      procedureCodes: [{ description: "", cpt: "97813" }],
    });
    expect(runCodeRule(cpt03, makeCodeCtx([v], 0))[0]?.ruleId).toBe("CPT03");
  });
});
