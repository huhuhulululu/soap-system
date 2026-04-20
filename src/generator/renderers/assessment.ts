/**
 * Assessment renderer — W3 Step 6
 *
 * Exports:
 * - generateAssessment: IE assessment 段落
 * - generateAssessmentTX: TX (follow-up visit) assessment 段落
 */

import type { GenerationContext } from "../../types";
import type { TXVisitState } from "../tx-sequence-engine";
import { TCM_PATTERNS } from "../../knowledge/tcm-patterns";
import {
  BODY_PART_NAMES,
  BODY_PART_AREA_NAMES,
} from "../../shared/body-part-constants";
import { LATERALITY_NAMES } from "../../shared/soap-narrative-maps";
import type { BodyPartKey } from "../../shared/template-options";
import {
  TEMPLATE_TREATMENT_VERB,
  TEMPLATE_HARMONIZE,
  TEMPLATE_TREATMENT_PURPOSE,
  TEMPLATE_TX_PATIENT_CHANGE_BY_BODY_PART,
  TEMPLATE_TX_WHAT_CHANGED_O,
  TEMPLATE_TX_WHAT_CHANGED_S,
  TEMPLATE_TX_ASSESSMENT_AREA,
  TEMPLATE_TX_LOCAL_PATTERN_OPTIONS,
} from "../../shared/template-options";
import {
  calculateWeights,
  selectBestOption,
} from "../../parser/weight-system";
import { createFormatWrappers } from "../../shared/html-wrapper";
import {
  withHtmlLineBreaks,
  resolveTxBodyPartKey,
  buildTxWeightContext,
  hasText,
  normalizeTxPatientChange,
  TX_GENERAL_CONDITION_OPTIONS,
  TX_SYMPTOM_PRESENT_OPTIONS,
  TX_WHAT_CHANGED_OPTIONS,
  TX_PHYSICAL_CHANGE_OPTIONS,
  TX_FINDING_TYPE_OPTIONS,
  TX_TOLERATED_OPTIONS,
  TX_RESPONSE_OPTIONS,
  TX_LATERALITY_OPTIONS,
  type SOAPFormat,
} from "./_shared";

/**
 * 生成 Assessment 部分
 * KNEE 模板格式:
 *   TCM Dx:
 *   [bilateral] knee pain due to [Cold-Damp + Wind-Cold] in local meridian,
 *   but patient also has [Kidney Yang Deficiency] in the general.
 *   Today's TCM treatment principles:
 *   [focus] on [warm channels, dispel cold and damp, promote circulation] and harmonize [Liver and Kidney] balance in order to [promote healthy joint and lessen dysfunction in all aspects].
 *   Acupuncture Eval was done today on bilateral knee .
 */
export function generateAssessment(context: GenerationContext): string {
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart];
  const bp = context.primaryBodyPart;
  const localPatternName = context.localPattern || "Qi Stagnation";
  const systemicPattern = context.systemicPattern || "";
  const localPattern = TCM_PATTERNS[localPatternName];
  const lateralityKey = context.laterality || "bilateral";
  const laterality = LATERALITY_NAMES[lateralityKey] ?? "bilateral";

  // KNEE 模板: "[Bilateral] knee pain"
  // SHOULDER 模板: "Bilateral - shoulder area pain due to..."
  const lateralityUpper =
    laterality.charAt(0).toUpperCase() + laterality.slice(1);
  const bodyPartAreaName = BODY_PART_AREA_NAMES[bp] || bodyPartName;
  // TCM Dx 条件名: NECK 用 "Cervical", 其他用 bodyPartName 首字母大写
  const assessmentConditionName =
    bp === "NECK"
      ? "Cervical"
      : bodyPartName.charAt(0).toUpperCase() + bodyPartName.slice(1);

  let assessment = `TCM Dx:\n`;
  if (bp === "KNEE") {
    assessment += `${lateralityUpper} ${bodyPartName} pain due to ${localPatternName} in local meridian`;
  } else if (bp === "SHOULDER") {
    assessment += `${lateralityUpper} - ${bodyPartAreaName} pain due to ${localPatternName} in local meridian`;
  } else if (bp === "NECK") {
    assessment += `${assessmentConditionName} pain due to ${localPatternName} in local meridian`;
  } else if (bp === "LBP") {
    assessment += `${assessmentConditionName} pain due to ${localPatternName} in local meridian`;
  } else {
    assessment += `${assessmentConditionName} pain due to ${localPatternName} in local meridian`;
  }
  if (systemicPattern) {
    assessment += `, but patient also has ${systemicPattern} in the general.\n`;
  } else {
    assessment += `.\n`;
  }

  // 治则
  const treatmentPrinciples = localPattern?.treatmentPrinciples || [
    "promote circulation, relieves pain",
  ];
  const treatmentVerb =
    TEMPLATE_TREATMENT_VERB[bp as BodyPartKey] || TEMPLATE_TREATMENT_VERB.LBP;
  const harmonize =
    TEMPLATE_HARMONIZE[bp as BodyPartKey] || TEMPLATE_HARMONIZE.LBP;
  const treatmentPurpose =
    TEMPLATE_TREATMENT_PURPOSE[bp as BodyPartKey] ||
    TEMPLATE_TREATMENT_PURPOSE.LBP;

  assessment += `Today's TCM treatment principles:\n`;
  // 防重复: 如果 verb 和 principle 以同一个单词开头，用 'focus' 替代
  let finalVerb = treatmentVerb;
  const verbFirstWord = treatmentVerb.split(" ")[0].toLowerCase();
  const principleFirstWord = treatmentPrinciples[0].split(" ")[0].toLowerCase();
  if (verbFirstWord === principleFirstWord) {
    finalVerb = "focus";
  }
  assessment += `${finalVerb} on ${treatmentPrinciples[0]} and harmonize ${harmonize} balance in order to ${treatmentPurpose}.\n`;

  // 评估位置 — 介词因部位而异:
  // KNEE: "on bilateral knee area."
  // SHOULDER: "Bilateral -shoulder area"
  // LBP: "along bilateral lower back."
  // NECK: "on B/L Cervical"
  if (bp === "KNEE") {
    assessment += `Acupuncture Eval was done today on ${laterality} ${bodyPartName} area.`;
  } else if (bp === "SHOULDER") {
    assessment += `Acupuncture Eval was done today ${lateralityUpper} -${bodyPartAreaName}`;
  } else if (bp === "LBP" || bp === "MID_LOW_BACK") {
    assessment += `Acupuncture Eval was done today along ${laterality} ${bodyPartName}.`;
  } else if (bp === "NECK") {
    const neckLaterality = laterality === "bilateral" ? "B/L" : laterality;
    assessment += `Acupuncture Eval was done today on ${neckLaterality} ${assessmentConditionName}`;
  } else {
    assessment += `Acupuncture Eval was done today on ${laterality} ${bodyPartName}.`;
  }

  return assessment;
}

