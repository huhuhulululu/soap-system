import { exportSOAPAsText } from "../soap-generator";
import { generateTXSequenceStates } from "../tx-sequence-engine";

/**
 * Diagnostic: detect cases where engine claims "improvement" or
 * response says "reducing X" but the rendered text shows no actual change.
 */
describe("symptomChange vs actual rendered values consistency", () => {
  const bodies = ["SHOULDER", "KNEE", "LBP", "NECK", "ELBOW"] as const;
  const seeds = [42, 123, 456, 789, 1000];
  const issues: string[] = [];

  afterAll(() => {
    if (issues.length > 0) {
      console.log(`\n=== CONSISTENCY ISSUES (${issues.length}) ===`);
      for (const iss of issues) console.log(iss);
    } else {
      console.log("\n=== NO CONSISTENCY ISSUES FOUND ===");
    }
  });

  function extractValues(text: string) {
    return {
      scale: text.match(/scale as (\d+%)/)?.[1],
      painLabel: text.match(/Pain Scale:\s*(.+?)\s*\/10/)?.[1]?.trim(),
      tightGrade: text.match(/Grading Scale:\s*(.+?)(?:\n|$)/)?.[1]?.trim(),
      tenderGrade: text.match(/\(\+(\d)\)\s*=\s*Patient/)?.[1],
      spasmGrade: text.match(/\(\+(\d)\)\s*=>/)?.[1],
    };
  }

  for (const bp of bodies) {
    for (const seed of seeds) {
      it(`${bp} seed=${seed}: symptomChange/response should match rendered changes`, () => {
        const ieCtx: any = {
          primaryBodyPart: bp,
          noteType: "IE",
          laterality: "bilateral",
          seed,
          painCurrent: 7,
          painWorst: 9,
          painBest: 3,
          severityLevel: "moderate to severe",
          associatedSymptoms: ["soreness", "stiffness"],
          medicalHistory: [],
          secondaryBodyParts: [],
        };

        const txResult = generateTXSequenceStates(ieCtx, { txCount: 12, seed });
        const ieText = exportSOAPAsText(ieCtx);

        let prevVals = extractValues(ieText);
        let prevVs: any = null;

        for (let v = 0; v < txResult.states.length; v++) {
          const vs = txResult.states[v];
          const txCtx: any = { ...ieCtx, noteType: "TX", visitNumber: v + 1 };
          const txText = exportSOAPAsText(txCtx, vs);
          const curVals = extractValues(txText);
          const tag = `TX${v + 1} ${bp} seed=${seed}`;

          const sc = vs.symptomChange;
          const resp = vs.soaChain.assessment.response;
          const oTrends = vs.soaChain.objective;

          // Check: response claims "reducing spasm" but spasm grading unchanged
          if (resp?.includes("reducing spasm") && prevVs) {
            if (vs.spasmGrading === prevVs.spasmGrading) {
              issues.push(`${tag}: response="${resp}" but spasmGrading unchanged="${vs.spasmGrading}"`);
            }
          }
          // Check: response claims "reducing pain" but pain label unchanged
          if (resp?.includes("reducing pain") && prevVs) {
            if (vs.painScaleLabel === prevVs.painScaleLabel) {
              issues.push(`${tag}: response="${resp}" but painScaleLabel unchanged="${vs.painScaleLabel}"`);
            }
          }
          // Check: response claims "reducing tightness/tenderness" but grading unchanged
          if (resp?.includes("reducing tightness") && prevVs) {
            if (vs.tightnessGrading === prevVs.tightnessGrading) {
              issues.push(`${tag}: response="${resp}" but tightnessGrading unchanged="${vs.tightnessGrading}"`);
            }
          }
          if (resp?.includes("reducing tenderness") && prevVs) {
            if (vs.tendernessGrading === prevVs.tendernessGrading) {
              issues.push(`${tag}: response="${resp}" but tendernessGrading unchanged="${vs.tendernessGrading}"`);
            }
          }
          if (resp?.includes("improving ROM") && prevVs) {
            // ROM changes are in rendered text degrees — harder to check, skip for now
          }

          // Check: symptomChange="improvement" but NO visitState dimension changed
          if (sc?.includes("improvement") && prevVs) {
            const anyEngineChange =
              vs.painScaleLabel !== prevVs.painScaleLabel ||
              vs.symptomScale !== prevVs.symptomScale ||
              vs.severityLevel !== prevVs.severityLevel ||
              vs.tightnessGrading !== prevVs.tightnessGrading ||
              vs.tendernessGrading !== prevVs.tendernessGrading ||
              vs.spasmGrading !== prevVs.spasmGrading ||
              vs.painFrequency !== prevVs.painFrequency;
            if (!anyEngineChange) {
              // Engine trends say something changed but grading text didn't
              const trendsStr = JSON.stringify(oTrends);
              issues.push(`${tag}: symptomChange="improvement" but NO grading changed. trends=${trendsStr}, pain=${vs.painScaleLabel}, scale=${vs.symptomScale}`);
            }
          }

          prevVals = curVals;
          prevVs = vs;
        }
      });
    }
  }
});
