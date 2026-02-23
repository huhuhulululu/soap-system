<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getICDCatalog } from '../../../../src/shared/icd-catalog'
import { defaultCptStr, is99203Ins, toggle99203 } from '../../../../src/shared/cpt-catalog'

// ── API ──────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || '/api'
function csrfHeader() {
  const m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return m ? { 'x-csrf-token': m[1] } : {}
}

// ── State ────────────────────────────────────────
const step = ref('upload') // 'upload' | 'review' | 'confirmed'
const loading = ref(false)
const error = ref('')

// Mode
const batchMode = ref('full') // 'full' | 'soap-only' | 'continue'

// Realistic Patch toggle (corrected ROM/Strength scores)
const realisticPatch = ref(true)

// Input mode
const inputMode = ref('editor') // 'editor' | 'excel'

// ── Patient Editor ──────────────────────────────
const STORAGE_KEY = 'soap-batch-drafts'
const EMPTY_ROW = () => ({
  name: '', dob: '', gender: '', insurance: 'HF', bodyPart: 'LBP', laterality: '',
  icd: '', cpt: '', totalVisits: 12,
  painWorst: '8', painBest: '3', painCurrent: '6',
  symptomDuration: '3 year(s)', painRadiation: 'without radiation',
  painTypes: 'Dull,Aching', associatedSymptoms: 'soreness',
  causativeFactors: '', relievingFactors: 'Changing positions,Resting',
  symptomScale: '70%-80%', painFrequency: 'Constant',
  secondaryParts: '', history: '', soapText: '',
  chronicityLevel: 'Chronic', recentWorse: '1 week(s)', mode: '', includeIE: true,
})

function normalizeDOB(val) {
  const v = val.trim()
  if (/^\d{8}$/.test(v)) return `${v.slice(0,2)}/${v.slice(2,4)}/${v.slice(4)}`
  if (/^\d{2}-\d{2}-\d{2}$/.test(v)) { const [m,d,y] = v.split('-'); return `${m.padStart(2,'0')}/${d.padStart(2,'0')}/20${y}` }
  if (/^\d{2}-\d{2}-\d{4}$/.test(v)) { const [m,d,y] = v.split('-'); return `${m.padStart(2,'0')}/${d.padStart(2,'0')}/${y}` }
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(v)) { const [m,d,y] = v.split('/'); return `${m}/${d}/20${y}` }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [m,d,y] = v.split('/'); return `${m.padStart(2,'0')}/${d.padStart(2,'0')}/${y}` }
  return v
}

function handleDobBlur() {
  const normalized = normalizeDOB(activeDraft.value.dob)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) updateField('dob', normalized)
  validateField('dob', activeDraft.value.dob)
}

// Body parts matching Writer page (supported by IE+TX templates)
const BATCH_BODY_PARTS = [
  'LBP', 'NECK', 'UPPER_BACK', 'MIDDLE_BACK', 'MID_LOW_BACK',
  'SHOULDER', 'ELBOW', 'WRIST', 'HAND',
  'HIP', 'KNEE', 'ANKLE', 'FOOT',
  'THIGH', 'CALF', 'ARM', 'FOREARM',
]
const BP_LABEL = {
  'MID_LOW_BACK': 'M&L Back',
  'UPPER_BACK': 'Upper Back',
  'MIDDLE_BACK': 'Mid Back',
}

// Body-part-specific radiation (from Writer)
const RADIATION_MAP = {
  'LBP': ['without radiation', 'With radiation to R leg', 'With radiation to L leg', 'with radiation to BLLE'],
  'MID_LOW_BACK': ['without radiation', 'With radiation to R leg', 'With radiation to L leg', 'with radiation to BLLE'],
  'NECK': ['without radiation', 'with radiation to R arm', 'with radiation to L arm', 'with dizziness', 'with headache'],
  'SHOULDER': ['without radiation', 'with radiation to R arm', 'with radiation to L arm'],
  'KNEE': ['without radiation', 'With radiation to R leg', 'With radiation to L leg', 'with local swollen'],
  'ELBOW': ['without radiation', 'with radiation to R arm', 'with radiation to L arm'],
  'MIDDLE_BACK': ['without radiation'],
  'UPPER_BACK': ['without radiation'],
  'HIP': ['without radiation', 'With radiation to R leg', 'With radiation to L leg', 'with radiation to BLLE'],
  'WRIST': ['without radiation', 'with radiation to R arm', 'with radiation to L arm'],
  'HAND': ['without radiation'],
  'ANKLE': ['without radiation', 'With radiation to R leg', 'With radiation to L leg'],
  'FOOT': ['without radiation'],
  'THIGH': ['without radiation', 'With radiation to R leg', 'With radiation to L leg'],
  'CALF': ['without radiation', 'With radiation to R leg', 'With radiation to L leg'],
  'ARM': ['without radiation', 'with radiation to R arm', 'with radiation to L arm'],
  'FOREARM': ['without radiation', 'with radiation to R arm', 'with radiation to L arm'],
}

// Multi-select options (from whitelist.json)
const PAIN_TYPES = ['Dull', 'Burning', 'Shooting', 'Tingling', 'Stabbing', 'Aching', 'Cramping']
const ASSOC_SYMPTOMS = ['soreness', 'stiffness', 'heaviness', 'weakness', 'numbness']
const CAUSATIVE_OPTS = ['age related/degenerative changes', 'weather change', 'poor sleep', 'over used due to heavy household chores', 'prolong sitting', 'prolong walking', 'lifting too much weight', 'Bad Posture', 'recent sprain']
const RELIEVING_OPTS = ['Changing positions', 'Stretching', 'Resting', 'Lying down', 'Applying heating pad', 'Massage', 'Medications']
const SCALE_OPTS = ['90%-100%', '80%-90%', '70%-80%', '60%-70%', '50%-60%', '40%-50%', '30%-40%']

// ICD-10 catalog (from shared module)
const ICD_CATALOG = getICDCatalog()

const icdSearch = ref('')
const icdDropdownOpen = ref(false)

