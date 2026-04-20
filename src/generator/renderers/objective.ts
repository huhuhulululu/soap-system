/**
 * Objective renderer — W3 Step 5
 *
 * Export: generateObjective — O 段 (muscle testing / ROM / inspection / tongue-pulse)
 *
 * Note on file size: 超过 AC9 的 700 LOC 上限（约 800 LOC），主要源于 ROM 下拉选项
 * 表（KNEE/SHOULDER 多运动的离散标签集）。这些表是数据而非逻辑，无法进一步
 * 拆分（下拉选项与 getShoulderRomLabel / getKneeRomLabel 紧耦合）。
 * Future Work（ADR D43 已记录）: 若继续增长，提取 ROM 选项到 renderers/_rom-options.ts。
 */

import type { BodyPart, GenerationContext } from "../../types";
import type { TXVisitState } from "../tx-sequence-engine";
import { severityFromPain } from "../../shared/severity";
import {
  BODY_PART_MUSCLES,
  BODY_PART_NAMES,
  BODY_PART_ROM,
  type ROMMovement,
} from "../../shared/body-part-constants";
import {
  LATERALITY_NAMES,
  TONE_MAP,
  TENDERNESS_LABEL_MAP,
  INSPECTION_DEFAULT_MAP,
} from "../../shared/soap-narrative-maps";
import type { BodyPartKey } from "../../shared/template-options";
import {
  TEMPLATE_TENDERNESS_TEXT,
  TEMPLATE_TENDERNESS_SCALE,
} from "../../shared/template-options";
import {
  calculateWeights,
  type WeightContext,
} from "../../parser/weight-system";
import { selectInitialMuscles } from "../muscle-selector";
import { objectiveMuscleSeed } from "../../shared/muscle-seed";
import { computeSpasm, SPASM_GRADE_TEXT } from "../spasm-model";
import {
  hasTemplateROM,
  resolveTemplateMovementName,
  pickTemplateROMDegreesByPain,
  getTemplateSeverityLabel,
} from "../../shared/rom-from-template";
import {
  getConfig,
  pickWeightedOptions,
  suppressSwellInspectionInText,
  calculateRomValue,
  calculateLimitation,
  getStrengthByPainAndDifficulty,
  type SOAPFormat,
} from "./_shared";

const ROM_MAP = BODY_PART_ROM;

/**
 * KNEE Flexion 下拉框选项 (来自模板 ppnSelectComboSingle)
 * 注意: 130 和 120 的格式是 "130(normal)" 不含 "Degrees"，其余含 "Degrees"
 */
const KNEE_FLEXION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 130, label: "130(normal)" },
  { degrees: 125, label: "125 Degrees(normal)" },
  { degrees: 120, label: "120(normal)" },
  { degrees: 115, label: "115 Degrees(mild)" },
  { degrees: 110, label: "110 Degrees(mild)" },
  { degrees: 105, label: "105 Degrees(mild)" },
  { degrees: 100, label: "100 Degrees(moderate)" },
  { degrees: 95, label: "95 Degrees(moderate)" },
  { degrees: 90, label: "90 Degrees(moderate)" },
  { degrees: 85, label: "85 Degrees(moderate)" },
  { degrees: 80, label: "80 Degrees(moderate)" },
  { degrees: 75, label: "75 Degrees(moderate)" },
  { degrees: 70, label: "70 Degrees(moderate)" },
  { degrees: 65, label: "65 Degrees(severe)" },
  { degrees: 60, label: "60 Degrees(severe)" },
  { degrees: 55, label: "55 Degrees(severe)" },
  { degrees: 50, label: "50 Degrees(severe)" },
  { degrees: 45, label: "45 Degrees(severe)" },
  { degrees: 40, label: "40 Degrees(severe)" },
  { degrees: 35, label: "35 Degrees(severe)" },
  { degrees: 30, label: "30 Degrees(severe)" },
  { degrees: 25, label: "25 Degrees(severe)" },
];

