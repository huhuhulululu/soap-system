<script setup>
import { ref, reactive, computed, watch } from 'vue'
import whitelist from '../../data/whitelist.json'
import { setWhitelist } from '../../../../src/parser/template-rule-whitelist.browser.ts'
import { inferSystemicPatterns, inferLocalPatterns } from '../../../../src/knowledge/medical-history-engine.ts'
import { useWriterFields } from '../../composables/useWriterFields'
import { useSOAPGeneration } from '../../composables/useSOAPGeneration'
import { useDiffHighlight } from '../../composables/useDiffHighlight'
import { isPainTypeConsistentWithPattern } from '../../../../src/shared/tcm-mappings'
import { isAdlConsistentWithBodyPart } from '../../../../src/shared/adl-mappings'
import { BODY_PART_ADL } from '../../../../src/shared/body-part-constants'

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
const noteType = ref('IE')
const txCount = ref(3)
const ieTxCount = ref(11)
const patientAge = ref(55)
const patientGender = ref('Female')
const recentWorseValue = ref('1')
const recentWorseUnit = ref('week(s)')
const secondaryBodyParts = ref([])
const secondaryLaterality = reactive({})
const medicalHistory = ref([])

// ICD-10 选择模式
const selectionMode = ref('bodypart')  // 'bodypart' | 'icd10'
const icdSearch = ref('')
const icdDropdownOpen = ref(false)
const selectedIcds = ref([])           // [{ icd10, desc, bodyPart, laterality }] max 4

const INSURANCE_OPTIONS = [
  { value: 'OPTUM', label: 'Optum' },
  { value: 'HF', label: 'HealthFirst' },
  { value: 'WC', label: 'WellCare' },
  { value: 'VC', label: 'VillageCare Max' },
  { value: 'ELDERPLAN', label: 'ElderPlan' },
  { value: 'NONE', label: 'None / Self-pay' },
]
const BODY_PARTS = [
  'LBP', 'NECK', 'UPPER_BACK', 'MIDDLE_BACK', 'MID_LOW_BACK',
  'SHOULDER', 'ELBOW', 'WRIST', 'HAND',
  'HIP', 'KNEE', 'ANKLE', 'FOOT',
  'THIGH', 'CALF', 'ARM', 'FOREARM',
]
const SUPPORTED_IE_PARTS = new Set(['ELBOW', 'KNEE', 'LBP', 'MID_LOW_BACK', 'NECK', 'SHOULDER'])
const SUPPORTED_TX_PARTS = new Set(['ELBOW', 'KNEE', 'LBP', 'MID_LOW_BACK', 'MIDDLE_BACK', 'NECK', 'SHOULDER'])
const GENDER_OPTIONS = ['Male', 'Female']

// 部位显示名映射 (用于 UI 下拉框)
const BODY_PART_DISPLAY = {
  'MID_LOW_BACK': 'M&L (Mid+Low Back)',
}
function bodyPartLabel(bp) {
  return BODY_PART_DISPLAY[bp] || bp
}

