<script setup>
import { ref, reactive, computed, watch } from 'vue'
import whitelist from '../data/whitelist.json'
import { TEMPLATE_ONLY_RULES } from '../../../src/parser/template-logic-rules.ts'
import { generateTXSequenceStates } from '../../../src/generator/tx-sequence-engine.ts'
import { exportSOAPAsText } from '../../../src/generator/soap-generator.ts'
import { setWhitelist } from '../../../src/parser/template-rule-whitelist.browser.ts'

// 初始化 whitelist
setWhitelist(whitelist)

// 选择器
const insuranceType = ref('OPTUM')
const bodyPart = ref('LBP')
const laterality = ref('bilateral')
const cptCode = ref('97810')
const noteType = ref('IE')
const txCount = ref(3)
const patientAge = ref(55)
const patientGender = ref('Female')
const secondaryBodyParts = ref([])
const medicalHistory = ref(['N/A'])

const INSURANCE_OPTIONS = ['OPTUM', 'HF', 'WC', 'VC', 'ELDERPLAN', 'NONE']
const BODY_PARTS = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW', 'HIP']
const CPT_OPTIONS = [{ value: '97810', label: '97810' }, { value: 'full', label: 'Full Code' }]
const GENDER_OPTIONS = ['Male', 'Female']
const MEDICAL_HISTORY_OPTIONS = ['N/A', 'Pacemaker', 'Diabetes', 'Hypertension', 'Heart Disease', 'Metal Implant', 'Stroke', 'Cancer', 'Kidney Disease', 'Liver Disease', 'Thyroid Disorder', 'Arthritis', 'Osteoporosis']

// 各部位的侧别选项
// 四肢关节: left / right / bilateral
// 脊柱中线: 无侧别选项 (固定 bilateral/unspecified)
const LATERALITY_MAP = {
  'SHOULDER': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'KNEE': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'ELBOW': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'HIP': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  // 脊柱部位无侧别
  'LBP': null,
  'NECK': null,
}

// 当前部位是否有侧别选项
const lateralityOptions = computed(() => LATERALITY_MAP[bodyPart.value] || null)

// 部位切换时重置侧别
watch(bodyPart, (bp) => {
  if (LATERALITY_MAP[bp]) {
    laterality.value = 'bilateral'  // 有侧别的部位默认 bilateral
  } else {
    laterality.value = 'bilateral'  // 脊柱部位固定 bilateral
  }
})

// 固定字段（不显示，由引擎自动处理）
const FIXED_FIELDS = new Set([
  'subjective.chronicityLevel',
  'subjective.adlDifficulty.level',  // severity 由 pain 推导
  'assessment.tcmDiagnosis.localPattern',
  'assessment.tcmDiagnosis.systemicPattern',
  'assessment.generalCondition',
  'assessment.treatmentPrinciples.focusOn',
  'objective.muscleTesting.muscles',
  'plan.evaluationType',
  'plan.shortTermGoal.treatmentFrequency',
  'plan.needleProtocol.totalTime',
  'plan.needleProtocol.points',
  // 以下字段移出 FIXED_FIELDS，让用户可控:
  // 'subjective.painTypes'               → 用户多选
  // 'objective.tonguePulse.tongue'        → 证型默认 + 用户可调
  // 'objective.tonguePulse.pulse'         → 证型默认 + 用户可调
  // 'plan.needleProtocol.electricalStimulation' → 用户可控
])

// 字段中文名称映射
const FIELD_LABELS = {
  'subjective.symptomScale': '症状量表',
  'subjective.symptomDuration.value': '病程时长',
  'subjective.symptomDuration.unit': '时长单位',
  'subjective.adlDifficulty.level': 'ADL难度',
  'subjective.adlDifficulty.activities': 'ADL活动',
  'subjective.painScale.worst': '最痛评分',
  'subjective.painScale.best': '最轻评分',
  'subjective.painScale.current': '当前评分',
  'subjective.painFrequency': '疼痛频率',
  'subjective.painRadiation': '放射痛',
  'subjective.associatedSymptoms': '伴随症状',
  'subjective.causativeFactors': '病因',
  'subjective.exacerbatingFactors': '加重因素',
  'subjective.relievingFactors': '缓解因素',
  'subjective.symptomChange': '症状变化',
  'subjective.reasonConnector': '连接词',
  'subjective.reason': '原因',
  'subjective.painScale': '疼痛评分',
  'subjective.painTypes': '疼痛类型',
  'objective.tonguePulse.tongue': '舌象',
  'objective.tonguePulse.pulse': '脉象',
  'plan.needleProtocol.electricalStimulation': '电刺激',
  'objective.muscleTesting.tightness.gradingScale': '紧张度',
  'objective.muscleTesting.tenderness.gradingScale': '压痛度',
  'objective.spasmGrading': '痉挛度',
  'objective.rom.degrees': 'ROM角度',
  'objective.rom.strength': '肌力',
}

