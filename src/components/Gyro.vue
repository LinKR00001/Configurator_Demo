<template>
  <div class="gyro-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>陀螺仪</h1>
        <p class="page-subtitle">实时显示IMU相关数据</p>
      </div>
      <div class="header-right">
        <div :class="['status-indicator', connectionState.isConnected ? 'connected' : 'disconnected']">
          <span class="status-dot"></span>
          <span v-if="connectionState.isConnected">已连接</span>
          <span v-else>未连接</span>
        </div>
      </div>
    </div>

    <!-- 未连接提示 -->
    <div v-if="!connectionState.isConnected" class="not-connected">
      <span class="not-connected-icon">○</span>
      <p>请先通过顶部串口面板连接飞控</p>
    </div>

    <!-- 主内容：左侧数据 + 右侧 3D 模型 -->
    <template v-else>
      <div class="main-layout">

        <!-- ── 左侧：数据面板 ─────────────────────────────── -->
        <div class="data-col">

          <!-- 陀螺仪角速度 -->
          <div class="panel">
            <div class="panel-header">
              <h2>陀螺仪</h2>
              <span class="updated-at" v-if="imuUpdatedAt">{{ imuUpdatedAt }}</span>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">X（横滚轴）</span>
                <span class="data-value">{{ imuData.gyroX.toFixed(3) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Y（俯仰轴）</span>
                <span class="data-value">{{ imuData.gyroY.toFixed(3) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Z（偏航轴）</span>
                <span class="data-value">{{ imuData.gyroZ.toFixed(3) }}</span>
                <span class="data-unit">rad/s</span>
              </div>
            </div>
          </div>

          <!-- 加速度计 -->
          <div class="panel">
            <div class="panel-header">
              <h2>加速度计</h2>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">X 轴</span>
                <span class="data-value">{{ imuData.accX.toFixed(3) }}</span>
                <span class="data-unit">g</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Y 轴</span>
                <span class="data-value">{{ imuData.accY.toFixed(3) }}</span>
                <span class="data-unit">g</span>
              </div>
              <div :class="['data-card', { 'data-card--active': imuActive }]">
                <span class="data-label">Z 轴</span>
                <span class="data-value">{{ imuData.accZ.toFixed(3) }}</span>
                <span class="data-unit">g</span>
              </div>
            </div>
          </div>

          <!-- 姿态角 -->
          <div class="panel">
            <div class="panel-header">
              <h2>姿态角</h2>
              <span class="updated-at" v-if="attitudeUpdatedAt">{{ attitudeUpdatedAt }}</span>
            </div>
            <div class="data-grid">
              <div :class="['data-card', { 'data-card--active': attitudeActive }]">
                <span class="data-label">Roll（横滚）</span>
                <span class="data-value">{{ rollDeg.toFixed(1) }}</span>
                <span class="data-unit">°</span>
              </div>
              <div :class="['data-card', { 'data-card--active': attitudeActive }]">
                <span class="data-label">Pitch（俯仰）</span>
                <span class="data-value">{{ pitchDeg.toFixed(1) }}</span>
                <span class="data-unit">°</span>
              </div>
              <div :class="['data-card', { 'data-card--active': attitudeActive }]">
                <span class="data-label">Yaw（偏航）</span>
                <span class="data-value">{{ yawDeg.toFixed(1) }}</span>
                <span class="data-unit">°</span>
              </div>
            </div>
          </div>

          <!-- 统计 -->
          <div class="panel panel--stat">
            <div class="stat-row">
              <span class="stat-item">已解析帧：<strong>{{ frameCount }}</strong></span>
              <span class="stat-item">已发送请求：<strong>{{ txCount }}</strong></span>
            </div>
          </div>
        </div>

        <!-- ── 右侧：3D 姿态模型 ──────────────────────────── -->
        <div class="model-col">
          <div class="model-card">
            <div class="model-title">姿态 3D 预览</div>

            <!-- 3D 场景 -->
            <div class="scene-wrapper">
              <!-- 天地背景（随俯仰+横滚变化） -->
              <div class="horizon-bg" :style="horizonBgStyle"></div>

              <!-- 地平线参考线 -->
              <div class="horizon-line" :style="horizonLineStyle"></div>

              <!-- 3D 透视容器 -->
              <div class="scene">
                <div class="drone-pivot" :style="droneStyle">
                  <svg
                    class="drone-svg"
                    viewBox="-130 -105 260 210"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <!--
                      斜前上方视角（约 35° 仰角）：
                      机头朝上，机身竖直，左右机臂水平展开
                      roll  → 机翼上下倾斜（最直观）
                      pitch → 机身前后倾斜
                      yaw   → 机身左右转动
                    -->

                    <!-- ① 后侧机臂（先画，被前臂遮挡） -->
                    <line x1="-18" y1="12" x2="-82" y2="38"
                          stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
                    <line x1="18" y1="12" x2="82" y2="38"
                          stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>

                    <!-- ② 后侧电机 -->
                    <circle cx="-88" cy="42" r="18" fill="#111827" stroke="#334155" stroke-width="2"/>
                    <circle cx="88" cy="42" r="18" fill="#111827" stroke="#334155" stroke-width="2"/>
                    <!-- 后侧螺旋桨（水平椭圆模拟透视） -->
                    <ellipse cx="-88" cy="42" rx="22" ry="6" fill="none" stroke="#475569" stroke-width="1.5"/>
                    <ellipse cx="88" cy="42" rx="22" ry="6" fill="none" stroke="#475569" stroke-width="1.5"/>

                    <!-- ③ 前侧机臂 -->
                    <line x1="-18" y1="-12" x2="-88" y2="-42"
                          stroke="#475569" stroke-width="9" stroke-linecap="round"/>
                    <line x1="18" y1="-12" x2="88" y2="-42"
                          stroke="#475569" stroke-width="9" stroke-linecap="round"/>

                    <!-- ④ 前侧电机 -->
                    <circle cx="-94" cy="-46" r="21" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/>
                    <circle cx="94" cy="-46" r="21" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/>
                    <!-- 前侧螺旋桨（水平椭圆 + 十字） -->
                    <ellipse cx="-94" cy="-46" rx="25" ry="7" fill="none" stroke="#7dd3fc" stroke-width="2"/>
                    <line x1="-94" y1="-63" x2="-94" y2="-29" stroke="#7dd3fc" stroke-width="1.5"/>
                    <ellipse cx="94" cy="-46" rx="25" ry="7" fill="none" stroke="#7dd3fc" stroke-width="2"/>
                    <line x1="94" y1="-63" x2="94" y2="-29" stroke="#7dd3fc" stroke-width="1.5"/>

                    <!-- ⑤ 机身（六边形，略带透视梯形） -->
                    <polygon
                      points="0,-30 22,-15 22,15 0,30 -22,15 -22,-15"
                      fill="#0f172a" stroke="#334155" stroke-width="2"
                    />
                    <!-- 机身顶面高光（模拟受光面） -->
                    <polygon
                      points="0,-30 22,-15 0,-10 -22,-15"
                      fill="#1e3a5f" opacity="0.6"
                    />
                    <!-- 机身内框 -->
                    <polygon
                      points="0,-24 16,-12 16,12 0,24 -16,12 -16,-12"
                      fill="none" stroke="#1e40af" stroke-width="1"
                    />

                    <!-- ⑥ 机头方向指示（上方箭头） -->
                    <polygon points="0,-42 -6,-30 6,-30" fill="#38bdf8"/>

                    <!-- ⑦ 中心点 -->
                    <circle cx="0" cy="0" r="4" fill="#38bdf8" opacity="0.9"/>
                  </svg>
                </div>
              </div>

              <!-- Roll 指示刻度（底部弧线） -->
              <svg class="roll-arc" viewBox="0 0 300 60" xmlns="http://www.w3.org/2000/svg">
                <!-- 弧线背景 -->
                <path d="M 30,55 A 120,120 0 0,1 270,55" fill="none" stroke="#334155" stroke-width="1.5"/>
                <!-- 刻度：每30° -->
                <line x1="30" y1="55" x2="36" y2="47" stroke="#64748b" stroke-width="1.5"/>
                <line x1="78" y1="20" x2="82" y2="13" stroke="#64748b" stroke-width="1.5"/>
                <line x1="150" y1="10" x2="150" y2="2" stroke="#94a3b8" stroke-width="2"/>
                <line x1="222" y1="20" x2="218" y2="13" stroke="#64748b" stroke-width="1.5"/>
                <line x1="270" y1="55" x2="264" y2="47" stroke="#64748b" stroke-width="1.5"/>
                <!-- Roll 指示针 -->
                <line
                  :x1="rollPointer.x1" :y1="rollPointer.y1"
                  :x2="rollPointer.x2" :y2="rollPointer.y2"
                  stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"
                />
              </svg>
            </div>

            <!-- 角度数字显示 -->
            <div class="angle-readout">
              <div class="angle-item">
                <span class="angle-label">Roll</span>
                <span :class="['angle-val', { 'angle-val--active': attitudeActive }]">
                  {{ rollDeg.toFixed(1) }}°
                </span>
              </div>
              <div class="angle-divider"></div>
              <div class="angle-item">
                <span class="angle-label">Pitch</span>
                <span :class="['angle-val', { 'angle-val--active': attitudeActive }]">
                  {{ pitchDeg.toFixed(1) }}°
                </span>
              </div>
              <div class="angle-divider"></div>
              <div class="angle-item">
                <span class="angle-label">Yaw</span>
                <span :class="['angle-val', { 'angle-val--active': attitudeActive }]">
                  {{ yawDeg.toFixed(1) }}°
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { useGyroInfo } from '@/ts/information/gyroInfo'

const { connectionState } = useSerial()

const {
  imuData,
  frameCount,
  txCount,
  updatedAt: imuUpdatedAt,
  frameRate,
  imuActive,
  attitudeData,
  attitudeUpdatedAt,
  attitudeActive,
} = useGyroInfo()

const rollDeg  = computed(() => attitudeData.value.roll)
const pitchDeg = computed(() => attitudeData.value.pitch)
const yawDeg   = computed(() => attitudeData.value.yaw)

// ── 3D 模型样式 ───────────────────────────────────────────────
const droneStyle = computed(() => ({
  transform: `rotateY(${yawDeg.value}deg) rotateX(${-pitchDeg.value}deg) rotateZ(${-rollDeg.value}deg)`,
  transition: 'transform 0.08s linear',
}))

const horizonBgStyle = computed(() => {
  const pitchOffset = Math.max(-45, Math.min(45, pitchDeg.value))
  return {
    background: `linear-gradient(to bottom,
      #050d1f 0%,
      #0c1a3d ${48 - pitchOffset * 0.6}%,
      #1a3a1a ${52 - pitchOffset * 0.6}%,
      #0d1f0d 100%)`,
    transform: `rotate(${-rollDeg.value}deg) scale(1.6)`,
    transition: 'background 0.08s linear, transform 0.08s linear',
  }
})

const horizonLineStyle = computed(() => {
  const pitchOffset = Math.max(-45, Math.min(45, pitchDeg.value))
  return {
    transform: `translateY(${-pitchOffset * 1.2}px) rotate(${-rollDeg.value}deg)`,
    transition: 'transform 0.08s linear',
  }
})

const rollPointer = computed(() => {
  const angle = Math.max(-90, Math.min(90, rollDeg.value))
  const rad = ((angle - 90) * Math.PI) / 180
  const cx = 150, cy = 175, r = 120
  const tip  = { x: cx + r       * Math.cos(rad), y: cy + r       * Math.sin(rad) }
  const base = { x: cx + (r - 14) * Math.cos(rad), y: cy + (r - 14) * Math.sin(rad) }
  return { x1: base.x, y1: base.y, x2: tip.x, y2: tip.y }
})
</script>

<style scoped>
.gyro-container {
  padding: var(--spacing-2xl);
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  box-sizing: border-box;
}

/* 标题栏 */
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
.conn-btn { flex-shrink: 0; }
.frame-rate {
  font-family: 'Consolas', monospace;
  font-size: var(--font-size-sm);
  color: var(--primary-500);
  background: var(--surface-200);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

/* 未连接 */
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

/* 左侧数据列 */
.data-col {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: var(--spacing-sm);
}

/* 右侧模型列 */
.model-col {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

/* ── 数据面板 ────────────────────────────────────────────── */
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
.panel-header h2 { margin: 0; }
.updated-at { font-size: var(--font-size-sm); color: var(--text-disabled); font-family: 'Consolas', monospace; }

.data-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-sm); }
.data-card {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: var(--spacing-md);
  background-color: var(--surface-100); border: 1px solid var(--border-light);
  transition: border-color 0.15s, background-color 0.15s;
}
.data-card--active { border-color: var(--primary-500); }
.data-label { font-size: 11px; color: var(--text-disabled); text-align: center; }
.data-value {
  font-size: 18px; font-weight: 700; color: var(--primary-500);
  font-family: 'Consolas', 'Courier New', monospace;
}
.data-unit { font-size: 11px; color: var(--text-disabled); font-family: 'Consolas', monospace; }

.panel--stat { padding: var(--spacing-md) 0; }
.stat-row { display: flex; gap: var(--spacing-lg); flex-wrap: wrap; }
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }

/* ── 3D 模型卡片 ──────────────────────────────────────────── */
.model-card {
  background-color: var(--surface-950);
  border: 1px solid var(--surface-800);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 420px;
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

/* 3D 场景容器 */
.scene-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
}

/* 天地背景 */
.horizon-bg {
  position: absolute;
  inset: -60%;
  border-radius: 0;
  pointer-events: none;
}

/* 地平线参考线 */
.horizon-line {
  position: absolute;
  left: 0; right: 0;
  height: 1px;
  background: rgba(148, 163, 184, 0.35);
  pointer-events: none;
  transform-origin: center center;
}

/* CSS 3D 透视场景 */
.scene {
  position: relative;
  width: 260px;
  height: 260px;
  perspective: 600px;
  perspective-origin: 50% 50%;
  display: flex; align-items: center; justify-content: center;
}

.drone-pivot {
  width: 230px;
  height: 230px;
  transform-style: preserve-3d;
  display: flex; align-items: center; justify-content: center;
  filter: drop-shadow(0 4px 16px rgba(56, 189, 248, 0.25));
}

.drone-svg {
  width: 100%;
  height: 100%;
}

/* Roll 弧度指示 */
.roll-arc {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 40px;
  pointer-events: none;
}

/* 角度数字显示 */
.angle-readout {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--surface-800);
  flex-shrink: 0;
  background-color: var(--surface-900);
}

.angle-item {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
}

.angle-label {
  font-size: 10px;
  color: var(--surface-500);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.angle-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--surface-300);
  font-family: 'Consolas', 'Courier New', monospace;
  transition: color 0.15s;
  min-width: 70px;
  text-align: center;
}

.angle-val--active { color: #38bdf8; }

.angle-divider {
  width: 1px; height: 32px;
  background-color: var(--surface-800);
}
</style>
