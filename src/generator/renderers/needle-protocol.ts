/**
 * Needle Protocol renderer — W3 Step 7
 *
 * Export: generateNeedleProtocol — 针刺协议段落 (plan 末尾附加)
 *
 * 该 renderer 是 soap-generator 中最大的单函数（~417 LOC），负责 KNEE/
 * SHOULDER/LBP/NECK 四个专用协议 + 其他部位通用协议，以及 97810 单代码短协议。
 *
 * INSURANCE_NEEDLE_MAP 是该文件私有 const（原位于 soap-generator.ts，plan
 * 保留在 barrel 但 W3 Step 7 实际落点是 needle-protocol.ts，因仅该函数使用）。
 */

import type { GenerationContext, InsuranceType } from "../../types";
import type { TXVisitState } from "../tx-sequence-engine";
import { BODY_PART_NAMES } from "../../shared/body-part-constants";
import type { BodyPartKey, NeedleGroups } from "../../shared/template-options";
import {
  TEMPLATE_NEEDLE_SIZE,
  TEMPLATE_NEEDLE_POINTS,
} from "../../shared/template-options";

/**
 * 保险类型到针刺模板的映射
 */
const INSURANCE_NEEDLE_MAP: Record<InsuranceType, "97810" | "full"> = {
  NONE: "full",
  HF: "97810",
  OPTUM: "97810",
  WC: "full",
  VC: "full",
  ELDERPLAN: "full",
};

/**
 * 生成针刺协议
 *
 * KNEE 模板结构 (来自 acupuncture knee pain.md):
 *   Step 1: Front - right knee with e-stim
 *   Step 2: Front - left knee with e-stim
 *   Step 3: Back - right knee with e-stim
 *   Step 4: Back - left knee without e-stim
 *
 * SHOULDER 模板结构:
 *   Step 1-4: 类似 KNEE, 但 bilateral 处理
 */
