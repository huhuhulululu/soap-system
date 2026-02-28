/**
 * Assessment S↔A / O↔A 绑定映射 composable
 * 从 soaChain 数据中提取 S/O 变量变化到 A 动态字段的一对一映射关系
 *
 * S → A 前半段 (present + patientChange + whatChanged):
 *   painScale changed → "pain"
 *   painFrequency improved → "pain frequency"
 *   adl improved → "difficulty in performing ADLs"
 *   symptomScale changed → "muscles soreness sensation"
 *   severity changed → "muscles stiffness sensation"
 *
 * O → A 后半段 (physicalChange + findingType):
 *   tightness trend → "local muscles tightness"
 *   tenderness trend → "local muscles tenderness"
 *   spasm trend → "local muscles spasms"
 *   ROM trend → "joint ROM"
 *   strength trend → "muscles strength"
 */

export interface SBinding {
  sField: string;
  sFrom: string;
  sTo: string;
  aField: string | null;
}

export interface OBinding {
  oField: string;
  trend: string;
  oFrom: string;
  oTo: string;
  aField: string | null;
}

export interface AssessmentBindingResult {
  present: string;
  patientChange: string;
  whatChanged: string;
  physicalChange: string;
  findingType: string;
  sBindings: SBinding[];
  oBindings: OBinding[];
  hasMismatch: boolean;
}

export function getAssessmentBinding(
  state: Record<string, unknown>,
  prevState: Record<string, unknown> | null,
): AssessmentBindingResult | null {
  const soaChain = state?.soaChain as
    | Record<string, Record<string, string>>
    | undefined;
  if (!soaChain?.assessment) return null;
  const chain = soaChain;
  const s = state;
  const prev = prevState;

  const sBindings: SBinding[] = [];
  if (prev && s.painScaleCurrent !== prev.painScaleCurrent) {
    sBindings.push({
      sField: "Pain",
      sFrom: String(prev.painScaleLabel || prev.painScaleCurrent),
      sTo: String(s.painScaleLabel || s.painScaleCurrent),
      aField: (chain.assessment.whatChanged || "").includes("pain")
        ? "pain"
        : null,
    });
  }
  const curFreqText = String(s.painFrequency || "")
    .split("(")[0]
    .trim();
  const prevFreqText = String(prev?.painFrequency || "")
    .split("(")[0]
    .trim();
  if (prev && curFreqText !== prevFreqText) {
    sBindings.push({
      sField: "Freq",
      sFrom: prevFreqText,
      sTo: curFreqText,
      aField: (chain.assessment.whatChanged || "").includes("pain frequency")
        ? "pain frequency"
        : null,
    });
  }
  const curAdlCount = (s.adlItems as string[])?.length ?? null;
  const prevAdlCount = (prev?.adlItems as string[])?.length ?? null;
  if (
    prev &&
    curAdlCount !== null &&
    prevAdlCount !== null &&
    curAdlCount !== prevAdlCount
  ) {
    sBindings.push({
      sField: "ADL",
      sFrom: `${prevAdlCount}项`,
      sTo: `${curAdlCount}项`,
      aField: (chain.assessment.whatChanged || "").includes("ADLs")
        ? "difficulty in performing ADLs"
        : null,
    });
  }
  if (prev && s.symptomScale !== prev.symptomScale) {
    sBindings.push({
      sField: "SxScale",
      sFrom: String(prev.symptomScale || ""),
      sTo: String(s.symptomScale || ""),
      aField: (chain.assessment.whatChanged || "").includes("soreness")
        ? "muscles soreness sensation"
        : null,
    });
  }
  if (prev && s.severityLevel !== prev.severityLevel) {
    sBindings.push({
      sField: "Severity",
      sFrom: String(prev.severityLevel || ""),
      sTo: String(s.severityLevel || ""),
      aField: (chain.assessment.whatChanged || "").includes("stiffness")
        ? "muscles stiffness sensation"
        : null,
    });
  }

  const oBindings: OBinding[] = [];
  const oTrends = [
    {
      field: "Tight",
      aLabel: "local muscles tightness",
      from: prev?.tightnessGrading,
      to: s.tightnessGrading,
    },
    {
      field: "Tender",
      aLabel: "local muscles tenderness",
      from: prev?.tendernessGrading,
      to: s.tendernessGrading,
    },
    {
      field: "Spasm",
      aLabel: "local muscles spasms",
      from: prev?.spasmGrading,
      to: s.spasmGrading,
    },
    { field: "ROM", aLabel: "joint ROM", from: null, to: null },
    {
      field: "Strength",
      aLabel: "muscles strength",
      from: prev?.strengthGrade,
      to: s.strengthGrade,
    },
  ];
  const trendKeyMap: Record<string, string> = {
    Tight: "tightnessTrend",
    Tender: "tendernessTrend",
    Spasm: "spasmTrend",
    ROM: "romTrend",
    Strength: "strengthTrend",
  };
  for (const t of oTrends) {
    const fromStr = String(t.from || "");
    const toStr = String(t.to || "");
    // ROM has no direct grading field — fall back to engine trend
    const hasVisibleChange =
      t.field === "ROM"
        ? chain.objective?.romTrend && chain.objective.romTrend !== "stable"
        : prev && fromStr !== toStr && fromStr !== "" && toStr !== "";
    if (hasVisibleChange) {
      oBindings.push({
        oField: t.field,
        trend: chain.objective?.[trendKeyMap[t.field]] || "changed",
        oFrom: fromStr,
        oTo: toStr,
        aField: (chain.assessment.findingType || "").includes(t.aLabel)
          ? t.aLabel
          : null,
      });
    }
  }

  return {
    present: chain.assessment.present || "",
    patientChange: chain.assessment.patientChange || "",
    whatChanged: chain.assessment.whatChanged || "",
    physicalChange: chain.assessment.physicalChange || "",
    findingType: chain.assessment.findingType || "",
    sBindings,
    oBindings,
    hasMismatch:
      sBindings.some((b) => !b.aField) || oBindings.some((b) => !b.aField),
  };
}