/**
 * SHOULDER ROM 下拉框选项 (来自 AC-IE SHOULDER.md 模板)
 */
const SHOULDER_ABDUCTION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 180, label: "180 degree(normal)" },
  { degrees: 175, label: "175 degree(normal)" },
  { degrees: 170, label: "170 degree(normal)" },
  { degrees: 165, label: "165 degree(mild)" },
  { degrees: 160, label: "160 degree(mild)" },
  { degrees: 155, label: "155 degree(mild)" },
  { degrees: 150, label: "150 degree(mild)" },
  { degrees: 145, label: "145 degree(moderate)" },
  { degrees: 140, label: "140 degree(moderate)" },
  { degrees: 135, label: "135 degree(moderate)" },
  { degrees: 130, label: "130 degree(moderate)" },
  { degrees: 125, label: "125 degree(moderate)" },
  { degrees: 120, label: "120 degree(moderate)" },
  { degrees: 115, label: "115 degree(moderate)" },
  { degrees: 110, label: "110 degree(moderate)" },
  { degrees: 105, label: "105 degree(moderate)" },
  { degrees: 100, label: "100 degree(moderate)" },
  { degrees: 95, label: "95 degree(moderate)" },
  { degrees: 90, label: "90 degree(severe)" },
  { degrees: 85, label: "85 degree(severe)" },
  { degrees: 80, label: "80 degree(severe)" },
  { degrees: 75, label: "75 degree(severe)" },
  { degrees: 70, label: "70 degree(severe)" },
  { degrees: 65, label: "65 degree(severe)" },
  { degrees: 60, label: "60 degree(severe)" },
  { degrees: 55, label: "55 degree(severe)" },
  { degrees: 50, label: "50 degree(severe)" },
  { degrees: 45, label: "45 degree(severe)" },
  { degrees: 40, label: "40 degree(severe)" },
  { degrees: 35, label: "35 degree(severe)" },
  { degrees: 30, label: "30 degree(severe)" },
  { degrees: 25, label: "25 degree(severe)" },
  { degrees: 20, label: "20 degree(severe)" },
  { degrees: 15, label: "15 degree(severe)" },
  { degrees: 10, label: "10 degree(severe)" },
  { degrees: 5, label: "5 degree(severe)" },
];

const SHOULDER_FLEXION_OPTIONS = SHOULDER_ABDUCTION_OPTIONS;

const SHOULDER_HORIZONTAL_ADDUCTION_OPTIONS: Array<{
  degrees: number;
  label: string;
}> = [
  { degrees: 45, label: "45 degree (normal)" },
  { degrees: 40, label: "40 degree (normal)" },
  { degrees: 35, label: "35 degree (normal)" },
  { degrees: 30, label: "30 degree (normal)" },
  { degrees: 25, label: "25 degree (mild)" },
  { degrees: 20, label: "20 degree (mild)" },
  { degrees: 15, label: "15 degree (moderate)" },
  { degrees: 10, label: "10 degree (moderate)" },
  { degrees: 5, label: "5 degree (severe)" },
  { degrees: 0, label: "can not do this at all" },
];

const SHOULDER_EXTENSION_OPTIONS: Array<{ degrees: number; label: string }> = [
  { degrees: 5, label: "5 Degrees(severe)" },
  { degrees: 10, label: "10 Degrees(severe)" },
  { degrees: 15, label: "15 Degrees(severe)" },
  { degrees: 20, label: "20 Degrees(moderate)" },
  { degrees: 25, label: "25 Degrees(moderate)" },
  { degrees: 30, label: "30 Degrees(moderate)" },
  { degrees: 35, label: "35 Degrees(moderate)" },
  { degrees: 40, label: "40 Degrees(mild)" },
  { degrees: 45, label: "45 Degrees(mild)" },
  { degrees: 50, label: "50 Degrees(mild)" },
  { degrees: 55, label: "55 Degrees(normal)" },
  { degrees: 60, label: "60 Degrees(normal)" },
];

