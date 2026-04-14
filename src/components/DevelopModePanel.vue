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
          <span v-if="isConnected">已连接 · {{ connectionState.baudRate.toLocaleString() }} baud</span>
          <span v-else>未连接（请使用右上角串口连接）</span>
        </div>
      </div>
    </div>

    <!-- 指令区 + 传感器型号 -->
    <div class="cmd-sensor-row">

    <!-- 指令区 -->
    <div class="panel cmd-panel">
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

        <div class="cmd-divider"></div>

        <!-- 读取当前传感器型号 -->
        <div class="cmd-item">
          <div class="cmd-info">
            <span class="cmd-name">读取当前传感器型号</span>
            <span class="cmd-hex">MSP2 0x300A</span>
            <span class="cmd-desc">查询飞控当前实际启用的各类传感器型号</span>
          </div>
          <button
            class="cmd-btn"
            :disabled="!isConnected || isReadingSensorConfig"
            @click="readSensorConfigActive"
          >
            {{ isReadingSensorConfig ? '读取中...' : '读取' }}
          </button>
        </div>

        <div class="cmd-divider"></div>

        <div class="cmd-item">
          <div class="cmd-info">
            <span class="cmd-name">测试网络通路</span>
            <span class="cmd-hex">GET https://api.snap-test.in/api/user/getAllUsers</span>
            <span class="cmd-desc">请求示例用户接口，验证当前前端到外部 API 的网络连通性</span>
          </div>
          <button
            class="cmd-btn"
            :disabled="isTestingNetwork"
            @click="testNetworkApi"
          >
            {{ isTestingNetwork ? '测试中...' : '测试网络' }}
          </button>
        </div>

        <div class="cmd-divider"></div>

        <div class="cmd-item">
          <div class="cmd-info">
            <span class="cmd-name">测试网络 POST</span>
            <span class="cmd-hex">POST https://api.snap-test.in/api/user/addUser/</span>
            <span class="cmd-desc">提交示例用户数据，验证当前前端到外部 API 的 POST 通路</span>
          </div>
          <button
            class="cmd-btn"
            :disabled="isTestingNetworkPost"
            @click="testNetworkPostApi"
          >
            {{ isTestingNetworkPost ? '测试中...' : '测试 POST' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 传感器型号结果 -->
    <div class="panel sensor-panel">
      <div class="panel-header">
        <h2>当前传感器型号</h2>
      </div>

      <div v-if="lastSensorConfigAt" class="sensor-meta">
        最近更新时间：{{ lastSensorConfigAt }}
      </div>

      <div class="sensor-grid">
        <div class="sensor-card" v-for="item in sensorConfigItems" :key="item.key">
          <span class="sensor-label">{{ item.label }}</span>
          <span class="sensor-model">{{ item.model }}</span>
          <span class="sensor-raw">索引值: {{ formatSensorRaw(item.raw) }}</span>
        </div>
      </div>

      <div class="sensor-tip" v-if="!lastSensorConfigAt">
        点击上方“读取当前传感器型号”后显示结果
      </div>
    </div>

    <div class="panel log-panel">
      <div class="panel-header">
        <h2>通信日志</h2>
        <button class="btn-secondary btn-small" @click="log = ''">清除</button>
      </div>
      <div v-if="log" class="terminal">
        <pre class="terminal-body" ref="terminalBody">{{ log }}</pre>
      </div>
      <div v-else class="terminal terminal-empty">
        暂无日志，使用右上角连接设备后发送指令将在此显示
      </div>
    </div>
    </div><!-- /.cmd-sensor-row -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { ENABLE_DEV_PANEL_SERIAL_LOG } from '@/ts/msp/protocolFlags'
import { addSnapTestUser, getSnapTestUsers } from '@/ts/uomCom'

const { getInstance, connectionState } = useSerial()
const serialManager = getInstance()

// 指令定义
const CMD_FLASH          = new Uint8Array([0x02, 0x01])
const CMD_READ_BLACKBOX  = new Uint8Array([0x01, 0x01, 0x01])
const CMD_CLEAR_BLACKBOX = new Uint8Array([0x01, 0x01, 0x02])

const isConnected = computed(() => connectionState.value.isConnected)
const log = ref('')
const terminalBody = ref<HTMLElement | null>(null)

const MSP2_SENSOR_CONFIG_ACTIVE = 0x300A
const SENSOR_NOT_AVAILABLE = 0xFF

const lookupTableGyroHardware = [
  'NONE', 'AUTO', 'MPU6050', 'L3GD20', 'MPU6000', 'MPU6500', 'MPU9250',
  'ICM20601', 'ICM20602', 'ICM20608G', 'ICM20649', 'ICM20689', 'ICM42605',
  'ICM42688P', 'BMI160', 'BMI270', 'LSM6DSO', 'LSM6DSV16X', 'IIM42653',
  'ICM45605', 'ICM45686', 'ICM40609D', 'IIM42652', 'LSM6DSK320X', 'ICM42622P','BMI088',
  'VIRTUAL'
]

const lookupTableAccHardware = [
  'AUTO', 'NONE', 'MPU6050', 'MPU6000', 'MPU6500', 'MPU9250', 'ICM20601',
  'ICM20602', 'ICM20608G', 'ICM20649', 'ICM20689', 'ICM42605', 'ICM42688P',
  'BMI160', 'BMI270', 'LSM6DSO', 'LSM6DSV16X', 'IIM42653', 'ICM45605', 'ICM45686',
  'ICM40609D', 'IIM42652', 'LSM6DSK320X', 'ICM42622P','BMI088','VIRTUAL'
]

const lookupTableBaroHardware = [
  'AUTO', 'NONE', 'BMP085', 'MS5611', 'BMP280', 'LPS', 'QMP6988', 'BMP388',
  'DPS310', '2SMPB_02B', 'LPS22DF', 'BMP580', 'BMP581', 'VIRTUAL'
]

const lookupTableRangefinderHardware = [
  'NONE', 'HCSR04', 'TFMINI', 'TF02', 'MTF01', 'MTF02', 'MTF01P', 'MTF02P',
  'TFNOVA', 'NOOPLOOP_F2', 'NOOPLOOP_F2P', 'NOOPLOOP_F2PH', 'NOOPLOOP_F',
  'NOOPLOOP_FP', 'NOOPLOOP_F2MINI'
]

const lookupTableOpticalflowHardware = [
  'NONE', 'MT'
]

type SensorKind = 'gyro' | 'acc' | 'baro' | 'mag' | 'rangefinder' | 'opticalflow'

interface SensorConfigActiveState {
  gyro: number
  acc: number
  baro: number
  mag: number
  rangefinder: number
  opticalflow: number
}

const sensorConfigActive = ref<SensorConfigActiveState>({
  gyro: SENSOR_NOT_AVAILABLE,
  acc: SENSOR_NOT_AVAILABLE,
  baro: SENSOR_NOT_AVAILABLE,
  mag: SENSOR_NOT_AVAILABLE,
  rangefinder: SENSOR_NOT_AVAILABLE,
  opticalflow: SENSOR_NOT_AVAILABLE,
})
const isReadingSensorConfig = ref(false)
const lastSensorConfigAt = ref('')
const isTestingNetwork = ref(false)
const isTestingNetworkPost = ref(false)

let sensorReadTimeoutId: ReturnType<typeof setTimeout> | null = null
const sensorReadTimeoutMs = 1500
let sensorRxBuffer = new Uint8Array(512)
let sensorRxLen = 0

const sensorConfigItems = computed(() => {
  const data = sensorConfigActive.value
  return [
    { key: 'gyro', label: '陀螺仪 (Gyro)', raw: data.gyro, model: resolveSensorModel('gyro', data.gyro) },
    { key: 'acc', label: '加速度计 (Acc)', raw: data.acc, model: resolveSensorModel('acc', data.acc) },
    { key: 'baro', label: '气压计 (Baro)', raw: data.baro, model: resolveSensorModel('baro', data.baro) },
    { key: 'mag', label: '磁力计 (Mag)', raw: data.mag, model: resolveSensorModel('mag', data.mag) },
    { key: 'rangefinder', label: '测距 (Rangefinder)', raw: data.rangefinder, model: resolveSensorModel('rangefinder', data.rangefinder) },
    { key: 'opticalflow', label: '光流 (Optical Flow)', raw: data.opticalflow, model: resolveSensorModel('opticalflow', data.opticalflow) },
  ]
})

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

function formatTimeMs(): string {
  const now = new Date()
  return `${now.toLocaleTimeString('zh-CN', { hour12: false })}.${now.getMilliseconds().toString().padStart(3, '0')}`
}

function formatSensorRaw(raw: number): string {
  return raw === SENSOR_NOT_AVAILABLE
    ? '0xFF'
    : `0x${raw.toString(16).toUpperCase().padStart(2, '0')}`
}

function resolveSensorModel(kind: SensorKind, idx: number): string {
  if (idx === SENSOR_NOT_AVAILABLE) return 'NOT_AVAILABLE'

  let table: string[] = []
  switch (kind) {
    case 'gyro': table = lookupTableGyroHardware; break
    case 'acc': table = lookupTableAccHardware; break
    case 'baro': table = lookupTableBaroHardware; break
    case 'rangefinder': table = lookupTableRangefinderHardware; break
    case 'opticalflow': table = lookupTableOpticalflowHardware; break
    case 'mag':
      return 'NOT_AVAILABLE'
  }

  return table[idx] ?? `UNKNOWN(${idx})`
}

function crc8DvbS2Update(crc: number, value: number): number {
  let c = (crc ^ value) & 0xFF
  for (let i = 0; i < 8; i++) {
    c = (c & 0x80) ? (((c << 1) ^ 0xD5) & 0xFF) : ((c << 1) & 0xFF)
  }
  return c
}

function crc8DvbS2(data: Uint8Array): number {
  let crc = 0
  for (let i = 0; i < data.length; i++) {
    crc = crc8DvbS2Update(crc, data[i]!)
  }
  return crc
}

function encodeMspV2Native(command: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const frame = new Uint8Array(9 + payload.length)
  frame[0] = 0x24 // $
  frame[1] = 0x58 // X
  frame[2] = 0x3C // <
  frame[3] = 0x00 // flags
  frame[4] = command & 0xFF
  frame[5] = (command >> 8) & 0xFF
  frame[6] = payload.length & 0xFF
  frame[7] = (payload.length >> 8) & 0xFF
  frame.set(payload, 8)
  frame[8 + payload.length] = crc8DvbS2(frame.subarray(3, 8 + payload.length))
  return frame
}

function ensureSensorBuffer(required: number) {
  if (required <= sensorRxBuffer.length) return
  const next = new Uint8Array(Math.max(sensorRxBuffer.length * 2, required))
  next.set(sensorRxBuffer.subarray(0, sensorRxLen))
  sensorRxBuffer = next
}

function clearSensorReadWait() {
  if (sensorReadTimeoutId) {
    clearTimeout(sensorReadTimeoutId)
    sensorReadTimeoutId = null
  }
  isReadingSensorConfig.value = false
}

function scheduleSensorReadTimeout() {
  if (sensorReadTimeoutId) clearTimeout(sensorReadTimeoutId)
  sensorReadTimeoutId = setTimeout(() => {
    if (!isReadingSensorConfig.value) return
    isReadingSensorConfig.value = false
    log.value += `[${timestamp()}] [WARN] 读取传感器型号超时\n`
  }, sensorReadTimeoutMs)
}

function parseSensorConfigPayload(payload: Uint8Array) {
  if (payload.length < 6) return
  sensorConfigActive.value = {
    gyro: payload[0]!,
    acc: payload[1]!,
    baro: payload[2]!,
    mag: payload[3]!,
    rangefinder: payload[4]!,
    opticalflow: payload[5]!,
  }
  if (ENABLE_DEV_PANEL_SERIAL_LOG) {
    console.log(`[DEV RX ${formatTimeMs()}] MSP2 cmd=0x${MSP2_SENSOR_CONFIG_ACTIVE.toString(16).toUpperCase()} len=${payload.length} payload=${toHexLog(payload)}`)
  }
  lastSensorConfigAt.value = timestamp()
  clearSensorReadWait()
  log.value += `[${timestamp()}] [INFO] 已更新当前传感器型号\n`
}

function processSensorFrames() {
  let i = 0
  while (i < sensorRxLen) {
    if (sensorRxBuffer[i] !== 0x24) { i++; continue } // $
    if (i + 9 > sensorRxLen) break
    if (sensorRxBuffer[i + 1] !== 0x58) { i++; continue } // X

    const direction = sensorRxBuffer[i + 2]
    if (direction !== 0x3E && direction !== 0x21 && direction !== 0x3C) { i++; continue }

    const payloadSize = sensorRxBuffer[i + 6]! | (sensorRxBuffer[i + 7]! << 8)
    const frameLen = 9 + payloadSize
    if (i + frameLen > sensorRxLen) break

    const crcExpected = sensorRxBuffer[i + 8 + payloadSize]!
    const crcActual = crc8DvbS2(sensorRxBuffer.subarray(i + 3, i + 8 + payloadSize))

    if (crcExpected === crcActual) {
      const cmd = sensorRxBuffer[i + 4]! | (sensorRxBuffer[i + 5]! << 8)
      if (direction === 0x3E && cmd === MSP2_SENSOR_CONFIG_ACTIVE) {
        parseSensorConfigPayload(sensorRxBuffer.subarray(i + 8, i + 8 + payloadSize))
      }
      i += frameLen
    } else {
      i++
    }
  }

  if (i > 0 && i < sensorRxLen) {
    sensorRxBuffer.copyWithin(0, i, sensorRxLen)
    sensorRxLen -= i
  } else if (i >= sensorRxLen) {
    sensorRxLen = 0
  }
}

async function readSensorConfigActive() {
  const frame = encodeMspV2Native(MSP2_SENSOR_CONFIG_ACTIVE)
  isReadingSensorConfig.value = true
  sensorRxLen = 0
  scheduleSensorReadTimeout()

  const ok = await serialManager.send(frame)
  if (!ok) {
    clearSensorReadWait()
    log.value += `[${timestamp()}] [ERR] 读取传感器型号 发送失败\n`
    return
  }

  log.value += `[${timestamp()}] [TX] 读取传感器型号  ${toHexLog(frame)}\n`
  if (ENABLE_DEV_PANEL_SERIAL_LOG) {
    console.log(`[DEV TX ${formatTimeMs()}] MSP2 cmd=0x${MSP2_SENSOR_CONFIG_ACTIVE.toString(16).toUpperCase()} len=0 frame=${toHexLog(frame)}`)
  }
}

async function send(cmd: Uint8Array, label: string) {
  const ok = await serialManager.send(cmd)
  if (ok) {
    log.value += `[${timestamp()}] [TX] ${label}  ${toHexLog(cmd)}\n`
  } else {
    log.value += `[${timestamp()}] [ERR] ${label} 发送失败\n`
  }
}

async function testNetworkApi() {
  isTestingNetwork.value = true
  log.value += `[${timestamp()}] [HTTP] GET https://api.snap-test.in/api/user/getAllUsers\n`

  try {
    const response = await getSnapTestUsers()
    const result = response.data
    console.info('测试网络 API 返回内容', result)
    log.value += `[${timestamp()}] [HTTP OK] 状态 ${response.status}，返回 ${result.length} 条记录\n`
    log.value += `${JSON.stringify(result, null, 2)}\n`
  } catch (error) {
    console.error('测试网络 API 请求失败', error)
    const message = error instanceof Error ? error.message : String(error)
    log.value += `[${timestamp()}] [HTTP ERR] ${message}\n`
  } finally {
    isTestingNetwork.value = false
  }
}

async function testNetworkPostApi() {
  isTestingNetworkPost.value = true
  const payload = {
    name: 'Tony Thompson',
    email: 'tony.thompson@company.com',
    job: 'Senior Software Engineer',
    city: 'New York',
  }

  log.value += `[${timestamp()}] [HTTP] POST https://api.snap-test.in/api/user/addUser/\n`
  log.value += `${JSON.stringify(payload, null, 2)}\n`

  try {
    const response = await addSnapTestUser(payload)
    const result = response.data
    console.info('测试网络 POST API 返回内容', result)
    log.value += `[${timestamp()}] [HTTP OK] 状态 ${response.status}，POST 请求成功\n`
    log.value += `${JSON.stringify(result, null, 2)}\n`
  } catch (error) {
    console.error('测试网络 POST API 请求失败', error)
    const message = error instanceof Error ? error.message : String(error)
    log.value += `[${timestamp()}] [HTTP ERR] ${message}\n`
  } finally {
    isTestingNetworkPost.value = false
  }
}

// ── 黑匣子清除 ──────────────────────────────────────────────

async function clearBlackbox() {
  clearResponseBuf = ''
  isClearingBlackbox.value = true

  const ok = await serialManager.send(CMD_CLEAR_BLACKBOX)
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

  const ok = await serialManager.send(CMD_READ_BLACKBOX)
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

    if (isReadingSensorConfig.value) {
      ensureSensorBuffer(sensorRxLen + data.length)
      sensorRxBuffer.set(data, sensorRxLen)
      sensorRxLen += data.length
      processSensorFrames()
    }
  }
}

const handleConnected = () => {
  log.value += `[${timestamp()}] [INFO] 已连接，波特率 ${connectionState.value.baudRate.toLocaleString()}\n`
}

const handleDisconnected = () => {
  if (isReadingBlackbox.value) stopBlackboxRead()
  if (isClearingBlackbox.value) { isClearingBlackbox.value = false; clearResponseBuf = '' }
  clearSensorReadWait()
  sensorRxLen = 0
  log.value += `[${timestamp()}] [INFO] 已断开连接\n`
}

serialManager.addEventListener('connected', handleConnected)
serialManager.addEventListener('disconnected', handleDisconnected)
serialManager.addEventListener('data', handleData)

onUnmounted(() => {
  stopBlackboxRead()
  clearSensorReadWait()
  serialManager.removeEventListener('connected', handleConnected)
  serialManager.removeEventListener('disconnected', handleDisconnected)
  serialManager.removeEventListener('data', handleData)
})
</script>

<style scoped>
.dev-container {
  padding: var(--spacing-2xl);
  max-width: 1100px;
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

/* 指令 + 传感器并排行 */
.cmd-sensor-row {
  display: flex;
  gap: var(--spacing-xl);
  align-items: flex-start;
  border-bottom: 1px solid var(--border-light);
  padding: var(--spacing-lg) 0;
}

.cmd-panel {
  flex: 0 0 auto;
  min-width: 340px;
  border-bottom: none;
  padding: 0;
}

.sensor-panel {
  flex: 1;
  min-width: 0;
  border-bottom: none;
  padding: 0;
}

.log-panel {
  flex: 0 0 360px;
  min-width: 320px;
  border-bottom: none;
  padding: 0;
}

.sensor-meta {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
  margin-bottom: var(--spacing-sm);
}

.sensor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-sm);
}

.sensor-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--spacing-md);
  border: 1px solid var(--border-light);
  background-color: var(--surface-100);
}

.sensor-label {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

.sensor-model {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--primary-600);
  font-family: 'Consolas', 'Courier New', monospace;
}

.sensor-raw {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-family: 'Consolas', 'Courier New', monospace;
}

.sensor-tip {
  margin-top: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
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

@media (max-width: 760px) {
  .sensor-grid {
    grid-template-columns: 1fr;
  }

  .cmd-sensor-row {
    flex-direction: column;
  }

  .cmd-panel {
    min-width: 0 !important;
    width: 100%;
  }

  .log-panel {
    min-width: 0;
    width: 100%;
  }
}
</style>
