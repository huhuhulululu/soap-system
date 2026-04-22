import { doc01 } from "../doc/doc01";
import { makeDocCtx, makeVisit, runDocRule } from "./harness";

describe("DOC01 — 缺少初诊记录", () => {
  it("fires when no IE visit present", () => {
    const visits = [makeVisit(), makeVisit()]; // both TX
    const errs = runDocRule(doc01, makeDocCtx(visits));
    expect(errs).toHaveLength(1);
    expect(errs[0].ruleId).toBe("DOC01");
    expect(errs[0].severity).toBe("CRITICAL");
  });

  it("silent when IE present", () => {
    const ie = makeVisit({
      subjective: { ...makeVisit().subjective, visitType: "INITIAL EVALUATION" },
    });
    expect(runDocRule(doc01, makeDocCtx([ie]))).toEqual([]);
  });
});
