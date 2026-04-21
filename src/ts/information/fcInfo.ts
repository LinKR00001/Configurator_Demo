/**
 * Flight Controller Info
 * 全局飞控信息状态 + 定时轮询，生命周期独立于任何组件。
 * 由始终挂载的 SerialPanel 调用 init() 启动，其他组件只读取 fcInfo。
 */

import { ref, readonly } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { MSP_CMD, MSP2_CMD, encodeMspV1Frame, encodeMspV2NativeFrame, useMsp } from '@/ts/msp/msp'
import { ENABLE_CUSTOM_PROTOCOL, ENABLE_MSP_PROTOCOL, ENABLE_MSP_RX_FRAME_LOG } from '@/ts/msp/protocolFlags'

const QUERY_CMD = new Uint8Array([0xFE, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0xA8, 0xF2])
const POLL_INTERVAL_MS = 2000
const TARGET_NAME_MAP: Record<number, string> = {
  10: 'Aquila20',
}

// 模块级状态：跨组件共享、页面切换后仍保留
const fcInfo = ref({
  majorVersion: 0,
  minorVersion: 0,
  patchVersion: 0,
  targetId: 0,
  targetName: '未知',
  uid: '',
  activationFlag: false,
})


let pollTimer: ReturnType<typeof setInterval> | null = null
let initialized = false
let unbindVersionMessage: (() => void) | null = null
let unbindNameMessage: (() => void) | null = null
let unbindUidMessage: (() => void) | null = null

function resetFCInfo() {
  fcInfo.value = {
    majorVersion: 0,
    minorVersion: 0,
    patchVersion: 0,
    targetId: 0,
    targetName: '未知',
    uid: '',
    activationFlag: false,
  }
}

function parseFcVersion(payload: Uint8Array) {
  if (payload.length < 3) return
  fcInfo.value.majorVersion = payload[0]!
  fcInfo.value.minorVersion = payload[1]!
  fcInfo.value.patchVersion = payload[2]!
}

function parseFcName(payload: Uint8Array) {
  if (payload.length === 0) return
  const name = new TextDecoder().decode(payload).replace(/\0/g, '').trim()
  if (name) {
    fcInfo.value.targetName = name
    fcInfo.value.targetId = 0
  }
}

function parseUid(payload: Uint8Array) {
  if (payload.length === 0) return
  const uidPayload = payload.subarray(0, Math.min(20, payload.length))
  const uid = new TextDecoder()
    .decode(uidPayload)
    .replace(/\0/g, '')
    .trim()

  fcInfo.value.uid = uid
  fcInfo.value.activationFlag = payload.length > 20 ? payload[20]! === 1 : false
}

function parseVerMsg(bytes: Uint8Array) {
  if (bytes.length >= 16 && bytes[0] === 0xFE && bytes[5] === 0x02) {
    fcInfo.value.majorVersion = bytes[9]!
    fcInfo.value.minorVersion = bytes[10]!
    fcInfo.value.patchVersion = bytes[11]!
    const id = bytes[8]!
    fcInfo.value.targetId = id
    fcInfo.value.targetName = TARGET_NAME_MAP[id] || `未知板型(${id})`
  }
}

async function sendQueryCmd() {
  if (!ENABLE_CUSTOM_PROTOCOL) return
  const { getInstance } = useSerial()
  console.log(`[CUSTOM TX] frame=${toHex(QUERY_CMD)}`)
  await getInstance().send(QUERY_CMD)
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

async function requestMspFcVersionOnce() {
  if (!ENABLE_MSP_PROTOCOL) return false
  const { getInstance } = useSerial()
  const serialManager = getInstance()
  if (!serialManager.getConnected()) return false
  const frame = encodeMspV1Frame(MSP_CMD.FC_VERSION)
  if (ENABLE_MSP_RX_FRAME_LOG) {
    console.log(`[MSP TX][MSP_FC_VERSION] ${toHex(frame)}`)
  }
  return serialManager.send(frame)
}

async function requestMspUidOnce() {
  if (!ENABLE_MSP_PROTOCOL) return false
  const { getInstance } = useSerial()
  const serialManager = getInstance()
  if (!serialManager.getConnected()) return false
  const frame = encodeMspV1Frame(MSP_CMD.UID)
  if (ENABLE_MSP_RX_FRAME_LOG) {
    console.log(`[MSP TX][MSP_UID] ${toHex(frame)}`)
  }
  return serialManager.send(frame)
}

async function setActivationFlagOnce(flag: 0 | 1) {
  if (!ENABLE_MSP_PROTOCOL) return false
  const { getInstance } = useSerial()
  const serialManager = getInstance()
  if (!serialManager.getConnected()) return false

  const payload = new Uint8Array([flag])
  const frame = encodeMspV2NativeFrame(MSP2_CMD.ACTIVATION, payload)
  if (ENABLE_MSP_RX_FRAME_LOG) {
    console.log(`[MSP2 TX][MSP2_ACTIVATION=${flag}] ${toHex(frame)}`)
  }

  const sent = await serialManager.send(frame)
  if (!sent) return false
  return requestMspUidOnce()
}

async function activateFcOnce() {
  return setActivationFlagOnce(1)
}

async function deactivateFcOnce() {
  return setActivationFlagOnce(0)
}

function startPolling() {
  if (pollTimer !== null) return
  sendQueryCmd()
  pollTimer = setInterval(sendQueryCmd, POLL_INTERVAL_MS)
}

function stopPolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  resetFCInfo()
}

export function useFCInfo() {
  /**
   * 初始化：注册全局事件监听，仅执行一次。
   * 在始终挂载的组件（SerialPanel）中调用。
   */
  function init() {
    if (initialized) return
    initialized = true

    const { getInstance } = useSerial()
    const serialManager = getInstance()
    const { onMessage } = useMsp()

    const handleConnected = () => {
      startPolling()
    }

    serialManager.addEventListener('connected', handleConnected)
    serialManager.addEventListener('disconnected', () => stopPolling())
    unbindVersionMessage = onMessage(MSP_CMD.FC_VERSION, (frame) => {
      if (!ENABLE_MSP_PROTOCOL) return
      if (frame.direction !== '>') return
      parseFcVersion(frame.payload)
    })
    unbindNameMessage = onMessage(MSP_CMD.NAME, (frame) => {
      if (!ENABLE_MSP_PROTOCOL) return
      if (frame.direction !== '>') return
      parseFcName(frame.payload)
    })
    unbindUidMessage = onMessage(MSP_CMD.UID, (frame) => {
      if (!ENABLE_MSP_PROTOCOL) return
      if (frame.direction !== '>') return
      parseUid(frame.payload)
    })
    serialManager.addEventListener('data', (event: any) => {
      if (!ENABLE_CUSTOM_PROTOCOL) return
      if (event.data) parseVerMsg(event.data)
    })

    // 若初始化时串口已处于连接状态，立即开始轮询
    if (serialManager.getConnected()) {
      startPolling()
    }
  }

  return {
    fcInfo: readonly(fcInfo),
    init,
    requestMspFcVersionOnce,
    requestMspUidOnce,
    activateFcOnce,
    deactivateFcOnce,
  }
}
