<template>
  <div class="rate-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>RATE设置</h1>
        <p class="page-subtitle">配置飞行器姿态控制参数</p>
      </div>
      <div class="header-right">
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span>{{ connectionState.isConnected ? '已连接' : '未连接' }}</span>
        </div>
        <span v-if="lastUpdateTime" class="updated-at">更新于 {{ lastUpdateTime }}</span>
        <button
          v-if="connectionState.isConnected"
          :class="['btn-sm', 'btn-primary', { loading: isLoading }]"
          :disabled="isLoading"
          @click="readRateOnce"
        >
          读取
        </button>
        <button
          v-if="connectionState.isConnected"
          :class="['btn-sm', 'btn-primary', { loading: isLoading }]"
          :disabled="isLoading"
          @click="writeRateOnce"
        >
          设置
        </button>
        <button
          v-if="connectionState.isConnected"
          :class="['btn-sm', 'btn-danger', { loading: isLoading }]"
          :disabled="isLoading"
          @click="resetRateOnce"
        >
          恢复默认
        </button>
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

        <!-- ── 左侧：Rate 参数面板 ─────────────────────────────── -->
        <div class="rate-col">

          <!-- Rate 设置 -->
          <div class="panel">
            <div class="panel-header">
              <h2>RATE设置</h2>
              <span class="updated-at" v-if="lastUpdateTime">{{ lastUpdateTime }}</span>
            </div>

            <!-- Roll 轴 -->
            <div class="axis-card roll-card">
              <div class="axis-label">
                <span class="axis-dot roll-dot"></span>
                <span class="axis-name">Roll</span>
                <span class="axis-cn">横滚轴</span>
              </div>
              <div class="param-grid">
                <div class="param-item">
                  <span class="param-label">中央灵敏度</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.rollCenter"
                      step="1"
                      min="0"
                      max="200"
                      class="param-input"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">最大角速率</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.rollRate"
                      step="1"
                      min="0"
                      max="2000"
                      class="param-input"
                    >
                    <span class="param-unit">°/s</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.rollExpo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pitch 轴 -->
            <div class="axis-card pitch-card">
              <div class="axis-label">
                <span class="axis-dot pitch-dot"></span>
                <span class="axis-name">Pitch</span>
                <span class="axis-cn">俯仰轴</span>
              </div>
              <div class="param-grid">
                <div class="param-item">
                  <span class="param-label">中央灵敏度</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.pitchCenter"
                      step="1"
                      min="0"
                      max="200"
                      class="param-input"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">最大角速率</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.pitchRate"
                      step="1"
                      min="0"
                      max="2000"
                      class="param-input"
                    >
                    <span class="param-unit">°/s</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.pitchExpo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Yaw 轴 -->
            <div class="axis-card yaw-card">
              <div class="axis-label">
                <span class="axis-dot yaw-dot"></span>
                <span class="axis-name">Yaw</span>
                <span class="axis-cn">偏航轴</span>
              </div>
              <div class="param-grid">
                <div class="param-item">
                  <span class="param-label">中央灵敏度</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.yawCenter"
                      step="1"
                      min="0"
                      max="200"
                      class="param-input"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">最大角速率</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.yawRate"
                      step="1"
                      min="0"
                      max="2000"
                      class="param-input"
                    >
                    <span class="param-unit">°/s</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.yawExpo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── 右侧：油门参数 + 可视化预览 ─────────────────── -->
        <div class="right-col">

          <!-- 速度档位 -->
          <div class="panel">
            <div class="panel-header">
              <h2>速度档位</h2>
            </div>
            <div class="speed-selector">
              <button
                v-for="level in speedLevels"
                :key="level.value"
                :class="['speed-btn', `speed-btn--${level.value.toLowerCase()}`, { active: speedLevel === level.value }]"
              >
                {{ level.label }}
              </button>
            </div>
          </div>

          <!-- 油门参数设置 -->
          <div class="panel">
            <div class="panel-header">
              <h2>油门参数</h2>
            </div>

            <div class="throttle-grid">
              <div class="throttle-item">
                <div class="throttle-info">
                  <span class="throttle-label">油门中值</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="throttle.mid"
                      step="1"
                      min="0"
                      max="100"
                      class="param-input"
                      @input="updateThrottleMid"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
              </div>

              <div class="throttle-item">
                <div class="throttle-info">
                  <span class="throttle-label">油门 Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="throttle.expo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                      @input="updateThrottleExpo"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { MSP_CMD, useMsp, encodeSetRcTuningPayload, type MspRcTuningFrame } from '@/ts/information/msp'
import { ENABLE_MSP_PROTOCOL } from '@/ts/information/protocolFlags'

const { connectionState } = useSerial()
const { onRcTuningMessage, send } = useMsp()

// ── 状态数据 ─────────────────────────────────────────────────
const lastUpdateTime = ref('')
const isLoading = ref(false)
const txCount = ref(0)

