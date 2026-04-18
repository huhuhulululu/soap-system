<script setup>
import { computed, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useFilesStore } from '../stores/files'
import { useHistory } from '../composables/useHistory'
import FileUploader from '../components/FileUploader.vue'
import FileList from '../components/FileList.vue'
import ReportPanel from '../components/ReportPanel.vue'
import StatsOverview from '../components/StatsOverview.vue'
import ErrorBoundary from '../components/ErrorBoundary.vue'
import { useKeyboardNav } from '../composables/useKeyboardNav'

const filesStore = useFilesStore()
const {
  files,
  selectedFile,
  isProcessing,
  hasFiles,
  pendingFiles,
  stats,
  insuranceType,
  treatmentTime,
  billData,
  billError,
  billMatchResult
} = storeToRefs(filesStore)

const {
  addFiles,
  selectFile,
  removeFile,
  clearAll,
  processAllFiles,
  setBillFile,
  clearBill
} = filesStore

const uploadError = ref('')

function handleFiles(rawFiles) {
  uploadError.value = ''
  const pdfs = []
  const bills = []
  const unsupported = []
  for (const f of rawFiles) {
    const ext = (f.name.toLowerCase().split('.').pop() || '').trim()
    if (ext === 'pdf') pdfs.push(f)
    else if (ext === 'xls' || ext === 'html' || ext === 'htm') bills.push(f)
    else unsupported.push(f.name)
  }
  if (unsupported.length) uploadError.value = `不支持的文件类型: ${unsupported.join(', ')}`

  if (pdfs.length) {
    const idsBefore = new Set(files.value.map(f => f.id))
    addFiles(pdfs)
    const justAdded = files.value.find(f => !idsBefore.has(f.id))
    // keepBill 仅当本次也提供了新 bill（即同一次拖入 PDF+bill 的组合场景）
    // 否则切换到新 note 时清空旧 bill，避免静默错绑
    if (justAdded) selectFile(justAdded, { keepBill: bills.length > 0 })
    if (!isProcessing.value && pendingFiles.value.length > 0) {
      processAllFiles()
    }
  }
  if (bills.length) setBillFile(bills[0])
}

useKeyboardNav(files, selectFile)

const progress = computed(() => {
  if (files.value.length === 0) return 0
  return ((files.value.length - pendingFiles.value.length) / files.value.length) * 100
})

const previewFile = ref(null)
function handlePreview(file) {
  previewFile.value = file
}
function closePreview() {
  previewFile.value = null
}

// ── History ──
const { getHistory, clearAll: clearHistory } = useHistory()
const historyRecords = ref([])
onMounted(() => { historyRecords.value = getHistory() })

function clearAllHistory() {
  if (!confirm('确定要清空所有历史记录吗？')) return
  clearHistory()
  historyRecords.value = []
}

function viewDetail(record) {
  if (!record.report) return
  filesStore.loadFromHistory(record.fileName, record.report)
}

