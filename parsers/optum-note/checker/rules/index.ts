import type {
  DocRule,
  IERule,
  TXRule,
  SequenceRule,
  CodeRule,
  GeneratorRule,
} from "../types";
import { DOC_RULES } from "./doc";
import { IE_RULES } from "./ie";
import { TX_RULES } from "./tx";
import { SEQUENCE_RULES } from "./sequence";
import { CODE_RULES } from "./code";
import { GENERATOR_RULES } from "./generator";

export interface RuleExecutionPlan {
  doc: DocRule[];
  ie: IERule[];
  tx: TXRule[];
  sequence: SequenceRule[];
  code: CodeRule[];
  generator: GeneratorRule[];
}

/**
 * Ordered rule registry. The orchestrator (`checkDocument`) runs these groups
 * in exactly this order to preserve the original emission sequence:
 *
 *   DOC → perVisit(IE|TX) → perPair(SEQUENCE) → perVisit(CODE) → perVisit(GENERATOR)
 *
 * Adding a new rule = create `rules/<kind>/<ruleId>.ts`, add to its
 * sub-registry `rules/<kind>/index.ts`, add a smoke test.
 */
export const RULE_EXECUTION_PLAN: RuleExecutionPlan = {
  doc: DOC_RULES,
  ie: IE_RULES,
  tx: TX_RULES,
  sequence: SEQUENCE_RULES,
  code: CODE_RULES,
  generator: GENERATOR_RULES,
};
