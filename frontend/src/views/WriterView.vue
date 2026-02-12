<script setup>
import { ref, reactive, computed, watch } from 'vue'
import whitelist from '../data/whitelist.json'
import { setWhitelist } from '../../../src/parser/template-rule-whitelist.browser.ts'
import { inferSystemicPatterns, inferLocalPatterns } from '../../../src/knowledge/medical-history-engine.ts'
import { useWriterFields } from '../composables/useWriterFields'
import { useSOAPGeneration } from '../composables/useSOAPGeneration'
import { useDiffHighlight } from '../composables/useDiffHighlight'

setWhitelist(whitelist)

const {
  fields,
  FIXED_FIELDS,
  TX_ONLY_FIELDS,
  REQUIRED_FIELDS,
  RULE_FIELDS,
  MERGED_FIELDS,
  DERIVED_FIELDS,
  MULTI_SELECT_FIELDS,
  fieldTag,
  fieldLabel,
  getRecommendedOptions,
} = useWriterFields(whitelist)

// 选择器
const insuranceType = ref('OPTUM')
const bodyPart = ref('LBP')
const laterality = ref('bilateral')
const cptCode = ref('97810')
const noteType = ref('IE')
const txCount = ref(3)
const patientAge = ref(55)
const patientGender = ref('Female')
const recentWorseValue = ref('1')
const recentWorseUnit = ref('week(s)')
const secondaryBodyParts = ref([])
const medicalHistory = ref(['N/A'])

const INSURANCE_OPTIONS = ['OPTUM', 'HF', 'WC', 'VC', 'ELDERPLAN', 'NONE']
const BODY_PARTS = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW', 'HIP']
const CPT_OPTIONS = [{ value: '97810', label: '97810' }, { value: 'full', label: 'Full Code' }]
const GENDER_OPTIONS = ['Male', 'Female']
// 病史选项 — 从模板 ppnSelectCombo 完整提取
const MEDICAL_HISTORY_OPTIONS = [
  'N/A', 'Smoking', 'Alcohol', 'Diabetes', 'Hypertension', 'Heart Disease',
  'Liver Disease', 'Pacemaker', 'Anemia', 'Lung Disease', 'Kidney Disease',
  'Heart Murmur', 'Thyroid', 'Stroke', 'Asthma', 'Herniated Disk',
  'tinnitus', 'Pinched Nerve', 'Osteoporosis', 'Fractures', 'Hysterectomy',
  'Hyperlipidemia', 'stomach trouble', 'C-section', 'Parkinson',
  'Cholesterol', 'Joint Replacement', 'Prostate'
]

// 各部位的放射痛选项 (按医学合理性过滤)
const RADIATION_MAP = {
  'LBP': [
    'without radiation',
    'With radiation to R leg',
    'With radiation to L leg',
    'with radiation to BLLE',
    'with radiation to toes',
  ],
  'NECK': [
    'without radiation',
    'with radiation to R arm',
    'with radiation to L arm',
    'with dizziness',
    'with headache',
    'with migraine',
  ],
  'SHOULDER': [
    'without radiation',
    'with radiation to R arm',
    'with radiation to L arm',
  ],
  'KNEE': [
    'without radiation',
    'With radiation to R leg',
    'With radiation to L leg',
    'with local swollen',
  ],
  'ELBOW': [
    'without radiation',
    'with radiation to R arm',
    'with radiation to L arm',
  ],
  'HIP': [
    'without radiation',
    'With radiation to R leg',
    'With radiation to L leg',
    'with radiation to BLLE',
  ],
}

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

// 当前部位的放射痛选项 (fallback 到 whitelist 全集)
const radiationOptions = computed(() => RADIATION_MAP[bodyPart.value] || whitelist['subjective.painRadiation'])

// 部位切换时重置侧别 + 放射痛
watch(bodyPart, (bp) => {
  if (LATERALITY_MAP[bp]) {
    laterality.value = 'bilateral'  // 有侧别的部位默认 bilateral
  } else {
    laterality.value = 'bilateral'  // 脊柱部位固定 bilateral
  }
  const opts = RADIATION_MAP[bp]
  if (opts && !opts.includes(fields['subjective.painRadiation'])) {
    fields['subjective.painRadiation'] = opts[0]
  }
})

