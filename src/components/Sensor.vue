<template>
  <div class="sensor-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>传感器数据</h1>
        <p class="page-subtitle">实时显示传感器数据</p>
      </div>
      <div class="header-right">
        <!-- 连接状态 -->
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span v-if="connectionState.isConnected">已连接</span>
          <span v-else>未连接</span>
        </div>
      </div>
    </div>

    <!-- 未连接提示 -->
    <div v-if="!connectionState.isConnected" class="not-connected">
      <span class="not-connected-icon">○</span>
      <p>请先通过顶部串口面板连接飞控</p>
    </div>

    <!-- 主内容：传感器数据面板 -->
    <template v-else>
      <div class="main-layout">

        <!-- ── 左侧：数据面板 ─────────────────────────────── -->
        <div class="data-col">

          <!-- 光流传感器 -->
          <div class="panel">
            <div class="panel-header">
              <h2>光流传感器（Optical Flow）</h2>
              <span class="updated-at" v-if="opticalFlowUpdatedAt">{{ opticalFlowUpdatedAt }}</span>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': opticalFlowActive }]">
                <span class="data-label">X 轴流量</span>
                <span class="data-value">{{ opticalFlowData.flowX.toFixed(4) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
              <div :class="['data-card', { 'data-card--active': opticalFlowActive }]">
                <span class="data-label">Y 轴流量</span>
                <span class="data-value">{{ opticalFlowData.flowY.toFixed(4) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
              <div :class="['data-card', { 'data-card--active': opticalFlowActive }]">
                <span class="data-label">置信度</span>
                <span class="data-value">{{ opticalFlowData.confidence }}</span>
                <span class="data-unit">%</span>
              </div>
            </div>
          </div>

          <!-- TOF 传感器 -->
          <div class="panel">
            <div class="panel-header">
              <h2>TOF 传感器（Time of Flight）</h2>
              <span class="updated-at" v-if="tofUpdatedAt">{{ tofUpdatedAt }}</span>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': tofActive }]">
                <span class="data-label">距离</span>
                <span class="data-value">{{ tofData.distance.toFixed(3) }}</span>
                <span class="data-unit">m</span>
              </div>
              <div :class="['data-card', { 'data-card--active': tofActive }]">
                <span class="data-label">置信度</span>
                <span class="data-value">{{ tofData.confidence }}</span>
                <span class="data-unit">%</span>
              </div>
            </div>
            <div class="tof-chart-card">
              <div class="tof-chart-meta">
                <span>最新值：{{ tofHistoryStats.latest.toFixed(3) }} m</span>
                <span>最新置信度：{{ tofData.confidence }} %</span>
                <span>最小值：{{ tofHistoryStats.min.toFixed(3) }} m</span>
                <span>最大值：{{ tofHistoryStats.max.toFixed(3) }} m</span>
              </div>
              <div class="tof-chart-legend">
                <span class="tof-chart-legend-item">
                  <span class="tof-chart-legend-swatch tof-chart-legend-swatch--distance"></span>
                  距离
                </span>
                <span class="tof-chart-legend-item">
                  <span class="tof-chart-legend-swatch tof-chart-legend-swatch--confidence"></span>
                  置信度
                </span>
              </div>
              <div class="tof-chart-shell">
                <svg
                  class="tof-chart"
                  :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
                  preserveAspectRatio="none"
                  aria-label="TOF 距离实时曲线"
                >
                  <line
                    :x1="CHART_PADDING_LEFT"
                    :x2="CHART_PADDING_LEFT"
                    :y1="CHART_PADDING_TOP"
                    :y2="CHART_HEIGHT - CHART_PADDING_BOTTOM"
                    class="tof-chart-axis"
                  />
                  <line
                    :x1="CHART_PADDING_LEFT"
                    :x2="CHART_WIDTH - CHART_PADDING_RIGHT"
                    :y1="CHART_HEIGHT - CHART_PADDING_BOTTOM"
                    :y2="CHART_HEIGHT - CHART_PADDING_BOTTOM"
                    class="tof-chart-axis"
                  />
                  <line
                    :x1="CHART_WIDTH - CHART_PADDING_RIGHT"
                    :x2="CHART_WIDTH - CHART_PADDING_RIGHT"
                    :y1="CHART_PADDING_TOP"
                    :y2="CHART_HEIGHT - CHART_PADDING_BOTTOM"
                    class="tof-chart-axis tof-chart-axis--confidence"
                  />
                  <line
                    v-for="line in tofChartGridLines"
                    :key="line.key"
                    :x1="CHART_PADDING_LEFT"
                    :x2="CHART_WIDTH - CHART_PADDING_RIGHT"
                    :y1="line.y"
                    :y2="line.y"
                    class="tof-chart-grid"
                  />
                  <text
                    v-for="tick in tofChartYAxisTicks"
                    :key="tick.key"
                    :x="CHART_PADDING_LEFT - 8"
                    :y="tick.y"
                    text-anchor="end"
                    dominant-baseline="middle"
                    class="tof-chart-label"
                  >
                    {{ tick.label }}
                  </text>
                  <text
                    v-for="tick in tofChartConfidenceTicks"
                    :key="tick.key"
                    :x="CHART_WIDTH - CHART_PADDING_RIGHT + 8"
                    :y="tick.y"
                    text-anchor="start"
                    dominant-baseline="middle"
                    class="tof-chart-label tof-chart-label--confidence"
                  >
                    {{ tick.label }}
                  </text>
                  <text
                    v-for="tick in tofChartXAxisTicks"
                    :key="tick.key"
                    :x="tick.x"
                    :y="CHART_HEIGHT - 8"
                    text-anchor="middle"
                    class="tof-chart-label"
                  >
                    {{ tick.label }}
                  </text>
                  <polygon
                    v-if="tofChartAreaPoints"
                    :points="tofChartAreaPoints"
                    class="tof-chart-area"
                  />
                  <polyline
                    v-if="tofChartPoints"
                    :points="tofChartPoints"
                    class="tof-chart-line"
                  />
                  <polyline
                    v-if="tofConfidenceChartPoints"
                    :points="tofConfidenceChartPoints"
                    class="tof-chart-line tof-chart-line--confidence"
                  />
                  <circle
                    v-if="tofChartLastPoint"
                    :cx="tofChartLastPoint.x"
                    :cy="tofChartLastPoint.y"
                    r="4"
                    class="tof-chart-dot"
                  />
                  <circle
                    v-if="tofConfidenceChartLastPoint"
                    :cx="tofConfidenceChartLastPoint.x"
                    :cy="tofConfidenceChartLastPoint.y"
                    r="4"
                    class="tof-chart-dot tof-chart-dot--confidence"
                  />
                </svg>
                <div v-if="!tofHistory.length" class="tof-chart-empty">等待 TOF 数据...</div>
              </div>
            </div>
          </div>

          <!-- 统计 -->
          <div class="panel panel--stat">
            <div class="stat-row">
              <span class="stat-item">已解析帧：<strong>{{ frameCount }}</strong></span>
              <span class="stat-item">光流：<strong>{{ opticalFlowFrameCount }}</strong></span>
              <span class="stat-item">TOF：<strong>{{ tofFrameCount }}</strong></span>
              <span class="stat-item">CRC 错误：<strong>{{ crcErrorCount }}</strong></span>
              <span class="stat-item">已发送请求：<strong>{{ txCount }}</strong></span>
            </div>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { useSensorInfo } from '@/ts/information/sensorInfo'

const { connectionState } = useSerial()

const CHART_WIDTH = 720
const CHART_HEIGHT = 220
const CHART_PADDING_LEFT = 52
const CHART_PADDING_RIGHT = 16
const CHART_PADDING_TOP = 18
const CHART_PADDING_BOTTOM = 30
const CHART_SAMPLE_INTERVAL_MS = 100

const {
  opticalFlowData,
  tofData,
  tofHistory,
  tofConfidenceHistory,
  frameCount,
  opticalFlowFrameCount,
  tofFrameCount,
  crcErrorCount,
  txCount,
  opticalFlowUpdatedAt,
  tofUpdatedAt,
  opticalFlowActive,
  tofActive,
} = useSensorInfo()

const tofHistoryStats = computed(() => {
  if (tofHistory.value.length === 0) {
    return {
      min: 0,
      max: 1,
      latest: 0,
    }
  }

  const min = Math.min(...tofHistory.value)
  const max = Math.max(...tofHistory.value)

  return {
    min,
    max: max === min ? max + 0.1 : max,
    latest: tofHistory.value[tofHistory.value.length - 1] ?? 0,
  }
})

const tofChartPoints = computed(() => {
  if (tofHistory.value.length === 0) return ''

  const plotWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM
  const range = Math.max(tofHistoryStats.value.max - tofHistoryStats.value.min, 0.001)
  const stepX = tofHistory.value.length > 1 ? plotWidth / (tofHistory.value.length - 1) : 0

  return tofHistory.value.map((value, index) => {
    const x = CHART_PADDING_LEFT + index * stepX
    const normalized = (value - tofHistoryStats.value.min) / range
    const y = CHART_HEIGHT - CHART_PADDING_BOTTOM - normalized * plotHeight
    return `${x},${y}`
  }).join(' ')
})

const tofChartAreaPoints = computed(() => {
  if (!tofChartPoints.value) return ''
  const baseline = CHART_HEIGHT - CHART_PADDING_BOTTOM
  return `${CHART_PADDING_LEFT},${baseline} ${tofChartPoints.value} ${CHART_WIDTH - CHART_PADDING_RIGHT},${baseline}`
})

const tofConfidenceChartPoints = computed(() => {
  if (tofConfidenceHistory.value.length === 0) return ''

  const plotWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM
  const stepX = tofConfidenceHistory.value.length > 1 ? plotWidth / (tofConfidenceHistory.value.length - 1) : 0

  return tofConfidenceHistory.value.map((value, index) => {
    const x = CHART_PADDING_LEFT + index * stepX
    const clampedValue = Math.min(100, Math.max(0, value))
    const normalized = clampedValue / 100
    const y = CHART_HEIGHT - CHART_PADDING_BOTTOM - normalized * plotHeight
    return `${x},${y}`
  }).join(' ')
})

const tofConfidenceChartLastPoint = computed(() => {
  if (!tofConfidenceChartPoints.value) return null
  const points = tofConfidenceChartPoints.value.split(' ')
  const point = points[points.length - 1]
  if (!point) return null
  const [x, y] = point.split(',')
  return {
    x: Number(x),
    y: Number(y),
  }
})

const tofChartLastPoint = computed(() => {
  if (!tofChartPoints.value) return null
  const points = tofChartPoints.value.split(' ')
  const point = points[points.length - 1]
  if (!point) return null
  const [x, y] = point.split(',')
  return {
    x: Number(x),
    y: Number(y),
  }
})

const tofChartGridLines = computed(() => {
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM
  return Array.from({ length: 4 }, (_, index) => ({
    key: `grid-${index}`,
    y: CHART_PADDING_TOP + (plotHeight / 3) * index,
  }))
})

const tofChartYAxisTicks = computed(() => {
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM
  const range = Math.max(tofHistoryStats.value.max - tofHistoryStats.value.min, 0.001)

  return Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3
    const value = tofHistoryStats.value.max - range * ratio
    const y = CHART_PADDING_TOP + plotHeight * ratio
    return {
      key: `y-${index}`,
      y,
      label: `${value.toFixed(3)} m`,
    }
  })
})

const tofChartXAxisTicks = computed(() => {
  const plotWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT
  const count = Math.max(tofHistory.value.length, 1)
  const durationSeconds = ((count - 1) * CHART_SAMPLE_INTERVAL_MS) / 1000

  return Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3
    const x = CHART_PADDING_LEFT + plotWidth * ratio
    const secondsAgo = durationSeconds * (1 - ratio)
    return {
      key: `x-${index}`,
      x,
      label: index === 3 ? '现在' : `-${secondsAgo.toFixed(1)}s`,
    }
  })
})

