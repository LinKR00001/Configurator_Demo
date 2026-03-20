<template>
  <div class="receiver-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>接收机</h1>
        <p class="page-subtitle">实时显示遥控器通道数据</p>
      </div>
      <div class="header-right">
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span>{{ connectionState.isConnected ? '已连接' : '未连接' }}</span>
        </div>
        <div v-if="frameRate > 0" class="frame-rate">{{ frameRate }} Hz</div>
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

        <!-- ── 左侧：通道数据面板 ─────────────────────────────── -->
        <div class="control-col">

          <!-- 控制按钮面板 -->
          <div class="panel">
            <div class="panel-header">
              <h2>接收机控制</h2>
              <span class="updated-at" v-if="updatedAt">{{ updatedAt }}</span>
            </div>
            <div class="control-buttons">
              <button class="btn-secondary" @click="startBind">
                <span>对频</span>
              </button>
            </div>
          </div>

          <!-- 通道数据面板 -->
          <div class="panel">
            <div class="panel-header">
              <h2>遥控通道</h2>
            </div>

            <!-- 主通道 (1-4) -->
            <div class="channel-group">
              <div class="channel-group-title">主控制通道</div>
              <div class="channel-list">
                <div
                  v-for="ch in mainChannels"
                  :key="ch.index"
                  :class="['channel-card', { 'channel-card--active': ch.active }]"
                >
                  <div class="channel-info">
                    <span class="channel-num">{{ ch.name }}</span>
                    <span class="channel-label">{{ getChannelLabel(ch.index) }}</span>
                  </div>
                  <div class="channel-bar-container">
                    <div class="channel-bar-bg">
                      <div class="channel-bar-center"></div>
                      <div
                        class="channel-bar-fill"
                        :style="getBarStyle(ch.value)"
                      ></div>
                      <div
                        class="channel-bar-cursor"
                        :style="{ left: getBarPercent(ch.value) + '%' }"
                      ></div>
                    </div>
                  </div>
                  <div :class="['channel-value', { 'channel-value--active': ch.active }]">
                    {{ ch.value }}
                  </div>
                </div>
              </div>
            </div>

            <!-- AUX通道 (5-12) -->
            <div class="channel-group">
              <div class="channel-group-title">AUX 通道</div>
              <div class="channel-grid">
                <div
                  v-for="ch in auxChannels"
                  :key="ch.index"
                  :class="['channel-mini-card', { 'channel-mini-card--active': ch.active }]"
                >
                  <div class="channel-mini-info">
                    <span class="channel-mini-num">CH{{ ch.index }}</span>
                    <span class="channel-mini-name">{{ ch.name }}</span>
                  </div>
                  <div class="channel-mini-bar-container">
                    <div
                      class="channel-mini-bar"
                      :style="{ width: getBarPercent(ch.value) + '%' }"
                    ></div>
                  </div>
                  <div :class="['channel-mini-value', { 'channel-mini-value--active': ch.active }]">
                    {{ ch.value }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 统计数据 -->
          <div class="panel panel--stat">
            <div class="stat-row">
              <span class="stat-item">已接收帧：<strong>{{ frameCount }}</strong></span>
              <span class="stat-item">活跃通道：<strong>{{ rcCount }}</strong></span>
              <span class="stat-item">
                RSSI：
                <strong :class="rssiClass">{{ rssiText }}</strong>
              </span>
              <span class="stat-item">已发送请求：<strong>{{ txCount }}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'

const { getInstance, connectionState } = useSerial()

// ── MAVLink 协议常量 ─────────────────────────────────────────
const MAV_STX            = 0xFE
const MSG_ID_RC_CHANNELS = 7
const CRC_EXTRA_RC       = 45
const MSG_ID_COMMAND     = 8
const CRC_EXTRA_COMMAND  = 58
const MSG_ID_BIND        = 5

const POLL_INTERVAL_MS = 100  // 10 Hz

// RC 标准值域（PWM μs）
const RC_MIN = 1000
const RC_MAX = 2000
const RC_MID = 1500

// 通道名称
const CHANNEL_NAMES = [
  'Roll', 'Pitch', 'Yaw', 'Throttle',
  'AUX1', 'AUX2', 'AUX3', 'AUX4',
  'AUX5', 'AUX6', 'AUX7', 'AUX8',
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

const mainChannels = computed(() => channels.value.slice(0, 4))
const auxChannels = computed(() => channels.value.slice(4, 12))

const rcCount    = ref(0)
const rssi       = ref(255)
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

// ── 通道标签 ────────────────────────────────────────────────
function getChannelLabel(index: number): string {
  const labels: Record<number, string> = {
    1: '横滚',
    2: '俯仰',
    3: '偏航',
    4: '油门',
  }
  return labels[index] || ''
}

// ── 进度条计算 ───────────────────────────────────────────────
function getBarPercent(value: number): number {
  return Math.max(0, Math.min(100, (value - RC_MIN) / (RC_MAX - RC_MIN) * 100))
}

function getBarStyle(value: number): Record<string, string> {
  const pct    = getBarPercent(value)
  const center = 50
  if (pct >= center) {
    return { left: center + '%', width: (pct - center) + '%' }
  } else {
    return { left: pct + '%', width: (center - pct) + '%' }
  }
}

// ── 对频功能 ─────────────────────────────────────────────────
function startBind() {
  const serial = getInstance()
  if (!serial.getConnected()) return

  // 构建对频帧
  const payload = new Uint8Array(11)
  const view = new DataView(payload.buffer)
  view.setFloat32(0, 0, true)
  view.setFloat32(4, 0, true)
  view.setUint16(8, MSG_ID_BIND, true)
  view.setUint8(10, 0)

  const frame = buildMavFrame(MSG_ID_COMMAND, payload, CRC_EXTRA_COMMAND)
  serial.send(frame)
  txCount.value++
  updatedAt.value = timestamp()
}

// ── 定时器句柄 ───────────────────────────────────────────────
let pollTimerId: ReturnType<typeof setInterval> | null = null
let fpsTimerId:  ReturnType<typeof setInterval> | null = null

// ── 字节缓冲区 ───────────────────────────────────────────────
let rxBuf = new Uint8Array(512)
let rxLen = 0
let txSeq = 0

// ── MAVLink X25 CRC ─────────────────────────────────────────
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
    if (!serial.getConnected()) return
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
  updatedAt.value = timestamp()
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

function timestamp() { return new Date().toLocaleTimeString('zh-CN', { hour12: false }) }

onMounted(() => {
  getInstance().addEventListener('data', handleData)
  startPolling()
})
onUnmounted(() => {
  stopPolling()
  getInstance().removeEventListener('data', handleData)
})
</script>

<style scoped>
.receiver-container {
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

.frame-rate {
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  color: var(--primary-500);
  background: var(--surface-200);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

/* ── 未连接 ──────────────────────────────────────────────── */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }

/* ── 主布局 ────────────────────────────────────── */
.main-layout {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 控制列 */
.control-col {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── 面板样式 (与Gyro/Motor/RateSetting一致) ─────────────── */
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

/* ── 控制按钮 ────────────────────────────────────────────── */
.control-buttons {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.btn-bind {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px 20px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-bind:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
}

.btn-bind:active {
  transform: translateY(0);
}

.btn-icon {
  font-size: 16px;
}

.btn-secondary {
  padding: 8px 16px;
  background: var(--surface-200);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--surface-300);
}

/* ── 通道组 ──────────────────────────────────────────────── */
.channel-group {
  margin-bottom: var(--spacing-lg);
}
.channel-group:last-child { margin-bottom: 0; }

.channel-group-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-disabled);
  margin-bottom: var(--spacing-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── 主通道卡片 ──────────────────────────────────────────── */
.channel-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.channel-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-100);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  transition: border-color 0.15s, background-color 0.15s;
}
.channel-card--active {
  border-color: var(--primary-500);
  background: rgba(59, 130, 246, 0.05);
}

.channel-info {
  display: flex;
  flex-direction: column;
  min-width: 70px;
}

.channel-num {
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--primary-500);
}

.channel-label {
  font-size: 11px;
  color: var(--text-disabled);
}

.channel-bar-container {
  flex: 1;
}

.channel-bar-bg {
  position: relative;
  height: 12px;
  background: var(--surface-300);
  border-radius: 6px;
}

.channel-bar-center {
  position: absolute;
  left: 50%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: var(--text-disabled);
  transform: translateX(-50%);
}

.channel-bar-fill {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--primary-500);
  border-radius: 6px;
  opacity: 0.8;
}

.channel-bar-cursor {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 4px;
  background: var(--primary-400);
  border-radius: 2px;
  transform: translateX(-50%);
  box-shadow: 0 0 6px rgba(96, 165, 250, 0.6);
}

.channel-value {
  font-family: 'Consolas', monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-secondary);
  min-width: 50px;
  text-align: right;
}
.channel-value--active { color: var(--primary-500); }

/* ── AUX 通道网格 ────────────────────────────────────────── */
.channel-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-sm);
}

.channel-mini-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--spacing-sm);
  background: var(--surface-100);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s;
}
.channel-mini-card--active { border-color: var(--primary-500); }

.channel-mini-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.channel-mini-num {
  font-family: 'Consolas', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary-500);
}

.channel-mini-name {
  font-size: 10px;
  color: var(--text-disabled);
}

.channel-mini-bar-container {
  height: 6px;
  background: var(--surface-300);
  border-radius: 3px;
  overflow: hidden;
}

.channel-mini-bar {
  height: 100%;
  background: var(--primary-500);
  border-radius: 3px;
  transition: width 0.1s;
}

.channel-mini-value {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
}
.channel-mini-value--active { color: var(--primary-500); }

/* ── 统计数据 ────────────────────────────────────────────── */
.panel--stat { padding: var(--spacing-md) 0; }
.stat-row { display: flex; gap: var(--spacing-lg); flex-wrap: wrap; }
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }

/* RSSI 颜色 */
.rssi--good    { color: #22c55e; }
.rssi--mid     { color: #f59e0b; }
.rssi--bad     { color: #ef4444; }
.rssi--unknown { color: var(--text-disabled); }
</style>
