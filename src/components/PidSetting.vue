<template>
  <div class="pid-container">

    <!-- 标题栏 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>PID调试</h1>
        <p class="page-subtitle">读取飞控三轴PID参数</p>
      </div>
      <div class="header-right">
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span>{{ connectionState.isConnected ? '已连接' : '未连接' }}</span>
        </div>
        <div v-if="isPolling && frameRate > 0" class="frame-rate">{{ frameRate }} Hz</div>
        <span v-if="updatedAt" class="updated-at">更新于 {{ updatedAt }}</span>
        <button
          v-if="connectionState.isConnected"
          :class="['btn-sm', 'btn-primary']"
          @click="readPidOnce"
        >
          读取
        </button>

        <button
          v-if="connectionState.isConnected"
          :class="['btn-sm', 'btn-primary']"
          @click="writePidOnce"
        >
          设置
        </button>

        <button
          v-if="connectionState.isConnected"
          :class="['btn-sm', 'btn-danger']"
          @click="resetPidOnce"
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

    <!-- PID 数值展示 -->
    <div v-else class="pid-display">

      <!-- Roll -->
      <div class="axis-card roll-card">
        <div class="axis-label">
          <span class="axis-dot roll-dot"></span>
          <span class="axis-name">Roll</span>
          <span class="axis-cn">横滚轴</span>
        </div>
        <div class="pid-values">
          <div class="pid-item">
            <span class="pid-key p-key">P</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.rollP" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item">
            <span class="pid-key i-key">I</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.rollI" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item">
            <span class="pid-key d-key">D</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.rollD" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item aux">
            <span class="pid-key">I_Max</span>
            <span class="pid-val">{{ pid.rollIMax }}</span>
          </div>
          <div class="pid-item aux">
            <span class="pid-key">D_Cutfreq</span>
            <span class="pid-val">{{ pid.rollDCutfreq }}</span>
          </div>
        </div>
      </div>

      <!-- Pitch -->
      <div class="axis-card pitch-card">
        <div class="axis-label">
          <span class="axis-dot pitch-dot"></span>
          <span class="axis-name">Pitch</span>
          <span class="axis-cn">俯仰轴</span>
        </div>
        <div class="pid-values">
          <div class="pid-item">
            <span class="pid-key p-key">P</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.pitchP" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item">
            <span class="pid-key i-key">I</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.pitchI" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item">
            <span class="pid-key d-key">D</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.pitchD" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item aux">
            <span class="pid-key">I_Max</span>
            <span class="pid-val">{{ pid.pitchIMax }}</span>
          </div>
          <div class="pid-item aux">
            <span class="pid-key">D_Cutfreq</span>
            <span class="pid-val">{{ pid.pitchDCutfreq }}</span>
          </div>
        </div>
      </div>

      <!-- Yaw -->
      <div class="axis-card yaw-card">
        <div class="axis-label">
          <span class="axis-dot yaw-dot"></span>
          <span class="axis-name">Yaw</span>
          <span class="axis-cn">偏航轴</span>
        </div>
        <div class="pid-values">
          <div class="pid-item">
            <span class="pid-key p-key">P</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.yawP" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item">
            <span class="pid-key i-key">I</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.yawI" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item">
            <span class="pid-key d-key">D</span>
            <div class="input-group">
              <input type="number" v-model.number="pid.yawD" step="1" class="pid-input" min="0" max="100" />
            </div>
          </div>
          <div class="pid-item aux">
            <span class="pid-key">I_Max</span>
            <span class="pid-val">{{ pid.yawIMax }}</span>
          </div>
          <div class="pid-item aux">
            <span class="pid-key">D_Cutfreq</span>
            <span class="pid-val">{{ pid.yawDCutfreq }}</span>
          </div>
        </div>
      </div>
    
        <!-- 底部状态栏 -->
      <div class="stats-bar">
        <span class="stat-item">已接收帧：<strong>{{ frameCount }}</strong></span>
        <span class="stat-item">已发送请求：<strong>{{ txCount }}</strong></span>
      </div>
    </div>

    

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { MSP_CMD, useMsp, type MspPidFrame } from '@/ts/msp/msp'
import { ENABLE_MSP_PROTOCOL } from '@/ts/msp/protocolFlags'

const { getInstance, connectionState } = useSerial()
const { onPidMessage, send } = useMsp()

// ── PID 数据 ──────────────────────────────────────────────────
interface PidData {
  rollP: number;  rollI: number;  rollD: number
  rollIMax: number; rollDCutfreq: number
  pitchP: number; pitchI: number; pitchD: number
  pitchIMax: number; pitchDCutfreq: number
  yawP: number;  yawI: number;  yawD: number
  yawIMax: number; yawDCutfreq: number
}

let pid = ref<PidData>({
  rollP: 0, rollI: 0, rollD: 0, rollIMax: 0, rollDCutfreq: 0,
  pitchP: 0, pitchI: 0, pitchD: 0, pitchIMax: 0, pitchDCutfreq: 0,
  yawP: 0, yawI: 0, yawD: 0, yawIMax: 0, yawDCutfreq: 0,
})

const received    = ref(false)
const isPolling   = ref(false)
const updatedAt   = ref('')
const txCount     = ref(0)
const frameCount  = ref(0)
const frameRate   = ref(0)
let   fpsFrames   = 0

