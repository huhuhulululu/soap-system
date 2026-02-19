/**
 * 批量压力测试 - 混合 full / soap-only / continue 三种模式
 *
 * Usage: npx tsx scripts/stress-test.ts [patientsPerMode] [baseUrl]
 * Default: 20 patients per mode, https://ac.aanao.cc
 */

const PATIENTS_PER_MODE = parseInt(process.argv[2] || '20', 10)
const BASE = process.argv[3] || 'https://ac.aanao.cc'

// ── Random helpers ──

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

// IE ∩ TX (full mode needs both)
const FULL_BODY_PARTS = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW', 'MID_LOW_BACK'] as const
// TX-only supported (soap-only mode only generates TX)
const TX_BODY_PARTS = ['LBP', 'NECK', 'SHOULDER', 'KNEE', 'ELBOW', 'MID_LOW_BACK', 'MIDDLE_BACK'] as const
const LATERALITIES = ['L', 'R', 'B'] as const
const INSURANCES = ['HF', 'OPTUM', 'WC', 'VC', 'ELDERPLAN'] as const
const CHRONICITY = ['Acute', 'Sub Acute', 'Chronic'] as const
const PAIN_TYPES = ['Dull', 'Aching', 'Sharp', 'Stabbing', 'Burning', 'Throbbing'] as const
const ASSOC_SYMPTOMS = ['soreness', 'weakness', 'stiffness', 'heaviness', 'numbness'] as const
const DURATIONS = ['3 year(s)', '6 month(s)', '2 week(s)', '1 year(s)', '5 month(s)'] as const
const RECENT_WORSE = ['1 week(s)', '2 week(s)', '3 day(s)', '1 month(s)'] as const
const NAMES = [
  'John Smith', 'Jane Doe', 'Alice Wang', 'Bob Chen', 'Mary Li',
  'Tom Zhang', 'Lucy Liu', 'David Kim', 'Sarah Park', 'Mike Wu',
  'Emma Lee', 'James Xu', 'Olivia Tan', 'William Ma', 'Sophia Ng',
  'Daniel Cho', 'Grace Lin', 'Kevin Hu', 'Helen Ye', 'Peter Gao',
]

const ICD_MAP: Record<string, string> = {
  LBP: 'M54.5', NECK: 'M54.2', SHOULDER: 'M25.519', KNEE: 'M25.569',
  ELBOW: 'M25.529', ANKLE: 'M25.579', WRIST: 'M25.539',
  UPPER_BACK: 'M54.6', MIDDLE_BACK: 'M54.6',
}

function randomDOB(): string {
  const year = randInt(1950, 1995)
  const month = String(randInt(1, 12)).padStart(2, '0')
  const day = String(randInt(1, 28)).padStart(2, '0')
  return `${month}/${day}/${year}`
}

function makeFullRow(idx: number) {
  const bp = pick(FULL_BODY_PARTS)
  const pw = randInt(6, 10)
  const pb = randInt(1, 4)
  const pc = randInt(pb + 1, pw)
  return {
    patient: `${pick(NAMES)}${idx}(${randomDOB()})`,
    gender: pick(['M', 'F'] as const),
    insurance: pick(INSURANCES),
    bodyPart: bp,
    laterality: pick(LATERALITIES),
    icd: ICD_MAP[bp] || 'M54.5',
    cpt: '',
    totalVisits: randInt(4, 12),
    painWorst: String(pw),
    painBest: String(pb),
    painCurrent: String(pc),
    symptomDuration: pick(DURATIONS),
    painRadiation: pick(['without radiation', 'with radiation to the left leg', 'with radiation to the right arm']),
    painTypes: [pick(PAIN_TYPES), pick(PAIN_TYPES)].join(','),
    associatedSymptoms: pick(ASSOC_SYMPTOMS),
    causativeFactors: 'age related/degenerative changes',
    relievingFactors: 'Changing positions,Resting',
    symptomScale: `${randInt(50, 90)}%`,
    painFrequency: pick(['CONSTANT', 'FREQUENT', 'OCCASIONAL', 'INTERMITTENT']),
    secondaryParts: '',
    history: pick(['', 'Hypertension', 'Diabetes', 'Hypertension,Diabetes']),
    soapText: '',
    chronicityLevel: pick(CHRONICITY),
    recentWorse: pick(RECENT_WORSE),
  }
}