/**
 * 生成 TX Assessment 部分
 */
export function generateAssessmentTX(
  context: GenerationContext,
  visitState?: TXVisitState,
  format: SOAPFormat = "text",
): string {
  const isHtml = format === "html";
  const { wrapSingleIfNeeded, wrapMultiIfNeeded } =
    createFormatWrappers(format);
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart];
  const bp = context.primaryBodyPart;
  const laterality =
    LATERALITY_NAMES[context.laterality || "bilateral"] ?? "bilateral";
  const txBodyPartKey = resolveTxBodyPartKey(context.primaryBodyPart);

  const weightContext = buildTxWeightContext(context, visitState);

  const selectedCondition = hasText(visitState?.generalCondition)
    ? visitState.generalCondition
    : selectBestOption(
        calculateWeights(
          "assessment.condition",
          TX_GENERAL_CONDITION_OPTIONS,
          weightContext,
        ),
      );

  const visitAssessment = visitState?.soaChain?.assessment;
  const useVisitAssessment =
    visitAssessment != null &&
    hasText(visitAssessment.present) &&
    hasText(visitAssessment.patientChange) &&
    hasText(visitAssessment.whatChanged) &&
    hasText(visitAssessment.physicalChange) &&
    hasText(visitAssessment.tolerated) &&
    hasText(visitAssessment.response);

  const selectedPresent = useVisitAssessment
    ? visitAssessment!.present
    : selectBestOption(
        calculateWeights(
          "assessment.present",
          TX_SYMPTOM_PRESENT_OPTIONS,
          weightContext,
        ),
      );
  const txPatientChangeOptions =
    TEMPLATE_TX_PATIENT_CHANGE_BY_BODY_PART[txBodyPartKey];
  const selectedPatientChange = useVisitAssessment
    ? normalizeTxPatientChange(
        visitAssessment!.patientChange,
        txPatientChangeOptions,
      )
    : selectBestOption(
        calculateWeights(
          "assessment.patientChange",
          [...txPatientChangeOptions],
          weightContext,
        ),
      );
  const selectedWhat = useVisitAssessment
    ? visitAssessment!.whatChanged
    : selectBestOption(
        calculateWeights(
          "assessment.whatChanged",
          TX_WHAT_CHANGED_OPTIONS,
          weightContext,
        ),
      );
  const selectedPhysical = useVisitAssessment
    ? visitAssessment!.physicalChange
    : selectBestOption(
        calculateWeights(
          "assessment.physicalChange",
          TX_PHYSICAL_CHANGE_OPTIONS,
          weightContext,
        ),
      );
  const selectedFinding = useVisitAssessment
    ? (visitAssessment!.findingType ?? "")
    : selectBestOption(
        calculateWeights(
          "assessment.findingType",
          TX_FINDING_TYPE_OPTIONS,
          weightContext,
        ),
      );
  const selectedTolerated = useVisitAssessment
    ? visitAssessment!.tolerated
    : selectBestOption(
        calculateWeights(
          "assessment.tolerated",
          TX_TOLERATED_OPTIONS,
          weightContext,
        ),
      );
  const selectedResponse = useVisitAssessment
    ? visitAssessment!.response
    : selectBestOption(
        calculateWeights(
          "assessment.response",
          TX_RESPONSE_OPTIONS,
          weightContext,
        ),
      );
  const adverseEffect =
    useVisitAssessment && hasText(visitAssessment!.adverseEffect)
      ? visitAssessment!.adverseEffect
      : "No adverse side effect post treatment.";
  const findingLabels = [
    "joint ROM",
    "joint ROM limitation",
    "local muscles tightness",
    "local muscles tenderness",
    "local muscles spasms",
    "muscles strength",
  ];
  const physicalHasEmbeddedFinding = findingLabels.some((label) =>
    selectedPhysical.includes(label),
  );

  const lateralityPhrase = `in ${laterality}`;
  const renderedLateralityPhrase = wrapSingleIfNeeded(
    lateralityPhrase,
    TX_LATERALITY_OPTIONS,
  );
  const renderedCondition = wrapSingleIfNeeded(
    selectedCondition,
    TX_GENERAL_CONDITION_OPTIONS,
  );
  const renderedPresent = wrapSingleIfNeeded(
    selectedPresent,
    TX_SYMPTOM_PRESENT_OPTIONS,
  );
  const renderedPatientChange = wrapSingleIfNeeded(
    selectedPatientChange,
    txPatientChangeOptions,
  );
  const renderedWhat = wrapMultiIfNeeded(
    selectedWhat,
    TEMPLATE_TX_WHAT_CHANGED_S[txBodyPartKey],
  );
  const renderedPhysical = wrapSingleIfNeeded(
    selectedPhysical,
    TX_PHYSICAL_CHANGE_OPTIONS,
  );
  const renderedFinding = wrapMultiIfNeeded(
    selectedFinding,
    TEMPLATE_TX_WHAT_CHANGED_O[txBodyPartKey],
  );
  const renderedTolerated = wrapMultiIfNeeded(
    selectedTolerated,
    TX_TOLERATED_OPTIONS,
  );
  const renderedResponse = wrapMultiIfNeeded(
    selectedResponse,
    TX_RESPONSE_OPTIONS,
  );
  const localPatternValue = context.localPattern || "Qi Stagnation";
  const renderedLocalPattern = wrapMultiIfNeeded(
    localPatternValue,
    TEMPLATE_TX_LOCAL_PATTERN_OPTIONS,
  );

  let assessment = "";

  // 治疗延续 — 各部位格式差异:
  // KNEE: "The patient continues treatment for in bilateral knee area today."
  // SHOULDER: "The patient continues treatment for in bilateral shoulder area today."
  // ELBOW: "The patient continues treatment for in bilateral elbow area today."
  // LBP: "The patient continues treatment for lower back area today."
  // NECK: "Patient continue treatment for neck area today."
  if (bp === "KNEE" || bp === "ELBOW") {
    assessment += `The patient continues treatment for ${renderedLateralityPhrase} ${bodyPartName.toLowerCase()} area today.\n`;
  } else if (bp === "SHOULDER") {
    const renderedShoulderAssessmentArea = wrapMultiIfNeeded(
      "shoulder area",
      TEMPLATE_TX_ASSESSMENT_AREA.SHOULDER,
    );
    assessment += `The patient continues treatment for ${renderedLateralityPhrase} ${renderedShoulderAssessmentArea} area today.\n`;
  } else if (bp === "NECK") {
    const renderedNeckAssessmentArea = wrapSingleIfNeeded(
      "neck",
      TEMPLATE_TX_ASSESSMENT_AREA.NECK,
    );
    assessment += `Patient continue treatment for ${renderedNeckAssessmentArea} area today.\n`;
  } else {
    const lbpAssessmentAreaValue =
      bp === "MIDDLE_BACK"
        ? "midback"
        : bp === "MID_LOW_BACK"
          ? "mid and lower back"
          : "lower back";
    const renderedLbpAssessmentArea = wrapMultiIfNeeded(
      lbpAssessmentAreaValue,
      TEMPLATE_TX_ASSESSMENT_AREA.LBP,
    );
    assessment += `The patient continues treatment for ${renderedLbpAssessmentArea} area today.\n`;
  }

  assessment += `The patient's general condition is ${renderedCondition}, `;
  assessment += `compared with last treatment, the patient presents with ${renderedPresent} `;
  assessment += `The patient has ${renderedPatientChange} ${renderedWhat}, `;
  if (physicalHasEmbeddedFinding) {
    assessment += `physical finding has ${renderedPhysical}. `;
  } else {
    assessment += selectedFinding
      ? `physical finding has ${renderedPhysical} ${renderedFinding}. `
      : `physical finding has ${renderedPhysical}. `;
  }
  assessment += `Patient tolerated ${renderedTolerated} ${renderedResponse}. `;
  assessment += `${adverseEffect}\n`;

  // 证型延续
  assessment += `Current patient still has ${renderedLocalPattern} in local meridian that cause the pain.`;

  return isHtml ? withHtmlLineBreaks(assessment) : assessment;
}
