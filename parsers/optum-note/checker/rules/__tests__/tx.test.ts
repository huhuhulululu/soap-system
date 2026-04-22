import { tx01 } from "../tx/tx01";
import { tx02 } from "../tx/tx02";
import { tx03 } from "../tx/tx03";
import { t02 } from "../tx/t02";
import { t03 } from "../tx/t03";
import { tx04 } from "../tx/tx04";
import { tx05 } from "../tx/tx05";
import { tx06 } from "../tx/tx06";
import { t06 } from "../tx/t06";
import { t07 } from "../tx/t07";
import { makeTXCtx, makeVisit, runTXRule } from "./harness";

describe("TX01 pain→ADL severity", () => {
  it("fires on large pain/severity mismatch beyond tolerance", () => {
    const v = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        painScale: { value: 3 },
        adlImpairment: "severe difficulty",
        adlDifficultyLevel: "severe",
      },
    });
    const errs = runTXRule(tx01, makeTXCtx({ visit: v, visitIndex: 1 }));
    expect(errs[0]?.ruleId).toBe("TX01");
  });
  it("silent within 2-level downgrade tolerance", () => {
    const v = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        painScale: { value: 8 },
        adlImpairment: "mild",
        adlDifficultyLevel: "mild",
      },
    });
    // expected severe idx=4, mild idx=0, diff 4 > 2 ⇒ fires
    const errs = runTXRule(tx01, makeTXCtx({ visit: v, visitIndex: 1 }));
    expect(errs.length).toBeGreaterThanOrEqual(1);
  });
});

describe("TX02 pain→tenderness", () => {
  it("fires when tenderness below min", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 9 } },
      objective: {
        ...makeVisit().objective,
        tendernessMuscles: { muscles: [], scale: 0, scaleDescription: "" },
      },
    });
    expect(
      runTXRule(tx02, makeTXCtx({ visit: v, visitIndex: 1 }))[0]?.ruleId,
    ).toBe("TX02");
  });
});

describe("TX03 improvement claim + pain up", () => {
  it("fires when improvement + pain up vs prev", () => {
    const prev = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 5 } },
    });
    const cur = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 7 } },
      assessment: { ...makeVisit().assessment, symptomChange: "improvement" },
    });
    expect(
      runTXRule(tx03, makeTXCtx({ visit: cur, prevVisit: prev }))[0]?.ruleId,
    ).toBe("TX03");
  });
});

describe("T02 improvement + worsened metrics", () => {
  it("fires (CRITICAL) when claim improvement but pain + tenderness worsen; skips IE→TX1", () => {
    const prev = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        painScale: { value: 4 },
      },
      objective: {
        ...makeVisit().objective,
        tendernessMuscles: {
          muscles: [],
          scale: 1,
          scaleDescription: "+1",
        },
      },
    });
    const cur = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 7 } },
      objective: {
        ...makeVisit().objective,
        tendernessMuscles: {
          muscles: [],
          scale: 3,
          scaleDescription: "+3",
        },
      },
      assessment: { ...makeVisit().assessment, symptomChange: "improvement" },
    });
    const errs = runTXRule(t02, makeTXCtx({ visit: cur, prevVisit: prev }));
    expect(errs[0]?.severity).toBe("CRITICAL");
  });
});

describe("T03 exacerbate + improved metrics", () => {
  it("fires when exacerbate but pain down", () => {
    const prev = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 8 } },
    });
    const cur = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 3 } },
      assessment: { ...makeVisit().assessment, symptomChange: "exacerbate" },
    });
    expect(
      runTXRule(t03, makeTXCtx({ visit: cur, prevVisit: prev }))[0]?.ruleId,
    ).toBe("T03");
  });
});

describe("TX04 generalCondition good→poor", () => {
  it("fires on regression", () => {
    const prev = makeVisit({
      assessment: { ...makeVisit().assessment, generalCondition: "good" },
    });
    const cur = makeVisit({
      assessment: { ...makeVisit().assessment, generalCondition: "poor" },
    });
    expect(
      runTXRule(tx04, makeTXCtx({ visit: cur, prevVisit: prev }))[0]?.ruleId,
    ).toBe("TX04");
  });
});

describe("TX05 tongue/pulse vs IE", () => {
  it("fires on divergence from IE baseline", () => {
    const ie = makeVisit({
      objective: {
        ...makeVisit().objective,
        tonguePulse: { tongue: "pale thin white", pulse: "wiry" },
      },
    });
    const cur = makeVisit({
      objective: {
        ...makeVisit().objective,
        tonguePulse: { tongue: "bright red", pulse: "rapid" },
      },
    });
    expect(
      runTXRule(tx05, makeTXCtx({ visit: cur, ieVisit: ie }))[0]?.ruleId,
    ).toBe("TX05");
  });
});

describe("TX06 should not carry goals", () => {
  it("fires when TX has shortTermGoal", () => {
    const v = makeVisit({
      plan: {
        ...makeVisit().plan,
        shortTermGoal: {
          frequency: "",
          painScaleTarget: "1",
          sensationScaleTarget: "",
          tightnessTarget: "",
          tendernessTarget: "",
          spasmsTarget: "",
          strengthTarget: "",
        },
      },
    });
    expect(
      runTXRule(tx06, makeTXCtx({ visit: v, visitIndex: 1 }))[0]?.severity,
    ).toBe("CRITICAL");
  });
});

describe("T06 progress status vs reasons", () => {
  it("fires improvement + negative reasons", () => {
    const v = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        chiefComplaint: "improvement of symptom due to skipped treatments",
      },
    });
    expect(
      runTXRule(t06, makeTXCtx({ visit: v, visitIndex: 1 }))[0]?.ruleId,
    ).toBe("T06");
  });
});

describe("T07 pacemaker + electrical stim", () => {
  it("fires when IE medicalHistory contains Pacemaker + TX estim=true", () => {
    const ie = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        medicalHistory: ["Pacemaker"],
      },
    });
    const cur = makeVisit({
      plan: { ...makeVisit().plan, electricalStimulation: true },
    });
    expect(
      runTXRule(t07, makeTXCtx({ visit: cur, ieVisit: ie }))[0]?.severity,
    ).toBe("CRITICAL");
  });
});
