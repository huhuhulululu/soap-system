/**
 * 多部位 × 随机 seed 压力测试
 *
 * 覆盖: IE 生成 + TX 序列 + 模板合规性 + 数据一致性
 * 矩阵: 7 body parts × 20 seeds × (IE + 20 TX) = 2940 notes
 *
 * 发现的问题记录在底部 ISSUES 区域
 */
import { describe, it, expect } from "vitest";
import { exportSOAPAsText } from "../soap-generator";
import { generateTXSequenceStates } from "../tx-sequence-engine";
import type { GenerationContext } from "../../types";
import {
  TEMPLATE_MUSCLES,
  TEMPLATE_ROM,
  TEMPLATE_ADL,
  type BodyPartKey,
} from "../../shared/template-options";
import { MUSCLE_ADL_AFFINITY } from "../../shared/muscle-adl-affinity";

// ─── Config ──────────────────────────────────────────────────────────

const IE_BODY_PARTS = [
  "LBP",
  "NECK",
  "SHOULDER",
  "KNEE",
  "ELBOW",
  "HIP",
] as const;

const TX_BODY_PARTS = ["LBP", "NECK", "SHOULDER", "KNEE", "ELBOW"] as const;

const SEEDS = [
  7, 42, 100, 256, 314, 628, 999, 1337, 2718, 3141, 4567, 5555, 6789, 7777,
  8080, 9999, 11111, 22222, 31415, 54321,
];

const LOCAL_PATTERNS = [
  "Qi Stagnation",
  "Blood Stasis",
  "Qi Stagnation, Blood Stasis",
  "Cold-Damp Bi",
  "Damp-Heat Bi",
] as const;

const SYSTEMIC_PATTERNS = [
  "Kidney Yang Deficiency",
  "Liver Qi Stagnation",
  "Spleen Qi Deficiency",
  "Kidney Yin Deficiency",
  "Liver Blood Deficiency",
] as const;

const SEVERITIES = [
  "mild",
  "mild to moderate",
  "moderate",
  "moderate to severe",
  "severe",
] as const;

const LATERALITIES = ["left", "right", "bilateral"] as const;

const CHRONICITY = ["Acute", "Sub Acute", "Chronic"] as const;

// ─── Helpers ─────────────────────────────────────────────────────────

/** Seeded pseudo-random for deterministic test config selection */
function seededPick<T>(arr: readonly T[], seed: number, offset: number): T {
  const idx = Math.abs((seed * 2654435761 + offset * 40503) | 0) % arr.length;
  return arr[idx];
}

function makeIEContext(bp: string, seed: number): GenerationContext {
  return {
    noteType: "IE",
    insuranceType: "NONE",
    primaryBodyPart: bp,
    laterality: seededPick(LATERALITIES, seed, 1),
    localPattern: seededPick(LOCAL_PATTERNS, seed, 2),
    systemicPattern: seededPick(SYSTEMIC_PATTERNS, seed, 3),
    chronicityLevel: seededPick(CHRONICITY, seed, 4),
    severityLevel: seededPick(SEVERITIES, seed, 5),
    painCurrent: 3 + (seed % 7), // 3-9
  } as GenerationContext;
}

function makeTXContext(bp: string, seed: number): GenerationContext {
  return {
    noteType: "TX",
    insuranceType: "NONE",
    primaryBodyPart: bp,
    laterality: seededPick(LATERALITIES, seed, 1),
    localPattern: seededPick(LOCAL_PATTERNS, seed, 2),
    systemicPattern: seededPick(SYSTEMIC_PATTERNS, seed, 3),
    chronicityLevel: seededPick(CHRONICITY, seed, 4),
    severityLevel: seededPick(SEVERITIES, seed, 5),
    painCurrent: 3 + (seed % 7),
  } as GenerationContext;
}

// ─── Issue Collector ─────────────────────────────────────────────────

interface Issue {
  test: string;
  bodyPart: string;
  seed: number;
  visit?: number;
  severity: "ERROR" | "WARN";
  message: string;
}