function makeSoapOnlyRow(idx: number) {
  const row = makeFullRow(idx)
  return { ...row, bodyPart: pick(TX_BODY_PARTS), icd: '' }
}

// Minimal TX SOAP text that tx-extractor can parse
const SAMPLE_TX_SOAP = `SUBJECTIVE:
Patient returns for follow-up acupuncture treatment for bilateral lower back pain.
The patient reports Dull, Aching pain for 3 years due to age related/degenerative changes.
Pain Scale: 6/10. Pain frequency: Frequent.
The patient rates the overall symptom scale as 65%.
Pain is without radiation, associated with muscles soreness.
Symptoms are relieved by Changing positions, Resting, Massage.

OBJECTIVE:
Muscle Tightness: Quadratus Lumborum, Erector Spinae, Piriformis
Grading Scale: moderate
Muscle Tenderness: Quadratus Lumborum (+3), Erector Spinae (+2)
Muscle Spasm: Frequency Grading Scale: (+2)
ROM: Flexion 4/5 60°, Extension 4/5 20°
Tongue: Pale with thin white coating
Pulse: Wiry, thin

ASSESSMENT:
TCM Diagnosis: Patient still has Qi Stagnation in local lower back area.
Treatment Principles: Focus on resolving Qi Stagnation, harmonize Kidney Yang Deficiency.

PLAN:
Acupuncture treatment with electrical stimulation.
Points: BL23, BL25, BL40, GB30, KI3, SP6, DU4`

function makeContinueRow(idx: number) {
  return {
    patient: `${pick(NAMES)}C${idx}(${randomDOB()})`,
    gender: pick(['M', 'F'] as const),
    insurance: pick(INSURANCES),
    bodyPart: '',
    laterality: '',
    icd: '',
    cpt: '',
    totalVisits: randInt(3, 8),
    painWorst: '', painBest: '', painCurrent: '',
    symptomDuration: '', painRadiation: '', painTypes: '',
    associatedSymptoms: '', causativeFactors: '', relievingFactors: '',
    symptomScale: '', painFrequency: '',
    secondaryParts: '', history: '',
    soapText: SAMPLE_TX_SOAP,
    chronicityLevel: pick(CHRONICITY),
    recentWorse: pick(RECENT_WORSE),
  }
}

// ── HTTP helpers ──

async function post(path: string, body: unknown): Promise<{ status: number; data: unknown; ms: number }> {
  const t0 = Date.now()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return { status: res.status, data, ms: Date.now() - t0 }
}

async function get(path: string): Promise<{ status: number; data: unknown; ms: number }> {
  const t0 = Date.now()
  const res = await fetch(`${BASE}${path}`)
  const data = await res.json()
  return { status: res.status, data, ms: Date.now() - t0 }
}

// ── Test runners ──

interface TestResult {
  mode: string
  patients: number
  visits: number
  generated: number
  failed: number
  uploadMs: number
  generateMs: number
  fetchMs: number
  error?: string
}

