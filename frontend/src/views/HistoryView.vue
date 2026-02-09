<script setup>
import { ref, onMounted, computed } from 'vue'
import { useHistory } from '../composables/useHistory'

const { getHistory, clearAll } = useHistory()

const historyRecords = ref([])
const selectedRecord = ref(null)

const loadHistory = () => {
  historyRecords.value = getHistory()
}

const clearAllHistory = () => {
  if (confirm('确定要清空所有历史记录吗？')) {
    clearAll()
    historyRecords.value = []
    selectedRecord.value = null
  }
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getStatusBadge = (status) => {
  const badges = {
    'pass': { text: '通过', class: 'bg-green-100 text-green-700' },
    'fail': { text: '不通过', class: 'bg-red-100 text-red-700' },
    'warning': { text: '警告', class: 'bg-yellow-100 text-yellow-700' },
    'pending': { text: '待验证', class: 'bg-gray-100 text-gray-700' }
  }
  return badges[status] || badges.pending
}

const viewDetail = (record) => {
  selectedRecord.value = record
}

const hasRecords = computed(() => historyRecords.value.length > 0)

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="max-w-7xl w-full mx-auto px-6 py-8">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-ink-800">历史记录</h1>
        <p class="text-sm text-ink-500 mt-1">自动保留 7 天</p>
      </div>
      <button
        v-if="hasRecords"
        @click="clearAllHistory"
        class="btn-secondary"
      >
        清空全部
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="!hasRecords" class="card p-12 text-center">
      <svg class="w-16 h-16 mx-auto text-ink-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-ink-600 mb-2">暂无历史记录</h3>
      <p class="text-sm text-ink-500">验证过的文件会自动保存在这里</p>
    </div>

    <!-- History Table -->
    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-ink-50 border-b border-ink-200">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-ink-600 uppercase tracking-wider">
                文件名
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-ink-600 uppercase tracking-wider">
                日期
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-ink-600 uppercase tracking-wider">
                分数
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-ink-600 uppercase tracking-wider">
                状态
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-ink-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-ink-200">
            <tr
              v-for="record in historyRecords"
              :key="record.id"
              class="hover:bg-ink-50 cursor-pointer transition-colors"
              @click="viewDetail(record)"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <svg class="w-5 h-5 text-ink-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div class="text-sm font-medium text-ink-800">
                    {{ record.fileName }}
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-ink-600">
                  {{ formatDate(record.date) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-semibold" :class="{
                  'text-green-600': record.score >= 80,
                  'text-yellow-600': record.score >= 60 && record.score < 80,
                  'text-red-600': record.score < 60
                }">
                  {{ record.score || 0 }}%
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span
                  class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                  :class="getStatusBadge(record.status).class"
                >
                  {{ getStatusBadge(record.status).text }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-ink-500">
                <button
                  @click.stop="viewDetail(record)"
                  class="text-ink-600 hover:text-ink-900 font-medium"
                >
                  查看详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail Modal (Placeholder) -->
    <div
      v-if="selectedRecord"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="selectedRecord = null"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6"
        @click.stop
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-ink-800">{{ selectedRecord.fileName }}</h2>
          <button
            @click="selectedRecord = null"
            class="text-ink-400 hover:text-ink-600"
          >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="space-y-3 text-sm">
          <div class="flex justify-between">
            <span class="text-ink-500">验证时间：</span>
            <span class="text-ink-800">{{ formatDate(selectedRecord.date) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-ink-500">分数：</span>
            <span class="font-semibold" :class="{
              'text-green-600': selectedRecord.score >= 80,
              'text-yellow-600': selectedRecord.score >= 60 && selectedRecord.score < 80,
              'text-red-600': selectedRecord.score < 60
            }">{{ selectedRecord.score || 0 }}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-ink-500">状态：</span>
            <span
              class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
              :class="getStatusBadge(selectedRecord.status).class"
            >
              {{ getStatusBadge(selectedRecord.status).text }}
            </span>
          </div>
        </div>
        <div class="mt-6 pt-4 border-t border-ink-200 text-center text-sm text-ink-500">
          完整报告功能即将上线
        </div>
      </div>
    </div>
  </div>
</template>
