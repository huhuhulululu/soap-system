<script setup>
import { computed, watch, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts'

const props = defineProps({
  timeline: {
    type: Array,
    required: true
  },
  selectedIndicators: {
    type: Array,
    default: () => ['pain', 'rom', 'strength']
  }
})

const emit = defineEmits(['error-clicked'])

const chartKey = ref(0)

// Normalization functions
const normalize = {
  pain: (value) => {
    const numValue = typeof value === 'object' ? value.value : value
    return (10 - numValue) * 10
  },

  tenderness: (value) => {
    const scale = typeof value === 'string' ? parseInt(value.replace('+', '')) : value
    const mapping = { 1: 75, 2: 50, 3: 25, 4: 0 }
    return mapping[scale] ?? 0
  },

  tightness: (value) => {
    const val = typeof value === 'string' ? value.toLowerCase() : value
    const mapping = { 'mild': 100, 'moderate': 50, 'severe': 0 }
    return mapping[val] ?? mapping['moderate'] ?? 50
  },

  spasm: (value) => {
    const scale = typeof value === 'string' ? parseInt(value.replace('+', '')) : value
    const mapping = { 1: 75, 2: 50, 3: 25, 4: 0 }
    return mapping[scale] ?? 0
  },

  rom: (indicator) => {
    if (indicator.summary) {
      const match = indicator.summary.match(/(\d+)/)
      return match ? parseInt(match[1]) : 50
    }
    return 50
  },

  strength: (indicator) => {
    if (indicator.summary) {
      const match = indicator.summary.match(/(\d+)/)
      if (match) {
        const value = parseInt(match[1])
        return (value / 5) * 100
      }
    }
    return 50
  },

  frequency: (value) => {
    const val = typeof value === 'string' ? value.toLowerCase() : value
    const mapping = {
      'intermittent': 100,
      'occasional': 75,
      'frequent': 50,
      'constant': 25
    }
    return mapping[val] ?? 50
  }
}

const indicatorColors = {
  pain: '#ef4444',
  tenderness: '#f59e0b',
  tightness: '#eab308',
  spasm: '#84cc16',
  rom: '#10b981',
  strength: '#06b6d4',
  frequency: '#8b5cf6'
}

const indicatorLabels = {
  pain: 'Pain',
  tenderness: 'Tenderness',
  tightness: 'Tightness',
  spasm: 'Spasm',
  rom: 'ROM',
  strength: 'Strength',
  frequency: 'Frequency'
}

// Prepare chart data
const chartData = computed(() => {
  try {
    // Build categories array immutably
    const categories = props.timeline.map((entry) =>
      `Visit ${entry.visitIndex + 1}\n${entry.visitDate}`
    )

    // Collect error points immutably
    let errorPoints = []

    // Build series array immutably
    const series = props.selectedIndicators.map(indicator => {
      const data = props.timeline.map((entry, index) => {
        const indicatorData = entry.indicators?.[indicator]
        if (!indicatorData) return null

        let normalizedValue = 0

        if (indicator === 'pain') {
          normalizedValue = normalize.pain(indicatorData.value)
        } else if (indicator === 'rom' || indicator === 'strength') {
          normalizedValue = normalize[indicator](indicatorData)
        } else {
          normalizedValue = normalize[indicator](indicatorData.value)
        }

        // Collect error points immutably using spread
        if (indicatorData.ok === false) {
          errorPoints = [...errorPoints, {
            x: categories[index],
            y: normalizedValue,
            marker: {
              size: 8,
              fillColor: '#ef4444',
              strokeColor: '#fff',
              strokeWidth: 2,
              shape: 'circle'
            },
            label: {
              borderColor: '#ef4444',
              offsetY: 0,
              style: {
                color: '#fff',
                background: '#ef4444',
                fontSize: '10px',
                fontWeight: 600,
                padding: {
                  left: 4,
                  right: 4,
                  top: 2,
                  bottom: 2
                }
              },
              text: '!'
            }
          }]
        }

        return {
          x: categories[index],
          y: normalizedValue,
          meta: {
            visitIndex: entry.visitIndex,
            visitDate: entry.visitDate,
            visitType: entry.visitType,
            indicator: indicator,
            originalValue: indicatorData.value || indicatorData.summary,
            ok: indicatorData.ok,
            trend: indicatorData.trend,
            errors: entry.errors
          }
        }
      })

      return {
        name: indicatorLabels[indicator],
        data: data,
        color: indicatorColors[indicator]
      }
    })

    return { series, categories, annotations: { points: errorPoints } }
  } catch (error) {
    console.error('Error generating chart data:', error)
    return { series: [], categories: [], annotations: { points: [] } }
  }
})

const chartOptions = computed(() => {
  return {
    chart: {
      type: 'line',
      height: 400,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: false,
          reset: true
        }
      },
      animations: {
        enabled: true,
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        }
      },
      events: {
        markerClick: function(event, chartContext, { seriesIndex, dataPointIndex, config }) {
          const point = chartData.value.series[seriesIndex].data[dataPointIndex]
          if (point.meta.ok === false) {
            emit('error-clicked', {
              visitIndex: point.meta.visitIndex,
              indicator: point.meta.indicator,
              errors: point.meta.errors
            })
          }
        }
      }
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    markers: {
      size: 5,
      hover: {
        size: 7
      }
    },
    xaxis: {
      categories: chartData.value.categories,
      labels: {
        style: {
          fontSize: '11px',
          fontWeight: 500
        },
        rotate: -45,
        rotateAlways: true
      },
      title: {
        text: 'Visit Timeline',
        style: {
          fontSize: '13px',
          fontWeight: 600
        }
      }
    },
    yaxis: {
      min: 0,
      max: 100,
      tickAmount: 5,
      labels: {
        formatter: function(value) {
          return Math.round(value)
        },
        style: {
          fontSize: '12px'
        }
      },
      title: {
        text: 'Normalized Score (0-100)',
        style: {
          fontSize: '13px',
          fontWeight: 600
        }
      }
    },
    tooltip: {
      shared: false,
      intersect: true,
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const point = chartData.value.series[seriesIndex].data[dataPointIndex]
        const meta = point.meta

        return `
          <div class="custom-tooltip">
            <div class="tooltip-header">
              <strong>${meta.visitType}</strong>
              <span class="visit-badge">Visit ${meta.visitIndex + 1}</span>
            </div>
            <div class="tooltip-body">
              <div class="tooltip-row">
                <span class="label">Date:</span>
                <span class="value">${meta.visitDate}</span>
              </div>
              <div class="tooltip-row">
                <span class="label">Indicator:</span>
                <span class="value">${indicatorLabels[meta.indicator]}</span>
              </div>
              <div class="tooltip-row">
                <span class="label">Original Value:</span>
                <span class="value">${meta.originalValue}</span>
              </div>
              <div class="tooltip-row">
                <span class="label">Normalized Score:</span>
                <span class="value">${Math.round(point.y)}/100</span>
              </div>
              <div class="tooltip-row">
                <span class="label">Trend:</span>
                <span class="value">${meta.trend}</span>
              </div>
              ${meta.ok === false ? '<div class="error-badge">⚠ Has Errors</div>' : ''}
            </div>
          </div>
        `
      }
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '13px',
      fontWeight: 500,
      markers: {
        width: 12,
        height: 12,
        radius: 6
      },
      itemMargin: {
        horizontal: 12,
        vertical: 8
      }
    },
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      },
      padding: {
        top: 0,
        right: 20,
        bottom: 0,
        left: 10
      }
    },
    annotations: chartData.value.annotations
  }
})

