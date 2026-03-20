<template>
  <div class="rate-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>RATE设置</h1>
        <p class="page-subtitle">配置飞行器姿态控制参数</p>
      </div>
      <div class="header-right">
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span>{{ connectionState.isConnected ? '已连接' : '未连接' }}</span>
        </div>
      </div>
    </div>

    <!-- 未连接提示 -->
    <div v-if="!connectionState.isConnected" class="not-connected">
      <span class="not-connected-icon">○</span>
      <p>请先通过顶部串口面板连接飞控</p>
    </div>

    <!-- 主内容 -->
    <template v-else>
      <div class="main-layout">

        <!-- ── 左侧：Rate 参数面板 ─────────────────────────────── -->
        <div class="rate-col">

          <!-- Rate 设置 -->
          <div class="panel">
            <div class="panel-header">
              <h2>RATE设置</h2>
              <span class="updated-at" v-if="lastUpdateTime">{{ lastUpdateTime }}</span>
            </div>

            <!-- Roll 轴 -->
            <div class="axis-card roll-card">
              <div class="axis-label">
                <span class="axis-dot roll-dot"></span>
                <span class="axis-name">Roll</span>
                <span class="axis-cn">横滚轴</span>
              </div>
              <div class="param-grid">
                <div class="param-item">
                  <span class="param-label">中央灵敏度</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.rollCenter"
                      step="1"
                      min="0"
                      max="200"
                      class="param-input"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">最大角速率</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.rollRate"
                      step="1"
                      min="0"
                      max="2000"
                      class="param-input"
                    >
                    <span class="param-unit">°/s</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.rollExpo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pitch 轴 -->
            <div class="axis-card pitch-card">
              <div class="axis-label">
                <span class="axis-dot pitch-dot"></span>
                <span class="axis-name">Pitch</span>
                <span class="axis-cn">俯仰轴</span>
              </div>
              <div class="param-grid">
                <div class="param-item">
                  <span class="param-label">中央灵敏度</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.pitchCenter"
                      step="1"
                      min="0"
                      max="200"
                      class="param-input"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">最大角速率</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.pitchRate"
                      step="1"
                      min="0"
                      max="2000"
                      class="param-input"
                    >
                    <span class="param-unit">°/s</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.pitchExpo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Yaw 轴 -->
            <div class="axis-card yaw-card">
              <div class="axis-label">
                <span class="axis-dot yaw-dot"></span>
                <span class="axis-name">Yaw</span>
                <span class="axis-cn">偏航轴</span>
              </div>
              <div class="param-grid">
                <div class="param-item">
                  <span class="param-label">中央灵敏度</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.yawCenter"
                      step="1"
                      min="0"
                      max="200"
                      class="param-input"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">最大角速率</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.yawRate"
                      step="1"
                      min="0"
                      max="2000"
                      class="param-input"
                    >
                    <span class="param-unit">°/s</span>
                  </div>
                </div>
                <div class="param-item">
                  <span class="param-label">Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="rate.yawExpo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── 右侧：油门参数 + 可视化预览 ─────────────────── -->
        <div class="right-col">

          <!-- 油门参数设置 -->
          <div class="panel">
            <div class="panel-header">
              <h2>油门参数</h2>
            </div>

            <div class="throttle-grid">
              <div class="throttle-item">
                <div class="throttle-visual">
                  <div class="throttle-bar-container">
                    <div
                      class="throttle-bar"
                      :style="{ width: throttleMidPercent + '%' }"
                    ></div>
                  </div>
                  <div class="throttle-marker" :style="{ left: throttleMidPercent + '%' }"></div>
                </div>
                <div class="throttle-info">
                  <span class="throttle-label">油门中值</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="throttle.mid"
                      step="1"
                      min="0"
                      max="100"
                      class="param-input"
                      @input="updateThrottleMid"
                    >
                    <span class="param-unit">%</span>
                  </div>
                </div>
              </div>

              <div class="throttle-item">
                <div class="throttle-curve">
                  <svg viewBox="0 0 200 100" class="expo-curve-svg">
                    <!-- 坐标系 -->
                    <line x1="10" y1="90" x2="190" y2="90" stroke="#334155" stroke-width="1"/>
                    <line x1="10" y1="90" x2="10" y2="10" stroke="#334155" stroke-width="1"/>
                    <!-- 曲线 -->
                    <path
                      :d="expoCurvePath"
                      fill="none"
                      stroke="#38bdf8"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                    <!-- 中点标记 -->
                    <circle
                      :cx="throttleMidX"
                      :cy="throttleMidY"
                      r="4"
                      fill="#38bdf8"
                    />
                  </svg>
                </div>
                <div class="throttle-info">
                  <span class="throttle-label">油门 Expo</span>
                  <div class="param-control">
                    <input
                      type="number"
                      v-model.number="throttle.expo"
                      step="1"
                      min="-100"
                      max="100"
                      class="param-input"
                      @input="updateThrottleExpo"
                    >
                    <span class="param-unit"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'

