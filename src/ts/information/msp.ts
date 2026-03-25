import { useSerial } from '@/composables/useSerial'
import { ENABLE_MSP_RX_FRAME_LOG, ENABLE_MSP_PROTOCOL } from '@/ts/information/protocolFlags'

const MSP = {
  //demo 函数
  state: 0,
  read(readInfo: any) {
    const data = new Uint8Array(readInfo.data ?? readInfo);

    for (const chunk of data) {
        switch (this.state) {
          case 0:
            if (chunk === 0xFE) {
              this.state = 0xFE;
            }
            break;
          case 0xFE:
            if (chunk === 0xF3) {
              this.state = 0xF3;
            }
          case 0xF3:
            if (chunk === 0xF4) {
              this.state = 0;
              console.log('到达该阶段，开始解析数据');
            }
              break;
          default:
            break;
        }
      }
  }
}

export const MSP_CMD = {
  FC_VERSION: 3,
  NAME: 10,
  RAW_IMU: 102,
  RC: 105,
  ATTITUDE: 108,
  PID: 112,
  SET_PID: 202,
  SET_MOTOR: 214,
} as const

type MspDirection = '<' | '>' | '!'

export interface MspFrame {
  direction: MspDirection
  command: number
  payload: Uint8Array
}

export interface MspRcFrame {
  channels: number[]
  rawCount: number
}

export interface MspImuFrame {
  accX: number
  accY: number
  accZ: number
  gyroX: number
  gyroY: number
  gyroZ: number
}

export interface MspAttitudeFrame {
  roll: number   // degrees
  pitch: number  // degrees
  yaw: number    // degrees
}

export interface MspPidFrame {
  rollP: number
  rollI: number
  rollD: number
  pitchP: number
  pitchI: number
  pitchD: number
  yawP: number
  yawI: number
  yawD: number
}

type MspHandler = (frame: MspFrame) => void
type MspRcHandler = (rc: MspRcFrame) => void
type MspImuHandler = (imu: MspImuFrame) => void
type MspAttitudeHandler = (attitude: MspAttitudeFrame) => void
type MspPidHandler = (pid: MspPidFrame) => void

const listenersByCmd = new Map<number, Set<MspHandler>>()
const rcListeners = new Set<MspRcHandler>()
const imuListeners = new Set<MspImuHandler>()
const attitudeListeners = new Set<MspAttitudeHandler>()
const pidListeners = new Set<MspPidHandler>()

let initialized = false
let rxBuf = new Uint8Array(512)
let rxLen = 0

function ensureCapacity(required: number) {
  if (required <= rxBuf.length) return
  const next = new Uint8Array(Math.max(rxBuf.length * 2, required))
  next.set(rxBuf.subarray(0, rxLen))
  rxBuf = next
}

function xorChecksum(size: number, cmd: number, payload: Uint8Array): number {
  let checksum = (size ^ cmd) & 0xFF
  for (let i = 0; i < payload.length; i++) checksum ^= payload[i]!
  return checksum & 0xFF
}

export function encodeMspV1Frame(command: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const size = payload.length & 0xFF
  const frame = new Uint8Array(6 + payload.length)
  frame[0] = 0x24 // $
  frame[1] = 0x4D // M
  frame[2] = 0x3C // <
  frame[3] = size
  frame[4] = command & 0xFF
  frame.set(payload, 5)
  frame[5 + payload.length] = xorChecksum(size, frame[4], payload)
  return frame
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ')
}

function formatTimeWithMilliseconds(): string {
  const now = new Date()
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `${now.toLocaleTimeString('zh-CN', { hour12: false })}.${ms}`
}

function dispatchFrame(frame: MspFrame) {
  if (ENABLE_MSP_PROTOCOL && ENABLE_MSP_RX_FRAME_LOG) {
    const now = formatTimeWithMilliseconds()
    console.log(
      `[MSP RX ${now}] dir=${frame.direction} cmd=${frame.command} len=${frame.payload.length} payload=${toHex(frame.payload)}`
    )
  }

  const all = listenersByCmd.get(-1)
  if (all) all.forEach((handler) => handler(frame))
  const byCmd = listenersByCmd.get(frame.command)
  if (byCmd) byCmd.forEach((handler) => handler(frame))

  if (frame.direction === '>' && frame.command === MSP_CMD.RC) {
    const rc = parseRcPayload(frame.payload)
    if (rc) {
      rcListeners.forEach((handler) => handler(rc))
    }
  }

  if (frame.direction === '>' && frame.command === MSP_CMD.RAW_IMU) {
    const imu = parseImuPayload(frame.payload)
    if (imu) {
      imuListeners.forEach((handler) => handler(imu))
    }
  }

  if (frame.direction === '>' && frame.command === MSP_CMD.ATTITUDE) {
    const attitude = parseAttitudePayload(frame.payload)
    if (attitude) {
      attitudeListeners.forEach((handler) => handler(attitude))
    }
  }

  if (frame.direction === '>' && frame.command === MSP_CMD.PID) {
    const pid = parsePidPayload(frame.payload)
    if (pid) {
      pidListeners.forEach((handler) => handler(pid))
    }
  }
}

