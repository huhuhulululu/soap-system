import type { CodeRule } from "../../types";
import { dx03 } from "./dx03";
import { dx01 } from "./dx01";
import { dx04 } from "./dx04";
import { dx02 } from "./dx02";
import { cpt01 } from "./cpt01";
import { cpt02 } from "./cpt02";
import { cpt03 } from "./cpt03";

// Original per-visit emission order: DX03, DX01, DX04, DX02, CPT01, CPT02, CPT03.
export const CODE_RULES: CodeRule[] = [dx03, dx01, dx04, dx02, cpt01, cpt02, cpt03];
