/**
 * 编写页面纯数据常量
 * 从 WriterPanel.vue 提取，减小组件体积
 */

export const INSURANCE_OPTIONS = [
  { value: 'OPTUM', label: 'Optum' },
  { value: 'HF', label: 'HealthFirst' },
  { value: 'WC', label: 'WellCare' },
  { value: 'VC', label: 'VillageCare Max' },
  { value: 'ELDERPLAN', label: 'ElderPlan' },
  { value: 'NONE', label: 'None / Self-pay' },
] as const

export const BODY_PARTS = [
  'LBP', 'NECK', 'UPPER_BACK', 'MIDDLE_BACK', 'MID_LOW_BACK',
  'SHOULDER', 'ELBOW', 'WRIST', 'HAND',
  'HIP', 'KNEE', 'ANKLE', 'FOOT',
  'THIGH', 'CALF', 'ARM', 'FOREARM',
] as const

export const SUPPORTED_IE_PARTS = new Set(['ELBOW', 'KNEE', 'LBP', 'MID_LOW_BACK', 'NECK', 'SHOULDER'])
export const SUPPORTED_TX_PARTS = new Set(['ELBOW', 'KNEE', 'LBP', 'MID_LOW_BACK', 'MIDDLE_BACK', 'NECK', 'SHOULDER'])
export const GENDER_OPTIONS = ['Male', 'Female'] as const

export const BODY_PART_DISPLAY: Record<string, string> = {
  'MID_LOW_BACK': 'M&L (Mid+Low Back)',
}

export function bodyPartLabel(bp: string): string {
  return BODY_PART_DISPLAY[bp] || bp
}

// ICD-10 码表 — 基于 src/shared/body-part-constants.ts ICD_BODY_MAP 展开
export const ICD_CATALOG = [
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
] as const

export const MEDICAL_HISTORY_GROUPS = [
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

export const ALL_MEDICAL_HISTORY_OPTIONS = MEDICAL_HISTORY_GROUPS.flatMap(g => g.items)

// 各部位的放射痛选项 (按医学合理性过滤)
export const RADIATION_MAP: Record<string, string[]> = {
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

const LR_BILATERAL = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bilateral', label: 'Bilateral' },
]

// 各部位的侧别选项
// 四肢关节: left / right / bilateral
// 脊柱中线: 无侧别选项 (固定 bilateral/unspecified)
export const LATERALITY_MAP: Record<string, { value: string; label: string }[] | null> = {
  'SHOULDER': LR_BILATERAL,
  'KNEE': LR_BILATERAL,
  'ELBOW': LR_BILATERAL,
  'HIP': LR_BILATERAL,
  'WRIST': LR_BILATERAL,
  'HAND': LR_BILATERAL,
  'ANKLE': LR_BILATERAL,
  'FOOT': LR_BILATERAL,
  'THIGH': LR_BILATERAL,
  'CALF': LR_BILATERAL,
  'ARM': LR_BILATERAL,
  'FOREARM': LR_BILATERAL,
  // 脊柱部位无侧别
  'LBP': null,
  'NECK': null,
  'UPPER_BACK': null,
  'MIDDLE_BACK': null,
  'MID_LOW_BACK': null,
}
