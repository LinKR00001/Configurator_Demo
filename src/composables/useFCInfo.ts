/**
 * Flight Controller Info
 * 全局飞控信息状态 + 定时轮询，生命周期独立于任何组件。
 * 由始终挂载的 SerialPanel 调用 init() 启动，其他组件只读取 fcInfo。
 */

import { ref, readonly } from 'vue'
import { useSerial } from './useSerial'

// 查询飞控版本信息的指令
const QUERY_CMD = new Uint8Array([0xFE, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0xA8, 0xF2])
const POLL_INTERVAL_MS = 2000
const MSG_ID_RC_CHANNELS = 7



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
})


let pollTimer: ReturnType<typeof setInterval> | null = null
let initialized = false

function resetFCInfo() {
  fcInfo.value = { majorVersion: 0, minorVersion: 0, patchVersion: 0, targetId: 0, targetName: '未知' }
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
  const { getInstance } = useSerial()
  await getInstance().send(QUERY_CMD)
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

    serialManager.addEventListener('connected', () => startPolling())
    serialManager.addEventListener('disconnected', () => stopPolling())
    serialManager.addEventListener('data', (event: any) => {
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
  }
}
