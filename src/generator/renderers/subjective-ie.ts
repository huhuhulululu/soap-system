/**
 * Subjective (IE) renderer — W3 Step 3
 *
 * Exports:
 * - generateSubjective: 生成 IE/NEW_IE/RE 的 Subjective 段落
 * - filterADLByDemographics: 根据年龄+性别过滤 ADL
 * - MUSCLE_SEVERITY_ORDER: 各 body part 肌肉严重度排序
 *
 * Scope: 仅 IE/RE noteType（TX noteType 的 Subjective 在 subjective-tx.ts）
 */

import type { GenerationContext } from "../../types";
import { severityFromPain } from "../../shared/severity";
import {
  BODY_PART_NAMES,
  BODY_PART_AREA_NAMES,
  BODY_PART_ADL,
} from "../../shared/body-part-constants";
import {
  LATERALITY_NAMES,
  ASSOCIATED_SYMPTOMS_MAP,
  SYMPTOM_SCALE_MAP,
  CAUSATIVE_CONNECTOR_MAP,
  NOT_IMPROVED_MAP,
} from "../../shared/soap-narrative-maps";
import type { BodyPartKey } from "../../shared/template-options";
import {
  TEMPLATE_PAIN_TYPES,
  TEMPLATE_CAUSATIVES,
  TEMPLATE_RELIEVING,
  TEMPLATE_AGGRAVATING,
  TEMPLATE_CONDITION_IMPACT,
} from "../../shared/template-options";
import {
  calculateWeights,
  type WeightContext,
} from "../../parser/weight-system";
import { getConfig, pickWeightedOptions } from "./_shared";

/**
 * ADL 年龄+性别过滤规则
 * weight: 正数=增权, 负数=降权/排除
 * condition: age/gender 条件
 */
interface ADLDemographicRule {
  adl: string;
  weight: number;
  condition: { minAge?: number; maxAge?: number; gender?: "Male" | "Female" };
}

const ADL_DEMOGRAPHIC_RULES: ADLDemographicRule[] = [
  // 高龄通用
  { adl: "long hours of driving", weight: -50, condition: { minAge: 65 } },
  {
    adl: "working long time in front of computer",
    weight: -60,
    condition: { minAge: 65 },
  },
  { adl: "Typing", weight: -60, condition: { minAge: 65 } },
  {
    adl: "running/jumping/participating in physical exercise",
    weight: -70,
    condition: { minAge: 65 },
  },
  // 高龄增权
  { adl: "Going up and down stairs", weight: 30, condition: { minAge: 65 } },
  { adl: "Climbing stairs", weight: 30, condition: { minAge: 65 } },
  {
    adl: "Bending over to wear/tie a shoe",
    weight: 30,
    condition: { minAge: 65 },
  },
  {
    adl: "bending down put in/out of the shoes",
    weight: 25,
    condition: { minAge: 65 },
  },
  { adl: "Putting on socks/shoes", weight: 40, condition: { minAge: 65 } },
  { adl: "Getting in/out of car", weight: 30, condition: { minAge: 65 } },
  { adl: "Rising from a chair", weight: 20, condition: { minAge: 65 } },
  { adl: "Looking down watching steps", weight: 40, condition: { minAge: 65 } },
  // 高龄男性
  {
    adl: "holding the pot for cooking",
    weight: -60,
    condition: { minAge: 65, gender: "Male" },
  },
  {
    adl: "doing laundry",
    weight: -50,
    condition: { minAge: 65, gender: "Male" },
  },
  {
    adl: "performing household chores",
    weight: -40,
    condition: { minAge: 65, gender: "Male" },
  },
  // 高龄女性
  {
    adl: "Lifting objects",
    weight: -30,
    condition: { minAge: 65, gender: "Female" },
  },
  {
    adl: "reach top of cabinet to get object(s)",
    weight: 15,
    condition: { gender: "Female" },
  },
  // 年轻人降权
  { adl: "Rising from a chair", weight: -40, condition: { maxAge: 35 } },
  { adl: "Getting out of bed", weight: -40, condition: { maxAge: 35 } },
  // 中年增权
  {
    adl: "working long time in front of computer",
    weight: 40,
    condition: { minAge: 35, maxAge: 65 },
  },
  {
    adl: "long hours of driving",
    weight: 20,
    condition: { minAge: 35, maxAge: 65 },
  },
];

