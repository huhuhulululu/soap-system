/**
 * Assessment S↔A / O↔A 绑定映射测试
 * 验证 getAssessmentBinding 正确提取 S/O 变量变化到 A 动态字段的映射
 * WriterPanel.vue 集成: import getAssessmentBinding → 每个 TX note 展示 S↔A / O↔A 绑定面板
 */
import { describe, it, expect } from "vitest";
import { getAssessmentBinding } from "../useAssessmentBinding";

describe("getAssessmentBinding", () => {
  const basePrev = {
    painScaleCurrent: 7,
    painScaleLabel: "7",
    symptomScale: "60%-70%",
    painFrequency: "Frequent (symptoms occur between 51% and 75% of the time)",
    severityLevel: "moderate to severe",
    tightnessGrading: "moderate",
    tendernessGrading: "(+2)",
    spasmGrading: "(+2)",
    strengthGrade: "3+/5",
    adlItems: ["a", "b", "c", "d"],
  };

  function makeState(
    overrides: Record<string, unknown>,
    chain: Record<string, Record<string, string>>,
  ) {
    return { ...basePrev, ...overrides, soaChain: chain };
  }

  it("S-side: pain changed → sBindings includes pain with aField mapped", () => {
    const chain = {
      subjective: {
        painChange: "improved",
        frequencyChange: "stable",
        adlChange: "stable",
      },
      objective: {
        tightnessTrend: "stable",
        tendernessTrend: "stable",
        spasmTrend: "stable",
        romTrend: "stable",
        strengthTrend: "stable",
      },
      assessment: {
        present: "slight improvement of symptom(s).",
        patientChange: "slightly decreased",
        whatChanged: "pain",
        physicalChange: "remained the same",
        findingType: "joint ROM limitation",
      },
    };
    const state = makeState(
      { painScaleCurrent: 6, painScaleLabel: "6" },
      chain,
    );
    const result = getAssessmentBinding(state, basePrev)!;
    expect(result.sBindings).toHaveLength(1);
    expect(result.sBindings[0].sField).toBe("Pain");
    expect(result.sBindings[0].aField).toBe("pain");
  });

  it("S-side: frequency improved → sBindings includes frequency with aField mapped", () => {
    const chain = {
      subjective: {
        painChange: "improved",
        frequencyChange: "improved",
        adlChange: "stable",
      },
      objective: {
        tightnessTrend: "stable",
        tendernessTrend: "stable",
        spasmTrend: "stable",
        romTrend: "stable",
        strengthTrend: "stable",
      },
      assessment: {
        present: "improvement of symptom(s).",
        patientChange: "decreased",
        whatChanged: "pain frequency",
        physicalChange: "remained the same",
        findingType: "joint ROM limitation",
      },
    };
    const state = makeState(
      {
        painFrequency:
          "Occasional (symptoms occur between 26% and 50% of the time)",
      },
      chain,
    );
    const result = getAssessmentBinding(state, basePrev)!;
    const freqBinding = result.sBindings.find((b) => b.sField === "Freq");
    expect(freqBinding).toBeTruthy();
    expect(freqBinding!.aField).toBe("pain frequency");
  });

  it("S-side: ADL improved → sBindings includes ADL with aField mapped", () => {
    const chain = {
      subjective: {
        painChange: "similar",
        frequencyChange: "stable",
        adlChange: "improved",
      },
      objective: {
        tightnessTrend: "stable",
        tendernessTrend: "stable",
        spasmTrend: "stable",
        romTrend: "stable",
        strengthTrend: "stable",
      },
      assessment: {
        present: "slight improvement of symptom(s).",
        patientChange: "slightly decreased",
        whatChanged: "difficulty in performing ADLs",
        physicalChange: "remained the same",
        findingType: "joint ROM limitation",
      },
    };
    const state = makeState({ adlItems: ["a", "b", "c"] }, chain);
    const result = getAssessmentBinding(state, basePrev)!;
    const adlBinding = result.sBindings.find((b) => b.sField === "ADL");
    expect(adlBinding).toBeTruthy();
    expect(adlBinding!.aField).toBe("difficulty in performing ADLs");
  });

  it("S-side: symptomScale changed → sBindings includes with aField mapped to soreness", () => {
    const chain = {
      subjective: {
        painChange: "improved",
        frequencyChange: "stable",
        adlChange: "stable",
      },
      objective: {
        tightnessTrend: "stable",
        tendernessTrend: "stable",
        spasmTrend: "stable",
        romTrend: "stable",
        strengthTrend: "stable",
      },
      assessment: {
        present: "slight improvement of symptom(s).",
        patientChange: "slightly decreased",
        whatChanged: "muscles soreness sensation",
        physicalChange: "remained the same",
        findingType: "joint ROM limitation",
      },
    };
    const state = makeState({ symptomScale: "50%-60%" }, chain);
    const result = getAssessmentBinding(state, basePrev)!;
    const sxBinding = result.sBindings.find((b) => b.sField === "SxScale");
    expect(sxBinding).toBeTruthy();
    expect(sxBinding!.aField).toBe("muscles soreness sensation");
  });

  it("O-side: tightness reduced → oBindings includes with aField mapped", () => {
    const chain = {
      subjective: {
        painChange: "similar",
        frequencyChange: "stable",
        adlChange: "stable",
      },
      objective: {
        tightnessTrend: "reduced",
        tendernessTrend: "stable",
        spasmTrend: "stable",
        romTrend: "stable",
        strengthTrend: "stable",
      },
      assessment: {
        present: "similar symptom(s) as last visit.",
        patientChange: "remained the same",
        whatChanged: "as last time visit",
        physicalChange: "reduced",
        findingType: "local muscles tightness",
      },
    };
    const state = makeState({ tightnessGrading: "mild" }, chain);
    const result = getAssessmentBinding(state, basePrev)!;
    expect(result.oBindings).toHaveLength(1);
    expect(result.oBindings[0].oField).toBe("Tight");
    expect(result.oBindings[0].aField).toBe("local muscles tightness");
  });

  it("O-side: multiple trends → oBindings lists all with aField mapped", () => {
    const chain = {
      subjective: {
        painChange: "improved",
        frequencyChange: "stable",
        adlChange: "stable",
      },
      objective: {
        tightnessTrend: "reduced",
        tendernessTrend: "reduced",
        spasmTrend: "stable",
        romTrend: "improved",
        strengthTrend: "improved",
      },
      assessment: {
        present: "improvement of symptom(s).",
        patientChange: "decreased",
        whatChanged: "pain",
        physicalChange: "reduced",
        findingType:
          "joint ROM limitation, muscles strength, local muscles tightness and local muscles tenderness",
      },
    };
    const state = makeState(
      {
        tightnessGrading: "mild",
        tendernessGrading: "(+1)",
        strengthGrade: "4/5",
      },
      chain,
    );
    const result = getAssessmentBinding(state, basePrev)!;
    expect(result.oBindings).toHaveLength(4);
    expect(result.oBindings.every((b) => b.aField !== null)).toBe(true);
  });

  it("hasMismatch=true when S changed but A does not mention it", () => {
    const chain = {
      subjective: {
        painChange: "improved",
        frequencyChange: "stable",
        adlChange: "stable",
      },
      objective: {
        tightnessTrend: "stable",
        tendernessTrend: "stable",
        spasmTrend: "stable",
        romTrend: "stable",
        strengthTrend: "stable",
      },
      assessment: {
        present: "slight improvement of symptom(s).",
        patientChange: "slightly decreased",
        whatChanged: "pain",
        physicalChange: "remained the same",
        findingType: "joint ROM limitation",
      },
    };
    const state = makeState(
      { painScaleCurrent: 6, painScaleLabel: "6", symptomScale: "50%" },
      chain,
    );
    const result = getAssessmentBinding(state, basePrev)!;
    expect(result.hasMismatch).toBe(true);
    const sxBinding = result.sBindings.find((b) => b.sField === "SxScale");
    expect(sxBinding!.aField).toBeNull();
  });

  it("no changes → empty bindings", () => {
    const chain = {
      subjective: {
        painChange: "similar",
        frequencyChange: "stable",
        adlChange: "stable",
      },
      objective: {
        tightnessTrend: "stable",
        tendernessTrend: "stable",
        spasmTrend: "stable",
        romTrend: "stable",
        strengthTrend: "stable",
      },
      assessment: {
        present: "no change.",
        patientChange: "remained the same",
        whatChanged: "as last time visit",
        physicalChange: "remained the same",
        findingType: "last visit",
      },
    };
    const state = makeState({}, chain);
    const result = getAssessmentBinding(state, basePrev)!;
    expect(result.sBindings).toHaveLength(0);
    expect(result.oBindings).toHaveLength(0);
    expect(result.hasMismatch).toBe(false);
  });

  it("returns null when soaChain has no assessment", () => {
    const state = {
      ...basePrev,
      soaChain: { subjective: { painChange: "similar" } },
    };
    const result = getAssessmentBinding(state, basePrev);
    expect(result).toBeNull();
  });

  it("returns null when no soaChain at all", () => {
    const result = getAssessmentBinding({ ...basePrev }, basePrev);
    expect(result).toBeNull();
  });

  it("WriterPanel integration: binding result has correct shape for UI rendering", () => {
    const chain = {
      subjective: {
        painChange: "improved",
        frequencyChange: "improved",
        adlChange: "improved",
      },
      objective: {
        tightnessTrend: "reduced",
        tendernessTrend: "reduced",
        spasmTrend: "stable",
        romTrend: "improved",
        strengthTrend: "improved",
      },
      assessment: {
        present: "improvement of symptom(s).",
        patientChange: "decreased",
        whatChanged: "pain, pain frequency, difficulty in performing ADLs",
        physicalChange: "reduced",
        findingType:
          "joint ROM limitation, muscles strength, local muscles tightness and local muscles tenderness",
      },
    };
    const state = makeState(
      {
        painScaleCurrent: 5,
        painScaleLabel: "5",
        adlItems: ["a", "b"],
        tightnessGrading: "mild",
        tendernessGrading: "(+1)",
        strengthGrade: "4/5",
      },
      chain,
    );
    const result = getAssessmentBinding(state, basePrev)!;
    // S-side bindings for UI display
    expect(result.sBindings.length).toBeGreaterThanOrEqual(3);
    for (const b of result.sBindings) {
      expect(b).toHaveProperty("sField");
      expect(b).toHaveProperty("sFrom");
      expect(b).toHaveProperty("sTo");
      expect(b).toHaveProperty("aField");
    }
    // O-side bindings for UI display
    expect(result.oBindings.length).toBeGreaterThanOrEqual(3);
    for (const b of result.oBindings) {
      expect(b).toHaveProperty("oField");
      expect(b).toHaveProperty("trend");
      expect(b).toHaveProperty("oFrom");
      expect(b).toHaveProperty("oTo");
      expect(b).toHaveProperty("aField");
    }
    // Assessment text fields for display
    expect(result.present).toBeTruthy();
    expect(result.whatChanged).toBeTruthy();
    expect(result.findingType).toBeTruthy();
    expect(typeof result.hasMismatch).toBe("boolean");
  });
});