// 多选字段
const MULTI_SELECT_FIELDS = new Set([
  'subjective.painTypes',
  'subjective.associatedSymptoms',
  'subjective.causativeFactors',
  'subjective.exacerbatingFactors',
  'subjective.relievingFactors',
  'subjective.adlDifficulty.activities'
])

// 动态字段值
const fields = reactive({})

// 初始化字段默认值
Object.keys(whitelist).forEach(key => {
  const opts = whitelist[key]
  if (MULTI_SELECT_FIELDS.has(key)) {
    fields[key] = opts.length > 0 ? [opts[0]] : []
  } else {
    fields[key] = Array.isArray(opts) && opts.length > 0 ? opts[0] : ''
  }
})

// 根据规则计算推荐选项
function getRecommendedOptions(fieldPath) {
  const recommendations = []
  for (const rule of TEMPLATE_ONLY_RULES) {
    const conditionsMet = rule.conditions.every(cond => {
      const val = getNestedValue(fields, cond.field)
      if (cond.operator === 'equals') return val === cond.value
      if (cond.operator === 'gte') return Number(val) >= Number(cond.value)
      if (cond.operator === 'lte') return Number(val) <= Number(cond.value)
      return false
    })
    if (!conditionsMet) continue
    for (const effect of rule.effects) {
      if (effect.targetField === fieldPath) {
        recommendations.push(...effect.options.map(o => ({ option: o, weight: effect.weightChange, reason: effect.reason })))
      }
    }
  }
  return recommendations.sort((a, b) => b.weight - a.weight)
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj)
}

// Severity 从 Pain 自动推导（与 tx-sequence-engine 的 severityFromPain 一致）
function severityFromPain(pain) {
  if (pain >= 9) return 'severe'
  if (pain >= 7) return 'moderate to severe'
  if (pain >= 6) return 'moderate'
  if (pain >= 4) return 'mild to moderate'
  return 'mild'
}

function parsePainValue(raw) {
  if (!raw) return 8
  const m = raw.match(/\d+/)
  return m ? parseInt(m[0], 10) : 8
}

// 当前 pain 数值和推导的 severity
const currentPain = computed(() => parsePainValue(fields['subjective.painScale.current']))
const derivedSeverity = computed(() => severityFromPain(currentPain.value))

// 动态字段分组（过滤掉固定字段）
const dynamicFields = computed(() => ({
  S: Object.keys(whitelist).filter(k => k.startsWith('subjective.') && !FIXED_FIELDS.has(k)),
  O: Object.keys(whitelist).filter(k => k.startsWith('objective.') && !FIXED_FIELDS.has(k)),
  A: [], // A部分由引擎自动推导
  P: []  // P部分由证型决定
}))

// 生成上下文
const generationContext = computed(() => ({
  noteType: noteType.value,
  insuranceType: insuranceType.value,
  primaryBodyPart: bodyPart.value,
  laterality: laterality.value,
  localPattern: fields['assessment.tcmDiagnosis.localPattern'] || 'Qi Stagnation',
  systemicPattern: fields['assessment.tcmDiagnosis.systemicPattern'] || 'Kidney Yang Deficiency',
  chronicityLevel: fields['subjective.chronicityLevel'] || 'Chronic',
  severityLevel: derivedSeverity.value,          // 从 pain 推导
  painCurrent: currentPain.value,                 // 用户实际 pain 值
  associatedSymptom: (fields['subjective.associatedSymptoms'] || [])[0] || 'soreness',
  symptomDuration: {
    value: fields['subjective.symptomDuration.value'] || '3',
    unit: fields['subjective.symptomDuration.unit'] || 'month(s)'
  },
  painRadiation: fields['subjective.painRadiation'] || 'without radiation',
  causativeFactors: fields['subjective.causativeFactors'] || ['age related/degenerative changes'],
  relievingFactors: fields['subjective.relievingFactors'] || ['Changing positions', 'Resting', 'Massage'],
  // Phase 3 新增
  age: patientAge.value,
  gender: patientGender.value,
  secondaryBodyParts: secondaryBodyParts.value,
  hasPacemaker: medicalHistory.value.includes('Pacemaker'),
  medicalHistory: medicalHistory.value.filter(h => h !== 'N/A')
}))

