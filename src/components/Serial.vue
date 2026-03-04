<script setup>
import { ref, reactive, onBeforeUnmount, computed } from 'vue'

// 串口状态
const isConnected = ref(false)
const isReading = ref(false)

// 飞控信息
const flightControllerInfo = ref({
  majorVersion: '未知',
  minorVersion: '未知',
  patchVersion: '未知',
  targetId: '未知',
})

// 串口配置
const config = reactive({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
})

// 可选波特率列表
const baudRateOptions = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]

// 串口实例与读写流
let port = null
let reader = null

// 收发数据
const receivedBytes = ref(new Uint8Array())  // 存储原始字节数据
const sendData = ref('')
const sendAsHex = ref(false)
const autoScroll = ref(true)
const displayAsHex = ref(false)  // 接收数据显示格式

// 状态信息
const statusMessage = ref('未连接')

// 计算属性：根据选择的格式显示接收数据
const displayedData = computed(() => {
  if (receivedBytes.value.length === 0) {
    return '等待接收数据...'
  }

  if (displayAsHex.value) {
    // 显示为 HEX 格式
    let hexStr = ''
    for (let i = 0; i < receivedBytes.value.length; i++) {
      const hex = receivedBytes.value[i].toString(16).padStart(2, '0').toUpperCase()
      hexStr += hex
      if ((i + 1) % 16 === 0) {
        hexStr += '\n'
      } else {
        hexStr += ' '
      }
    }
    return hexStr
  } else {
    // 显示为 ASCII 格式
    return new TextDecoder().decode(receivedBytes.value)
  }
})

// 请求并连接串口
async function connectSerial() {
  try {
    if (!('serial' in navigator)) {
      statusMessage.value = '当前浏览器不支持 Web Serial API'
      return
    }

    port = await navigator.serial.requestPort()

    await port.open({
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      stopBits: config.stopBits,
      parity: config.parity,
      flowControl: config.flowControl,
    })

    isConnected.value = true
    statusMessage.value = `已连接 (波特率: ${config.baudRate})`

    startReading()
  } catch (err) {
    statusMessage.value = `连接失败: ${err.message}`
    console.error('串口连接错误:', err)
  }
}

// 断开串口
async function disconnectSerial() {
  try {
    isReading.value = false

    if (reader) {
      await reader.cancel()
      reader.releaseLock()
      reader = null
    }

    if (port) {
      await port.close()
      port = null
    }

    isConnected.value = false
    statusMessage.value = '已断开连接'
  } catch (err) {
    statusMessage.value = `断开失败: ${err.message}`
    console.error('串口断开错误:', err)
  }
}

function parseVerMsg(bytes) {
  // 简单示例：假设飞控信息以特定格式发送
  // 这里需要根据实际协议解析数据
  if (bytes.length >= 16 && bytes[0] === 0xFE && bytes[5] === 0x02) { // 假设以 FE 开头的消息是飞控信息
    flightControllerInfo.value.majorVersion = bytes[9]
    flightControllerInfo.value.minorVersion = bytes[10]
    flightControllerInfo.value.patchVersion = bytes[11]
    flightControllerInfo.value.targetId = bytes[8]

  }
}

// 持续读取串口数据
async function startReading() {
  if (!port || !port.readable) return

  isReading.value = true

  while (port.readable && isReading.value) {
    reader = port.readable.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        // 将新接收的字节追加到现有数据中
        const newBytes = new Uint8Array(receivedBytes.value.length + value.length)
        newBytes.set(receivedBytes.value)
        newBytes.set(value, receivedBytes.value.length)
        receivedBytes.value = newBytes

        parseVerMsg(value)
        flightControllerInfo.value.firmwareVersion = bytes.length
        if (autoScroll.value) {
          scrollToBottom()
        }
      }
    } catch (err) {
      if (isReading.value) {
        console.error('读取错误:', err)
      }
    } finally {
      reader.releaseLock()
      reader = null
    }
  }
}

