import type { TXRule } from "../../types";
import { tx01 } from "./tx01";
import { tx02 } from "./tx02";
import { tx03 } from "./tx03";
import { t02 } from "./t02";
import { t03 } from "./t03";
import { tx04 } from "./tx04";
import { tx05 } from "./tx05";
import { tx06 } from "./tx06";
import { t06 } from "./t06";
import { t07 } from "./t07";

// Execution order preserves original checkTX emission order.
export const TX_RULES: TXRule[] = [
  tx01, tx02, tx03, t02, t03, tx04, tx05, tx06, t06, t07,
];
