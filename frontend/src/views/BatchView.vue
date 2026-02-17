<script setup>
import { ref, computed } from 'vue'

// ── API ──────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// ── State ────────────────────────────────────────
const step = ref('upload') // 'upload' | 'review' | 'confirmed'
const loading = ref(false)
const error = ref('')

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

// ── Computed ─────────────────────────────────────
const uploadSummary = computed(() => {
  if (!batchData.value) return null
  return batchData.value.summary
})

const patients = computed(() => {
  if (!batchData.value) return []
  return batchData.value.patients
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
  step.value = 'upload'
  batchId.value = ''
  batchData.value = null
  selectedFile.value = null
  expandedPatients.value = new Set()
  expandedVisits.value = new Set()
  regeneratingVisits.value = new Set()
  error.value = ''
  copiedKey.value = ''
  copiedAll.value = false
}

// ── Note Type Badge ──────────────────────────────
function noteTypeBadgeClass(type) {
  if (type === 'IE') return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}
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
          </p>
        </div>
        <div class="flex gap-3">
          <button @click="copyAllSOAP" class="btn-secondary text-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {{ copiedAll ? 'Copied!' : 'Copy All' }}
          </button>
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
                <div v-if="visit.cptCodes && visit.cptCodes.length > 0" class="mt-3 flex items-center gap-2 flex-wrap">
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

    <!-- ════════════ STEP 3: Confirmed ════════════ -->
    <div v-else-if="step === 'confirmed'" class="max-w-lg mx-auto text-center py-16">
      <div class="w-20 h-20 mx-auto bg-green-50 rounded-2xl flex items-center justify-center mb-6">
        <svg class="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 class="font-display text-2xl font-bold text-ink-800 mb-2">Batch Confirmed</h2>
      <p class="text-ink-500 mb-2">
        {{ uploadSummary?.totalPatients }} patients, {{ uploadSummary?.totalVisits }} visits
      </p>
      <p class="text-sm text-ink-400 mb-8">Batch ID: {{ batchId }}</p>

      <div class="flex justify-center gap-3">
        <button @click="copyAllSOAP" class="btn-secondary text-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {{ copiedAll ? 'Copied!' : 'Copy All SOAP' }}
        </button>
        <button @click="resetAll" class="btn-primary text-sm">
          New Batch
        </button>
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
