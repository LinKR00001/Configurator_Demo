<template>
  <div class="dev-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>开发调试</h1>
        <p class="page-subtitle">飞控底层指令调试工具</p>
      </div>
      <div class="header-right">
        <div :class="['status-indicator', isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span v-if="isConnected">已连接 · {{ BAUD_RATE.toLocaleString() }} baud</span>
          <span v-else>未连接</span>
        </div>
        <button
          :class="['conn-btn', isConnected ? 'btn-danger' : 'btn-primary']"
          :disabled="isConnecting"
          @click="isConnected ? disconnect() : connect()"
        >
          {{ isConnecting ? '连接中...' : isConnected ? '断开' : '连接' }}
        </button>
      </div>
    </div>

    <!-- 指令区 -->
    <div class="panel">
      <div class="panel-header">
        <h2>指令控制</h2>
      </div>

      <div class="cmd-list">
        <!-- 固件烧录模式 -->
        <div class="cmd-item">
          <div class="cmd-info">
            <span class="cmd-name">进入固件烧录模式</span>
            <span class="cmd-hex">{{ toHexStr(CMD_FLASH) }}</span>
            <span class="cmd-warn">警告：飞控将重启并进入烧录模式，请确认已准备好固件</span>
          </div>
          <button
            class="cmd-btn btn-danger"
            :disabled="!isConnected"
            @click="send(CMD_FLASH, '进入固件烧录模式')"
          >
            发送
          </button>
        </div>

        <div class="cmd-divider"></div>

        <!-- 读取黑匣子 -->
        <div class="cmd-item">
          <div class="cmd-info">
            <span class="cmd-name">读取黑匣子</span>
            <span class="cmd-hex">{{ toHexStr(CMD_READ_BLACKBOX) }}</span>
            <span v-if="isReadingBlackbox" class="cmd-desc cmd-progress">
              正在读取... 已接收 {{ readBytesCount }} 字节
            </span>
            <span v-else class="cmd-desc">读取飞行日志并保存为 .bbl 文件</span>
          </div>
          <button
            class="cmd-btn"
            :disabled="!isConnected || isReadingBlackbox"
            @click="readBlackbox"
          >
            {{ isReadingBlackbox ? '读取中...' : '读取' }}
          </button>
        </div>

        <div class="cmd-divider"></div>

        <!-- 清除黑匣子 -->
        <div class="cmd-item">
          <div class="cmd-info">
            <span class="cmd-name">清除黑匣子</span>
            <span class="cmd-hex">{{ toHexStr(CMD_CLEAR_BLACKBOX) }}</span>
            <span v-if="isClearingBlackbox" class="cmd-desc cmd-progress">正在清除...</span>
            <span v-else class="cmd-desc">清除飞控存储的飞行日志数据</span>
          </div>
          <button
            class="cmd-btn"
            :disabled="!isConnected || isReadingBlackbox || isClearingBlackbox"
            @click="clearBlackbox"
          >
            {{ isClearingBlackbox ? '清除中...' : '发送' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 终端日志 -->
    <div class="panel">
      <div class="panel-header">
        <h2>通信日志</h2>
        <button class="btn-secondary btn-small" @click="log = ''">清除</button>
      </div>
      <div v-if="log" class="terminal">
        <pre class="terminal-body" ref="terminalBody">{{ log }}</pre>
      </div>
      <div v-else class="terminal terminal-empty">
        暂无日志，连接设备后发送指令将在此显示
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { SerialManager } from '@/composables/useSerial'

// 私有串口实例，不使用全局实例，避免触发 useFCInfo 定时轮询
const BAUD_RATE = 420000
const devSerial = new SerialManager({ baudRate: BAUD_RATE })

// 指令定义
const CMD_FLASH          = new Uint8Array([0x02, 0x01])
const CMD_READ_BLACKBOX  = new Uint8Array([0x01, 0x01, 0x01])
const CMD_CLEAR_BLACKBOX = new Uint8Array([0x01, 0x01, 0x02])

const isConnected = ref(false)
const isConnecting = ref(false)
const log = ref('')
const terminalBody = ref<HTMLElement | null>(null)

// 黑匣子读取状态
const isReadingBlackbox = ref(false)
const readBytesCount = ref(0)    // 仅用于 UI 显示，低频更新

// 黑匣子清除状态
const isClearingBlackbox = ref(false)
let clearResponseBuf = ''                        // 累积收到的清除响应文本
const CLEAR_FINISH_STR = 'earse finish\n'        // 飞控清除完成后回传的字符串
const clearDecoder = new TextDecoder('utf-8')    // 复用，避免重复构造
let blackboxChunks: Uint8Array[] = []
let rawBytesCount = 0             // 非响应式，handleData 热路径直接写
let lastDataTime = 0              // 最后一次收到数据的时间戳
let silenceCheckId: ReturnType<typeof setInterval> | null = null  // 静默检测
let progressUpdateId: ReturnType<typeof setInterval> | null = null // UI 进度刷新

const SILENCE_THRESHOLD_MS = 1500 // 静默超过此时间则认为传输结束

// 日志有新内容时自动滚动到底部
watch(log, () => {
  nextTick(() => {
    if (terminalBody.value) {
      terminalBody.value.scrollTop = terminalBody.value.scrollHeight
    }
  })
})

// ── 连接管理 ─────────────────────────────────────────────────

async function connect() {
  isConnecting.value = true
  const ok = await devSerial.connect()
  isConnecting.value = false
  if (!ok) {
    log.value += `[${timestamp()}] [ERR] 连接失败\n`
  }
}

async function disconnect() {
  stopBlackboxRead()
  await devSerial.disconnect()
}

// ── 指令发送 ─────────────────────────────────────────────────

function toHexStr(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

function toHexLog(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

function timestamp(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

async function send(cmd: Uint8Array, label: string) {
  const ok = await devSerial.send(cmd)
  if (ok) {
    log.value += `[${timestamp()}] [TX] ${label}  ${toHexLog(cmd)}\n`
  } else {
    log.value += `[${timestamp()}] [ERR] ${label} 发送失败\n`
  }
}

// ── 黑匣子清除 ──────────────────────────────────────────────

async function clearBlackbox() {
  clearResponseBuf = ''
  isClearingBlackbox.value = true

  const ok = await devSerial.send(CMD_CLEAR_BLACKBOX)
  if (!ok) {
    log.value += `[${timestamp()}] [ERR] 清除黑匣子 发送失败\n`
    isClearingBlackbox.value = false
    return
  }
  log.value += `[${timestamp()}] [TX] 清除黑匣子  ${toHexLog(CMD_CLEAR_BLACKBOX)}\n`
}

// ── 黑匣子读取 ──────────────────────────────────────────────

async function readBlackbox() {
  isReadingBlackbox.value = true
  blackboxChunks = []
  rawBytesCount = 0
  readBytesCount.value = 0
  lastDataTime = 0

  const ok = await devSerial.send(CMD_READ_BLACKBOX)
  if (!ok) {
    log.value += `[${timestamp()}] [ERR] 读取黑匣子 发送失败\n`
    isReadingBlackbox.value = false
    return
  }
  log.value += `[${timestamp()}] [TX] 读取黑匣子  ${toHexLog(CMD_READ_BLACKBOX)}\n`

  lastDataTime = Date.now()

  // UI 进度：每 200ms 刷新一次，不在热路径里触发响应式
  progressUpdateId = setInterval(() => {
    readBytesCount.value = rawBytesCount
  }, 200)

  // 静默检测：每 200ms 检查一次距上次收数据是否已超过阈值
  silenceCheckId = setInterval(() => {
    if (lastDataTime > 0 && Date.now() - lastDataTime >= SILENCE_THRESHOLD_MS) {
      finishBlackboxRead()
    }
  }, 200)
}

function stopBlackboxRead() {
  if (silenceCheckId)    { clearInterval(silenceCheckId);    silenceCheckId = null }
  if (progressUpdateId)  { clearInterval(progressUpdateId);  progressUpdateId = null }
  isReadingBlackbox.value = false
  blackboxChunks = []
  rawBytesCount = 0
}

function finishBlackboxRead() {
  if (silenceCheckId)   { clearInterval(silenceCheckId);   silenceCheckId = null }
  if (progressUpdateId) { clearInterval(progressUpdateId); progressUpdateId = null }

  isReadingBlackbox.value = false

  if (rawBytesCount === 0) {
    log.value += `[${timestamp()}] [WARN] 未收到任何数据\n`
    blackboxChunks = []
    return
  }

  const totalLength = rawBytesCount
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of blackboxChunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }
  blackboxChunks = []
  rawBytesCount = 0
  readBytesCount.value = totalLength

  log.value += `[${timestamp()}] [INFO] 读取完成，共 ${totalLength} 字节\n`
  saveBlackboxFile(combined)
}

function saveBlackboxFile(data: Uint8Array<ArrayBuffer>) {
  const now = new Date()
  const dateStr = now.getFullYear().toString().slice(2)
    + String(now.getMonth() + 1).padStart(2, '0')
    + String(now.getDate()).padStart(2, '0')
  const timeStr = String(now.getHours()).padStart(2, '0')
    + String(now.getMinutes()).padStart(2, '0')
    + String(now.getSeconds()).padStart(2, '0')
  const fileName = `${dateStr}_data_${timeStr}.bbl`

  const blob = new Blob([data], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)

  log.value += `[${timestamp()}] [INFO] 已保存文件: ${fileName}\n`
}

// ── 串口事件处理 ─────────────────────────────────────────────

const handleData = (event: any) => {
  const data: Uint8Array = event.data
  if (!data) return

  if (isReadingBlackbox.value) {
    blackboxChunks.push(new Uint8Array(data))
    rawBytesCount += data.length   // 纯变量赋值，不触发 Vue 响应式
    lastDataTime = Date.now()      // 更新静默计时基准
  } else if (isClearingBlackbox.value) {
    clearResponseBuf += clearDecoder.decode(data, { stream: true })
    if (clearResponseBuf.includes(CLEAR_FINISH_STR)) {
      isClearingBlackbox.value = false
      clearResponseBuf = ''
      log.value += `[${timestamp()}] [INFO] 黑匣子数据清除完毕\n`
    }
  } else {
    log.value += `[${timestamp()}] [RX] ${toHexLog(data)}\n`
  }
}

const handleConnected = () => {
  isConnected.value = true
  log.value += `[${timestamp()}] [INFO] 已连接，波特率 ${BAUD_RATE.toLocaleString()}\n`
}

const handleDisconnected = () => {
  isConnected.value = false
  if (isReadingBlackbox.value) stopBlackboxRead()
  if (isClearingBlackbox.value) { isClearingBlackbox.value = false; clearResponseBuf = '' }
  log.value += `[${timestamp()}] [INFO] 已断开连接\n`
}

devSerial.addEventListener('connected', handleConnected)
devSerial.addEventListener('disconnected', handleDisconnected)
devSerial.addEventListener('data', handleData)

onUnmounted(() => {
  stopBlackboxRead()
  devSerial.removeEventListener('connected', handleConnected)
  devSerial.removeEventListener('disconnected', handleDisconnected)
  devSerial.removeEventListener('data', handleData)
  devSerial.cleanup()
})
</script>

<style scoped>
.dev-container {
  padding: var(--spacing-2xl);
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 页面标题栏 */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--primary-500);
  margin-bottom: var(--spacing-lg);
}

.page-header-left h1 {
  margin-bottom: 2px;
}

.page-subtitle {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

.conn-btn {
  flex-shrink: 0;
}

/* 面板扁平化覆盖 */
.panel {
  border-radius: 0;
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-light);
  background-color: transparent;
  padding: var(--spacing-lg) 0;
}

.panel:last-child {
  border-bottom: none;
}

.panel-header {
  border-bottom: none;
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-left: 3px solid var(--primary-500);
  padding-left: var(--spacing-md);
}

.panel-header h2 {
  margin: 0;
}

/* 指令列表 */
.cmd-list {
  border: 1px solid var(--border-light);
}

.cmd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background-color: var(--surface-100);
}

.cmd-divider {
  height: 1px;
  background-color: var(--border-light);
}

.cmd-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cmd-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

.cmd-hex {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: var(--font-size-sm);
  color: var(--primary-600);
  background-color: var(--surface-200);
  padding: 1px 6px;
  width: fit-content;
}

.cmd-desc {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

.cmd-progress {
  color: var(--primary-500);
}

.cmd-warn {
  font-size: var(--font-size-sm);
  color: var(--warning-500);
}

.cmd-btn {
  flex-shrink: 0;
}

/* 终端 */
.terminal {
  border: 1px solid var(--border-light);
  overflow: hidden;
  background-color: var(--surface-950);
}

.terminal-body {
  padding: var(--spacing-md);
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: var(--font-size-sm);
  color: var(--success-400);
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 100px;
  max-height: 280px;
  overflow-y: auto;
  margin: 0;
}

.terminal-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  background-color: var(--surface-200);
  border: 1px solid var(--border-light);
  color: var(--text-disabled);
  font-size: var(--font-size-sm);
}
</style>