// 调整参数值（用于 + - 按钮）
function adjustValue(key: keyof PidData, delta: number) {
  const current = pid.value[key]
  if (typeof current === 'number') {
    // 保留3位小数精度处理，避免浮点数误差
    pid.value[key] = parseFloat((current + delta).toFixed(3))
  }
}

function timestamp() {
  const now = new Date()
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `${now.toLocaleTimeString('zh-CN', { hour12: false })}.${ms}`
}

function toPidByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function buildSetPidPayload(): Uint8Array {
  return new Uint8Array([
    toPidByte(pid.value.rollP),
    toPidByte(pid.value.rollI),
    toPidByte(pid.value.rollD),
    toPidByte(pid.value.pitchP),
    toPidByte(pid.value.pitchI),
    toPidByte(pid.value.pitchD),
    toPidByte(pid.value.yawP),
    toPidByte(pid.value.yawI),
    toPidByte(pid.value.yawD),
  ])
}

function applyPid(data: MspPidFrame) {
  pid.value = {
    rollP: data.rollP,
    rollI: data.rollI,
    rollD: data.rollD,
    pitchP: data.pitchP,
    pitchI: data.pitchI,
    pitchD: data.pitchD,
    yawP: data.yawP,
    yawI: data.yawI,
    yawD: data.yawD,
    rollIMax: 0,
    rollDCutfreq: 0,
    pitchIMax: 0,
    pitchDCutfreq: 0,
    yawIMax: 0,
    yawDCutfreq: 0,
  }
  received.value = true
  frameCount.value++
  fpsFrames++
  frameRate.value = fpsFrames
  updatedAt.value = timestamp()
}

async function readPidOnce() {
  if (!ENABLE_MSP_PROTOCOL) return
  if (!connectionState.value.isConnected) return
  isPolling.value = true
  const ok = await send(MSP_CMD.PID)
  if (ok) txCount.value++
  isPolling.value = false
}

async function writePidOnce() {
  if (!ENABLE_MSP_PROTOCOL) return
  if (!connectionState.value.isConnected) return
  isPolling.value = true
  const payload = buildSetPidPayload()
  const ok = await send(MSP_CMD.SET_PID, payload)
  if (ok) {
    txCount.value++
    await readPidOnce()
  }
  isPolling.value = false
}

async function resetPidOnce() {
  if (!ENABLE_MSP_PROTOCOL) return
  if (!connectionState.value.isConnected) return
  isPolling.value = true
  // resetIndex == 1: 恢复 PID 默认值
  const ok = await send(MSP_CMD.RESET_CONF, new Uint8Array([1]))
  if (ok) {
    txCount.value++
    await readPidOnce()
  }
  isPolling.value = false
}

let unbindPidMessage: (() => void) | null = null

onMounted(()  => {
  if (!ENABLE_MSP_PROTOCOL) return
  unbindPidMessage = onPidMessage((data) => {
    applyPid(data)
  })
  // 进入界面后自动读取一次
  readPidOnce()
})
onUnmounted(() => {
  unbindPidMessage?.()
  unbindPidMessage = null
})
</script>

<style scoped>
.pid-container {
  padding: var(--spacing-2xl);
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
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
  flex-shrink: 0;
}
.page-header-left h1 { margin-bottom: 2px; }
.page-subtitle { font-size: var(--font-size-sm); color: var(--text-disabled); margin: 0; }

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.btn-sm {
  padding: 5px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-base);
}
.btn-sm.btn-secondary {
  background: var(--surface-200);
  color: var(--text-secondary);
  border-color: var(--border-light);
}
.btn-sm.btn-secondary:hover { background: var(--surface-300); }
.btn-sm.btn-danger {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
  border-color: rgba(239,68,68,0.3);
}
.btn-sm.btn-danger:hover { background: rgba(239,68,68,0.2); }

.frame-rate {
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  color: var(--primary-500);
  background: var(--surface-200);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}
.updated-at {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
  font-family: 'Consolas', monospace;
}


/* 未连接 */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }

/* ── 空状态提示 ──────────────────────────────────────────── */
.empty-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-disabled);
  font-size: var(--font-size-sm);
  border: 1px dashed var(--border-light);
  border-radius: var(--radius-lg);
}

/* ── PID 数值展示 ────────────────────────────────────────── */
.pid-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.axis-card {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  background: var(--surface-50);
  border-left-width: 4px;
}
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

.pid-values {
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.pid-input {
  width: 60px;
  padding: 4px 8px;
  text-align: center;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--surface-100);
  color: var(--text-primary);
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}


.pid-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 90px;
}
.pid-item.aux .pid-key {
  background: var(--surface-300);
  color: var(--text-disabled);
  font-size: 11px;
}

.pid-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 800;
  flex-shrink: 0;
}
.p-key { background: rgba(96,165,250,0.18); color: #60a5fa; }
.i-key { background: rgba(52,211,153,0.18); color: #34d399; }
.d-key { background: rgba(251,191,36,0.18); color: #fbbf24; }

.pid-val {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

/* ── 底部状态栏 ──────────────────────────────────────────── */
.stats-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
  padding: var(--spacing-sm) 0;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }
</style>