// 速度档位
const speedLevel = ref<'SLOW' | 'MID' | 'FAST'>('MID')
const speedLevels = [
  { value: 'SLOW', label: 'SLOW' },
  { value: 'MID',  label: 'MID'  },
  { value: 'FAST', label: 'FAST' },
] as const

// Rate 参数
const rate = reactive({
  rollCenter: 0, rollRate: 0, rollExpo: 0,
  pitchCenter: 0, pitchRate: 0, pitchExpo: 0,
  yawCenter: 0, yawRate: 0, yawExpo: 0
})

// 油门参数
const throttle = reactive({
  mid: 0,
  expo: 0
})

// 保留原始 FC 字段（写回时保持不变）
let preservedRaw: MspRcTuningFrame | null = null

// ── 辅助函数 ─────────────────────────────────────────────────
function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)) }

function updateThrottleMid()  { throttle.mid  = clamp(throttle.mid,  0,    100) }
function updateThrottleExpo() { throttle.expo = clamp(throttle.expo, -100, 100) }
function timestamp() { return new Date().toLocaleTimeString('zh-CN', { hour12: false }) }

// ── 将 FC 数据应用到界面 ─────────────────────────────────────
function applyRcTuning(d: MspRcTuningFrame) {
  preservedRaw = { ...d }

  rate.rollCenter  = d.rcRateRoll
  rate.rollExpo    = d.rcExpoRoll
  rate.rollRate    = d.rateRoll

  rate.pitchCenter = d.rcRatePitch
  rate.pitchExpo   = d.rcExpoPitch
  rate.pitchRate   = d.ratePitch

  rate.yawCenter   = d.rcRateYaw
  rate.yawExpo     = d.rcExpoYaw
  rate.yawRate     = d.rateYaw

  throttle.mid     = d.thrMid
  throttle.expo    = d.thrExpo

  // ratesType: 0=SLOW, 1=MID, 2=FAST
  const ratesTypeMap = ['SLOW', 'MID', 'FAST'] as const
  speedLevel.value = ratesTypeMap[d.ratesType] ?? 'MID'

  lastUpdateTime.value = timestamp()
}

// ── 构建 SET 负载 ─────────────────────────────────────────────
function buildSetRcTuningPayload(): Uint8Array {
  const base: MspRcTuningFrame = preservedRaw ?? {
    rcRateRoll: 50,   rcExpoRoll: 0,   rateRoll: 0,   rateLimitRoll: 720,
    rcRatePitch: 50,  rcExpoPitch: 0,  ratePitch: 0,  rateLimitPitch: 720,
    rcRateYaw: 50,    rcExpoYaw: 0,    rateYaw: 0,    rateLimitYaw: 360,
    thrMid: 50,       thrExpo: 0,      thrHover: 50,
    tpaRate: 0,       tpaBreakpoint: 0,
    throttleLimitType: 0, throttleLimitPercent: 100,
    ratesType: 0,
  }
  return encodeSetRcTuningPayload({
    ...base,
    rcRateRoll:    clamp(rate.rollCenter,  0, 255),
    rcExpoRoll:    clamp(rate.rollExpo,    0, 100),
    rateRoll:      clamp(rate.rollRate,    0, 255),
    rcRatePitch:   clamp(rate.pitchCenter, 0, 255),
    rcExpoPitch:   clamp(rate.pitchExpo,   0, 100),
    ratePitch:     clamp(rate.pitchRate,   0, 255),
    rcRateYaw:     clamp(rate.yawCenter,   0, 255),
    rcExpoYaw:     clamp(rate.yawExpo,     0, 100),
    rateYaw:       clamp(rate.yawRate,     0, 255),
    thrMid:        clamp(throttle.mid,     0, 100),
    thrExpo:       clamp(throttle.expo,    0, 100),
  })
}

// ── 读取 / 写入 ───────────────────────────────────────────────
async function readRateOnce() {
  if (!ENABLE_MSP_PROTOCOL) return
  if (!connectionState.value.isConnected) return
  isLoading.value = true
  const ok = await send(MSP_CMD.RC_TUNING)
  if (ok) txCount.value++
  isLoading.value = false
}

async function writeRateOnce() {
  if (!ENABLE_MSP_PROTOCOL) return
  if (!connectionState.value.isConnected) return
  isLoading.value = true
  const payload = buildSetRcTuningPayload()
  const ok = await send(MSP_CMD.SET_RC_TUNING, payload)
  if (ok) {
    txCount.value++
    await readRateOnce()
  }
  isLoading.value = false
}

async function resetRateOnce() {
  if (!ENABLE_MSP_PROTOCOL) return
  if (!connectionState.value.isConnected) return
  isLoading.value = true
  // resetIndex == 2: 恢复 RATE 默认值
  const ok = await send(MSP_CMD.RESET_CONF, new Uint8Array([2]))
  if (ok) {
    txCount.value++
    await readRateOnce()
  }
  isLoading.value = false
}

