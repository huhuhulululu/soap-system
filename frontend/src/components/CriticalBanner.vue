<script setup>
defineProps({
  count: {
    type: Number,
    required: true
  }
})

defineEmits(['click'])
</script>

<template>
  <div
    v-if="count > 0"
    class="bg-red-600 text-white px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-red-700 transition-colors"
    @click="$emit('click')"
  >
    <div class="flex items-center gap-3">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span class="font-medium">
        不合格：检测到 {{ count }} 个严重问题
      </span>
    </div>
    <div class="flex items-center gap-2 text-sm opacity-90">
      <span>查看详情</span>
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
</template>
