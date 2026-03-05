<template>
  <div class="dev-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>开发调试</h1>
        <p class="page-subtitle">飞控底层指令调试工具</p>
      </div>
      <div :class="['status-indicator', isConnected ? 'connected' : 'disconnected']">
        <span class="status-dot"></span>
        {{ isConnected ? '已连接' : '未连接' }}
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

        <!-- 清除黑匣子 -->
        <div class="cmd-item">
          <div class="cmd-info">
            <span class="cmd-name">清除黑匣子</span>
            <span class="cmd-hex">{{ toHexStr(CMD_CLEAR_BLACKBOX) }}</span>
            <span class="cmd-desc">清除飞控存储的飞行日志数据</span>
          </div>
          <button
            class="cmd-btn"
            :disabled="!isConnected"
            @click="send(CMD_CLEAR_BLACKBOX, '清除黑匣子')"
          >
            发送
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
        <pre class="terminal-body">{{ log }}</pre>
      </div>
      <div v-else class="terminal terminal-empty">
        暂无日志，发送指令后将在此显示
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useGlobalSerialManager } from '@/composables/useGlobalSerialManager'

const { getInstance } = useGlobalSerialManager()
const serialManager = getInstance()

// 指令定义
const CMD_FLASH         = new Uint8Array([0x02, 0x01])
const CMD_CLEAR_BLACKBOX = new Uint8Array([0x01, 0x01, 0x00])

const isConnected = ref(serialManager.isConnected)
const log = ref('')

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
  const ok = await serialManager.send(cmd)
  if (ok) {
    log.value += `[${timestamp()}] [TX] ${label}  ${toHexLog(cmd)}\n`
  } else {
    log.value += `[${timestamp()}] [ERR] ${label} 发送失败\n`
  }
}

const handleData = (event: any) => {
  const data: Uint8Array = event.data
  if (!data) return
  log.value += `[${timestamp()}] [RX] ${toHexLog(data)}\n`
}

const handleConnected = () => { isConnected.value = true }
const handleDisconnected = () => { isConnected.value = false }

onMounted(() => {
  isConnected.value = serialManager.isConnected
  serialManager.addEventListener('connected', handleConnected)
  serialManager.addEventListener('disconnected', handleDisconnected)
  serialManager.addEventListener('data', handleData)
})

onUnmounted(() => {
  serialManager.removeEventListener('connected', handleConnected)
  serialManager.removeEventListener('disconnected', handleDisconnected)
  serialManager.removeEventListener('data', handleData)
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
