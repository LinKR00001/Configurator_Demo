import { useSerial } from '@/composables/useSerial'
import { ENABLE_MSP_RX_FRAME_LOG, ENABLE_MSP_PROTOCOL } from '@/ts/msp/protocolFlags'

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
  RC_TUNING: 111,
  PID: 112,
  SET_PID: 202,
  SET_RC_TUNING: 204,
  RESET_CONF: 208,
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
  accX: number   // g
  accY: number   // g
  accZ: number   // g
  gyroX: number  // rad/s
  gyroY: number  // rad/s
  gyroZ: number  // rad/s
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

export interface MspRcTuningFrame {
  // Roll
  rcRateRoll: number        // uint8  rcRates[FD_ROLL]  — center sensitivity
  rcExpoRoll: number        // uint8  rcExpo[FD_ROLL]
  rateRoll: number          // uint8  rates[FD_ROLL]    — scale factor
  rateLimitRoll: number     // uint16 rate_limit[FD_ROLL] deg/s
  // Pitch
  rcRatePitch: number       // uint8  rcRates[FD_PITCH]
  rcExpoPitch: number       // uint8  rcExpo[FD_PITCH]
  ratePitch: number         // uint8  rates[FD_PITCH]
  rateLimitPitch: number    // uint16 rate_limit[FD_PITCH] deg/s
  // Yaw
  rcRateYaw: number         // uint8  rcRates[FD_YAW]
  rcExpoYaw: number         // uint8  rcExpo[FD_YAW]
  rateYaw: number           // uint8  rates[FD_YAW]
  rateLimitYaw: number      // uint16 rate_limit[FD_YAW] deg/s
  // Throttle
  thrMid: number            // uint8  thrMid8
  thrExpo: number           // uint8  thrExpo8
  thrHover: number          // uint8  thrHover8
  // Preserved fields (write back as-is)
  tpaRate: number           // uint8  (was tpa_rate)
  tpaBreakpoint: number     // uint16 (was tpa_breakpoint)
  throttleLimitType: number // uint8
  throttleLimitPercent: number // uint8
  ratesType: number         // uint8
}

type MspHandler = (frame: MspFrame) => void
type MspRcHandler = (rc: MspRcFrame) => void
type MspImuHandler = (imu: MspImuFrame) => void
type MspAttitudeHandler = (attitude: MspAttitudeFrame) => void
type MspPidHandler = (pid: MspPidFrame) => void
type MspRcTuningHandler = (rcTuning: MspRcTuningFrame) => void

const listenersByCmd = new Map<number, Set<MspHandler>>()
const rcListeners = new Set<MspRcHandler>()
const imuListeners = new Set<MspImuHandler>()
const attitudeListeners = new Set<MspAttitudeHandler>()
const pidListeners = new Set<MspPidHandler>()
const rcTuningListeners = new Set<MspRcTuningHandler>()

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

  if (frame.direction === '>' && frame.command === MSP_CMD.RC_TUNING) {
    const rcTuning = parseRcTuningPayload(frame.payload)
    if (rcTuning) {
      rcTuningListeners.forEach((handler) => handler(rcTuning))
    }
  }
}

function parseImuPayload(payload: Uint8Array): MspImuFrame | null {
  if (payload.length < 12) return null
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  // ACC: 512 units per g  → divide by 512
  const toAcc  = (raw: number) => Number((raw / 512).toFixed(4))
  // GYRO: 1 unit per deg/s  → multiply by π/180 to get rad/s
  const DEG_TO_RAD = Math.PI / 180
  const toGyro = (raw: number) => Number((raw * DEG_TO_RAD).toFixed(4))
  return {
    accX:  toAcc(view.getInt16(0,  true)),
    accY:  toAcc(view.getInt16(2,  true)),
    accZ:  toAcc(view.getInt16(4,  true)),
    gyroX: toGyro(view.getInt16(6,  true)),
    gyroY: toGyro(view.getInt16(8,  true)),
    gyroZ: toGyro(view.getInt16(10, true)),
  }
}