const SHOULDER_EXTERNAL_ROTATION_OPTIONS: Array<{
  degrees: number;
  label: string;
}> = [
  { degrees: 90, label: "90 Degrees(normal)" },
  { degrees: 85, label: "85 Degrees(normal)" },
  { degrees: 80, label: "80 Degrees(normal)" },
  { degrees: 75, label: "75 Degrees(mild)" },
  { degrees: 70, label: "70 Degrees(mild)" },
  { degrees: 65, label: "65 Degrees(mild)" },
  { degrees: 60, label: "60 Degrees(moderate)" },
  { degrees: 55, label: "55 Degrees(moderate)" },
  { degrees: 50, label: "50 Degrees(moderate)" },
  { degrees: 45, label: "45 Degrees(moderate)" },
  { degrees: 40, label: "40 Degrees(moderate)" },
  { degrees: 35, label: "35 Degrees(severe)" },
  { degrees: 30, label: "30 Degrees(severe)" },
  { degrees: 25, label: "25 Degrees(severe)" },
  { degrees: 15, label: "15 Degrees(severe)" },
  { degrees: 10, label: "10 Degrees(severe)" },
  { degrees: 5, label: "5 Degrees(severe)" },
];

const SHOULDER_INTERNAL_ROTATION_OPTIONS = SHOULDER_EXTERNAL_ROTATION_OPTIONS;

/**
 * 获取 SHOULDER ROM 的标签 (匹配最近的有效下拉框值)
 */
function getShoulderRomLabel(
  movement: string,
  normalDegrees: number,
  reductionPercent: number,
): string {
  const reducedDegrees = Math.round(normalDegrees * (1 - reductionPercent));

  let options: Array<{ degrees: number; label: string }>;
  if (movement === "Abduction") {
    options = SHOULDER_ABDUCTION_OPTIONS;
  } else if (movement === "Horizontal Adduction") {
    options = SHOULDER_HORIZONTAL_ADDUCTION_OPTIONS;
  } else if (movement === "Flexion") {
    options = SHOULDER_FLEXION_OPTIONS;
  } else if (movement === "Extension") {
    options = SHOULDER_EXTENSION_OPTIONS;
  } else if (movement === "External Rotation") {
    options = SHOULDER_EXTERNAL_ROTATION_OPTIONS;
  } else if (movement === "Internal Rotation") {
    options = SHOULDER_INTERNAL_ROTATION_OPTIONS;
  } else {
    return `${reducedDegrees} degree(moderate)`;
  }

  let closest = options[0];
  let minDiff = Math.abs(reducedDegrees - closest.degrees);
  for (const opt of options) {
    const diff = Math.abs(reducedDegrees - opt.degrees);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt;
    }
  }
  return closest.label;
}

/**
 * 获取 KNEE ROM 的标签 (匹配最近的有效下拉框值)
 */
function getKneeRomLabel(
  rom: { movement: string; normalDegrees: number },
  reductionPercent: number,
): string {
  if (rom.movement.includes("Extension")) {
    const reduced = Math.round(rom.normalDegrees * (1 - reductionPercent));
    return reduced < 0 ? "-5(severe)" : "0(normal)";
  }

  const reducedDegrees = Math.round(rom.normalDegrees * (1 - reductionPercent));
  let closest = KNEE_FLEXION_OPTIONS[0];
  let minDiff = Math.abs(reducedDegrees - closest.degrees);
  for (const opt of KNEE_FLEXION_OPTIONS) {
    const diff = Math.abs(reducedDegrees - opt.degrees);
    if (diff < minDiff) {
      minDiff = diff;
      closest = opt;
    }
  }
  return closest.label;
}