// ── 生命周期 ──────────────────────────────────────────────────
let unbindRcTuning: (() => void) | null = null

onMounted(() => {
  if (!ENABLE_MSP_PROTOCOL) return
  unbindRcTuning = onRcTuningMessage((data) => {
    applyRcTuning(data)
  })
  // 进入界面后自动读取一次
  readRateOnce()
})

onUnmounted(() => {
  unbindRcTuning?.()
  unbindRcTuning = null
})
</script>

<style scoped>
.rate-container {
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

/* 左侧 Rate 参数列 */
.rate-col {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: var(--spacing-sm);
}

/* 右侧油门参数 + 曲线预览列 */
.right-col {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  overflow-y: auto;
}

/* ── 面板样式 (与Gyro/Motor一致) ─────────────────────────── */
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
.panel-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
.updated-at { font-size: var(--font-size-sm); color: var(--text-disabled); font-family: 'Consolas', monospace; }

/* ── 轴卡片样式 (与PidSetting一致) ──────────────────────── */
.axis-card {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--surface-50);
  border-left-width: 4px;
  margin-bottom: var(--spacing-md);
}
.axis-card:last-child { margin-bottom: 0; }
.roll-card  { border-left-color: #f87171; }
.pitch-card { border-left-color: #60a5fa; }
.yaw-card   { border-left-color: #34d399; }

.axis-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}
.axis-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.roll-dot  { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,0.5); }
.pitch-dot { background: #60a5fa; box-shadow: 0 0 6px rgba(96,165,250,0.5); }
.yaw-dot   { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,0.5); }

.axis-name {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-primary);
}
.axis-cn {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

/* ── 参数网格 ────────────────────────────────────────────── */
.param-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.param-label {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
  text-align: center;
}

.param-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.param-input {
  width: 60px;
  padding: 6px 8px;
  text-align: center;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--surface-100);
  color: var(--text-primary);
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.param-unit {
  font-size: 12px;
  color: var(--text-disabled);
  font-family: 'Consolas', monospace;
}

/* ── 速度档位 ────────────────────────────────────────────── */
.speed-selector {
  display: flex;
  gap: var(--spacing-sm);
}

.speed-btn {
  flex: 1;
  padding: 8px 0;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--surface-100);
  color: var(--text-disabled);
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-family: 'Consolas', monospace;
  letter-spacing: 0.8px;
  cursor: default;
  pointer-events: none;
}

.speed-btn--slow.active  { background: #1e3a2f; border-color: #34d399; color: #34d399; }
.speed-btn--mid.active   { background: #1e2f4a; border-color: #60a5fa; color: #60a5fa; }
.speed-btn--fast.active  { background: #3a1e1e; border-color: #f87171; color: #f87171; }

/* ── 油门参数 ────────────────────────────────────────────── */
.throttle-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
}

.throttle-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}


.throttle-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.throttle-label {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

/* ── 统计数据 ────────────────────────────────────────────── */
.panel--stat { padding: var(--spacing-md) 0; }
.stat-row { display: flex; gap: var(--spacing-lg); flex-wrap: wrap; }
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }

/* ── 3D 模型卡片 (与Gyro/Motor一致) ───────────────────── */
.model-card {
  background-color: var(--surface-950);
  border: 1px solid var(--surface-800);
  display: flex;
  flex-direction: column;
  min-height: 300px;
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

/* ── 曲线可视化场景 ──────────────────────────────────────── */
.scene-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.curve-display {
  width: 100%;
  height: 100%;
}

.rate-curve-svg {
  width: 100%;
  height: 100%;
}

/* ── 状态读数 (与Gyro/Motor一致) ────────────────────────── */
.rate-readout {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--surface-800);
  flex-shrink: 0;
  background-color: var(--surface-900);
}

.readout-item {
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
  font-size: 14px;
  font-weight: 700;
  color: var(--surface-300);
  font-family: 'Consolas', 'Courier New', monospace;
  transition: color 0.15s;
  min-width: 60px;
  text-align: center;
}

.readout-divider {
  width: 1px;
  height: 32px;
  background-color: var(--surface-800);
}

/* ── 按钮 (与PidSetting一致) ────────────────────────────── */
.btn-sm {
  padding: 5px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-base);
}
.btn-sm.btn-primary {
  background: var(--primary-500);
  color: #fff;
  border-color: var(--primary-500);
}
.btn-sm.btn-primary:hover:not(:disabled) { background: var(--primary-600); border-color: var(--primary-600); }
.btn-sm.btn-danger {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
  border-color: rgba(239,68,68,0.3);
}
.btn-sm.btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm.loading { opacity: 0.7; cursor: wait; }
.updated-at { font-size: var(--font-size-sm); color: var(--text-disabled); font-family: 'Consolas', monospace; }
</style>