export function generateNeedleProtocol(
  context: GenerationContext,
  visitState?: TXVisitState,
  rng?: () => number,
): string {
  // 续写时: 从输入TX的实际协议推断 (电刺激或时间>=30 → full)
  const hasNeedleInfo =
    visitState?.electricalStimulation != null ||
    visitState?.treatmentTime != null;
  const inheritedFull = hasNeedleInfo
    ? visitState!.electricalStimulation === true ||
      (visitState!.treatmentTime != null && visitState!.treatmentTime >= 30)
    : undefined;
  const isFullCode =
    inheritedFull ?? INSURANCE_NEEDLE_MAP[context.insuranceType] === "full";
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart];
  const bp = context.primaryBodyPart;

  // 获取身体部位专用针号
  const needleSizes =
    TEMPLATE_NEEDLE_SIZE[bp as BodyPartKey] || TEMPLATE_NEEDLE_SIZE.LBP;

  // KNEE 专用穴位映射 (来自 acupuncture knee pain.md)
  const KNEE_FRONT_RIGHT = ["GB33", "GB34", "GB36"];
  const KNEE_FRONT_LEFT = ["SP9", "XI YAN", "HE DING", "A SHI POINT"];
  const KNEE_BACK_RIGHT = ["BL40", "BL57"];
  const KNEE_BACK_LEFT = ["BL23", "BL55", "A SHI POINTS"];

  // 穴位映射 (来自 template-options TEMPLATE_NEEDLE_POINTS)
  const needleEntry = TEMPLATE_NEEDLE_POINTS[bp as BodyPartKey];
  const templateFrontPool = needleEntry
    ? [...needleEntry.frontPool]
    : [...TEMPLATE_NEEDLE_POINTS.LBP.frontPool];
  const templateBackPool = needleEntry
    ? [...needleEntry.backPool]
    : [...TEMPLATE_NEEDLE_POINTS.LBP.backPool];
  const visitNeedle: NeedleGroups | null = visitState?.needlePoints ?? null;

  const canRandomizeFallback =
    context.noteType !== "TX" && !visitNeedle && typeof rng === "function";

  const shuffleWithSeed = (pool: string[]): string[] => {
    if (!rng) return [...pool];
    const copy = [...pool];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const frontRemaining = canRandomizeFallback ? shuffleWithSeed(templateFrontPool) : [];
  const backRemaining = canRandomizeFallback ? shuffleWithSeed(templateBackPool) : [];

  const takeRandomGroup = (
    side: "front" | "back",
    count: number,
    fallback: string[],
  ): string[] => {
    if (!canRandomizeFallback) return fallback;
    if (count <= 0) return [];

    const remaining = side === "front" ? frontRemaining : backRemaining;
    const basePool = side === "front" ? templateFrontPool : templateBackPool;
    if (remaining.length < count) {
      const refill = shuffleWithSeed(basePool).filter(
        (item) => !remaining.includes(item),
      );
      remaining.push(...refill);
      if (remaining.length < count) {
        remaining.push(...shuffleWithSeed(basePool));
      }
    }

    const picked = remaining.splice(0, count);
    return picked.length > 0 ? picked : fallback;
  };

  const pickGroup = (
    groupKey: "front1" | "front2" | "back1" | "back2",
    fallback: string[],
  ): string[] => {
    if (!visitNeedle) {
      if (canRandomizeFallback) {
        const side = groupKey.startsWith("front") ? "front" : "back";
        return takeRandomGroup(side, Math.max(1, fallback.length), fallback);
      }
      return fallback;
    }
    const group = visitNeedle[groupKey];
    return group && group.length > 0 ? [...group] : fallback;
  };

  // For backward compatibility, create the frontPoints/backPoints objects that downstream code expects
  const frontPoints: Record<string, string[]> = {
    [bp]: templateFrontPool,
    MID_LOW_BACK: [...TEMPLATE_NEEDLE_POINTS.LBP.frontPool],
    MIDDLE_BACK: [...TEMPLATE_NEEDLE_POINTS.LBP.frontPool],
  };
  const backPoints: Record<string, string[]> = {
    [bp]: templateBackPool,
    MID_LOW_BACK: [...TEMPLATE_NEEDLE_POINTS.LBP.backPool],
    MIDDLE_BACK: [...TEMPLATE_NEEDLE_POINTS.LBP.backPool],
  };

  const eStim = context.hasPacemaker
    ? "without"
    : context.hasMetalImplant
      ? "with caution"
      : "with";

  // Step 1 开头文本:
  // IE: "Preparation" (Greeting/Review/Exam 已在 Plan 步骤 1-4 中)
  // TX: "Greeting patient, Review of the chart, Routine examination of the patient current condition"
  const step1Prefix =
    context.noteType === "TX"
      ? "Greeting patient, Review of the chart, Routine examination of the patient current condition, "
      : "Preparation, ";

  // ===== KNEE 专用协议 =====
  if (bp === "KNEE" && isFullCode) {
    const kneeFrontRight = pickGroup("front1", KNEE_FRONT_RIGHT);
    const kneeFrontLeft = pickGroup("front2", KNEE_FRONT_LEFT);
    const kneeBackRight = pickGroup("back1", KNEE_BACK_RIGHT);
    const kneeBackLeft = pickGroup("back2", KNEE_BACK_LEFT);

    let protocol = `${needleSizes}\n`;
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`;

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`;

    // Step 1: Front right knee
    protocol += `1. ${step1Prefix}`;
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted for right knee ${eStim} electrical stimulation `;
    protocol += `${kneeFrontRight.join(", ")}\n\n`;

    // Step 2: Front left knee - "Washing hands..."
    protocol += `2. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles left knee ${eStim} electrical stimulation `;
    protocol += `${kneeFrontLeft.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n\n`;

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`;

    // Step 3: Back right knee - "Explanation with patient for future treatment plan..."
    protocol += `3. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `;
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `;
    protocol += `re-insertion of additional needles right knee ${eStim} electrical stimulation `;
    protocol += `${kneeBackRight.join(", ")}\n\n`;

    // Step 4: Back left knee - "Washing hands..." + WITHOUT e-stim
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles left knee without electrical stimulation `;
    protocol += `${kneeBackLeft.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n`;
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`;
    protocol += `Documentation`;

    return protocol;
  }

  // ===== SHOULDER 专用协议 (双侧 4 步, 类似 KNEE) =====
  if (bp === "SHOULDER" && isFullCode) {
    // 穴位分配 (来自 acupuncture shoulder pain.md 模板)
    const SHOULDER_FRONT_RIGHT = ["LI4", "LI11", "GB34"];
    const SHOULDER_FRONT_LEFT = ["JIAN QIAN", "LU3", "SI3"];
    const SHOULDER_BACK_RIGHT = ["SI9", "SJ10", "A SHI POINTS"];
    const SHOULDER_BACK_LEFT = ["GB21", "LI15", "SI11", "SI15"];
    const shoulderFrontRight = pickGroup("front1", SHOULDER_FRONT_RIGHT);
    const shoulderFrontLeft = pickGroup("front2", SHOULDER_FRONT_LEFT);
    const shoulderBackRight = pickGroup("back1", SHOULDER_BACK_RIGHT);
    const shoulderBackLeft = pickGroup("back2", SHOULDER_BACK_LEFT);

    let protocol = `${needleSizes}\n`;
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`;

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`;

    // Step 1: Front right shoulder
    protocol += `1. ${step1Prefix}`;
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted for right ${bodyPartName} ${eStim} electrical stimulation `;
    protocol += `${shoulderFrontRight.join(", ")}\n\n`;

    // Step 2: Front left shoulder - "Washing hands..."
    protocol += `2. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles for left ${bodyPartName} ${eStim} electrical stimulation `;
    protocol += `${shoulderFrontLeft.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n`;

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`;

    // Step 3: Back right shoulder - "Explanation with patient..."
    protocol += `3. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `;
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `;
    protocol += `re-insertion of additional needles for right ${bodyPartName} ${eStim} electrical stimulation `;
    protocol += `${shoulderBackRight.join(", ")}\n\n`;

    // Step 4: Back left shoulder - "Washing hands..." + WITHOUT e-stim
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles for left ${bodyPartName} without electrical stimulation `;
    protocol += `${shoulderBackLeft.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n`;
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`;
    protocol += `Documentation`;

    return protocol;
  }

  // ===== LBP / MID_LOW_BACK 专用协议 (非双侧, 特定穴位) =====
  if ((bp === "LBP" || bp === "MID_LOW_BACK") && isFullCode) {
    const defaultLbpFront1 = frontPoints[bp]?.slice(0, 3) || [
      "REN6",
      "GB34",
      "ST36",
    ];
    const defaultLbpFront2 = frontPoints[bp]?.slice(3, 6) || [
      "ST40",
      "REN4",
      "SI3",
    ];
    const defaultLbpBack1 = backPoints[bp]?.slice(0, 3) || [
      "BL25",
      "BL53",
      "DU4",
    ];
    const defaultLbpBack2 = backPoints[bp]?.slice(3) || [
      "BL22",
      "YAO JIA JI",
      "A SHI POINTS",
    ];
    const LBP_FRONT_1 = pickGroup("front1", defaultLbpFront1);
    const LBP_FRONT_2 = pickGroup("front2", defaultLbpFront2);
    const LBP_BACK_1 = pickGroup("back1", defaultLbpBack1);
    const LBP_BACK_2 = pickGroup("back2", defaultLbpBack2);

    // LBP 模板默认位置是 "mid and lower back" (下拉选项: lower back | mid and lower back)
    const lbpLocation =
      bp === "MID_LOW_BACK" ? bodyPartName : "mid and lower back";
    let protocol = `${needleSizes}\n`;
    protocol += `Daily acupuncture treatment for ${lbpLocation} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`;

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`;

    // Step 1
    protocol += `1. ${step1Prefix}`;
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted ${eStim} electrical stimulation `;
    protocol += `${LBP_FRONT_1.join(", ")}\n\n`;

    // Step 2: "Explanation with patient..." 前缀
    protocol += `2. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `;
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `;
    protocol += `re-insertion of additional needles ${eStim} electrical stimulation `;
    protocol += `${LBP_FRONT_2.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n\n`;

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`;

    // Step 3
    protocol += `3. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation `;
    protocol += `${LBP_BACK_1.join(", ")}\n\n`;

    // Step 4
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation `;
    protocol += `${LBP_BACK_2.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n`;
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`;
    protocol += `Documentation`;

    return protocol;
  }

  // ===== NECK 专用协议 (非双侧, Step 4 强制 without e-stim) =====
  if (bp === "NECK" && isFullCode) {
    const defaultNeckFront1 = ["SI3", "SP6", "LI11"];
    const defaultNeckFront2 = ["LV3", "LI11", "DU20"];
    const defaultNeckBack1 = ["SI13", "JIN JIA JI", "A SHI POINTS"];
    const defaultNeckBack2 = ["BAI LAO", "GB14", "GB20"];
    const NECK_FRONT_1 = pickGroup("front1", defaultNeckFront1);
    const NECK_FRONT_2 = pickGroup("front2", defaultNeckFront2);
    const NECK_BACK_1 = pickGroup("back1", defaultNeckBack1);
    const NECK_BACK_2 = pickGroup("back2", defaultNeckBack2);

    let protocol = `${needleSizes}\n`;
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`;

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`;

    // Step 1
    protocol += `1. ${step1Prefix}`;
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted ${eStim} electrical stimulation `;
    protocol += `${NECK_FRONT_1.join(", ")}\n\n`;

    // Step 2: "Explanation with patient..." 前缀
    protocol += `2. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `;
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `;
    protocol += `re-insertion of additional needles ${eStim} electrical stimulation `;
    protocol += `${NECK_FRONT_2.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n\n`;

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`;

    // Step 3
    protocol += `3. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation `;
    protocol += `${NECK_BACK_1.join(", ")}\n\n`;

    // Step 4: NECK 模板 Step 4 强制 "without electrical stimulation"
    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles without electrical stimulation `;
    protocol += `${NECK_BACK_2.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n`;
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`;
    protocol += `Documentation`;

    return protocol;
  }

  // ===== 其他部位通用协议 =====
  const defaultFront = frontPoints[bp] || ["ST36", "SP6", "LV3"];
  const defaultBack = backPoints[bp] || ["A SHI POINTS"];
  const genericFront1 = pickGroup("front1", defaultFront.slice(0, 3));
  const genericFront2 = pickGroup("front2", defaultFront.slice(3, 6));
  const genericBack1 = pickGroup("back1", defaultBack.slice(0, 3));
  const genericBack2 = pickGroup("back2", defaultBack.slice(3, 6));

  if (isFullCode) {
    // 全代码: 60分钟, 4步骤
    let protocol = `${needleSizes}\n`;
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 60 mins)\n\n`;

    protocol += `Front Points: (30 mins) - personal one on one contact with the patient\n`;
    protocol += `1. ${step1Prefix}`;
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, Initial Acupuncture needle inserted ${eStim} electrical stimulation ${genericFront1.join(", ")}\n\n`;

    protocol += `2. Explanation with patient for future treatment plan, washing hands, setting up the clean field, `;
    protocol += `selecting acupuncture needle size, selecting location, marking and cleaning the points, `;
    protocol += `re-insertion of additional needles ${eStim} electrical stimulation ${genericFront2.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n\n`;

    protocol += `Back Points (30 mins) - personal one on one contact with the patient\n`;
    protocol += `3. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation ${genericBack1.join(", ")}\n\n`;

    protocol += `4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, `;
    protocol += `marking and cleaning the points, re-insertion of additional needles ${eStim} electrical stimulation ${genericBack2.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n`;
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`;
    protocol += `Documentation`;

    return protocol;
  } else {
    // 单代码 (97810): 15分钟, 1步骤, 无电刺激
    let protocol = `${needleSizes}\n`;
    protocol += `Daily acupuncture treatment for ${bodyPartName} - Personal one on one contact with the patient (Total Operation Time: 15 mins)\n\n`;

    const sectionLabel97810 = "Acupuncture Points";
    // 97810 = 1 CPT code = 1 group of 4 points (not from NEEDLE_GROUP_SIZES which is for full code)
    const pick97810Points = (): string[] => {
      if (!visitNeedle) {
        if (canRandomizeFallback) {
          const allPool = [...templateFrontPool, ...templateBackPool];
          return shuffleWithSeed(allPool).slice(0, 4);
        }
        return (bp === "KNEE" || bp === "ELBOW")
          ? defaultFront.slice(0, 4)
          : defaultBack.slice(0, 4);
      }
      // Combine all four groups and take first 4 for 97810 selection.
      const combined = [
        ...(visitNeedle.front1 ?? []),
        ...(visitNeedle.front2 ?? []),
        ...(visitNeedle.back1 ?? []),
        ...(visitNeedle.back2 ?? []),
      ];
      if (combined.length >= 4) return combined.slice(0, 4);
      if (combined.length > 0) {
        // Pad from all template pools excluding already selected
        const used = new Set(combined);
        const allPool = [...templateFrontPool, ...templateBackPool];
        const extra = allPool.filter((p) => !used.has(p));
        return [...combined, ...extra].slice(0, 4);
      }
      return (bp === "KNEE" || bp === "ELBOW")
        ? defaultFront.slice(0, 4)
        : defaultBack.slice(0, 4);
    };
    const points97810 = pick97810Points();
    protocol += `${sectionLabel97810}: (15 mins) - personal one on one contact with the patient\n`;
    protocol += `1. ${step1Prefix}`;
    protocol += `washing hands, setting up the clean field, selecting acupuncture needle size, `;
    protocol += `selecting location, marking and cleaning the points, Initial Acupuncture needle inserted without electrical stimulation `;
    protocol += `${points97810.join(", ")}\n\n`;

    protocol += `Removing and properly disposing of needles\n`;
    protocol += `Post treatment service and education patient about precautions at home after treatment.\n`;
    protocol += `Documentation`;

    return protocol;
  }
}