async function testMode(mode: string, rows: unknown[]): Promise<TestResult> {
  const result: TestResult = {
    mode, patients: rows.length, visits: 0,
    generated: 0, failed: 0, uploadMs: 0, generateMs: 0, fetchMs: 0,
  }

  try {
    // Step 1: Upload
    const upload = await post('/api/batch/json', { rows, mode })
    result.uploadMs = upload.ms

    if (upload.status !== 200) {
      result.error = `Upload failed: ${JSON.stringify(upload.data)}`
      return result
    }

    const uploadData = upload.data as { success: boolean; data: { batchId: string; totalVisits: number; totalGenerated: number; totalFailed: number } }
    if (!uploadData.success) {
      result.error = `Upload not success: ${JSON.stringify(uploadData)}`
      return result
    }

    const { batchId, totalVisits } = uploadData.data
    result.visits = totalVisits

    // Step 2: For full mode, generation happens in upload. For soap-only/continue, trigger separately.
    if (mode === 'full') {
      result.generated = uploadData.data.totalGenerated
      result.failed = uploadData.data.totalFailed
      result.generateMs = 0
    } else {
      const gen = await post(`/api/batch/${batchId}/generate`, {})
      result.generateMs = gen.ms
      const genData = gen.data as { success: boolean; data: { totalGenerated: number; totalFailed: number } }
      if (!genData.success) {
        result.error = `Generate failed: ${JSON.stringify(genData)}`
        return result
      }
      result.generated = genData.data.totalGenerated
      result.failed = genData.data.totalFailed
    }

    // Step 3: Fetch batch to verify SOAP content
    const detail = await get(`/api/batch/${batchId}`)
    result.fetchMs = detail.ms

    if (detail.status !== 200) {
      result.error = `Fetch failed: ${detail.status}`
      return result
    }

    // Verify all visits have SOAP text
    const batch = (detail.data as { data: { patients: Array<{ visits: Array<{ generated: { fullText: string } | null; status: string }> }> } }).data
    let emptyCount = 0
    for (const p of batch.patients) {
      for (const v of p.visits) {
        if (v.status === 'done' && (!v.generated || !v.generated.fullText)) emptyCount++
      }
    }
    if (emptyCount > 0) result.error = `${emptyCount} visits done but empty SOAP`

  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
  }

  return result
}

// ── Main ──

async function main() {
  console.log(`\n=== SOAP Batch Stress Test ===`)
  console.log(`Target: ${BASE}`)
  console.log(`Patients per mode: ${PATIENTS_PER_MODE}`)
  console.log(`Total patients: ${PATIENTS_PER_MODE * 3}\n`)

  // Build rows
  const fullRows = Array.from({ length: PATIENTS_PER_MODE }, (_, i) => makeFullRow(i))
  const soapRows = Array.from({ length: PATIENTS_PER_MODE }, (_, i) => makeSoapOnlyRow(i))
  const contRows = Array.from({ length: PATIENTS_PER_MODE }, (_, i) => makeContinueRow(i))

  // Run all 3 modes in parallel
  console.log('Running all 3 modes in parallel...\n')
  const t0 = Date.now()

  const [fullResult, soapResult, contResult] = await Promise.all([
    testMode('full', fullRows),
    testMode('soap-only', soapRows),
    testMode('continue', contRows),
  ])

  const totalMs = Date.now() - t0

  // Print results
  const results = [fullResult, soapResult, contResult]
  console.log('─'.repeat(80))
  console.log(
    'Mode'.padEnd(12),
    'Patients'.padEnd(10),
    'Visits'.padEnd(8),
    'OK'.padEnd(6),
    'Fail'.padEnd(6),
    'Upload'.padEnd(10),
    'Generate'.padEnd(10),
    'Fetch'.padEnd(10),
    'Error',
  )
  console.log('─'.repeat(80))

  for (const r of results) {
    console.log(
      r.mode.padEnd(12),
      String(r.patients).padEnd(10),
      String(r.visits).padEnd(8),
      String(r.generated).padEnd(6),
      String(r.failed).padEnd(6),
      `${r.uploadMs}ms`.padEnd(10),
      `${r.generateMs}ms`.padEnd(10),
      `${r.fetchMs}ms`.padEnd(10),
      r.error || '✓',
    )
  }

  console.log('─'.repeat(80))

  const totalGen = results.reduce((s, r) => s + r.generated, 0)
  const totalFail = results.reduce((s, r) => s + r.failed, 0)
  const totalVisits = results.reduce((s, r) => s + r.visits, 0)
  const hasErrors = results.some(r => r.error)

  console.log(`\nTotal: ${totalVisits} visits, ${totalGen} generated, ${totalFail} failed`)
  console.log(`Wall time: ${totalMs}ms (${(totalMs / 1000).toFixed(1)}s)`)
  console.log(`Throughput: ${((totalGen / totalMs) * 1000).toFixed(1)} visits/sec`)
  console.log(`\nResult: ${hasErrors ? '⚠ SOME ERRORS' : '✓ ALL PASSED'}\n`)

  process.exit(hasErrors ? 1 : 0)
}

main()
