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

    <!-- 主内容 -->
    <template v-else>
      <div class="main-layout">
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

        <!-- ── 右侧：Three.js 3D 飞机姿态模型 ── -->
        <div class="model-col">
          <div class="model-card">
            <div class="panel-header model-header"><h2>3D 预览</h2></div>
            <div class="scene-wrapper">
              <canvas ref="canvasRef" class="model-canvas"></canvas>
              <div v-if="modelLoadError" class="model-error">{{ modelLoadError }}</div>
            </div>
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
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useSerial } from '@/composables/useSerial'
import { useGyroInfo } from '@/ts/information/gyroInfo'
import airplaneModelUrl from '../../model/airplane.gltf?url'

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

// ── Three.js 3D 飞机模型 ──────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let modelPivot: THREE.Object3D | null = null
let rafId: number | null = null
let resizeObserver: ResizeObserver | null = null
let fallbackMesh: THREE.Mesh | null = null
const modelLoadError = ref('')

function updateModelRotation() {
  if (!modelPivot) return
  const toRad = THREE.MathUtils.degToRad
  // YXZ Euler order: 偏航(Y) → 俯仰(X) → 横滚(Z)
  modelPivot.rotation.set(
    toRad(pitchDeg.value),
    toRad(yawDeg.value),
    toRad(-rollDeg.value),
    'YXZ',
  )
}

watch([rollDeg, pitchDeg, yawDeg], updateModelRotation)

function fitCameraToSceneObject(object: THREE.Object3D) {
  if (!camera) return
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const radius = Math.max(sphere.radius, 0.5)

  object.position.sub(center)

  const fovRad = THREE.MathUtils.degToRad(camera.fov)
  const distance = (radius / Math.sin(fovRad / 2)) * 1.15
  camera.near = Math.max(0.01, distance / 200)
  camera.far = distance * 200
  camera.position.set(0, radius * 0.35, distance)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

function showFallbackModel() {
  if (!scene || modelPivot) return
  const geometry = new THREE.ConeGeometry(0.6, 2.0, 16)
  const material = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.2,
    roughness: 0.45,
  })
  fallbackMesh = new THREE.Mesh(geometry, material)
  fallbackMesh.rotation.x = Math.PI / 2

  modelPivot = new THREE.Object3D()
  modelPivot.add(fallbackMesh)
  scene.add(modelPivot)
  fitCameraToSceneObject(modelPivot)
  updateModelRotation()
}

function initThree() {
  const canvas = canvasRef.value
  if (!canvas) return

  const wrapper = canvas.parentElement!
  const w = wrapper.clientWidth || 320
  const h = wrapper.clientHeight || 320

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.outputColorSpace = THREE.SRGBColorSpace

  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 1000)
  camera.position.set(0, 1, 8)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 1.2))
  const sun = new THREE.DirectionalLight(0xffffff, 2.0)
  sun.position.set(5, 8, 6)
  scene.add(sun)
  const fill = new THREE.DirectionalLight(0x8899cc, 0.6)
  fill.position.set(-4, -2, -4)
  scene.add(fill)

  modelLoadError.value = ''
  showFallbackModel()

  const loader = new GLTFLoader()
  loader.load(airplaneModelUrl, (gltf) => {
    if (!scene) return
    const gltfScene = gltf.scene

    // 修正初始朝向：机头朝前（+Z），绕 X 轴旋转 -90°
    gltfScene.rotation.x = -Math.PI / 2

    // 成功加载后移除回退模型
    if (modelPivot) {
      scene.remove(modelPivot)
      modelPivot.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh
          m.geometry?.dispose?.()
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose?.())
          } else {
            m.material?.dispose?.()
          }
        }
      })
      modelPivot = null
      fallbackMesh = null
    }

    modelPivot = new THREE.Object3D()
    modelPivot.add(gltfScene)
    scene.add(modelPivot)

    fitCameraToSceneObject(modelPivot)

    updateModelRotation()
  }, undefined, (error) => {
    console.error('[Gyro] airplane.gltf load failed:', error)
    modelLoadError.value = '模型加载失败，请检查 model/airplane.gltf 文件'
  })

  resizeObserver = new ResizeObserver(() => {
    if (!renderer || !camera) return
    const nw = wrapper.clientWidth
    const nh = wrapper.clientHeight
    if (nw > 0 && nh > 0) {
      renderer.setSize(nw, nh)
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
    }
  })
  resizeObserver.observe(wrapper)

  const renderLoop = () => {
    rafId = requestAnimationFrame(renderLoop)
    renderer!.render(scene!, camera!)
  }
  renderLoop()
}

function disposeThree() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  resizeObserver?.disconnect(); resizeObserver = null
  renderer?.dispose(); renderer = null
  modelLoadError.value = ''
  fallbackMesh = null
  scene = null; camera = null; modelPivot = null
}

// canvas 出现时（连接后）自动初始化，消失时自动释放资源
watch(canvasRef, (canvas) => {
  if (canvas) { nextTick(initThree) }
  else { disposeThree() }
})

onUnmounted(disposeThree)
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

.data-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-sm); }
.data-card {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: var(--spacing-md);
  background-color: var(--surface-100); border: 1px solid var(--border-light);
  transition: border-color 0.15s, background-color 0.15s;
  box-sizing: border-box;
  overflow: hidden;
}
.data-card--active { border-color: var(--primary-500); }
.data-label { font-size: 11px; color: var(--text-disabled); text-align: center; }
.data-value {
  font-size: 18px; font-weight: 700; color: var(--primary-500);
  font-family: 'Consolas', 'Courier New', monospace;
  white-space: nowrap;
}
.data-unit { font-size: 11px; color: var(--text-disabled); font-family: 'Consolas', monospace; }

.panel--stat { padding: var(--spacing-md) 0; }
.stat-row { display: flex; gap: var(--spacing-lg); flex-wrap: wrap; }
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }

/* ── 右侧模型列 ──────────────────────────────────────────── */
.model-col {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.model-card {
  display: flex;
  flex-direction: column;
  height: 50%;
  min-height: 220px;
  background: linear-gradient(180deg, #ffffff 0%, #eef6ff 52%, #dcecff 100%);
  border: 1px solid var(--primary-500);
  overflow: hidden;
}

.model-header {
  padding: var(--spacing-sm) 0 var(--spacing-sm) var(--spacing-md);
  margin-bottom: 0;
  background: transparent;
  flex-shrink: 0;
}
.model-header h2 {
  margin: 0;
}

.scene-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 140px;
  background: linear-gradient(180deg, #ffffff 0%, #ecf5ff 50%, #d9ecff 100%);
}

.model-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: block;
}

.model-error {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  padding: 4px 10px;
  border: 1px solid #ef4444;
  color: #fecaca;
  background: rgba(127, 29, 29, 0.82);
  font-size: 12px;
  white-space: nowrap;
}

.angle-readout {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--primary-500);
  flex-shrink: 0;
  background-color: #f3f9ff;
}

.angle-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.angle-label {
  font-size: 10px;
  color: #5b8bc2;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.angle-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--primary-500);
  font-family: 'Consolas', 'Courier New', monospace;
  transition: color 0.15s;
  min-width: 70px;
  text-align: center;
}

.angle-val--active { color: #1e88ff; }

.angle-divider {
  width: 1px;
  height: 32px;
  background-color: var(--primary-500);
}
</style>
