<script setup>
import { ref } from 'vue'

const MAX_SIZE_MB = 50

const props = defineProps({
  compact: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['files-added'])

const isDragging = ref(false)
const fileInput = ref(null)
const sizeError = ref('')

function filterBySize(files) {
  const maxSizeBytes = MAX_SIZE_MB * 1024 * 1024
  const validFiles = files.filter(f => f.size <= maxSizeBytes)
  
  if (validFiles.length < files.length) {
    sizeError.value = `Some files exceed ${MAX_SIZE_MB}MB limit and were skipped`
  } else {
    sizeError.value = ''
  }
  
  return validFiles
}

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

  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
  const validFiles = filterBySize(files)
  if (validFiles.length > 0) {
    emit('files-added', validFiles)
  }
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files)
  const validFiles = filterBySize(files)
  if (validFiles.length > 0) {
    emit('files-added', validFiles)
  }
  e.target.value = ''
}

function openFilePicker() {
  fileInput.value?.click()
}
</script>

<template>
  <!-- Compact Mode -->
  <div v-if="compact" class="card p-4">
    <button
      @click="openFilePicker"
      class="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-ink-200 rounded-lg
             text-ink-500 hover:border-ink-400 hover:text-ink-700 transition-all"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      <span class="font-medium">添加更多文件</span>
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".pdf"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />
  </div>

  <!-- Full Mode -->
  <div v-else class="max-w-2xl mx-auto">
    <div
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      :class="[
        'card p-12 text-center transition-all duration-300',
        isDragging ? 'dropzone-active border-2 border-dashed scale-[1.02]' : 'border-2 border-dashed border-ink-200'
      ]"
    >
      <!-- Upload Icon -->
      <div class="mb-6">
        <div class="w-20 h-20 mx-auto bg-paper-200 rounded-2xl flex items-center justify-center">
          <svg class="w-10 h-10 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
      </div>

      <!-- Text -->
      <h2 class="font-display text-2xl font-semibold text-ink-800 mb-2">
        上传 Optum Note PDF
      </h2>
      <p class="text-ink-500 mb-6">
        拖放文件到此处，或点击选择文件
      </p>

      <!-- Button -->
      <button
        @click="openFilePicker"
        class="btn-primary inline-flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span>选择 PDF 文件</span>
      </button>

      <!-- Hint -->
      <p class="mt-6 text-xs text-ink-400">
        支持批量上传 · 仅限 PDF 格式
      </p>
      
      <!-- Size Error -->
      <p v-if="sizeError" class="mt-2 text-sm text-red-600">
        {{ sizeError }}
      </p>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept=".pdf"
      multiple
      class="hidden"
      @change="handleFileSelect"
    />
    
    <!-- Size Error for compact mode -->
    <p v-if="compact && sizeError" class="mt-2 text-sm text-red-600">
      {{ sizeError }}
    </p>
  </div>
</template>
