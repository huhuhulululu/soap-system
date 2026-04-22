import type { GeneratorRule } from "../../types";
import { s2 } from "./s2";
import { s3 } from "./s3";
import { s7 } from "./s7";
import { o1 } from "./o1";
import { o2 } from "./o2";
import { o3 } from "./o3";
import { o8 } from "./o8";
import { o9 } from "./o9";
import { a5 } from "./a5";
import { p1 } from "./p1";
import { p2 } from "./p2";
import { x1 } from "./x1";
import { x2 } from "./x2";
import { x3 } from "./x3";
import { x4 } from "./x4";

// Per-visit emission order: S2 S3 S7 O1 O2 O3 O8 O9 A5 P1 P2 X1 X2 X3 X4.
export const GENERATOR_RULES: GeneratorRule[] = [
  s2, s3, s7, o1, o2, o3, o8, o9, a5, p1, p2, x1, x2, x3, x4,
];
