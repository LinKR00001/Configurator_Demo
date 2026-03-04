/**
 * Global Serial Manager Instance
 * 管理全局的SerialManager实例
 */

import { ref, readonly } from 'vue'
import { SerialManager } from '@/utils/SerialManager'

let globalSerialManager: SerialManager | null = null

export function useGlobalSerialManager() {
  const serialManager = ref<SerialManager | null>(null)

  /**
   * 创建或获取全局SerialManager实例
   */
  const getInstance = (): SerialManager => {
    if (!globalSerialManager) {
      globalSerialManager = new SerialManager()
    }
    serialManager.value = globalSerialManager
    return globalSerialManager
  }

  /**
   * 获取当前实例
   */
  const getCurrent = (): SerialManager | null => {
    return globalSerialManager
  }

  /**
   * 清理实例
   */
  const cleanup = (): void => {
    if (globalSerialManager) {
      globalSerialManager.cleanup()
      globalSerialManager = null
    }
    serialManager.value = null
  }

  return {
    serialManager: readonly(serialManager),
    getInstance,
    getCurrent,
    cleanup
  }
}
