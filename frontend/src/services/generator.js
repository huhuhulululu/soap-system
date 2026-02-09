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
  // pain
  const ps = visit.subjective.painScale
  const pain = typeof ps === 'number' ? ps
    : (ps?.current ?? ps?.worst ?? 8)

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

  return { pain, tightness, tenderness, spasm, frequency }
}

/** 拼接 ICD/CPT 文本 */
function formatIcdCpt(ieVisit, insuranceType, hasPacemaker, treatmentTime) {
  let result = ''

  // ICD from IE
  const codes = ieVisit.diagnosisCodes || []
  if (codes.length > 0) {
    codes.forEach((d, i) => {
      result += `\nDiagnosis Code: (${i + 1}) ${d.description} (${d.icd10})\n`
    })
  }

  // CPT: OPTUM/HF → 97810/97811 (without estim), others → 97813/97814 (with estim)
  // Pacemaker forces without estim regardless of insurance
  const isSimpleCode = insuranceType === 'OPTUM' || insuranceType === 'HF'
  const withEstim = !isSimpleCode && !hasPacemaker
  const baseCode = withEstim ? '97813' : '97810'
  const addOnCode = withEstim ? '97814' : '97811'
  const baseDesc = withEstim ? 'ACUP W/ ESTIM 1ST 15 MIN' : 'ACUP 1/> WO ESTIM 1ST 15 MIN'
  const addOnDesc = withEstim ? 'ACUP W/ ESTIM EA ADDL 15 MIN' : 'ACUP WO ESTIM EA ADDL 15 MIN'

  const units = Math.max(1, Math.floor((treatmentTime || 15) / 15))
  let cptIdx = 1
  result += `Procedure Code: (${cptIdx}) ${baseDesc} (${baseCode})\n`
  for (let u = 1; u < units; u++) {
    cptIdx++
    result += `Procedure Code: (${cptIdx}) ${addOnDesc} (${addOnCode})\n`
  }

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

  // 4. 提取最后一个 TX 的状态（parser reverse 后最新在前，即 txVisits[0]）
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
    soap += formatIcdCpt(ieVisit, insuranceType, hasPacemaker, treatmentTime)
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
