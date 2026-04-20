/**
 * Plan (TX) renderer — W3 Step 6
 *
 * Export: generatePlanTX — TX plan 段落
 */

import type { GenerationContext } from "../../types";
import type { TXVisitState } from "../tx-sequence-engine";
import { TCM_PATTERNS } from "../../knowledge/tcm-patterns";
import {
  TEMPLATE_TX_VERB,
  TEMPLATE_TX_TREATMENT_OPTIONS,
} from "../../shared/template-options";
import {
  calculateWeights,
  selectBestOption,
} from "../../parser/weight-system";
import { wrapMulti } from "../../shared/html-wrapper";
import {
  hasText,
  buildTxWeightContext,
  type SOAPFormat,
} from "./_shared";

/**
 * 生成 TX Plan 部分
 *
 * TX KNEE 模板结构:
 *   Today's treatment principles:
 *   [focus] on [dispelling cold, drain the dampness] to speed up the recovery, soothe the tendon.
 */
export function generatePlanTX(
  context: GenerationContext,
  visitState?: TXVisitState,
  format: SOAPFormat = "text",
): string {
  const isHtml = format === "html";
  const localPattern =
    TCM_PATTERNS[context.localPattern || "Qi Stagnation"];
  const selectedVerb = hasText(visitState?.treatmentFocus)
    ? visitState.treatmentFocus
    : selectBestOption(
        calculateWeights(
          "plan.verb",
          [...TEMPLATE_TX_VERB],
          buildTxWeightContext(context, visitState),
        ),
      );

  // 治则内容: 使用模板固定 14 选项池
  const preferredTreatment = localPattern?.treatmentPrinciples?.find((item) =>
    TEMPLATE_TX_TREATMENT_OPTIONS.includes(
      item as (typeof TEMPLATE_TX_TREATMENT_OPTIONS)[number],
    ),
  );
  const selectedTreatment =
    preferredTreatment ||
    selectBestOption(
      calculateWeights(
        "plan.treatment",
        [...TEMPLATE_TX_TREATMENT_OPTIONS],
        buildTxWeightContext(context, visitState),
      ),
    ) ||
    "promote circulation, relieves pain";
  const renderedVerb =
    format === "html"
      ? wrapMulti(selectedVerb, [...TEMPLATE_TX_VERB])
      : selectedVerb;
  const renderedTreatment =
    format === "html"
      ? wrapMulti(
          selectedTreatment,
          [...TEMPLATE_TX_TREATMENT_OPTIONS],
        )
      : selectedTreatment;

  const planBody = `${renderedVerb} on ${renderedTreatment} to speed up the recovery, soothe the tendon.`;
  if (isHtml) {
    return `<strong>Today's treatment principles:</strong><br>${planBody}`;
  }

  return `Today's treatment principles:\n${planBody}`;
}