// 生成结果
const generatedNotes = ref([])
const copiedIndex = ref(-1)
const currentSeed = ref(null)       // 当前生成使用的 seed
const seedInput = ref('')           // 用户输入的 seed (复现用)
const seedCopied = ref(false)

function generate(useSeed) {
  try {
    const ctx = generationContext.value
    const txCtx = { ...ctx, noteType: 'TX' }
    const seed = useSeed != null ? useSeed
      : seedInput.value ? parseInt(seedInput.value, 10) || undefined
      : undefined

    // 用户输入作为 initialState 基线
    // frequency 映射: painFrequency 文本 → 0-3 等级
    const freqText = fields['subjective.painFrequency'] || ''
    const freqLevel = freqText.includes('Constant') ? 3
      : freqText.includes('Frequent') ? 2
      : freqText.includes('Occasional') ? 1
      : freqText.includes('Intermittent') ? 0
      : 3

    const initialState = {
      pain: ctx.painCurrent,
      associatedSymptom: ctx.associatedSymptom || 'soreness',
      symptomScale: fields['subjective.symptomScale'] || '70%',
      frequency: freqLevel,
      painTypes: fields['subjective.painTypes'] || ['Dull', 'Aching']
    }

    if (noteType.value === 'IE') {
      const ieText = exportSOAPAsText(ctx, {})
      const { states, seed: actualSeed } = generateTXSequenceStates(txCtx, {
        txCount: 11,
        startVisitIndex: 1,
        seed,
        initialState
      })
      currentSeed.value = actualSeed
      generatedNotes.value = [
        { visitIndex: 0, text: ieText, type: 'IE', state: null, _open: false },
        ...states.map(state => ({
          visitIndex: state.visitIndex,
          text: exportSOAPAsText(txCtx, state),
          type: 'TX',
          state,
          _open: false
        }))
      ]
    } else {
      const { states, seed: actualSeed } = generateTXSequenceStates(txCtx, {
        txCount: txCount.value,
        startVisitIndex: 1,
        seed,
        initialState
      })
      currentSeed.value = actualSeed
      generatedNotes.value = states.map(state => ({
        visitIndex: state.visitIndex,
        text: exportSOAPAsText(txCtx, state),
        type: 'TX',
        state,
        _open: false
      }))
    }
  } catch (e) {
    console.error('生成错误:', e)
    alert('生成失败: ' + e.message)
  }
}

function copySeed() {
  if (currentSeed.value == null) return
  navigator.clipboard.writeText(String(currentSeed.value))
  seedCopied.value = true
  setTimeout(() => seedCopied.value = false, 1500)
}

function regenerate() {
  // 用相同 seed 重新生成（复现）
  if (currentSeed.value != null) {
    generate(currentSeed.value)
  }
}

// 将完整文本按 S/O/A/P 切分
function splitSOAP(text) {
  if (!text) return { S: '', O: '', A: '', P: '' }
  const sections = { S: '', O: '', A: '', P: '' }
  // 匹配段标题行
  const markers = [
    { key: 'S', re: /^Subjective\n/m },
    { key: 'O', re: /^Objective\n/m },
    { key: 'A', re: /^Assessment\n/m },
    { key: 'P', re: /^Plan\n/m }
  ]
  // 找到各段在文本中的起始位置
  const positions = markers.map(m => {
    const match = text.match(m.re)
    return { key: m.key, start: match ? text.indexOf(match[0]) : -1, headerLen: match ? match[0].length : 0 }
  }).filter(p => p.start >= 0).sort((a, b) => a.start - b.start)

  positions.forEach((pos, i) => {
    const contentStart = pos.start + pos.headerLen
    const contentEnd = i < positions.length - 1 ? positions[i + 1].start : text.length
    sections[pos.key] = text.slice(contentStart, contentEnd).replace(/\n{2,}$/, '').trim()
  })
  return sections
}

