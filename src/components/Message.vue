<template>
  <div class="setting-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>飞控信息</h1>
        <p class="page-subtitle">查看飞控设备信息</p>
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
      <div class="activation-card">
        <div class="activation-info">
          <span class="activation-label">激活状态</span>
          <span :class="['activation-badge', isActivated ? 'active' : 'inactive']">
            {{ isActivated ? '已激活' : '未激活' }}
          </span>
        </div>
        <button
          class="activate-btn"
          type="button"
          :disabled="isActivated || !isConnected"
          @click="activateModule"
        >
          {{ isActivated ? '已激活' : '激活' }}
        </button>
      </div>

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
          <div class="info-item">
            <span class="info-label">UID</span>
            <span class="info-value uid-value">{{ fcInfo.uid || '—' }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { useFCInfo } from '@/ts/information/fcInfo'

const { getInstance } = useSerial()
const serialManager = getInstance()

// 读取全局共享的飞控信息（轮询由 SerialPanel 启动，此处只读）
const { fcInfo, requestMspFcVersionOnce, requestMspUidOnce } = useFCInfo()

const isConnected = ref(serialManager.getConnected())
const isActivated = ref(false)

const requestDeviceInfo = () => {
  void requestMspFcVersionOnce()
  void requestMspUidOnce()
}

const handleConnected = () => {
  isConnected.value = true
  requestDeviceInfo()
}
const handleDisconnected = () => {
  isConnected.value = false
  isActivated.value = false
}

const activateModule = () => {
  if (!isConnected.value) return
  isActivated.value = true
}

onMounted(() => {
  isConnected.value = serialManager.getConnected()
  serialManager.addEventListener('connected', handleConnected)
  serialManager.addEventListener('disconnected', handleDisconnected)
  if (isConnected.value) {
    requestDeviceInfo()
  }
})

onUnmounted(() => {
  serialManager.removeEventListener('connected', handleConnected)
  serialManager.removeEventListener('disconnected', handleDisconnected)
})


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

.activation-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--border-light);
  background-color: var(--surface-100);
}

.activation-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.activation-label {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
  font-weight: 600;
}

.activation-badge {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.activation-badge.active {
  background-color: rgba(34, 197, 94, 0.16);
  color: var(--success-600);
}

.activation-badge.inactive {
  background-color: var(--surface-200);
  color: var(--text-disabled);
}

.activate-btn {
  border: none;
  background-color: var(--primary-500);
  color: var(--text-on-primary);
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}

.activate-btn:hover:not(:disabled) {
  filter: brightness(1.05);
}

.activate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.uid-value {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: var(--font-size-base);
  line-height: 1.4;
  word-break: break-all;
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