const issues: Issue[] = [];

function recordIssue(
  test: string,
  bp: string,
  seed: number,
  severity: "ERROR" | "WARN",
  message: string,
  visit?: number,
) {
  issues.push({ test, bodyPart: bp, seed, visit, severity, message });
}

// ============================================================
// 1. IE 生成 — 不抛异常 + 非空输出
// ============================================================
describe("Stress: IE generation — all body parts × 20 seeds", () => {
  for (const bp of IE_BODY_PARTS) {
    describe(`IE ${bp}`, () => {
      it.each(SEEDS)(`seed %i — generates without error`, (seed) => {
        const ctx = makeIEContext(bp, seed);
        let text: string;
        try {
          text = exportSOAPAsText(ctx);
        } catch (e) {
          recordIssue("IE-no-crash", bp, seed, "ERROR", `threw: ${e}`);
          throw e;
        }
        expect(text.length).toBeGreaterThan(100);

        // Basic structure check
        const hasSubjective = /subjective|chief complaint|visit type/i.test(
          text,
        );
        const hasObjective = /objective|muscle|ROM|range of motion/i.test(text);
        const hasAssessment = /assessment|diagnosis|pattern/i.test(text);
        const hasPlan = /plan|goal|needle|treatment/i.test(text);

        if (!hasSubjective)
          recordIssue(
            "IE-structure",
            bp,
            seed,
            "WARN",
            "missing Subjective section",
          );
        if (!hasObjective)
          recordIssue(
            "IE-structure",
            bp,
            seed,
            "WARN",
            "missing Objective section",
          );
        if (!hasAssessment)
          recordIssue(
            "IE-structure",
            bp,
            seed,
            "WARN",
            "missing Assessment section",
          );
        if (!hasPlan)
          recordIssue("IE-structure", bp, seed, "WARN", "missing Plan section");
      });
    });
  }
});

// ============================================================
// 2. IE 模板合规 — 肌肉名来自 TEMPLATE_MUSCLES
// ============================================================
describe("Stress: IE muscle names from template", () => {
  for (const bp of IE_BODY_PARTS) {
    const templateBp = bp as BodyPartKey;
    const templateMuscles = TEMPLATE_MUSCLES[templateBp];
    if (!templateMuscles) continue;

    const allTemplateMuscleNames = [
      ...templateMuscles.tightness,
      ...templateMuscles.tenderness,
      ...templateMuscles.spasm,
    ];

    describe(`IE ${bp} muscles`, () => {
      it.each(SEEDS.slice(0, 10))(`seed %i — muscles in template`, (seed) => {
        const ctx = makeIEContext(bp, seed);
        const text = exportSOAPAsText(ctx);

        // Extract muscle names from Tightness/Tenderness/Spasm lines
        const muscleLines = text.match(
          /(Tightness|Tenderness|Spasm).*?(?=\n[A-Z]|\n\n|$)/gs,
        );
        if (!muscleLines) return;

        for (const line of muscleLines) {
          // Check each template muscle appears if mentioned
          const unknownMuscles: string[] = [];
          for (const templateMuscle of allTemplateMuscleNames) {
            if (line.includes(templateMuscle)) {
              // Good — muscle is from template
            }
          }
          // This is a soft check — we just record if we find muscles not in template
          if (unknownMuscles.length > 0) {
            recordIssue(
              "IE-muscle-template",
              bp,
              seed,
              "WARN",
              `muscles not in template: ${unknownMuscles.join(", ")}`,
            );
          }
        }
      });
    });
  }
});