function formatDate(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hrs = Math.floor(diff / 3600000)
  if (hrs < 24) return `${hrs} 小时前`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_BADGE = {
  pass: { text: '通过', cls: 'bg-green-100 text-green-700' },
  fail: { text: '不通过', cls: 'bg-red-100 text-red-700' },
  warning: { text: '警告', cls: 'bg-yellow-100 text-yellow-700' },
  pending: { text: '待验证', cls: 'bg-gray-100 text-gray-700' },
}
</script>

<template>
  <div class="max-w-7xl w-full mx-auto px-6 py-8">
    <!-- Empty State -->
    <div v-if="!hasFiles" class="animate-fade-in space-y-6">
      <FileUploader @files-added="handleFiles" />
      <p v-if="uploadError" class="text-sm text-red-600 text-center">{{ uploadError }}</p>

      <!-- Bill-only upload status (bill loaded but no note yet) -->
      <div v-if="billError || billData" class="card p-4 max-w-2xl mx-auto">
        <div v-if="billError" class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M5 19a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5z"/></svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-700">Bill 解析失败</p>
            <p class="text-xs text-red-600 mt-0.5">{{ billError }}</p>
          </div>
          <button @click="clearBill" class="text-xs text-red-600 hover:underline">清空</button>
        </div>
        <div v-else class="flex items-center gap-3">
          <svg class="w-5 h-5 text-ink-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-ink-800">Bill 已加载：{{ billData?.patient }}</p>
            <p class="text-xs text-ink-500">{{ billData?.insurance }} · {{ billData?.rows?.length }} DOS · ${{ billData?.totalCharge?.toFixed(0) }} · 等待 Note PDF 上传...</p>
          </div>
          <button @click="clearBill" class="text-xs text-ink-500 hover:text-red-500">清空</button>
        </div>
      </div>

      <!-- Inline History -->
      <div v-if="historyRecords.length > 0">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-ink-700">历史记录</h2>
          <button @click="clearAllHistory" class="text-xs text-ink-600 hover:text-red-500 transition-colors">清空</button>
        </div>
        <div class="card overflow-hidden">
          <table class="w-full">
            <thead class="bg-ink-50 border-b border-ink-200">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-ink-600">文件名</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-ink-600">日期</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-ink-600">分数</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-ink-600">状态</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-100">
              <tr v-for="r in historyRecords" :key="r.id" @click="viewDetail(r)"
                class="hover:bg-ink-50 cursor-pointer transition-colors">
                <td class="px-4 py-3 text-sm text-ink-800">{{ r.fileName }}</td>
                <td class="px-4 py-3 text-sm text-ink-500">{{ formatDate(r.date) }}</td>
                <td class="px-4 py-3 text-sm font-semibold" :class="r.score >= 80 ? 'text-green-600' : r.score >= 60 ? 'text-yellow-600' : 'text-red-600'">{{ r.score || 0 }}%</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 text-xs font-medium rounded-full" :class="(STATUS_BADGE[r.status] || STATUS_BADGE.pending).cls">{{ (STATUS_BADGE[r.status] || STATUS_BADGE.pending).text }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Working State -->
    <ErrorBoundary>
      <div v-if="hasFiles" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left Column: Compact rail (4/12, sticky) -->
        <aside class="lg:col-span-4 space-y-3 lg:sticky lg:top-4 lg:self-start">
          <!-- Stats Overview — 仅多文件（>3）时显示 -->
          <StatsOverview
            v-if="stats && files.length > 3"
            :stats="stats"
            class="animate-slide-up"
          />

          <!-- Settings Panel (紧凑) -->
          <div class="card p-3 space-y-2 animate-slide-up">
            <label class="flex items-center gap-3">
              <span class="text-xs text-ink-500 w-10 shrink-0">保险</span>
              <select v-model="insuranceType" class="flex-1 text-sm border border-ink-200 rounded-md px-2.5 py-1.5 bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-400">
                <option value="OPTUM">Optum</option>
                <option value="HF">HealthFirst</option>
                <option value="WC">WellCare</option>
                <option value="VC">VillageCare Max</option>
                <option value="ELDERPLAN">ElderPlan</option>
                <option value="NONE">None / Self-pay</option>
              </select>
            </label>
            <label class="flex items-center gap-3">
              <span class="text-xs text-ink-500 w-10 shrink-0">时长</span>
              <select v-model.number="treatmentTime" class="flex-1 text-sm border border-ink-200 rounded-md px-2.5 py-1.5 bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-400">
                <option :value="15">15 分钟</option>
                <option :value="30">30 分钟</option>
                <option :value="45">45 分钟</option>
                <option :value="60">60 分钟</option>
              </select>
            </label>
          </div>

          <!-- File List (紧凑 + 内嵌 header 动作 + footer uploader) -->
          <FileList
            :files="files"
            :selected-id="selectedFile?.id"
            :pending-count="pendingFiles.length"
            :is-processing="isProcessing"
            @select="selectFile"
            @remove="removeFile"
            @preview="handlePreview"
            @validate="processAllFiles"
            @clear-all="clearAll"
            @files-added="handleFiles"
            class="animate-slide-up stagger-2"
          />
          <p v-if="uploadError" class="text-xs text-red-600">{{ uploadError }}</p>
        </aside>

        <!-- Right Column: Report Detail (8/12 恒定) -->
        <div class="lg:col-span-8">
          <ReportPanel
            :file="selectedFile"
            :bill-data="billData"
            :bill-match-result="billMatchResult"
            :bill-error="billError"
            :on-clear-bill="clearBill"
            class="animate-fade-in"
          />
        </div>
      </div>
    </ErrorBoundary>

    <!-- Raw Text Preview Modal -->
    <div
      v-if="previewFile"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click="closePreview"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col"
        @click.stop
      >
        <div class="flex items-center justify-between px-5 py-3 border-b border-ink-100">
          <h2 class="text-sm font-semibold text-ink-800 truncate">{{ previewFile.name }}</h2>
          <button @click="closePreview" class="text-ink-400 hover:text-ink-600 p-1">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-5">
          <div class="text-xs text-ink-700 font-mono whitespace-pre-wrap leading-relaxed">
            <template v-for="(text, i) in (previewFile.report?.visitTexts || [])" :key="i">
              <div class="mb-4 p-3 bg-paper-50 border border-ink-100 rounded">
                <p class="text-[11px] text-ink-600 mb-2 font-sans">Visit {{ i + 1 }}</p>
                {{ text }}
              </div>
            </template>
            <p v-if="!(previewFile.report?.visitTexts?.length)" class="text-ink-600 text-sm font-sans">
              无原文数据
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
