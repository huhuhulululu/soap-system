import { s2 } from "../generator/s2";
import { s3 } from "../generator/s3";
import { s7 } from "../generator/s7";
import { o1 } from "../generator/o1";
import { o2 } from "../generator/o2";
import { o3 } from "../generator/o3";
import { o8 } from "../generator/o8";
import { o9 } from "../generator/o9";
import { a5 } from "../generator/a5";
import { p1 } from "../generator/p1";
import { p2 } from "../generator/p2";
import { x1 } from "../generator/x1";
import { x2 } from "../generator/x2";
import { x3 } from "../generator/x3";
import { x4 } from "../generator/x4";
import { makeGeneratorCtx, makeVisit, runGeneratorRule } from "./harness";

const run = (rule: Parameters<typeof runGeneratorRule>[0], v = makeVisit()) =>
  runGeneratorRule(rule, makeGeneratorCtx([v], 0));

describe("S7 muscle weakness vs pain", () => {
  it("fires pain>=7 + weakness<40", () => {
    const v = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        painScale: { value: 9 },
        muscleWeaknessScale: "10%",
      },
    });
    expect(run(s7, v)[0]?.ruleId).toBe("S7");
  });
});

describe("O1 ROM degrees vs pain", () => {
  it("fires when degrees far from expected", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 8 } },
      objective: {
        ...makeVisit().objective,
        rom: {
          bodyPart: "",
          items: [
            { strength: "3/5", movement: "Flexion", degrees: 5, severity: "severe" },
          ],
        },
      },
    });
    expect(run(o1, v)[0]?.ruleId).toBe("O1");
  });
});

describe("O2 severity vs ratio", () => {
  it("fires severity=normal at low ratio", () => {
    const v = makeVisit({
      objective: {
        ...makeVisit().objective,
        rom: {
          bodyPart: "",
          items: [
            { strength: "5/5", movement: "Flexion", degrees: 40, severity: "normal" },
          ],
        },
      },
    });
    expect(run(o2, v)[0]?.ruleId).toBe("O2");
  });
});

describe("O3 strength vs severity", () => {
  it("fires severe with strong muscle", () => {
    const v = makeVisit({
      objective: {
        ...makeVisit().objective,
        rom: {
          bodyPart: "",
          items: [
            { strength: "5/5", movement: "Flexion", degrees: 30, severity: "severe" },
          ],
        },
      },
    });
    expect(run(o3, v)[0]?.ruleId).toBe("O3");
  });
});

describe("O8 muscles vs bodyPart", () => {
  it("fires on wrong muscle for LBP", () => {
    const v = makeVisit({
      objective: {
        ...makeVisit().objective,
        tightnessMuscles: { muscles: ["deltoid"], gradingScale: "mild" },
      },
    });
    expect(run(o8, v)[0]?.ruleId).toBe("O8");
  });
});

describe("O9 movement vs bodyPart", () => {
  it("fires on invalid movement for KNEE", () => {
    const v = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        bodyPartNormalized: "KNEE",
      },
      objective: {
        ...makeVisit().objective,
        rom: {
          bodyPart: "Knee",
          items: [
            { strength: "4/5", movement: "Rotation", degrees: 50, severity: "mild" },
          ],
        },
      },
    });
    expect(run(o9, v)[0]?.severity).toBe("CRITICAL");
  });
});

describe("A5 pattern consistent", () => {
  it("fires when cur differs from IE pattern", () => {
    const ie = makeVisit({
      subjective: { ...makeVisit().subjective, visitType: "INITIAL EVALUATION" },
      assessment: { ...makeVisit().assessment, localPattern: "Qi Stagnation" },
    });
    const tx = makeVisit({
      assessment: { ...makeVisit().assessment, localPattern: "Blood Stasis" },
    });
    const errs = runGeneratorRule(a5, makeGeneratorCtx([ie, tx], 1));
    expect(errs[0]?.ruleId).toBe("A5");
  });
});

describe("P1 needle gauge", () => {
  it("fires on invalid gauge", () => {
    const v = makeVisit({
      plan: { ...makeVisit().plan, needleSpecs: [{ gauge: "20#", length: '1"' }] },
    });
    expect(run(p1, v)[0]?.ruleId).toBe("P1");
  });
});

describe("P2 acupoint count", () => {
  it("fires on empty", () => {
    const v = makeVisit({ plan: { ...makeVisit().plan, acupoints: [] } });
    expect(run(p2, v)[0]?.ruleId).toBe("P2");
  });
  it("fires on >20", () => {
    const v = makeVisit({
      plan: { ...makeVisit().plan, acupoints: Array(25).fill("X") },
    });
    expect(run(p2, v)[0]?.ruleId).toBe("P2");
  });
});

describe("X1 pain-tightness-tenderness chain", () => {
  it("fires pain>=8 + mild tightness (TX)", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 9 } },
      objective: {
        ...makeVisit().objective,
        tightnessMuscles: { muscles: [], gradingScale: "mild" },
      },
    });
    expect(run(x1, v)[0]?.ruleId).toBe("X1");
  });
});

describe("X2 pain→ROM", () => {
  it("fires pain>=8 + mostly normal ROM", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, painScale: { value: 9 } },
      objective: {
        ...makeVisit().objective,
        rom: {
          bodyPart: "",
          items: [
            { strength: "5/5", movement: "Flexion", degrees: 90, severity: "normal" },
          ],
        },
      },
    });
    expect(run(x2, v)[0]?.ruleId).toBe("X2");
  });
});

describe("X3 pattern→tongue (IE only)", () => {
  it("fires IE Blood Stasis with wrong tongue", () => {
    const v = makeVisit({
      subjective: { ...makeVisit().subjective, visitType: "INITIAL EVALUATION" },
      assessment: { ...makeVisit().assessment, localPattern: "Blood Stasis" },
      objective: {
        ...makeVisit().objective,
        tonguePulse: { tongue: "bright red", pulse: "rapid" },
      },
    });
    expect(run(x3, v)[0]?.ruleId).toBe("X3");
  });
});

describe("X4 pacemaker + electrical stim", () => {
  it("fires when both present", () => {
    const v = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        medicalHistory: ["Pacemaker"],
      },
      plan: { ...makeVisit().plan, electricalStimulation: true },
    });
    expect(run(x4, v)[0]?.severity).toBe("CRITICAL");
  });
});

describe("S2/S3 exist", () => {
  it("S2 is a rule object", () => {
    expect(s2.id).toBe("S2");
  });
  it("S3 is a rule object", () => {
    expect(s3.id).toBe("S3");
  });
});