const tofChartConfidenceTicks = computed(() => {
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM
  return Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3
    const value = 100 - ratio * 100
    const y = CHART_PADDING_TOP + plotHeight * ratio
    return {
      key: `c-${index}`,
      y,
      label: `${Math.round(value)}%`,
    }
  })
})
</script>

<style scoped>
.sensor-container {
  padding: var(--spacing-2xl);
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── 主布局：左右分栏 ────────────────────────────────────── */
.main-layout {
  display: flex;
  gap: var(--spacing-xl);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 左侧数据列 */
.data-col {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: var(--spacing-sm);
}

/* ── 数据面板 ────────────────────────────────────────────── */
.panel {
  border-radius: 0;
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-light);
  background-color: transparent;
  padding: var(--spacing-lg) 0;
  flex-shrink: 0;
}
.panel:last-child { border-bottom: none; }
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: var(--spacing-md); margin-bottom: var(--spacing-md);
  border-left: 3px solid var(--primary-500); padding-left: var(--spacing-md);
}
.panel-header h2 { margin: 0; }
.updated-at { font-size: var(--font-size-sm); color: var(--text-disabled); font-family: 'Consolas', monospace; }

.data-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-sm); }
.data-card {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: var(--spacing-md);
  background-color: var(--surface-100); border: 1px solid var(--border-light);
  transition: border-color 0.15s, background-color 0.15s;
}
.data-card--active { border-color: var(--primary-500); }
.data-label { font-size: 11px; color: var(--text-disabled); text-align: center; }
.data-value {
  font-size: 18px; font-weight: 700; color: var(--primary-500);
  font-family: 'Consolas', 'Courier New', monospace;
}
.data-unit { font-size: 11px; color: var(--text-disabled); font-family: 'Consolas', monospace; }

