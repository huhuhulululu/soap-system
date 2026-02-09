<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFilesStore } from './stores/files'
import HeaderBar from './components/HeaderBar.vue'
import FileUploader from './components/FileUploader.vue'
import FileList from './components/FileList.vue'
import ReportPanel from './components/ReportPanel.vue'
import StatsOverview from './components/StatsOverview.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { useKeyboardNav } from './composables/useKeyboardNav'

// Store
const filesStore = useFilesStore()
const {
  files,
  selectedFile,
  isProcessing,
  hasFiles,
  pendingFiles,
  stats,
  insuranceType,
  treatmentTime
} = storeToRefs(filesStore)

const {
  addFiles,
  selectFile,
  removeFile,
  clearAll,
  processAllFiles
} = filesStore

useKeyboardNav(files, selectFile)

const progress = computed(() => {
  if (files.value.length === 0) return 0
  return ((files.value.length - pendingFiles.value.length) / files.value.length) * 100
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <HeaderBar />

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
      <!-- Empty State -->
      <div v-if="!hasFiles" class="animate-fade-in">
        <FileUploader @files-added="addFiles" />
      </div>

      <!-- Working State -->
      <ErrorBoundary>
      <div v-if="hasFiles" class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Left Column: File List & Stats -->
        <div class="lg:col-span-4 space-y-6">
          <!-- Stats Overview -->
          <StatsOverview
            v-if="stats"
            :stats="stats"
            class="animate-slide-up"
          />

          <!-- Settings Panel -->
          <div class="card p-4 space-y-3 animate-slide-up">
            <div class="flex items-center gap-3">
              <label class="text-xs text-ink-500 w-16">保险</label>
              <select v-model="insuranceType" class="flex-1 text-sm border border-ink-200 rounded-lg px-3 py-1.5 bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-400">
                <option value="OPTUM">Optum</option>
                <option value="HF">HealthFirst</option>
                <option value="WC">Workers' Comp</option>
                <option value="VC">Veterans Care</option>
                <option value="ELDERPLAN">ElderPlan</option>
                <option value="NONE">None / Self-pay</option>
              </select>
            </div>
            <div class="flex items-center gap-3">
              <label class="text-xs text-ink-500 w-16">时长</label>
              <select v-model.number="treatmentTime" class="flex-1 text-sm border border-ink-200 rounded-lg px-3 py-1.5 bg-white text-ink-800 focus:outline-none focus:ring-2 focus:ring-ink-400">
                <option :value="15">15 分钟</option>
                <option :value="30">30 分钟</option>
                <option :value="45">45 分钟</option>
                <option :value="60">60 分钟</option>
              </select>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 animate-slide-up stagger-1">
            <button
              @click="processAllFiles"
              :disabled="isProcessing || pendingFiles.length === 0"
              class="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <svg v-if="isProcessing" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{{ isProcessing ? '验证中...' : '开始验证' }}</span>
            </button>
            <button @click="clearAll" class="btn-secondary">
              清空
            </button>
          </div>

          <!-- Progress Bar -->
          <div v-if="isProcessing" class="w-full bg-ink-200 rounded-full h-2">
            <div class="bg-ink-600 h-2 rounded-full transition-all duration-300" :style="{ width: progress + '%' }"></div>
          </div>

          <!-- File List -->
          <FileList
            :files="files"
            :selected-id="selectedFile?.id"
            @select="selectFile"
            @remove="removeFile"
            @add-more="() => {}"
            class="animate-slide-up stagger-2"
          />

          <!-- Add More -->
          <FileUploader
            compact
            @files-added="addFiles"
            class="animate-slide-up stagger-3"
          />
        </div>

        <!-- Right Column: Report Detail -->
        <div class="lg:col-span-8">
          <ReportPanel
            :file="selectedFile"
            class="animate-fade-in"
          />
        </div>
      </div>
      </ErrorBoundary>
    </main>

    <!-- Footer -->
    <footer class="border-t border-ink-100 py-4 mt-auto">
      <div class="max-w-7xl mx-auto px-6 text-center text-ink-400 text-sm">
        AChecker v1.0 · Optum Note 验证系统
      </div>
    </footer>
  </div>
</template>
