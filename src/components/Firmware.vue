<template>
  <div class="firmware-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>固件升级</h1>
        <p class="page-subtitle">升级固件</p>
      </div>
      <div class="header-right">
        <!-- 连接状态 -->
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span v-if="connectionState.isConnected">已连接</span>
          <span v-else>未连接</span>
        </div>
      </div>
    </div>

    <div class="action-row">
      <input
        ref="firmwareInput"
        type="file"
        class="hidden-input"
        accept=".bin"
        @change="handleFirmwareSelected"
      >
      <button class="btn btn-primary" :disabled="isBurning" @click="openFirmwarePicker">加载固件</button>
      <button
        class="btn btn-danger"
        :disabled="!canEnterBootloader"
        @click="handleEnterBootloaderMode"
      >
        进入烧录模式
      </button>
      <button
        class="btn btn-danger"
        :disabled="!canBurn"
        @click="handleBurnFirmware"
      >
        {{ isBurning ? '烧写中...' : '烧写飞控' }}
      </button>
    </div>

    <div class="firmware-main-grid">
      <section class="firmware-info panel">
        <div class="panel-header">
          <h2>固件信息</h2>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">文件名</span>
            <span class="info-value">{{ firmwareInfo.fileName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">固件类型</span>
            <span class="info-value">{{ firmwareInfo.firmwareType }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">目标板</span>
            <span class="info-value">{{ firmwareInfo.targetBoard }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">固件版本</span>
            <span class="info-value">{{ firmwareInfo.firmwareVersion }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">编译日期</span>
            <span class="info-value">{{ firmwareInfo.buildDate }}</span>
          </div>
        </div>
      </section>

      <aside class="flash-side-panel">
        <div class="flash-status-card">
          <div class="flash-status-row">
            <span class="flash-status-label">烧写状态</span>
            <span class="flash-status-value">{{ flashProgress.message }}</span>
          </div>
          <div class="flash-progress-track">
            <div class="flash-progress-fill" :style="{ width: `${flashProgress.percent}%` }"></div>
          </div>
          <div class="flash-progress-meta">
            <span>{{ flashProgress.percent }}%</span>
            <span>{{ flashProgress.packetNumber }}/{{ flashProgress.totalPackets || 0 }} 包</span>
          </div>
        </div>

        <section v-if="isUpgradeLogEnabled && flashLogs.length" class="flash-log panel">
          <div class="panel-header">
            <h2>升级日志</h2>
          </div>
          <div class="flash-log-body">
            <p v-for="(entry, index) in flashLogs" :key="`${index}-${entry}`">{{ entry }}</p>
          </div>
        </section>
      </aside>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { createEmptyFirmwareMetadata, loadFirmwareBinary, type FirmwareImage } from '@/ts/firmware/binLoader'
import { flashFirmwareImage, type FirmwareFlashProgress } from '@/ts/firmware/firmwareComm'
import { ENABLE_FIRMWARE_UPGRADE_LOG } from '@/ts/msp/protocolFlags'

const { getInstance, connectionState } = useSerial()
const serialManager = getInstance()
const isUpgradeLogEnabled = ENABLE_FIRMWARE_UPGRADE_LOG
const CMD_ENTER_BOOTLOADER = new Uint8Array([0x02, 0x01])
const firmwareInput = ref<HTMLInputElement | null>(null)
const selectedFirmware = ref<FirmwareImage | null>(null)
const isBurning = ref(false)
const flashLogs = ref<string[]>([])

const firmwareInfo = ref(createEmptyFirmwareMetadata())
const flashProgress = ref<FirmwareFlashProgress>({
  stage: 'idle',
  message: '请先加载 .bin 固件文件',
  packetNumber: 0,
  totalPackets: 0,
  sentBytes: 0,
  totalBytes: 0,
  percent: 0,
})

const canBurn = computed(() => {
  return connectionState.value.isConnected && selectedFirmware.value !== null && !isBurning.value
})

const canEnterBootloader = computed(() => {
  return connectionState.value.isConnected && !isBurning.value
})

const openFirmwarePicker = () => {
  firmwareInput.value?.click()
}

function appendLog(message: string) {
  if (!isUpgradeLogEnabled) return
  flashLogs.value = [...flashLogs.value.slice(-19), message]
}

function toHexLog(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ')
}

const handleFirmwareSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const image = await loadFirmwareBinary(file)
    selectedFirmware.value = image
    firmwareInfo.value = image.metadata
    flashProgress.value = {
      stage: 'idle',
      message: `已加载固件，共 ${image.packetCount} 个数据包`,
      packetNumber: 0,
      totalPackets: image.packetCount,
      sentBytes: 0,
      totalBytes: image.size,
      percent: 0,
    }
    appendLog(`已加载固件: ${image.metadata.fileName} (${image.size} bytes)`)
  } catch (error) {
    selectedFirmware.value = null
    firmwareInfo.value = createEmptyFirmwareMetadata()
    flashProgress.value = {
      stage: 'idle',
      message: (error as Error).message || '固件加载失败',
      packetNumber: 0,
      totalPackets: 0,
      sentBytes: 0,
      totalBytes: 0,
      percent: 0,
    }
  } finally {
    input.value = ''
  }
}

const handleBurnFirmware = async () => {
  if (!selectedFirmware.value || !canBurn.value) return

  isBurning.value = true
  flashLogs.value = []

  try {
    await flashFirmwareImage(serialManager, selectedFirmware.value, {
      target: 'main',
      onProgress: (progress) => {
        flashProgress.value = progress
      },
      onLog: (message) => {
        appendLog(message)
      },
    })
  } catch (error) {
    const message = (error as Error).message || '固件烧写失败'
    flashProgress.value = {
      ...flashProgress.value,
      message,
    }
    appendLog(`错误: ${message}`)
  } finally {
    isBurning.value = false
  }
}

const handleEnterBootloaderMode = async () => {
  if (!canEnterBootloader.value) return

  const sent = await serialManager.send(CMD_ENTER_BOOTLOADER)
  if (!sent) {
    const message = '发送进入烧录模式指令失败'
    flashProgress.value = {
      ...flashProgress.value,
      message,
    }
    appendLog(`错误: ${message}`)
    return
  }

  const hex = toHexLog(CMD_ENTER_BOOTLOADER)
  flashProgress.value = {
    ...flashProgress.value,
    message: '已发送进入烧录模式指令，请等待设备进入 IAP',
  }
  appendLog(`发送进入烧录模式指令: ${hex}`)
}
</script>

<style scoped>
.firmware-container {
  padding: var(--spacing-2xl);
  max-width: 1180px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.firmware-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
  gap: var(--spacing-lg);
  align-items: start;
}

.flash-side-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
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

.action-row {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.flash-status-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--border-light);
  background-color: var(--surface-100);
}

.flash-status-row,
.flash-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.flash-status-label {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
  font-weight: 600;
}

.flash-status-value,
.flash-progress-meta {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.flash-progress-track {
  width: 100%;
  height: 8px;
  overflow: hidden;
  background-color: var(--surface-300);
  border-radius: 999px;
}

.flash-progress-fill {
  height: 100%;
  background-color: var(--primary-500);
  transition: width var(--transition-base);
}

.hidden-input {
  display: none;
}

.firmware-info {
  border-radius: 0;
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-light);
  background-color: transparent;
  padding: var(--spacing-lg) 0;
}

.firmware-info .panel-header {
  border-bottom: none;
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-left: 3px solid var(--primary-500);
  padding-left: var(--spacing-md);
}

.firmware-info .panel-header h2 {
  margin: 0;
}

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
  border: none;
  border-radius: 0;
  background-color: var(--surface-100);
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
  word-break: break-word;
}

.flash-log {
  border-radius: 0;
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-light);
  background-color: transparent;
  padding: 0 0 var(--spacing-lg) 0;
}

.flash-log .panel-header {
  border-bottom: none;
  padding-bottom: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-left: 3px solid var(--primary-500);
  padding-left: var(--spacing-md);
}

.flash-log .panel-header h2 {
  margin: 0;
}

.flash-log-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--border-light);
  background-color: var(--surface-100);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.flash-log-body p {
  margin: 0;
  font-family: 'Consolas', 'Courier New', monospace;
}


/* 未连接 */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }

@media (max-width: 768px) {
  .action-row {
    flex-direction: column;
  }

  .firmware-main-grid {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>