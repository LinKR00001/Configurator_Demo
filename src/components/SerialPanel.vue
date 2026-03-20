<template>
    <!-- 已连接时显示飞控信息 -->
    <!-- <template v-if="isConnected">
      <div class="fc-info-chip">
        <span class="fc-version">
          v{{ fcInfo.majorVersion }}.{{ fcInfo.minorVersion }}.{{ fcInfo.patchVersion }}
        </span>
        <span class="fc-divider">|</span>
        <span class="fc-target">{{ fcInfo.targetName }}</span>
      </div>
    </template> -->

  <div class="serial-header">
    <!-- 连接状态指示器（圆点 + 文本） -->
    <div class="status-indicator" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      <span class="status-text">{{ isConnected ? '已连接' : '未连接' }}</span>
    </div>



    <!-- 未连接时显示波特率选择 + 连接按钮 -->
    <template v-if="!isConnected">
      <select v-model.number="selectedBaudRate" class="baud-select" title="波特率">
        <option v-for="rate in baudRates" :key="rate" :value="rate">
          {{ rate }}
        </option>
      </select>
      <button @click="toggleConnection" class="action-btn connect-btn">
        连接
      </button>
    </template>

    <!-- 已连接时显示断开按钮 -->
    <button v-else @click="toggleConnection" class="action-btn disconnect-btn">
      断开
    </button>

    <!-- 错误提示图标（悬浮显示错误信息） -->
    <span v-if="errorMessage" class="error-icon" :title="errorMessage">⚠️</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useSerial, DEFAULT_BAUD_RATES } from '@/composables/useSerial'
import { useFCInfo } from '@/composables/useFCInfo'

const emit = defineEmits<{
  connected: [port: string]
  disconnected: []
  error: [error: string]
}>()

const { getInstance, connectionState } = useSerial()
const serialManager = getInstance()

const { init: initFCInfo } = useFCInfo()

const selectedBaudRate = ref(115200)
const baudRates = DEFAULT_BAUD_RATES
const errorMessage = ref('')

// 从全局状态获取连接状态
const isConnected = computed(() => connectionState.value.isConnected)

const toggleConnection = async () => {
  errorMessage.value = ''
  if (isConnected.value) {
    await serialManager.disconnect()
  } else {
    serialManager.updateOptions({ baudRate: selectedBaudRate.value })
    const success = await serialManager.connect()
    if (!success) {
      errorMessage.value = '连接失败，请检查设备'
    }
  }
}

const handleConnected = () => {
  emit('connected', connectionState.value.port || 'Serial Port')
}

const handleDisconnected = () => {
  emit('disconnected')
}

const handleError = (event: any) => {
  const error = event.error as Error
  errorMessage.value = error?.message || '未知错误'
  emit('error', error?.message || '未知错误')
}

onMounted(() => {
  serialManager.addEventListener('connected', handleConnected)
  serialManager.addEventListener('disconnected', handleDisconnected)
  serialManager.addEventListener('error', handleError)
  initFCInfo()
})

onUnmounted(async () => {
  serialManager.removeEventListener('connected', handleConnected)
  serialManager.removeEventListener('disconnected', handleDisconnected)
  serialManager.removeEventListener('error', handleError)
})
</script>

<style scoped>
.serial-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px; /* 固定高度，适配 header */
  background: transparent;
  font-size: 14px;
  color: var(--text-primary);
}

/* 状态指示器 */
.status-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  height: 28px;
  background-color: var(--surface-200);
  border-radius: 14px;
  white-space: nowrap;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--error-500);
  transition: background-color 0.2s;
}

.status-indicator.connected .status-dot {
  background-color: var(--success-500);
}

.status-text {
  font-size: 12px;
  font-weight: 500;
}

/* 飞控信息 chip */
.fc-info-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  background-color: var(--surface-200);
  border: 1px solid var(--border-light);
  border-radius: 14px;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
}

.fc-version {
  font-weight: 600;
  color: var(--primary-600);
}

.fc-divider {
  color: var(--border-dark);
}

.fc-target {
  color: var(--text-secondary);
}

/* 波特率下拉框 */
.baud-select {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border-light);
  border-radius: 14px;
  background-color: var(--surface-50);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  outline: none;
}

.baud-select:hover {
  border-color: var(--primary-500);
}

/* 连接/断开按钮 */
.action-btn {
  height: 28px;
  padding: 0 12px;
  border: none;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.connect-btn {
  background-color: var(--primary-500);
  color: var(--text-on-primary);
}

.connect-btn:hover {
  background-color: var(--primary-400);
}

.disconnect-btn {
  background-color: var(--error-500);
  color: white;
}

.disconnect-btn:hover {
  background-color: var(--error-400);
}

/* 错误图标 */
.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--error-500);
  color: white;
  font-size: 12px;
  cursor: help;
}
</style>