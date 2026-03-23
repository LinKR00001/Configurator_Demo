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
  RC: 105,
  SET_MOTOR: 214,
} as const

type MspDirection = '<' | '>' | '!'

export interface MspFrame {
  direction: MspDirection
  command: number
  payload: Uint8Array
}

type MspHandler = (frame: MspFrame) => void

const listenersByCmd = new Map<number, Set<MspHandler>>()

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

function dispatchFrame(frame: MspFrame) {
  if (ENABLE_MSP_PROTOCOL && ENABLE_MSP_RX_FRAME_LOG) {
    console.log(
      `[MSP RX] dir=${frame.direction} cmd=${frame.command} len=${frame.payload.length} payload=${toHex(frame.payload)}`
    )
  }

  const all = listenersByCmd.get(-1)
  if (all) all.forEach((handler) => handler(frame))
  const byCmd = listenersByCmd.get(frame.command)
  if (byCmd) byCmd.forEach((handler) => handler(frame))
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

  console.log('收到一包数据包', toHex(chunk))

  // 先把 chunk 喂给（FE F3 F4）状态机调试器
  MSP.read(chunk)

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

  async function send(command: number, payload: Uint8Array = new Uint8Array(0)): Promise<boolean> {
    return serial.send(encodeMspV1Frame(command, payload))
  }

  return {
    onMessage,
    send,
  }
}