// 复制状态追踪: { idx: number, section: string } | null
const copiedSection = ref(null)

function copySection(idx, sectionKey) {
  const note = generatedNotes.value[idx]
  if (!note) return
  const parts = splitSOAP(note.text)
  navigator.clipboard.writeText(parts[sectionKey] || '')
  copiedSection.value = { idx, section: sectionKey }
  setTimeout(() => copiedSection.value = null, 1500)
}

function isCopied(idx, sectionKey) {
  return copiedSection.value?.idx === idx && copiedSection.value?.section === sectionKey
}

function copyNote(idx) {
  navigator.clipboard.writeText(generatedNotes.value[idx]?.text || '')
  copiedIndex.value = idx
  setTimeout(() => copiedIndex.value = -1, 1500)
}

function copyAll() {
  const all = generatedNotes.value.map(n => `=== ${n.type}${n.visitIndex || ''} ===\n${n.text}`).join('\n\n')
  navigator.clipboard.writeText(all)
  copiedIndex.value = -999
  setTimeout(() => copiedIndex.value = -1, 1500)
}

// 简化 frequency 文本: "Constant (symptoms occur...)" → "Constant"
function shortFreq(f) {
  if (!f) return ''
  return f.split('(')[0].trim()
}

// 简化 spasm: "(+3)=>1 but..." → "+3"
function shortSpasm(s) {
  if (!s) return ''
  const m = s.match(/\(([^)]+)\)/)
  return m ? m[1] : s
}

// 简化 tightness: 取首字母大写
function shortTight(t) {
  if (!t) return ''
  const map = { 'severe': 'Sev', 'moderate to severe': 'M-S', 'moderate': 'Mod', 'mild to moderate': 'Mi-M', 'mild': 'Mild' }
  return map[t.toLowerCase()] || t
}

// 简化 tenderness: "(+3) = Patient complains..." → "+3"
function shortTender(t) {
  if (!t) return ''
  const m = t.match(/\(([^)]+)\)/)
  return m ? m[1] : t
}

// 提取评估变化摘要 (用于折叠栏展示)
function getNoteSummary(note, idx) {
  if (!note.state || note.type === 'IE') return null
  const s = note.state
  const prevNote = idx > 0 ? generatedNotes.value[idx - 1] : null
  const prevState = prevNote?.state
  const prevPain = prevState ? prevState.painScaleLabel : '8'
  const prevSymptom = prevState?.symptomScale || '70%'
  const prevFreq = prevState ? shortFreq(prevState.painFrequency) : 'Constant'
  const prevTight = prevState ? shortTight(prevState.tightnessGrading) : ''
  const prevTender = prevState ? shortTender(prevState.tendernessGrading) : ''
  const prevSpasm = prevState ? shortSpasm(prevState.spasmGrading) : ''

  // 数值变化项
  const values = []
  values.push({ label: 'Pain', from: prevPain, to: s.painScaleLabel })
  if (s.symptomScale) {
    values.push({ label: 'Sx', from: prevSymptom, to: s.symptomScale })
  }
  const curFreq = shortFreq(s.painFrequency)
  if (curFreq && curFreq !== prevFreq) {
    values.push({ label: 'Freq', from: prevFreq, to: curFreq })
  }
  const curTight = shortTight(s.tightnessGrading)
  if (curTight && prevTight && curTight !== prevTight) {
    values.push({ label: 'Tight', from: prevTight, to: curTight })
  }
  const curTender = shortTender(s.tendernessGrading)
  if (curTender && prevTender && curTender !== prevTender) {
    values.push({ label: 'Tender', from: prevTender, to: curTender })
  }
  const curSpasm = shortSpasm(s.spasmGrading)
  if (curSpasm && prevSpasm && curSpasm !== prevSpasm) {
    values.push({ label: 'Spasm', from: prevSpasm, to: curSpasm })
  }

  // 趋势项 (来自 soaChain)
  const trends = []
  const chain = s.soaChain
  if (chain?.objective?.romTrend && chain.objective.romTrend !== 'stable') {
    trends.push({ label: 'ROM', trend: chain.objective.romTrend })
  }
  if (chain?.objective?.strengthTrend && chain.objective.strengthTrend !== 'stable') {
    trends.push({ label: 'ST', trend: chain.objective.strengthTrend })
  }
  if (chain?.subjective?.frequencyChange === 'improved') {
    trends.push({ label: 'Freq', trend: 'improved' })
  }
  if (chain?.subjective?.adlChange === 'improved') {
    trends.push({ label: 'ADL', trend: 'improved' })
  }

  return { values, trends }
}

