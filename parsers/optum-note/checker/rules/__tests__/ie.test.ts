import { ie01 } from "../ie/ie01";
import { ie02 } from "../ie/ie02";
import { ie03 } from "../ie/ie03";
import { ie04 } from "../ie/ie04";
import { ie05 } from "../ie/ie05";
import { ie06 } from "../ie/ie06";
import { ie07 } from "../ie/ie07";
import { ie08 } from "../ie/ie08";
import { makeIECtx, makeVisit, runIERule } from "./harness";

const ieBase = () =>
  makeVisit({
    subjective: {
      ...makeVisit().subjective,
      visitType: "INITIAL EVALUATION",
    },
  });

describe("IE01 — pain→ADL severity (LOW, >=4 diff)", () => {
  it("silent when diff < 4", () => {
    const v = ieBase();
    expect(runIERule(ie01, { visit: v, visitIndex: 0 })).toEqual([]);
  });
  it("fires when pain=9 but ADL=mild (diff >=4)", () => {
    const v = ieBase();
    v.subjective = {
      ...v.subjective,
      painScale: { value: 9 },
      adlImpairment: "mild difficulty",
      adlDifficultyLevel: "mild",
    };
    const errs = runIERule(ie01, { visit: v, visitIndex: 0 });
    expect(errs).toHaveLength(1);
    expect(errs[0].ruleId).toBe("IE01");
  });
});

describe("IE02 — pain→tenderness scale", () => {
  it("fires when scale below expected min", () => {
    const v = ieBase();
    v.subjective = { ...v.subjective, painScale: { value: 9 } };
    v.objective = {
      ...v.objective,
      tendernessMuscles: { muscles: [], scale: 0, scaleDescription: "" },
    };
    const errs = runIERule(ie02, { visit: v, visitIndex: 0 });
    expect(errs[0]?.ruleId).toBe("IE02");
  });
});

describe("IE03 — pain→ROM limitation", () => {
  it("fires when pain>=7 but ROM mostly normal", () => {
    const v = ieBase();
    v.subjective = { ...v.subjective, painScale: { value: 8 } };
    v.objective = {
      ...v.objective,
      rom: {
        bodyPart: "Lumbar",
        items: [
          { strength: "5/5", movement: "Flexion", degrees: 85, severity: "normal" },
          { strength: "5/5", movement: "Extension", degrees: 25, severity: "normal" },
        ],
      },
    };
    const errs = runIERule(ie03, { visit: v, visitIndex: 0 });
    expect(errs[0]?.ruleId).toBe("IE03");
  });
});

describe("IE04 — tongue/pulse vs pattern", () => {
  it("fires on inconsistent tongue", () => {
    const v = ieBase();
    v.assessment = { ...v.assessment, localPattern: "Blood Stasis" };
    v.objective = {
      ...v.objective,
      tonguePulse: { tongue: "bright red", pulse: "rapid" },
    };
    const errs = runIERule(ie04, { visit: v, visitIndex: 0 });
    expect(errs[0]?.ruleId).toBe("IE04");
  });
});

describe("IE05 — short-term goal pain target", () => {
  it("fires when target >= current pain", () => {
    const v = ieBase();
    v.subjective = { ...v.subjective, painScale: { value: 5 } };
    v.plan = {
      ...v.plan,
      shortTermGoal: {
        frequency: "",
        painScaleTarget: "6",
        sensationScaleTarget: "",
        tightnessTarget: "",
        tendernessTarget: "",
        spasmsTarget: "",
        strengthTarget: "",
      },
    };
    const errs = runIERule(ie05, { visit: v, visitIndex: 0 });
    expect(errs[0]?.ruleId).toBe("IE05");
  });
});

describe("IE06 — long-term < short-term", () => {
  it("fires when long >= short", () => {
    const v = ieBase();
    const goal = (t: string) => ({
      frequency: "",
      painScaleTarget: t,
      sensationScaleTarget: "",
      tightnessTarget: "",
      tendernessTarget: "",
      spasmsTarget: "",
      strengthTarget: "",
    });
    v.plan = { ...v.plan, shortTermGoal: goal("4"), longTermGoal: goal("5") };
    const errs = runIERule(ie06, { visit: v, visitIndex: 0 });
    expect(errs[0]?.ruleId).toBe("IE06");
  });
});

describe("IE07 — TCM diagnosis complete", () => {
  it("fires when tcmDiagnosis missing", () => {
    const v = ieBase();
    v.assessment = { ...v.assessment, tcmDiagnosis: undefined };
    const errs = runIERule(ie07, { visit: v, visitIndex: 0 });
    expect(errs[0]?.ruleId).toBe("IE07");
  });
});

describe("IE08 — acupoints present", () => {
  it("fires on empty acupoints", () => {
    const v = ieBase();
    v.plan = { ...v.plan, acupoints: [] };
    const errs = runIERule(ie08, { visit: v, visitIndex: 0 });
    expect(errs[0]?.ruleId).toBe("IE08");
  });
  it("silent with acupoints", () => {
    const v = ieBase();
    expect(runIERule(ie08, makeIECtx({ visit: v, visitIndex: 0 }))).toEqual([]);
  });
});
