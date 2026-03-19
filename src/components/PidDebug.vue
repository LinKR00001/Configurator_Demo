<template>
  <div class="pid-container">

    <!-- 标题栏 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>PID 调试</h1>
        <p class="page-subtitle">读取飞控三轴 PID 参数（MSG_ID=14）</p>
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
          @click="startPolling"
        >
          读取
        </button>

        <button
          v-if="connectionState.isConnected"
          :class="['btn-sm', 'btn-primary']"
          @click="startPolling"
        >
          设置
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
import { useConnection } from '@/composables/useConnection'
import { useGlobalSerialManager } from '@/composables/useGlobalSerialManager'

const { connectionState } = useConnection()
const { getInstance } = useGlobalSerialManager()

// ── MAVLink 协议常量 ──────────────────────────────────────────
const MAV_STX           = 0xFE
const MSG_ID_PID        = 14
const CRC_EXTRA_PID     = 158
const MSG_ID_COMMAND    = 14
const CRC_EXTRA_COMMAND = 58

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

// ── 字节缓冲区 ────────────────────────────────────────────────
let rxBuf = new Uint8Array(512)
let rxLen = 0
let txSeq = 0

// ── MAVLink X25 CRC ──────────────────────────────────────────
function crcAccumulate(byte: number, crc: number): number {
  let tmp = (byte ^ (crc & 0xFF)) & 0xFF
  tmp ^= (tmp << 4) & 0xFF
  return (((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xFFFF)
}

function calcCrc(buf: Uint8Array, start: number, end: number, extra: number): number {
  let crc = 0xFFFF
  for (let i = start; i < end; i++) crc = crcAccumulate(buf[i]!, crc)
  return crcAccumulate(extra, crc)
}

// 调整参数值（用于 + - 按钮）
function adjustValue(key: keyof PidData, delta: number) {
  const current = pid.value[key]
  if (typeof current === 'number') {
    // 保留3位小数精度处理，避免浮点数误差
    pid.value[key] = parseFloat((current + delta).toFixed(3))
  }
}

// ── MAVLink v1 帧构建 ─────────────────────────────────────────
function buildMavFrame(msgid: number, payload: Uint8Array, crcExtra: number): Uint8Array {
  const frame = new Uint8Array(payload.length + 8)
  frame[0] = MAV_STX; frame[1] = payload.length
  frame[2] = txSeq++ & 0xFF; frame[3] = 0; frame[4] = 0; frame[5] = msgid
  frame.set(payload, 6)
  const crc = calcCrc(frame, 1, 6 + payload.length, crcExtra)
  frame[6 + payload.length] = crc & 0xFF
  frame[7 + payload.length] = (crc >> 8) & 0xFF
  return frame
}

function buildQueryFrame(requestMsgId: number): Uint8Array {
  const payload = new Uint8Array(11)
  // const view = new DataView(payload.buffer)
  // view.setFloat32(0, 0, true); view.setFloat32(4, 0, true)
  // view.setUint16(8, requestMsgId, true); view.setUint8(10, 0)
  return buildMavFrame(MSG_ID_COMMAND, payload, CRC_EXTRA_COMMAND)
}

// ── 轮询控制 ─────────────────────────────────────────────────
let fpsTimerId:  ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL_MS = 1000

function startPolling() {
  if (isPolling.value) return
  isPolling.value = true; fpsFrames = 0; frameRate.value = 0

    const serial = getInstance()
    if (!serial.isConnected) return
    // 构建帧
    const frame = buildQueryFrame(MSG_ID_PID)
    const frame_d = new Uint8Array([0xFE, 0x0B, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x95, 0x14])
    console.log('发送查询帧:', frame_d)
    serial.send(frame_d)
    // await serial.send(buildQueryFrame(MSG_ID_PID))
    txCount.value++

  fpsTimerId = setInterval(() => { frameRate.value = fpsFrames; fpsFrames = 0 }, 1000)
}

function stopPolling() {
  isPolling.value = false
  if (fpsTimerId  !== null) { clearInterval(fpsTimerId);  fpsTimerId  = null }
  frameRate.value = 0
}

// ── PID payload 解析 ──────────────────────────────────────────
function parsePid(payload: Uint8Array) {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  pid.value = {
    rollP:  Math.round(dv.getFloat32(0,  true)),
    rollI:  Math.round(dv.getFloat32(4,  true)),
    rollD:  Math.round(dv.getFloat32(8,  true)),
    pitchP: Math.round(dv.getFloat32(12, true)),
    pitchI: Math.round(dv.getFloat32(16, true)),
    pitchD: Math.round(dv.getFloat32(20, true)),
    yawP:   dv.getFloat32(24, true),
    yawI:   Math.round(dv.getFloat32(28, true)),
    yawD:   Math.round(dv.getFloat32(32, true)),
    rollIMax:      payload[36]!,
    rollDCutfreq:  payload[37]!,
    pitchIMax:     payload[38]!,
    pitchDCutfreq: payload[39]!,
    yawIMax:       payload[40]!,
    yawDCutfreq:   payload[41]!,
  }
  received.value = true
  frameCount.value++
  fpsFrames++
  updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

// ── 帧解析 ────────────────────────────────────────────────────
function processBuffer() {
  let i = 0
  console.log('收到一包数据包')
  while (i < rxLen) {
    if (rxBuf[i] !== MAV_STX) { i++; continue }
    if (i + 6 > rxLen) break
    const pLen = rxBuf[i + 1]!
    const fLen = pLen + 8
    if (i + fLen > rxLen) break
    if (rxBuf[i + 5] === MSG_ID_PID) {
      console.log('接收到PID帧')
      const crc = calcCrc(rxBuf, i + 1, i + 6 + pLen, CRC_EXTRA_PID)
      if (rxBuf[i + 6 + pLen] === (crc & 0xFF) && rxBuf[i + 7 + pLen] === ((crc >> 8) & 0xFF)) {
        parsePid(rxBuf.slice(i + 6, i + 6 + pLen))
      }
    }
    i += fLen
  }
  
  if (i > 0 && i < rxLen) { rxBuf.copyWithin(0, i, rxLen); rxLen -= i }
  else if (i >= rxLen) rxLen = 0
}

function handleData(event: any) {
  const chunk: Uint8Array = event.data
  // console.log('[PidDebug RX]', chunk)
  if (!chunk?.length) return
  if (rxLen + chunk.length > rxBuf.length) {
    const next = new Uint8Array(Math.max(rxBuf.length * 2, rxLen + chunk.length))
    next.set(rxBuf.subarray(0, rxLen)); rxBuf = next
  }
  rxBuf.set(chunk, rxLen); rxLen += chunk.length; processBuffer()
}

onMounted(()  => { getInstance().addEventListener('data', handleData) })
onUnmounted(() => { stopPolling(); getInstance().removeEventListener('data', handleData) })
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