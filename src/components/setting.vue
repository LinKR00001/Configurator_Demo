<template>
  <div class="welcome-container">
    <!-- 欢迎区域 -->
    <section class="welcome-section">
      <h1 class="page-title">设置界面</h1>
      <p class="description">
        配置 BETAFPV 飞控
      </p>
    </section>

    <!-- 飞控信息卡片 -->
    <section class="info-card">
      <h2 class="card-title">飞控信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">固件版本</span>
          <span class="info-value">
            {{ flightControllerInfo.majorVersion }}.{{ flightControllerInfo.minorVersion }}.{{ flightControllerInfo.patchVersion }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">板子类型</span>
          <span class="info-value">{{ flightControllerInfo.targetName  }}</span>
        </div>
      </div>
    </section>

    <!-- 调试卡片（原有发送按钮 + 新增接收数据显示） -->
    <div class="debug-card">
      <section class="info-card">
        <h2 class="card-title">调试工具</h2>
        <button @click="sendBytes" class="send-btn">发送测试字节</button>
        <!-- 新增：显示接收到的数据 -->
        <div class="received-data" v-if="receivedData">
          <h3>接收数据：</h3>
          <pre>{{ receivedData }}</pre>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useGlobalSerialManager } from '@/composables/useGlobalSerialManager'

// 获取全局串口管理器单例
const { getInstance } = useGlobalSerialManager()
const serialManager = getInstance()

// 调试：打印 serialManager 查看其内部结构（可删除）
console.log('serialManager:', serialManager)

// 板子类型映射表
const TARGET_NAME_MAP = {
  10: 'Aquila20',
  // 可以添加更多映射，例如：
  // 11: 'Aquila30',
  // 12: 'RacerX',
}

const flightControllerInfo = ref({
  majorVersion: '未知',
  minorVersion: '未知',
  patchVersion: '未知',
  targetId: '未知',
})

// 响应式连接状态
const isConnected = ref(serialManager.isConnected)

// 接收到的原始数据（用于显示）
const receivedData = ref('')

// 监听连接状态变化
const handleConnected = () => {
  isConnected.value = true
}
const handleDisconnected = () => {
  isConnected.value = false
}

// 解析函数：根据接收到的字节更新飞控信息
function parseVerMsg(bytes) {
  // 假设飞控信息以特定格式发送
  // 这里需要根据实际协议调整判断条件和字段位置
  if (bytes.length >= 16 && bytes[0] === 0xFE && bytes[5] === 0x02) {
    flightControllerInfo.value.majorVersion = bytes[9]
    flightControllerInfo.value.minorVersion = bytes[10]
    flightControllerInfo.value.patchVersion = bytes[11]
    
    const id = bytes[8]
    flightControllerInfo.value.targetId = id // 保留原始值
    flightControllerInfo.value.targetName = TARGET_NAME_MAP[id] || `未知板型(${id})` // 映射名称，若无映射则显示原始值+提示

  }
}

// 处理接收到的数据
const handleData = (event) => {
  const data = event.data // Uint8Array
  if (!data) return

  console.log('Received raw data:', data)

  // 调用解析函数尝试更新飞控信息
  parseVerMsg(data)
}

onMounted(() => {
  // 注册事件监听
  serialManager.addEventListener?.('connected', handleConnected)
  serialManager.addEventListener?.('disconnected', handleDisconnected)
  serialManager.addEventListener?.('data', handleData)
})

onUnmounted(() => {
  // 移除事件监听
  serialManager.removeEventListener?.('connected', handleConnected)
  serialManager.removeEventListener?.('disconnected', handleDisconnected)
  serialManager.removeEventListener?.('data', handleData)
  // 不要调用 cleanup()，以免关闭串口影响其他组件
})

// 发送字节的方法
const sendBytes = async () => {
  if (!isConnected.value) {
    alert('串口未连接')
    return
  }

  try {
    const port = serialManager.port
    if (!port) throw new Error('无法获取串口对象')
    if (!port.writable) throw new Error('串口不可写')

    const writer = port.writable.getWriter()
    const data = new Uint8Array([0xFE, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0xA8, 0xF2])
    await writer.write(data)
    writer.releaseLock()

    console.log('字节发送成功', data)
  } catch (error) {
    console.error('发送失败', error)
    alert('发送失败：' + error.message)
  }
}
</script>

<style scoped>
.welcome-container {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* 欢迎区域 */
.welcome-section {
  margin-bottom: 32px;
}

.page-title {
  font-size: 2.2rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-primary, #2c3e50);
  letter-spacing: -0.5px;
}

.description {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--text-secondary, #4a5568);
  margin: 0;
  max-width: 600px;
}

/* 信息卡片 */
.info-card {
  background-color: var(--surface-card, #ffffff);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
  border: 1px solid var(--border-color, #e9ecef);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.info-card:hover {
  box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: var(--text-primary, #1e293b);
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary-light, #e2e8f0);
}

/* 信息网格 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  background-color: var(--surface-subtle, #f8fafc);
  border-radius: 14px;
  border: 1px solid var(--border-subtle, #edf2f7);
  transition: background-color 0.2s;
}

.info-item:hover {
  background-color: var(--surface-hover, #f1f5f9);
}

.info-label {
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted, #64748b);
}

.info-value {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--primary-color, #2563eb);
  word-break: break-word;
}

/* 发送按钮 */
.send-btn {
  background-color: var(--primary-color, #2563eb);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  margin-bottom: 16px;
}
.send-btn:hover {
  background-color: var(--primary-dark, #1d4ed8);
}

/* 接收数据显示区 */
.received-data {
  margin-top: 16px;
  padding: 12px;
  background-color: var(--surface-subtle, #f1f5f9);
  border-radius: 8px;
  border: 1px solid var(--border-subtle, #e2e8f0);
}

.received-data h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-primary, #334155);
}

.received-data pre {
  margin: 0;
  font-family: monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text-secondary, #475569);
}

/* 暗色主题适配（如果项目使用了暗色变量） */
@media (prefers-color-scheme: dark) {
  .info-card {
    background-color: #1e293b;
    border-color: #334155;
  }
  .card-title {
    color: #f1f5f9;
    border-bottom-color: #334155;
  }
  .info-item {
    background-color: #0f172a;
    border-color: #1e293b;
  }
  .info-item:hover {
    background-color: #1e293b;
  }
  .info-label {
    color: #94a3b8;
  }
  .info-value {
    color: #60a5fa;
  }
  .page-title {
    color: #f8fafc;
  }
  .description {
    color: #cbd5e1;
  }
  .received-data {
    background-color: #0f172a;
    border-color: #1e293b;
  }
  .received-data h3 {
    color: #e2e8f0;
  }
  .received-data pre {
    color: #cbd5e1;
  }
}
</style>