.tof-chart-card {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--border-light);
  background-color: var(--surface-100);
}

.tof-chart-meta {
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

.tof-chart-legend {
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-md);
}

.tof-chart-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

.tof-chart-legend-swatch {
  width: 18px;
  height: 3px;
  border-radius: 999px;
}

.tof-chart-legend-swatch--distance {
  background-color: var(--primary-500);
}

.tof-chart-legend-swatch--confidence {
  background-color: #f59e0b;
}

.tof-chart-shell {
  position: relative;
  height: 220px;
}

.tof-chart {
  width: 100%;
  height: 100%;
  display: block;
}

.tof-chart-grid {
  stroke: var(--border-light);
  stroke-width: 1;
  stroke-dasharray: 4 6;
}

.tof-chart-axis {
  stroke: var(--border-medium);
  stroke-width: 1;
}

.tof-chart-axis--confidence {
  stroke: rgba(245, 158, 11, 0.7);
}

.tof-chart-label {
  fill: var(--text-disabled);
  font-size: 11px;
  font-family: 'Consolas', 'Courier New', monospace;
}

.tof-chart-label--confidence {
  fill: #b45309;
}

.tof-chart-area {
  fill: rgba(59, 130, 246, 0.12);
}

.tof-chart-line {
  fill: none;
  stroke: var(--primary-500);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tof-chart-line--confidence {
  stroke: #f59e0b;
  stroke-width: 2.5;
  stroke-dasharray: 8 5;
}

.tof-chart-dot {
  fill: var(--primary-500);
  stroke: var(--surface-0);
  stroke-width: 2;
}

.tof-chart-dot--confidence {
  fill: #f59e0b;
}

.tof-chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-disabled);
  font-size: var(--font-size-sm);
}

.panel--stat { padding: var(--spacing-md) 0; }
.stat-row { display: flex; gap: var(--spacing-lg); flex-wrap: wrap; }
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }

/* 标题栏 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--primary-500);
  margin-bottom: var(--spacing-lg);
  flex-shrink: 0;
}
.page-header-left h1 { margin-bottom: 2px; }
.page-subtitle { font-size: var(--font-size-sm); color: var(--text-disabled); margin: 0; }
.header-right { display: flex; align-items: center; gap: var(--spacing-md); flex-shrink: 0; }

/* 未连接 */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }
</style>