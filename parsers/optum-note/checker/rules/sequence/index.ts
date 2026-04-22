import type { SequenceRule } from "../../types";
import { v01 } from "./v01";
import { v02 } from "./v02";
import { v03 } from "./v03";
import { v04 } from "./v04";
import { v05 } from "./v05";
import { v06 } from "./v06";
import { v07 } from "./v07";
import { v08 } from "./v08";
import { v09 } from "./v09";
import { t08 } from "./t08";
import { t09 } from "./t09";

/**
 * These rules run inside a single pairwise loop over `visits[i-1], visits[i]`
 * for i=1..n-1, skipping when prev.isIE. The sub-rule emission order per i
 * is: V01 V02 V03 V04 V05 V06 V07 V08 V09 T08 T09.
 *
 * The `checkSequence` orchestrator (in sequence/runner.ts) applies the loop
 * and calls each rule for every (prev, cur) pair.
 */
export const SEQUENCE_RULES: SequenceRule[] = [
  v01, v02, v03, v04, v05, v06, v07, v08, v09, t08, t09,
];