function getRomTrendBoost(visitState?: TXVisitState): number {
  const trend = visitState?.soaChain.objective.romTrend;
  if (trend === "improved") return 0.25;
  if (trend === "slightly improved") return 0.1;
  return 0;
}

function painFromPainScaleLabel(label: string | undefined, fallback: number): number {
  if (!label) return fallback;
  const nums = label.match(/\d+/g)?.map((n) => Number(n)) ?? [];
  if (nums.length === 0) return fallback;
  if (nums.length === 1) return nums[0];
  return (nums[0] + nums[1]) / 2;
}

function pickTemplateRomDegreesForRender(
  bp: BodyPartKey,
  movementName: string,
  effectivePain: number,
  rngValue: number,
  visitState?: TXVisitState,
  /** Original rom.movement name (for romFloors lookup, may differ from template movementName) */
  originalMovementName?: string,
): number | null {
  if (!visitState) {
    return pickTemplateROMDegreesByPain(bp, movementName, effectivePain, rngValue);
  }

  const floorKey = originalMovementName ?? movementName;
  const trend = visitState.soaChain.objective.romTrend;
  return pickTemplateROMDegreesByPain(bp, movementName, effectivePain, rngValue, {
    progress: 0,
    trend,
    minDegrees: visitState.romFloors?.[floorKey],
  });
}

/**
 * 生成 Objective 部分 (使用全局 BODY_PART_MUSCLES 和 ROM_MAP)
 * KNEE 模板段落顺序: Muscles Testing → ROM(左右分别) → Inspection
 * SHOULDER 模板段落顺序: Inspection → Muscles Testing → ROM
 */
