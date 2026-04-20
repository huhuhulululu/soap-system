/**
 * Subjective (TX) renderer — W3 Step 4
 *
 * Export: generateSubjectiveTX — TX (treatment visit) Subjective 段落
 */

import type { GenerationContext } from "../../types";
import type { TXVisitState } from "../tx-sequence-engine";
import { severityFromPain } from "../../shared/severity";
import {
  BODY_PART_NAMES,
  BODY_PART_AREA_NAMES,
  BODY_PART_ADL,
} from "../../shared/body-part-constants";
import {
  LATERALITY_NAMES,
  SYMPTOM_SCALE_MAP,
} from "../../shared/soap-narrative-maps";
import {
  TEMPLATE_PAIN_TYPES,
  TEMPLATE_TX_PAIN_AREA,
  TEMPLATE_TX_RADIATION,
  TEMPLATE_TX_RADIATION_INPUT_TYPE,
} from "../../shared/template-options";
import {
  calculateWeights,
  selectBestOption,
  selectBestOptions,
} from "../../parser/weight-system";
import {
  createFormatWrappers,
  wrapSingle,
} from "../../shared/html-wrapper";
import {
  getConfig,
  suppressSwellReasonInText,
  suppressSwellRadiationInText,
  withHtmlLineBreaks,
  resolveTxBodyPartKey,
  applyTxReasonChain,
  hasText,
  buildTxWeightContext,
  TX_SYMPTOM_CHANGE_OPTIONS,
  TX_CONNECTOR_OPTIONS,
  TX_REASON_OPTIONS,
  TX_SYMPTOM_SCALE_OPTIONS,
  TX_LATERALITY_OPTIONS,
  TX_NECK_DIRECTION_OPTIONS,
  TX_SEVERITY_OPTIONS,
  TX_PAIN_SCALE_OPTIONS,
  TX_PAIN_FREQUENCY_OPTIONS,
  type SOAPFormat,
} from "./_shared";

/**
 * 生成 TX Subjective 部分
 *
 * TX KNEE 模板结构:
 *   Follow up visit
 *   Patient reports: there is [symptom change] [connector] [reason] .
 *   Patient still c/o [pain types] pain [laterality] knee area [radiation] ,
 *   associated with muscles [symptoms] (scale as [scale]),
 *   impaired performing ADL's with [severity] difficulty [ADL set 1]
 *   and [severity] difficulty [ADL set 2].
 *
 *   Pain Scale: [score] /10
 *   Pain frequency: [frequency]
 */
