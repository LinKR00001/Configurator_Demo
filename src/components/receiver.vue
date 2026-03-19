<template>
  <div class="receiver-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>接收机</h1>
        <p class="page-subtitle">实时显示遥控器通道数据（MSG_ID=7）</p>
      </div>
      <div class="header-right">
        <!-- RSSI -->
        <div v-if="isPolling" class="rssi-badge" :class="rssiClass">
          <span class="rssi-icon">▲</span>
          <span>{{ rssiText }}</span>
        </div>
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

    <template v-else>
      <!-- 通道列表 -->
      <div class="channels-panel">
        <div class="channels-header">
          <span class="col-name">通道</span>
          <span class="col-bar">数值范围</span>
          <span class="col-val">原始值</span>
        </div>

        <div
          v-for="ch in channels"
          :key="ch.index"
          :class="['channel-row', { 'channel-row--active': ch.active }]"
        >
          <!-- 通道标签 -->
          <div class="ch-label">
            <span class="ch-num">CH{{ ch.index }}</span>
            <span class="ch-name">{{ ch.name }}</span>
          </div>

          <!-- 进度条 -->
          <div class="ch-bar-wrap">
            <!-- 中点参考线 -->
            <div class="ch-bar-center"></div>
            <!-- 填充条：从中点向两侧延伸 -->
            <div
              class="ch-bar-fill"
              :style="barStyle(ch.value)"
            ></div>
            <!-- 当前位置指针 -->
            <div
              class="ch-bar-cursor"
              :style="{ left: barPercent(ch.value) + '%' }"
            ></div>
          </div>

          <!-- 原始数值 -->
          <div :class="['ch-value', { 'ch-value--active': ch.active }]">
            {{ ch.value }}
          </div>
        </div>
      </div>

      <!-- 底部统计 -->
      <div class="stats-row">
        <span class="stat-item">已接收帧：<strong>{{ frameCount }}</strong></span>
        <span class="stat-item">活跃通道数：<strong>{{ rcCount }}</strong></span>
        <span class="stat-item">
          RSSI：<strong :class="rssiClass">{{ rssiText }}</strong>
        </span>
        <span class="stat-item">已发送请求：<strong>{{ txCount }}</strong></span>
        <span class="stat-item" v-if="updatedAt">最后更新：<strong>{{ updatedAt }}</strong></span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConnection } from '@/composables/useConnection'
import { useGlobalSerialManager } from '@/composables/useGlobalSerialManager'

const { connectionState } = useConnection()
const { getInstance } = useGlobalSerialManager()

// ── MAVLink 协议常量 ─────────────────────────────────────────
const MAV_STX            = 0xFE
const MSG_ID_RC_CHANNELS = 7
const CRC_EXTRA_RC       = 45
const MSG_ID_COMMAND     = 8
const CRC_EXTRA_COMMAND  = 58

const POLL_INTERVAL_MS = 100  // 10 Hz

// RC 标准值域（PWM μs）
const RC_MIN = 1000
const RC_MAX = 2000
const RC_MID = 1500

// 通道名称（FPV 遥控标准布局）
const CHANNEL_NAMES = [
  'Roll',  'Pitch', 'Throttle', 'Yaw',
  'AUX1',  'AUX2',  'AUX3',     'AUX4',
  'AUX5',  'AUX6',  'AUX7',     'AUX8',
]

// ── 数据状态 ─────────────────────────────────────────────────
interface Channel {
  index:  number
  name:   string
  value:  number
  active: boolean
}

const channels = ref<Channel[]>(
  Array.from({ length: 12 }, (_, i) => ({
    index:  i + 1,
    name:   CHANNEL_NAMES[i]!,
    value:  RC_MID,
    active: false,
  }))
)

const rcCount    = ref(0)
const rssi       = ref(255)   // 255 = unknown
const frameCount = ref(0)
const txCount    = ref(0)
const updatedAt  = ref('')
const isPolling  = ref(false)
const frameRate  = ref(0)
let   fpsFrames  = 0

// ── RSSI 显示 ────────────────────────────────────────────────
const rssiText = computed(() => {
  if (rssi.value === 255 || !isPolling.value) return '—'
  return `${rssi.value}%`
})

const rssiClass = computed(() => {
  if (rssi.value === 255) return 'rssi--unknown'
  if (rssi.value >= 70)   return 'rssi--good'
  if (rssi.value >= 40)   return 'rssi--mid'
  return 'rssi--bad'
})

// ── 进度条计算 ────────────────────────────────────────────────
function barPercent(value: number): number {
  return Math.max(0, Math.min(100, (value - RC_MIN) / (RC_MAX - RC_MIN) * 100))
}

function barStyle(value: number): object {
  const pct    = barPercent(value)
  const center = 50
  if (pct >= center) {
    return { left: center + '%', width: (pct - center) + '%' }
  } else {
    return { left: pct + '%', width: (center - pct) + '%' }
  }
}

// ── 定时器句柄 ───────────────────────────────────────────────
let pollTimerId: ReturnType<typeof setInterval> | null = null
let fpsTimerId:  ReturnType<typeof setInterval> | null = null

// ── 字节缓冲区 ───────────────────────────────────────────────
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
  const view = new DataView(payload.buffer)
  view.setFloat32(0, 0, true); view.setFloat32(4, 0, true)
  view.setUint16(8, requestMsgId, true); view.setUint8(10, 0)
  return buildMavFrame(MSG_ID_COMMAND, payload, CRC_EXTRA_COMMAND)
}