// 多选面板展开状态
const expandedPanels = reactive({})

function togglePanel(fieldPath) {
  expandedPanels[fieldPath] = !expandedPanels[fieldPath]
}

function toggleOption(fieldPath, opt) {
  const arr = fields[fieldPath]
  const idx = arr.indexOf(opt)
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else {
    arr.push(opt)
  }
}

function removeOption(fieldPath, opt) {
  const arr = fields[fieldPath]
  const idx = arr.indexOf(opt)
  if (idx >= 0) arr.splice(idx, 1)
}

function shortLabel(text, maxLen = 35) {
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text
}

function fieldLabel(path) {
  return FIELD_LABELS[path] || path.split('.').pop().replace(/([A-Z])/g, ' $1').trim()
}

// 行内 word diff: 对比同位置的两行，返回 segments 数组
// 每个 segment: { text, hl: boolean }
function diffLineWords(curLine, prevLine) {
  if (!prevLine || prevLine.trim() === '') {
    // 无前一行可对比 → 不高亮
    return [{ text: curLine, hl: false }]
  }
  if (curLine.trim() === prevLine.trim()) {
    return [{ text: curLine, hl: false }]
  }
  // 按 word 边界拆分，保留空格和标点
  const splitTokens = (s) => s.match(/[\w%.+\-/()]+|[^\w%.+\-/()]+/g) || [s]
  const curTokens = splitTokens(curLine)
  const prevTokens = splitTokens(prevLine)
  const prevSet = new Set(prevTokens.map(t => t.trim().toLowerCase()).filter(Boolean))

  // 简单策略：逐 token 对比位置，相同位置 token 不同则高亮
  // 但位置对齐在插入/删除时会偏移，所以用混合策略：
  // 1. 先按位置对齐
  // 2. 位置不同的 token，如果它在 prevSet 中也不存在 → 高亮
  const segments = []
  let lastHl = false
  let buf = ''

  for (let i = 0; i < curTokens.length; i++) {
    const t = curTokens[i]
    const pt = i < prevTokens.length ? prevTokens[i] : null
    const tClean = t.trim().toLowerCase()
    // 空白/标点 token 不独立高亮
    if (!tClean || /^[,.:;!?\s]+$/.test(tClean)) {
      buf += t
      continue
    }
    // 判断: 位置相同且内容相同 → 不高亮
    // 位置不同但在 prev 整体中存在 → 不高亮 (只是位置移动)
    // 位置不同且 prev 中不存在 → 高亮 (真正新内容)
    const samePos = pt && pt.trim().toLowerCase() === tClean
    const existsInPrev = prevSet.has(tClean)
    const hl = !samePos && !existsInPrev

    if (hl !== lastHl && buf) {
      segments.push({ text: buf, hl: lastHl })
      buf = ''
    }
    lastHl = hl
    buf += t
  }
  if (buf) segments.push({ text: buf, hl: lastHl })
  return segments
}