export function generateSubjectiveTX(
  context: GenerationContext,
  visitState?: TXVisitState,
  format: SOAPFormat = "text",
): string {
  const isHtml = format === "html";
  const { wrapSingleIfNeeded, wrapMultiIfNeeded } =
    createFormatWrappers(format);
  const bodyPartName = BODY_PART_NAMES[context.primaryBodyPart];
  const bodyPartAreaName =
    BODY_PART_AREA_NAMES[context.primaryBodyPart] || bodyPartName;
  const laterality =
    LATERALITY_NAMES[context.laterality || "bilateral"] ?? "bilateral";
  const bp = context.primaryBodyPart;
  const rawRadiation = context.painRadiation ?? "without radiation";

  const weightContext = buildTxWeightContext(context, visitState);

  // TX 单一源规则: visitState 为主，缺失时才用权重兜底
  const selectedChange = hasText(visitState?.symptomChange)
    ? visitState.symptomChange
    : selectBestOption(
        calculateWeights(
          "subjective.symptomChange",
          TX_SYMPTOM_CHANGE_OPTIONS,
          weightContext,
        ),
      );
  const selectedConnector = hasText(visitState?.reasonConnector)
    ? visitState.reasonConnector
    : TX_CONNECTOR_OPTIONS[0];
  const selectedReason = hasText(visitState?.reason)
    ? visitState.reason
    : selectBestOption(
        applyTxReasonChain(
          calculateWeights("subjective.reason", TX_REASON_OPTIONS, weightContext),
          selectedChange,
          context,
        ),
      );

  const txBodyPartKey = resolveTxBodyPartKey(context.primaryBodyPart);

  // Pain Types: visitState > context > 权重系统 — 使用模板权威源
  const painTypeOptions = [
    ...TEMPLATE_PAIN_TYPES[txBodyPartKey] ||
      TEMPLATE_PAIN_TYPES.LBP,
  ];
  const selectedPainTypes =
    visitState?.painTypes && visitState.painTypes.length > 0
      ? visitState.painTypes
      : context.painTypes && context.painTypes.length > 0
        ? context.painTypes
        : selectBestOptions(
            calculateWeights("subjective.painTypes", painTypeOptions, weightContext),
            2,
          );
  const associatedSymptomOptions = [
    "soreness",
    "stiffness",
    "heaviness",
    "weakness",
    "numbness",
  ];
  const selectedAssociatedSymptoms =
    visitState?.associatedSymptoms && visitState.associatedSymptoms.length > 0
      ? [...visitState.associatedSymptoms]
      : hasText(visitState?.associatedSymptom)
        ? [visitState.associatedSymptom]
        : context.associatedSymptoms && context.associatedSymptoms.length > 0
          ? [...context.associatedSymptoms]
          : [
              selectBestOption(
                calculateWeights(
                  "subjective.associatedSymptoms",
                  associatedSymptomOptions,
                  weightContext,
                ),
              ),
            ];

  // 权重选择: ADL 活动 (TX KNEE 有两组)
  const adlActivities = BODY_PART_ADL[bp] || BODY_PART_ADL["LBP"];
  const selectedAdl =
    visitState?.adlItems && visitState.adlItems.length > 0
      ? [...visitState.adlItems]
      : selectBestOptions(
          calculateWeights(
            "subjective.adlDifficulty.activities",
            adlActivities,
            weightContext,
          ),
          5,
        );
  const effectiveAdl =
    selectedAdl.length > 0 ? selectedAdl : adlActivities.slice(0, 3);
  // 分成两组: 前2个一组, 后续一组
  const adlGroup1 = effectiveAdl.slice(0, 2);
  const adlGroup2 = effectiveAdl.slice(2, 5);

  const symptomScale =
    visitState?.symptomScale ??
    context.symptomScale ??
    getConfig(SYMPTOM_SCALE_MAP, bp);

  const renderedChange = wrapSingleIfNeeded(
    selectedChange,
    TX_SYMPTOM_CHANGE_OPTIONS,
  );
  const renderedConnector = wrapSingleIfNeeded(
    selectedConnector,
    TX_CONNECTOR_OPTIONS,
  );
  const reasonForRender = isHtml
    ? selectedReason
    : suppressSwellReasonInText(selectedReason) ?? selectedReason;
  const renderedReason = wrapMultiIfNeeded(reasonForRender, TX_REASON_OPTIONS);
  const renderedPainTypes = wrapMultiIfNeeded(selectedPainTypes, painTypeOptions);
  const renderedAssociatedSymptoms = wrapMultiIfNeeded(
    selectedAssociatedSymptoms,
    associatedSymptomOptions,
  );
  const renderedSymptomScale = wrapMultiIfNeeded(
    symptomScale,
    TX_SYMPTOM_SCALE_OPTIONS,
  );
  const lateralityPhrase = `in ${laterality}`;
  const renderedLateralityPhrase = wrapSingleIfNeeded(
    lateralityPhrase,
    TX_LATERALITY_OPTIONS,
  );
  const neckDirectionValue =
    laterality === "bilateral"
      ? "in"
      : laterality === "left"
        ? "in left side"
        : laterality === "right"
          ? "in right side"
          : "in";
  const renderedNeckDirection = wrapMultiIfNeeded(
    neckDirectionValue,
    TX_NECK_DIRECTION_OPTIONS,
  );
  const radiationOptions = TEMPLATE_TX_RADIATION[txBodyPartKey];
  const radiationForRender = isHtml
    ? rawRadiation
    : suppressSwellRadiationInText(rawRadiation) ?? rawRadiation;
  const renderedRadiation =
    isHtml && TEMPLATE_TX_RADIATION_INPUT_TYPE[txBodyPartKey] === "single"
      ? wrapSingle(radiationForRender, radiationOptions)
      : wrapMultiIfNeeded(radiationForRender, radiationOptions);

  let subjective = `Follow up visit\n`;

  // 患者报告行
  subjective += `Patient reports: there is ${renderedChange} ${renderedConnector} ${renderedReason} .\n`;

  // 持续症状 — 介词选择 + "area" 静态文本:
  // KNEE: "pain in bilateral Knee area" (bodyPartAreaName 已含 "area", 下拉有 "in bilateral")
  // SHOULDER: "pain in bilateral shoulder area" (bodyPartAreaName 已含 "area", 下拉有 "in bilateral")
  // NECK: "pain in neck area" (模板方向下拉: in|in left side|in right side|..., 无 "bilateral" 选项)
  // LBP: "pain on lower back area" (模板无侧别下拉)
  if (bp === "KNEE" || bp === "SHOULDER" || bp === "ELBOW") {
    const localizedArea = (() => {
      if (bp === "SHOULDER") {
        return wrapMultiIfNeeded(bodyPartAreaName, TEMPLATE_TX_PAIN_AREA.SHOULDER);
      }
      if (bp === "ELBOW") return "elbow area";
      return "knee area";
    })();
    subjective += `Patient still c/o ${renderedPainTypes} pain ${renderedLateralityPhrase} ${localizedArea} `;
  } else if (bp === "NECK") {
    const neckPainArea = wrapMultiIfNeeded("neck", TEMPLATE_TX_PAIN_AREA.NECK);
    subjective += `Patient still c/o ${renderedPainTypes} pain ${renderedNeckDirection} ${neckPainArea} area `;
  } else if (bp === "LBP" || bp === "MID_LOW_BACK") {
    const lbpPainAreaValue =
      bp === "MID_LOW_BACK"
        ? "mid and lower back"
        : "lower back";
    const lbpPainArea = wrapMultiIfNeeded(
      lbpPainAreaValue,
      TEMPLATE_TX_PAIN_AREA.LBP,
    );
    subjective += `Patient still c/o ${renderedPainTypes} pain on ${lbpPainArea} area `;
  } else {
    subjective += `Patient still c/o ${renderedPainTypes} pain on ${bodyPartAreaName} `;
  }
  subjective += `${renderedRadiation}, associated with muscles ${renderedAssociatedSymptoms} (scale as ${renderedSymptomScale}), `;

  // TX ADL 格式:
  // KNEE: "difficulty [ADL]" (无 "of", 两组)
  // SHOULDER/NECK: "difficulty of [ADL]" (有 "of", 两组)
  // LBP: "difficulty with ADLs like [ADL]" (单组)
  const sev =
    visitState?.severityLevel ||
    context.severityLevel ||
    severityFromPain(visitState?.painScaleCurrent ?? context.painCurrent ?? 8);
  const renderedSeverity = wrapSingleIfNeeded(sev, TX_SEVERITY_OPTIONS);
  const renderedAdlGroup1 = wrapMultiIfNeeded(adlGroup1, adlActivities);
  const renderedAdlGroup2 = wrapMultiIfNeeded(adlGroup2, adlActivities);
  const renderedAdl = wrapMultiIfNeeded(effectiveAdl, adlActivities);

  if (bp === "KNEE") {
    subjective += `impaired performing ADL's with ${renderedSeverity} difficulty ${renderedAdlGroup1} `;
    if (adlGroup2.length > 0) {
      subjective += `and ${renderedSeverity} difficulty ${renderedAdlGroup2}.\n\n`;
    } else {
      subjective += `.\n\n`;
    }
  } else if (bp === "SHOULDER" || bp === "NECK" || bp === "ELBOW") {
    subjective += `impaired performing ADL's with ${renderedSeverity} difficulty of ${renderedAdlGroup1} `;
    if (adlGroup2.length > 0) {
      subjective += `and ${renderedSeverity} difficulty of ${renderedAdlGroup2}.\n\n`;
    } else {
      subjective += `.\n\n`;
    }
  } else {
    subjective += `impaired performing ADL's with ${renderedSeverity} difficulty with ADLs like ${renderedAdl}.\n\n`;
  }

  // 疼痛评分 - TX 格式: "Pain Scale: [8] /10" (不同于 IE 的 Worst/Best/Current)
  // 使用模板下拉框有效标签 (整数或范围如 "8-7"), 而非小数
  const painScale =
    visitState?.painScaleLabel ||
    (visitState?.painScaleCurrent
      ? `${Math.round(visitState.painScaleCurrent)}`
      : context.painCurrent != null
        ? `${Math.round(context.painCurrent)}`
        : "8");
  const renderedPainScale = wrapSingleIfNeeded(painScale, TX_PAIN_SCALE_OPTIONS);
  subjective += `Pain Scale: ${renderedPainScale} /10\n`;
  // TX 格式: "Pain frequency:" (小写 f, 不同于 IE 的 "Pain Frequency:")
  const painFrequency =
    visitState?.painFrequency ||
    context.painFrequency ||
    "Constant (symptoms occur between 76% and 100% of the time)";
  const renderedPainFrequency = wrapSingleIfNeeded(
    painFrequency,
    TX_PAIN_FREQUENCY_OPTIONS,
  );
  subjective += `Pain frequency: ${renderedPainFrequency}`;

  return isHtml ? withHtmlLineBreaks(subjective) : subjective;
}