watch(() => [props.timeline, props.selectedIndicators], () => {
  chartKey.value++
}, { deep: true })
</script>

<template>
  <div class="trend-chart-container">
    <div v-if="timeline.length === 0" class="empty-state">
      <p class="text-sm text-ink-500">No timeline data available</p>
    </div>
    <div v-else-if="selectedIndicators.length === 0" class="empty-state">
      <p class="text-sm text-ink-500">Please select at least one indicator to display</p>
    </div>
    <div v-else class="chart-wrapper">
      <VueApexCharts
        :key="chartKey"
        type="line"
        height="400"
        :options="chartOptions"
        :series="chartData.series"
      />
    </div>
  </div>
</template>

<style scoped>
.trend-chart-container {
  background: white;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
  padding: 1.5rem;
  min-height: 450px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.chart-wrapper {
  width: 100%;
}

:deep(.apexcharts-tooltip) {
  background: white;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  border-radius: 0.5rem;
  overflow: hidden;
}

:deep(.custom-tooltip) {
  padding: 0;
  min-width: 220px;
}

:deep(.tooltip-header) {
  background: #f9fafb;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

:deep(.visit-badge) {
  background: #3b82f6;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

:deep(.tooltip-body) {
  padding: 0.75rem 1rem;
}

:deep(.tooltip-row) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.813rem;
}

:deep(.tooltip-row:last-child) {
  margin-bottom: 0;
}

:deep(.tooltip-row .label) {
  color: #6b7280;
  font-weight: 500;
}

:deep(.tooltip-row .value) {
  color: #111827;
  font-weight: 600;
  text-align: right;
}

:deep(.error-badge) {
  margin-top: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: #fef2f2;
  color: #ef4444;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  border: 1px solid #fee2e2;
}

:deep(.apexcharts-marker) {
  cursor: pointer;
  transition: all 0.2s ease;
}

:deep(.apexcharts-marker:hover) {
  transform: scale(1.2);
}
</style>