const filteredIcdOptions = computed(() => {
  const bp = activeDraft.value?.bodyPart
  const selected = new Set((activeDraft.value?.icd || '').split(',').map(s => s.trim()).filter(Boolean))
  const available = ICD_CATALOG.filter(item => !selected.has(item.icd10) && (item.bodyPart === null || item.bodyPart === bp))
  if (!icdSearch.value.trim()) return available
  const q = icdSearch.value.toLowerCase()
  return available.filter(item => item.icd10.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
})

function selectIcd(item) {
  const cur = (activeDraft.value.icd || '').split(',').map(s => s.trim()).filter(Boolean)
  if (cur.length >= 4) return
  updateField('icd', [...cur, item.icd10].join(','))
  icdSearch.value = ''
  icdDropdownOpen.value = false
}

function removeIcd(code) {
  const cur = (activeDraft.value.icd || '').split(',').map(s => s.trim()).filter(Boolean)
  updateField('icd', cur.filter(c => c !== code).join(','))
}


const MEDICAL_HISTORY_GROUPS = [
  { label: '心血管', items: ['Hypertension', 'Heart Disease', 'Heart Murmur', 'Pacemaker', 'Stroke', 'Cholesterol', 'Hyperlipidemia'] },
  { label: '代谢/内科', items: ['Diabetes', 'Thyroid', 'Liver Disease', 'Kidney Disease', 'Anemia', 'Asthma', 'Lung Disease', 'stomach trouble', 'Prostate'] },
  { label: '骨骼肌肉', items: ['Herniated Disk', 'Osteoporosis', 'Fractures', 'Joint Replacement', 'Pinched Nerve'] },
  { label: '其他', items: ['Smoking', 'Alcohol', 'Parkinson', 'tinnitus', 'Hysterectomy', 'C-section'] },
]

const historyPanelOpen = ref(false)

const drafts = ref([EMPTY_ROW()])
const activeIndex = ref(0)
const patientBucketOpen = ref(true)
const activeDraft = computed(() => drafts.value[activeIndex.value])

// ── Validation ───────────────────────────────────
const fieldErrors = ref({})
const activeErrors = computed(() => fieldErrors.value[activeIndex.value] || {})

function validateField(key, value) {
  const cur = fieldErrors.value[activeIndex.value] || {}
  let msg
  if (key === 'name') msg = !value.trim() ? 'Name is required' : undefined
  else if (key === 'dob') msg = !/^\d{2}\/\d{2}\/\d{4}$/.test(normalizeDOB(value)) ? 'Format: MM/DD/YYYY, MM-DD-YYYY, MMDDYYYY, or MM/DD/YY' : undefined
  else if (key === 'gender') msg = !value ? 'Select gender' : undefined
  else if (key === 'laterality') msg = !value ? 'Select side' : undefined
  else if (key === 'insurance') msg = !value ? 'Select insurance' : undefined
  else if (key === 'bodyPart') msg = !value ? 'Select body part' : undefined
  else if (key === 'icd') {
    const mode = (activeDraft.value?.mode || batchMode.value)
    msg = mode === 'full' && !value.trim() ? 'At least 1 ICD required in Full mode' : undefined
  }
  const updated = { ...cur }
  if (msg) updated[key] = msg
  else delete updated[key]
  fieldErrors.value = { ...fieldErrors.value, [activeIndex.value]: updated }
}

function clearFieldError(key) {
  const cur = fieldErrors.value[activeIndex.value]
  if (!cur || !cur[key]) return
  const updated = { ...cur }
  delete updated[key]
  fieldErrors.value = { ...fieldErrors.value, [activeIndex.value]: updated }
}

function validateAll() {
  const allErrors = {}
  drafts.value.forEach((d, i) => {
    const e = {}
    if (!d.name.trim()) e.name = 'Name is required'
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(normalizeDOB(d.dob))) e.dob = 'Format: MM/DD/YYYY, MM-DD-YYYY, MMDDYYYY, or MM/DD/YY'
    if (!d.gender) e.gender = 'Select gender'
    if (!d.laterality) e.laterality = 'Select side'
    if (!d.insurance) e.insurance = 'Select insurance'
    if (!d.bodyPart) e.bodyPart = 'Select body part'
    const mode = d.mode || batchMode.value
    if (mode === 'full' && !(d.icd || '').trim()) e.icd = 'At least 1 ICD required in Full mode'
    if (Object.keys(e).length) allErrors[i] = e
  })
  fieldErrors.value = allErrors
  if (Object.keys(allErrors).length) {
    const firstIdx = Number(Object.keys(allErrors)[0])
    if (firstIdx !== activeIndex.value) activeIndex.value = firstIdx
    return false
  }
  return true
}

const activeRadiation = computed(() => RADIATION_MAP[activeDraft.value?.bodyPart] || ['without radiation'])

function toggleCSV(key, val) {
  const cur = (activeDraft.value[key] || '').split(',').map(s => s.trim()).filter(Boolean)
  const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
  updateField(key, next.join(','))
}
function hasCSV(key, val) {
  return (activeDraft.value?.[key] || '').split(',').map(s => s.trim()).includes(val)
}

function loadDrafts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        drafts.value = parsed.map(d => {
          if (d.patient && !d.name) {
            const m = d.patient.match(/^(.+?)\((.+?)\)$/)
            const { patient: _, ...rest } = d
            return m ? { ...rest, name: m[1], dob: m[2] } : { ...rest, name: d.patient, dob: '' }
          }
          return d
        })
        return
      }
    }
  } catch { /* ignore */ }
  drafts.value = [EMPTY_ROW()]
}

let saveTimer = null
function saveDrafts() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.value))
  }, 500)
}
watch(drafts, saveDrafts, { deep: true })

function addPatient() {
  drafts.value = [...drafts.value, EMPTY_ROW()]
  activeIndex.value = drafts.value.length - 1
}

function removePatient(i) {
  if (drafts.value.length <= 1) return
  drafts.value = drafts.value.filter((_, idx) => idx !== i)
  if (activeIndex.value >= drafts.value.length) activeIndex.value = drafts.value.length - 1
}

function duplicatePatient(i) {
  const copy = { ...drafts.value[i] }
  drafts.value = [...drafts.value.slice(0, i + 1), copy, ...drafts.value.slice(i + 1)]
  activeIndex.value = i + 1
}

function movePatient(i, dir) {
  const j = i + dir
  if (j < 0 || j >= drafts.value.length) return
  const arr = [...drafts.value]
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  drafts.value = arr
  activeIndex.value = j
}

function updateField(key, value) {
  drafts.value = drafts.value.map((d, i) => {
    if (i !== activeIndex.value) return d
    const updated = { ...d, [key]: value }
    if (key === 'insurance') updated.cpt = defaultCptStr(value)
    return updated
  })
  clearFieldError(key)
}

function saveAndNext() {
  drafts.value = [...drafts.value, EMPTY_ROW()]
  activeIndex.value = drafts.value.length - 1
}

function editPatient(i) {
  activeIndex.value = i
}

function patientLabel(d, i) {
  return d.name || `Patient ${i + 1}`
}

function patientSummary(d) {
  const modeLabel = d.mode ? `[${d.mode}]` : ''
  const ieLabel = d.includeIE ? 'IE+TX' : 'TX only'
  const parts = [modeLabel, ieLabel, d.insurance, d.bodyPart, d.laterality === 'B' ? 'Bilateral' : d.laterality === 'L' ? 'Left' : 'Right', `${d.totalVisits}v`].filter(Boolean)
  return parts.join(' / ')
}

function clearDrafts() {
  drafts.value = [EMPTY_ROW()]
  activeIndex.value = 0
  localStorage.removeItem(STORAGE_KEY)
}

async function submitDrafts() {
  if (!validateAll()) return
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${API_BASE}/batch/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeader() },
      body: JSON.stringify({ rows: drafts.value.map(d => ({ ...d, patient: `${d.name}(${d.dob})` })), mode: batchMode.value, realisticPatch: realisticPatch.value }),
    })
    const json = await res.json()
    if (!json.success) { error.value = json.error || 'Submit failed'; return }
    batchId.value = json.data.batchId
    await loadBatch(json.data.batchId)
    step.value = 'review'
  } catch (err) {
    error.value = err.message || 'Network error'
  } finally {
    loading.value = false
  }
}

// Upload
const isDragging = ref(false)
const selectedFile = ref(null)
const fileInput = ref(null)

// Batch data
const batchId = ref('')
const batchData = ref(null)
const expandedPatients = ref(new Set())
const expandedVisits = ref(new Set())
const regeneratingVisits = ref(new Set())
const generating = ref(false)

// ── Computed ─────────────────────────────────────
const uploadSummary = computed(() => {
  if (!batchData.value) return null
  return batchData.value.summary
})

const patients = computed(() => {
  if (!batchData.value) return []
  return batchData.value.patients
})

const isSoapOnly = computed(() => {
  if (batchData.value?.mode) return batchData.value.mode === 'soap-only'
  return batchMode.value === 'soap-only'
})

const isContinue = computed(() => {
  if (batchData.value?.mode) return batchData.value.mode === 'continue'
  return batchMode.value === 'continue'
})

const needsGenerateStep = computed(() => isSoapOnly.value || isContinue.value)

const allVisitsGenerated = computed(() => {
  if (!batchData.value) return false
  return batchData.value.patients.every(p =>
    p.visits.every(v => v.generated !== null)
  )
})

// ── Upload ───────────────────────────────────────
function handleDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const files = Array.from(e.dataTransfer.files)
  const xlsxFile = files.find(f =>
    f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
  )
  if (xlsxFile) {
    selectedFile.value = xlsxFile
  } else {
    error.value = 'Please upload an Excel file (.xlsx or .xls)'
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file) {
    selectedFile.value = file
    error.value = ''
  }
  e.target.value = ''
}

function openFilePicker() {
  fileInput.value?.click()
}

