<template>
  <div class="motor-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>电机测试</h1>
        <p class="page-subtitle">测试电机状态 (MSP_SET_MOTOR)</p>
      </div>
      <div class="header-right">
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span>{{ connectionState.isConnected ? '已连接' : '未连接' }}</span>
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

        <!-- ── 左侧：控制面板 ─────────────────────────────── -->
        <div class="control-col">

          <!-- 安全开关区域 -->
          <div class="panel">
            <div class="panel-header">
              <h2>电机控制</h2>
            </div>
            <div class="safety-control">
              <div class="safety-switch-container">
                <div class="safety-label">电机控制开关</div>
                <button
                  :class="['safety-btn', safetyEnabled ? 'active' : '']"
                  @click="toggleSafety"
                >
                  {{ safetyEnabled ? 'ON' : 'OFF' }}
                </button>

                <button
                  v-if="safetyEnabled"
                  class="stop-all-btn"
                  @click="stopAllMotors"
                >
                  紧急停止
                </button>
              </div>
            </div>
          </div>

          <!-- 电机控制网格 -->
          <div class="panel">
            <div class="panel-header">
              <h2>电机输出</h2>
              <span class="updated-at" v-if="lastUpdateTime">{{ lastUpdateTime }}</span>
            </div>
            <div class="motor-grid">
              <div v-for="(motor, index) in motors" :key="index" class="motor-card">
                <div class="motor-header">
                  <span class="motor-index">M{{ index + 1 }}</span>
                </div>

                <!-- 垂直滑块容器 -->
                <div class="slider-vertical-box">
                  <div class="slider-wrapper">
                    <input
                      type="range"
                      v-model.number="motor.value"
                      min="1000"
                      max="2000"
                      step="1"
                      class="motor-slider vertical"
                      :style="{ background: getVerticalSliderBackground(motor.value) }"
                      @input="handleMotorChange(index)"
                      :disabled="!safetyEnabled"
                    />
                  </div>
                </div>

                <div class="motor-footer">
                  <span class="motor-value-display">{{ motor.value }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 危险警告横幅 -->
          <div class="panel">
            <div class="safety-warning">
              <span>警告：测试前请务必拆下所有螺旋桨！！！ </span>
            </div>
          </div>

          <!-- 统计数据 -->
          <div class="panel panel--stat">
            <div class="stat-row">
              <span class="stat-item">已发送命令：<strong>{{ txCount }}</strong></span>
              <span class="stat-item">控制状态：<strong>{{ safetyEnabled ? '启用' : '禁用' }}</strong></span>
              <span class="stat-item">安全模式：<strong :class="safetyEnabled ? 'text-danger' : ''">{{ safetyEnabled ? '已激活' : '未激活' }}</strong></span>
            </div>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { MSP_CMD, useMsp } from '@/ts/msp/msp'

const { getInstance, connectionState } = useSerial()

// ── 状态数据 ─────────────────────────────────────────────────
const safetyEnabled = ref(false)
const lastUpdateTime = ref('')
const txCount = ref(0)

const motors = reactive([
  { value: 1000 },
  { value: 1000 },
  { value: 1000 },
  { value: 1000 }
])

// ── 计算属性 ─────────────────────────────────────────────────
const hasActiveMotors = computed(() => motors.some(m => m.value > 1000))

// ── MSP 发送逻辑 ──────────────────────────────────────────────
const { send: sendMsp } = useMsp()
let sendTimeout: ReturnType<typeof setTimeout> | null = null

function handleMotorChange(index: number) {
  const m = motors[index]
  if (!m) return
  if (m.value < 1000) m.value = 1000
  if (m.value > 2000) m.value = 2000

  if (!safetyEnabled.value) return

  if (sendTimeout) clearTimeout(sendTimeout)
  sendTimeout = setTimeout(() => {
    void sendMotorCommands()
  }, 20)
}

async function sendMotorCommands() {
  const serial = getInstance()
  if (!serial.getConnected()) return

  // 飞控按 getMotorCount() 次 sbufReadU16 读取，前端按电机数发送对应 U16 即可。
  const payload = new Uint8Array(motors.length * 2)
  const view = new DataView(payload.buffer)
  motors.forEach((m, i) => {
    const clamped = Math.max(1000, Math.min(2000, Math.round(m.value)))
    view.setUint16(i * 2, clamped, true)
  })

  const ok = await sendMsp(MSP_CMD.SET_MOTOR, payload)
  if (!ok) return

  txCount.value++
  lastUpdateTime.value = timestamp()
}

function stopAllMotors() {
  motors.forEach(m => m.value = 1000)
  void sendMotorCommands()
}

function toggleSafety() {
  safetyEnabled.value = !safetyEnabled.value
  if (!safetyEnabled.value) {
    stopAllMotors()
  }
}

// ── 样式辅助函数 ─────────────────────────────────────────────
function getVerticalSliderBackground(value: number) {
  const percent = ((value - 1000) / 1000) * 100
  const clampedPercent = Math.max(0, Math.min(100, percent))
  return `linear-gradient(to right, #d1d5db ${clampedPercent}%, #e5e7eb ${clampedPercent}%)`
}

function getSpeedPercent(value: number): number {
  return ((value - 1000) / 1000) * 100
}

function getSpeedColor(value: number): string {
  const percent = ((value - 1000) / 1000) * 100
  if (percent > 75) return '#ef4444'
  if (percent > 50) return '#f59e0b'
  if (percent > 25) return '#22c55e'
  return '#38bdf8'
}

function getSpinSpeed(value: number): string {
  const percent = ((value - 1000) / 1000) * 100
  if (percent < 10) return '0s'
  const duration = Math.max(0.05, 1 - percent / 100)
  return `${duration}s`
}

function timestamp() { return new Date().toLocaleTimeString('zh-CN', { hour12: false }) }

// ── 数据处理 ─────────────────────────────────────────────────
function handleData(event: any) {
  const chunk: Uint8Array = event.data
  if (!chunk?.length) return
}

onMounted(() => { getInstance().addEventListener('data', handleData) })
onUnmounted(() => {
  getInstance().removeEventListener('data', handleData)
  if (safetyEnabled.value) stopAllMotors()
})
</script>

<style scoped>
.motor-container {
  padding: var(--spacing-2xl);
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  box-sizing: border-box;
}

/* ── 标题栏 ──────────────────────────────────────────────── */
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

/* ── 未连接 ──────────────────────────────────────────────── */
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

/* 左侧控制列 */
.control-col {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: var(--spacing-sm);
}

/* 右侧模型列 */
.model-col {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

/* ── 面板样式 (与Gyro一致) ───────────────────────────────── */
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

/* ── 警告横幅 ────────────────────────────────────────────── */
.safety-warning {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(161, 47, 47, 0.3);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: #ef4444;
  font-weight: 600;
}

/* ── 安全控制区域 ────────────────────────────────────────── */
.safety-control {
  background: var(--surface-50);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-lg);
}

.safety-switch-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
}