function onPatternFieldChange(fieldPath) {
  if (fieldPath === 'assessment.tcmDiagnosis.localPattern') localPatternManuallySet.value = true
  if (fieldPath === 'assessment.tcmDiagnosis.systemicPattern') systemicPatternManuallySet.value = true
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

const soapGen = useSOAPGeneration({
  fields,
  noteType,
  txCount,
  bodyPart,
  laterality,
  insuranceType,
  recentWorseValue,
  recentWorseUnit,
  patientAge,
  patientGender,
  secondaryBodyParts,
  medicalHistory,
  derivedSeverity,
  currentPain,
})
const {
  generationContext,
  generatedNotes,
  copiedIndex,
  currentSeed,
  seedInput,
  seedCopied,
  copiedSection,
  generate,
  copySeed,
  regenerate,
  splitSOAP,
  copySection,
  isCopied,
  copyNote,
  copyAll,
} = soapGen

const diffHighlight = useDiffHighlight(generatedNotes)
const { getNoteSummary, getDiffLines } = diffHighlight

// 病史推荐的整体证型
const recommendedPatterns = computed(() => {
  const history = medicalHistory.value.filter(h => h !== 'N/A')
  if (history.length === 0) return []
  return inferSystemicPatterns(history, patientAge.value)
})

// 局部证型推导：疼痛类型、伴随症状、部位、慢性程度
const recommendedLocalPatterns = computed(() => {
  const rawPt = fields['subjective.painTypes']
  const pt = Array.isArray(rawPt) ? rawPt : (String(rawPt || '').split(',').map(s => s.trim()).filter(Boolean))
  const rawAs = fields['subjective.associatedSymptoms']
  const as = Array.isArray(rawAs) ? rawAs : (String(rawAs || '').split(',').map(s => s.trim()).filter(Boolean))
  const bp = bodyPart.value
  const cl = fields['subjective.chronicityLevel'] || 'Chronic'
  if (pt.length === 0 && as.length === 0) return []
  return inferLocalPatterns(pt, as, bp, cl)
})

const localPatternManuallySet = ref(false)
const systemicPatternManuallySet = ref(false)

// 局部证型：推荐变化时自动填入，除非用户已手动改过；bodyPart 变化时重置手动标记
watch(recommendedLocalPatterns, (recs) => {
  if (localPatternManuallySet.value) return
  if (recs.length > 0) {
    fields['assessment.tcmDiagnosis.localPattern'] = recs[0].pattern
  }
}, { immediate: true })
watch(bodyPart, () => {
  localPatternManuallySet.value = false
})

// 整体证型：推荐变化时自动填入，除非用户已手动改过；病史变化时重置手动标记
watch(recommendedPatterns, (recs) => {
  if (systemicPatternManuallySet.value) return
  if (recs.length > 0) {
    fields['assessment.tcmDiagnosis.systemicPattern'] = recs[0].pattern
  }
}, { immediate: true })
watch(medicalHistory, () => {
  systemicPatternManuallySet.value = false
})

// 第一步：主观必填 6 个 fieldPath
const STEP1_SUBJECTIVE_FIELDS = [
  'subjective.painRadiation',
  'subjective.painTypes',
  'subjective.associatedSymptoms',
  'subjective.causativeFactors',
  'subjective.relievingFactors',
  'subjective.exacerbatingFactors',
]

// 第二步：审核 R 项配置（顺序固定，txOnly 仅 TX 显示）
const STEP2_REVIEW_CONFIG = [
  { path: '__severity', readOnly: true },
  { path: 'assessment.tcmDiagnosis.localPattern' },
  { path: 'assessment.tcmDiagnosis.systemicPattern' },
  { path: 'objective.tonguePulse.tongue' },
  { path: 'objective.tonguePulse.pulse' },
  { path: 'objective.muscleTesting.tightness.gradingScale' },
  { path: 'objective.muscleTesting.tenderness.gradingScale' },
  { path: 'objective.spasmGrading' },
  { path: 'objective.rom.degrees' },
  { path: 'objective.rom.strength' },
  { path: 'plan.needleProtocol.electricalStimulation' },
  { path: 'subjective.adlDifficulty.activities', isMulti: true },
  { path: 'subjective.symptomChange', txOnly: true },
  { path: 'subjective.reasonConnector', txOnly: true },
  { path: 'subjective.reason', txOnly: true },
  { path: 'subjective.painScale', txOnly: true },
]

const step2ReviewFields = computed(() => {
  return STEP2_REVIEW_CONFIG.filter(item => !item.txOnly || noteType.value === 'TX')
    .filter(item => item.path.startsWith('__') || item.path in whitelist)
    .map(item => {
      const path = item.path
      const readOnly = !!item.readOnly
      const isMulti = !!item.isMulti
      let label, value, options
      if (path === '__severity') {
        label = 'Severity'
        value = derivedSeverity.value
        options = null
      } else {
        label = fieldLabel(path)
        value = fields[path]
        options = whitelist[path]
      }
      return { path, label, value, readOnly, isMulti, options }
    })
})

// 第二步审核卡片：单字段编辑
const derivedEditing = ref('')
function toggleDerivedEdit(fp) {
  derivedEditing.value = derivedEditing.value === fp ? '' : fp
}

// 生成前校验必填项
function validateRequiredBeforeGenerate() {
  const empty = []
  for (const fp of REQUIRED_FIELDS) {
    const v = fields[fp]
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
      empty.push(fp)
    }
  }
  if (recentWorseValue.value === '' || recentWorseUnit.value === '') empty.push('recentWorse')
  return empty
}

