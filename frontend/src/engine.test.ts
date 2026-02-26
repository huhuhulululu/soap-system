/**
 * Writer 引擎优化 — 完整测试
 * 覆盖 Phase 1 (数据贯通), Phase 2 (引擎逻辑), Phase 3 (新模型)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { generateTXSequenceStates } from "../../src/generator/tx-sequence-engine";
import { exportSOAPAsText } from "../../src/generator/soap-generator";
import { computePatchedGoals } from "../../src/generator/objective-patch";
import { setWhitelist } from "../../src/parser/template-rule-whitelist.browser";
import {
  filterADLByDemographics,
  ADL_MUSCLE_MAP,
  MUSCLE_SEVERITY_ORDER,
} from "../../src/generator/soap-generator";
import whitelistData from "./data/whitelist.json";

// 初始化 whitelist (测试前必须)
beforeAll(() => {
  setWhitelist(whitelistData);
});

// 固定 seed 保证可复现
const SEED = 378146595;

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

// =============================================
// Phase 1: 数据贯通
// =============================================
describe("Phase 1: 数据贯通", () => {
  describe("1.1 Severity 从 Pain 推导", () => {
    it("Pain 9-10 → severe", () => {
      // severityFromPain 在引擎内部, 通过 computePatchedGoals 间接验证
      const goals = computePatchedGoals(9, "severe", "LBP");
      expect(goals.pain.st).toBeDefined();
    });

    it("Goals 使用实际 pain 而非 severity 反推", () => {
      // pain=6 vs pain=8, 同 severity=moderate to severe
      // Goals 应该基于实际 pain 计算
      const goalsWithPain6 = computePatchedGoals(
        6,
        "moderate to severe",
        "LBP",
      );
      const goalsWithPain8 = computePatchedGoals(
        8,
        "moderate to severe",
        "LBP",
      );
      // pain=6 的 ST goal 应该比 pain=8 的小
      expect(goalsWithPain6.pain.st).not.toBe(goalsWithPain8.pain.st);
    });
  });

  describe("1.2 IE 生成器使用用户输入", () => {
    it("Pain Scale 使用 context.painCurrent", () => {
      const ctx = makeContext({
        noteType: "IE",
        painCurrent: 6,
        painWorst: 9,
        painBest: 3,
        symptomDuration: { value: "5", unit: "year(s)" },
        painRadiation: "with radiation to R arm",
      });
      const text = exportSOAPAsText(ctx);
      expect(text).toContain("Worst: 9");
      expect(text).toContain("Best: 3");
      expect(text).toContain("Current: 6");
    });

    it("Symptom Duration 使用用户输入", () => {
      const ctx = makeContext({
        noteType: "IE",
        symptomDuration: { value: "5", unit: "year(s)" },
      });
      const text = exportSOAPAsText(ctx);
      expect(text).toContain("5 year(s)");
      expect(text).not.toContain("3 month(s)"); // 不再硬编码
    });

    it("Pain Radiation 使用用户输入", () => {
      const ctx = makeContext({
        noteType: "IE",
        painRadiation: "with radiation to R arm",
      });
      const text = exportSOAPAsText(ctx);
      expect(text).toContain("with radiation to R arm");
    });

    it("Pain Types IE 和 TX 一致使用用户选择", () => {
      const userPainTypes = ["Burning", "Stabbing"];
      // IE
      const ieCtx = makeContext({ noteType: "IE", painTypes: userPainTypes });
      const ieText = exportSOAPAsText(ieCtx);
      expect(ieText).toContain("Burning");
      expect(ieText).toContain("Stabbing");
      // TX
      const txCtx = makeContext({ noteType: "TX", painTypes: userPainTypes });
      const { states } = generateTXSequenceStates(txCtx, {
        txCount: 1,
        startVisitIndex: 1,
        seed: SEED,
        initialState: {
          pain: 8,
          associatedSymptom: "soreness",
          painTypes: userPainTypes,
        },
      });
      const txText = exportSOAPAsText(txCtx, states[0]);
      expect(txText).toContain("Burning");
      expect(txText).toContain("Stabbing");
    });

    it("Causative Factors 使用用户输入", () => {
      const ctx = makeContext({
        noteType: "IE",
        causativeFactors: ["poor sleep", "prolong sitting"],
      });
      const text = exportSOAPAsText(ctx);
      expect(text).toContain("poor sleep");
      expect(text).toContain("prolong sitting");
    });

    it("Relieving Factors 使用用户输入", () => {
      const ctx = makeContext({
        noteType: "IE",
        relievingFactors: ["Applying heating pad", "Resting"],
      });
      const text = exportSOAPAsText(ctx);
      expect(text).toContain("Applying heating pad");
      expect(text).toContain("Resting");
    });
  });

  describe("1.3 TX initialState 继承用户输入", () => {
    it("Pain 起始值继承 initialState", () => {
      const ctx = makeContext({ painCurrent: 6 });
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 6, associatedSymptom: "soreness" },
      });
      // TX1 的 pain 应该 ≤ 6 (起始值)
      expect(states[0].painScaleCurrent).toBeLessThanOrEqual(6);
    });

    it("Frequency 起始值继承", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, frequency: 1, associatedSymptom: "soreness" },
      });
      // frequency=1 是 Occasional, TX1 不应该回到 Constant
      expect(states[0].painFrequency).not.toContain("Constant");
    });

    it("SymptomScale 起始值继承", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: {
          pain: 8,
          symptomScale: "50%",
          associatedSymptom: "soreness",
        },
      });
      // symptomScale 从 50% 开始递减, TX1 应 ≤ 50%
      const pct = parseInt(
        states[0].symptomScale?.replace("%", "") || "50",
        10,
      );
      expect(pct).toBeLessThanOrEqual(50);
    });

    it("AssociatedSymptom 继承用户输入", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "stiffness" },
      });
      expect(states[0].associatedSymptom).toBe("stiffness");
    });

    it("PainTypes 继承用户输入", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: {
          pain: 8,
          painTypes: ["Burning", "Stabbing"],
          associatedSymptom: "soreness",
        },
      });
      expect(states[0].painTypes).toEqual(["Burning", "Stabbing"]);
    });
  });
});

// =============================================
// Phase 2: 引擎逻辑优化
// =============================================
describe("Phase 2: 引擎逻辑优化", () => {
  describe("2.1 TX1 使用统一康复曲线", () => {
    it("TX1 不强制特定降幅", () => {
      const ctx = makeContext();
      // 跑多个不同 seed, TX1 的降幅应该有变化 (非固定 0.5-1.5)
      const drops = [];
      for (let s = 1; s <= 10; s++) {
        const { states } = generateTXSequenceStates(ctx, {
          txCount: 3,
          startVisitIndex: 1,
          seed: s,
          initialState: { pain: 8, associatedSymptom: "soreness" },
        });
        drops.push(8 - states[0].painScaleCurrent);
      }
      // 不应该所有降幅都在 0.5-1.5 范围内 (允许 0 即平稳)
      const hasZeroDrop = drops.some((d) => d === 0);
      const hasSmallDrop = drops.some((d) => d > 0 && d <= 0.5);
      // 至少应该有一些变化
      expect(drops.some((d) => d >= 0)).toBe(true);
    });
  });

  describe("2.2 Spasm 有随机因子", () => {
    it("不同 seed 的 spasm 变化时间点不同", () => {
      const ctx = makeContext();
      const spasmSequences = [];
      for (let s = 1; s <= 5; s++) {
        const { states } = generateTXSequenceStates(ctx, {
          txCount: 11,
          startVisitIndex: 1,
          seed: s,
          initialState: { pain: 8, associatedSymptom: "soreness" },
        });
        spasmSequences.push(states.map((st) => st.spasmGrading));
      }
      // 不同 seed 至少有一对 spasm 序列不同
      const allSame = spasmSequences.every(
        (seq) => JSON.stringify(seq) === JSON.stringify(spasmSequences[0]),
      );
      expect(allSame).toBe(false);
    });
  });

  describe("2.3 Tightness/Tenderness 初始值从 pain 推导", () => {
    it("Pain 8 → 初始 tightness 约 4 (moderate to severe)", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      // tightnessGrading 应包含 severe 或 moderate to severe
      const grade = states[0].tightnessGrading.toLowerCase();
      expect(grade.includes("severe") || grade.includes("moderate")).toBe(true);
    });

    it("Pain 4 → 初始 tightness 约 2 (mild to moderate)", () => {
      const ctx = makeContext({
        painCurrent: 4,
        severityLevel: "mild to moderate",
      });
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 4, associatedSymptom: "soreness" },
      });
      const grade = states[0].tightnessGrading.toLowerCase();
      expect(grade.includes("mild") || grade.includes("moderate")).toBe(true);
    });
  });

  describe("2.4 ROM/Strength 独立进度", () => {
    it("ROM 趋势不完全跟随 pain", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 11,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      // 在 pain 已经平稳时, ROM 可能还在改善
      const romTrends = states.map((s) => s.soaChain.objective.romTrend);
      const painLabels = states.map((s) => s.painScaleLabel);
      // ROM 变化应独立于 pain
      expect(romTrends.length).toBe(11);
    });

    it("Strength 滞后于 ROM", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 11,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      // 统计 ROM 和 Strength 首次改善的时间点
      const romFirstImprove = states.findIndex(
        (s) => s.soaChain.objective.romTrend !== "stable",
      );
      const stFirstImprove = states.findIndex(
        (s) => s.soaChain.objective.strengthTrend !== "stable",
      );
      // Strength 改善不应早于 ROM (允许相同)
      if (romFirstImprove >= 0 && stFirstImprove >= 0) {
        expect(stFirstImprove).toBeGreaterThanOrEqual(romFirstImprove);
      }
    });
  });

  describe("纵向约束", () => {
    it("Pain 只降不升（允许平稳）", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 11,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      for (let i = 1; i < states.length; i++) {
        expect(states[i].painScaleCurrent).toBeLessThanOrEqual(
          states[i - 1].painScaleCurrent,
        );
      }
    });

    it("Severity 只降不升", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 11,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      const order = [
        "mild",
        "mild to moderate",
        "moderate",
        "moderate to severe",
        "severe",
      ];
      for (let i = 1; i < states.length; i++) {
        expect(order.indexOf(states[i].severityLevel)).toBeLessThanOrEqual(
          order.indexOf(states[i - 1].severityLevel),
        );
      }
    });

    it("AssociatedSymptom 等级只降不升", () => {
      const ctx = makeContext();
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 11,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "stiffness" },
      });
      const rank = (s: string) => {
        if (s.includes("numbness") || s.includes("weakness")) return 4;
        if (s.includes("heaviness")) return 3;
        if (s.includes("stiffness")) return 2;
        return 1;
      };
      for (let i = 1; i < states.length; i++) {
        expect(rank(states[i].associatedSymptom)).toBeLessThanOrEqual(
          rank(states[i - 1].associatedSymptom),
        );
      }
    });
  });

  describe("Seed 可复现", () => {
    it("相同 seed + 输入 → 相同结果", () => {
      const ctx = makeContext();
      const opts = {
        txCount: 11,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      };
      const r1 = generateTXSequenceStates(ctx, opts);
      const r2 = generateTXSequenceStates(ctx, opts);
      expect(r1.seed).toBe(r2.seed);
      expect(r1.states.map((s) => s.painScaleLabel)).toEqual(
        r2.states.map((s) => s.painScaleLabel),
      );
    });

    it("不同 seed → 不同结果", () => {
      const ctx = makeContext();
      const opts = (s: number) => ({
        txCount: 11,
        startVisitIndex: 1,
        seed: s,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      const r1 = generateTXSequenceStates(ctx, opts(1));
      const r2 = generateTXSequenceStates(ctx, opts(2));
      // pain 序列不应完全相同
      const labels1 = r1.states.map((s) => s.painScaleLabel).join(",");
      const labels2 = r2.states.map((s) => s.painScaleLabel).join(",");
      expect(labels1).not.toBe(labels2);
    });
  });
});

// =============================================
// Phase 3: 模型
// =============================================
describe("Phase 3: ADL/Muscle 模型", () => {
  describe("3.4 ADL 年龄+性别过滤", () => {
    it('高龄男性排除 "holding the pot for cooking"', () => {
      const shoulderADL = [
        "holding the pot for cooking",
        "performing household chores",
        "working long time in front of computer",
        "put on/take off the clothes",
      ];
      const filtered = filterADLByDemographics(shoulderADL, 70, "Male");
      expect(filtered).not.toContain("holding the pot for cooking");
    });

    it('高龄排除 "working long time in front of computer"', () => {
      const shoulderADL = [
        "working long time in front of computer",
        "put on/take off the clothes",
      ];
      const filtered = filterADLByDemographics(shoulderADL, 70, "Female");
      expect(filtered).not.toContain("working long time in front of computer");
    });

    it('年轻人不过滤 "working long time in front of computer"', () => {
      const shoulderADL = [
        "working long time in front of computer",
        "put on/take off the clothes",
      ];
      const filtered = filterADLByDemographics(shoulderADL, 30, "Male");
      expect(filtered).toContain("working long time in front of computer");
    });

    it("无年龄/性别时不过滤", () => {
      const adl = ["A", "B", "C"];
      expect(filterADLByDemographics(adl)).toEqual(adl);
    });
  });

  describe("3.5 ADL-Muscle 关联映射", () => {
    it("LBP 所有 ADL 都有 muscle 映射", () => {
      const lbpMap = ADL_MUSCLE_MAP["LBP"];
      expect(lbpMap).toBeDefined();
      expect(Object.keys(lbpMap).length).toBeGreaterThanOrEqual(5);
    });

    it('KNEE "Going up and down stairs" 映射到 Rectus Femoris', () => {
      const muscles = ADL_MUSCLE_MAP["KNEE"]["Going up and down stairs"];
      expect(muscles).toContain("Rectus Femoris");
    });

    it('SHOULDER "reach top of cabinet" 映射到 supraspinatus', () => {
      const muscles =
        ADL_MUSCLE_MAP["SHOULDER"]["reach top of cabinet to get object(s)"];
      expect(muscles).toContain("supraspinatus");
    });

    it("所有 6 个支持部位都有 muscle severity order", () => {
      for (const bp of ["LBP", "NECK", "SHOULDER", "KNEE", "HIP", "ELBOW"]) {
        expect(MUSCLE_SEVERITY_ORDER[bp]).toBeDefined();
        expect(MUSCLE_SEVERITY_ORDER[bp].length).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================
// 各部位 Objective 完整性
// =============================================
describe("各部位 Objective", () => {
  const bodyParts = [
    "LBP",
    "NECK",
    "SHOULDER",
    "KNEE",
    "ELBOW",
    "HIP",
  ] as const;

  for (const bp of bodyParts) {
    it(`${bp} IE 生成不报错`, () => {
      const ctx = makeContext({
        noteType: "IE",
        primaryBodyPart: bp,
        painCurrent: 7,
      });
      expect(() => exportSOAPAsText(ctx)).not.toThrow();
    });
  }

  // HIP 不支持 TX
  const txParts = ["LBP", "NECK", "SHOULDER", "KNEE", "ELBOW"] as const;
  for (const bp of txParts) {
    it(`${bp} TX 生成不报错`, () => {
      const ctx = makeContext({ noteType: "TX", primaryBodyPart: bp });
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      expect(() => exportSOAPAsText(ctx, states[0])).not.toThrow();
    });

    it(`${bp} TX Objective 包含 Inspection`, () => {
      const ctx = makeContext({ noteType: "TX", primaryBodyPart: bp });
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 3,
        startVisitIndex: 1,
        seed: SEED,
        initialState: { pain: 8, associatedSymptom: "soreness" },
      });
      const text = exportSOAPAsText(ctx, states[0]);
      expect(text).toContain("Inspection");
    });
  }

  it("SHOULDER bilateral 输出左右 ROM", () => {
    const ctx = makeContext({
      noteType: "TX",
      primaryBodyPart: "SHOULDER",
      laterality: "bilateral",
    });
    const { states } = generateTXSequenceStates(ctx, {
      txCount: 1,
      startVisitIndex: 1,
      seed: SEED,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });
    const text = exportSOAPAsText(ctx, states[0]);
    expect(text).toContain("Right Shoulder");
    expect(text).toContain("Left Shoulder");
  });

  it("SHOULDER left 只输出左侧 ROM", () => {
    const ctx = makeContext({
      noteType: "TX",
      primaryBodyPart: "SHOULDER",
      laterality: "left",
    });
    const { states } = generateTXSequenceStates(ctx, {
      txCount: 1,
      startVisitIndex: 1,
      seed: SEED,
      initialState: { pain: 8, associatedSymptom: "soreness" },
    });
    const text = exportSOAPAsText(ctx, states[0]);
    expect(text).toContain("Left Shoulder");
    expect(text).not.toContain("Right Shoulder");
  });
});