// ICD-10 码表 — 基于 src/shared/body-part-constants.ts ICD_BODY_MAP 展开
const ICD_CATALOG = [
  // ── LBP (M54.5, M54.4, M54.3, M47.8, M51) ──
  { icd10: 'M54.50', desc: 'Low back pain, unspecified', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M54.51', desc: 'Vertebrogenic low back pain', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M54.59', desc: 'Other low back pain', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M54.41', desc: 'Lumbago with sciatica, right', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M54.42', desc: 'Lumbago with sciatica, left', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M54.31', desc: 'Sciatica, right side', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M54.32', desc: 'Sciatica, left side', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M47.816', desc: 'Spondylosis w/o myelopathy, lumbar', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M47.817', desc: 'Spondylosis w/o myelopathy, lumbosacral', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M51.16', desc: 'IVD disorder w/ radiculopathy, lumbar', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M51.17', desc: 'IVD disorder w/ radiculopathy, lumbosacral', bodyPart: 'LBP', laterality: 'bilateral' },
  // ── NECK (M54.2, M47.81, M50) ──
  { icd10: 'M54.2', desc: 'Cervicalgia', bodyPart: 'NECK', laterality: 'bilateral' },
  { icd10: 'M47.812', desc: 'Spondylosis w/o myelopathy, cervical', bodyPart: 'NECK', laterality: 'bilateral' },
  { icd10: 'M47.813', desc: 'Spondylosis w/o myelopathy, cervicothoracic', bodyPart: 'NECK', laterality: 'bilateral' },
  { icd10: 'M50.30', desc: 'Other cervical disc degeneration, unspecified', bodyPart: 'NECK', laterality: 'bilateral' },
  { icd10: 'M50.320', desc: 'Other cervical disc degeneration, mid-cervical', bodyPart: 'NECK', laterality: 'bilateral' },
  // ── UPPER_BACK / MIDDLE_BACK (M54.6) ──
  { icd10: 'M54.6', desc: 'Pain in thoracic spine', bodyPart: 'MIDDLE_BACK', laterality: 'bilateral' },
  // ── MID_LOW_BACK (M54.5 + M54.6 组合) ──
  { icd10: 'M54.5', desc: 'Low back pain', bodyPart: 'MID_LOW_BACK', laterality: 'bilateral' },
  // ── SHOULDER (M25.51, M75, M79.61) ──
  { icd10: 'M25.511', desc: 'Pain in right shoulder', bodyPart: 'SHOULDER', laterality: 'right' },
  { icd10: 'M25.512', desc: 'Pain in left shoulder', bodyPart: 'SHOULDER', laterality: 'left' },
  { icd10: 'M25.519', desc: 'Pain in unspecified shoulder', bodyPart: 'SHOULDER', laterality: 'bilateral' },
  { icd10: 'M75.10', desc: 'Rotator cuff syndrome, unspecified', bodyPart: 'SHOULDER', laterality: 'bilateral' },
  { icd10: 'M75.11', desc: 'Rotator cuff syndrome, right', bodyPart: 'SHOULDER', laterality: 'right' },
  { icd10: 'M75.12', desc: 'Rotator cuff syndrome, left', bodyPart: 'SHOULDER', laterality: 'left' },
  { icd10: 'M75.01', desc: 'Adhesive capsulitis, right shoulder', bodyPart: 'SHOULDER', laterality: 'right' },
  { icd10: 'M75.02', desc: 'Adhesive capsulitis, left shoulder', bodyPart: 'SHOULDER', laterality: 'left' },
  { icd10: 'M79.611', desc: 'Pain in right upper arm', bodyPart: 'SHOULDER', laterality: 'right' },
  { icd10: 'M79.612', desc: 'Pain in left upper arm', bodyPart: 'SHOULDER', laterality: 'left' },
  // ── ELBOW (M25.52, M77.0, M77.1) ──
  { icd10: 'M25.521', desc: 'Pain in right elbow', bodyPart: 'ELBOW', laterality: 'right' },
  { icd10: 'M25.522', desc: 'Pain in left elbow', bodyPart: 'ELBOW', laterality: 'left' },
  { icd10: 'M25.529', desc: 'Pain in unspecified elbow', bodyPart: 'ELBOW', laterality: 'bilateral' },
  { icd10: 'M77.01', desc: 'Medial epicondylitis, right', bodyPart: 'ELBOW', laterality: 'right' },
  { icd10: 'M77.02', desc: 'Medial epicondylitis, left', bodyPart: 'ELBOW', laterality: 'left' },
  { icd10: 'M77.11', desc: 'Lateral epicondylitis, right', bodyPart: 'ELBOW', laterality: 'right' },
  { icd10: 'M77.12', desc: 'Lateral epicondylitis, left', bodyPart: 'ELBOW', laterality: 'left' },
  // ── KNEE (M17, M25.56, M25.46, M25.36, M76.5, M23, M22) ──
  { icd10: 'M25.561', desc: 'Pain in right knee', bodyPart: 'KNEE', laterality: 'right' },
  { icd10: 'M25.562', desc: 'Pain in left knee', bodyPart: 'KNEE', laterality: 'left' },
  { icd10: 'M25.569', desc: 'Pain in unspecified knee', bodyPart: 'KNEE', laterality: 'bilateral' },
  { icd10: 'M17.0', desc: 'Bilateral primary osteoarthritis of knee', bodyPart: 'KNEE', laterality: 'bilateral' },
  { icd10: 'M17.11', desc: 'Primary osteoarthritis, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { icd10: 'M17.12', desc: 'Primary osteoarthritis, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { icd10: 'M25.461', desc: 'Stiffness of right knee', bodyPart: 'KNEE', laterality: 'right' },
  { icd10: 'M25.462', desc: 'Stiffness of left knee', bodyPart: 'KNEE', laterality: 'left' },
  { icd10: 'M25.361', desc: 'Other instability, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { icd10: 'M25.362', desc: 'Other instability, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { icd10: 'M76.51', desc: 'Patellar tendinitis, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { icd10: 'M76.52', desc: 'Patellar tendinitis, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { icd10: 'M22.41', desc: 'Chondromalacia patellae, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { icd10: 'M22.42', desc: 'Chondromalacia patellae, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { icd10: 'M23.91', desc: 'Internal derangement, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { icd10: 'M23.92', desc: 'Internal derangement, left knee', bodyPart: 'KNEE', laterality: 'left' },
  // ── 通用码 ──
  { icd10: 'G89.29', desc: 'Other chronic pain', bodyPart: null, laterality: null },
  { icd10: 'S39.012A', desc: 'Strain of muscle of lower back, initial', bodyPart: 'LBP', laterality: 'bilateral' },
  { icd10: 'M62.830', desc: 'Muscle spasm of back', bodyPart: 'LBP', laterality: 'bilateral' },
]

// ICD-10 搜索过滤
const filteredIcdOptions = computed(() => {
  const supported = noteType.value === 'TX' ? SUPPORTED_TX_PARTS : SUPPORTED_IE_PARTS
  const alreadySelected = new Set(selectedIcds.value.map(s => s.icd10))
  const available = ICD_CATALOG.filter(item =>
    !alreadySelected.has(item.icd10) && (item.bodyPart === null || supported.has(item.bodyPart))
  )
  if (!icdSearch.value.trim()) return available
  const q = icdSearch.value.toLowerCase()
  return available.filter(item => item.icd10.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
})

function syncBodyPartFromIcds() {
  const withPart = selectedIcds.value.filter(s => s.bodyPart)
  if (withPart.length === 0) return
  bodyPart.value = withPart[0].bodyPart
  const sides = new Set(withPart.map(s => s.laterality))
  if (sides.has('right') && sides.has('left')) {
    laterality.value = 'bilateral'
  } else if (sides.has('right')) {
    laterality.value = 'right'
  } else if (sides.has('left')) {
    laterality.value = 'left'
  } else {
    laterality.value = 'bilateral'
  }
}

function selectIcdCode(item) {
  if (selectedIcds.value.length >= 4) return
  selectedIcds.value = [...selectedIcds.value, item]
  icdSearch.value = ''
  icdDropdownOpen.value = false
  syncBodyPartFromIcds()
}

function removeIcdCode(index) {
  selectedIcds.value = selectedIcds.value.filter((_, i) => i !== index)
  syncBodyPartFromIcds()
}

// 病史选项 — 分组
const MEDICAL_HISTORY_GROUPS = [
  {
    label: '心血管',
    items: ['Hypertension', 'Heart Disease', 'Heart Murmur', 'Pacemaker', 'Stroke', 'Cholesterol', 'Hyperlipidemia'],
  },
  {
    label: '代谢/内科',
    items: ['Diabetes', 'Thyroid', 'Liver Disease', 'Kidney Disease', 'Anemia', 'Asthma', 'Lung Disease', 'stomach trouble', 'Prostate'],
  },
  {
    label: '骨骼肌肉',
    items: ['Herniated Disk', 'Osteoporosis', 'Fractures', 'Joint Replacement', 'Pinched Nerve'],
  },
  {
    label: '其他',
    items: ['Smoking', 'Alcohol', 'Parkinson', 'tinnitus', 'Hysterectomy', 'C-section'],
  },
]
const ALL_MEDICAL_HISTORY_OPTIONS = MEDICAL_HISTORY_GROUPS.flatMap(g => g.items)

// 各部位的放射痛选项 (按医学合理性过滤)
const RADIATION_MAP = {
  'LBP': [
    'without radiation',
    'With radiation to R leg',
    'With radiation to L leg',
    'with radiation to BLLE',
    'with radiation to toes',
  ],
  'MID_LOW_BACK': [
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
  'WRIST': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'HAND': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'ANKLE': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'FOOT': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'THIGH': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'CALF': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'ARM': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  'FOREARM': [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'bilateral', label: 'Bilateral' }
  ],
  // 脊柱部位无侧别
  'LBP': null,
  'NECK': null,
  'UPPER_BACK': null,
  'MIDDLE_BACK': null,
  'MID_LOW_BACK': null,
}

// Primary body part options filtered by note type (IE vs TX have different template support)
const availableBodyParts = computed(() => {
  const supported = noteType.value === 'TX' ? SUPPORTED_TX_PARTS : SUPPORTED_IE_PARTS
  return BODY_PARTS.filter(bp => supported.has(bp))
})

// Reset bodyPart when switching noteType if current selection is unsupported
watch(noteType, () => {
  if (!availableBodyParts.value.includes(bodyPart.value)) {
    bodyPart.value = 'LBP'
  }
})

// 当前部位是否有侧别选项
const lateralityOptions = computed(() => LATERALITY_MAP[bodyPart.value] || null)

// 当前部位的放射痛选项 (fallback 到 whitelist 全集)
const radiationOptions = computed(() => RADIATION_MAP[bodyPart.value] || whitelist['subjective.painRadiation'])

// 部位切换时重置侧别 + 放射痛 + ADL 活动
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
  // 重置 ADL 活动为当前部位的第一项（从 BODY_PART_ADL 共享常量）
  const bpAdl = BODY_PART_ADL[bp]
  if (bpAdl && bpAdl.length > 0) {
    fields['subjective.adlDifficulty.activities'] = [bpAdl[0]]
  }
}, { immediate: true })

// 切换模式时清空 ICD 选择
watch(selectionMode, (mode) => {
  if (mode === 'bodypart') { icdSearch.value = ''; selectedIcds.value = [] }
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
  secondaryLaterality: computed(() => ({ ...secondaryLaterality })),
  medicalHistory,
  ieTxCount,
  derivedSeverity,
  currentPain,
  realisticPatch,
})
const {
  generationContext,
  generatedNotes,
  generationError,
  validationResult,
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
const showValidationDetails = ref(false)

// 病史推荐的整体证型
const recommendedPatterns = computed(() => {
  if (medicalHistory.value.length === 0) return []
  return inferSystemicPatterns(medicalHistory.value, patientAge.value)
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
]

// 必填项完成度
const requiredProgress = computed(() => {
  let total = 0
  let filled = 0
  for (const fp of REQUIRED_FIELDS) {
    total++
    const v = fields[fp]
    if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) filled++
  }
  if (recentWorseValue.value && recentWorseUnit.value) filled++
  total++
  return { filled, total, pct: Math.round((filled / total) * 100) }
})

// 第二步：审核 R 项配置（分组：中医 / 体格检查 / 治疗 / TX专用）
const STEP2_GROUPS = [
  {
    key: 'tcm', label: '中医辨证',
    items: [
      { path: 'assessment.tcmDiagnosis.localPattern' },
      { path: 'assessment.tcmDiagnosis.systemicPattern' },
      { path: 'objective.tonguePulse.tongue' },
      { path: 'objective.tonguePulse.pulse' },
    ],
  },
  {
    key: 'physical', label: '体格检查',
    items: [
      { path: '__severity', readOnly: true },
      { path: 'objective.muscleTesting.tightness.gradingScale' },
      { path: 'objective.muscleTesting.tenderness.gradingScale' },
      { path: 'objective.spasmGrading' },
      { path: 'subjective.adlDifficulty.activities', isMulti: true },
    ],
  },
  {
    key: 'treatment', label: '治疗',
    items: [
      { path: 'plan.needleProtocol.electricalStimulation', overrideByHistory: true },
    ],
  },
  {
    key: 'tx', label: 'TX 专用',
    items: [
      { path: 'subjective.symptomChange', txOnly: true },
      { path: 'subjective.reasonConnector', txOnly: true },
      { path: 'subjective.reason', txOnly: true },
      { path: 'subjective.painScale', txOnly: true },
    ],
  },
]

function resolveReviewItem(item) {
  const path = item.path
  const readOnly = !!item.readOnly
  const isMulti = !!item.isMulti
  if (path === '__severity') {
    return { path, label: 'Severity', value: derivedSeverity.value, readOnly, isMulti, options: null }
  }
  return { path, label: fieldLabel(path), value: fields[path], readOnly, isMulti, options: whitelist[path] }
}

const step2Groups = computed(() => {
  return STEP2_GROUPS
    .map(group => ({
      ...group,
      resolvedItems: group.items
        .filter(item => !item.txOnly || noteType.value === 'TX')
        .filter(item => item.path.startsWith('__') || item.path in whitelist)
        .map(resolveReviewItem),
    }))
    .filter(group => group.resolvedItems.length > 0)
})

// 第二步审核卡片：单字段编辑
const derivedEditing = ref('')
function toggleDerivedEdit(fp) {
  derivedEditing.value = derivedEditing.value === fp ? '' : fp
}

// === Phase 2: 交叉校验 (非阻塞警告, 使用共享映射) ===

const crossFieldWarnings = computed(() => {
  const warnings = []
  const pain = currentPain.value

  // S8: symptomScale vs pain
  const scaleRaw = fields['subjective.symptomScale']
  if (scaleRaw) {
    const m = String(scaleRaw).match(/(\d+)/)
    const scalePct = m ? parseInt(m[1], 10) : 0
    if (pain >= 8 && scalePct < 70) {
      warnings.push({ id: 'S8', text: `症状量表 ${scaleRaw} 偏低 — pain ${pain} 建议 ≥70%` })
    } else if (pain >= 6 && scalePct < 50) {
      warnings.push({ id: 'S8', text: `症状量表 ${scaleRaw} 偏低 — pain ${pain} 建议 ≥50%` })
    } else if (pain >= 4 && scalePct < 30) {
      warnings.push({ id: 'S8', text: `症状量表 ${scaleRaw} 偏低 — pain ${pain} 建议 ≥30%` })
    }
  }

  // S2: painTypes vs localPattern (共享映射)
  const localPattern = fields['assessment.tcmDiagnosis.localPattern']
  const painTypes = fields['subjective.painTypes']
  if (localPattern && Array.isArray(painTypes) && painTypes.length > 0) {
    const { consistent, expected } = isPainTypeConsistentWithPattern(String(localPattern), painTypes)
    if (expected.length > 0 && !consistent) {
      warnings.push({ id: 'S2', text: `疼痛类型 [${painTypes.join(', ')}] 与证型不匹配 — 建议含 ${expected.join('/')}` })
    }
  }

  // S3: ADL activities vs bodyPart (共享映射)
  const adlActivities = fields['subjective.adlDifficulty.activities']
  const bp = bodyPart.value?.toUpperCase()
  if (Array.isArray(adlActivities) && adlActivities.length > 0 && bp) {
    const { consistent, keywords } = isAdlConsistentWithBodyPart(bp, adlActivities.join(' '))
    if (keywords.length > 0 && !consistent) {
      warnings.push({ id: 'S3', text: `ADL 活动与 ${bp} 部位不匹配 — 建议含 ${keywords.slice(0, 4).join('/')} 相关活动` })
    }
  }

  return warnings
})

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

async function doGenerate() {
  const missing = validateRequiredBeforeGenerate()
  if (missing.length > 0) {
    const el = document.querySelector('[data-step1]')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    showValidation(`请先完成必填项（${missing.length} 项未填）`)
    return
  }
  isGenerating.value = true
  try {
    await generate()
  } finally {
    isGenerating.value = false
  }
}

// 内联校验提示
const validationMsg = ref('')
let validationTimer = null
function showValidation(msg) {
  validationMsg.value = msg
  clearTimeout(validationTimer)
  validationTimer = setTimeout(() => { validationMsg.value = '' }, 4000)
}

// 生成中状态
const isGenerating = ref(false)

// Realistic Patch toggle (corrected ROM/Strength scores)
const realisticPatch = ref(true)

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

// 病程时长/近期加重：截止到 "more than 10"
const DURATION_VALUE_OPTIONS = computed(() => {
  const all = whitelist['subjective.symptomDuration.value'] || []
  const cutIdx = all.indexOf('more than 10')
  return cutIdx >= 0 ? all.slice(0, cutIdx + 1) : all
})

// 疼痛频率按钮短标签
function painFreqShort(full) {
  const m = full.match(/^(\w+)/)
  return m ? m[1] : full
}

// 次要部位：切换选中 + 管理侧别
function toggleSecondaryPart(bp) {
  const idx = secondaryBodyParts.value.indexOf(bp)
  if (idx >= 0) {
    secondaryBodyParts.value.splice(idx, 1)
    delete secondaryLaterality[bp]
  } else {
    secondaryBodyParts.value.push(bp)
    if (LATERALITY_MAP[bp]) {
      secondaryLaterality[bp] = 'bilateral'
    }
  }
}

// Step 2 长文本字段：值不截断，允许换行
const LONG_VALUE_FIELDS = new Set([
  'objective.tonguePulse.tongue',
  'objective.muscleTesting.tenderness.gradingScale',
  'objective.spasmGrading',
  'subjective.adlDifficulty.activities',
  'subjective.reason',
])
function isLongField(path) {
  return LONG_VALUE_FIELDS.has(path)
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- 左栏: 三步 填写 → 审核 → 生成 -->
      <div class="lg:col-span-5 space-y-4">
        <!-- 内联校验提示 -->
        <Transition name="panel">
          <div v-if="validationMsg" class="validation-toast flex items-center gap-2" role="alert">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
            {{ validationMsg }}
          </div>
        </Transition>

        <!-- ① 第一步：填写必填项 -->
        <div data-step1 class="space-y-3 mt-6">
          <h2 class="text-sm font-semibold text-ink-800 flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-ink-800 text-paper-50 text-xs flex items-center justify-center">1</span>
            填写必填项 <span class="text-red-500 text-[10px] font-normal">*</span>
            <span class="ml-auto text-[10px] font-normal" :class="requiredProgress.pct === 100 ? 'text-green-600' : 'text-ink-400'">
              {{ requiredProgress.filled }}/{{ requiredProgress.total }}
            </span>
          </h2>
        <!-- 基础设置 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-3">
          <h3 class="text-xs font-medium text-ink-600">基础设置</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-ink-500 mb-1 block">保险类型</label>
              <select v-model="insuranceType" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="t in INSURANCE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-ink-500 mb-1 block">部位</label>
              <!-- 模式切换 -->
              <div class="flex gap-1 mb-1.5">
                <button @click="selectionMode = 'bodypart'"
                  class="flex-1 py-1 text-[11px] font-medium rounded-md border transition-colors duration-150 cursor-pointer"
                  :class="selectionMode === 'bodypart' ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                  直选
                </button>
                <button @click="selectionMode = 'icd10'"
                  class="flex-1 py-1 text-[11px] font-medium rounded-md border transition-colors duration-150 cursor-pointer"
                  :class="selectionMode === 'icd10' ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                  ICD-10
                </button>
              </div>
              <!-- 直选模式 -->
              <select v-if="selectionMode === 'bodypart'" v-model="bodyPart" class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm">
                <option v-for="p in availableBodyParts" :key="p" :value="p">{{ bodyPartLabel(p) }}</option>
              </select>
              <!-- ICD-10 多选模式 -->
              <div v-else>
                <!-- 已选标签 -->
                <div v-if="selectedIcds.length" class="flex flex-wrap gap-1 mb-1.5">
                  <span v-for="(item, idx) in selectedIcds" :key="item.icd10"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                    :class="item.bodyPart ? 'bg-ink-800 text-paper-50' : 'bg-ink-100 text-ink-600'">
                    {{ item.icd10 }}
                    <button @click="removeIcdCode(idx)" class="hover:text-red-400 cursor-pointer">&times;</button>
                  </span>
                </div>
                <!-- 搜索输入 -->
                <div v-if="selectedIcds.length < 4" class="relative">
                  <input v-model="icdSearch" @focus="icdDropdownOpen = true" @blur="icdDropdownOpen = false"
                    placeholder="输入 ICD-10 编码或描述..."
                    class="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm" />
                  <div v-if="icdDropdownOpen && filteredIcdOptions.length"
                    class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-ink-200 rounded-lg shadow-lg">
                    <button v-for="item in filteredIcdOptions" :key="item.icd10"
                      @mousedown.prevent="selectIcdCode(item)"
                      class="w-full px-3 py-1.5 text-left text-sm hover:bg-ink-50 flex justify-between cursor-pointer">
                      <span class="font-mono text-xs text-ink-600">{{ item.icd10 }}</span>
                      <span class="text-ink-500 truncate ml-2">{{ item.desc }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <!-- 侧别选择 (仅四肢关节部位显示) -->
              <div v-if="lateralityOptions" class="flex gap-1 mt-1.5">
                <button v-for="opt in lateralityOptions" :key="opt.value"
                  @click="laterality = opt.value"
                  class="flex-1 py-1 text-[11px] font-medium rounded-md border transition-colors duration-150 cursor-pointer"
                  :class="laterality === opt.value
                    ? 'bg-ink-800 text-paper-50 border-ink-800'
                    : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                  {{ opt.label }}
                </button>
              </div>
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
          <div v-if="noteType === 'IE'" class="flex items-center gap-2">
            <label class="text-xs text-ink-500">IE后TX数量:</label>
            <input type="number" v-model.number="ieTxCount" min="1" max="20" class="w-16 px-2 py-1 border border-ink-200 rounded text-sm text-center" />
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
                  class="flex-1 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer"
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
                @click="toggleSecondaryPart(bp)"
                class="px-2.5 py-1 text-[11px] rounded-md border transition-colors cursor-pointer"
                :class="secondaryBodyParts.includes(bp) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                {{ bodyPartLabel(bp) }}
              </button>
            </div>
            <!-- 已选次要部位的侧别选择 -->
            <div v-for="bp in secondaryBodyParts.filter(b => LATERALITY_MAP[b])" :key="'lat-'+bp" class="flex items-center gap-1.5 mt-1.5">
              <span class="text-[11px] text-ink-400 w-16 flex-shrink-0">{{ bp }}</span>
              <button v-for="opt in LATERALITY_MAP[bp]" :key="opt.value"
                @click="secondaryLaterality[bp] = opt.value"
                class="px-2 py-0.5 text-[10px] font-medium rounded border transition-colors cursor-pointer"
                :class="secondaryLaterality[bp] === opt.value
                  ? 'bg-ink-800 text-paper-50 border-ink-800'
                  : 'border-ink-200 text-ink-400 hover:border-ink-400'">
                {{ opt.label }}
              </button>
            </div>
          </div>
          <!-- 病史 (折叠面板, 分组) -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs text-ink-500 font-medium">病史 <span class="text-ink-300 font-normal">({{ medicalHistory.length || '无' }})</span></label>
              <button @click="togglePanel('medicalHistory')" class="text-[11px] text-ink-400 hover:text-ink-600 transition-colors px-2 py-1 rounded-md hover:bg-paper-100 cursor-pointer min-h-[28px]">
                {{ expandedPanels['medicalHistory'] ? '收起' : '编辑' }}
              </button>
            </div>
            <!-- 已选标签 -->
            <div class="flex flex-wrap gap-1 min-h-[1.5rem]">
              <span v-if="medicalHistory.length === 0" class="text-[10px] text-ink-300 italic py-0.5">无病史</span>
              <span v-for="h in medicalHistory" :key="h"
                class="inline-flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full bg-ink-800 text-paper-50">
                {{ h }}
                <button @click="medicalHistory.splice(medicalHistory.indexOf(h), 1)"
                  class="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-ink-600 transition-colors">
                  <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </span>
            </div>
            <!-- 展开面板 (分组) -->
            <div v-show="expandedPanels['medicalHistory']" class="border border-ink-150 rounded-lg p-2 bg-paper-50 max-h-48 overflow-y-auto space-y-2">
              <div v-for="group in MEDICAL_HISTORY_GROUPS" :key="group.label">
                <p class="text-[10px] text-ink-400 font-medium mb-1">{{ group.label }}</p>
                <div class="flex flex-wrap gap-1">
                  <button v-for="h in group.items" :key="h"
                    @click="medicalHistory.includes(h) ? medicalHistory.splice(medicalHistory.indexOf(h), 1) : medicalHistory.push(h)"
                    class="text-[11px] px-2 py-1 rounded-md border transition-colors duration-150 cursor-pointer"
                    :class="medicalHistory.includes(h) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:bg-paper-100'">
                    {{ h }}
                  </button>
                </div>
              </div>
              <button v-if="medicalHistory.length > 0" @click="medicalHistory.splice(0)"
                class="text-[10px] text-ink-400 hover:text-red-500 transition-colors cursor-pointer mt-1">
                清空全部
              </button>
            </div>
          </div>
          <!-- 慢性程度 -->
          <div class="space-y-1">
            <label class="text-xs text-ink-500">慢性程度</label>
            <div class="grid grid-cols-3 gap-1">
              <button v-for="opt in whitelist['subjective.chronicityLevel']" :key="opt"
                @click="fields['subjective.chronicityLevel'] = opt"
                class="py-1.5 text-[11px] font-medium rounded-md border transition-colors duration-150 cursor-pointer text-center"
                :class="fields['subjective.chronicityLevel'] === opt
                  ? 'bg-ink-800 text-paper-50 border-ink-800'
                  : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                {{ opt }}
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

        <!-- 评估参数 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-2.5">
          <h3 class="text-xs font-medium text-ink-600">评估参数</h3>
          <p class="text-[10px] text-ink-400">
            <span class="text-red-500">*</span> 用户必填
            <span class="text-blue-400 ml-2">R</span> 引擎推导（可改）
          </p>
          <!-- Pain Scale W/B/C -->
          <div>
            <label class="text-xs text-ink-500 mb-1 block">疼痛评分 <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <span class="text-[10px] text-ink-400 block mb-0.5">最痛</span>
                <select v-model="fields['subjective.painScale.worst']" class="w-full px-1 py-1.5 border border-ink-200 rounded text-xs text-center">
                  <option v-for="opt in whitelist['subjective.painScale.worst']" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
              <div>
                <span class="text-[10px] text-ink-400 block mb-0.5">最轻</span>
                <select v-model="fields['subjective.painScale.best']" class="w-full px-1 py-1.5 border border-ink-200 rounded text-xs text-center">
                  <option v-for="opt in whitelist['subjective.painScale.best']" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
              <div>
                <span class="text-[10px] text-ink-400 block mb-0.5">当前</span>
                <select v-model="fields['subjective.painScale.current']" class="w-full px-1 py-1.5 border border-ink-200 rounded text-xs text-center">
                  <option v-for="opt in whitelist['subjective.painScale.current']" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
            </div>
          </div>
          <!-- Duration value + unit -->
          <div>
            <label class="text-xs text-ink-500 mb-1 block">病程时长 <span class="text-red-500">*</span></label>
            <div class="flex gap-2">
              <select v-model="fields['subjective.symptomDuration.value']" class="flex-1 px-1 py-1.5 border border-ink-200 rounded text-xs text-center">
                <option v-for="opt in DURATION_VALUE_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <select v-model="fields['subjective.symptomDuration.unit']" class="flex-[2] px-1 py-1.5 border border-ink-200 rounded text-xs">
                <option v-for="opt in whitelist['subjective.symptomDuration.unit']" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
          </div>
          <!-- 近期加重时长 -->
          <div>
            <label class="text-xs text-ink-500 mb-1 block">近期加重 <span class="text-red-500">*</span></label>
            <div class="flex gap-2">
              <select v-model="recentWorseValue" class="flex-1 px-1 py-1.5 border border-ink-200 rounded text-xs text-center">
                <option v-for="opt in DURATION_VALUE_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <select v-model="recentWorseUnit" class="flex-[2] px-1 py-1.5 border border-ink-200 rounded text-xs">
                <option v-for="opt in whitelist['subjective.symptomDuration.unit']" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
          </div>
          <!-- 症状量表 -->
          <div>
            <label class="text-xs text-ink-500 mb-1 block">症状量表 <span class="text-red-500">*</span></label>
            <select v-model="fields['subjective.symptomScale']" class="w-full px-1 py-1.5 border border-ink-200 rounded text-xs">
              <option v-for="opt in [...whitelist['subjective.symptomScale']].reverse()" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>
          <!-- 疼痛频率：四个平行按钮 -->
          <div class="space-y-1">
            <label class="text-xs text-ink-500">疼痛频率 <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1">
              <button v-for="opt in whitelist['subjective.painFrequency']" :key="opt"
                @click="fields['subjective.painFrequency'] = opt"
                class="py-1.5 text-[11px] font-medium rounded-md border transition-colors duration-150 cursor-pointer text-center"
                :class="fields['subjective.painFrequency'] === opt
                  ? 'bg-ink-800 text-paper-50 border-ink-800'
                  : 'border-ink-200 text-ink-500 hover:border-ink-400'"
                :title="opt">
                {{ painFreqShort(opt) }}
              </button>
            </div>
          </div>
        </div>

        <!-- 主观必填 -->
        <div class="bg-white rounded-xl border border-ink-200 p-4 space-y-2.5">
          <h3 class="text-xs font-medium text-ink-600">主观必填 <span class="text-red-500">*</span></h3>
          <div v-for="fieldPath in STEP1_SUBJECTIVE_FIELDS" :key="fieldPath" class="space-y-1">
            <!-- 伴随症状 / 疼痛类型：直接展示按钮组 (多选) -->
            <div v-if="fieldPath === 'subjective.associatedSymptoms' || fieldPath === 'subjective.painTypes'" class="space-y-1">
              <label class="text-xs text-ink-500 font-medium">{{ fieldLabel(fieldPath) }}</label>
              <div class="flex flex-wrap gap-1.5">
                <button v-for="opt in whitelist[fieldPath]" :key="opt"
                  @click="toggleOption(fieldPath, opt)"
                  class="px-2.5 py-1.5 text-[11px] font-medium rounded-md border transition-colors duration-150 cursor-pointer"
                  :class="fields[fieldPath].includes(opt)
                    ? 'bg-ink-800 text-paper-50 border-ink-800'
                    : 'border-ink-200 text-ink-500 hover:border-ink-400'">
                  {{ opt }}
                </button>
              </div>
            </div>
            <template v-else-if="MULTI_SELECT_FIELDS.has(fieldPath)">
              <div class="flex items-center justify-between">
                <label class="text-xs text-ink-500 font-medium">{{ fieldLabel(fieldPath) }}</label>
                <button @click="togglePanel(fieldPath)" class="text-[11px] text-ink-400 hover:text-ink-600 px-2 py-1 rounded-md hover:bg-paper-100 cursor-pointer min-h-[28px]">{{ expandedPanels[fieldPath] ? '收起' : '编辑' }}</button>
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
                    class="text-[11px] px-2 py-1 rounded-md border transition-colors duration-150 cursor-pointer"
                    :class="fields[fieldPath].includes(opt) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-600 hover:border-ink-400 hover:bg-paper-100'"
                    :title="opt">{{ shortLabel(opt) }}</button>
                </div>
              </div>
            </template>
            <!-- painRadiation: 纵向布局，选项完整显示 -->
            <div v-else-if="fieldPath === 'subjective.painRadiation'" class="space-y-1">
              <label class="text-xs text-ink-500 font-medium">{{ fieldLabel(fieldPath) }}</label>
              <select v-model="fields[fieldPath]" class="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-xs">
                <option v-for="opt in radiationOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <!-- 其他单选字段 -->
            <div v-else class="flex items-center gap-2">
              <label class="text-xs text-ink-500 w-24 flex-shrink-0">{{ fieldLabel(fieldPath) }}</label>
              <select v-model="fields[fieldPath]" class="flex-1 px-2 py-1 border border-ink-200 rounded text-xs">
                <option v-for="opt in whitelist[fieldPath]" :key="opt" :value="opt">{{ opt.length > 45 ? opt.substring(0, 45) + '...' : opt }}</option>
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
          <div v-for="group in step2Groups" :key="group.key" class="bg-white rounded-xl border border-ink-200 p-4">
            <h4 class="text-[10px] font-medium text-ink-400 uppercase tracking-wide mb-2">{{ group.label }}</h4>
            <div v-for="item in group.resolvedItems" :key="item.path"
              class="flex gap-2 py-2 border-b border-ink-50 text-xs last:border-b-0"
              :class="[item.readOnly ? 'bg-paper-50' : '', isLongField(item.path) ? 'flex-wrap items-start' : 'items-center']">
              <span class="text-ink-500 w-20 flex-shrink-0">{{ item.label }}</span>
              <template v-if="item.readOnly">
                <span class="font-medium text-ink-600 flex-1">{{ item.value }}</span>
              </template>
              <template v-else-if="derivedEditing === item.path">
                <template v-if="item.isMulti">
                  <div class="flex-1 flex flex-wrap gap-1">
                    <button v-for="opt in item.options" :key="opt"
                      @click="fields[item.path].includes(opt) ? removeOption(item.path, opt) : toggleOption(item.path, opt)"
                      class="text-[11px] px-2 py-1 rounded-md border cursor-pointer"
                      :class="fields[item.path].includes(opt) ? 'bg-ink-800 text-paper-50 border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">{{ shortLabel(opt) }}</button>
                  </div>
                </template>
                <div v-else-if="isLongField(item.path)" class="w-full flex items-center gap-2 mt-1">
                  <select v-model="fields[item.path]" class="flex-1 px-2 py-1 border border-ink-300 rounded text-xs" @change="derivedEditing = ''; onPatternFieldChange(item.path)">
                    <option v-for="opt in item.options" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <button @click="derivedEditing = ''" class="text-[11px] text-ink-400 hover:text-ink-600 hover:bg-paper-100 px-2 py-1 rounded-md flex-shrink-0 cursor-pointer min-h-[28px] transition-colors">确定</button>
                </div>
                <select v-else v-model="fields[item.path]" class="flex-1 px-2 py-1 border border-ink-300 rounded text-xs" @change="derivedEditing = ''; onPatternFieldChange(item.path)">
                  <option v-for="opt in item.options" :key="opt" :value="opt">{{ opt.length > 50 ? opt.substring(0, 50) + '...' : opt }}</option>
                </select>
                <button v-if="!isLongField(item.path)" @click="derivedEditing = ''" class="text-[11px] text-ink-400 hover:text-ink-600 hover:bg-paper-100 px-2 py-1 rounded-md flex-shrink-0 cursor-pointer min-h-[28px] transition-colors">确定</button>
              </template>
              <template v-else>
                <span class="font-medium text-ink-700 flex-1 min-w-0"
                  :class="isLongField(item.path) ? 'whitespace-normal break-words' : 'truncate'"
                  :title="Array.isArray(item.value) ? item.value.join(', ') : item.value">
                  {{ item.isMulti
                    ? (item.value && item.value.length
                      ? (isLongField(item.path) ? item.value.join(', ') : shortLabel(item.value.join(', '), 30))
                      : '未选择')
                    : (isLongField(item.path) ? String(item.value || '') : shortLabel(String(item.value || ''), 35)) }}
                </span>
                <button @click="toggleDerivedEdit(item.path)" class="text-[11px] text-ink-400 hover:text-ink-600 hover:bg-paper-100 px-2 py-1 rounded-md flex-shrink-0 cursor-pointer min-h-[28px] transition-colors">改</button>
              </template>
            </div>
            <!-- 病史推荐证型 (仅中医组显示) -->
            <div v-if="group.key === 'tcm' && recommendedPatterns.length > 0" class="border-t border-ink-100 pt-2 mt-2">
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
          <!-- 交叉校验警告 (非阻塞) -->
          <template v-if="crossFieldWarnings.length > 0">
            <div v-for="w in crossFieldWarnings" :key="w.id"
              class="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700" role="status">
              <svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
              <span><strong>{{ w.id }}</strong> {{ w.text }}</span>
            </div>
          </template>
          <!-- 生成错误提示 -->
          <Transition name="panel">
            <div v-if="generationError" class="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600" role="alert">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
              {{ generationError }}
            </div>
          </Transition>
          <button @click="doGenerate()" :disabled="isGenerating"
            class="w-full py-2.5 bg-ink-800 text-paper-50 rounded-lg text-sm font-medium hover:bg-ink-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <svg v-if="isGenerating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ isGenerating ? '生成中...' : `生成 ${noteType === 'TX' ? `${txCount} 个 TX` : 'IE'}` }}
          </button>
          <!-- 高级选项 (折叠) -->
          <details class="text-xs">
            <summary class="text-ink-400 hover:text-ink-600 cursor-pointer py-1 select-none">高级选项</summary>
            <div class="space-y-2 mt-1.5">
              <div class="flex items-center gap-2">
                <input v-model="seedInput" type="text" placeholder="Seed (留空随机)"
                  aria-label="随机种子"
                  class="flex-1 px-2 py-1.5 border border-ink-200 rounded-lg text-xs font-mono text-ink-600 placeholder:text-ink-300" />
              </div>
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <button @click="realisticPatch = !realisticPatch" type="button"
                  class="relative w-8 h-4.5 rounded-full transition-colors duration-200 flex-shrink-0"
                  :class="realisticPatch ? 'bg-green-500' : 'bg-ink-300'"
                  role="switch" :aria-checked="realisticPatch">
                  <span class="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform duration-200"
                    :class="realisticPatch ? 'translate-x-3.5' : ''"></span>
                </button>
                <span class="text-ink-500">Realistic ROM/Strength</span>
              </label>
            </div>
          </details>
        </div>
      </div>

      <!-- 右栏: 结果 -->
      <div class="lg:col-span-7 space-y-3">
        <div v-if="generatedNotes.length === 0" class="bg-white rounded-xl border border-ink-200 p-12 text-center">
          <svg class="w-12 h-12 mx-auto text-ink-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
          <p class="text-sm text-ink-400">选择参数并点击生成</p>
          <p class="text-[11px] text-ink-300 mt-1">完成左侧三步后即可生成 SOAP 笔记</p>
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
            <button @click="copyAll" class="px-3 py-1.5 text-xs border border-ink-200 rounded-lg hover:bg-paper-100 cursor-pointer transition-colors">
              {{ copiedIndex === -999 ? '✓ 已复制' : '复制全部' }}
            </button>
          </div>
          <!-- 自检结果摘要 -->
          <div v-if="validationResult" class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-2"
            :class="validationResult.grade === 'PASS' ? 'bg-green-50 border border-green-200 text-green-700'
              : validationResult.grade === 'WARNING' ? 'bg-amber-50 border border-amber-200 text-amber-700'
              : 'bg-red-50 border border-red-200 text-red-700'">
            <span class="font-semibold">{{ validationResult.grade === 'PASS' ? 'PASS' : validationResult.grade === 'WARNING' ? 'WARNING' : 'FAIL' }}</span>
            <span class="font-mono">{{ validationResult.score }}/100</span>
            <span class="text-[10px] opacity-75">
              ({{ validationResult.criticalCount }}C / {{ validationResult.highCount }}H / {{ validationResult.mediumCount }}M)
            </span>
            <button v-if="validationResult.errors.length > 0" @click="showValidationDetails = !showValidationDetails"
              class="ml-auto text-[10px] underline underline-offset-2 cursor-pointer opacity-75 hover:opacity-100">
              {{ showValidationDetails ? '收起' : '详情' }}
            </button>
          </div>
          <!-- 自检错误详情 -->
          <div v-if="showValidationDetails && validationResult && validationResult.errors.length > 0"
            class="mb-2 rounded-lg border border-ink-200 bg-white overflow-hidden">
            <div v-for="(ve, vi) in validationResult.errors" :key="vi"
              class="flex items-start gap-2 px-3 py-1.5 text-[11px] border-b border-ink-50 last:border-b-0">
              <span class="font-mono flex-shrink-0 px-1 rounded"
                :class="ve.severity === 'CRITICAL' ? 'bg-red-100 text-red-700'
                  : ve.severity === 'HIGH' ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'">{{ ve.ruleId }}</span>
              <span class="text-ink-500">TX{{ ve.visitIndex }}</span>
              <span class="text-ink-700 flex-1">{{ ve.message }}</span>
              <span class="text-ink-400 flex-shrink-0">{{ ve.expected }}</span>
            </div>
          </div>
          <div v-for="(note, idx) in generatedNotes" :key="idx" class="bg-white rounded-xl border border-ink-200 mb-3">
            <!-- 折叠栏头部 -->
            <div class="px-4 py-2 border-b border-ink-100 cursor-pointer select-none" @click="note._open = !note._open">
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
                  class="px-2.5 py-1 text-[11px] font-mono font-medium border rounded-md transition-colors duration-150 cursor-pointer"
                  :class="isCopied(idx, sec)
                    ? 'bg-green-50 border-green-300 text-green-600'
                    : 'border-ink-200 text-ink-500 hover:bg-paper-100 hover:border-ink-300'">
                  {{ isCopied(idx, sec) ? '✓ ' + sec : sec }}
                </button>
                <div class="w-px h-4 bg-ink-150 mx-1"></div>
                <button @click="copyNote(idx)"
                  class="px-2.5 py-1 text-[11px] border rounded-md transition-colors duration-150 cursor-pointer"
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
