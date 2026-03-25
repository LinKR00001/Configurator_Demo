<template>
  <div class="gyro-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>陀螺仪</h1>
        <p class="page-subtitle">实时显示IMU相关数据</p>
      </div>
      <div class="header-right">
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

    <!-- 主内容 -->
    <template v-else>
      <div class="main-layout">
        <div class="data-col">

          <!-- 陀螺仪角速度 -->
          <div class="panel">
            <div class="panel-header">
              <h2>陀螺仪</h2>
              <span class="updated-at" v-if="imuUpdatedAt">{{ imuUpdatedAt }}</span>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">X（横滚轴）</span>
                <span class="data-value">{{ imuData.gyroX.toFixed(3) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Y（俯仰轴）</span>
                <span class="data-value">{{ imuData.gyroY.toFixed(3) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Z（偏航轴）</span>
                <span class="data-value">{{ imuData.gyroZ.toFixed(3) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
            </div>
          </div>

          <!-- 加速度计 -->
          <div class="panel">
            <div class="panel-header">
              <h2>加速度计</h2>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">X 轴</span>
                <span class="data-value">{{ imuData.accX.toFixed(3) }}</span>
                <span class="data-unit">g</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Y 轴</span>
                <span class="data-value">{{ imuData.accY.toFixed(3) }}</span>
                <span class="data-unit">g</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Z 轴</span>
                <span class="data-value">{{ imuData.accZ.toFixed(3) }}</span>
                <span class="data-unit">g</span>
              </div>
            </div>
          </div>

          <!-- 姿态角 -->
          <div class="panel">
            <div class="panel-header">
              <h2>姿态角</h2>
              <span class="updated-at" v-if="attitudeUpdatedAt">{{ attitudeUpdatedAt }}</span>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': attitudeActive }]">
                <span class="data-label">Roll（横滚）</span>
                <span class="data-value">{{ rollDeg.toFixed(1) }}</span>
                <span class="data-unit">°</span>
              </div>
              <div :class="['data-card', { 'data-card--active': attitudeActive }]">
                <span class="data-label">Pitch（俯仰）</span>
                <span class="data-value">{{ pitchDeg.toFixed(1) }}</span>
                <span class="data-unit">°</span>
              </div>
              <div :class="['data-card', { 'data-card--active': attitudeActive }]">
                <span class="data-label">Yaw（偏航）</span>
                <span class="data-value">{{ yawDeg.toFixed(1) }}</span>
                <span class="data-unit">°</span>
              </div>
            </div>
          </div>

          <!-- 统计 -->
          <div class="panel panel--stat">
            <div class="stat-row">
              <span class="stat-item">已解析帧：<strong>{{ frameCount }}</strong></span>
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
import { useGyroInfo } from '@/ts/information/gyroInfo'

const { connectionState } = useSerial()

const {
  imuData,
  frameCount,
  txCount,
  updatedAt: imuUpdatedAt,
  frameRate,
  imuActive,
  attitudeData,
  attitudeUpdatedAt,
  attitudeActive,
} = useGyroInfo()

const rollDeg  = computed(() => attitudeData.value.roll)
const pitchDeg = computed(() => attitudeData.value.pitch)
const yawDeg   = computed(() => attitudeData.value.yaw)
</script>

<style scoped>
.gyro-container {
  padding: var(--spacing-2xl);
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  box-sizing: border-box;
}

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
.conn-btn { flex-shrink: 0; }
.frame-rate {
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  color: var(--primary-500);
  background: var(--surface-200);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

/* 未连接 */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }

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
</style>
