import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { MSP_CMD, useMsp } from '@/ts/msp/msp'
import { ENABLE_CUSTOM_PROTOCOL, ENABLE_MSP_PROTOCOL } from '@/ts/msp/protocolFlags'

const MAV_STX = 0xFE
const MSG_ID_RC_CHANNELS = 7
const CRC_EXTRA_RC = 45

const RC_MID = 1500

const CHANNEL_NAMES = [
  'Roll', 'Pitch', 'Yaw', 'Throttle',
  'AUX1', 'AUX2', 'AUX3', 'AUX4',
  'AUX5', 'AUX6', 'AUX7', 'AUX8',
  'AUX9', 'AUX10', 'AUX11', 'AUX12',
]

interface Channel {
  index: number
  name: string
  value: number
  active: boolean
}

const channels = ref<Channel[]>(
  Array.from({ length: 16 }, (_, i) => ({
    index: i + 1,
    name: CHANNEL_NAMES[i]!,
    value: RC_MID,
    active: false,
  }))
)

const mainChannels = computed(() => channels.value.slice(0, 4))
const auxChannels = computed(() => channels.value.slice(4))

const rcCount = ref(16)
const rssi = ref(255)
const frameCount = ref(0)
const txCount = ref(0)
const updatedAt = ref('')
const isPolling = ref(false)
const frameRate = ref(0)
let fpsFrames = 0

let pollTimer: ReturnType<typeof setInterval> | null = null
let fpsTimer: ReturnType<typeof setInterval> | null = null
let unbindRcMessage: (() => void) | null = null
let rxBuf = new Uint8Array(512)
let rxLen = 0

function timestamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

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

function parseRcPayload(payload: Uint8Array) {
  if (payload.length < 8) return
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  const count = Math.floor(payload.length / 2)
  const values = new Array<number>(count)
  for (let i = 0; i < count; i++) {
    values[i] = view.getUint16(i * 2, true)
  }

  // 飞控 MSP_RC 顺序：roll, pitch, throttle, yaw, aux1...
  const mapped = [values[0]!, values[1]!, values[3]!, values[2]!, ...values.slice(4)]
  applyRcValues(mapped, mapped.length)
}

function applyRcValues(values: number[], count: number) {
  const limit = Math.min(values.length, channels.value.length)
  for (let i = 0; i < limit; i++) {
    const val = values[i]!
    const ch = channels.value[i]!
    const changed = ch.value !== val
    ch.value = val
    if (changed) {
      ch.active = true
      setTimeout(() => { ch.active = false }, 300)
    }
  }
  rcCount.value = Math.max(4, Math.min(count, channels.value.length))
  frameCount.value++
  fpsFrames++
  updatedAt.value = timestamp()
}

function parseCustomRcPayload(payload: Uint8Array) {
  if (payload.length < 26) return
  parseRcPayload(payload.subarray(0, 24))
  rcCount.value = Math.max(4, Math.min(payload[24]!, channels.value.length))
  rssi.value = payload[25]!
}

function processCustomBuffer() {
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
        parseCustomRcPayload(rxBuf.slice(i + 6, i + 6 + pLen))
      }
    }
    i += fLen
  }

  if (i > 0 && i < rxLen) {
    rxBuf.copyWithin(0, i, rxLen)
    rxLen -= i
  } else if (i >= rxLen) {
    rxLen = 0
  }
}

function handleCustomData(event: any) {
  const chunk: Uint8Array = event.data
  if (!chunk?.length) return
  if (rxLen + chunk.length > rxBuf.length) {
    const next = new Uint8Array(Math.max(rxBuf.length * 2, rxLen + chunk.length))
    next.set(rxBuf.subarray(0, rxLen))
    rxBuf = next
  }
  rxBuf.set(chunk, rxLen)
  rxLen += chunk.length
  processCustomBuffer()
}

async function requestRc() {
  if (!ENABLE_MSP_PROTOCOL) return
  const { send } = useMsp()
  const ok = await send(MSP_CMD.RC)
  if (ok) txCount.value++
}

function startPolling() {
  if (pollTimer) return
  isPolling.value = true
  requestRc()
  pollTimer = setInterval(requestRc, 50)
  if (!fpsTimer) {
    fpsTimer = setInterval(() => {
      frameRate.value = fpsFrames
      fpsFrames = 0
    }, 1000)
  }
}

function stopPolling() {
  isPolling.value = false
  frameRate.value = 0
  fpsFrames = 0
  rxLen = 0
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (fpsTimer) {
    clearInterval(fpsTimer)
    fpsTimer = null
  }
}

export function useReceiverInfo() {
  const { getInstance } = useSerial()
  const { onRcMessage } = useMsp()
  const serial = getInstance()

  const handleConnected = () => startPolling()
  const handleDisconnected = () => stopPolling()

  onMounted(() => {
    unbindRcMessage = onRcMessage((rc) => {
      if (!ENABLE_MSP_PROTOCOL) return
      applyRcValues(rc.channels, rc.rawCount)
    })
    if (ENABLE_CUSTOM_PROTOCOL) {
      serial.addEventListener('data', handleCustomData)
    }
    serial.addEventListener('connected', handleConnected)
    serial.addEventListener('disconnected', handleDisconnected)
    if (serial.getConnected()) startPolling()
  })

  onUnmounted(() => {
    unbindRcMessage?.()
    unbindRcMessage = null
    if (ENABLE_CUSTOM_PROTOCOL) {
      serial.removeEventListener('data', handleCustomData)
    }
    serial.removeEventListener('connected', handleConnected)
    serial.removeEventListener('disconnected', handleDisconnected)
    stopPolling()
  })

  return {
    channels,
    mainChannels,
    auxChannels,
    rcCount,
    rssi,
    frameCount,
    txCount,
    updatedAt,
    isPolling,
    frameRate,
  }
}