function parseImuPayload(payload: Uint8Array): MspImuFrame | null {
  if (payload.length < 12) return null
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  const toDisplayValue = (raw: number) => Number((raw / 1000).toFixed(3))
  return {
    accX:  toDisplayValue(view.getInt16(0,  true)),
    accY:  toDisplayValue(view.getInt16(2,  true)),
    accZ:  toDisplayValue(view.getInt16(4,  true)),
    gyroX: toDisplayValue(view.getInt16(6,  true)),
    gyroY: toDisplayValue(view.getInt16(8,  true)),
    gyroZ: toDisplayValue(view.getInt16(10, true)),
  }
}

function parseAttitudePayload(payload: Uint8Array): MspAttitudeFrame | null {
  if (payload.length < 6) return null
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  return {
    roll:  view.getInt16(0, true) / 10,
    pitch: view.getInt16(2, true) / 10,
    yaw:   view.getInt16(4, true),
  }
}

function parsePidPayload(payload: Uint8Array): MspPidFrame | null {
  // MSP_PID payload starts with Roll/Pitch/Yaw in P-I-D byte triplets.
  if (payload.length < 9) return null
  return {
    rollP: payload[0]!,
    rollI: payload[1]!,
    rollD: payload[2]!,
    pitchP: payload[3]!,
    pitchI: payload[4]!,
    pitchD: payload[5]!,
    yawP: payload[6]!,
    yawI: payload[7]!,
    yawD: payload[8]!,
  }
}

function parseRcPayload(payload: Uint8Array): MspRcFrame | null {
  const count = Math.floor(payload.length / 2)
  if (count < 4) return null

  const raw = new Array<number>(count)
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  for (let i = 0; i < count; i++) {
    raw[i] = view.getUint16(i * 2, true)
  }

  // FC 侧 MSP_RC 顺序：roll, pitch, throttle, yaw, aux1...
  // UI 侧主通道使用：roll, pitch, yaw, throttle
  const channels = [
    raw[0]!,
    raw[1]!,
    raw[3]!,
    raw[2]!,
    ...raw.slice(4),
  ]

  return {
    channels,
    rawCount: count,
  }
}

function processBuffer() {
  let i = 0
  while (i < rxLen) {
    if (rxBuf[i] !== 0x24) { // $
      i++
      continue
    }
    if (i + 6 > rxLen) break
    if (rxBuf[i + 1] !== 0x4D) { // M
      i++
      continue
    }

    const dir = rxBuf[i + 2]
    if (dir !== 0x3E && dir !== 0x21 && dir !== 0x3C) { // > ! <
      i++
      continue
    }

    const size = rxBuf[i + 3]!
    const cmd = rxBuf[i + 4]!
    const frameLen = 6 + size
    if (i + frameLen > rxLen) break

    const payload = rxBuf.slice(i + 5, i + 5 + size)
    const checksum = rxBuf[i + 5 + size]!
    if (checksum === xorChecksum(size, cmd, payload)) {
      const direction: MspDirection = dir === 0x3E ? '>' : (dir === 0x21 ? '!' : '<')
      dispatchFrame({ direction, command: cmd, payload })
      i += frameLen
    } else {
      i++
    }
  }

  if (i > 0 && i < rxLen) {
    rxBuf.copyWithin(0, i, rxLen)
    rxLen -= i
  } else if (i >= rxLen) {
    rxLen = 0
  }
}

function handleSerialData(event: any) {
  const chunk: Uint8Array | undefined = event?.data
  if (!chunk?.length) return

  // MSP.read(chunk)  //这个估计是不需要的

  // 再把 chunk 喂给（$ M <）MSP v1 解析器，方便你同时观察两种协议（若设备确实发的是该协议）
  ensureCapacity(rxLen + chunk.length)
  rxBuf.set(chunk, rxLen)
  rxLen += chunk.length
  processBuffer()
}

function initMsp() {
  if (initialized) return
  initialized = true
  const serial = useSerial().getInstance()
  serial.addEventListener('data', handleSerialData)
  serial.addEventListener('disconnected', () => {
    rxLen = 0
  })
}

export function useMsp() {
  initMsp()
  const serial = useSerial().getInstance()

  function onMessage(command: number, handler: MspHandler): () => void {
    const key = command
    let set = listenersByCmd.get(key)
    if (!set) {
      set = new Set<MspHandler>()
      listenersByCmd.set(key, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
      if (set && set.size === 0) listenersByCmd.delete(key)
    }
  }

  function onRcMessage(handler: MspRcHandler): () => void {
    rcListeners.add(handler)
    return () => {
      rcListeners.delete(handler)
    }
  }

  function onImuMessage(handler: MspImuHandler): () => void {
    imuListeners.add(handler)
    return () => {
      imuListeners.delete(handler)
    }
  }

  function onAttitudeMessage(handler: MspAttitudeHandler): () => void {
    attitudeListeners.add(handler)
    return () => {
      attitudeListeners.delete(handler)
    }
  }

  function onPidMessage(handler: MspPidHandler): () => void {
    pidListeners.add(handler)
    return () => {
      pidListeners.delete(handler)
    }
  }

  async function send(command: number, payload: Uint8Array = new Uint8Array(0)): Promise<boolean> {
    const frame = encodeMspV1Frame(command, payload)
    const now = formatTimeWithMilliseconds()
    console.log(`[MSP TX ${now}] cmd=${command} len=${payload.length} frame=${toHex(frame)}`)
    return serial.send(frame)
  }

  return {
    onMessage,
    onRcMessage,
    onImuMessage,
    onAttitudeMessage,
    onPidMessage,
    send,
  }
}