function clearFile() {
  selectedFile.value = null
  error.value = ''
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function uploadFile() {
  if (!selectedFile.value) return

  loading.value = true
  error.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('mode', batchMode.value)
    formData.append('realisticPatch', String(realisticPatch.value))

    const res = await fetch(`${API_BASE}/batch`, {
      method: 'POST',
      headers: csrfHeader(),
      body: formData,
    })

    const json = await res.json()

    if (!json.success) {
      error.value = json.error || 'Upload failed'
      return
    }

    batchId.value = json.data.batchId
    await loadBatch(json.data.batchId)
    step.value = 'review'
  } catch (err) {
    error.value = err.message || 'Network error'
  } finally {
    loading.value = false
  }
}

// ── Batch Loading ────────────────────────────────
async function loadBatch(id) {
  const res = await fetch(`${API_BASE}/batch/${id}`)
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'Failed to load batch')
  }
  batchData.value = json.data

  // Auto-expand first patient
  if (json.data.patients.length > 0) {
    expandedPatients.value = new Set([0])
  }
}

// ── Download Template ────────────────────────────
async function downloadTemplate() {
  try {
    const res = await fetch(`${API_BASE}/batch/template/download`)
    if (!res.ok) throw new Error('Template not available')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batch-template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    error.value = err.message || 'Failed to download template'
  }
}

// ── Patient / Visit Toggle ──────────────────────
function togglePatient(index) {
  const next = new Set(expandedPatients.value)
  if (next.has(index)) {
    next.delete(index)
  } else {
    next.add(index)
  }
  expandedPatients.value = next
}

function visitKey(pi, vi) {
  return `${pi}-${vi}`
}

function toggleVisit(pi, vi) {
  const key = visitKey(pi, vi)
  const next = new Set(expandedVisits.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  expandedVisits.value = next
}

// ── Regenerate Single Visit ─────────────────────
async function regenerateVisit(pi, vi) {
  const key = visitKey(pi, vi)
  regeneratingVisits.value = new Set([...regeneratingVisits.value, key])

  try {
    const res = await fetch(
      `${API_BASE}/batch/${batchId.value}/visit/${pi}/${vi}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json', ...csrfHeader() }, body: JSON.stringify({ realisticPatch: realisticPatch.value }) }
    )
    const json = await res.json()
    if (!json.success) {
      error.value = json.error || 'Regeneration failed'
      return
    }

    // Update local state immutably
    const updated = {
      ...batchData.value,
      patients: batchData.value.patients.map((p, i) =>
        i === pi
          ? {
              ...p,
              visits: p.visits.map((v, j) =>
                j === vi ? { ...v, generated: json.data.generated } : v
              ),
            }
          : p
      ),
    }
    batchData.value = updated

    // Auto-expand the visit
    const next = new Set(expandedVisits.value)
    next.add(key)
    expandedVisits.value = next
  } catch (err) {
    error.value = err.message || 'Network error'
  } finally {
    const next = new Set(regeneratingVisits.value)
    next.delete(key)
    regeneratingVisits.value = next
  }
}

// ── Generate All (soap-only mode) ────────────────
async function generateAll() {
  generating.value = true
  error.value = ''

  try {
    const res = await fetch(`${API_BASE}/batch/${batchId.value}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeader() },
      body: JSON.stringify({ realisticPatch: realisticPatch.value }),
    })
    const json = await res.json()
    if (!json.success) {
      error.value = json.error || 'Generation failed'
      return
    }
    await loadBatch(batchId.value)
  } catch (err) {
    error.value = err.message || 'Network error'
  } finally {
    generating.value = false
  }
}

// ── Confirm Batch ────────────────────────────────
async function confirmBatch() {
  loading.value = true
  error.value = ''

  try {
    const res = await fetch(`${API_BASE}/batch/${batchId.value}/confirm`, {
      method: 'POST',
      headers: csrfHeader(),
    })
    const json = await res.json()
    if (!json.success) {
      error.value = json.error || 'Confirm failed'
      return
    }
    batchData.value = { ...batchData.value, confirmed: true }
    step.value = 'confirmed'
    checkCookies()
  } catch (err) {
    error.value = err.message || 'Network error'
  } finally {
    loading.value = false
  }
}

// ── Copy SOAP ────────────────────────────────────
const copiedKey = ref('')

async function copySOAP(pi, vi) {
  const visit = batchData.value.patients[pi].visits[vi]
  if (!visit.generated) return

  try {
    await navigator.clipboard.writeText(visit.generated.fullText)
    copiedKey.value = visitKey(pi, vi)
    setTimeout(() => { copiedKey.value = '' }, 2000)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = visit.generated.fullText
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copiedKey.value = visitKey(pi, vi)
    setTimeout(() => { copiedKey.value = '' }, 2000)
  }
}

// ── Copy All SOAP ────────────────────────────────
const copiedAll = ref(false)

async function copyAllSOAP() {
  if (!batchData.value) return

  const lines = []
  batchData.value.patients.forEach((patient) => {
    patient.visits.forEach((visit) => {
      if (!visit.generated) return
      lines.push(`=== ${patient.name} | DOS #${visit.dos} | ${visit.noteType} ${visit.txNumber ? 'TX' + visit.txNumber : ''} | ${visit.bodyPart} ===`)
      lines.push(visit.generated.fullText)
      lines.push('')
    })
  })

  const text = lines.join('\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copiedAll.value = true
  setTimeout(() => { copiedAll.value = false }, 2000)
}

// ── Reset ────────────────────────────────────────
function resetAll() {
  stopPolling()
  step.value = 'upload'
  batchId.value = ''
  batchData.value = null
  selectedFile.value = null
  expandedPatients.value = new Set()
  expandedVisits.value = new Set()
  regeneratingVisits.value = new Set()
  generating.value = false
  error.value = ''
  copiedKey.value = ''
  copiedAll.value = false
  automationStatus.value = 'idle'
  automationLogs.value = []
  startingAutomation.value = false
  showManualUpload.value = false
  cookiePasteText.value = ''
}

// ── Note Type Badge ──────────────────────────────
function noteTypeBadgeClass(type) {
  if (type === 'IE') return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

// ── Automation ──────────────────────────────────
const cookiesInfo = ref({ exists: false, updatedAt: null })
const cookieFileInput = ref(null)
const uploadingCookies = ref(false)
const automationStatus = ref('idle') // idle | running | done | failed
const automationLogs = ref([])
const automationPolling = ref(null)
const automationPollCount = ref(0)
const startingAutomation = ref(false)

const showManualUpload = ref(false)
const cookiePasteText = ref('')

async function checkCookies() {
  try {
    const res = await fetch(`${API_BASE}/automate/cookies`)
    const json = await res.json()
    if (json.success) {
      cookiesInfo.value = json.data
    }
  } catch { /* ignore */ }
}

function openCookieFilePicker() {
  cookieFileInput.value?.click()
}

async function handleCookieFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''

  uploadingCookies.value = true
  error.value = ''

  try {
    const text = await file.text()
    const json = JSON.parse(text)

    const res = await fetch(`${API_BASE}/automate/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeader() },
      body: JSON.stringify(json),
    })
    const result = await res.json()
    if (!result.success) {
      error.value = result.error || 'Failed to upload cookies'
      return
    }
    cookiesInfo.value = { exists: true, updatedAt: result.data.updatedAt }
  } catch (err) {
    error.value = err.message || 'Invalid JSON file'
  } finally {
    uploadingCookies.value = false
  }
}

async function submitPastedCookies() {
  if (!cookiePasteText.value.trim()) return
  uploadingCookies.value = true
  error.value = ''
  try {
    const json = JSON.parse(cookiePasteText.value)
    const res = await fetch(`${API_BASE}/automate/cookies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...csrfHeader() },
      body: JSON.stringify(json),
    })
    const result = await res.json()
    if (!result.success) {
      error.value = result.error || 'Failed to upload cookies'
      return
    }
    cookiesInfo.value = { exists: true, updatedAt: result.data.updatedAt }
    cookiePasteText.value = ''
    showManualUpload.value = false
  } catch (err) {
    error.value = err.message || 'Invalid JSON'
  } finally {
    uploadingCookies.value = false
  }
}

