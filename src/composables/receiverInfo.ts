import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSerial } from './useSerial'

const MAV_STX = 0xFE
const MSG_ID_RC_CHANNELS = 7
const CRC_EXTRA_RC = 45

const RC_MID = 1500

const CHANNEL_NAMES = [
  'Roll', 'Pitch', 'Yaw', 'Throttle',
  'AUX1', 'AUX2', 'AUX3', 'AUX4',
  'AUX5', 'AUX6', 'AUX7', 'AUX8',
]

interface Channel {
  index: number
  name: string
  value: number
  active: boolean
}

const channels = ref<Channel[]>(
  Array.from({ length: 12 }, (_, i) => ({
    index: i + 1,
    name: CHANNEL_NAMES[i]!,
    value: RC_MID,
    active: false,
  }))
)

const mainChannels = computed(() => channels.value.slice(0, 4))
const auxChannels = computed(() => channels.value.slice(4, 12))

const rcCount = ref(0)
const rssi = ref(255)
const frameCount = ref(0)
const txCount = ref(0)
const updatedAt = ref('')
const isPolling = ref(false)
const frameRate = ref(0)
let fpsFrames = 0

let rxBuf = new Uint8Array(512)
let rxLen = 0

function timestamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function readInt16LE(buf: Uint8Array, offset: number): number {
  return new DataView(buf.buffer, buf.byteOffset + offset, 2).getInt16(0, true)
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

function parseRcChannels(payload: Uint8Array) {
  const flashTimersLocal: ReturnType<typeof setTimeout>[] = []
  for (let i = 0; i < 12; i++) {
    const val = readInt16LE(payload, i * 2)
    const ch = channels.value[i]!
    const changed = ch.value !== val
    ch.value = val
    if (changed) {
      ch.active = true
      flashTimersLocal.push(setTimeout(() => { ch.active = false }, 300))
    }
  }
  rcCount.value = payload[24]!
  rssi.value = payload[25]!
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

  if (i > 0 && i < rxLen) {
    rxBuf.copyWithin(0, i, rxLen)
    rxLen -= i
  } else if (i >= rxLen) {
    rxLen = 0
  }
}

function handleData(event: any) {
  const chunk: Uint8Array = event.data
  if (!chunk?.length) return
  if (rxLen + chunk.length > rxBuf.length) {
    const next = new Uint8Array(Math.max(rxBuf.length * 2, rxLen + chunk.length))
    next.set(rxBuf.subarray(0, rxLen))
    rxBuf = next
  }
  rxBuf.set(chunk, rxLen)
  rxLen += chunk.length
  processBuffer()
}

export function useReceiverInfo() {
  const { getInstance } = useSerial()

  onMounted(() => {
    getInstance().addEventListener('data', handleData)
  })

  onUnmounted(() => {
    getInstance().removeEventListener('data', handleData)
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
