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
  sField: string
  sFrom: string
  sTo: string
  aField: string | null
}

export interface OBinding {
  oField: string
  trend: string
  oFrom: string
  oTo: string
  aField: string | null
}

export interface AssessmentBindingResult {
  present: string
  patientChange: string
  whatChanged: string
  physicalChange: string
  findingType: string
  sBindings: SBinding[]
  oBindings: OBinding[]
  hasMismatch: boolean
}

export function getAssessmentBinding(
  state: Record<string, unknown>,
  prevState: Record<string, unknown> | null,
): AssessmentBindingResult | null {
  const soaChain = state?.soaChain as Record<string, Record<string, string>> | undefined
  if (!soaChain?.assessment) return null
  const chain = soaChain
  const s = state
  const prev = prevState

  const sBindings: SBinding[] = []
  if (prev && s.painScaleCurrent !== prev.painScaleCurrent) {
    sBindings.push({
      sField: 'Pain',
      sFrom: String(prev.painScaleLabel || prev.painScaleCurrent),
      sTo: String(s.painScaleLabel || s.painScaleCurrent),
      aField: (chain.assessment.whatChanged || '').includes('pain') ? 'pain' : null,
    })
  }
  if (chain.subjective?.frequencyChange === 'improved') {
    sBindings.push({
      sField: 'Freq',
      sFrom: String(prev?.painFrequency || '').split('(')[0].trim(),
      sTo: String(s.painFrequency || '').split('(')[0].trim(),
      aField: (chain.assessment.whatChanged || '').includes('pain frequency') ? 'pain frequency' : null,
    })
  }
  if (chain.subjective?.adlChange === 'improved') {
    sBindings.push({
      sField: 'ADL',
      sFrom: `${(prev?.adlItems as string[])?.length ?? '?'}项`,
      sTo: `${(s.adlItems as string[])?.length ?? '?'}项`,
      aField: (chain.assessment.whatChanged || '').includes('ADLs') ? 'difficulty in performing ADLs' : null,
    })
  }
  if (prev && s.symptomScale !== prev.symptomScale) {
    sBindings.push({
      sField: 'SxScale',
      sFrom: String(prev.symptomScale || ''),
      sTo: String(s.symptomScale || ''),
      aField: (chain.assessment.whatChanged || '').includes('soreness') ? 'muscles soreness sensation' : null,
    })
  }
  if (prev && s.severityLevel !== prev.severityLevel) {
    sBindings.push({
      sField: 'Severity',
      sFrom: String(prev.severityLevel || ''),
      sTo: String(s.severityLevel || ''),
      aField: (chain.assessment.whatChanged || '').includes('stiffness') ? 'muscles stiffness sensation' : null,
    })
  }

  const oBindings: OBinding[] = []
  const oTrends = [
    { field: 'Tight', trend: chain.objective?.tightnessTrend, aLabel: 'local muscles tightness', from: prev?.tightnessGrading, to: s.tightnessGrading },
    { field: 'Tender', trend: chain.objective?.tendernessTrend, aLabel: 'local muscles tenderness', from: prev?.tendernessGrading, to: s.tendernessGrading },
    { field: 'Spasm', trend: chain.objective?.spasmTrend, aLabel: 'local muscles spasms', from: prev?.spasmGrading, to: s.spasmGrading },
    { field: 'ROM', trend: chain.objective?.romTrend, aLabel: 'joint ROM', from: null, to: null },
    { field: 'Strength', trend: chain.objective?.strengthTrend, aLabel: 'muscles strength', from: prev?.strengthGrade, to: s.strengthGrade },
  ]
  for (const t of oTrends) {
    if (t.trend && t.trend !== 'stable') {
      oBindings.push({
        oField: t.field,
        trend: t.trend,
        oFrom: String(t.from || ''),
        oTo: String(t.to || ''),
        aField: (chain.assessment.findingType || '').includes(t.aLabel) ? t.aLabel : null,
      })
    }
  }

  return {
    present: chain.assessment.present || '',
    patientChange: chain.assessment.patientChange || '',
    whatChanged: chain.assessment.whatChanged || '',
    physicalChange: chain.assessment.physicalChange || '',
    findingType: chain.assessment.findingType || '',
    sBindings,
    oBindings,
    hasMismatch: sBindings.some(b => !b.aField) || oBindings.some(b => !b.aField),
  }
}
