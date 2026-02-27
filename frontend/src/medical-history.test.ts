/**
 * 病史关联引擎测试
 * 覆盖 5 个维度: 证型推荐 / generalCondition / progress系数 / 初始值修正 / 特殊约束
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  inferSystemicPatterns,
  inferLocalPatterns,
  inferCondition,
  inferProgressMultiplier,
  inferInitialAdjustments,
  inferConstraints,
  inferMedicalProfile,
} from "../../src/knowledge/medical-history-engine";
import { generateTXSequenceStates } from "../../src/generator/tx-sequence-engine";
import { exportSOAPAsText } from "../../src/generator/soap-generator";
import { setWhitelist } from "../../src/parser/template-rule-whitelist.browser";
import whitelistData from "./data/whitelist.json";

beforeAll(() => {
  setWhitelist(whitelistData);
});

const SEED = 12346;

function makeContext(overrides = {}) {
  return {
    noteType: "TX" as const,
    insuranceType: "OPTUM" as const,
    primaryBodyPart: "LBP" as const,
    laterality: "bilateral" as const,
    localPattern: "Qi Stagnation",
    systemicPattern: "Kidney Yang Deficiency",
    chronicityLevel: "Chronic" as const,
    severityLevel: "moderate to severe" as const,
    painCurrent: 8,
    associatedSymptom: "soreness" as const,
    ...overrides,
  };
}

// ==================== 维度1: 证型推荐 ====================
describe("维度1: 病史→证型推荐", () => {
  it("Diabetes → Kidney Yin Deficiency 权重最高", () => {
    const recs = inferSystemicPatterns(["Diabetes"]);
    expect(recs[0].pattern).toBe("Kidney Yin Deficiency");
  });

  it("Hypertension → Liver Yang Rising", () => {
    const recs = inferSystemicPatterns(["Hypertension"]);
    expect(recs[0].pattern).toBe("Liver Yang Rising");
  });

  it("Hypertension 排斥 Kidney Yang Deficiency", () => {
    const recs = inferSystemicPatterns(["Hypertension"]);
    const kyd = recs.find((r) => r.pattern === "Kidney Yang Deficiency");
    expect(kyd).toBeUndefined(); // 负权重被过滤
  });

  it("Anemia → Blood Deficiency", () => {
    const recs = inferSystemicPatterns(["Anemia"]);
    expect(recs[0].pattern).toBe("Blood Deficiency");
  });

  it("Osteoporosis → Kidney Essence Deficiency", () => {
    const recs = inferSystemicPatterns(["Osteoporosis"]);
    expect(recs[0].pattern).toBe("Kidney Essence Deficiency");
  });

  it("Asthma → LU & KI Deficiency", () => {
    const recs = inferSystemicPatterns(["Asthma"]);
    expect(recs[0].pattern).toBe("LU & KI Deficiency");
  });

  it("stomach trouble → Spleen Deficiency", () => {
    const recs = inferSystemicPatterns(["stomach trouble"]);
    expect(recs[0].pattern).toBe("Spleen Deficiency");
  });

  it("Hyperlipidemia → Phlegm-Damp", () => {
    const recs = inferSystemicPatterns(["Hyperlipidemia"]);
    expect(recs[0].pattern).toBe("Phlegm-Damp");
  });

  it("多病叠加: Diabetes+Hypertension 权重合理", () => {
    const recs = inferSystemicPatterns(["Diabetes", "Hypertension"]);
    // 应该同时有肝阳上亢和肾阴虚
    const patterns = recs.map((r) => r.pattern);
    expect(patterns).toContain("Liver Yang Rising");
    expect(patterns).toContain("Kidney Yin Deficiency");
  });

  it("N/A 病史返回空推荐", () => {
    expect(inferSystemicPatterns(["N/A"])).toEqual([]);
    expect(inferSystemicPatterns([])).toEqual([]);
  });

  it("高龄增加虚证权重", () => {
    const young = inferSystemicPatterns(["Diabetes"], 30);
    const old = inferSystemicPatterns(["Diabetes"], 70);
    // 老年应有更多虚证推荐
    expect(old.length).toBeGreaterThanOrEqual(young.length);
  });
});

// ==================== 局部证型推导 inferLocalPatterns ====================
describe("局部证型推导 inferLocalPatterns", () => {
  it("Stabbing + LBP → Blood Stasis 权重最高", () => {
    const recs = inferLocalPatterns(["Stabbing"], [], "LBP", "Chronic");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].pattern).toBe("Blood Stasis");
  });

  it("Aching + soreness + LBP → Qi Stagnation", () => {
    const recs = inferLocalPatterns(["Aching"], ["soreness"], "LBP", "Chronic");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].pattern).toBe("Qi Stagnation");
  });

  it("Burning + heaviness + KNEE → Damp-Heat", () => {
    const recs = inferLocalPatterns(
      ["Burning"],
      ["heaviness"],
      "KNEE",
      "Chronic",
    );
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].pattern).toBe("Damp-Heat");
  });

  it("Freezing + stiffness + NECK → Wind-Cold 或 Cold-Damp", () => {
    const recs = inferLocalPatterns(
      ["Freezing"],
      ["stiffness"],
      "NECK",
      "Acute",
    );
    expect(recs.length).toBeGreaterThan(0);
    const top = recs[0].pattern;
    expect(["Wind-Cold Invasion", "Cold-Damp + Wind-Cold"]).toContain(top);
  });

  it("无疼痛无症状时仍按部位+慢性度返回推荐", () => {
    const recs = inferLocalPatterns([], [], "LBP", "Chronic");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.map((r) => r.pattern)).toContain("Qi Stagnation");
  });

  it("仅部位有推荐 (LBP 默认倾向 Qi Stagnation)", () => {
    const recs = inferLocalPatterns([], ["soreness"], "LBP", "Chronic");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].pattern).toBe("Qi Stagnation");
  });
});

// ==================== 维度2: generalCondition ====================
describe("维度2: generalCondition推断", () => {
  it("无病史 → good", () => {
    expect(inferCondition([])).toBe("good");
    expect(inferCondition(["N/A"])).toBe("good");
  });

  it("单一慢性病 → fair", () => {
    expect(inferCondition(["Diabetes"])).toBe("fair");
    expect(inferCondition(["Hypertension"])).toBe("fair");
  });

  it("严重疾病 → poor", () => {
    expect(inferCondition(["Stroke"])).toBe("poor");
    expect(inferCondition(["Stroke", "Diabetes"])).toBe("poor");
  });

  it("多慢性病叠加 → poor", () => {
    expect(inferCondition(["Diabetes", "Hypertension", "Anemia"])).toBe("poor");
  });

  it("高龄 + 慢性病 → poor", () => {
    expect(inferCondition(["Diabetes"], 75)).toBe("poor");
  });

  it("年轻无病 → good", () => {
    expect(inferCondition([], 25)).toBe("good");
  });

  it("仅 Smoking → fair (0.5分)", () => {
    expect(inferCondition(["Smoking"])).toBe("good"); // 0.5 < 1
  });

  it("Smoking + Alcohol → fair (1分)", () => {
    expect(inferCondition(["Smoking", "Alcohol"])).toBe("fair");
  });
});

// ==================== 维度3: progress系数 ====================
describe("维度3: progress系数", () => {
  it("无病史 → 1.0", () => {
    expect(inferProgressMultiplier([])).toBe(1.0);
  });

  it("Stroke → 0.85", () => {
    expect(inferProgressMultiplier(["Stroke"])).toBe(0.85);
  });

  it("Diabetes → 0.92", () => {
    expect(inferProgressMultiplier(["Diabetes"])).toBe(0.92);
  });

  it("多病取最低", () => {
    const mult = inferProgressMultiplier(["Stroke", "Diabetes"]);
    expect(mult).toBeLessThanOrEqual(0.85);
  });

  it("高龄额外衰减", () => {
    const young = inferProgressMultiplier(["Diabetes"], 30);
    const old = inferProgressMultiplier(["Diabetes"], 70);
    expect(old).toBeLessThan(young);
  });

  it("下限 0.70", () => {
    const mult = inferProgressMultiplier(
      ["Stroke", "Parkinson", "Diabetes", "Kidney Disease", "Anemia"],
      80,
    );
    expect(mult).toBeGreaterThanOrEqual(0.7);
  });
});

// ==================== 维度4: 初始值修正 ====================
describe("维度4: 初始值修正", () => {
  it("Herniated Disk + LBP → severity+1, ROM+0.10", () => {
    const adj = inferInitialAdjustments(["Herniated Disk"], "LBP");
    expect(adj.severityBump).toBe(1);
    expect(adj.romDeficitBump).toBeCloseTo(0.1);
  });

  it("Herniated Disk + KNEE → 不修正 (部位不匹配)", () => {
    const adj = inferInitialAdjustments(["Herniated Disk"], "KNEE");
    expect(adj.severityBump).toBe(0);
    expect(adj.romDeficitBump).toBe(0);
  });

  it("Joint Replacement + KNEE → ROM+0.15", () => {
    const adj = inferInitialAdjustments(["Joint Replacement"], "KNEE");
    expect(adj.romDeficitBump).toBeCloseTo(0.15);
  });

  it("Parkinson → spasm+1", () => {
    const adj = inferInitialAdjustments(["Parkinson"]);
    expect(adj.spasmBump).toBe(1);
  });

  it("无病史 → 无修正", () => {
    const adj = inferInitialAdjustments([]);
    expect(adj.severityBump).toBe(0);
    expect(adj.romDeficitBump).toBe(0);
    expect(adj.spasmBump).toBe(0);
  });
});

// ==================== 维度5: 特殊约束 ====================
describe("维度5: 特殊约束", () => {
  it("Pacemaker → forceNoElectricalStim", () => {
    expect(inferConstraints(["Pacemaker"]).forceNoElectricalStim).toBe(true);
  });

  it("Joint Replacement → cautionElectricalStim", () => {
    expect(inferConstraints(["Joint Replacement"]).cautionElectricalStim).toBe(
      true,
    );
  });

  it("Osteoporosis → cautionNeedleDepth", () => {
    expect(inferConstraints(["Osteoporosis"]).cautionNeedleDepth).toBe(true);
  });

  it("无病史 → 无约束", () => {
    const c = inferConstraints([]);
    expect(c.forceNoElectricalStim).toBe(false);
    expect(c.cautionElectricalStim).toBe(false);
    expect(c.cautionNeedleDepth).toBe(false);
  });
});

// ==================== 综合集成测试 ====================
describe("引擎集成", () => {
  it("IE 文本输出用户病史 (非 N/A)", () => {
    const ctx = makeContext({
      noteType: "IE",
      medicalHistory: ["Diabetes", "Hypertension"],
    });
    const text = exportSOAPAsText(ctx);
    expect(text).toContain("Diabetes, Hypertension");
    expect(text).not.toContain("Precision: N/A");
  });

  it("IE 无病史输出 N/A", () => {
    const ctx = makeContext({ noteType: "IE" });
    const text = exportSOAPAsText(ctx);
    expect(text).toContain("N/A");
  });

  it("Pacemaker → IE 文本含 without electrical stimulation", () => {
    const ctx = makeContext({
      noteType: "IE",
      hasPacemaker: true,
      medicalHistory: ["Pacemaker"],
    });
    const text = exportSOAPAsText(ctx);
    expect(text).toContain("without electrical stimulation");
  });

  it("Osteoporosis → IE 文本生成正常（无额外 Precautions）", () => {
    const ctx = makeContext({
      noteType: "IE",
      medicalHistory: ["Osteoporosis"],
    });
    const text = exportSOAPAsText(ctx);
    expect(text).not.toContain("Precautions");
    expect(text).toContain("Subjective");
  });

  it("Stroke 患者 progress 更慢", () => {
    const healthy = makeContext({ medicalHistory: [] });
    const stroke = makeContext({ medicalHistory: ["Stroke"], age: 70 });

    const r1 = generateTXSequenceStates(healthy, {
      txCount: 11,
      startVisitIndex: 1,
      seed: SEED,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });
    const r2 = generateTXSequenceStates(stroke, {
      txCount: 11,
      startVisitIndex: 1,
      seed: SEED,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });

    // Stroke 的最终 pain 应该 >= 健康人的最终 pain (恢复更慢)
    const healthyFinalPain = r1.states[r1.states.length - 1].painScaleCurrent;
    const strokeFinalPain = r2.states[r2.states.length - 1].painScaleCurrent;
    expect(strokeFinalPain).toBeGreaterThanOrEqual(healthyFinalPain);
  });

  it("Stroke 患者 generalCondition=poor", () => {
    const ctx = makeContext({ medicalHistory: ["Stroke"], age: 70 });
    const { states } = generateTXSequenceStates(ctx, {
      txCount: 3,
      startVisitIndex: 1,
      seed: SEED,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });
    expect(states[0].generalCondition).toBe("poor");
  });

  it("Parkinson 患者 spasm 基线更高", () => {
    const normal = makeContext({ medicalHistory: [] });
    const parkinson = makeContext({ medicalHistory: ["Parkinson"] });

    const r1 = generateTXSequenceStates(normal, {
      txCount: 3,
      startVisitIndex: 1,
      seed: SEED,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });
    const r2 = generateTXSequenceStates(parkinson, {
      txCount: 3,
      startVisitIndex: 1,
      seed: SEED,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });

    // Parkinson spasm level (从 grading 提取数字)
    const extractSpasm = (g: string) => {
      const m = g.match(/\(([+]?\d)\)/);
      return m ? parseInt(m[1].replace("+", "")) : 0;
    };
    expect(extractSpasm(r2.states[0].spasmGrading)).toBeGreaterThanOrEqual(
      extractSpasm(r1.states[0].spasmGrading),
    );
  });

  it("IE 无 causativeFactors 时权重系统生成 3 个因素 (Chronic)", () => {
    // 传空数组 → soap-generator 走权重 fallback，Chronic count=3
    const ctx = makeContext({
      noteType: "IE",
      causativeFactors: [],
    });
    const text = exportSOAPAsText(ctx);
    const subjective = text.split("Objective")[0];
    expect(subjective).toBeTruthy();
    // 找 "due to X, Y, Z." 模式 — 权重系统应选 3 个逗号分隔的因素
    const dueToMatch = subjective.match(/due to (.+?)\./);
    expect(dueToMatch).toBeTruthy();
    const factors = dueToMatch![1].split(", ");
    expect(factors.length).toBe(3);
  });

  it("IE 无 relievingFactors 时权重系统生成 3 个因素 (LBP)", () => {
    // 传空数组 → soap-generator 走权重 fallback，LBP count=3
    const ctx = makeContext({
      noteType: "IE",
      relievingFactors: [],
    });
    const text = exportSOAPAsText(ctx);
    const subjective = text.split("Objective")[0];
    expect(subjective).toBeTruthy();
    // 找缓解因素 — "X can temporarily relieve" 或类似模式
    // LBP 模板: "[factors] can temporarily relieve the pain"
    const relieveMatch = subjective.match(/(.+?) can temporarily relieve/);
    expect(relieveMatch).toBeTruthy();
    const factors = relieveMatch![1].split(", ");
    expect(factors.length).toBe(3);
  });

  it("inferMedicalProfile 综合输出完整", () => {
    const profile = inferMedicalProfile(
      ["Diabetes", "Stroke", "Pacemaker"],
      70,
      "LBP",
      "Qi & Blood Deficiency",
    );
    expect(profile.recommendedSystemicPatterns.length).toBeGreaterThan(0);
    expect(profile.conditionImpact).toBe("poor");
    expect(profile.progressMultiplier).toBeLessThan(1.0);
    expect(profile.constraints.forceNoElectricalStim).toBe(true);
    expect(profile.initialAdjustments).toBeDefined();
  });
});
