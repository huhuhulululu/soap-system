import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { checkerService } from '../services/checker'

export const useFilesStore = defineStore('files', () => {
  // State
  const files = ref([])
  const selectedFileId = ref(null)
  const isProcessing = ref(false)
  const insuranceType = ref('OPTUM')
  const treatmentTime = ref(15)

  // Getters
  const hasFiles = computed(() => files.value.length > 0)

  const selectedFile = computed(() =>
    files.value.find(f => f.id === selectedFileId.value) || null
  )

  const processedFiles = computed(() =>
    files.value.filter(f => f.status === 'done')
  )

  const pendingFiles = computed(() =>
    files.value.filter(f => f.status === 'pending')
  )

  const stats = computed(() => {
    const done = processedFiles.value
    if (done.length === 0) return null

    const grades = { PASS: 0, WARNING: 0, FAIL: 0 }
    let totalScore = 0
    let totalErrors = 0

    done.forEach(f => {
      if (f.report) {
        grades[f.report.summary.scoring.grade]++
        totalScore += f.report.summary.scoring.totalScore
        totalErrors += f.report.summary.errorCount.total
      }
    })

    return {
      total: done.length,
      grades,
      avgScore: Math.round(totalScore / done.length),
      totalErrors
    }
  })

  // Actions
  function addFiles(newFiles) {
    const formatted = newFiles.map(f => ({
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: f.name,
      file: f,
      status: 'pending',
      report: null,
      error: null
    }))
    files.value = [...files.value, ...formatted]
  }

  function selectFile(file) {
    selectedFileId.value = file?.id || null
  }

  function removeFile(fileId) {
    files.value = files.value.filter(f => f.id !== fileId)
    if (selectedFileId.value === fileId) {
      selectedFileId.value = null
    }
  }

  function clearAll() {
    files.value = []
    selectedFileId.value = null
  }

  async function processAllFiles() {
    if (isProcessing.value) return
    isProcessing.value = true

    const processedResults = []

    for (const file of files.value) {
      if (file.status !== 'pending') continue

      file.status = 'processing'

      try {
        const report = await checkerService.validateFile(file.file, { insuranceType: insuranceType.value, treatmentTime: treatmentTime.value })
        file.report = report
        file.status = 'done'

        // Collect successful results for history
        processedResults.push({
          fileName: file.name,
          report
        })
      } catch (err) {
        console.error('[AChecker] validateFile failed:', err)
        file.status = 'error'
        file.error = err.message || String(err)
      }
    }

    isProcessing.value = false

    // Auto-select first completed file
    if (!selectedFileId.value && processedFiles.value.length > 0) {
      selectedFileId.value = processedFiles.value[0].id
    }

    // Save to history if we have successful results
    if (processedResults.length > 0) {
      try {
        const { useHistory } = await import('../composables/useHistory')
        const history = useHistory()

        processedResults.forEach(result => {
          history.saveResult(result.fileName, result.report)
        })
      } catch (err) {
        console.error('[AChecker] Failed to save history:', err)
      }
    }
  }

  function loadFromHistory(fileName, report) {
    const id = 'history_' + Date.now().toString(36)
    const entry = {
      id,
      name: fileName,
      file: null,
      status: 'done',
      report,
      error: null
    }
    files.value = [entry]
    selectedFileId.value = id
  }

  return {
    // State
    files,
    selectedFileId,
    isProcessing,
    insuranceType,
    treatmentTime,
    // Getters
    hasFiles,
    selectedFile,
    processedFiles,
    pendingFiles,
    stats,
    // Actions
    addFiles,
    selectFile,
    removeFile,
    clearAll,
    processAllFiles,
    loadFromHistory
  }
})