async function startAutomation() {
  startingAutomation.value = true
  error.value = ''

  try {
    const res = await fetch(`${API_BASE}/automate/${batchId.value}`, {
      method: 'POST',
      headers: csrfHeader(),
    })
    const json = await res.json()
    if (!json.success) {
      error.value = json.error || 'Failed to start automation'
      return
    }
    automationStatus.value = json.data.status
    automationLogs.value = [...json.data.logs]
    startPolling()
  } catch (err) {
    error.value = err.message || 'Network error'
  } finally {
    startingAutomation.value = false
  }
}

async function stopAutomation() {
  try {
    await fetch(`${API_BASE}/automate/${batchId.value}/stop`, { method: 'POST', headers: csrfHeader() })
  } catch { /* ignore */ }
}

function startPolling() {
  stopPolling()
  automationPollCount.value = 0
  automationPolling.value = setInterval(pollStatus, 2000)
}

function stopPolling() {
  if (automationPolling.value) {
    clearInterval(automationPolling.value)
    automationPolling.value = null
  }
}

async function pollStatus() {
  automationPollCount.value++
  if (automationPollCount.value > 300) {
    stopPolling()
    automationStatus.value = 'failed'
    error.value = 'Automation polling timed out (10min)'
    return
  }
  try {
    const res = await fetch(`${API_BASE}/automate/${batchId.value}`)
    const json = await res.json()
    if (!json.success) return

    automationStatus.value = json.data.status
    automationLogs.value = [...json.data.logs]

    if (json.data.status === 'done' || json.data.status === 'failed') {
      stopPolling()
    }
  } catch { /* ignore */ }
}

function formatCookiesDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString()
}

let errorTimer = null
watch(error, (val) => {
  if (errorTimer) clearTimeout(errorTimer)
  if (val) {
    errorTimer = setTimeout(() => { error.value = '' }, 8000)
  }
})

