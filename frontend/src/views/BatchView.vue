<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// ── API ──────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// ── State ────────────────────────────────────────
const step = ref('upload') // 'upload' | 'review' | 'confirmed'
const loading = ref(false)
const error = ref('')

// Mode
const batchMode = ref('full') // 'full' | 'soap-only'

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

    const res = await fetch(`${API_BASE}/batch`, {
      method: 'POST',
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
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
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
  stopLoginPolling()
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
  if (!rememberCredentials.value) {
    mdlandUsername.value = ''
    mdlandPassword.value = ''
  }
  loginStatus.value = 'idle'
  loginError.value = ''
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

// ── Login ────────────────────────────────────────
const mdlandUsername = ref('')
const mdlandPassword = ref('')
const rememberCredentials = ref(false)
const loginStatus = ref('idle') // idle | logging_in | done | failed
const loginError = ref('')
const loginPolling = ref(null)
const loginPollCount = ref(0)
const showManualUpload = ref(false)
const mdlandTab = ref('login')
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

async function loginMDLand() {
  if (!mdlandUsername.value || !mdlandPassword.value) {
    error.value = 'Please enter username and password'
    return
  }

  loginStatus.value = 'logging_in'
  loginError.value = ''
  error.value = ''

  try {
    const res = await fetch(`${API_BASE}/automate/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: mdlandUsername.value,
        password: mdlandPassword.value,
      }),
    })
    const json = await res.json()
    if (!json.success) {
      loginStatus.value = 'failed'
      loginError.value = json.error || 'Login request failed'
      return
    }
    if (rememberCredentials.value) {
      localStorage.setItem('mdland_credentials', JSON.stringify({ u: mdlandUsername.value, p: mdlandPassword.value }))
    } else {
      localStorage.removeItem('mdland_credentials')
      mdlandPassword.value = ''
    }
    // Start polling login status
    startLoginPolling()
  } catch (err) {
    loginStatus.value = 'failed'
    loginError.value = err.message || 'Network error'
  }
}

function startLoginPolling() {
  stopLoginPolling()
  loginPollCount.value = 0
  loginPolling.value = setInterval(pollLoginStatus, 1500)
}

function stopLoginPolling() {
  if (loginPolling.value) {
    clearInterval(loginPolling.value)
    loginPolling.value = null
  }
}

async function pollLoginStatus() {
  loginPollCount.value++
  if (loginPollCount.value > 40) {
    stopLoginPolling()
    loginStatus.value = 'failed'
    loginError.value = 'Login timed out (60s). Please try again.'
    return
  }
  try {
    const res = await fetch(`${API_BASE}/automate/login/status`)
    const json = await res.json()
    if (!json.success) return

    loginStatus.value = json.data.status

    if (json.data.status === 'done') {
      stopLoginPolling()
      cookiesInfo.value = json.data.cookies
    } else if (json.data.status === 'failed') {
      stopLoginPolling()
      loginError.value = json.data.error || 'Login failed'
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    await fetch(`${API_BASE}/automate/${batchId.value}/stop`, { method: 'POST' })
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
  const saved = localStorage.getItem('mdland_credentials')
  if (saved) {
    try {
      const { u, p } = JSON.parse(saved)
      mdlandUsername.value = u || ''
      mdlandPassword.value = p || ''
      rememberCredentials.value = true
    } catch { /* ignore */ }
  }
})

onUnmounted(() => {
  stopPolling()
  stopLoginPolling()
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-6 py-8">

    <!-- ════════════ STEP 1: Upload ════════════ -->
    <div v-if="step === 'upload'">

      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="font-display text-3xl font-bold text-ink-800 mb-2">
          Batch SOAP
        </h1>
        <p class="text-ink-500">
          Upload an Excel file to batch generate SOAP notes
        </p>
      </div>

      <!-- Mode Selector -->
      <div class="max-w-2xl mx-auto mb-6">
        <div class="flex rounded-xl border border-ink-200 overflow-hidden">
          <button
            @click="batchMode = 'full'"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
            :class="batchMode === 'full' ? 'bg-ink-800 text-white' : 'bg-white text-ink-600 hover:bg-paper-100'"
          >
            Full Batch
            <span class="block text-xs mt-0.5 opacity-70">SOAP + ICD + CPT + Billing</span>
          </button>
          <button
            @click="batchMode = 'soap-only'"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
            :class="batchMode === 'soap-only' ? 'bg-ink-800 text-white' : 'bg-white text-ink-600 hover:bg-paper-100'"
          >
            SOAP Only
            <span class="block text-xs mt-0.5 opacity-70">Generate SOAP notes only</span>
          </button>
        </div>
      </div>

      <!-- Upload Zone -->
      <div class="max-w-2xl mx-auto">
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

      <!-- ═══ MDLand Session ═══ -->
      <div class="max-w-2xl mx-auto mt-8">
        <div class="card p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold text-ink-700">MDLand Session</h3>
            <span v-if="cookiesInfo.exists" class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              Active {{ formatCookiesDate(cookiesInfo.updatedAt) }}
            </span>
            <span v-else class="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Not connected</span>
          </div>

          <!-- Already connected -->
          <div v-if="cookiesInfo.exists && loginStatus !== 'logging_in'" class="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200 text-sm text-green-700">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            Session ready
            <button @click="loginStatus = 'idle'; cookiesInfo = { exists: false, updatedAt: null }" class="ml-auto text-xs underline">Re-login</button>
          </div>

          <!-- Login + Cookie tabs -->
          <div v-else>
            <div class="flex border-b border-ink-100 mb-3">
              <button @click="mdlandTab = 'login'" class="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors" :class="mdlandTab === 'login' ? 'border-ink-700 text-ink-800' : 'border-transparent text-ink-400'">Account Login</button>
              <button @click="mdlandTab = 'cookie'" class="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors" :class="mdlandTab === 'cookie' ? 'border-ink-700 text-ink-800' : 'border-transparent text-ink-400'">Cookie Upload</button>
            </div>

            <!-- Tab: Login -->
            <div v-if="mdlandTab === 'login'" class="space-y-2">
              <input v-model="mdlandUsername" type="text" placeholder="Username" :disabled="loginStatus === 'logging_in'" class="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-400" />
              <input v-model="mdlandPassword" type="password" placeholder="Password" :disabled="loginStatus === 'logging_in'" class="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-400" @keydown.enter="loginMDLand" />
              <label class="flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer select-none">
                <input v-model="rememberCredentials" type="checkbox" class="rounded" />
                Remember credentials
              </label>
              <button @click="loginMDLand" :disabled="loginStatus === 'logging_in' || !mdlandUsername || !mdlandPassword" class="btn-primary text-sm w-full" :class="{ 'opacity-60': loginStatus === 'logging_in' || !mdlandUsername || !mdlandPassword }">
                {{ loginStatus === 'logging_in' ? 'Logging in...' : 'Login' }}
              </button>
              <p v-if="loginError" class="text-xs text-red-600">{{ loginError }}</p>
              <div v-if="loginStatus === 'logging_in'" class="flex items-center gap-2 text-xs text-blue-600">
                <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>Connecting...
              </div>
            </div>

            <!-- Tab: Cookie -->
            <div v-if="mdlandTab === 'cookie'" class="space-y-2">
              <textarea v-model="cookiePasteText" placeholder='Paste cookies JSON here...' rows="4" class="w-full px-3 py-2 text-xs font-mono border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-400 resize-y"></textarea>
              <div class="flex gap-2">
                <button @click="submitPastedCookies" :disabled="uploadingCookies || !cookiePasteText.trim()" class="btn-primary text-xs flex-1" :class="{ 'opacity-60': uploadingCookies || !cookiePasteText.trim() }">
                  {{ uploadingCookies ? 'Uploading...' : 'Submit' }}
                </button>
                <button @click="openCookieFilePicker" :disabled="uploadingCookies" class="btn-secondary text-xs">Upload File</button>
              </div>
              <input ref="cookieFileInput" type="file" accept=".json" class="hidden" @change="handleCookieFileSelect" />
            </div>
          </div>
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
              :class="isSoapOnly ? 'bg-purple-100 text-purple-700' : 'bg-ink-100 text-ink-600'"
            >{{ isSoapOnly ? 'SOAP Only' : 'Full' }}</span>
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

          <!-- SOAP Only: Generate button (before generation) -->
          <button
            v-if="isSoapOnly && !allVisitsGenerated"
            @click="generateAll"
            :disabled="generating"
            class="btn-primary text-sm flex items-center gap-2"
            :class="{ 'opacity-60 cursor-not-allowed': generating }"
          >
            <svg v-if="generating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>{{ generating ? 'Generating...' : 'Generate SOAP' }}</span>
          </button>

          <!-- SOAP Only: Save button (after generation) -->
          <button
            v-if="isSoapOnly && allVisitsGenerated"
            @click="confirmBatch"
            :disabled="loading"
            class="btn-primary text-sm flex items-center gap-2"
            :class="{ 'opacity-60 cursor-not-allowed': loading }"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>Save</span>
          </button>

          <!-- Full mode: Confirm button -->
          <button
            v-if="!isSoapOnly"
            @click="confirmBatch"
            :disabled="loading || !allVisitsGenerated"
            class="btn-primary text-sm flex items-center gap-2"
            :class="{ 'opacity-60 cursor-not-allowed': loading || !allVisitsGenerated }"
          >
            <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            <span>Confirm Batch</span>
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
                <div v-if="!isSoapOnly && visit.cptCodes && visit.cptCodes.length > 0" class="mt-3 flex items-center gap-2 flex-wrap">
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
          <div v-if="cookiesInfo.exists && loginStatus !== 'logging_in'" class="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200 mb-3">
            <svg class="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <p class="text-sm text-green-700">MDLand session ready</p>
            <button
              @click="loginStatus = 'idle'; cookiesInfo = { exists: false, updatedAt: null }"
              class="ml-auto text-xs text-green-600 hover:text-green-800 underline"
            >Re-login</button>
          </div>

          <!-- Login Form -->
          <div v-if="!cookiesInfo.exists || loginStatus === 'idle' && !cookiesInfo.exists" class="space-y-3">
            <div>
              <label class="block text-xs text-ink-500 mb-1">Username</label>
              <input
                v-model="mdlandUsername"
                type="text"
                placeholder="MDLand username"
                :disabled="loginStatus === 'logging_in'"
                class="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-400 focus:border-transparent transition-shadow"
                @keydown.enter="$event.target.nextElementSibling?.nextElementSibling?.querySelector('input')?.focus()"
              />
            </div>
            <div>
              <label class="block text-xs text-ink-500 mb-1">Password</label>
              <input
                v-model="mdlandPassword"
                type="password"
                placeholder="MDLand password"
                :disabled="loginStatus === 'logging_in'"
                class="w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-400 focus:border-transparent transition-shadow"
                @keydown.enter="loginMDLand"
              />
            </div>

            <label class="flex items-center gap-1.5 text-xs text-ink-500 cursor-pointer select-none">
              <input v-model="rememberCredentials" type="checkbox" class="rounded" />
              Remember credentials
            </label>

            <!-- Login Button -->
            <button
              @click="loginMDLand"
              :disabled="loginStatus === 'logging_in' || !mdlandUsername || !mdlandPassword"
              class="btn-primary text-sm flex items-center gap-2"
              :class="{ 'opacity-60 cursor-not-allowed': loginStatus === 'logging_in' || !mdlandUsername || !mdlandPassword }"
            >
              <svg v-if="loginStatus === 'logging_in'" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {{ loginStatus === 'logging_in' ? 'Logging in...' : 'Login to MDLand' }}
            </button>

            <!-- Login Error -->
            <p v-if="loginError" class="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {{ loginError }}
            </p>

            <!-- Logging in progress -->
            <div v-if="loginStatus === 'logging_in'" class="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              <span class="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Playwright is logging in to MDLand... This may take up to 30 seconds.
            </div>
          </div>

          <!-- Manual Upload Fallback -->
          <div class="mt-3">
            <button
              @click="showManualUpload = !showManualUpload"
              class="text-xs text-ink-400 hover:text-ink-600 transition-colors flex items-center gap-1"
            >
              <svg
                class="w-3 h-3 transition-transform duration-200"
                :class="{ 'rotate-90': showManualUpload }"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
              Manual cookie upload
            </button>
            <div v-if="showManualUpload" class="mt-2 pl-4 border-l-2 border-ink-100">
              <p class="text-xs text-ink-400 mb-2">
                Paste cookies JSON or upload a file.
              </p>
              <textarea
                v-model="cookiePasteText"
                placeholder='{"cookies":[...],"origins":[...]}'
                rows="4"
                class="w-full px-3 py-2 text-xs font-mono border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ink-400 mb-2 resize-y"
              ></textarea>
              <div class="flex gap-2">
                <button
                  @click="submitPastedCookies"
                  :disabled="uploadingCookies || !cookiePasteText.trim()"
                  class="btn-primary text-xs flex items-center gap-1"
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