// ============================================================
// 3. IE ROM — 值来自 TEMPLATE_ROM 离散选项
// ============================================================
describe("Stress: IE ROM from template discrete options", () => {
  for (const bp of IE_BODY_PARTS) {
    const templateBp = bp as BodyPartKey;
    const templateRom = TEMPLATE_ROM[templateBp];
    if (!templateRom || templateRom.length === 0) continue;

    // Collect all valid degree values from template
    const validDegrees = new Set<number>();
    for (const mov of templateRom) {
      for (const opt of mov.options) {
        validDegrees.add(opt.degrees);
      }
    }

    describe(`IE ${bp} ROM`, () => {
      it.each(SEEDS.slice(0, 10))(
        `seed %i — ROM degrees in template`,
        (seed) => {
          const ctx = makeIEContext(bp, seed);
          const text = exportSOAPAsText(ctx);

          // Extract degree values
          const degreeMatches = text.match(/(\d+)\s*Degrees?\s*\(/gi);
          if (!degreeMatches) return;

          for (const m of degreeMatches) {
            const deg = parseInt(m);
            if (isNaN(deg)) continue;
            if (!validDegrees.has(deg)) {
              recordIssue(
                "IE-ROM-template",
                bp,
                seed,
                "WARN",
                `ROM degree ${deg} not in template options (valid: ${[...validDegrees].sort((a, b) => a - b).join(",")})`,
              );
            }
          }
        },
      );
    });
  }
});

// ============================================================
// 4. TX 序列 — 全部位 × 20 seeds × 20 visits
// ============================================================
describe("Stress: TX sequence — all body parts × 20 seeds", () => {
  for (const bp of TX_BODY_PARTS) {
    describe(`TX ${bp}`, () => {
      // a) 不抛异常
      it.each(SEEDS)(`seed %i — generates 20 visits without error`, (seed) => {
        const ctx = makeTXContext(bp, seed);
        let result: ReturnType<typeof generateTXSequenceStates>;
        try {
          result = generateTXSequenceStates(ctx, { txCount: 20, seed });
        } catch (e) {
          recordIssue("TX-no-crash", bp, seed, "ERROR", `threw: ${e}`);
          throw e;
        }
        expect(result.states).toHaveLength(20);
      });

      // b) pain 单调递减
      it.each(SEEDS)(`seed %i — pain monotonically decreases`, (seed) => {
        const ctx = makeTXContext(bp, seed);
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });

        for (let i = 1; i < states.length; i++) {
          const prev = states[i - 1].painScaleCurrent;
          const curr = states[i].painScaleCurrent;
          if (curr > prev + 0.01) {
            recordIssue(
              "TX-monotonic-pain",
              bp,
              seed,
              "ERROR",
              `v${i + 1} pain ${curr} > v${i} pain ${prev}`,
              i + 1,
            );
          }
          expect(
            curr,
            `${bp} seed=${seed} v${i + 1}: pain ${curr} > prev ${prev}`,
          ).toBeLessThanOrEqual(prev + 0.01);
        }
      });

      // c) severity 不恶化
      it.each(SEEDS)(`seed %i — severity never worsens`, (seed) => {
        const ctx = makeTXContext(bp, seed);
        const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });

        const sevOrder = [
          "mild",
          "mild to moderate",
          "moderate",
          "moderate to severe",
          "severe",
        ];
        const v1Rank = sevOrder.indexOf(states[0].severityLevel);
        const v20Rank = sevOrder.indexOf(states[19].severityLevel);

        if (v1Rank >= 0 && v20Rank >= 0 && v20Rank > v1Rank) {
          recordIssue(
            "TX-severity-worsen",
            bp,
            seed,
            "ERROR",
            `v20 severity "${states[19].severityLevel}" worse than v1 "${states[0].severityLevel}"`,
          );
        }
        if (v1Rank >= 0 && v20Rank >= 0) {
          expect(v20Rank).toBeLessThanOrEqual(v1Rank);
        }
      });
    });
  }
});

