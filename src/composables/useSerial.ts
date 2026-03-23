/**
 * Serial Port Manager - Unified Serial Management
 * 整合串口管理、全局单例、连接状态
 */

import { ref, readonly, type Ref, type DeepReadonly } from 'vue'

// ==================== Types ====================
export interface SerialPortOptions {
  baudRate?: number
  dataBits?: 8 | 7 | 6 | 5
  stopBits?: 1 | 2
  parity?: 'none' | 'even' | 'odd'
}

export interface SerialConnectionEvent {
  type: 'connected' | 'disconnected' | 'data' | 'error'
  data?: Uint8Array
  error?: Error
  reason?: string
}

export interface ConnectionState {
  isConnected: boolean
  port: string | null
  baudRate: number
  connectedAt: number | null
}

/**
 * 将 ReadableStreamDefaultReader 封装为可 for-await-of 的异步迭代器。
 * 通过 shouldContinue 让循环在 disconnect/断连时可及时退出。
 */
async function* streamAsyncIterable(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  shouldContinue: () => boolean,
  onDone?: () => void
): AsyncGenerator<Uint8Array> {
  while (shouldContinue()) {
    const { done, value } = await reader.read()
    if (done) {
      onDone?.()
      break
    }
    if (value) yield value
  }
}

// Web Serial API 类型定义
interface SerialPort {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: SerialPortOptions): Promise<void>
  close(): Promise<void>
  getInfo(): { usbVendorId?: number; usbProductId?: number }
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[]
}

interface SerialPortFilter {
  usbVendorId?: number
  usbProductId?: number
}

// Extend Navigator interface
declare global {
  interface Navigator {
    serial?: {
      getPorts(): Promise<SerialPort[]>
      requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
    }
  }
}

// ==================== Constants ====================
export const DEFAULT_BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400,
  250000, 400000, 460800, 500000, 921600,
  1000000, 1500000, 2000000, 2470000
]

export const DEFAULT_OPTIONS: SerialPortOptions = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
}

// ==================== SerialManager Class ====================
export class SerialManager {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private isConnected = false
  private isReading = false
  private options: SerialPortOptions
  private listeners: Map<string, Set<(event: SerialConnectionEvent) => void>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(options: SerialPortOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.initializeListeners()
  }

  private initializeListeners(): void {
    ['connected', 'disconnected', 'data', 'error'].forEach(type => {
      this.listeners.set(type, new Set())
    })
  }

  /**
   * 获取可用的串口列表
   */
  async getPorts(): Promise<SerialPort[]> {
    try {
      if (!navigator.serial) {
        throw new Error('Web Serial API 不被支持')
      }
      return await navigator.serial.getPorts()
    } catch (error) {
      this.emit('error', { error: error as Error })
      return []
    }
  }