/** 根据年龄+性别调整 ADL 权重 */
export function filterADLByDemographics(
  adlList: string[],
  age?: number,
  gender?: "Male" | "Female",
): string[] {
  if (!age && !gender) return adlList;
  const weightMap = new Map<string, number>();
  for (const rule of ADL_DEMOGRAPHIC_RULES) {
    const c = rule.condition;
    const ageOk =
      (!c.minAge || (age && age >= c.minAge)) &&
      (!c.maxAge || (age && age <= c.maxAge));
    const genderOk = !c.gender || c.gender === gender;
    if (ageOk && genderOk) {
      weightMap.set(rule.adl, (weightMap.get(rule.adl) ?? 0) + rule.weight);
    }
  }
  // 排除权重 <= -50 的 ADL，保留其余并按权重排序
  return adlList
    .filter((adl) => (weightMap.get(adl) ?? 0) > -50)
    .sort((a, b) => (weightMap.get(b) ?? 0) - (weightMap.get(a) ?? 0));
}

/**
 * 每个部位的肌肉严重度排序 (受累时影响 ADL 最多的排前面)
 */
export const MUSCLE_SEVERITY_ORDER: Record<string, string[]> = {
  LBP: [
    "Gluteal Muscles",
    "Iliopsoas Muscle",
    "The Multifidus muscles",
    "longissimus",
    "Quadratus Lumborum",
    "spinalis",
    "iliocostalis",
  ],
  NECK: [
    "Semispinalis capitis",
    "Splenius capitis",
    "Trapezius",
    "Scalene anterior / med / posterior",
    "Levator Scapulae",
    "sternocleidomastoid muscles",
    "Suboccipital muscles",
  ],
  SHOULDER: [
    "supraspinatus",
    "upper trapezius",
    "middle deltoid",
    "deltoid ant fibres",
    "bicep long head",
    "rhomboids",
    "levator scapula",
    "greater tuberosity",
    "lesser tuberosity",
    "AC joint",
    "triceps short head",
  ],
  KNEE: [
    "Rectus Femoris",
    "Hamstrings muscle group",
    "Gluteus Maximus",
    "Gastronemius muscle",
    "Gluteus medius / minimus",
    "Iliotibial Band ITB",
    "Tibialis Post/ Anterior",
  ],
  HIP: [
    "Iliopsoas",
    "Gluteus Maximus",
    "Gluteus Medius",
    "Piriformis",
    "Adductors",
    "TFL",
  ],
  ELBOW: [
    "Biceps",
    "Brachioradialis",
    "Pronator teres",
    "Supinator",
    "Triceps",
  ],
  MID_LOW_BACK: [
    "Gluteal Muscles",
    "Iliopsoas Muscle",
    "The Multifidus muscles",
    "longissimus",
    "Quadratus Lumborum",
    "spinalis",
    "iliocostalis",
    "Erector Spinae",
    "Latissimus Dorsi",
    "Serratus Posterior",
    "Rhomboids",
    "Middle Trapezius",
  ],
};

/**
 * 生成 Subjective 部分
 */
