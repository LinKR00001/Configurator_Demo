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
import { ref, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'

const { getInstance, connectionState } = useSerial()

// ── 类型定义 ─────────────────────────────────────────────────
interface OpticalFlowData {
  flowX: number
  flowY: number
  confidence: number
}

interface TofData {
  distance: number
  confidence: number
}

const POLL_INTERVAL_MS = 100  // 10 Hz

// ── 数据状态 ─────────────────────────────────────────────────
const opticalFlowData = ref<OpticalFlowData>({
  flowX: 0,
  flowY: 0,
  confidence: 0,
})

const tofData = ref<TofData>({
  distance: 0,
  confidence: 0,
})

const frameCount = ref(0)
const opticalFlowFrameCount = ref(0)
const tofFrameCount = ref(0)
const crcErrorCount = ref(0)
const txCount = ref(0)

const opticalFlowUpdatedAt = ref('')
const tofUpdatedAt = ref('')
const opticalFlowActive = ref(false)
const tofActive = ref(false)


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