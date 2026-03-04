/**
 * Connection State Management
 * 管理全局的串口连接状态
 */

import { ref, readonly } from 'vue'

interface ConnectionState {
  isConnected: boolean
  port: string | null
  baudRate: number
  connected_at: number | null
}

// 全局连接状态
const connectionState = ref<ConnectionState>({
  isConnected: false,
  port: null,
  baudRate: 115200,
  connected_at: null
})

export function useConnection() {
  /**
   * 设置连接成功
   */
  const setConnected = (port: string, baudRate: number = 115200): void => {
    connectionState.value = {
      isConnected: true,
      port,
      baudRate,
      connected_at: Date.now()
    }
  }

  /**
   * 设置断开连接
   */
  const setDisconnected = (): void => {
    connectionState.value = {
      isConnected: false,
      port: null,
      baudRate: 115200,
      connected_at: null
    }
  }

  /**
   * 获取连接持续时间（毫秒）
   */
  const getConnectionDuration = (): number => {
    if (!connectionState.value.connected_at) return 0
    return Date.now() - connectionState.value.connected_at
  }

  return {
    // 只读的连接状态
    connectionState: readonly(connectionState),

    // 修改连接状态的方法
    setConnected,
    setDisconnected,
    getConnectionDuration
  }
}