const { getInstance, connectionState } = useSerial()

// ── 状态数据 ─────────────────────────────────────────────────
const lastUpdateTime = ref('')
const txCount = ref(0)

// Rate 参数
const rate = reactive({
  rollCenter: 50, rollRate: 720, rollExpo: 0,
  pitchCenter: 50, pitchRate: 720, pitchExpo: 0,
  yawCenter: 50, yawRate: 360, yawExpo: 0
})

// 油门参数
const throttle = reactive({
  mid: 50,
  expo: 0
})

// ── 计算属性 ─────────────────────────────────────────────────
const throttleMidPercent = computed(() => throttle.mid)

// 油门 Expo 曲线路径
const throttleMidX = computed(() => 10 + (throttle.mid / 100) * 180)
const throttleMidY = computed(() => {
  const normalized = throttle.mid / 100
  const expoFactor = throttle.expo / 100
  const curve = normalized * normalized * expoFactor + normalized * (1 - expoFactor)
  return 90 - curve * 80
})

const expoCurvePath = computed(() => {
  const midX = throttleMidX.value
  const midY = throttleMidY.value
  return `M 10,90 Q ${midX},${90 - (90 - midY) * 0.5} 190,10`
})

// ── Rate 曲线计算 ─────────────────────────────────────────────
function getRateCurvePath(center: number, maxRate: number, expo: number): string {
  const points: string[] = []
  const steps = 20

  for (let i = 0; i <= steps; i++) {
    const input = (i / steps) * 100 // 0-100
    const normalizedInput = input / 100

    // Rate 曲线公式
    let output: number
    const expoFactor = expo / 100

    if (normalizedInput <= center / 100) {
      // 低灵敏度区域
      const lowInput = normalizedInput / (center / 100)
      output = lowInput * lowInput * (center / 100) * expoFactor + lowInput * (center / 100) * (1 - expoFactor)
    } else {
      // 高灵敏度区域
      const highInput = (normalizedInput - center / 100) / (1 - center / 100)
      const lowPart = 1
      const highPart = highInput * highInput * expoFactor + highInput * (1 - expoFactor)
      output = lowPart + (highPart - 1) * (maxRate / 1000)
    }

    output = Math.max(0, Math.min(1, output))

    const x = 20 + input * 2.6
    const y = 170 - output * (maxRate / 720) * 80

    if (i === 0) {
      points.push(`M ${x},${y}`)
    } else {
      points.push(`L ${x},${y}`)
    }
  }

  return points.join(' ')
}

// ── 辅助函数 ─────────────────────────────────────────────────
function updateThrottleMid() {
  if (throttle.mid < 0) throttle.mid = 0
  if (throttle.mid > 100) throttle.mid = 100
}

function updateThrottleExpo() {
  if (throttle.expo < -100) throttle.expo = -100
  if (throttle.expo > 100) throttle.expo = 100
}

function timestamp() { return new Date().toLocaleTimeString('zh-CN', { hour12: false }) }

// ── 数据处理 ─────────────────────────────────────────────────
function handleData(event: any) {
  const chunk: Uint8Array = event.data
  if (!chunk?.length) return
}

onMounted(() => { getInstance().addEventListener('data', handleData) })
onUnmounted(() => {
  getInstance().removeEventListener('data', handleData)
})
</script>

<style scoped>
.rate-container {
  padding: var(--spacing-2xl);
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  box-sizing: border-box;
}

/* ── 标题栏 ──────────────────────────────────────────────── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--primary-500);
  margin-bottom: var(--spacing-lg);
  flex-shrink: 0;
}
.page-header-left h1 { margin-bottom: 2px; }
.page-subtitle { font-size: var(--font-size-sm); color: var(--text-disabled); margin: 0; }
.header-right { display: flex; align-items: center; gap: var(--spacing-md); flex-shrink: 0; }

/* ── 未连接 ──────────────────────────────────────────────── */
.not-connected {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: var(--spacing-2xl);
  gap: var(--spacing-md); color: var(--text-disabled);
}
.not-connected-icon { font-size: 48px; opacity: 0.3; }

