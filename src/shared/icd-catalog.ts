/**
 * ICD-10 Code → Name 映射表
 *
 * 针灸科常用 ICD-10 码的标准名称映射。
 * 用于批量自动化时传递给 MDLand addSelectionD(name, code)。
 *
 * 数据来源: WriterView.vue ICD_CATALOG + MDLand 备选列表实测
 */

export interface ICDEntry {
  readonly code: string
  readonly name: string
  readonly bodyPart: string | null
  readonly laterality: string | null
}

const ICD_ENTRIES: readonly ICDEntry[] = [
  // ── LBP ──
  { code: 'M54.50', name: 'Low back pain, unspecified', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M54.51', name: 'Vertebrogenic low back pain', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M54.59', name: 'Other low back pain', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M54.41', name: 'Lumbago with sciatica, right', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M54.42', name: 'Lumbago with sciatica, left', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M54.31', name: 'Sciatica, right side', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M54.32', name: 'Sciatica, left side', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M47.816', name: 'Spondylosis w/o myelopathy, lumbar', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M47.817', name: 'Spondylosis w/o myelopathy, lumbosacral', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M51.16', name: 'IVD disorder w/ radiculopathy, lumbar', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M51.17', name: 'IVD disorder w/ radiculopathy, lumbosacral', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M54.16', name: 'Radiculopathy, lumbar', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'S39.012A', name: 'Strain of muscle of lower back, initial', bodyPart: 'LBP', laterality: 'bilateral' },
  { code: 'M62.830', name: 'Muscle spasm of back', bodyPart: 'LBP', laterality: 'bilateral' },

  // ── NECK ──
  { code: 'M54.2', name: 'Cervicalgia', bodyPart: 'NECK', laterality: 'bilateral' },
  { code: 'M47.812', name: 'Spondylosis w/o myelopathy, cervical', bodyPart: 'NECK', laterality: 'bilateral' },
  { code: 'M47.813', name: 'Spondylosis w/o myelopathy, cervicothoracic', bodyPart: 'NECK', laterality: 'bilateral' },
  { code: 'M50.30', name: 'Other cervical disc degeneration, unspecified', bodyPart: 'NECK', laterality: 'bilateral' },
  { code: 'M50.320', name: 'Other cervical disc degeneration, mid-cervical', bodyPart: 'NECK', laterality: 'bilateral' },

  // ── UPPER_BACK / MIDDLE_BACK / THORACIC ──
  { code: 'M54.6', name: 'Pain in thoracic spine', bodyPart: 'MIDDLE_BACK', laterality: 'bilateral' },

  // ── MID_LOW_BACK ──
  { code: 'M54.5', name: 'Low back pain', bodyPart: 'MID_LOW_BACK', laterality: 'bilateral' },

  // ── SHOULDER ──
  { code: 'M25.511', name: 'Pain in right shoulder', bodyPart: 'SHOULDER', laterality: 'right' },
  { code: 'M25.512', name: 'Pain in left shoulder', bodyPart: 'SHOULDER', laterality: 'left' },
  { code: 'M25.519', name: 'Pain in unspecified shoulder', bodyPart: 'SHOULDER', laterality: 'bilateral' },
  { code: 'M75.10', name: 'Rotator cuff syndrome, unspecified', bodyPart: 'SHOULDER', laterality: 'bilateral' },
  { code: 'M75.11', name: 'Rotator cuff syndrome, right', bodyPart: 'SHOULDER', laterality: 'right' },
  { code: 'M75.12', name: 'Rotator cuff syndrome, left', bodyPart: 'SHOULDER', laterality: 'left' },
  { code: 'M75.01', name: 'Adhesive capsulitis, right shoulder', bodyPart: 'SHOULDER', laterality: 'right' },
  { code: 'M75.02', name: 'Adhesive capsulitis, left shoulder', bodyPart: 'SHOULDER', laterality: 'left' },
  { code: 'M79.611', name: 'Pain in right upper arm', bodyPart: 'SHOULDER', laterality: 'right' },
  { code: 'M79.612', name: 'Pain in left upper arm', bodyPart: 'SHOULDER', laterality: 'left' },

  // ── ELBOW ──
  { code: 'M25.521', name: 'Pain in right elbow', bodyPart: 'ELBOW', laterality: 'right' },
  { code: 'M25.522', name: 'Pain in left elbow', bodyPart: 'ELBOW', laterality: 'left' },
  { code: 'M25.529', name: 'Pain in unspecified elbow', bodyPart: 'ELBOW', laterality: 'bilateral' },
  { code: 'M77.01', name: 'Medial epicondylitis, right', bodyPart: 'ELBOW', laterality: 'right' },
  { code: 'M77.02', name: 'Medial epicondylitis, left', bodyPart: 'ELBOW', laterality: 'left' },
  { code: 'M77.11', name: 'Lateral epicondylitis, right', bodyPart: 'ELBOW', laterality: 'right' },
  { code: 'M77.12', name: 'Lateral epicondylitis, left', bodyPart: 'ELBOW', laterality: 'left' },

  // ── WRIST ──
  { code: 'M25.531', name: 'Pain in right wrist', bodyPart: 'WRIST', laterality: 'right' },
  { code: 'M25.532', name: 'Pain in left wrist', bodyPart: 'WRIST', laterality: 'left' },

  // ── HAND ──
  { code: 'M25.541', name: 'Pain in joints of right hand', bodyPart: 'HAND', laterality: 'right' },
  { code: 'M25.542', name: 'Pain in joints of left hand', bodyPart: 'HAND', laterality: 'left' },

  // ── HIP ──
  { code: 'M25.551', name: 'Pain in right hip', bodyPart: 'HIP', laterality: 'right' },
  { code: 'M25.552', name: 'Pain in left hip', bodyPart: 'HIP', laterality: 'left' },
  { code: 'M16.11', name: 'Primary osteoarthritis, right hip', bodyPart: 'HIP', laterality: 'right' },
  { code: 'M16.12', name: 'Primary osteoarthritis, left hip', bodyPart: 'HIP', laterality: 'left' },

  // ── KNEE ──
  { code: 'M25.561', name: 'Pain in right knee', bodyPart: 'KNEE', laterality: 'right' },
  { code: 'M25.562', name: 'Pain in left knee', bodyPart: 'KNEE', laterality: 'left' },
  { code: 'M25.569', name: 'Pain in unspecified knee', bodyPart: 'KNEE', laterality: 'bilateral' },
  { code: 'M17.0', name: 'Bilateral primary osteoarthritis of knee', bodyPart: 'KNEE', laterality: 'bilateral' },
  { code: 'M17.11', name: 'Primary osteoarthritis, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { code: 'M17.12', name: 'Primary osteoarthritis, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { code: 'M25.461', name: 'Stiffness of right knee', bodyPart: 'KNEE', laterality: 'right' },
  { code: 'M25.462', name: 'Stiffness of left knee', bodyPart: 'KNEE', laterality: 'left' },
  { code: 'M25.361', name: 'Other instability, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { code: 'M25.362', name: 'Other instability, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { code: 'M76.51', name: 'Patellar tendinitis, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { code: 'M76.52', name: 'Patellar tendinitis, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { code: 'M22.41', name: 'Chondromalacia patellae, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { code: 'M22.42', name: 'Chondromalacia patellae, left knee', bodyPart: 'KNEE', laterality: 'left' },
  { code: 'M23.91', name: 'Internal derangement, right knee', bodyPart: 'KNEE', laterality: 'right' },
  { code: 'M23.92', name: 'Internal derangement, left knee', bodyPart: 'KNEE', laterality: 'left' },

  // ── ANKLE ──
  { code: 'M25.571', name: 'Pain in right ankle and joints of right foot', bodyPart: 'ANKLE', laterality: 'right' },
  { code: 'M25.572', name: 'Pain in left ankle and joints of left foot', bodyPart: 'ANKLE', laterality: 'left' },

  // ── 通用码 ──
  { code: 'G89.29', name: 'Other chronic pain', bodyPart: null, laterality: null },
] as const

/**
 * ICD code → name 快速查找映射
 */
const CODE_TO_NAME = new Map<string, string>(
  ICD_ENTRIES.map(e => [e.code, e.name])
)

/**
 * 根据 ICD code 获取标准名称
 * 未找到时返回 code 本身作为 fallback (MDLand 接受任意 name)
 */
export function getICDName(code: string): string {
  return CODE_TO_NAME.get(code) ?? code
}

/**
 * 获取完整 ICD 条目
 */
export function getICDEntry(code: string): ICDEntry | undefined {
  return ICD_ENTRIES.find(e => e.code === code)
}

/**
 * 获取所有 ICD 条目
 */
export function getAllICDEntries(): readonly ICDEntry[] {
  return ICD_ENTRIES
}

/**
 * 批量获取 ICD names
 */
export function getICDNames(codes: readonly string[]): Array<{ code: string; name: string }> {
  return codes.map(code => ({
    code,
    name: getICDName(code)
  }))
}

export interface ICDCatalogEntry {
  readonly icd10: string
  readonly desc: string
  readonly bodyPart: string | null
  readonly laterality: string | null
}

export function getICDCatalog(): readonly ICDCatalogEntry[] {
  return ICD_ENTRIES.map(e => ({ icd10: e.code, desc: e.name, bodyPart: e.bodyPart, laterality: e.laterality }))
}