export function generateSubjective(
  context: GenerationContext,
  rng?: () => number,
): string {
  const painCurrent = context.painCurrent ?? 8;
  const chronicity = context.chronicityLevel || "Chronic";
  const severity = context.severityLevel || severityFromPain(painCurrent);
  const localPattern = context.localPattern || "Qi Stagnation";
  const systemicPattern = context.systemicPattern || "";
  const lateralityKey = context.laterality || "bilateral";
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart];
  const bodyPartAreaName =
    BODY_PART_AREA_NAMES[context.primaryBodyPart] || bodyPartName;
  const laterality = LATERALITY_NAMES[lateralityKey] ?? "bilateral";
  const lateralityUpper =
    laterality.charAt(0).toUpperCase() + laterality.slice(1);

  // 用户输入值 (带默认回退)
  const durationValue = context.symptomDuration?.value ?? "3";
  const durationUnit = context.symptomDuration?.unit ?? "month(s)";
  const radiation = context.painRadiation ?? "without radiation";
  const painWorst = context.painWorst ?? Math.min(10, painCurrent + 1);
  const painBest = context.painBest ?? Math.max(1, painCurrent - 2);
  // 近期加重时长
  const recentWorseValue = context.recentWorse?.value ?? "1";
  const recentWorseUnit = context.recentWorse?.unit ?? "week(s)";
  const painFrequency =
    context.painFrequency ??
    "Constant (symptoms occur between 76% and 100% of the time)";
  // 病史文本
  const medHistoryText =
    context.medicalHistory && context.medicalHistory.length > 0
      ? context.medicalHistory.join(", ")
      : "N/A";
  // 根据证型选择疼痛类型 — 使用模板权威源（ELBOW 不含 pin & needles）
  const painTypeOptions = [
    ...TEMPLATE_PAIN_TYPES[context.primaryBodyPart as BodyPartKey] ||
      TEMPLATE_PAIN_TYPES.LBP,
  ];
  const weightContext: WeightContext = {
    bodyPart: context.primaryBodyPart,
    localPattern,
    systemicPattern,
    chronicityLevel: chronicity,
    severityLevel: severity,
    insuranceType: context.insuranceType,
    painScale: painCurrent,
    hasPacemaker: context.hasPacemaker,
  };

  // 病因: 优先用户选择，不足时用权重系统补充到 minimum count
  const causatives = (() => {
    const pool =
      TEMPLATE_CAUSATIVES[context.primaryBodyPart as BodyPartKey] ||
      TEMPLATE_CAUSATIVES["LBP"];
    const count = chronicity === "Chronic" ? 3 : 2;
    const userPicked =
      context.causativeFactors && context.causativeFactors.length > 0
        ? [...context.causativeFactors]
        : [];
    if (userPicked.length >= count) return userPicked;
    // Supplement from weighted pool, excluding already-picked items
    const remaining = [...pool].filter((p) => !userPicked.includes(p));
    const weighted = calculateWeights(
      "subjective.causativeFactors",
      remaining,
      weightContext,
    );
    const extras = pickWeightedOptions(
      weighted,
      count - userPicked.length,
      rng,
    );
    return [...userPicked, ...extras];
  })();

  // 缓解因素: 优先用户选择，不足时用权重系统补充到 minimum count
  const relievers = (() => {
    const pool =
      TEMPLATE_RELIEVING[context.primaryBodyPart as BodyPartKey] ||
      TEMPLATE_RELIEVING["LBP"];
    const count =
      context.primaryBodyPart === "SHOULDER"
        ? 1
        : context.primaryBodyPart === "NECK"
          ? 2
          : 3;
    const userPicked =
      context.relievingFactors && context.relievingFactors.length > 0
        ? [...context.relievingFactors]
        : [];
    if (userPicked.length >= count) return userPicked;
    const remaining = [...pool].filter((p) => !userPicked.includes(p));
    const weighted = calculateWeights(
      "subjective.relievingFactors",
      remaining,
      weightContext,
    );
    const extras = pickWeightedOptions(
      weighted,
      count - userPicked.length,
      rng,
    );
    return [...userPicked, ...extras];
  })();

  // Pain Types: 优先使用用户选择，回退到权重系统
  const selectedPainTypes =
    context.painTypes && context.painTypes.length > 0
      ? context.painTypes
      : pickWeightedOptions(
          calculateWeights(
            "subjective.painTypes",
            painTypeOptions,
            weightContext,
          ),
          2,
          rng,
        );

  // 获取身体部位特有配置 — 优先使用用户输入
  const associatedSymptoms =
    context.associatedSymptoms && context.associatedSymptoms.length > 0
      ? context.associatedSymptoms
      : getConfig(ASSOCIATED_SYMPTOMS_MAP, context.primaryBodyPart);
  const symptomScale =
    context.symptomScale ??
    getConfig(SYMPTOM_SCALE_MAP, context.primaryBodyPart);
  const causativeConnector = getConfig(
    CAUSATIVE_CONNECTOR_MAP,
    context.primaryBodyPart,
  );
  const notImproved = getConfig(NOT_IMPROVED_MAP, context.primaryBodyPart);

  // 生成文本
  const noteType =
    context.noteType === "IE" || context.noteType === "NEW_IE"
      ? "INITIAL EVALUATION"
      : context.noteType === "RE"
        ? "RE-EVALUATION"
        : "DAILY NOTE";
  const bp = context.primaryBodyPart;

  let subjective = `${noteType}\n\n`;

  // 加重/缓解因素 - 根据身体部位选择
  const exacerbatingFactors =
    context.exacerbatingFactors && context.exacerbatingFactors.length > 0
      ? context.exacerbatingFactors
      : [
          ...(TEMPLATE_AGGRAVATING[bp as BodyPartKey] ||
            TEMPLATE_AGGRAVATING.LBP),
        ];
  const rawAdl = BODY_PART_ADL[bp] || BODY_PART_ADL["LBP"];
  const adlActivities = filterADLByDemographics(
    rawAdl,
    context.age,
    context.gender,
  );
  const weightedAdl = calculateWeights(
    "subjective.adl",
    adlActivities,
    weightContext,
  );

  if (bp === "SHOULDER") {
    // ===== SHOULDER 模板句式 =====
    // "Patient c/o [Chronic] [pain types] pain [in right]-shoulder area ([without radiation])
    //  for [10] [year(s)] got worse in recent [1-2] [month(s)]
    //  associated with muscles [soreness] (scale as [70%]) [because of] [causes]."
    const selectedAdl = pickWeightedOptions(weightedAdl, 4, rng);
    const weightedExac = calculateWeights(
      "subjective.exacerbating",
      exacerbatingFactors,
      weightContext,
    );
    const selectedExac = pickWeightedOptions(weightedExac, 4, rng);

    subjective += `Patient c/o ${chronicity} ${selectedPainTypes.join(", ")} pain in ${laterality}`;
    subjective += `-${bodyPartAreaName} (${radiation}) `;
    subjective += `for ${durationValue} ${durationUnit} got worse in recent ${recentWorseValue} ${recentWorseUnit} `;
    subjective += `associated with muscles ${associatedSymptoms.join(", ")} (scale as ${symptomScale}) `;
    subjective += `${causativeConnector} ${causatives.join(", ")}.\n`;

    // 加重因素 + ADL (同一段)
    // "The pain is [aggravated by] [factors], impaired performing ADL's with [severity] difficulty of [ADL activities]."
    subjective += `The pain is aggravated by ${selectedExac.join(", ")}, `;
    subjective += `impaired performing ADL's with ${severity} difficulty of ${selectedAdl.join(", ")}. `;

    subjective += `${relievers.join(", ")} can temporarily relieve the pain slightly but limited. `;

    const shoulderImpactPool =
      TEMPLATE_CONDITION_IMPACT[bp as BodyPartKey] ||
      TEMPLATE_CONDITION_IMPACT["LBP"];
    const shoulderImpactOptions = [...shoulderImpactPool].filter(
      (opt) => !["normal activity", "maintain regular schedule"].includes(opt),
    );
    const weightedShoulderImpact = calculateWeights(
      "subjective.conditionImpact",
      shoulderImpactOptions,
      weightContext,
    );
    const selectedShoulderImpacts = pickWeightedOptions(
      weightedShoulderImpact,
      2,
      rng,
    );
    subjective += `Patient has ${selectedShoulderImpacts.join(", ")}, `;
    subjective += `the pain did not improved ${notImproved} which promoted the patient to seek acupuncture and oriental medicine intervention.\n\n`;

    if (context.secondaryBodyParts && context.secondaryBodyParts.length > 0) {
      const secondaryNames = context.secondaryBodyParts
        .map((b) => BODY_PART_NAMES[b])
        .join(", ");
      subjective += `Patient also complaints of chronic pain on the ${secondaryNames} area comes and goes, which is less severe compared to the ${lateralityUpper} -${bodyPartAreaName} pain.\n\n`;
    }

    subjective += `Pain Scale: Worst: ${painWorst} ; Best: ${painBest} ; Current: ${painCurrent}\n`;
    subjective += `Pain Frequency: ${painFrequency}\n`;
    subjective += `Walking aid :none\n\n`;
    subjective += `Medical history/Contraindication or Precision: ${medHistoryText}`;
  } else if (bp === "NECK") {
    // ===== NECK 模板句式 =====
    // 开头与 KNEE/LBP 类似: "Patient c/o Chronic pain in [location] which is [types] [radiation]."
    // 但 ADL 用 SHOULDER 风格: "difficulty of" + 两组
    subjective += `Patient c/o ${chronicity} pain in ${laterality} ${bodyPartAreaName} which is ${selectedPainTypes.join(", ")} ${radiation} . `;
    subjective += `The patient has been complaining of the pain for ${durationValue} ${durationUnit} which got worse in recent ${recentWorseValue} ${recentWorseUnit}. `;
    subjective += `The pain is associated with muscles ${associatedSymptoms.join(", ")} (scale as ${symptomScale}) ${causativeConnector} ${causatives.join(", ")}.\n`;

    const allAdl = pickWeightedOptions(weightedAdl, 4, rng);
    const neckAdlGroup1 = allAdl.slice(0, 2);
    const neckAdlGroup2 = allAdl.slice(2, 4);
    const weightedExac = calculateWeights(
      "subjective.exacerbating",
      exacerbatingFactors,
      weightContext,
    );
    const selectedExac = pickWeightedOptions(weightedExac, 2, rng);

    subjective += `The pain is aggravated by ${selectedExac.join(", ")}, `;
    subjective += `impaired performing ADL's with ${severity} difficulty of ${neckAdlGroup1.join(", ")} `;
    subjective += `and ${severity} difficulty of ${neckAdlGroup2.join(", ")}. `;

    subjective += `${relievers.join(", ")} can temporarily relieve the pain slightly but limited. `;

    // 活动变化 + 未改善
    const neckImpactPool =
      TEMPLATE_CONDITION_IMPACT[bp as BodyPartKey] ||
      TEMPLATE_CONDITION_IMPACT["LBP"];
    const neckImpactOptions = [...neckImpactPool].filter(
      (opt) => !["normal activity", "maintain regular schedule"].includes(opt),
    );
    const weightedNeckImpact = calculateWeights(
      "subjective.conditionImpact",
      neckImpactOptions,
      weightContext,
    );
    const selectedNeckImpacts = pickWeightedOptions(weightedNeckImpact, 2, rng);
    subjective += `Patient has ${selectedNeckImpacts.join(", ")}, `;
    subjective += `the pain did not improved ${notImproved} which promoted the patient to seek acupuncture and oriental medicine intervention.\n\n`;

    // 次要部位 - NECK 比较区域用 "Cervical" 或 "neck and upper back"
    if (context.secondaryBodyParts && context.secondaryBodyParts.length > 0) {
      const secondaryNames = context.secondaryBodyParts
        .map((b) => BODY_PART_NAMES[b])
        .join(", ");
      subjective += `Patient also complaints of chronic pain on the ${secondaryNames} area comes and goes, which is less severe compared to the Cervical area.\n\n`;
    }

    subjective += `Pain Scale: Worst: ${painWorst} ; Best: ${painBest} ; Current: ${painCurrent}\n`;
    subjective += `Pain Frequency: ${painFrequency}\n`;
    subjective += `Walking aid :none\n\n`;
    subjective += `Medical history/Contraindication or Precision: ${medHistoryText}`;
  } else {
    // ===== KNEE / LBP / 其他部位模板句式 =====
    // "Patient c/o [Chronic] pain [in bilateral] Knee area which is [Dull, Aching] [without radiation]."
    subjective += `Patient c/o ${chronicity} pain in ${laterality} ${bodyPartAreaName} which is ${selectedPainTypes.join(", ")} ${radiation}. `;
    subjective += `The patient has been complaining of the pain for ${durationValue} ${durationUnit} which got worse in recent ${recentWorseValue} ${recentWorseUnit}. `;
    subjective += `The pain is associated with muscles ${associatedSymptoms.join(", ")} (scale as ${symptomScale}) ${causativeConnector} ${causatives.join(", ")}.\n\n`;

    const selectedAdl = pickWeightedOptions(weightedAdl, 3, rng);
    const exacCount = bp === "KNEE" ? 1 : bp === "LBP" ? 3 : 2;
    const weightedExac = calculateWeights(
      "subjective.exacerbatingFactors",
      exacerbatingFactors,
      weightContext,
    );
    const selectedExac = pickWeightedOptions(weightedExac, exacCount, rng);
    subjective += `The pain is aggravated by ${selectedExac.join(", ")} . There is ${severity} difficulty with ADLs like ${selectedAdl.join(", ")}.\n\n`;

    subjective += `${relievers.join(", ")} can temporarily relieve the pain. `;
    const defaultImpactPool =
      TEMPLATE_CONDITION_IMPACT[bp as BodyPartKey] ||
      TEMPLATE_CONDITION_IMPACT["LBP"];
    const defaultImpactOptions = [...defaultImpactPool].filter(
      (opt) => !["normal activity", "maintain regular schedule"].includes(opt),
    );
    const weightedDefaultImpact = calculateWeights(
      "subjective.conditionImpact",
      defaultImpactOptions,
      weightContext,
    );
    const selectedDefaultImpacts = pickWeightedOptions(
      weightedDefaultImpact,
      2,
      rng,
    );
    subjective += `Due to this condition patient has ${selectedDefaultImpacts.join(", ")}. `;
    subjective += `The pain did not improved ${notImproved} which promoted the patient to seek acupuncture and oriental medicine intervention.\n\n`;

    // 次要部位
    if (context.secondaryBodyParts && context.secondaryBodyParts.length > 0) {
      const secondaryNames = context.secondaryBodyParts
        .map((b) => BODY_PART_NAMES[b])
        .join(", ");
      subjective += `Patient also complaints of chronic pain on the ${secondaryNames} area comes and goes, which is less severe compared to the ${lateralityUpper} ${bodyPartAreaName} pain.\n\n`;
    }

    subjective += `Pain Scale: Worst: ${painWorst} ; Best: ${painBest} ; Current: ${painCurrent}\n`;
    subjective += `Pain Frequency: ${painFrequency}\n`;
    subjective += `Walking aid :none\n\n`;
    subjective += `Medical history/Contraindication or Precision: ${medHistoryText}`;
  }

  return subjective;
}
