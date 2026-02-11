/**
 * 续写生成服务
 * 调用链: parseOptumNote → bridge → engine → exportSOAPAsText → 拼接 ICD/CPT
 */
import { parseOptumNote } from '../../../parsers/optum-note/parser.ts'
import { bridgeToContext, bridgeVisitToSOAPNote } from '../../../parsers/optum-note/checker/bridge.ts'
import { exportSOAPAsText } from '../../../src/generator/soap-generator.ts'
import { generateTXSequenceStates } from '../../../src/generator/tx-sequence-engine.ts'
import { setWhitelist } from '../../../src/parser/template-rule-whitelist.browser.ts'
import whitelistData from '../data/whitelist.json'

// 初始化 whitelist（一次性，绕过 fs）
let _inited = false
function ensureInit() {
  if (_inited) return
  setWhitelist(whitelistData)
  _inited = true
}

/** 检测无 header 时注入假 header */
function ensureHeader(text) {
  if (/PATIENT:|DOB:/i.test(text)) return text
  return 'UNKNOWN, PATIENT (DOB: 01/01/2000 ID: 0000000000) Date of Service: 01/01/2025 Printed on: 01/01/2025\n' + text
}

/** 从 VisitRecord 提取 engine initialState */
function extractInitialState(visit) {
  // pain — range label "8-7" → parser returns {value:8, range:{min:8,max:7}}
  // 取 range.max (低端=当前值), 而非 value (高端=起始值)
  const ps = visit.subjective.painScale
  const pain = typeof ps === 'number' ? ps
    : (ps?.current ?? (ps?.range ? Math.min(ps.range.min, ps.range.max) : ps?.value) ?? ps?.worst ?? 8)

  // tightness: severity text → number
  const tMap = { severe: 4, 'moderate to severe': 3.5, moderate: 3, 'mild to moderate': 2, mild: 1 }
  const tightness = tMap[(visit.objective.tightnessMuscles?.gradingScale || '').toLowerCase()] ?? 3

  // tenderness: "(+3)..." → 3
  const tenderDesc = visit.objective.tendernessMuscles?.scaleDescription || ''
  const tenderMatch = tenderDesc.match(/\+(\d)/)
  const tenderness = tenderMatch ? parseInt(tenderMatch[1]) : 3

  // spasm: frequencyScale 直接数字
  const spasm = visit.objective.spasmMuscles?.frequencyScale ?? 3

  // frequency: text → level
  const fText = (visit.subjective.painFrequency || '').toLowerCase()
  const frequency = fText.includes('constant') ? 3
    : fText.includes('frequent') ? 2
    : fText.includes('occasional') ? 1
    : fText.includes('intermittent') ? 0
    : 2

  return {
    pain, tightness, tenderness, spasm, frequency,
    painTypes: visit.subjective.painTypes?.length > 0 ? visit.subjective.painTypes : undefined,
    associatedSymptom: (() => {
      const m = (visit.subjective.chiefComplaint || '').match(/associated with muscles?\s+(\w+)/i)
      return m ? m[1].toLowerCase() : undefined
    })(),
    symptomScale: visit.subjective.muscleWeaknessScale || undefined,
    generalCondition: visit.assessment?.generalCondition || undefined,
    inspection: visit.objective?.inspection || undefined,
    tightnessGrading: visit.objective.tightnessMuscles?.gradingScale || '',
    tendernessGrade: tenderMatch ? `+${tenderMatch[1]}` : undefined,
    tonguePulse: (visit.objective?.tonguePulse?.tongue && visit.objective?.tonguePulse?.pulse)
      ? { tongue: visit.objective.tonguePulse.tongue, pulse: visit.objective.tonguePulse.pulse }
      : undefined,
    acupoints: visit.plan?.acupoints?.length > 0 ? visit.plan.acupoints : undefined,
    electricalStimulation: visit.plan?.electricalStimulation,
    treatmentTime: visit.plan?.treatmentTime,
  }
}

/** 拼接 ICD/CPT 文本 - 直接沿用 IE 的代码 */
function formatIcdCpt(ieVisit) {
  let result = ''

  // ICD from IE
  const diagCodes = ieVisit.diagnosisCodes || []
  diagCodes.forEach((d, i) => {
    result += `Diagnosis Code: (${i + 1}) ${d.description} (${d.icd10})\n`
  })

  // CPT from IE - 直接沿用，不编造
  const procCodes = ieVisit.procedureCodes || []
  procCodes.forEach((p, i) => {
    result += `Procedure Code: (${i + 1}) ${p.description} (${p.cpt})\n`
  })

  return result
}

/**
 * 主函数：生成续写 TX notes
 * @param {string} text - 用户粘贴的 IE+TX 文本
 * @param {object} options - { insuranceType, treatmentTime, generateCount }
 * @returns {{ visits, context, ieVisit, existingTxCount, error? }}
 */
export function generateContinuation(text, options = {}) {
  ensureInit()

  const { insuranceType = 'OPTUM', treatmentTime = 60, generateCount } = options

  // 1. 解析
  const prepared = ensureHeader(text)
  const parsed = parseOptumNote(prepared)
  if (!parsed.success || !parsed.document) {
    return { error: '解析失败: ' + (parsed.errors?.[0]?.message || '未知错误'), visits: [] }
  }

  const doc = parsed.document

  // 2. 找 IE
  const ieIndex = doc.visits.findIndex(v => v.subjective.visitType === 'INITIAL EVALUATION')
  if (ieIndex < 0) {
    return { error: '未找到初诊记录 (INITIAL EVALUATION)', visits: [] }
  }

  const ieVisit = doc.visits[ieIndex]
  const existingTxCount = doc.visits.filter(v => v.subjective.visitType !== 'INITIAL EVALUATION').length
  const maxNew = 11 - existingTxCount
  if (maxNew <= 0) {
    return { error: '已有 ' + existingTxCount + ' 个 TX，已达上限 11', visits: [] }
  }

  const toGenerate = Math.min(generateCount || maxNew, maxNew)
  const totalTx = existingTxCount + toGenerate

  // 3. Bridge
  const context = bridgeToContext(doc, ieIndex)
  context.noteType = 'TX'
  context.insuranceType = insuranceType
  context.previousIE = bridgeVisitToSOAPNote(ieVisit)

  // 4. 提取最后一个 TX 的状态（parser reverse 后时间正序，最新在末尾）
  const txVisits = doc.visits.filter(v => v.subjective.visitType !== 'INITIAL EVALUATION')
  const lastTx = txVisits.length > 0 ? txVisits[0] : null
  const initialState = lastTx ? extractInitialState(lastTx) : undefined

  // 5. 生成
  const hasPacemaker = context.hasPacemaker || false
  const states = generateTXSequenceStates(context, {
    txCount: totalTx,
    startVisitIndex: existingTxCount + 1,
    initialState
  })

  // 6. 导出文本 + ICD/CPT
  const visits = states.map(state => {
    let soap = exportSOAPAsText(context, state)
    soap += formatIcdCpt(ieVisit)
    return { visitIndex: state.visitIndex, text: soap, state }
  })

  return {
    visits,
    context,
    ieVisit,
    existingTxCount,
    parseSummary: {
      bodyPart: context.primaryBodyPart,
      laterality: context.laterality,
      localPattern: context.localPattern,
      chronicityLevel: context.chronicityLevel,
      iePain: context.previousIE?.subjective?.painScale?.current,
      lastTxPain: initialState?.pain,
      existingTxCount,
      toGenerate
    }
  }
}