// ── 轮询控制 ─────────────────────────────────────────────────
function startPolling() {
  if (isPolling.value) return
  isPolling.value = true; fpsFrames = 0; frameRate.value = 0

  pollTimerId = setInterval(async () => {
    const serial = getInstance()
    if (!serial.isConnected) return
    await serial.send(buildQueryFrame(MSG_ID_RC_CHANNELS))
    txCount.value++
  }, POLL_INTERVAL_MS)

  fpsTimerId = setInterval(() => { frameRate.value = fpsFrames; fpsFrames = 0 }, 1000)
}

function stopPolling() {
  isPolling.value = false
  if (pollTimerId !== null) { clearInterval(pollTimerId); pollTimerId = null }
  if (fpsTimerId  !== null) { clearInterval(fpsTimerId);  fpsTimerId  = null }
  frameRate.value = 0
}

// ── MAVLink 帧解析 ────────────────────────────────────────────
function readInt16LE(buf: Uint8Array, offset: number): number {
  return new DataView(buf.buffer, buf.byteOffset + offset, 2).getInt16(0, true)
}

function parseRcChannels(payload: Uint8Array) {
  // 12 个 int16 通道 + count(uint8) + rssi(uint8)
  const flashTimers_local: ReturnType<typeof setTimeout>[] = []
  for (let i = 0; i < 12; i++) {
    const val = readInt16LE(payload, i * 2)
    const ch  = channels.value[i]!
    const changed = ch.value !== val
    ch.value = val
    if (changed) {
      ch.active = true
      flashTimers_local.push(setTimeout(() => { ch.active = false }, 300))
    }
  }
  rcCount.value   = payload[24]!
  rssi.value      = payload[25]!
  frameCount.value++
  fpsFrames++
  updatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function processBuffer() {
  let i = 0
  while (i < rxLen) {
    if (rxBuf[i] !== MAV_STX) { i++; continue }
    if (i + 6 > rxLen) break

    const pLen = rxBuf[i + 1]!
    const fLen = pLen + 8
    if (i + fLen > rxLen) break

    if (rxBuf[i + 5] === MSG_ID_RC_CHANNELS) {
      const crc = calcCrc(rxBuf, i + 1, i + 6 + pLen, CRC_EXTRA_RC)
      if (rxBuf[i + 6 + pLen] === (crc & 0xFF) && rxBuf[i + 7 + pLen] === ((crc >> 8) & 0xFF)) {
        parseRcChannels(rxBuf.slice(i + 6, i + 6 + pLen))
      }
    }
    i += fLen
  }
  if (i > 0 && i < rxLen) { rxBuf.copyWithin(0, i, rxLen); rxLen -= i }
  else if (i >= rxLen) rxLen = 0
}

function handleData(event: any) {
  const chunk: Uint8Array = event.data
  if (!chunk?.length) return
  if (rxLen + chunk.length > rxBuf.length) {
    const next = new Uint8Array(Math.max(rxBuf.length * 2, rxLen + chunk.length))
    next.set(rxBuf.subarray(0, rxLen)); rxBuf = next
  }
  rxBuf.set(chunk, rxLen); rxLen += chunk.length; processBuffer()
}

onMounted(() => { getInstance().addEventListener('data', handleData) })
onUnmounted(() => { stopPolling(); getInstance().removeEventListener('data', handleData) })
</script>

<style scoped>
.receiver-container {
  padding: var(--spacing-2xl);
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 0;
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

/* RSSI 徽章 */
.rssi-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  padding: 2px 10px;
  border-radius: var(--radius-sm);
}
.rssi--good    { color: #22c55e; background: rgba(34,197,94,0.1); }
.rssi--mid     { color: #f59e0b; background: rgba(245,158,11,0.1); }
.rssi--bad     { color: #ef4444; background: rgba(239,68,68,0.1); }
.rssi--unknown { color: var(--text-disabled); background: var(--surface-200); }

/* 未连接 */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }

/* 通道面板 */
.channels-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-light);
}

.channels-header {
  display: grid;
  grid-template-columns: 120px 1fr 72px;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-lg);
  background-color: var(--surface-200);
  border-bottom: 1px solid var(--border-light);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-disabled);
}

.channel-row {
  display: grid;
  grid-template-columns: 120px 1fr 72px;
  gap: var(--spacing-md);
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
  background-color: var(--surface-100);
  transition: background-color 0.15s;
}
.channel-row:last-child { border-bottom: none; }
.channel-row--active { background-color: rgba(var(--primary-rgb, 59,130,246), 0.06); }

/* 通道标签 */
.ch-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.ch-num {
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-primary);
  min-width: 36px;
}
.ch-name {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

/* 进度条 */
.ch-bar-wrap {
  position: relative;
  height: 12px;
  background-color: var(--surface-300);
  border-radius: 2px;
  overflow: visible;
}

/* 中点参考线 */
.ch-bar-center {
  position: absolute;
  left: 50%;
  top: -3px;
  bottom: -3px;
  width: 1px;
  background-color: var(--surface-500);
  z-index: 1;
}

/* 数值填充条（从中点向两侧延伸） */
.ch-bar-fill {
  position: absolute;
  top: 0;
  height: 100%;
  background-color: var(--primary-500);
  border-radius: 2px;
  transition: left 0.06s linear, width 0.06s linear;
  opacity: 0.85;
}

/* 当前位置指针 */
.ch-bar-cursor {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 3px;
  margin-left: -1.5px;
  background-color: var(--primary-400);
  border-radius: 2px;
  transition: left 0.06s linear;
  z-index: 2;
  box-shadow: 0 0 4px rgba(96,165,250,0.6);
}

/* 数值显示 */
.ch-value {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  text-align: right;
  transition: color 0.15s;
}
.ch-value--active { color: var(--primary-500); }

/* 底部统计 */
.stats-row {
  display: flex;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
  padding: var(--spacing-md) 0;
  border-top: 1px solid var(--border-light);
  margin-top: var(--spacing-lg);
}
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }
</style>
