import { v01 } from "../sequence/v01";
import { v02 } from "../sequence/v02";
import { v03 } from "../sequence/v03";
import { v04 } from "../sequence/v04";
import { v05 } from "../sequence/v05";
import { v06 } from "../sequence/v06";
import { v07 } from "../sequence/v07";
import { v08 } from "../sequence/v08";
import { v09 } from "../sequence/v09";
import { t08 } from "../sequence/t08";
import { t09 } from "../sequence/t09";
import { makeSeqCtx, makeVisit, runSequenceRule } from "./harness";

const mk = (prevP: number, curP: number) => {
  const prev = makeVisit({
    subjective: { ...makeVisit().subjective, painScale: { value: prevP } },
  });
  const cur = makeVisit({
    subjective: { ...makeVisit().subjective, painScale: { value: curP } },
  });
  return { prev, cur };
};

describe("V01 pain 回升", () => {
  it("fires when pain >+1", () => {
    const { prev, cur } = mk(3, 6);
    expect(runSequenceRule(v01, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V01");
  });
  it("silent on flat pain", () => {
    const { prev, cur } = mk(5, 5);
    expect(runSequenceRule(v01, makeSeqCtx([prev, cur], 1))).toEqual([]);
  });
});

describe("V02 tenderness 回升", () => {
  it("fires when scale jumps", () => {
    const prev = makeVisit();
    const cur = makeVisit({
      objective: {
        ...makeVisit().objective,
        tendernessMuscles: { muscles: [], scale: 4, scaleDescription: "+4" },
      },
    });
    expect(runSequenceRule(v02, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V02");
  });
});

describe("V03 tightness 恶化", () => {
  it("fires on severe jump", () => {
    const prev = makeVisit();
    const cur = makeVisit({
      objective: {
        ...makeVisit().objective,
        tightnessMuscles: { muscles: [], gradingScale: "severe" },
      },
    });
    expect(runSequenceRule(v03, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V03");
  });
});

describe("V04 spasm 回升", () => {
  it("fires when scale jumps", () => {
    const prev = makeVisit();
    const cur = makeVisit({
      objective: {
        ...makeVisit().objective,
        spasmMuscles: { muscles: [], frequencyScale: 5, scaleDescription: "+5" },
      },
    });
    expect(runSequenceRule(v04, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V04");
  });
});

describe("V05 ROM 下降", () => {
  it("fires when ROM drops >3", () => {
    const prev = makeVisit();
    const cur = makeVisit({
      objective: {
        ...makeVisit().objective,
        rom: {
          bodyPart: "",
          items: [
            { strength: "3/5", movement: "Flexion", degrees: 50, severity: "mild" },
          ],
        },
      },
    });
    expect(runSequenceRule(v05, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V05");
  });
});

describe("V06 strength 下降", () => {
  it("fires on strength drop", () => {
    const prev = makeVisit(); // default 4/5
    const cur = makeVisit({
      objective: {
        ...makeVisit().objective,
        rom: {
          bodyPart: "",
          items: [
            { strength: "2/5", movement: "Flexion", degrees: 80, severity: "mild" },
          ],
        },
      },
    });
    expect(runSequenceRule(v06, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V06");
  });
});

describe("V07 frequency 升级", () => {
  it("fires on 2-level jump", () => {
    const prev = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        painFrequency: "Intermittent",
      },
    });
    const cur = makeVisit({
      subjective: { ...makeVisit().subjective, painFrequency: "Constant" },
    });
    expect(runSequenceRule(v07, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V07");
  });
});

describe("V08 improvement + pain 回升", () => {
  it("fires when symptomChange=improvement and pain jumps", () => {
    const { prev, cur } = mk(3, 6);
    cur.assessment = { ...cur.assessment, symptomChange: "improvement" };
    expect(runSequenceRule(v08, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V08");
  });
});

describe("V09 acupoints overlap", () => {
  it("fires on low jaccard", () => {
    const prev = makeVisit({
      plan: { ...makeVisit().plan, acupoints: ["A", "B"] },
    });
    const cur = makeVisit({
      plan: { ...makeVisit().plan, acupoints: ["X", "Y", "Z"] },
    });
    expect(runSequenceRule(v09, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("V09");
  });
});

describe("T08 ADL severity monotonicity", () => {
  it("fires on 2-level regression", () => {
    const prev = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        adlImpairment: "mild difficulty",
      },
    });
    const cur = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        adlImpairment: "severe difficulty",
      },
    });
    expect(runSequenceRule(t08, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("T08");
  });
});

describe("T09 associated symptom escalation", () => {
  it("fires when soreness→weakness", () => {
    const prev = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        chiefComplaint: "muscles soreness",
      },
    });
    const cur = makeVisit({
      subjective: {
        ...makeVisit().subjective,
        chiefComplaint: "muscles weakness",
      },
    });
    expect(runSequenceRule(t09, makeSeqCtx([prev, cur], 1))[0]?.ruleId).toBe("T09");
  });
});