onMounted(() => {
  checkCookies()
  loadDrafts()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8">

    <!-- ════════════ STEP 1: Upload ════════════ -->
    <div v-if="step === 'upload'">

      <!-- Compact Header Bar -->
      <div class="max-w-7xl mx-auto mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h1 class="font-display text-lg font-bold text-ink-800">Batch SOAP</h1>
        <div class="flex items-center gap-2">
          <div class="flex rounded-lg border border-ink-200 overflow-hidden text-xs">
            <button v-for="m in [{k:'full',l:'Full'},{k:'soap-only',l:'SOAP Only'},{k:'continue',l:'Continue'}]" :key="m.k" @click="batchMode = m.k" class="px-3 py-1.5 font-medium transition-colors" :class="batchMode === m.k ? 'bg-ink-800 text-white' : 'bg-white text-ink-500 hover:bg-paper-100'">{{ m.l }}</button>
          </div>
          <span class="text-ink-200">|</span>
          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <button @click="realisticPatch = !realisticPatch" type="button"
              class="relative w-9 h-5 rounded-full transition-colors duration-200 ring-2"
              :class="realisticPatch ? 'bg-green-500 ring-green-300' : 'bg-red-400 ring-red-200'"
              role="switch" :aria-checked="realisticPatch">
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                :class="realisticPatch ? 'translate-x-4' : ''"></span>
            </button>
            <span class="text-xs font-medium" :class="realisticPatch ? 'text-green-600' : 'text-red-500'">
              {{ realisticPatch ? '✓ Realistic' : '✗ Original' }}
            </span>
          </label>
          <span class="text-ink-200">|</span>
          <div class="flex rounded-lg border border-ink-200 overflow-hidden text-xs">
            <button @click="inputMode = 'editor'" class="px-3 py-1.5 font-medium transition-colors" :class="inputMode === 'editor' ? 'bg-ink-100 text-ink-800' : 'text-ink-400 hover:text-ink-600'">Editor</button>
            <button @click="inputMode = 'excel'" class="px-3 py-1.5 font-medium transition-colors" :class="inputMode === 'excel' ? 'bg-ink-100 text-ink-800' : 'text-ink-400 hover:text-ink-600'">Excel</button>
          </div>
        </div>
      </div>

      <!-- MDLand Session (prominent) -->
      <div class="max-w-7xl mx-auto mb-4">
        <div class="flex items-center gap-3 p-3 rounded-xl border" :class="cookiesInfo.exists ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'">
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-sm font-bold" :class="cookiesInfo.exists ? 'text-green-700' : 'text-amber-700'">MDLand Session</span>
            <span v-if="cookiesInfo.exists" class="text-xs text-green-600">Active {{ formatCookiesDate(cookiesInfo.updatedAt) }}</span>
          </div>
          <div v-if="cookiesInfo.exists" class="flex items-center gap-2 ml-auto">
            <svg class="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <span class="text-sm text-green-700">Ready</span>
            <button @click="cookiesInfo = { exists: false, updatedAt: null }" class="text-xs text-green-600 underline ml-2">Re-upload</button>
          </div>
          <div v-else class="flex items-center gap-2 flex-1 min-w-0">
            <input v-model="cookiePasteText" placeholder="Paste cookies JSON..." class="flex-1 px-2 py-1 text-xs font-mono border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400" />
            <button @click="submitPastedCookies" :disabled="uploadingCookies || !cookiePasteText.trim()" class="btn-primary text-xs px-3 py-1" :class="{ 'opacity-60': uploadingCookies || !cookiePasteText.trim() }">{{ uploadingCookies ? '...' : 'Submit' }}</button>
            <button @click="openCookieFilePicker" :disabled="uploadingCookies" class="btn-secondary text-xs px-3 py-1">File</button>
            <input ref="cookieFileInput" type="file" accept=".json" class="hidden" @change="handleCookieFileSelect" />
          </div>
        </div>
      </div>

      <!-- ═══ Patient Editor ═══ -->
      <div v-if="inputMode === 'editor'" class="max-w-7xl mx-auto">

        <!-- Active Patient Form (always on top) -->
        <div v-if="activeDraft" class="card p-4 space-y-3 ring-2 ring-ink-300">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold text-ink-500">Patient {{ activeIndex + 1 }} / {{ drafts.length }}</span>
            <div class="flex items-center gap-3">
              <div class="flex gap-1">
                <button v-for="m in [{k:'full',l:'Full'},{k:'soap-only',l:'SOAP'},{k:'continue',l:'Continue'}]" :key="m.k"
                  @click="updateField('mode', m.k)" type="button"
                  class="px-2 py-1 text-xs font-medium rounded-lg border transition-colors"
                  :class="(activeDraft.mode || batchMode) === m.k ? 'bg-ink-800 text-white border-ink-800' : 'border-ink-200 text-ink-500 hover:border-ink-400'">{{ m.l }}</button>
              </div>
              <label class="flex items-center gap-1.5 cursor-pointer select-none">
                <button @click="updateField('includeIE', !activeDraft.includeIE)" type="button"
                  class="relative w-9 h-5 rounded-full transition-colors duration-200 ring-2"
                  :class="activeDraft.includeIE ? 'bg-green-500 ring-green-300' : 'bg-red-400 ring-red-200'"
                  role="switch" :aria-checked="activeDraft.includeIE">
                  <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                    :class="activeDraft.includeIE ? 'translate-x-4' : ''"></span>
                </button>
                <span class="text-xs font-medium" :class="activeDraft.includeIE ? 'text-green-600' : 'text-red-500'">
                  {{ activeDraft.includeIE ? '✓ 含 IE' : '✗ 无 IE' }}
                </span>
              </label>
            </div>
          </div>

            <!-- Row 1: Identity -->
            <div class="grid grid-cols-2 sm:grid-cols-12 gap-2">
              <div class="sm:col-span-3 col-span-2">
                <label class="text-xs text-ink-500 mb-0.5 block">Name *</label>
                <input :value="activeDraft.name" @input="updateField('name', $event.target.value)" @blur="validateField('name', activeDraft.name)" placeholder="LAST,FIRST" class="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" :class="activeErrors.name ? 'border-red-400' : 'border-ink-200'" />
                <span v-if="activeErrors.name" class="text-xs text-red-500">{{ activeErrors.name }}</span>
              </div>
              <div class="sm:col-span-2 col-span-1">
                <label class="text-xs text-ink-500 mb-0.5 block">DOB *</label>
                <input :value="activeDraft.dob" @input="updateField('dob', $event.target.value)" @blur="handleDobBlur" placeholder="MM/DD/YYYY" class="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" :class="activeErrors.dob ? 'border-red-400' : 'border-ink-200'" />
                <span v-if="activeErrors.dob" class="text-xs text-red-500">{{ activeErrors.dob }}</span>
              </div>
              <div class="sm:col-span-1 col-span-1">
                <label class="text-xs text-ink-500 mb-0.5 block">Gender *</label>
                <div class="flex rounded-lg border overflow-hidden text-xs h-[34px]" :class="activeErrors.gender ? 'border-red-400' : 'border-ink-200'">
                  <button v-for="m in [{k:'M',l:'M'},{k:'F',l:'F'}]" :key="m.k" type="button" @click="updateField('gender', m.k)" class="flex-1 font-medium transition-colors" :class="activeDraft.gender === m.k ? 'bg-ink-800 text-white' : 'bg-white text-ink-500 hover:bg-paper-100'">{{ m.l }}</button>
                </div>
                <span v-if="activeErrors.gender" class="text-xs text-red-500">{{ activeErrors.gender }}</span>
              </div>
              <div class="sm:col-span-2">
                <label class="text-xs text-ink-500 mb-0.5 block">Insurance *</label>
                <select :value="activeDraft.insurance" @change="updateField('insurance', $event.target.value)" class="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" :class="activeErrors.insurance ? 'border-red-400' : 'border-ink-200'">
                  <option v-for="ins in ['HF','OPTUM','WC','VC','ELDERPLAN','NONE']" :key="ins" :value="ins">{{ ins }}</option>
                </select>
                <span v-if="activeErrors.insurance" class="text-xs text-red-500">{{ activeErrors.insurance }}</span>
              </div>
              <div class="sm:col-span-2">
                <label class="text-xs text-ink-500 mb-0.5 block">BodyPart *</label>
                <select :value="activeDraft.bodyPart" @change="updateField('bodyPart', $event.target.value)" class="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" :class="activeErrors.bodyPart ? 'border-red-400' : 'border-ink-200'">
                  <option v-for="bp in BATCH_BODY_PARTS" :key="bp" :value="bp">{{ BP_LABEL[bp] || bp }}</option>
                </select>
                <span v-if="activeErrors.bodyPart" class="text-xs text-red-500">{{ activeErrors.bodyPart }}</span>
              </div>
              <div class="sm:col-span-2 col-span-1">
                <label class="text-xs text-ink-500 mb-0.5 block">Side *</label>
                <div class="flex rounded-lg border overflow-hidden text-xs h-[34px]" :class="activeErrors.laterality ? 'border-red-400' : 'border-ink-200'">
                  <button v-for="m in [{k:'L',l:'Left'},{k:'B',l:'Bil'},{k:'R',l:'Right'}]" :key="m.k" type="button" @click="updateField('laterality', m.k)" class="flex-1 font-medium transition-colors" :class="activeDraft.laterality === m.k ? 'bg-ink-800 text-white' : 'bg-white text-ink-500 hover:bg-paper-100'">{{ m.l }}</button>
                </div>
                <span v-if="activeErrors.laterality" class="text-xs text-red-500">{{ activeErrors.laterality }}</span>
              </div>
            </div>

            <!-- Row 2: Visits + Diagnosis + Chronicity -->
            <div class="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">预约次数 *</label>
                <input type="number" :value="activeDraft.totalVisits" @input="updateField('totalVisits', parseInt($event.target.value) || 1)" min="1" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" />
              </div>
              <div class="col-span-2">
                <label class="text-xs text-ink-500 mb-0.5 block">ICD{{ (activeDraft.mode || batchMode) === 'full' ? ' *' : '' }}</label>
                <div class="flex flex-wrap gap-1 mb-1" v-if="activeDraft.icd">
                  <span v-for="code in activeDraft.icd.split(',').filter(Boolean)" :key="code"
                    class="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full bg-ink-800 text-white">
                    {{ code.trim() }}
                    <button @click="removeIcd(code.trim())" type="button" class="hover:text-red-300">&times;</button>
                  </span>
                </div>
                <div v-if="(activeDraft.icd || '').split(',').filter(Boolean).length < 4" class="relative">
                  <input v-model="icdSearch" @focus="icdDropdownOpen = true" @blur="icdDropdownOpen = false"
                    placeholder="搜索 ICD-10..."
                    class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" />
                  <div v-if="icdDropdownOpen && filteredIcdOptions.length"
                    class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-ink-200 rounded-lg shadow-lg">
                    <button v-for="item in filteredIcdOptions" :key="item.icd10"
                      @mousedown.prevent="selectIcd(item)"
                      class="w-full px-2 py-1.5 text-left text-sm hover:bg-ink-50 flex justify-between">
                      <span class="font-mono text-xs text-ink-600">{{ item.icd10 }}</span>
                      <span class="text-ink-400 truncate ml-2 text-xs">{{ item.desc }}</span>
                    </button>
                  </div>
                </div>
                <span v-if="activeErrors.icd" class="text-xs text-red-500">{{ activeErrors.icd }}</span>
              </div>
              <div class="col-span-2">
                <label class="text-xs text-ink-500 mb-0.5 block">CPT{{ (activeDraft.mode || batchMode) === 'full' ? ' *' : '' }}</label>
                <div class="flex items-center gap-2">
                  <span class="text-sm text-ink-600 font-mono">{{ activeDraft.cpt || defaultCptStr(activeDraft.insurance) }}</span>
                  <button v-if="is99203Ins(activeDraft.insurance)" type="button"
                    @click="updateField('cpt', toggle99203(activeDraft.cpt || defaultCptStr(activeDraft.insurance), activeDraft.insurance))"
                    class="px-2 py-1 text-xs rounded-lg border transition-colors"
                    :class="(activeDraft.cpt || '').includes('99203') ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'">首诊 99203</button>
                </div>
              </div>
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">Chronicity</label>
                <select :value="activeDraft.chronicityLevel" @change="updateField('chronicityLevel', $event.target.value)" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400">
                  <option v-for="c in ['Chronic','Sub Acute','Acute']" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
            </div>

            <!-- Row 3: Pain -->
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">Worst</label>
                <select :value="activeDraft.painWorst" @change="updateField('painWorst', $event.target.value)" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400">
                  <option v-for="n in 10" :key="n" :value="String(11-n)">{{ 11-n }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">Best</label>
                <select :value="activeDraft.painBest" @change="updateField('painBest', $event.target.value)" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400">
                  <option v-for="n in 10" :key="n" :value="String(11-n)">{{ 11-n }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">Current</label>
                <select :value="activeDraft.painCurrent" @change="updateField('painCurrent', $event.target.value)" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400">
                  <option v-for="n in 10" :key="n" :value="String(11-n)">{{ 11-n }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">Frequency</label>
                <select :value="activeDraft.painFrequency" @change="updateField('painFrequency', $event.target.value)" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400">
                  <option v-for="f in ['Constant','Frequent','Occasional','Intermittent']" :key="f" :value="f">{{ f }}</option>
                </select>
              </div>
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">Duration</label>
                <input type="text" :value="activeDraft.symptomDuration" @input="updateField('symptomDuration', $event.target.value)" placeholder="e.g. 3 year(s), several months" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" list="duration-suggestions">
                <datalist id="duration-suggestions">
                  <option v-for="d in ['1 month(s)','2 month(s)','3 month(s)','6 month(s)','1 year(s)','2 year(s)','3 year(s)','5 year(s)','10 year(s)','several months','several years']" :key="d" :value="d"></option>
                </datalist>
              </div>
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">Scale</label>
                <select :value="activeDraft.symptomScale" @change="updateField('symptomScale', $event.target.value)" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400">
                  <option v-for="s in SCALE_OPTS" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
            </div>

            <!-- Row 4: Radiation + RecentWorse -->
            <div class="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <div class="col-span-2">
                <label class="text-xs text-ink-500 mb-0.5 block">Radiation</label>
                <select :value="activeDraft.painRadiation" @change="updateField('painRadiation', $event.target.value)" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400">
                  <option v-for="r in activeRadiation" :key="r" :value="r">{{ r }}</option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="text-xs text-ink-500 mb-0.5 block">Secondary Parts</label>
                <div class="flex flex-wrap gap-1">
                  <button v-for="bp in BATCH_BODY_PARTS.filter(b => b !== activeDraft.bodyPart)" :key="bp" @click="toggleCSV('secondaryParts', bp)" type="button"
                    class="px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs rounded-full border transition-colors"
                    :class="hasCSV('secondaryParts', bp) ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'">{{ BP_LABEL[bp] || bp }}</button>
                </div>
              </div>
              <div>
                <label class="text-xs text-ink-500 mb-0.5 block">RecentWorse</label>
                <input type="text" :value="activeDraft.recentWorse" @input="updateField('recentWorse', $event.target.value)" placeholder="e.g. 1 week(s), several days" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400" list="worse-suggestions">
                <datalist id="worse-suggestions">
                  <option v-for="w in ['1 week(s)','2 week(s)','1 month(s)','2 month(s)','3 month(s)','6 month(s)','several days','several weeks']" :key="w" :value="w"></option>
                </datalist>
              </div>
            </div>

            <!-- Row 5: PainTypes (toggle chips) -->
            <div>
              <label class="text-xs text-ink-500 mb-1 block">Pain Types</label>
              <div class="flex flex-wrap gap-1">
                <button v-for="pt in PAIN_TYPES" :key="pt" @click="toggleCSV('painTypes', pt)" type="button"
                  class="px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs rounded-full border transition-colors"
                  :class="hasCSV('painTypes', pt) ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'">{{ pt }}</button>
              </div>
            </div>

            <!-- Row 6: Associated Symptoms (toggle chips) -->
            <div>
              <label class="text-xs text-ink-500 mb-1 block">Associated Symptoms</label>
              <div class="flex flex-wrap gap-1">
                <button v-for="s in ASSOC_SYMPTOMS" :key="s" @click="toggleCSV('associatedSymptoms', s)" type="button"
                  class="px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs rounded-full border transition-colors"
                  :class="hasCSV('associatedSymptoms', s) ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'">{{ s }}</button>
              </div>
            </div>

            <!-- Row 7: Causative Factors (toggle chips) -->
            <div>
              <label class="text-xs text-ink-500 mb-1 block">Causative Factors</label>
              <div class="flex flex-wrap gap-1">
                <button v-for="c in CAUSATIVE_OPTS" :key="c" @click="toggleCSV('causativeFactors', c)" type="button"
                  class="px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs rounded-full border transition-colors"
                  :class="hasCSV('causativeFactors', c) ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'">{{ c }}</button>
              </div>
            </div>

            <!-- Row 8: Relieving Factors (toggle chips) -->
            <div>
              <label class="text-xs text-ink-500 mb-1 block">Relieving Factors</label>
              <div class="flex flex-wrap gap-1">
                <button v-for="r in RELIEVING_OPTS" :key="r" @click="toggleCSV('relievingFactors', r)" type="button"
                  class="px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs rounded-full border transition-colors"
                  :class="hasCSV('relievingFactors', r) ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'">{{ r }}</button>
              </div>
            </div>

            <!-- Row 9: Medical History (multi-select grouped chips) -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs text-ink-500">History ({{ (activeDraft.history || '').split(',').filter(Boolean).length || 0 }})</label>
                <button @click="historyPanelOpen = !historyPanelOpen" type="button" class="text-xs text-ink-400 hover:text-ink-600">{{ historyPanelOpen ? 'Close' : 'Edit' }}</button>
              </div>
              <div class="flex flex-wrap gap-1 min-h-[1.5rem]">
                <span v-if="!activeDraft.history" class="text-xs text-ink-300 italic">None</span>
                <span v-for="h in (activeDraft.history || '').split(',').filter(Boolean)" :key="h"
                  class="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs rounded-full bg-ink-800 text-white">
                  {{ h.trim() }}
                  <button @click="toggleCSV('history', h.trim())" type="button" class="hover:text-red-300">&times;</button>
                </span>
              </div>
              <div v-if="historyPanelOpen" class="mt-1 border border-ink-200 rounded-lg p-2 bg-paper-50 max-h-48 overflow-y-auto space-y-2">
                <div v-for="group in MEDICAL_HISTORY_GROUPS" :key="group.label">
                  <p class="text-[11px] text-ink-600 font-medium mb-1">{{ group.label }}</p>
                  <div class="flex flex-wrap gap-1">
                    <button v-for="h in group.items" :key="h" @click="toggleCSV('history', h)" type="button"
                      class="px-3 py-1.5 sm:px-2 sm:py-0.5 text-sm sm:text-xs rounded-full border transition-colors"
                      :class="hasCSV('history', h) ? 'bg-ink-800 text-white border-ink-800' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'">{{ h }}</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- SoapText (Continue mode - per patient or global) -->
            <div v-if="activeDraft.mode === 'continue' || (!activeDraft.mode && batchMode === 'continue')">
              <label class="text-xs text-ink-500 mb-0.5 block">SoapText *</label>
              <textarea :value="activeDraft.soapText" @input="updateField('soapText', $event.target.value)" placeholder="Paste existing TX SOAP text..." rows="3" class="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ink-400 resize-y font-mono"></textarea>
            </div>
          </div>

        <!-- Saved Patients Bucket -->
        <div v-if="drafts.length > 1" class="mt-3 card p-2">
          <button @click="patientBucketOpen = !patientBucketOpen" class="w-full flex items-center justify-between px-2 py-1.5 text-sm font-medium text-ink-600 hover:text-ink-800 transition-colors">
            <span>Saved Patients ({{ drafts.length }})</span>
            <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-180': patientBucketOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <div v-if="patientBucketOpen" class="mt-1 space-y-1">
            <div v-for="(d, i) in drafts" :key="i"
              @click="editPatient(i)"
              class="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors"
              :class="i === activeIndex ? 'bg-ink-100 ring-1 ring-ink-300' : 'hover:bg-paper-100'">
              <div class="flex-1 min-w-0">
                <span class="font-medium text-ink-700">{{ patientLabel(d, i) }}</span>
                <span class="ml-2 text-xs text-ink-400">{{ patientSummary(d) }}</span>
              </div>
              <div class="flex items-center gap-1 ml-2">
                <button @click.stop="movePatient(i, -1)" :disabled="i === 0" class="p-0.5 text-ink-300 hover:text-ink-600 disabled:opacity-30" title="Move up">&#9650;</button>
                <button @click.stop="movePatient(i, 1)" :disabled="i === drafts.length - 1" class="p-0.5 text-ink-300 hover:text-ink-600 disabled:opacity-30" title="Move down">&#9660;</button>
                <button @click.stop="duplicatePatient(i)" class="p-0.5 text-ink-300 hover:text-ink-600" title="Duplicate">&#9851;</button>
                <button @click.stop="removePatient(i)" :disabled="drafts.length <= 1" class="p-0.5 text-red-300 hover:text-red-600 disabled:opacity-30" title="Remove">&#10005;</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Submit Bar -->
        <div class="mt-3 flex items-center justify-between">
          <div class="text-sm text-ink-400">{{ drafts.length }} patient{{ drafts.length > 1 ? 's' : '' }}</div>
          <div class="flex gap-2">
            <button @click="clearDrafts" class="text-xs px-3 py-2 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors">Clear All</button>
            <button @click="saveAndNext" class="btn-secondary text-sm">Save & Next</button>
            <button
              @click="submitDrafts"
              :disabled="loading || drafts.length === 0"
              class="btn-primary flex items-center gap-2"
              :class="{ 'opacity-60 cursor-not-allowed': loading }"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
              <span>{{ loading ? 'Generating...' : 'Submit All' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ Excel Upload (backup) ═══ -->
      <div v-if="inputMode === 'excel'" class="max-w-2xl mx-auto">
        <div
          v-if="!selectedFile"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          :class="[
            'card p-12 text-center transition-all duration-300',
            isDragging
              ? 'dropzone-active border-2 border-dashed scale-[1.02]'
              : 'border-2 border-dashed border-ink-200'
          ]"
        >
          <div class="mb-6">
            <div class="w-20 h-20 mx-auto bg-paper-200 rounded-2xl flex items-center justify-center">
              <svg class="w-10 h-10 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          <h2 class="font-display text-2xl font-semibold text-ink-800 mb-2">
            Upload Excel
          </h2>
          <p class="text-ink-500 mb-6">
            Drag and drop your batch Excel file here
          </p>

          <button @click="openFilePicker" class="btn-primary inline-flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Select .xlsx File</span>
          </button>

          <p class="mt-6 text-xs text-ink-400">
            .xlsx or .xls format only
          </p>
        </div>

        <!-- File Selected Preview -->
        <div v-else class="card p-6">
          <div class="flex items-center gap-4">
            <!-- File icon -->
            <div class="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg class="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium text-ink-800 truncate">{{ selectedFile.name }}</p>
              <p class="text-sm text-ink-400">{{ formatFileSize(selectedFile.size) }}</p>
            </div>
            <!-- Remove -->
            <button
              @click="clearFile"
              class="p-2 text-ink-400 hover:text-ink-600 transition-colors rounded-lg hover:bg-ink-100"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Upload Button -->
          <button
            @click="uploadFile"
            :disabled="loading"
            class="mt-4 w-full btn-primary flex items-center justify-center gap-2"
            :class="{ 'opacity-60 cursor-not-allowed': loading }"
          >
            <svg v-if="loading" class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>{{ loading ? 'Generating...' : 'Upload & Generate SOAP' }}</span>
          </button>
        </div>

        <!-- Template Download -->
        <div class="mt-4 text-center">
          <button
            @click="downloadTemplate"
            class="text-sm text-ink-500 hover:text-ink-700 underline underline-offset-2 transition-colors"
          >
            Download Excel Template
          </button>
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept=".xlsx,.xls"
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <!-- ════════════ STEP 2: Review ════════════ -->
    <div v-else-if="step === 'review'">

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="font-display text-2xl font-bold text-ink-800">
            Batch Review
          </h1>
          <p class="text-sm text-ink-400 mt-1">
            Batch ID: {{ batchId }}
            <span
              class="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
              :class="isContinue ? 'bg-teal-100 text-teal-700' : isSoapOnly ? 'bg-purple-100 text-purple-700' : 'bg-ink-100 text-ink-600'"
            >{{ isContinue ? 'Continue' : isSoapOnly ? 'SOAP Only' : 'Full' }}</span>
          </p>
        </div>
        <div class="flex gap-3">
          <!-- Copy All (only when generated) -->
          <button v-if="allVisitsGenerated" @click="copyAllSOAP" class="btn-secondary text-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {{ copiedAll ? 'Copied!' : 'Copy All' }}
          </button>

          <!-- Confirm button -->
          <button
            @click="confirmBatch"
            :disabled="loading || !allVisitsGenerated"
            class="btn-primary text-sm flex items-center gap-2"
            :class="{ 'opacity-60 cursor-not-allowed': loading || !allVisitsGenerated }"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>{{ loading ? 'Confirming...' : 'Confirm Batch' }}</span>
          </button>
        </div>
      </div>

      <!-- Summary Stats -->
      <div v-if="uploadSummary" class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="card p-4 text-center">
          <p class="text-2xl font-bold text-ink-800">{{ uploadSummary.totalPatients }}</p>
          <p class="text-xs text-ink-400 mt-1">Patients</p>
        </div>
        <div class="card p-4 text-center">
          <p class="text-2xl font-bold text-ink-800">{{ uploadSummary.totalVisits }}</p>
          <p class="text-xs text-ink-400 mt-1">Total Visits</p>
        </div>
        <div class="card p-4 text-center">
          <p class="text-2xl font-bold text-blue-600">{{ uploadSummary.byType?.IE || 0 }}</p>
          <p class="text-xs text-ink-400 mt-1">IE Notes</p>
        </div>
        <div class="card p-4 text-center">
          <p class="text-2xl font-bold text-amber-600">{{ uploadSummary.byType?.TX || 0 }}</p>
          <p class="text-xs text-ink-400 mt-1">TX Notes</p>
        </div>
      </div>

      <!-- Patient List -->
      <div class="space-y-4">
        <div
          v-for="(patient, pi) in patients"
          :key="pi"
          class="card overflow-hidden"
        >
          <!-- Patient Header -->
          <button
            @click="togglePatient(pi)"
            class="w-full flex items-center justify-between p-4 hover:bg-paper-100 transition-colors text-left"
          >
            <div class="flex items-center gap-3">
              <!-- Patient Icon -->
              <div class="w-10 h-10 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0">
                <span class="text-sm font-bold text-ink-600">{{ patient.name.charAt(0) }}</span>
              </div>
              <div>
                <p class="font-semibold text-ink-800">{{ patient.name }}</p>
                <p class="text-xs text-ink-400">
                  {{ patient.age }}y {{ patient.gender }} &middot;
                  DOB: {{ patient.dob }} &middot;
                  {{ patient.insurance }} &middot;
                  {{ patient.visits.length }} visit{{ patient.visits.length > 1 ? 's' : '' }}
                </p>
              </div>
            </div>
            <!-- Chevron -->
            <svg
              class="w-5 h-5 text-ink-400 transition-transform duration-200"
              :class="{ 'rotate-180': expandedPatients.has(pi) }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Visits -->
          <div v-if="expandedPatients.has(pi)" class="border-t border-ink-100">
            <div
              v-for="(visit, vi) in patient.visits"
              :key="vi"
              class="border-b border-ink-50 last:border-b-0"
            >
              <!-- Visit Header -->
              <div class="flex items-center justify-between px-4 py-3 bg-paper-50">
                <button
                  @click="toggleVisit(pi, vi)"
                  class="flex items-center gap-3 text-left flex-1"
                >
                  <!-- Visit number -->
                  <span class="w-6 h-6 rounded-full bg-ink-200 text-ink-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {{ vi + 1 }}
                  </span>
                  <div class="flex items-center gap-2 flex-wrap">
                    <!-- Note type badge -->
                    <span
                      class="text-xs font-semibold px-2 py-0.5 rounded border"
                      :class="noteTypeBadgeClass(visit.noteType)"
                    >
                      {{ visit.noteType }}{{ visit.txNumber ? ` TX${visit.txNumber}` : '' }}
                    </span>
                    <!-- Body part -->
                    <span class="text-sm text-ink-600">{{ visit.bodyPart }}</span>
                    <span class="text-xs text-ink-400">{{ visit.laterality }}</span>
                    <!-- ICD codes -->
                    <span
                      v-if="!isSoapOnly"
                      v-for="icd in visit.icdCodes"
                      :key="icd.code"
                      class="text-xs text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded"
                    >
                      {{ icd.code }}
                    </span>
                  </div>
                </button>
                <div class="flex items-center gap-2 ml-4 flex-shrink-0">
                  <!-- Status indicator -->
                  <span
                    v-if="visit.generated"
                    class="w-2 h-2 rounded-full bg-green-500"
                    title="Generated"
                  ></span>
                  <span
                    v-else
                    class="w-2 h-2 rounded-full bg-red-400"
                    title="Not generated"
                  ></span>
                  <!-- Regenerate -->
                  <button
                    @click.stop="regenerateVisit(pi, vi)"
                    :disabled="regeneratingVisits.has(visitKey(pi, vi))"
                    class="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-ink-100 rounded-lg transition-colors"
                    :class="{ 'animate-spin': regeneratingVisits.has(visitKey(pi, vi)) }"
                    title="Regenerate"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <!-- Copy -->
                  <button
                    v-if="visit.generated"
                    @click.stop="copySOAP(pi, vi)"
                    class="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-ink-100 rounded-lg transition-colors"
                    :title="copiedKey === visitKey(pi, vi) ? 'Copied!' : 'Copy SOAP'"
                  >
                    <svg v-if="copiedKey === visitKey(pi, vi)" class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- SOAP Content (Expanded) -->
              <div v-if="expandedVisits.has(visitKey(pi, vi)) && visit.generated" class="px-4 py-3 bg-white">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div v-for="section in ['subjective', 'objective', 'assessment', 'plan']" :key="section">
                    <h4 class="text-xs font-bold text-ink-500 uppercase tracking-wider mb-1">
                      {{ section.charAt(0).toUpperCase() + section.slice(1) }}
                    </h4>
                    <div class="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap bg-paper-50 rounded-lg p-3 border border-ink-50 max-h-60 overflow-y-auto font-mono text-xs">{{ visit.generated.soap[section] }}</div>
                  </div>
                </div>
                <!-- CPT codes -->
                <div v-if="!isSoapOnly && !isContinue && visit.cptCodes && visit.cptCodes.length > 0" class="mt-3 flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-semibold text-ink-500">CPT:</span>
                  <span
                    v-for="cpt in visit.cptCodes"
                    :key="cpt.code"
                    class="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200"
                  >
                    {{ cpt.code }} &times;{{ cpt.units }}
                  </span>
                </div>
              </div>

              <!-- Not generated message -->
              <div v-if="expandedVisits.has(visitKey(pi, vi)) && !visit.generated" class="px-4 py-6 bg-white text-center">
                <p class="text-sm text-ink-400">SOAP not generated. Click regenerate to try again.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Back button -->
      <div class="mt-6 text-center">
        <button @click="resetAll" class="text-sm text-ink-400 hover:text-ink-600 transition-colors">
          &larr; Start New Batch
        </button>
      </div>
    </div>

    <!-- ════════════ STEP 3: Confirmed + Automation ════════════ -->
    <div v-else-if="step === 'confirmed'" class="max-w-3xl mx-auto py-8">

      <!-- Confirmed Header -->
      <div class="text-center mb-8">
        <div class="w-16 h-16 mx-auto bg-green-50 rounded-2xl flex items-center justify-center mb-4">
          <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="font-display text-2xl font-bold text-ink-800 mb-1">Batch Confirmed</h2>
        <p class="text-ink-500">
          {{ uploadSummary?.totalPatients }} patients, {{ uploadSummary?.totalVisits }} visits
        </p>
        <p class="text-xs text-ink-400 mt-1">Batch ID: {{ batchId }}</p>
      </div>

      <!-- Quick Actions -->
      <div class="flex justify-center gap-3 mb-8">
        <button @click="copyAllSOAP" class="btn-secondary text-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {{ copiedAll ? 'Copied!' : 'Copy All SOAP' }}
        </button>
        <button @click="resetAll" class="btn-secondary text-sm">
          New Batch
        </button>
      </div>

      <!-- ═══ MDLand Automation Panel ═══ -->
      <div v-if="!isSoapOnly" class="card p-6">
        <h3 class="font-display text-lg font-bold text-ink-800 mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Push to MDLand
        </h3>

        <!-- Step 1: Login to MDLand -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-ink-700">1. Login to MDLand</p>
            <span
              v-if="cookiesInfo.exists"
              class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
            >
              Session active {{ formatCookiesDate(cookiesInfo.updatedAt) }}
            </span>
            <span v-else class="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Not logged in
            </span>
          </div>

          <!-- Login Success State -->
          <div v-if="cookiesInfo.exists" class="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200 mb-3">
            <svg class="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <p class="text-sm text-green-700">MDLand session ready</p>
            <button
              @click="cookiesInfo = { exists: false, updatedAt: null }"
              class="ml-auto text-xs text-green-600 hover:text-green-800 underline"
            >Re-upload</button>
          </div>

          <!-- Cookie Upload -->
          <div v-if="!cookiesInfo.exists" class="space-y-3">
            <p class="text-xs text-ink-400 mb-2">
              Paste cookies JSON or upload a file.
            </p>
            <textarea
              v-model="cookiePasteText"
              placeholder='{"cookies":[...],"origins":[...]}'
              rows="4"
              class="w-full px-3 py-2 text-xs font-mono border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-400 resize-y"
            ></textarea>
            <div class="flex gap-2">
              <button
                @click="submitPastedCookies"
                :disabled="uploadingCookies || !cookiePasteText.trim()"
                class="btn-primary text-xs flex-1"
                :class="{ 'opacity-60': uploadingCookies || !cookiePasteText.trim() }"
              >
                {{ uploadingCookies ? 'Uploading...' : 'Submit' }}
              </button>
              <button
                @click="openCookieFilePicker"
                :disabled="uploadingCookies"
                class="btn-secondary text-xs"
              >
                Upload File
              </button>
            </div>
            <input
              ref="cookieFileInput"
              type="file"
              accept=".json"
              class="hidden"
              @change="handleCookieFileSelect"
            />
          </div>
        </div>

        <!-- Divider -->
        <hr class="border-ink-100 mb-6" />

        <!-- Step 2: Start Automation -->
        <div class="mb-6">
          <p class="text-sm font-medium text-ink-700 mb-2">2. Run Automation</p>
          <p class="text-xs text-ink-400 mb-3">
            Headless Chromium will fill SOAP, ICD/CPT, and generate billing in MDLand.
          </p>

          <!-- Start / Stop buttons -->
          <div class="flex gap-3">
            <button
              v-if="automationStatus !== 'running'"
              @click="startAutomation"
              :disabled="!cookiesInfo.exists || startingAutomation"
              class="btn-primary text-sm flex items-center gap-2"
              :class="{ 'opacity-60 cursor-not-allowed': !cookiesInfo.exists || startingAutomation }"
            >
              <svg v-if="startingAutomation" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ startingAutomation ? 'Starting...' : automationStatus === 'done' || automationStatus === 'failed' ? 'Restart' : 'Start Automation' }}
            </button>

            <button
              v-if="automationStatus === 'running'"
              @click="stopAutomation"
              class="btn-secondary text-sm flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop
            </button>
          </div>

          <p v-if="!cookiesInfo.exists" class="text-xs text-amber-500 mt-2">
            Login to MDLand first before starting automation.
          </p>
        </div>

        <!-- Status Badge -->
        <div v-if="automationStatus !== 'idle'" class="mb-4">
          <div class="flex items-center gap-2">
            <span
              class="text-xs font-semibold px-2.5 py-1 rounded-full"
              :class="{
                'bg-blue-100 text-blue-700': automationStatus === 'running',
                'bg-green-100 text-green-700': automationStatus === 'done',
                'bg-red-100 text-red-700': automationStatus === 'failed',
              }"
            >
              <span v-if="automationStatus === 'running'" class="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1.5 animate-pulse"></span>
              {{ automationStatus === 'running' ? 'Running' : automationStatus === 'done' ? 'Completed' : 'Failed' }}
            </span>
          </div>
        </div>

        <!-- Logs -->
        <div v-if="automationLogs.length > 0" class="bg-ink-900 rounded-lg p-4 max-h-80 overflow-y-auto">
          <p class="text-xs text-ink-400 mb-2 font-semibold uppercase tracking-wider">Logs</p>
          <div class="space-y-0.5">
            <p
              v-for="(log, i) in automationLogs"
              :key="i"
              class="text-xs font-mono leading-relaxed"
              :class="log.includes('[stderr]') || log.includes('Failed') || log.includes('error') ? 'text-red-400' : log.includes('Completed') || log.includes('saved') || log.includes('Success') ? 'text-green-400' : 'text-ink-300'"
            >{{ log }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ════════════ Error Toast ════════════ -->
    <div
      v-if="error"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-lg w-full px-4"
    >
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-lg flex items-center justify-between gap-3 animate-slide-up">
        <p class="text-sm">{{ error }}</p>
        <button @click="error = ''" class="text-red-400 hover:text-red-600 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

  </div>
</template>