function doGenerate() {
  const missing = validateRequiredBeforeGenerate()
  if (missing.length > 0) {
    const el = document.querySelector('[data-step1]')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    alert('请先完成必填项：' + (missing.length > 3 ? `${missing.length} 项` : missing.slice(0, 3).join(', ')))
    return
  }
  generate()
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
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 左栏: 三步 填写 → 审核 → 生成 -->
      <div class="lg:col-span-5 space-y-4">
        <!-- ① 第一步：填写必填项 -->
        <div data-step1 class="space-y-3 mt-6">
          <h2 class="text-sm font-semibold text-ink-800 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-ink-800 text-paper-50 text-xs flex items-center justify-center">1</span>
            填写必填项 <span class="text-red-500 text-[10px] font-normal">*</span>
          </h2>
        <!-- 基础设置 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-3">
          <h3 class="text-xs font-medium text-ink-600">基础设置</h3>
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
          <h3 class="text-xs font-medium text-ink-600">患者信息</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-ink-500 mb-1 block">年龄</label>
              <input type="number" v-model.number="patientAge" min="1" max="120" class="w-20 px-3 py-2 border border-ink-200 rounded-lg text-sm text-center" />
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
          <!-- 病史 (折叠面板) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-ink-500 font-medium">病史 <span class="text-ink-300 font-normal">({{ medicalHistory.filter(h => h !== 'N/A').length || 'N/A' }})</span></label>
              <button @click="togglePanel('medicalHistory')" class="text-[10px] text-ink-400 hover:text-ink-600 transition-colors px-1.5 py-0.5 rounded hover:bg-paper-100">
                {{ expandedPanels['medicalHistory'] ? '收起' : '编辑' }}
              </button>
            </div>
            <!-- 已选标签 -->
            <div class="flex flex-wrap gap-1 min-h-[1.5rem]">
              <span v-for="h in medicalHistory" :key="h"
                class="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full bg-ink-800 text-paper-50">
                {{ h }}
                <button @click="medicalHistory.splice(medicalHistory.indexOf(h), 1); if(medicalHistory.length===0) medicalHistory.push('N/A')"
                  class="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-ink-600 transition-colors">
                  <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            </div>
            <!-- 展开面板 -->
            <div v-show="expandedPanels['medicalHistory']" class="border border-ink-150 rounded-lg p-2 bg-paper-50 max-h-40 overflow-y-auto">
              <div class="flex flex-wrap gap-1">
                <button v-for="h in MEDICAL_HISTORY_OPTIONS" :key="h"
                  @click="medicalHistory.includes(h) ? medicalHistory.splice(medicalHistory.indexOf(h), 1) : (h === 'N/A' ? (medicalHistory.length = 0, medicalHistory.push('N/A')) : (medicalHistory = medicalHistory.filter(x => x !== 'N/A'), medicalHistory.push(h)))"
                  class="text-[11px] px-2 py-1 rounded-md border transition-all duration-150"
                  :class="medicalHistory.includes(h) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:bg-paper-100'">
                  {{ h }}
                </button>
              </div>
            </div>
          </div>
          <!-- Severity 显示 (从 Pain 推导) -->
          <div class="flex items-center gap-2 text-xs text-ink-400 bg-paper-50 rounded-lg px-3 py-2">
            <span>Severity:</span>
            <span class="font-medium text-ink-600">{{ derivedSeverity }}</span>
            <span class="text-ink-300">(Pain {{ currentPain }} 推导)</span>
          </div>
        </div>

        <!-- 评估参数 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-2.5">
          <h3 class="text-xs font-medium text-ink-600">评估参数</h3>
          <p class="text-[10px] text-ink-400">
            <span class="text-red-500">*</span> 用户必填
            <span class="text-blue-400 ml-2">R</span> 引擎推导（可改）
          </p>
          <!-- Pain Scale W/B/C -->
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-ink-500 w-20 flex-shrink-0">疼痛评分 <span class="text-red-500">*</span></label>
            <span class="text-[10px] text-ink-400">W</span>
            <select v-model="fields['subjective.painScale.worst']" class="w-14 px-1 py-1 border border-ink-200 rounded text-xs text-center">
              <option v-for="opt in whitelist['subjective.painScale.worst']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <span class="text-[10px] text-ink-400">B</span>
            <select v-model="fields['subjective.painScale.best']" class="w-14 px-1 py-1 border border-ink-200 rounded text-xs text-center">
              <option v-for="opt in whitelist['subjective.painScale.best']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <span class="text-[10px] text-ink-400">C</span>
            <select v-model="fields['subjective.painScale.current']" class="w-14 px-1 py-1 border border-ink-200 rounded text-xs text-center">
              <option v-for="opt in whitelist['subjective.painScale.current']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <!-- Duration value + unit -->
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-ink-500 w-20 flex-shrink-0">病程时长 <span class="text-red-500">*</span></label>
            <select v-model="fields['subjective.symptomDuration.value']" class="w-16 px-1 py-1 border border-ink-200 rounded text-xs text-center">
              <option v-for="opt in whitelist['subjective.symptomDuration.value']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <select v-model="fields['subjective.symptomDuration.unit']" class="w-28 px-1 py-1 border border-ink-200 rounded text-xs">
              <option v-for="opt in whitelist['subjective.symptomDuration.unit']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <!-- 近期加重时长 -->
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-ink-500 w-20 flex-shrink-0">近期加重 <span class="text-red-500">*</span></label>
            <select v-model="recentWorseValue" class="w-16 px-1 py-1 border border-ink-200 rounded text-xs text-center">
              <option v-for="opt in whitelist['subjective.symptomDuration.value']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <select v-model="recentWorseUnit" class="w-28 px-1 py-1 border border-ink-200 rounded text-xs">
              <option v-for="opt in whitelist['subjective.symptomDuration.unit']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <!-- 症状量表 -->
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-ink-500 w-20 flex-shrink-0">症状量表 <span class="text-red-500">*</span></label>
            <select v-model="fields['subjective.symptomScale']" class="w-24 px-1 py-1 border border-ink-200 rounded text-xs">
              <option v-for="opt in whitelist['subjective.symptomScale']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <!-- 疼痛频率 -->
          <div class="flex items-center gap-1.5">
            <label class="text-xs text-ink-500 w-20 flex-shrink-0">疼痛频率 <span class="text-red-500">*</span></label>
            <select v-model="fields['subjective.painFrequency']" class="flex-1 px-1 py-1 border border-ink-200 rounded text-xs">
              <option v-for="opt in whitelist['subjective.painFrequency']" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
        </div>

        <!-- 主观必填 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-2.5">
          <h3 class="text-xs font-medium text-ink-600">主观必填 <span class="text-red-500">*</span></h3>
          <div v-for="fieldPath in STEP1_SUBJECTIVE_FIELDS" :key="fieldPath" class="space-y-1">
            <template v-if="MULTI_SELECT_FIELDS.has(fieldPath)">
              <div class="flex items-center justify-between">
                <label class="text-xs text-ink-500 font-medium">{{ fieldLabel(fieldPath) }}</label>
                <button @click="togglePanel(fieldPath)" class="text-[10px] text-ink-400 hover:text-ink-600 px-1.5 py-0.5 rounded hover:bg-paper-100">{{ expandedPanels[fieldPath] ? '收起' : '编辑' }}</button>
              </div>
              <div class="flex flex-wrap gap-1 min-h-[1.5rem]">
                <span v-for="opt in fields[fieldPath]" :key="opt" class="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full bg-ink-800 text-paper-50">
                  {{ shortLabel(opt, 28) }}
                  <button @click="removeOption(fieldPath, opt)" class="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-ink-600 transition-colors">
                    <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </span>
                <span v-if="fields[fieldPath].length === 0" class="text-[10px] text-ink-300 italic py-0.5">未选择</span>
              </div>
              <div v-show="expandedPanels[fieldPath]" class="border border-ink-150 rounded-lg p-2 bg-paper-50 max-h-32 overflow-y-auto">
                <div class="flex flex-wrap gap-1">
                  <button v-for="opt in whitelist[fieldPath]" :key="opt" @click="toggleOption(fieldPath, opt)"
                    class="text-[11px] px-2 py-1 rounded-md border transition-all duration-150"
                    :class="fields[fieldPath].includes(opt) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:bg-paper-100'"
                    :title="opt">{{ shortLabel(opt) }}</button>
                </div>
              </div>
            </template>
            <div v-else class="flex items-center gap-2">
              <label class="text-xs text-ink-500 w-24 flex-shrink-0">{{ fieldLabel(fieldPath) }}</label>
              <select v-model="fields[fieldPath]" class="flex-1 px-2 py-1 border border-ink-200 rounded text-xs">
                <option v-for="opt in (fieldPath === 'subjective.painRadiation' ? radiationOptions : whitelist[fieldPath])" :key="opt" :value="opt">{{ opt.length > 45 ? opt.substring(0, 45) + '...' : opt }}</option>
              </select>
            </div>
          </div>
        </div>
        </div>
        <!-- 第一步结束 -->

        <!-- ② 第二步：审核 R 项 -->
        <div class="space-y-3 mt-6">
          <h2 class="text-sm font-semibold text-ink-800 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-ink-800 text-paper-50 text-xs flex items-center justify-center">2</span>
            审核 R 项 <span class="text-blue-400 text-[10px] font-normal">R 引擎推导，可点「改」修改</span>
          </h2>
          <div class="bg-white rounded-xl border border-ink-200 p-4">
            <div v-for="item in step2ReviewFields" :key="item.path"
              class="flex items-center gap-2 py-2 border-b border-ink-50 text-xs last:border-b-0"
              :class="item.readOnly ? 'bg-paper-50' : ''">
              <span class="text-ink-500 w-20 flex-shrink-0">{{ item.label }}</span>
              <template v-if="item.readOnly">
                <span class="font-medium text-ink-600 flex-1">{{ item.value }}</span>
              </template>
              <template v-else-if="derivedEditing === item.path">
                <template v-if="item.isMulti">
                  <div class="flex-1 flex flex-wrap gap-1">
                    <button v-for="opt in item.options" :key="opt"
                      @click="fields[item.path].includes(opt) ? removeOption(item.path, opt) : toggleOption(item.path, opt)"
                      class="text-[11px] px-2 py-1 rounded-md border"
                      :class="fields[item.path].includes(opt) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">{{ shortLabel(opt) }}</button>
                  </div>
                </template>
                <select v-else v-model="fields[item.path]" class="flex-1 px-2 py-1 border border-ink-300 rounded text-xs" @change="derivedEditing = ''; onPatternFieldChange(item.path)">
                  <option v-for="opt in item.options" :key="opt" :value="opt">{{ opt.length > 50 ? opt.substring(0, 50) + '...' : opt }}</option>
                </select>
                <button @click="derivedEditing = ''" class="text-[10px] text-ink-400 flex-shrink-0">确定</button>
              </template>
              <template v-else>
                <span class="font-medium text-ink-700 truncate flex-1" :title="Array.isArray(item.value) ? item.value.join(', ') : item.value">
                  {{ item.isMulti ? (item.value && item.value.length ? shortLabel(item.value.join(', '), 30) : '未选择') : shortLabel(String(item.value || ''), 35) }}
                </span>
                <button @click="toggleDerivedEdit(item.path)" class="text-[10px] text-ink-400 hover:text-ink-600 flex-shrink-0">改</button>
              </template>
            </div>
            <!-- 病史推荐证型 -->
            <div v-if="recommendedPatterns.length > 0" class="border-t border-ink-100 pt-2 mt-2">
              <p class="text-[10px] text-ink-400 mb-1">病史推荐整体证型:</p>
              <div v-for="rec in recommendedPatterns.slice(0, 3)" :key="rec.pattern" class="text-[10px] text-ink-500">
                <span class="font-mono text-ink-600">{{ rec.pattern }}</span>
                <span class="text-ink-300 ml-1">(+{{ rec.weight }})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ③ 第三步：生成 SOAP -->
        <div class="space-y-2 mt-6">
          <h2 class="text-sm font-semibold text-ink-800 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-ink-800 text-paper-50 text-xs flex items-center justify-center">3</span>
            生成 SOAP
          </h2>
          <div class="flex items-center gap-2">
            <input v-model="seedInput" type="text" placeholder="Seed"
              class="w-28 px-2 py-2.5 border border-ink-200 rounded-lg text-xs font-mono text-ink-600 placeholder:text-ink-300" />
            <button @click="doGenerate()" class="flex-1 py-2.5 bg-ink-800 text-paper-50 rounded-lg text-sm font-medium hover:bg-ink-700 transition-colors">
              生成 {{ noteType === 'TX' ? `${txCount} 个 TX` : 'IE' }}
            </button>
          </div>
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
