<script setup>
import { computed, ref } from 'vue'
import CriticalBanner from './CriticalBanner.vue'
import VisitErrorGroup from './VisitErrorGroup.vue'
import CorrectionCard from './CorrectionCard.vue'
import { exportReportAsCSV, copyAllCorrections } from '../services/exporter'
import { exportAllAsCSV } from '../services/batch-exporter'

const props = defineProps({
  file: {
    type: Object,
    default: null
  }
})

const report = computed(() => props.file?.report)
const summary = computed(() => report.value?.summary || {})
const patient = computed(() => report.value?.patient || {})
const errorCount = computed(() => summary.value?.errorCount || { critical: 0, high: 0, medium: 0, low: 0, total: 0 })
const scoring = computed(() => summary.value?.scoring || { totalScore: 0, grade: 'FAIL' })
const hasCritical = computed(() => errorCount.value.critical > 0)
const expandedErrors = ref(new Set())

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
</script>

<template>
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
      <h3 class="text-sm font-medium text-ink-700 mb-3">
        错误详情
        <span v-if="report.errors.length > 0" class="text-ink-400 font-normal">
          ({{ report.errors.length }})
        </span>
      </h3>

      <!-- Visit Error Groups -->
      <VisitErrorGroup
        :errors="report.errors"
        :timeline="report.timeline"
      />

      <!-- Correction Cards - Show all corrections directly -->
      <div v-if="report.corrections && report.corrections.length > 0" class="mt-6 space-y-4">
        <h4 class="text-sm font-medium text-ink-700 flex items-center gap-2">
          <svg class="w-4 h-4 text-status-pass" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          建议修正 ({{ report.corrections.length }})
        </h4>
        <CorrectionCard
          v-for="(correction, idx) in report.corrections"
          :key="`correction-${correction.visitIndex}-${correction.section}-${idx}`"
          :correction="correction"
        />
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
