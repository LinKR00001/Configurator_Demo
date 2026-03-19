<template>
  <div class="setting-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>设置</h1>
        <p class="page-subtitle">配置 BETAFPV 飞控</p>
      </div>
      <div :class="['status-indicator', isConnected ? 'connected' : 'disconnected']">
        <span class="status-dot"></span>
        {{ isConnected ? '已连接' : '未连接' }}
      </div>
    </div>

    <!-- 未连接提示 -->
    <div v-if="!isConnected" class="not-connected">
      <span class="not-connected-icon">○</span>
      <p>请先通过顶部串口面板连接飞控</p>
    </div>

    <template v-else>
      <!-- 飞控信息面板 -->
      <div class="panel">
        <div class="panel-header">
          <h2>飞控信息</h2>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">固件版本</span>
            <span class="info-value">
              {{ fcInfo.majorVersion }}.{{ fcInfo.minorVersion }}.{{ fcInfo.patchVersion }}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">板子类型</span>
            <span class="info-value">{{ fcInfo.targetName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">板子 ID</span>
            <span class="info-value">{{ fcInfo.targetId || '—' }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useGlobalSerialManager } from '@/composables/useGlobalSerialManager'
import { useFCInfo } from '@/composables/useFCInfo'

const { getInstance } = useGlobalSerialManager()
const serialManager = getInstance()

// 读取全局共享的飞控信息（轮询由 SerialPanel 启动，此处只读）
const { fcInfo } = useFCInfo()

// 查询指令（仅用于手动发送）
const QUERY_CMD = new Uint8Array([0xFE, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0xA8, 0xF2])

const isConnected = ref(serialManager.isConnected)
const receivedData = ref('')

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

// 仅用于在终端显示 RX 数据，解析由 useFCInfo 负责
const handleData = (event: any) => {
  const data: Uint8Array = event.data
  if (!data) return
  receivedData.value += `[RX] ${toHex(data)}\n`
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

// 手动发送单次查询指令
const sendBytes = async () => {
  const ok = await serialManager.send(QUERY_CMD)
  if (ok) {
    receivedData.value += `[TX] ${toHex(QUERY_CMD)}\n`
  }
}
</script>

<style scoped>

/* 未连接 */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }

.setting-container {
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

/* 面板覆盖：扁平化 */
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

/* 信息网格 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1px;
  border: 1px solid var(--border-light);
  background-color: var(--border-light);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--surface-100);
  border-radius: 0;
  border: none;
}

.info-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-disabled);
}

.info-value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--primary-600);
}

/* 终端显示区 */
.terminal {
  margin-top: var(--spacing-md);
  border: 1px solid var(--border-light);
  border-radius: 0;
  overflow: hidden;
  background-color: var(--surface-950);
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-md);
  background-color: var(--surface-900);
  border-bottom: 1px solid var(--surface-800);
}

.terminal-title {
  font-size: var(--font-size-sm);
  color: var(--surface-500);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.terminal-body {
  padding: var(--spacing-md);
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: var(--font-size-sm);
  color: var(--success-400);
  white-space: pre-wrap;
  word-break: break-all;
  min-height: 80px;
  max-height: 240px;
  overflow-y: auto;
  margin: 0;
}

.terminal-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  background-color: var(--surface-200);
  color: var(--text-disabled);
  font-size: var(--font-size-sm);
  border: 1px solid var(--border-light);
  margin-top: var(--spacing-md);
}
</style>