// 逐行 diff: 返回每行的 segments
function getDiffLines(idx) {
  const note = generatedNotes.value[idx]
  if (!note) return []
  const lines = note.text.split('\n')
  const sectionHeaders = new Set(['Subjective', 'Objective', 'Assessment', 'Plan', 'Follow up visit', ''])

  // IE 或第一个笔记: 无对比
  if (note.type === 'IE' || idx === 0) {
    return lines.map(line => ({ segments: [{ text: line, hl: false }] }))
  }
  const prevNote = generatedNotes.value[idx - 1]
  if (!prevNote) {
    return lines.map(line => ({ segments: [{ text: line, hl: false }] }))
  }
  const prevLines = prevNote.text.split('\n')

  return lines.map((line, li) => {
    const trimmed = line.trim()
    if (sectionHeaders.has(trimmed)) {
      return { segments: [{ text: line, hl: false }] }
    }
    // 找对应的前一行 (同位置)
    const prevLine = li < prevLines.length ? prevLines[li] : ''
    return { segments: diffLineWords(line, prevLine) }
  })
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 左栏: 选择器 + 动态字段 -->
      <div class="lg:col-span-5 space-y-4">
        <!-- 基础设置 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-3">
          <h2 class="text-sm font-semibold text-ink-700">基础设置</h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-ink-500 mb-1 block">保险类型</label>
              <select v-model="insuranceType" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="t in INSURANCE_OPTIONS" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">部位</label>
              <select v-model="bodyPart" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="p in BODY_PARTS" :key="p" :value="p">{{ p }}</option>
              </select>
              <!-- 侧别选择 (仅四肢关节部位显示) -->
              <div v-if="lateralityOptions" class="flex gap-1 mt-1.5">
                <button v-for="opt in lateralityOptions" :key="opt.value"
                  @click="laterality = opt.value"
                  class="flex-1 py-1 text-[11px] font-medium rounded-md border transition-all duration-150"
                  :class="laterality === opt.value
                    ? 'bg-ink-800 text-paper-50 border-ink-800'
                    : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                  {{ opt.label }}
                </button>
              </div>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">CPT Code</label>
              <select v-model="cptCode" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="c in CPT_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">笔记类型</label>
              <select v-model="noteType" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option value="IE">IE (初诊)</option>
                <option value="TX">TX (复诊)</option>
              </select>
            </div>
          </div>
          <div v-if="noteType === 'TX'" class="flex items-center gap-2">
            <label class="text-xs text-ink-500">TX数量:</label>
            <input type="number" v-model.number="txCount" min="1" max="11" class="w-16 px-2 py-1 border border-ink-200 rounded text-sm text-center" />
          </div>
        </div>

        <!-- 患者信息 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-3">
          <h2 class="text-sm font-semibold text-ink-700">患者信息</h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-ink-500 mb-1 block">年龄</label>
              <input type="number" v-model.number="patientAge" min="1" max="120" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm" />
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">性别</label>
              <div class="flex gap-1 mt-0.5">
                <button v-for="g in GENDER_OPTIONS" :key="g" @click="patientGender = g"
                  class="flex-1 py-2 text-xs font-medium rounded-md border transition-all"
                  :class="patientGender === g ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                  {{ g }}
                </button>
              </div>
            </div>
          </div>
          <!-- 次要部位 -->
          <div>
            <label class="text-xs text-ink-500 mb-1 block">次要部位 <span class="text-ink-300">(可选)</span></label>
            <div class="flex flex-wrap gap-1">
              <button v-for="bp in BODY_PARTS.filter(b => b !== bodyPart)" :key="bp"
                @click="secondaryBodyParts.includes(bp) ? secondaryBodyParts.splice(secondaryBodyParts.indexOf(bp), 1) : secondaryBodyParts.push(bp)"
                class="px-2.5 py-1 text-[11px] rounded-md border transition-all"
                :class="secondaryBodyParts.includes(bp) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                {{ bp }}
              </button>
            </div>
          </div>
          <!-- 病史 -->
          <div>
            <label class="text-xs text-ink-500 mb-1 block">病史</label>
            <div class="flex flex-wrap gap-1">
              <button v-for="h in MEDICAL_HISTORY_OPTIONS" :key="h"
                @click="medicalHistory.includes(h) ? medicalHistory.splice(medicalHistory.indexOf(h), 1) : (h === 'N/A' ? (medicalHistory.length = 0, medicalHistory.push('N/A')) : (medicalHistory = medicalHistory.filter(x => x !== 'N/A'), medicalHistory.push(h)))"
                class="px-2.5 py-1 text-[11px] rounded-md border transition-all"
                :class="medicalHistory.includes(h) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                {{ h }}
              </button>
            </div>
          </div>
          <!-- Severity 显示 (从 Pain 推导) -->
          <div class="flex items-center gap-2 text-xs text-ink-400 bg-paper-50 rounded-lg px-3 py-2">
            <span>Severity:</span>
            <span class="font-medium text-ink-600">{{ derivedSeverity }}</span>
            <span class="text-ink-300">(Pain {{ currentPain }} 推导)</span>
          </div>
        </div>

        <!-- 动态字段（仅显示用户可控字段） -->
        <div v-for="(section, key) in { S: 'Subjective', O: 'Objective' }" :key="key"
          class="bg-white rounded-xl border border-ink-200 p-4"
          v-show="dynamicFields[key].length > 0">
          <h3 class="text-sm font-semibold text-ink-700 mb-3">{{ section }} <span class="text-ink-400 font-normal">({{ dynamicFields[key].length }})</span></h3>
          <div class="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
            <div v-for="fieldPath in dynamicFields[key]" :key="fieldPath">
              <!-- 多选字段 -->
              <div v-if="MULTI_SELECT_FIELDS.has(fieldPath)" class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-ink-500 font-medium" :title="fieldPath">
                    {{ fieldLabel(fieldPath) }}
                    <span class="text-ink-300 font-normal ml-1">({{ fields[fieldPath].length }})</span>
                  </label>
                  <button @click="togglePanel(fieldPath)" class="text-[10px] text-ink-400 hover:text-ink-600 transition-colors px-1.5 py-0.5 rounded hover:bg-paper-100">
                    {{ expandedPanels[fieldPath] ? '收起' : '编辑' }}
                  </button>
                </div>
                <!-- 已选标签 -->
                <div class="flex flex-wrap gap-1 min-h-[1.5rem]">
                  <span v-for="opt in fields[fieldPath]" :key="opt"
                    class="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full bg-ink-800 text-paper-50">
                    {{ shortLabel(opt, 30) }}
                    <button @click="removeOption(fieldPath, opt)" class="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-ink-600 transition-colors">
                      <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </span>
                  <span v-if="fields[fieldPath].length === 0" class="text-[10px] text-ink-300 italic py-0.5">未选择</span>
                </div>
                <!-- 展开的选项面板 -->
                <div v-show="expandedPanels[fieldPath]" class="border border-ink-150 rounded-lg p-2 bg-paper-50 max-h-40 overflow-y-auto">
                  <div class="flex flex-wrap gap-1">
                    <button v-for="opt in whitelist[fieldPath]" :key="opt"
                      @click="toggleOption(fieldPath, opt)"
                      class="text-[11px] px-2 py-1 rounded-md border transition-all duration-150"
                      :class="fields[fieldPath].includes(opt)
                        ? 'bg-ink-800 text-paper-50 border-ink-800'
                        : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:bg-paper-100'"
                      :title="opt">
                      {{ shortLabel(opt) }}
                    </button>
                  </div>
                </div>
              </div>
              <!-- 单选字段 -->
              <div v-else class="flex items-center gap-2">
                <label class="text-xs text-ink-500 w-24 truncate" :title="fieldPath">{{ fieldLabel(fieldPath) }}</label>
                <select v-model="fields[fieldPath]" class="flex-1 px-2 py-1 border border-ink-200 rounded text-xs">
                  <option v-for="opt in whitelist[fieldPath]" :key="opt" :value="opt">{{ opt.length > 40 ? opt.substring(0, 40) + '...' : opt }}</option>
                </select>
                <span v-if="getRecommendedOptions(fieldPath).length" class="text-xs text-green-600" title="有推荐">✓</span>
              </div>
            </div>
          </div>
        </div>

        <!-- A/P 说明 -->
        <div class="bg-paper-100 rounded-xl border border-ink-100 p-3 text-xs text-ink-500">
          <p>💡 Assessment 和 Plan 由引擎根据 S/O 自动推导生成</p>
        </div>

        <!-- Seed 输入 + 生成按钮 -->
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <label class="text-xs text-ink-400 flex-shrink-0">Seed</label>
            <input v-model="seedInput" type="text" placeholder="留空随机"
              class="flex-1 px-2.5 py-1.5 border border-ink-200 rounded-lg text-xs font-mono text-ink-600 placeholder:text-ink-300" />
          </div>
          <button @click="generate()" class="w-full py-2.5 bg-ink-800 text-paper-50 rounded-lg text-sm font-medium hover:bg-ink-700 transition-colors">
            生成 {{ noteType === 'TX' ? `${txCount} 个 TX` : 'IE' }}
          </button>
        </div>
      </div>

      <!-- 右栏: 结果 -->
      <div class="lg:col-span-7 space-y-3">
        <div v-if="generatedNotes.length === 0" class="bg-white rounded-xl border border-ink-200 p-8 text-center text-ink-400 text-sm">
          选择参数并点击生成
        </div>
        <div v-else>
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
              <h2 class="text-sm font-semibold text-ink-700">生成结果 ({{ generatedNotes.length }})</h2>
              <div v-if="currentSeed != null" class="flex items-center gap-1.5">
                <span class="text-[10px] font-mono text-ink-400">seed:{{ currentSeed }}</span>
                <button @click="copySeed" class="text-[10px] text-ink-400 hover:text-ink-600 transition-colors"
                  :title="'复制 seed 用于复现'">
                  {{ seedCopied ? '✓' : '复制' }}
                </button>
                <button @click="regenerate" class="text-[10px] text-ink-400 hover:text-ink-600 transition-colors"
                  title="用相同 seed 重新生成">
                  重跑
                </button>
              </div>
            </div>
            <button @click="copyAll" class="px-3 py-1.5 text-xs border border-ink-200 rounded-lg hover:bg-paper-100">
              {{ copiedIndex === -999 ? '✓ 已复制' : '复制全部' }}
            </button>
          </div>
          <div v-for="(note, idx) in generatedNotes" :key="idx" class="bg-white rounded-xl border border-ink-200 mb-3">
            <!-- 折叠栏头部 -->
            <div class="px-4 py-2 border-b border-ink-100 cursor-pointer" @click="note._open = !note._open">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <span class="text-xs font-mono bg-ink-100 text-ink-600 px-2 py-0.5 rounded flex-shrink-0">{{ note.type }}{{ note.visitIndex || '' }}</span>
                  <!-- 评估变化指标 -->
                  <div v-if="getNoteSummary(note, idx)" class="flex items-center gap-x-2 gap-y-0.5 flex-wrap min-w-0">
                    <!-- 数值变化 -->
                    <span v-for="item in getNoteSummary(note, idx).values" :key="'v-'+item.label"
                      class="text-[10px] font-mono whitespace-nowrap">
                      <span class="text-ink-400">{{ item.label }}</span>
                      <span class="text-ink-300 mx-px">{{ item.from }}</span>
                      <span class="text-ink-300">&rarr;</span>
                      <span class="font-medium" :class="item.from !== item.to ? 'text-green-600' : 'text-ink-400'">{{ item.to }}</span>
                    </span>
                    <!-- 趋势标签 -->
                    <span v-for="item in getNoteSummary(note, idx).trends" :key="'t-'+item.label"
                      class="text-[9px] px-1.5 py-px rounded-full whitespace-nowrap"
                      :class="item.trend.includes('improved') || item.trend.includes('reduced')
                        ? 'bg-green-50 text-green-600'
                        : 'bg-amber-50 text-amber-600'">
                      {{ item.label }} {{ item.trend === 'improved' || item.trend === 'reduced' ? '&uarr;' : '~' }}
                    </span>
                  </div>
                </div>
                <svg class="w-4 h-4 text-ink-400 transition-transform flex-shrink-0" :class="{ 'rotate-180': note._open }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <!-- 展开内容 -->
            <div v-show="note._open" class="p-4">
              <!-- S/O/A/P 分段复制按钮 -->
              <div class="flex items-center gap-1.5 mb-3">
                <button v-for="sec in ['S','O','A','P']" :key="sec"
                  @click="copySection(idx, sec)"
                  class="px-2.5 py-1 text-[11px] font-mono font-medium border rounded-md transition-all duration-150"
                  :class="isCopied(idx, sec)
                    ? 'bg-green-50 border-green-300 text-green-600'
                    : 'border-ink-200 text-ink-500 hover:bg-paper-100 hover:border-ink-300'">
                  {{ isCopied(idx, sec) ? '✓ ' + sec : sec }}
                </button>
                <div class="w-px h-4 bg-ink-150 mx-1"></div>
                <button @click="copyNote(idx)"
                  class="px-2.5 py-1 text-[11px] border rounded-md transition-all duration-150"
                  :class="copiedIndex === idx
                    ? 'bg-green-50 border-green-300 text-green-600'
                    : 'border-ink-200 text-ink-500 hover:bg-paper-100 hover:border-ink-300'">
                  {{ copiedIndex === idx ? '✓ 已复制' : '全部' }}
                </button>
              </div>
              <div class="text-xs font-mono text-ink-700 leading-relaxed">
                <div v-for="(line, li) in getDiffLines(idx)" :key="li" class="whitespace-pre-wrap"><template
                  v-for="(seg, si) in line.segments" :key="si"><mark
                    v-if="seg.hl" class="bg-yellow-200/80 text-ink-800 rounded-sm px-px">{{ seg.text }}</mark><template
                    v-else>{{ seg.text === '' && si === 0 ? '\n' : seg.text }}</template></template></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
