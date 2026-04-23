/**
 * SOAP 生产服务 — 编写模式逻辑的后端版本
 *
 * 精确复刻 frontend/src/workers/soap-engine.worker.ts 的生产管线:
 *   normalizeGenerationContext → generateTXSequenceStates
 *   → per-state exportSOAPAsText + patchSOAPText
 *   → exportSOAP("html") for MDLand TinyMCE
 *   → splitSOAPText 拆分四段
 */

import {
  normalizeGenerationContext,
  type NormalizeInput,
} from "../../src/shared/normalize-generation-context";
import {
  generateTXSequenceStates,
  type TXVisitState,
} from "../../src/generator/tx-sequence-engine";
import {
  exportSOAP,
  exportSOAPAsText,
} from "../../src/generator/soap-generator";
import { patchSOAPText } from "../../src/generator/objective-patch";
import { convertSOAPToHTML, splitSOAPText } from "./text-to-html";

type PatchVisitState = Parameters<typeof patchSOAPText>[2];

export interface ProduceRequest {
  readonly input: NormalizeInput;
  readonly txCount: number;
  readonly seed?: number;
  readonly realisticPatch?: boolean;
  readonly startVisitIndex?: number;
  readonly ieTxCount?: number;
}

export interface ProduceNote {
  readonly visitIndex: number;
  readonly type: "IE" | "TX";
  readonly text: string;
  readonly soap: {
    readonly subjective: string;
    readonly objective: string;
    readonly assessment: string;
    readonly plan: string;
  };
  readonly html: {
    readonly subjective: string;
    readonly objective: string;
    readonly assessment: string;
    readonly plan: string;
  };
}

export interface ProduceResult {
  readonly seed: number;
  readonly notes: readonly ProduceNote[];
}

/**
 * 单患者 SOAP 生产 — 精确复刻 soap-engine.worker.ts
 */
export function produceSinglePatient(request: ProduceRequest): ProduceResult {
  const { input, txCount, realisticPatch, startVisitIndex, ieTxCount } =
    request;

  const { context, initialState } = normalizeGenerationContext(input);
  const txCtx = { ...context, noteType: "TX" as const };

  const mayPatch = (
    text: string,
    ctx: typeof context,
    vs?: PatchVisitState,
  ) => (realisticPatch ? patchSOAPText(text, ctx, vs) : text);

  const { states, seed: actualSeed } = generateTXSequenceStates(txCtx, {
    txCount:
      input.noteType === "IE" ? (ieTxCount ?? txCount) : txCount,
    startVisitIndex: startVisitIndex ?? 1,
    seed: request.seed,
    initialState,
  });

  const notes: ProduceNote[] = [];

  // IE note (if noteType === "IE")
  if (input.noteType === "IE") {
    const ieText = mayPatch(exportSOAPAsText(context), context);
    const ieSoap = splitSOAPText(ieText);
    const ieHtml = convertSOAPToHTML(ieText);

    notes.push({
      visitIndex: 0,
      type: "IE",
      text: ieText,
      soap: ieSoap,
      html: ieHtml,
    });
  }

  // TX notes — per-state rendering
  for (const state of states) {
    const text = mayPatch(exportSOAPAsText(txCtx, state), txCtx, state);
    const soap = splitSOAPText(text);

    // TX HTML: exportSOAP("html") with ppnSelectCombo spans for MDLand
    const fullHtml = exportSOAP(txCtx, state, "html");
    const html = splitSOAPText(fullHtml);

    notes.push({
      visitIndex: state.visitIndex,
      type: "TX",
      text,
      soap,
      html,
    });
  }

  return { seed: actualSeed, notes };
}