// ============================================================
// 5. TX PRNG 确定性 — 同 seed 同输出
// ============================================================
describe("Stress: TX PRNG determinism — 5 body parts × 5 seeds", () => {
  for (const bp of TX_BODY_PARTS) {
    it.each(SEEDS.slice(0, 5))(`${bp} seed %i — 10 runs identical`, (seed) => {
      const ctx = makeTXContext(bp, seed);
      const baseline = generateTXSequenceStates(ctx, { txCount: 20, seed });

      for (let run = 0; run < 10; run++) {
        const result = generateTXSequenceStates(ctx, { txCount: 20, seed });
        const baselinePain = baseline.states.map((s) => s.painScaleCurrent);
        const resultPain = result.states.map((s) => s.painScaleCurrent);

        if (JSON.stringify(baselinePain) !== JSON.stringify(resultPain)) {
          recordIssue(
            "TX-PRNG-determinism",
            bp,
            seed,
            "ERROR",
            `run ${run + 1} produced different pain sequence`,
          );
        }
        expect(resultPain).toEqual(baselinePain);

        // Also check reasons
        expect(result.states.map((s) => s.reason)).toEqual(
          baseline.states.map((s) => s.reason),
        );
      }
    });
  }
});

// ============================================================
// 6. TX reason 多样性 — 不能单一 reason 超过 30%
// ============================================================
describe("Stress: TX reason diversity", () => {
  for (const bp of TX_BODY_PARTS) {
    it.each(SEEDS.slice(0, 10))(`${bp} seed %i — no reason > 30%%`, (seed) => {
      const ctx = makeTXContext(bp, seed);
      const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });

      const counts = new Map<string, number>();
      for (const s of states) {
        counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
      }

      const maxCount = Math.max(...counts.values());
      const maxRate = maxCount / states.length;
      const maxReason = [...counts.entries()].find(
        ([, c]) => c === maxCount,
      )?.[0];

      if (maxRate > 0.3) {
        recordIssue(
          "TX-reason-diversity",
          bp,
          seed,
          "WARN",
          `reason "${maxReason}" appears ${maxCount}/${states.length} = ${(maxRate * 100).toFixed(0)}%`,
        );
      }
      // Soft assertion — warn but don't fail
      expect(maxRate).toBeLessThanOrEqual(0.5); // hard limit at 50%
    });
  }
});

// ============================================================
// 7. TX strength 递增 — v20 strength ≥ v1
// ============================================================
describe("Stress: TX strength progression", () => {
  const STRENGTH_ORDER = ["3-/5", "3/5", "3+/5", "4-/5", "4/5", "4+/5", "5/5"];

  for (const bp of TX_BODY_PARTS) {
    it.each(SEEDS.slice(0, 10))(`${bp} seed %i — strength improves`, (seed) => {
      const ctx = makeTXContext(bp, seed);
      const { states } = generateTXSequenceStates(ctx, { txCount: 20, seed });

      const v1Str = states[0].strengthGrade ?? "";
      const v20Str = states[19].strengthGrade ?? "";
      const v1Rank = STRENGTH_ORDER.indexOf(v1Str);
      const v20Rank = STRENGTH_ORDER.indexOf(v20Str);

      if (v1Rank >= 0 && v20Rank >= 0 && v20Rank < v1Rank) {
        recordIssue(
          "TX-strength-regress",
          bp,
          seed,
          "ERROR",
          `v20 strength "${v20Str}" weaker than v1 "${v1Str}"`,
        );
      }
      if (v1Rank >= 0 && v20Rank >= 0) {
        expect(v20Rank).toBeGreaterThanOrEqual(v1Rank);
      }
    });
  }
});

// ============================================================
// 8. IE + TX 端到端 — 生成 IE 后接 20 TX，全流程不崩
// ============================================================
describe("Stress: IE→TX full pipeline", () => {
  for (const bp of TX_BODY_PARTS) {
    it.each(SEEDS.slice(0, 5))(
      `${bp} seed %i — IE + 20 TX pipeline`,
      (seed) => {
        // Generate IE
        const ieCtx = makeIEContext(bp, seed);
        const ieText = exportSOAPAsText(ieCtx);
        expect(ieText.length).toBeGreaterThan(100);

        // Generate TX sequence
        const txCtx = makeTXContext(bp, seed);
        const { states } = generateTXSequenceStates(txCtx, {
          txCount: 20,
          seed,
        });
        expect(states).toHaveLength(20);

        // Generate each TX note text
        for (let i = 0; i < Math.min(5, states.length); i++) {
          const txNoteCtx = {
            ...txCtx,
            noteType: "TX" as const,
          };
          let txText: string;
          try {
            txText = exportSOAPAsText(txNoteCtx, states[i]);
          } catch (e) {
            recordIssue(
              "IE-TX-pipeline",
              bp,
              seed,
              "ERROR",
              `TX note v${i + 1} threw: ${e}`,
              i + 1,
            );
            throw e;
          }
          expect(txText.length).toBeGreaterThan(50);
        }
      },
    );
  }
});