/* ── 主布局：左右分栏 ────────────────────────────────────── */
.main-layout {
  display: flex;
  gap: var(--spacing-xl);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 左侧 Rate 参数列 */
.rate-col {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: var(--spacing-sm);
}

/* 右侧油门参数 + 曲线预览列 */
.right-col {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  overflow-y: auto;
}

/* ── 面板样式 (与Gyro/Motor一致) ─────────────────────────── */
.panel {
  border-radius: 0;
  box-shadow: none;
  border: none;
  border-bottom: 1px solid var(--border-light);
  background-color: transparent;
  padding: var(--spacing-lg) 0;
  flex-shrink: 0;
}
.panel:last-child { border-bottom: none; }
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: var(--spacing-md); margin-bottom: var(--spacing-md);
  border-left: 3px solid var(--primary-500); padding-left: var(--spacing-md);
}
.panel-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
.updated-at { font-size: var(--font-size-sm); color: var(--text-disabled); font-family: 'Consolas', monospace; }

/* ── 轴卡片样式 (与PidSetting一致) ──────────────────────── */
.axis-card {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--surface-50);
  border-left-width: 4px;
  margin-bottom: var(--spacing-md);
}
.axis-card:last-child { margin-bottom: 0; }
.roll-card  { border-left-color: #f87171; }
.pitch-card { border-left-color: #60a5fa; }
.yaw-card   { border-left-color: #34d399; }

.axis-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}
.axis-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.roll-dot  { background: #f87171; box-shadow: 0 0 6px rgba(248,113,113,0.5); }
.pitch-dot { background: #60a5fa; box-shadow: 0 0 6px rgba(96,165,250,0.5); }
.yaw-dot   { background: #34d399; box-shadow: 0 0 6px rgba(52,211,153,0.5); }

.axis-name {
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-primary);
}
.axis-cn {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

/* ── 参数网格 ────────────────────────────────────────────── */
.param-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-md);
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.param-label {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
  text-align: center;
}

.param-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.param-input {
  width: 60px;
  padding: 6px 8px;
  text-align: center;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--surface-100);
  color: var(--text-primary);
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.param-unit {
  font-size: 12px;
  color: var(--text-disabled);
  font-family: 'Consolas', monospace;
}

/* ── 油门参数 ────────────────────────────────────────────── */
.throttle-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-lg);
}

.throttle-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.throttle-visual {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
}

.throttle-bar-container {
  width: 100%;
  height: 8px;
  background: var(--surface-200);
  border-radius: 4px;
  overflow: hidden;
}

.throttle-bar {
  height: 100%;
  background: var(--primary-500);
  border-radius: 4px;
  transition: width 0.2s;
}

.throttle-marker {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 20px;
  background: var(--primary-500);
  border-radius: 2px;
  transform: translate(-50%, -50%);
  transition: left 0.2s;
}

.throttle-curve {
  height: 80px;
  background: var(--surface-100);
  border-radius: var(--radius-md);
  padding: var(--spacing-xs);
}

.expo-curve-svg {
  width: 100%;
  height: 100%;
}

.throttle-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
}

.throttle-label {
  font-size: var(--font-size-sm);
  color: var(--text-disabled);
}

/* ── 统计数据 ────────────────────────────────────────────── */
.panel--stat { padding: var(--spacing-md) 0; }
.stat-row { display: flex; gap: var(--spacing-lg); flex-wrap: wrap; }
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }

/* ── 3D 模型卡片 (与Gyro/Motor一致) ───────────────────── */
.model-card {
  background-color: var(--surface-950);
  border: 1px solid var(--surface-800);
  display: flex;
  flex-direction: column;
  min-height: 300px;
  overflow: hidden;
}

.model-title {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--surface-400);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  border-bottom: 1px solid var(--surface-800);
  flex-shrink: 0;
}

/* ── 曲线可视化场景 ──────────────────────────────────────── */
.scene-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
}

.curve-display {
  width: 100%;
  height: 100%;
}

.rate-curve-svg {
  width: 100%;
  height: 100%;
}

/* ── 状态读数 (与Gyro/Motor一致) ────────────────────────── */
.rate-readout {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--surface-800);
  flex-shrink: 0;
  background-color: var(--surface-900);
}

.readout-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.readout-label {
  font-size: 10px;
  color: var(--surface-500);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.readout-val {
  font-size: 14px;
  font-weight: 700;
  color: var(--surface-300);
  font-family: 'Consolas', 'Courier New', monospace;
  transition: color 0.15s;
  min-width: 60px;
  text-align: center;
}

.readout-divider {
  width: 1px;
  height: 32px;
  background-color: var(--surface-800);
}
</style>
