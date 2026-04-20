/**
 * SOAP 笔记生成器 (Barrel)
 *
 * W3 Step 9 瘦身: 3086 LOC → ~65 LOC 纯 re-export。
 * 所有生成逻辑已按 renderer 层拆分到 src/generator/renderers/*.ts。
 *
 * 本文件仅做 API 兼容层：consumers (soap-producer, batch-generator,
 * frontend engine.test.ts 等) 继续从 "./soap-generator" import，无需
 * 修改任何调用端。
 *
 * 新增/修改 renderer 逻辑时直接改 renderers/ 下对应文件，barrel 不动。
 * 参见 docs/decisions.md D43。
 */

// ---------- value re-exports ----------

// body-part-constants passthrough (历史调用端)
export { BODY_PART_NAMES } from "../shared/body-part-constants";

// muscle-seed passthrough (Tier B step 1 Phase B1.2)
export { objectiveMuscleSeed } from "../shared/muscle-seed";

// subjective-ie renderer
export {
  generateSubjective,
  filterADLByDemographics,
  MUSCLE_SEVERITY_ORDER,
} from "./renderers/subjective-ie";

// subjective-tx renderer
export { generateSubjectiveTX } from "./renderers/subjective-tx";

// objective renderer
export { generateObjective } from "./renderers/objective";

// assessment renderer (IE + TX)
export {
  generateAssessment,
  generateAssessmentTX,
} from "./renderers/assessment";

// plan renderers
export { generatePlanIE } from "./renderers/plan-ie";
export { generatePlanTX } from "./renderers/plan-tx";

// needle-protocol renderer
export { generateNeedleProtocol } from "./renderers/needle-protocol";

// export orchestrators (consume all other renderers)
export {
  exportSOAPSections,
  exportSOAP,
  exportSOAPAsText,
  exportTXSeriesAsText,
} from "./renderers/export";

// ---------- type re-exports ----------

export type {
  SOAPFormat,
  SOAPSectionsOutput,
  TXSeriesTextItem,
} from "./renderers/export";
