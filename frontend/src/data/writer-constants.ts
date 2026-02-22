/**
 * 编写页面纯数据常量
 * 从 WriterPanel.vue 提取，减小组件体积
 */

import { getICDCatalog } from '../../../src/shared/icd-catalog'

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

export const ICD_CATALOG = getICDCatalog()

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