function parseAttitudePayload(payload: Uint8Array): MspAttitudeFrame | null {
  if (payload.length < 6) return null
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  // Attitude: 0.1 deg resolution → divide by 10
  return {
    roll:  Number((view.getInt16(0, true) / 10).toFixed(1)),
    pitch: Number((view.getInt16(2, true) / 10).toFixed(1)),
    yaw:   Number((view.getInt16(4, true) / 10).toFixed(1)),
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

function parseRcTuningPayload(payload: Uint8Array): MspRcTuningFrame | null {
  // MSP_RC_TUNING response is 24 bytes minimum (added in v1.43/v1.47)
  if (payload.length < 24) return null
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
  return {
    // byte 0: rcRates[FD_ROLL]
    rcRateRoll:          payload[0]!,
    // byte 1: rcExpo[FD_ROLL]
    rcExpoRoll:          payload[1]!,
    // byte 2-4: rates[R,P,Y]
    rateRoll:            payload[2]!,
    ratePitch:           payload[3]!,
    rateYaw:             payload[4]!,
    // byte 5: was tpa_rate
    tpaRate:             payload[5]!,
    // byte 6-7: thrMid8, thrExpo8
    thrMid:              payload[6]!,
    thrExpo:             payload[7]!,
    // byte 8-9: was tpa_breakpoint (uint16 LE)
    tpaBreakpoint:       view.getUint16(8, true),
    // byte 10: rcExpo[FD_YAW]
    rcExpoYaw:           payload[10]!,
    // byte 11: rcRates[FD_YAW]
    rcRateYaw:           payload[11]!,
    // byte 12: rcRates[FD_PITCH]
    rcRatePitch:         payload[12]!,
    // byte 13: rcExpo[FD_PITCH]
    rcExpoPitch:         payload[13]!,
    // byte 14-15: throttle_limit_type, throttle_limit_percent
    throttleLimitType:   payload[14]!,
    throttleLimitPercent:payload[15]!,
    // byte 16-21: rate_limit[R,P,Y] (uint16 LE each)
    rateLimitRoll:       view.getUint16(16, true),
    rateLimitPitch:      view.getUint16(18, true),
    rateLimitYaw:        view.getUint16(20, true),
    // byte 22: rates_type
    ratesType:           payload[22]!,
    // byte 23: thrHover8
    thrHover:            payload[23]!,
  }
}

export function encodeSetRcTuningPayload(t: MspRcTuningFrame): Uint8Array {
  const buf = new Uint8Array(24)
  const view = new DataView(buf.buffer)
  buf[0]  = t.rcRateRoll   & 0xFF
  buf[1]  = t.rcExpoRoll   & 0xFF
  buf[2]  = t.rateRoll     & 0xFF
  buf[3]  = t.ratePitch    & 0xFF
  buf[4]  = t.rateYaw      & 0xFF
  buf[5]  = t.tpaRate      & 0xFF
  buf[6]  = t.thrMid       & 0xFF
  buf[7]  = t.thrExpo      & 0xFF
  view.setUint16(8,  t.tpaBreakpoint,       true)
  buf[10] = t.rcExpoYaw    & 0xFF
  buf[11] = t.rcRateYaw    & 0xFF
  buf[12] = t.rcRatePitch  & 0xFF
  buf[13] = t.rcExpoPitch  & 0xFF
  buf[14] = t.throttleLimitType    & 0xFF
  buf[15] = t.throttleLimitPercent & 0xFF
  view.setUint16(16, t.rateLimitRoll,  true)
  view.setUint16(18, t.rateLimitPitch, true)
  view.setUint16(20, t.rateLimitYaw,   true)
  buf[22] = t.ratesType    & 0xFF
  buf[23] = t.thrHover     & 0xFF
  return buf
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

  function onRcTuningMessage(handler: MspRcTuningHandler): () => void {
    rcTuningListeners.add(handler)
    return () => {
      rcTuningListeners.delete(handler)
    }
  }

  async function send(command: number, payload: Uint8Array = new Uint8Array(0)): Promise<boolean> {
    const frame = encodeMspV1Frame(command, payload)
    if (ENABLE_MSP_RX_FRAME_LOG) {
      const now = formatTimeWithMilliseconds()
      console.log(`[MSP TX ${now}] cmd=${command} len=${payload.length} frame=${toHex(frame)}`)
    }
    return serial.send(frame)
  }

  return {
    onMessage,
    onRcMessage,
    onImuMessage,
    onAttitudeMessage,
    onPidMessage,
    onRcTuningMessage,
    send,
  }
}
