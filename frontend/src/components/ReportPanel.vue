<script setup>
import { computed, ref } from 'vue'
import CriticalBanner from './CriticalBanner.vue'
import VisitErrorGroup from './VisitErrorGroup.vue'
import VisitCorrectionCard from './VisitCorrectionCard.vue'
import VisitAuditCard from './VisitAuditCard.vue'
import { exportReportAsCSV, copyAllCorrections } from '../services/exporter'
import { exportAllAsCSV } from '../services/batch-exporter'

const props = defineProps({
  file: {
    type: Object,
    default: null
  },
  billData: { type: Object, default: null },
  billMatchResult: { type: Array, default: null },
  billError: { type: String, default: '' },
  onClearBill: { type: Function, default: null }
})

const report = computed(() => props.file?.report)

// Bill 状态机：6 态
const billStatus = computed(() => {
  if (props.billError) return 'error'
  if (!props.billData) return 'none'
  const f = props.file
  if (f?.source === 'history') return 'history'
  if (f?.status === 'error') return 'note_error'
  if (!f || f.status !== 'done' || !f.report?.document) return 'waiting_note'
  return 'matched'
})

const billSummary = computed(() => {
  const results = props.billMatchResult || []
  const stats = { match: 0, diff: 0, missing: 0 }
  for (const r of results) {
    if (r.status === 'match') stats.match++
    else if (r.status === 'diff') stats.diff++
    else if (r.status === 'missing_dos') stats.missing++
  }
  return {
    patient: props.billData?.patient || '',
    insurance: props.billData?.insurance || '',
    dosCount: props.billData?.rows?.length || 0,
    totalCharge: props.billData?.totalCharge || 0,
    ...stats,
  }
})

const unchargedVisitDoses = computed(() => {
  if (billStatus.value !== 'matched') return []
  const billDosSet = new Set((props.billData?.rows || []).map(r => r.dos))
  const visits = props.file?.report?.document?.visits || []
  const out = []
  for (const v of visits) {
    const d = v.assessment?.date
    if (d && /^\d{2}\/\d{2}\/\d{4}$/.test(d) && !billDosSet.has(d)) {
      out.push(d)
    }
  }
  return out
})

function billChipIcon(status) {
  return status === 'match' ? '✓' : status === 'diff' ? '⚠' : '✗'
}
function billChipClass(status) {
  return status === 'match' ? 'text-green-600'
    : status === 'diff' ? 'text-yellow-600'
    : 'text-red-600'
}
const unchargedExpanded = ref(false)
const billExpanded = ref(true)
const summary = computed(() => report.value?.summary || {})
const patient = computed(() => report.value?.patient || {})
const errorCount = computed(() => summary.value?.errorCount || { critical: 0, high: 0, medium: 0, low: 0, total: 0 })
const scoring = computed(() => summary.value?.scoring || { totalScore: 0, grade: 'FAIL' })
const hasCritical = computed(() => errorCount.value.critical > 0)
const expandedErrors = ref(new Set())
const errorsExpanded = ref(false)
const activeTab = ref('corrections')

// Audit visits: all visits from parsed document with their texts and errors
const auditVisits = computed(() => {
  if (!report.value?.document?.visits) return []
  const visits = report.value.document.visits
  const visitTexts = report.value.visitTexts || []
  const errors = report.value.errors || []

  return visits.map((visit, idx) => ({
    visitIndex: idx,
    visit,
    visitText: visitTexts[idx] || '',
    prevVisitText: idx > 0 ? (visitTexts[idx - 1] || '') : '',
    prevVisitType: idx > 0 ? (visits[idx - 1]?.subjective?.visitType || '') : '',
    nextVisitText: idx < visits.length - 1 ? (visitTexts[idx + 1] || '') : '',
    nextVisitType: idx < visits.length - 1 ? (visits[idx + 1]?.subjective?.visitType || '') : '',
    errors: errors.filter(e => (e.location?.visitIndex ?? e.visitIndex) === idx)
  }))
})

function getGradeClass(grade) {
  switch (grade) {
    case 'PASS': return 'grade-pass'
    case 'WARNING': return 'grade-warning'
    case 'FAIL': return 'grade-fail'
    default: return ''
  }
}

function getGradeText(grade) {
  switch (grade) {
    case 'PASS': return '通过'
    case 'WARNING': return '异常'
    case 'FAIL': return '不通过'
    default: return '-'
  }
}

