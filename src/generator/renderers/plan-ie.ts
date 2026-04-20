/**
 * Plan (IE) renderer — W3 Step 6
 *
 * Export: generatePlanIE — IE/RE plan 段落
 */

import type { GenerationContext } from "../../types";
import { severityFromPain } from "../../shared/severity";
import { computePatchedGoals } from "../objective-patch";

/**
 * 生成 Plan 部分（IE）
 * KNEE 模板格式:
 *   "to5-6." (Pain Scale to与值之间无空格)
 *   "to (70%-80%)" (sensation Scale to 后带括号)
 *   "to4" (Strength to与值之间无空格)
 */
export function generatePlanIE(context: GenerationContext): string {
  const bp = context.primaryBodyPart;
  const severity =
    context.severityLevel || severityFromPain(context.painCurrent ?? 8);
  const evalLabel = context.noteType === "RE"
    ? "Re-Evaluation"
    : "Initial Evaluation";

  const symptomType = context.associatedSymptoms?.[0] || "soreness";
  const painCurrent = context.painCurrent ?? 8;
  const goals = computePatchedGoals(painCurrent, severity, bp, symptomType, {
    medicalHistory: context.medicalHistory,
    age: context.age,
  });
  const isMainBP =
    bp === "KNEE" ||
    bp === "SHOULDER" ||
    bp === "LBP" ||
    bp === "NECK" ||
    bp === "MID_LOW_BACK";

  let plan = `${evalLabel} - Personal one on one contact with the patient (total 20-30 mins)\n`;
  plan += `1. Greeting patient.\n`;
  plan += `2. Detail explanation from patient of past medical history and current symptom.\n`;
  plan += `3. Initial evaluation examination of the patient current condition.\n`;
  plan += `4. Explanation with patient for medical decision/treatment plan.\n\n`;

  // 短期目标
  plan += `Short Term Goal (RELIEF TREATMENT FREQUENCY: 12 treatments in 5-6 weeks):\n`;

  if (isMainBP) {
    plan += `Decrease Pain Scale to ${goals.pain.st}.\n`;
    plan += `Decrease ${symptomType} sensation Scale to ${goals.symptomPct.st}\n`;
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`;
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`;
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`;
    plan += `Increase Muscles Strength to ${goals.strength.st}\n\n`;
  } else {
    plan += `Decrease Pain Scale to ${goals.pain.st}.\n`;
    plan += `Decrease ${symptomType} sensation Scale to 50%\n`;
    plan += `Decrease Muscles Tightness to ${goals.tightness.st}\n`;
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.st}\n`;
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.st}\n`;
    plan += `Increase Muscles Strength to ${goals.strength.st}\n\n`;
  }

  // 长期目标
  plan += `Long Term Goal (ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY: 8 treatments in 5-6 weeks):\n`;

  const tightnessLT = goals.tightness.lt.replace(/ to /g, "-");

  if (isMainBP) {
    plan += `Decrease Pain Scale to ${goals.pain.lt}\n`;
    plan += `Decrease ${symptomType} sensation Scale to ${goals.symptomPct.lt}\n`;
    plan += `Decrease Muscles Tightness to ${tightnessLT}\n`;
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`;
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`;
    plan += `Increase Muscles Strength to ${goals.strength.lt}\n`;
    plan += `Increase ROM ${goals.rom.lt}\n`;
    plan += `Decrease impaired Activities of Daily Living to ${goals.adl.lt}.`;
  } else {
    plan += `Decrease Pain Scale to ${goals.pain.lt}\n`;
    plan += `Decrease ${symptomType} sensation Scale to 30%\n`;
    plan += `Decrease Muscles Tightness to ${tightnessLT}\n`;
    plan += `Decrease Muscles Tenderness to Grade ${goals.tenderness.lt}\n`;
    plan += `Decrease Muscles Spasms to Grade ${goals.spasm.lt}\n`;
    plan += `Increase Muscles Strength to ${goals.strength.lt}\n`;
    plan += `Increase ROM ${goals.rom.lt}\n`;
    plan += `Decrease impaired Activities of Daily Living to ${goals.adl.lt}.`;
  }

  return plan;
}