.safety-label { font-weight: 700; color: var(--text-primary); }

.safety-btn {
  padding: 6px 20px;
  border-radius: var(--radius-md);
  border: 2px solid var(--border-light);
  background: var(--surface-200);
  color: var(--text-secondary);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.safety-btn.active {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

.stop-all-btn {
  margin-left: auto;
  padding: 6px 16px;
  background: #1f2937;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}
.stop-all-btn:hover { background: #374151; }

/* ── 电机网格布局 ────────────────────────────────────────── */
.motor-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md);
}

.motor-card {
  background: var(--surface-100);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  transition: border-color 0.15s;
}
.motor-card:hover { border-color: var(--primary-500); }

.motor-header {
  text-align: center;
  font-weight: 700;
  color: var(--text-primary);
}

.motor-footer {
  width: 100%;
  display: flex;
  justify-content: center;
}

.motor-value-display {
  font-family: 'Consolas', monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-500);
  text-align: center;
  padding: 4px 12px;
  background: var(--surface-200);
  border-radius: var(--radius-sm);
  min-width: 60px;
}

/* ── 垂直滑块样式 ────────────────────────────────────────── */
.slider-vertical-box {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.slider-wrapper {
  position: relative;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.motor-slider.vertical {
  position: absolute;
  width: 140px;
  height: 8px;
  -webkit-appearance: none;
  appearance: none;
  outline: none;
  border-radius: 4px;
  cursor: pointer;
  transform: rotate(-90deg);
  background: transparent;
}

.motor-slider.vertical::-webkit-slider-runnable-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #e5e7eb;
}

.motor-slider.vertical::-moz-range-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #e5e7eb;
}

.motor-slider.vertical::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: white;
  border: 3px solid var(--primary-500);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  margin-top: -8px;
}

.motor-slider.vertical::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: white;
  border: 3px solid var(--primary-500);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

.motor-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── 统计数据 ────────────────────────────────────────────── */
.panel--stat { padding: var(--spacing-md) 0; }
.stat-row { display: flex; gap: var(--spacing-lg); flex-wrap: wrap; }
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }
.text-danger { color: #ef4444 !important; }

/* ── 3D 模型卡片 (与Gyro一致) ───────────────────────────── */
.model-card {
  background-color: var(--surface-950);
  border: 1px solid var(--surface-800);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 420px;
  overflow: hidden;
}

.model-title {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--surface-400);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border-bottom: 1px solid var(--surface-800);
  flex-shrink: 0;
}

/* ── 电机状态场景 ────────────────────────────────────────── */
.scene-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  gap: var(--spacing-md);
}

.motor-diagram {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.motor-svg {
  width: 260px;
  height: 210px;
}

.motor-active {
  filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));
}

.propeller {
  transform-origin: center;
  animation: none;
}

.propeller.spinning {
  animation: spin var(--duration, 0.5s) linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── 电机转速指示条 ──────────────────────────────────────── */
.motor-speed-indicators {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--surface-900);
  border-radius: var(--radius-md);
}

.speed-indicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.speed-label {
  width: 24px;
  font-size: 11px;
  font-weight: 600;
  color: var(--surface-400);
  font-family: 'Consolas', monospace;
}

.speed-bar-container {
  flex: 1;
  height: 8px;
  background: var(--surface-800);
  border-radius: 4px;
  overflow: hidden;
}

.speed-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.1s, background-color 0.2s;
}

.speed-value {
  width: 40px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: var(--surface-300);
  text-align: right;
}

/* ── 电机状态数字显示 (与Gyro一致) ──────────────────────── */
.motor-readout {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--surface-800);
  flex-shrink: 0;
  background-color: var(--surface-900);
}

.motor-readout-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.readout-label {
  font-size: 10px;
  color: var(--surface-500);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.readout-val {
  font-size: 16px;
  font-weight: 700;
  color: var(--surface-300);
  font-family: 'Consolas', 'Courier New', monospace;
  transition: color 0.15s;
  min-width: 50px;
  text-align: center;
}

.readout-val--active { color: #22c55e; }

.readout-divider {
  width: 1px;
  height: 32px;
  background-color: var(--surface-800);
}
</style>