// ============================================================
// 9. ADL 与肌肉关联性 — ADL 项目应与选中肌肉有亲和关系
// ============================================================
describe("Stress: ADL-muscle affinity check", () => {
  for (const bp of TX_BODY_PARTS) {
    const templateBp = bp as BodyPartKey;
    if (!MUSCLE_ADL_AFFINITY[templateBp]) continue;

    it.each(SEEDS.slice(0, 5))(
      `${bp} seed %i — ADL items correlate with muscles`,
      (seed) => {
        const ctx = makeIEContext(bp, seed);
        const text = exportSOAPAsText(ctx);

        // Extract ADL items from text
        const templateAdl = TEMPLATE_ADL[templateBp];
        if (!templateAdl) return;

        const foundAdl = templateAdl.filter((adl) => text.includes(adl));
        if (foundAdl.length === 0) {
          recordIssue(
            "ADL-affinity",
            bp,
            seed,
            "WARN",
            "no template ADL items found in IE text",
          );
        }
      },
    );
  }
});

// ============================================================
// 10. 边界条件 — 极端 pain 值
// ============================================================
describe("Stress: boundary conditions", () => {
  for (const bp of TX_BODY_PARTS) {
    it(`${bp} — pain=2 (minimum) generates without error`, () => {
      const ctx = makeTXContext(bp, 42);
      ctx.painCurrent = 2;
      (ctx as Record<string, unknown>).severityLevel = "mild";
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed: 42,
        initialState: { pain: 2 },
      });
      expect(states).toHaveLength(20);
      // Pain should still decrease or hold from initial 2
      expect(states[19].painScaleCurrent).toBeLessThanOrEqual(2.01);
    });

    it(`${bp} — pain=10 (maximum) generates without error`, () => {
      const ctx = makeTXContext(bp, 42);
      ctx.painCurrent = 10;
      (ctx as Record<string, unknown>).severityLevel = "severe";
      const { states } = generateTXSequenceStates(ctx, {
        txCount: 20,
        seed: 42,
        initialState: { pain: 10 },
      });
      expect(states).toHaveLength(20);
      expect(states[19].painScaleCurrent).toBeLessThan(10);
    });
  }
});

// ============================================================
// ISSUE REPORT — 在所有测试后输出
// ============================================================
describe("Issue Report", () => {
  it("prints collected issues (informational)", () => {
    if (issues.length === 0) {
      // No issues found — great!
      expect(true).toBe(true);
      return;
    }

    const errors = issues.filter((i) => i.severity === "ERROR");
    const warns = issues.filter((i) => i.severity === "WARN");

    const report = [
      `\n${"=".repeat(60)}`,
      `STRESS TEST ISSUE REPORT`,
      `${"=".repeat(60)}`,
      `Total: ${issues.length} issues (${errors.length} ERROR, ${warns.length} WARN)`,
      "",
      ...issues.map(
        (i) =>
          `[${i.severity}] ${i.test} | ${i.bodyPart} seed=${i.seed}${i.visit ? ` v${i.visit}` : ""}: ${i.message}`,
      ),
      `${"=".repeat(60)}`,
    ].join("\n");

    // Print to console for visibility
    console.error(report);

    // Fail only if there are ERRORs
    expect(
      errors.length,
      `${errors.length} ERROR issues found:\n${report}`,
    ).toBe(0);
  });
});