export function generateObjective(
  context: GenerationContext,
  visitState?: TXVisitState,
  rng?: () => number,
  format: SOAPFormat = "text",
): string {
  const isHtml = format === "html";
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart];
  const lateralityKey = context.laterality || "bilateral";
  const laterality = LATERALITY_NAMES[lateralityKey] ?? "bilateral";
  const bp = context.primaryBodyPart;
  const localPattern = context.localPattern || "Qi Stagnation";
  const systemicPattern = context.systemicPattern || "";
  const chronicity = context.chronicityLevel || "Chronic";
  const objectivePainScale = visitState?.painScaleCurrent ?? context.painCurrent ?? 8;
  const effectiveSeverity =
    visitState?.severityLevel ||
    context.severityLevel ||
    severityFromPain(objectivePainScale);

  const muscles = BODY_PART_MUSCLES[bp] || ["local muscles"];

  const tenderLabel = getConfig(TENDERNESS_LABEL_MAP, bp);
  const tenderText =
    TEMPLATE_TENDERNESS_TEXT[bp as BodyPartKey] ||
    TEMPLATE_TENDERNESS_TEXT.KNEE;
  const tenderScales =
    TEMPLATE_TENDERNESS_SCALE[bp as BodyPartKey] ||
    TEMPLATE_TENDERNESS_SCALE.KNEE;
  const inspectionDefault = getConfig(INSPECTION_DEFAULT_MAP, bp);
  const inspectionText = isHtml
    ? visitState?.inspection ?? inspectionDefault
    : suppressSwellInspectionInText(visitState?.inspection ?? inspectionDefault) ??
      inspectionDefault;

  let objective = "";

  if (bp === "SHOULDER") {
    objective += `Inspection:${inspectionText}\n\n`;
  }

  objective += `Muscles Testing:\n`;
  const ieMuscles = !visitState
    ? (() => {
        try {
          return selectInitialMuscles(
            bp,
            effectiveSeverity,
            objectiveMuscleSeed(context),
          );
        } catch {
          return undefined;
        }
      })()
    : undefined;
  const selectedTightness =
    visitState?.tightMuscles && visitState.tightMuscles.length > 0
      ? [...visitState.tightMuscles]
      : ieMuscles?.tightness && ieMuscles.tightness.length > 0
        ? [...ieMuscles.tightness]
      : (() => {
          const tightnessWeightContext: WeightContext = {
            bodyPart: bp,
            localPattern,
            systemicPattern,
            chronicityLevel: chronicity,
            severityLevel: effectiveSeverity,
            insuranceType: context.insuranceType,
            painScale: objectivePainScale,
            hasPacemaker: context.hasPacemaker,
          };
          const weightedTightness = calculateWeights(
            "objective.tightness",
            muscles,
            tightnessWeightContext,
          );
          return pickWeightedOptions(weightedTightness, 3, rng);
        })();
  objective += `Tightness muscles noted along ${selectedTightness.join(", ")}\n`;
  objective += `Grading Scale: ${visitState?.tightnessGrading || effectiveSeverity}\n\n`;

  const tenderMuscles =
    visitState?.tenderMuscles && visitState.tenderMuscles.length > 0
      ? [...visitState.tenderMuscles]
      : ieMuscles?.tenderness && ieMuscles.tenderness.length > 0
        ? [...ieMuscles.tenderness]
      : muscles.length >= 8
        ? muscles.slice(7, 12)
        : muscles.length >= 4
          ? muscles.slice(Math.floor(muscles.length / 2))
          : muscles.slice(1);
  const spasmMuscles =
    visitState?.spasmMuscles && visitState.spasmMuscles.length > 0
      ? [...visitState.spasmMuscles]
      : ieMuscles?.spasm && ieMuscles.spasm.length > 0
        ? [...ieMuscles.spasm]
      : muscles.length >= 8
        ? muscles.slice(3, 7)
        : muscles.length === 7
          ? muscles.slice(1, 3).concat(muscles.slice(5))
          : muscles.length >= 4
            ? muscles.slice(
                Math.floor(muscles.length / 3),
                Math.floor((muscles.length * 2) / 3) + 1,
              )
            : muscles.slice(0, 2);

  objective += `${tenderText} ${tenderMuscles.join(", ")}\n\n`;
  const severityToTender: Record<string, string> = {
    severe: "+4",
    "moderate to severe": "+3",
    moderate: "+3",
    "mild to moderate": "+2",
    mild: "+1",
  };
  const ieTenderGrade = severityToTender[effectiveSeverity] || "+3";
  objective += `${tenderLabel}: ${visitState?.tendernessGrading || tenderScales[ieTenderGrade] || tenderScales["+3"]}\n\n`;

  objective += `Muscles spasm noted along ${spasmMuscles.join(", ")}\n`;
  if (visitState?.spasmGrading) {
    objective += `Frequency Grading Scale:${visitState.spasmGrading}\n\n`;
  } else {
    const tenderGradeNum = parseInt(ieTenderGrade.replace("+", "")) || 3;
    const spasmGrade = computeSpasm({
      tightness: effectiveSeverity,
      tenderness: tenderGradeNum,
      chronicity,
      bodyPart: bp,
      age: context.age,
    });
    objective += `Frequency Grading Scale:${SPASM_GRADE_TEXT[spasmGrade]}\n\n`;
  }

  // ==================== ROM评估 (v9.0 引擎) ====================
  const romData = ROM_MAP[bp];
  const isSpine =
    bp === "NECK" ||
    bp === "LBP" ||
    bp === "MIDDLE_BACK" ||
    bp === "UPPER_BACK" ||
    bp === "MID_LOW_BACK";
  const romType = isSpine ? "Spine ROM" : "Joint ROM";

  const basePain: number =
    visitState?.painScaleCurrent ??
    context.painCurrent ??
    ({
      severe: 9,
      "moderate to severe": 8,
      moderate: 6,
      "mild to moderate": 5,
      mild: 3,
    }[effectiveSeverity] ||
      7);
  const painLevel: number = visitState
    ? painFromPainScaleLabel(visitState.painScaleLabel, basePain)
    : basePain;
  const romTrendBoost = getRomTrendBoost(visitState);

  const STRENGTH_ORDER = ["3-/5", "3/5", "3+/5", "4-/5", "4/5", "4+/5"];
  const strengthIdx = (s: string): number => {
    const i = STRENGTH_ORDER.indexOf(s);
    return i >= 0 ? i : 4;
  };

  const bumpStrength = (strength: string, step: number): string => {
    const ladder = ["3/5", "3+/5", "4-/5", "4/5", "4+/5"];
    const idx = ladder.indexOf(strength);
    if (idx < 0) return strength;
    return ladder[Math.max(0, Math.min(ladder.length - 1, idx + step))];
  };

  /** Pick the higher of engine's scheduled strength and per-direction computed strength. */
  const resolveStrength = (engineGrade: string | undefined, computed: string): string => {
    if (!engineGrade) return computed;
    return strengthIdx(engineGrade) >= strengthIdx(computed) ? engineGrade : computed;
  };

  const computeRom = (
    rom: ROMMovement,
    index: number,
    sideOffset: number,
    adjustedPain: number,
    romAdjustment: number,
  ) => {
    const variationSeed = (index + sideOffset) % 3;
    const painVariation = [-1, 0, 1][variationSeed];
    const effectivePain = Math.max(
      1,
      Math.min(10, adjustedPain + painVariation),
    );

    let strength = getStrengthByPainAndDifficulty(
      effectivePain,
      rom.difficulty,
    );
    if (visitState) {
      const step =
        visitState.progress > 0.7 ? 2 : visitState.progress > 0.45 ? 1 : 0;
      strength = bumpStrength(strength, step);
    }
    let romValue = calculateRomValue(
      rom.normalDegrees,
      effectivePain,
      rom.difficulty,
    );

    if (romAdjustment !== 0 && rom.normalDegrees > 0) {
      romValue = Math.max(
        Math.round(rom.normalDegrees * 0.25),
        Math.min(rom.normalDegrees, romValue + romAdjustment),
      );
      romValue = Math.round(romValue / 5) * 5;
    }

    const limitation = calculateLimitation(romValue, rom.normalDegrees);
    return { strength, romValue, limitation };
  };

  if (bp === "KNEE" && laterality === "bilateral") {
    const sides = ["Right", "Left"] as const;
    sides.forEach((side) => {
      const adjustedPain =
        side === "Left" ? painLevel : Math.max(1, painLevel - 1);
      const sideOffset = side === "Left" ? 0 : 1;

      const kneeRomAdj = 0;
      const effectivePainForKnee = visitState
        ? Math.max(1, adjustedPain - kneeRomAdj * 0.3 - romTrendBoost)
        : adjustedPain;

      objective += `${side} Knee Muscles Strength and Joint ROM:\n\n`;
      if (romData) {
        romData.forEach((rom, i) => {
          const { strength: computedStrength } = computeRom(
            rom,
            i,
            sideOffset,
            adjustedPain,
            side === "Left" ? 0 : 5,
          );
          const strength = resolveStrength(visitState?.strengthGrade, computedStrength);
          const templateMovName = resolveTemplateMovementName(
            "KNEE",
            rom.movement,
          );
          const rngValue = rng ? rng() : [0.3, 0.5, 0.7][(i + sideOffset) % 3];
          const templateDegrees = pickTemplateRomDegreesForRender(
            "KNEE",
            templateMovName,
            effectivePainForKnee,
            rngValue,
            visitState,
            rom.movement,
          );
          const degrees = templateDegrees ?? rom.normalDegrees;
          const reductionPct =
            rom.normalDegrees > 0 ? 1 - degrees / rom.normalDegrees : 0;
          objective += `${strength} ${rom.movement}: ${getKneeRomLabel(rom, reductionPct)}\n`;
        });
      }
      objective += `\n`;
    });
  } else if (bp === "KNEE") {
    const sideLabel = laterality === "left" ? "Left" : "Right";
    objective += `${sideLabel} Knee Muscles Strength and Joint ROM:\n\n`;
    if (romData) {
      romData.forEach((rom, i) => {
        const { strength: computedStrength } = computeRom(rom, i, 0, painLevel, 0);
        const strength = resolveStrength(visitState?.strengthGrade, computedStrength);
        const templateMovName = resolveTemplateMovementName(
          "KNEE",
          rom.movement,
        );
        const rngValue = rng ? rng() : [0.3, 0.5, 0.7][i % 3];
        const kneeUniRomAdj = 0;
        const effectivePainForKneeUni = visitState
          ? Math.max(1, painLevel - kneeUniRomAdj * 0.3 - romTrendBoost)
          : painLevel;
        const templateDegrees = pickTemplateRomDegreesForRender(
          "KNEE",
          templateMovName,
          effectivePainForKneeUni,
          rngValue,
          visitState,
          rom.movement,
        );
        const degrees = templateDegrees ?? rom.normalDegrees;
        const reductionPct =
          rom.normalDegrees > 0 ? 1 - degrees / rom.normalDegrees : 0;
        objective += `${strength} ${rom.movement}: ${getKneeRomLabel(rom, reductionPct)}\n`;
      });
    }
    objective += `\n`;
  } else if (bp === "SHOULDER") {
    const renderShoulderRom = (side: string) => {
      const isLeft = side === "Left";
      const adjustedPain = isLeft ? painLevel : Math.max(1, painLevel - 1);
      const sideOffset = isLeft ? 0 : 1;

      const shoulderRomAdj = 0;
      const effectivePainForShoulder = visitState
        ? Math.max(1, adjustedPain - shoulderRomAdj * 0.3 - romTrendBoost)
        : adjustedPain;

      objective += `${side} Shoulder Muscles Strength and Joint ROM\n`;
      if (romData) {
        romData.forEach((rom, i) => {
          const { strength: computedStrength } = computeRom(
            rom,
            i,
            sideOffset,
            adjustedPain,
            isLeft ? 0 : 5,
          );
          const strength = resolveStrength(visitState?.strengthGrade, computedStrength);
          const templateMovName = resolveTemplateMovementName(
            "SHOULDER",
            rom.movement,
          );
          const rngValue = rng ? rng() : [0.3, 0.5, 0.7][(i + sideOffset) % 3];
          const templateDegrees = pickTemplateRomDegreesForRender(
            "SHOULDER",
            templateMovName,
            effectivePainForShoulder,
            rngValue,
            visitState,
            rom.movement,
          );
          const reductionPct =
            rom.normalDegrees > 0
              ? 1 - (templateDegrees ?? rom.normalDegrees) / rom.normalDegrees
              : 0;
          const label = getShoulderRomLabel(
            rom.movement,
            rom.normalDegrees,
            reductionPct,
          );
          let movementLabel: string;
          if (rom.movement === "Abduction") {
            movementLabel = `${strength} Abduction:`;
          } else if (rom.movement === "Horizontal Adduction") {
            movementLabel = `${strength} Horizontal Adduction: `;
          } else if (rom.movement === "Flexion") {
            movementLabel = `${strength} Flexion :`;
          } else if (rom.movement === "Extension") {
            movementLabel = `${strength} Extension : `;
          } else if (rom.movement === "External Rotation") {
            movementLabel = `${strength} External rotation : `;
          } else if (rom.movement === "Internal Rotation") {
            movementLabel = `${strength} Internal rotation : `;
          } else {
            movementLabel = `${strength} ${rom.movement}: `;
          }
          objective += `${movementLabel}${label}\n`;
        });
      }
      objective += `\n`;
    };

    if (laterality === "bilateral") {
      renderShoulderRom("Right");
      renderShoulderRom("Left");
    } else {
      renderShoulderRom(laterality === "left" ? "Left" : "Right");
    }
  } else {
    const romLabel =
      bp === "NECK"
        ? "Cervical"
        : bp === "LBP"
          ? "Lumbar"
          : bp === "MID_LOW_BACK"
            ? "Thoracolumbar"
            : `${laterality ? laterality.charAt(0).toUpperCase() + laterality.slice(1) + " " : ""}${bodyPartName.charAt(0).toUpperCase() + bodyPartName.slice(1)}`;
    const romSuffix = bp === "NECK" ? " Assessment:" : "";
    objective += `${romLabel} Muscles Strength and ${romType}${romSuffix}\n`;

    if (romData) {
      const degreeLabel = (isSpine || bp === "HIP") ? "Degrees" : "degree";
      const romAdj = 0;
      romData.forEach((rom, index) => {
        const { strength: computedStrength, romValue, limitation } = computeRom(
          rom,
          index,
          0,
          painLevel,
          romAdj,
        );
        const strength = resolveStrength(visitState?.strengthGrade, computedStrength);

        if (hasTemplateROM(bp)) {
          const templateMovName = resolveTemplateMovementName(bp, rom.movement);
          const variationSeed = index % 3;
          const rngValue = rng ? rng() : [0.3, 0.5, 0.7][variationSeed];
          const effectivePainForTemplate = visitState
            ? Math.max(1, painLevel - romAdj * 0.3 - romTrendBoost)
            : painLevel;
          const templateDegrees = pickTemplateRomDegreesForRender(
            bp as BodyPartKey,
            templateMovName,
            effectivePainForTemplate,
            rngValue,
            visitState,
            rom.movement,
          );
          if (templateDegrees !== null) {
            const templateSeverity = getTemplateSeverityLabel(
              bp as BodyPartKey,
              templateMovName,
              templateDegrees,
            );
            objective += `${strength} ${rom.movement}: ${templateDegrees} ${degreeLabel} (${templateSeverity})\n`;
          } else {
            objective += `${strength} ${rom.movement}: ${romValue} ${degreeLabel} (${limitation})\n`;
          }
        } else {
          objective += `${strength} ${rom.movement}: ${romValue} ${degreeLabel} (${limitation})\n`;
        }
      });
    }
    objective += `\n`;
  }

  if (bp !== "SHOULDER") {
    objective += `Inspection: ${inspectionText}\n\n`;
  }

  const toneData = TONE_MAP[localPattern] || TONE_MAP[systemicPattern];
  if (toneData) {
    const tongue = visitState?.tonguePulse?.tongue ?? toneData.tongueDefault;
    const pulse = visitState?.tonguePulse?.pulse ?? toneData.pulseDefault;
    objective += `tongue\n${tongue}\npulse\n${pulse}`;
  }

  if (format === "html") {
    let html = objective.replace(/\n/g, '<br>');

    if (context.noteType === "TX" && visitState) {
      html = html.replace(/\b(\d[\+\-]?\/5)\b/g, '<span class="ppnSelectComboSingle">$1</span>');
      html = html.replace(/\b(\d+)\s+degrees?/gi, '<span class="ppnSelectComboSingle">$1°</span>');

      const allMuscles = [
        ...(visitState.tightMuscles || []),
        ...(visitState.tenderMuscles || []),
        ...(visitState.spasmMuscles || [])
      ];
      const sortedMuscles = [...allMuscles].sort((a, b) => b.length - a.length);

      sortedMuscles.forEach((muscle, i) => {
        const escaped = muscle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(`\\b${escaped}\\b`, 'g'), `__MUSCLE_${i}__`);
      });

      sortedMuscles.forEach((muscle, i) => {
        html = html.replace(new RegExp(`__MUSCLE_${i}__`, 'g'),
          `<span class="ppnSelectCombo">${muscle}</span>`);
      });
    }

    return html;
  }

  return objective;
}
