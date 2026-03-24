import { ref, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { MSP_CMD, useMsp } from '@/ts/information/msp'
import { ENABLE_MSP_PROTOCOL } from '@/ts/information/protocolFlags'

const imuData = ref({ accX: 0, accY: 0, accZ: 0, gyroX: 0, gyroY: 0, gyroZ: 0 })

const frameCount = ref(0)
const txCount = ref(0)
const updatedAt = ref('')
const isPolling = ref(false)
const frameRate = ref(0)
const imuActive = ref(false)
let fpsFrames = 0

let pollTimer: ReturnType<typeof setInterval> | null = null
let fpsTimer: ReturnType<typeof setInterval> | null = null
let flashTimer: ReturnType<typeof setTimeout> | null = null
let unbindImuMessage: (() => void) | null = null

function timestamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

function applyImuValues(accX: number, accY: number, accZ: number, gyroX: number, gyroY: number, gyroZ: number) {
  imuData.value = { accX, accY, accZ, gyroX, gyroY, gyroZ }
  frameCount.value++
  fpsFrames++
  updatedAt.value = timestamp()
  imuActive.value = true
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { imuActive.value = false }, 300)
}

async function requestImu() {
  if (!ENABLE_MSP_PROTOCOL) return
  const { send } = useMsp()
  const ok = await send(MSP_CMD.RAW_IMU)
  if (ok) txCount.value++
}

function startPolling() {
  if (pollTimer) return
  isPolling.value = true
  requestImu()
  pollTimer = setInterval(requestImu, 50) // 20 Hz
  if (!fpsTimer) {
    fpsTimer = setInterval(() => {
      frameRate.value = fpsFrames
      fpsFrames = 0
    }, 1000)
  }
}

function stopPolling() {
  isPolling.value = false
  frameRate.value = 0
  fpsFrames = 0
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (fpsTimer)  { clearInterval(fpsTimer);  fpsTimer  = null }
  if (flashTimer) { clearTimeout(flashTimer); flashTimer = null }
  imuActive.value = false
}

export function useGyroInfo() {
  const { getInstance } = useSerial()
  const { onImuMessage } = useMsp()
  const serial = getInstance()

  const handleConnected    = () => startPolling()
  const handleDisconnected = () => stopPolling()

  onMounted(() => {
    unbindImuMessage = onImuMessage((imu) => {
      if (!ENABLE_MSP_PROTOCOL) return
      applyImuValues(imu.accX, imu.accY, imu.accZ, imu.gyroX, imu.gyroY, imu.gyroZ)
    })
    serial.addEventListener('connected',    handleConnected)
    serial.addEventListener('disconnected', handleDisconnected)
    if (serial.getConnected()) startPolling()
  })

  onUnmounted(() => {
    unbindImuMessage?.()
    unbindImuMessage = null
    serial.removeEventListener('connected',    handleConnected)
    serial.removeEventListener('disconnected', handleDisconnected)
    stopPolling()
  })

  return {
    imuData,
    frameCount,
    txCount,
    updatedAt,
    isPolling,
    frameRate,
    imuActive,
  }
}
