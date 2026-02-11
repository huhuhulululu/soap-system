<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => ['pain', 'rom', 'strength']
  }
})

const emit = defineEmits(['update:modelValue'])

const allIndicators = [
  { key: 'pain', label: 'Pain', color: '#ef4444' },
  { key: 'tenderness', label: 'Tenderness', color: '#f59e0b' },
  { key: 'tightness', label: 'Tightness', color: '#eab308' },
  { key: 'spasm', label: 'Spasm', color: '#84cc16' },
  { key: 'rom', label: 'ROM', color: '#10b981' },
  { key: 'strength', label: 'Strength', color: '#06b6d4' },
  { key: 'frequency', label: 'Frequency', color: '#8b5cf6' }
]

const selectedIndicators = ref([...props.modelValue])

watch(() => props.modelValue, (newVal) => {
  selectedIndicators.value = [...newVal]
}, { deep: true })

function toggleIndicator(key) {
  const index = selectedIndicators.value.indexOf(key)
  if (index > -1) {
    selectedIndicators.value = selectedIndicators.value.filter(k => k !== key)
  } else {
    selectedIndicators.value = [...selectedIndicators.value, key]
  }
  emit('update:modelValue', selectedIndicators.value)
}

function isSelected(key) {
  return selectedIndicators.value.includes(key)
}
</script>

<template>
  <div class="indicator-filter">
    <div class="flex items-center gap-3 flex-wrap">
      <span class="text-sm font-medium text-ink-600">Indicators:</span>
      <div class="flex items-center gap-2 flex-wrap">
        <label
          v-for="indicator in allIndicators"
          :key="indicator.key"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
          :class="isSelected(indicator.key)
            ? 'bg-white border-ink-300 shadow-sm'
            : 'bg-paper-100 border-ink-100 opacity-60 hover:opacity-100'"
        >
          <input
            type="checkbox"
            :checked="isSelected(indicator.key)"
            @change="toggleIndicator(indicator.key)"
            class="w-4 h-4 rounded border-ink-300 text-ink-600 focus:ring-2 focus:ring-ink-500 focus:ring-offset-0 cursor-pointer"
          />
          <span class="flex items-center gap-1.5">
            <span
              class="w-3 h-3 rounded-full"
              :style="{ backgroundColor: indicator.color }"
            ></span>
            <span class="text-sm font-medium text-ink-700">{{ indicator.label }}</span>
          </span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.indicator-filter {
  padding: 1rem;
  background: white;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
}

input[type="checkbox"] {
  transition: all 0.15s ease;
}

label:active {
  transform: scale(0.98);
}
</style>