  /**
   * 请求并连接到串口
   */
  async connect(): Promise<boolean> {
    try {
      if (!navigator.serial) {
        throw new Error('Web Serial API 不被支持')
      }

      const port = await navigator.serial.requestPort()
      this.port = port

      await this.port.open(this.options)
      this.isConnected = true
      this.reconnectAttempts = 0

      this.startReading()

      // 获取端口信息
      const info = port.getInfo()
      const portName = info.usbVendorId
        ? `USB VID:${info.usbVendorId.toString(16)} PID:${info.usbProductId?.toString(16)}`
        : 'Serial Port'

      this.emit('connected', { data: undefined } as any)
      return true
    } catch (error) {
      this.isConnected = false
      this.isReading = false

      if (this.port) {
        try {
          await this.port.close()
        } catch (e) {
          console.warn('关闭失败的串口时出错:', e)
        }
        this.port = null
      }

      const err = error as Error
      this.emit('error', { error: err })
      console.error('连接失败:', err.message)
      return false
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    try {
      this.isReading = false

      if (this.reader) {
        try {
          this.reader.cancel()
        } catch (e) {
          console.warn('取消读取器时出错:', e)
        }
        this.reader = null
      }

      if (this.port && this.port.readable) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      if (this.port) {
        try {
          await this.port.close()
        } catch (e) {
          console.warn('关闭串口时出错:', e)
        }
        this.port = null
      }

      this.isConnected = false
      this.emit('disconnected', { reason: 'manual' })
    } catch (error) {
      const err = error as Error
      this.isConnected = false
      this.emit('error', { error: err })
      console.error('断开连接错误:', err.message)
    }
  }

  /**
   * 发送数据
   */
  async send(data: Uint8Array | ArrayBuffer): Promise<boolean> {
    try {
      if (!this.isConnected || !this.port) {
        throw new Error('串口未连接')
      }

      if (!this.port.writable) {
        throw new Error('串口写入流不可用')
      }

      const writer = this.port.writable.getWriter()
      try {
        const buffer = data instanceof Uint8Array ? data : new Uint8Array(data)
        await writer.write(buffer)
        return true
      } finally {
        writer.releaseLock()
      }
    } catch (error) {
      const err = error as Error

      if (err.message.includes('设备') || err.message.includes('端口')) {
        this.handleDeviceDisconnect(err.message)
      }

      this.emit('error', { error: err })
      console.error('发送失败:', err.message)
      return false
    }
  }

  /**
   * 发送字符串
   */
  async sendString(text: string): Promise<boolean> {
    const encoder = new TextEncoder()
    return this.send(encoder.encode(text))
  }

  /**
   * 启动读取循环
   */
  private startReading(): void {
    if (!this.isConnected || !this.port || !this.port.readable) {
      console.error('无法启动读取循环: 连接状态或端口不可用')
      return
    }

    this.isReading = true

    Promise.resolve().then(() => this.readLoop())
  }

  /**
   * 读取循环
   */
  private async readLoop(): Promise<void> {
    console.log('开始读取循环')
    try {
      const reader = this.port!.readable!.getReader()
      this.reader = reader

      let didDone = false
      for await (const value of streamAsyncIterable(
        reader,
        () => this.isReading && this.isConnected,
        () => { didDone = true }
      )) {
        this.handleReceivedData(value)
      }

      // 只有当 reader.read() 返回 done（读取流关闭）时才触发设备断连
      if (didDone && this.isConnected) {
        console.log('读取流已关闭，设备可能已断开')
        this.handleDeviceDisconnect('读取流已关闭')
      }
    } catch (error) {
      if (this.isReading) {
        const err = error as Error
        console.error('读取循环错误:', err.message)
        this.handleDeviceDisconnect(err.message)
        this.emit('error', { error: err })
      }
    } finally {
      this.isReading = false

      if (this.reader) {
        try {
          this.reader.releaseLock()
        } catch (e) {
          console.warn('释放读取器锁时出错:', e)
        }
        this.reader = null
      }
    }
  }

  /**
   * 处理设备断开连接
   */
  private handleDeviceDisconnect(reason: string): void {
    if (this.isConnected) {
      this.isConnected = false
      this.isReading = false
      this.emit('disconnected', { reason: reason || '设备断开连接' })
    }
  }

  /**
   * 处理接收到的数据
   */
  private handleReceivedData(data: Uint8Array): void {
    this.emit('data', { data })
  }

  /**
   * 检查连接状态
   */
  getConnected(): boolean {
    return this.isConnected
  }

  /**
   * 获取当前配置
   */
  getOptions(): SerialPortOptions {
    return { ...this.options }
  }

  /**
   * 更新配置
   */
  updateOptions(options: Partial<SerialPortOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * 监听事件
   */
  addEventListener(
    type: 'connected' | 'disconnected' | 'data' | 'error',
    listener: (event: SerialConnectionEvent) => void
  ): void {
    const listeners = this.listeners.get(type)
    if (listeners) {
      listeners.add(listener)
    }
  }

  /**
   * 移除事件监听
   */
  removeEventListener(
    type: 'connected' | 'disconnected' | 'data' | 'error',
    listener: (event: SerialConnectionEvent) => void
  ): void {
    const listeners = this.listeners.get(type)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * 发送事件
   */
  private emit(type: string, eventData: Partial<SerialConnectionEvent>): void {
    const listeners = this.listeners.get(type)
    if (listeners) {
      listeners.forEach(listener => {
        listener({ type: type as any, ...eventData } as SerialConnectionEvent)
      })
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.disconnect()
      } else {
        this.isReading = false

        if (this.reader) {
          try {
            this.reader.releaseLock()
          } catch (e) {
            console.warn('释放读取器锁时出错:', e)
          }
          this.reader = null
        }

        if (this.port) {
          try {
            await this.port.close()
          } catch (e) {
            console.warn('关闭串口时出错:', e)
          }
          this.port = null
        }
      }
    } finally {
      this.listeners.clear()
    }
  }

  /**
   * 获取支持的波特率列表
   */
  static getBaudRates(): number[] {
    return [...DEFAULT_BAUD_RATES]
  }
}

// ==================== Global Singleton & State ====================
let globalSerialManager: SerialManager | null = null

const connectionState = ref<ConnectionState>({
  isConnected: false,
  port: null,
  baudRate: 115200,
  connectedAt: null
})

// ==================== Composable ====================
export function useSerial() {
  /**
   * 获取或创建全局 SerialManager 实例
   */
  const getInstance = (): SerialManager => {
    if (!globalSerialManager) {
      globalSerialManager = new SerialManager()

      // 自动绑定全局状态同步
      globalSerialManager.addEventListener('connected', () => {
        connectionState.value = {
          isConnected: true,
          port: 'Serial Port',
          baudRate: globalSerialManager?.getOptions().baudRate || 115200,
          connectedAt: Date.now()
        }
      })

      globalSerialManager.addEventListener('disconnected', () => {
        connectionState.value = {
          isConnected: false,
          port: null,
          baudRate: 115200,
          connectedAt: null
        }
      })
    }
    return globalSerialManager
  }

  /**
   * 获取当前实例（可能为 null）
   */
  const getCurrent = (): SerialManager | null => {
    return globalSerialManager
  }

  /**
   * 清理全局实例
   */
  const cleanup = async (): Promise<void> => {
    if (globalSerialManager) {
      await globalSerialManager.cleanup()
      globalSerialManager = null
    }
    connectionState.value = {
      isConnected: false,
      port: null,
      baudRate: 115200,
      connectedAt: null
    }
  }

  /**
   * 获取连接持续时间（毫秒）
   */
  const getConnectionDuration = (): number => {
    if (!connectionState.value.connectedAt) return 0
    return Date.now() - connectionState.value.connectedAt
  }

  return {
    // 全局实例管理
    getInstance,
    getCurrent,
    cleanup,

    // 连接状态（只读）
    connectionState: readonly(connectionState) as DeepReadonly<Ref<ConnectionState>>,

    // 工具方法
    getConnectionDuration,

    // 常量
    baudRates: DEFAULT_BAUD_RATES
  }
}

