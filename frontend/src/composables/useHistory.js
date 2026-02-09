const STORAGE_KEY = 'achecker_history'
export const EXPIRY_DAYS = 7

export function useHistory() {
  const normalizeRecord = (record) => {
    const timestamp = record.timestamp || Date.now()
    return {
      ...record,
      fileName: record.fileName || record.filename || 'Unknown',
      timestamp,
      date: record.date || new Date(timestamp).toISOString(),
      score: record.score ?? record.report?.summary?.scoring?.totalScore ?? 0,
      status: record.status || (record.report?.summary?.scoring?.grade ?? 'pending').toLowerCase()
    }
  }
  const cleanExpired = () => {
    const now = Date.now()
    const cutoff = now - EXPIRY_DAYS * 24 * 60 * 60 * 1000
    const history = getHistory()
    const filtered = history.filter(item => item.timestamp > cutoff)

    if (filtered.length !== history.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    }
  }

  const saveResult = (filename, reportData) => {
    try {
      cleanExpired()

      const history = getHistory()
      const now = Date.now()
      const newRecord = {
        id: `${now}_${Math.random().toString(36).substr(2, 9)}`,
        fileName: filename,
        timestamp: now,
        date: new Date(now).toISOString(),
        score: reportData?.summary?.scoring?.totalScore ?? 0,
        status: (reportData?.summary?.scoring?.grade ?? 'pending').toLowerCase(),
        patient: reportData?.patient ?? null,
        summary: reportData?.summary ?? null,
        report: reportData
      }

      const updated = [newRecord, ...history]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

      return newRecord.id
    } catch (error) {
      throw new Error(`Failed to save history: ${error.message}`)
    }
  }

  const getHistory = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []

      const history = JSON.parse(raw)
      return history.map(normalizeRecord).sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      console.error('Failed to get history:', error)
      return []
    }
  }

  const getById = (id) => {
    try {
      const history = getHistory()
      return history.find(item => item.id === id) || null
    } catch (error) {
      throw new Error(`Failed to get history item: ${error.message}`)
    }
  }

  const deleteById = (id) => {
    try {
      const history = getHistory()
      const filtered = history.filter(item => item.id !== id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      return true
    } catch (error) {
      throw new Error(`Failed to delete history item: ${error.message}`)
    }
  }

  const clearAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      return true
    } catch (error) {
      throw new Error(`Failed to clear history: ${error.message}`)
    }
  }

  return {
    saveResult,
    getHistory,
    getById,
    deleteById,
    clearAll,
    cleanExpired
  }
}