// 发送数据到串口
async function sendToSerial() {
  if (!port || !port.writable || !sendData.value) return

  const writer = port.writable.getWriter()
  try {
    let data
    if (sendAsHex.value) {
      const hexStr = sendData.value.replace(/\s+/g, '')
      const bytes = new Uint8Array(hexStr.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
      data = bytes
    } else {
      data = new TextEncoder().encode(sendData.value)
    }
    await writer.write(data)
  } catch (err) {
    statusMessage.value = `发送失败: ${err.message}`
    console.error('发送错误:', err)
  } finally {
    writer.releaseLock()
  }
}

// 清空接收区
function clearReceived() {
  receivedBytes.value = new Uint8Array()
}

// 进入固件烧写模式（发送 0x02, 0x01）
async function enterFirmwareMode() {
  if (!port || !port.writable) return

  const writer = port.writable.getWriter()
  try {
    const data = new Uint8Array([0x02, 0x01])
    await writer.write(data)
    statusMessage.value = '已发送进入固件烧写模式命令'
  } catch (err) {
    statusMessage.value = `发送固件模式命令失败: ${err.message}`
    console.error('发送错误:', err)
  } finally {
    writer.releaseLock()
  }
}

// 进入固件烧写模式（发送 FE 02 00 00 00 01 00 01 A8 F2）
async function sendHeartbeat() {
  if (!port || !port.writable) return

  const writer = port.writable.getWriter()
  try {
    const data = new Uint8Array([0xFE, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0xA8, 0xF2])
    await writer.write(data)
    statusMessage.value = '已发送心跳包'
  } catch (err) {
    statusMessage.value = `发送心跳包失败: ${err.message}`
    console.error('发送错误:', err)
  } finally {
    writer.releaseLock()
  }
}

// 滚动到底部
function scrollToBottom() {
  const el = document.querySelector('.serial-received')
  if (el) {
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }
}

// 组件卸载前断开连接
onBeforeUnmount(async () => {
  if (isConnected.value) {
    await disconnectSerial()
  }
})
</script>

<template>
  <div class="serial-container">
    <h2>串口连接</h2>

    <!-- 状态栏 -->
    <div class="serial-status" :class="{ connected: isConnected }">
      <span class="status-dot"></span>
      <span>{{ statusMessage }}</span>
    </div>

    <!-- 串口配置 -->
    <div class="serial-config">
      <div class="config-item">
        <label>波特率</label>
        <select v-model.number="config.baudRate" :disabled="isConnected">
          <option v-for="rate in baudRateOptions" :key="rate" :value="rate">
            {{ rate }}
          </option>
        </select>
      </div>
      <div class="config-item">
        <label>数据位</label>
        <select v-model.number="config.dataBits" :disabled="isConnected">
          <option :value="7">7</option>
          <option :value="8">8</option>
        </select>
      </div>
      <div class="config-item">
        <label>停止位</label>
        <select v-model.number="config.stopBits" :disabled="isConnected">
          <option :value="1">1</option>
          <option :value="2">2</option>
        </select>
      </div>
      <div class="config-item">
        <label>校验位</label>
        <select v-model="config.parity" :disabled="isConnected">
          <option value="none">None</option>
          <option value="even">Even</option>
          <option value="odd">Odd</option>
        </select>
      </div>
      <div class="config-item">
        <label>流控</label>
        <select v-model="config.flowControl" :disabled="isConnected">
          <option value="none">None</option>
          <option value="hardware">Hardware</option>
        </select>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="serial-actions">
      <button v-if="!isConnected" class="btn btn-connect" @click="connectSerial">
        连接串口
      </button>
      <button v-else class="btn btn-disconnect" @click="disconnectSerial">
        断开连接
      </button>
      <button
        v-if="isConnected"
        class="btn btn-firmware"
        @click="enterFirmwareMode"
        title="发送 0x02 0x01 进入固件烧写模式"
      >
        进入固件烧写模式
      </button>
      <button
        v-if="isConnected"
        class="btn btn-firmware"
        @click="sendHeartbeat"
        title="发送 FE 02 00 00 00 01 00 01 A8 F2 心跳包"
      >
        获取飞控信息
      </button>
    </div>

    <!-- 数据接收区 -->
    <div class="serial-section">
      <div class="section-header">
        <h3>接收数据</h3>
        <div class="section-controls">
          <label class="checkbox-label">
            <input type="checkbox" v-model="displayAsHex" />
            HEX 显示
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="autoScroll" />
            自动滚动
          </label>
          <button class="btn btn-small" @click="clearReceived">清空</button>
        </div>
      </div>
      <pre class="serial-received">{{ displayedData }}</pre>
    </div>

    <!-- 数据发送区 -->
    <div class="serial-section">
      <div class="section-header">
        <h3>发送数据</h3>
        <label class="checkbox-label">
          <input type="checkbox" v-model="sendAsHex" />
          HEX 发送
        </label>
      </div>
      <div class="send-area">
        <input
          type="text"
          v-model="sendData"
          :placeholder="sendAsHex ? '输入十六进制数据 (如: FF 01 02)' : '输入要发送的文本'"
          :disabled="!isConnected"
          @keyup.enter="sendToSerial"
        />
        <button class="btn btn-send" :disabled="!isConnected || !sendData" @click="sendToSerial">
          发送
        </button>
      </div>
    </div>

    <div class="msg-panel">
      <h3>飞控信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">固件版本:</span>
          <span class="info-value">{{ flightControllerInfo.majorVersion }}.{{ flightControllerInfo.minorVersion }}.{{ flightControllerInfo.patchVersion }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">板子类型:</span>
          <span class="info-value">{{ flightControllerInfo.targetId }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.serial-container {
  max-width: 700px;
  margin: 2rem auto;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-background);
}

h2 {
  margin: 0 0 1rem;
  color: var(--color-heading);
  font-size: 1.4rem;
}

h3 {
  margin: 0;
  font-size: 1rem;
  color: var(--color-heading);
}

/* 状态栏 */
.serial-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background: #f5f5f5;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
}

.serial-status.connected {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #bbb;
}

.serial-status.connected .status-dot {
  background: #4caf50;
  box-shadow: 0 0 4px #4caf50;
}

/* 配置区 */
.serial-config {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-bottom: 1rem;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  flex: 1;
  min-width: 100px;
}

.config-item label {
  font-size: 0.8rem;
  color: #888;
}

.config-item select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.85rem;
}

.config-item select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 按钮 */
.serial-actions {
  margin-bottom: 1rem;
}

.btn {
  padding: 0.5rem 1.2rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-connect {
  background: #42b883;
  color: #fff;
}

.btn-connect:hover {
  background: #38a373;
}

.btn-disconnect {
  background: #e53935;
  color: #fff;
}

.btn-disconnect:hover {
  background: #c62828;
}

.btn-send {
  background: #1976d2;
  color: #fff;
  white-space: nowrap;
}

.btn-send:hover:not(:disabled) {
  background: #1565c0;
}

.btn-firmware {
  background: #ff9800;
  color: #fff;
  margin-left: 0.5rem;
}

.btn-firmware:hover {
  background: #f57c00;
}

.btn-small {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
  background: #eee;
  color: #555;
}

.btn-small:hover {
  background: #ddd;
}

/* 数据区 */
.serial-section {
  margin-bottom: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-controls {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #888;
  cursor: pointer;
}

.serial-received {
  width: 100%;
  height: 200px;
  padding: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.85rem;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  box-sizing: border-box;
}

.send-area {
  display: flex;
  gap: 0.5rem;
}

.send-area input {
  flex: 1;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.9rem;
}

.send-area input:disabled {
  opacity: 0.5;
}
</style>
