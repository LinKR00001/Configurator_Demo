import { ref, onMounted, onUnmounted } from 'vue'
import { useSerial } from '@/composables/useSerial'
import { MSP_CMD, useMsp } from '@/ts/msp/msp'
import { ENABLE_MSP_PROTOCOL } from '@/ts/msp/protocolFlags'

const POLL_INTERVAL_MS = 100
const TOF_HISTORY_LIMIT = 80

const opticalFlowData = ref({
  flowX: 0,
  flowY: 0,
  confidence: 0,
})

const tofData = ref({
  distance: 0,
  confidence: 0,
})

const tofHistory = ref<number[]>([])
const tofConfidenceHistory = ref<number[]>([])

const frameCount = ref(0)
const opticalFlowFrameCount = ref(0)
const tofFrameCount = ref(0)
const crcErrorCount = ref(0)
const txCount = ref(0)

const opticalFlowUpdatedAt = ref('')
const tofUpdatedAt = ref('')
const opticalFlowActive = ref(false)
const tofActive = ref(false)
const isPolling = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null
let tofFlashTimer: ReturnType<typeof setTimeout> | null = null
let unbindSonarMessage: (() => void) | null = null

function timestamp() {
  const now = new Date()
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `${now.toLocaleTimeString('zh-CN', { hour12: false })}.${ms}`
}

function applyTofData(distance: number, confidence: number) {
  tofData.value = {
    distance,
    confidence,
  }
  tofHistory.value = [...tofHistory.value.slice(-(TOF_HISTORY_LIMIT - 1)), distance]
  tofConfidenceHistory.value = [...tofConfidenceHistory.value.slice(-(TOF_HISTORY_LIMIT - 1)), confidence]
  frameCount.value++
  tofFrameCount.value++
  tofUpdatedAt.value = timestamp()
  tofActive.value = true
  if (tofFlashTimer) clearTimeout(tofFlashTimer)
  tofFlashTimer = setTimeout(() => {
    tofActive.value = false
  }, 300)
}

async function requestTof() {
  if (!ENABLE_MSP_PROTOCOL) return
  const { send } = useMsp()
  const ok = await send(MSP_CMD.SONAR_ALTITUDE)
  if (ok) txCount.value++
}

function startPolling() {
  if (pollTimer) return
  isPolling.value = true
  void requestTof()
  pollTimer = setInterval(() => {
    void requestTof()
  }, POLL_INTERVAL_MS)
}

function stopPolling() {
  isPolling.value = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (tofFlashTimer) {
    clearTimeout(tofFlashTimer)
    tofFlashTimer = null
  }
  tofActive.value = false
  tofHistory.value = []
  tofConfidenceHistory.value = []
}

export function useSensorInfo() {
  const { getInstance } = useSerial()
  const { onSonarMessage } = useMsp()
  const serial = getInstance()

  const handleConnected = () => startPolling()
  const handleDisconnected = () => stopPolling()

  onMounted(() => {
    unbindSonarMessage = onSonarMessage((sonar) => {
      if (!ENABLE_MSP_PROTOCOL) return
      applyTofData(sonar.distance, sonar.confidence)
    })

    serial.addEventListener('connected', handleConnected)
    serial.addEventListener('disconnected', handleDisconnected)
    if (serial.getConnected()) startPolling()
  })

  onUnmounted(() => {
    unbindSonarMessage?.()
    unbindSonarMessage = null
    serial.removeEventListener('connected', handleConnected)
    serial.removeEventListener('disconnected', handleDisconnected)
    stopPolling()
  })

  return {
    opticalFlowData,
    tofData,
    tofHistory,
    tofConfidenceHistory,
    frameCount,
    opticalFlowFrameCount,
    tofFrameCount,
    crcErrorCount,
    txCount,
    opticalFlowUpdatedAt,
    tofUpdatedAt,
    opticalFlowActive,
    tofActive,
    isPolling,
  }
}