function scrollToCritical() {
  const errorSection = document.querySelector('.errors-section')
  if (errorSection) {
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function handleErrorClicked(payload) {
  expandedErrors.value.add(payload.visitIndex)
  expandedErrors.value = new Set(expandedErrors.value)
}

async function handleExportAll() {
  if (!report.value) return
  try {
    await exportAllAsCSV(report.value)
  } catch (error) {
    alert('导出失败: ' + error.message)
  }
}

async function handleCopyAllCorrections() {
  if (!report.value) return
  try {
    await copyAllCorrections(report.value)
    alert('已复制所有纠正内容到剪贴板')
  } catch (error) {
    alert('复制失败: ' + error.message)
  }
}

function getCorrectionsForVisit(visitIndex) {
  if (!report.value?.corrections) return []

  return report.value.corrections.filter(correction => {
    return correction.visitIndex === visitIndex
  })
}

// Group corrections by visit
const correctionsByVisit = computed(() => {
  if (!report.value?.corrections) return []

  const grouped = new Map()

  for (const correction of report.value.corrections) {
    const visitIndex = correction.visitIndex
    if (!grouped.has(visitIndex)) {
      grouped.set(visitIndex, {
        visitIndex,
        visitDate: correction.visitDate || '',
        corrections: []
      })
    }
    grouped.get(visitIndex).corrections.push(correction)
  }

  return Array.from(grouped.values()).sort((a, b) => a.visitIndex - b.visitIndex)
})
</script>

<template>
  <div class="space-y-4">
  <!-- Bill 核对区块（提到根层：报告加载中/错误/历史也能看到 bill 状态） -->
  <div v-if="file && billStatus !== 'none'" class="card p-4">
    <!-- error -->
    <div v-if="billStatus === 'error'" class="bg-red-50 border-l-4 border-red-400 p-3 rounded flex items-start gap-3">
      <svg class="w-5 h-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5z"/></svg>
      <div class="flex-1">
        <p class="text-sm font-medium text-red-700">Bill 解析失败</p>
        <p class="text-xs text-red-600 mt-0.5">{{ billError }}</p>
      </div>
      <button @click="onClearBill && onClearBill()" class="text-xs text-red-600 hover:underline">清空</button>
    </div>
    <!-- history -->
    <div v-else-if="billStatus === 'history'" class="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded flex items-start gap-3">
      <svg class="w-5 h-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <div class="flex-1">
        <p class="text-sm font-medium text-yellow-800">历史记录无原始数据</p>
        <p class="text-xs text-yellow-700 mt-0.5">当前 note 来自历史记录，无原始 SOAP 数据可核对。请重新上传 note.pdf。</p>
      </div>
      <button @click="onClearBill && onClearBill()" class="text-xs text-yellow-700 hover:underline">清空 Bill</button>
    </div>
    <!-- note_error -->
    <div v-else-if="billStatus === 'note_error'" class="bg-red-50 border-l-4 border-red-400 p-3 rounded flex items-start gap-3">
      <svg class="w-5 h-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5z"/></svg>
      <div class="flex-1">
        <p class="text-sm font-medium text-red-700">Note 验证失败，无法核对 Bill</p>
        <p v-if="file?.error" class="text-xs text-red-600 mt-0.5">{{ file.error }}</p>
      </div>
      <button @click="onClearBill && onClearBill()" class="text-xs text-red-600 hover:underline">清空 Bill</button>
    </div>
    <!-- waiting_note -->
    <div v-else-if="billStatus === 'waiting_note'" class="bg-paper-100 border border-ink-200 p-3 rounded flex items-center gap-3">
      <svg class="w-5 h-5 text-ink-500 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      <p class="text-sm text-ink-700 flex-1">Bill 已上传，等待 note 验证完成后自动核对...</p>
      <button @click="onClearBill && onClearBill()" class="text-xs text-ink-500 hover:underline">清空 Bill</button>
    </div>
    <!-- matched -->
    <div v-else-if="billStatus === 'matched'" class="space-y-3">
      <button
        type="button"
        @click="billExpanded = !billExpanded"
        class="w-full flex items-center gap-4 p-3 bg-paper-100/50 rounded-lg border border-ink-100 hover:bg-paper-100 transition-colors text-left"
        :aria-expanded="billExpanded"
      >
        <svg
          class="w-4 h-4 text-ink-400 shrink-0 transition-transform"
          :class="billExpanded ? 'rotate-90' : ''"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        <svg class="w-5 h-5 text-ink-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-ink-800">Bill 核对 <span v-if="file?.name" class="text-xs font-normal text-ink-500">vs {{ file.name }}</span></div>
          <div class="text-xs text-ink-500 truncate">{{ billSummary.insurance }} · {{ billSummary.dosCount }} DOS · ${{ billSummary.totalCharge.toFixed(0) }}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">✓ {{ billSummary.match }}</span>
          <span v-if="billSummary.diff > 0" class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">⚠ {{ billSummary.diff }}</span>
          <span v-if="billSummary.missing > 0" class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">✗ {{ billSummary.missing }}</span>
        </div>
        <span @click.stop="onClearBill && onClearBill()" class="text-xs text-ink-500 hover:text-red-500 shrink-0 cursor-pointer">清空</span>
      </button>
      <div v-show="billExpanded" class="divide-y divide-ink-100 max-h-96 overflow-y-auto border border-ink-100 rounded-lg">
        <div
          v-for="(r, i) in billMatchResult"
          :key="`bill-${i}`"
          class="px-3 py-2 flex items-start gap-2"
          :class="r.status === 'diff' ? 'bg-yellow-50/40' : r.status === 'missing_dos' ? 'bg-red-50/30' : ''"
        >
          <span :class="[billChipClass(r.status), 'font-bold text-sm leading-5 w-4']">{{ billChipIcon(r.status) }}</span>
          <span class="font-mono text-xs text-ink-700 w-20 shrink-0 leading-5">{{ r.dos }}</span>
          <div class="flex-1 min-w-0 text-xs leading-5">
            <template v-if="r.status === 'match'">
              <span class="text-ink-600">{{ r.billIcd.join('/') }} · {{ r.billCpt.join('·') }}</span>
            </template>
            <template v-else-if="r.status === 'diff'">
              <span v-if="r.icdMissing?.length" class="text-yellow-700">ICD 缺失: {{ r.icdMissing.join(', ') }}</span>
              <span v-if="r.icdMissing?.length && r.cptMissing?.length" class="text-ink-400"> · </span>
              <span v-if="r.cptMissing?.length" class="text-yellow-700">CPT 缺失: {{ r.cptMissing.join(', ') }}</span>
            </template>
            <template v-else>
              <span class="text-red-700">Note 无此 DOS</span>
              <span class="text-ink-400"> · 也可能因日期未正确解析</span>
            </template>
          </div>
        </div>
      </div>
      <div v-show="billExpanded && unchargedVisitDoses.length > 0" class="text-xs">
        <button @click="unchargedExpanded = !unchargedExpanded" class="flex items-center gap-1.5 text-ink-500 hover:text-ink-700">
          <svg class="w-3 h-3 transition-transform" :class="unchargedExpanded ? 'rotate-90' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          <span>未计费 visits ({{ unchargedVisitDoses.length }})</span>
        </button>
        <div v-show="unchargedExpanded" class="mt-1.5 pl-4 text-ink-500 font-mono">
          {{ unchargedVisitDoses.join(' · ') }}
        </div>
      </div>
    </div>
  </div>

  <!-- Empty State -->
  <div v-if="!file" class="card h-full min-h-[500px] flex items-center justify-center">
    <div class="text-center text-ink-400">
      <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p class="text-sm">选择一个已验证的文件查看报告</p>
    </div>
  </div>

  <!-- Report Content -->
  <div v-else-if="report" class="card overflow-hidden">
    <!-- Critical Banner -->
    <CriticalBanner
      :count="errorCount.critical"
      @click="scrollToCritical"
    />

    <!-- Header -->
    <div class="px-6 py-5 bg-paper-100/50 border-b border-ink-100">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="font-display text-xl font-semibold text-ink-800">
            {{ patient.name }}
          </h2>
          <p class="text-sm text-ink-500 mt-1">
            患者ID: {{ patient.patientId }} · DOB: {{ patient.dob }}
          </p>
        </div>

        <!-- Score Badge -->
        <div class="text-center space-y-2">
          <div :class="[
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg border',
            hasCritical ? 'grade-fail' : getGradeClass(scoring.grade)
          ]">
            <span class="font-display text-2xl font-bold">
              {{ hasCritical ? 0 : scoring.totalScore }}
            </span>
            <span class="text-sm font-medium">
              {{ hasCritical ? '不通过' : getGradeText(scoring.grade) }}
            </span>
          </div>
          <button @click="exportReportAsCSV(report)" class="block text-xs text-ink-400 hover:text-ink-600 transition-colors">
            导出 CSV
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="px-6 py-4 grid grid-cols-3 gap-4 border-b border-ink-100">
      <div>
        <p class="text-xs text-ink-500">总就诊次数</p>
        <p class="text-lg font-semibold text-ink-800">{{ summary.totalVisits }}</p>
      </div>
      <div>
        <p class="text-xs text-ink-500">日期范围</p>
        <p class="text-sm font-medium text-ink-700">
          {{ summary.visitDateRange?.first || '-' }} - {{ summary.visitDateRange?.last || '-' }}
        </p>
      </div>
      <div>
        <p class="text-xs text-ink-500">总错误数</p>
        <p class="text-lg font-semibold" :class="errorCount.total > 0 ? 'text-status-fail' : 'text-status-pass'">
          {{ errorCount.total }}
        </p>
      </div>
    </div>

    <!-- Errors Section -->
    <div class="px-6 py-4 errors-section">
      <!-- Collapsible Error Details -->
      <button
        @click="errorsExpanded = !errorsExpanded"
        class="w-full flex items-center justify-between py-2 group"
      >
        <h3 class="text-sm font-medium text-ink-700 flex items-center gap-2">
          错误详情
          <span v-if="report.errors.length > 0" class="text-ink-400 font-normal">
            ({{ report.errors.length }})
          </span>
        </h3>
        <svg
          class="w-4 h-4 text-ink-400 transition-transform duration-200 group-hover:text-ink-600"
          :class="errorsExpanded ? 'rotate-180' : ''"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div v-show="errorsExpanded" class="mt-2">
        <!-- Visit Error Groups -->
        <VisitErrorGroup
          :errors="report.errors"
          :timeline="report.timeline"
        />
      </div>

      <!-- Correction / Audit Tabs -->
      <div class="mt-6 space-y-4">
        <div class="flex items-center gap-2">
          <button
            @click="activeTab = 'corrections'"
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'corrections'
                ? 'bg-ink-700 text-white'
                : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
            ]"
          >修正</button>
          <button
            @click="activeTab = 'audit'"
            :class="[
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              activeTab === 'audit'
                ? 'bg-ink-700 text-white'
                : 'bg-paper-200 text-ink-600 hover:bg-paper-300'
            ]"
          >查阅</button>
        </div>

        <!-- Tab: Corrections -->
        <template v-if="activeTab === 'corrections'">
          <template v-if="correctionsByVisit.length > 0">
            <h4 class="text-sm font-medium text-ink-700 flex items-center gap-2">
              <svg class="w-4 h-4 text-status-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              建议修正 ({{ correctionsByVisit.length }} 个 Visit)
            </h4>
            <VisitCorrectionCard
              v-for="visit in correctionsByVisit"
              :key="`corr-${visit.visitIndex}`"
              :visit-index="visit.visitIndex"
              :visit-date="visit.visitDate"
              :corrections="visit.corrections"
            />
          </template>
          <p v-else class="text-sm text-ink-400">无修正建议</p>
        </template>

        <!-- Tab: Audit -->
        <template v-if="activeTab === 'audit'">
          <h4 class="text-sm font-medium text-ink-700 flex items-center gap-2">
            <svg class="w-4 h-4 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            原始 SOAP 查阅 ({{ auditVisits.length }} 个 Visit)
          </h4>
          <VisitAuditCard
            v-for="av in auditVisits"
            :key="`audit-${av.visitIndex}`"
            :visit-index="av.visitIndex"
            :visit-text="av.visitText"
            :prev-visit-text="av.prevVisitText"
            :prev-visit-type="av.prevVisitType"
            :next-visit-text="av.nextVisitText"
            :next-visit-type="av.nextVisitType"
            :visit="av.visit"
            :errors="av.errors"
          />
          <p v-if="auditVisits.length === 0" class="text-sm text-ink-400">无 visit 数据</p>
        </template>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="px-6 py-4 border-t border-ink-100 flex gap-3">
      <button
        @click="handleExportAll"
        class="px-4 py-2 bg-ink-600 text-white rounded-lg hover:bg-ink-700 transition-colors text-sm font-medium flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        批量导出 CSV
      </button>
      <button
        @click="handleCopyAllCorrections"
        class="px-4 py-2 bg-white border border-ink-200 text-ink-700 rounded-lg hover:bg-paper-50 transition-colors text-sm font-medium flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        复制所有纠正
      </button>
    </div>
  </div>

  <!-- Note Error State -->
  <div v-else-if="file.status === 'error'" class="card h-full min-h-[300px] flex items-center justify-center">
    <div class="text-center px-6">
      <svg class="w-12 h-12 mx-auto mb-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M5 19a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5z"/></svg>
      <p class="text-sm font-medium text-red-700 mb-1">Note 验证失败</p>
      <p class="text-xs text-ink-600">{{ file.error || '未知错误' }}</p>
    </div>
  </div>

  <!-- Processing State -->
  <div v-else-if="file.status === 'processing'" class="card h-full min-h-[500px] flex items-center justify-center">
    <div class="text-center">
      <svg class="w-12 h-12 mx-auto mb-4 text-ink-400 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p class="text-sm text-ink-500">正在验证 {{ file.name }}...</p>
    </div>
  </div>
  </div>
</template>

<style scoped>
.grade-pass {
  @apply bg-status-pass/10 border-status-pass/30 text-status-pass;
}

.grade-warning {
  @apply bg-status-warning/10 border-status-warning/30 text-status-warning;
}

.grade-fail {
  @apply bg-status-fail/10 border-status-fail/30 text-status-fail;
}

.errors-section {
  scroll-margin-top: 1rem;
}
</style>
