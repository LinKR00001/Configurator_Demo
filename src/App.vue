<script setup lang="ts">
import { ref, shallowRef  } from 'vue'
import Sidebar from '@/components/Sidebar.vue'
import SerialPanel from '@/components/SerialPanel.vue'
import { useSerial } from '@/composables/useSerial'
import welcome from '@/components/Welcome.vue'
import receiver from '@/components/Receiver.vue'
import Message from '@/components/Message.vue'
import DevelopModePanel from '@/components/DevelopModePanel.vue'
import Gyro from '@/components/Gyro.vue'
import Pid from '@/components/PidSetting.vue'
import Sensor from '@/components/Sensor.vue'
import MotorTest from '@/components/Motor.vue'
import Firmware from '@/components/Firmware.vue'
import Rate from '@/components/RateSetting.vue'

type PageType = 'welcome' | 'message' | 'receiver' | 'pid' | 'devSerial' | 'gyro' | 'rate' | 'sensor' | 'motorTest' | 'firmware'
type NavigationLockMode = 'none' | 'connectedFromWelcome' | 'connectedFromFirmware' | 'connectedFromDevSerial'

const activePage = ref<PageType>('welcome')
const currentComponent = ref(shallowRef(welcome));
const navigationLockMode = ref<NavigationLockMode>('none')

// 获取串口实例（状态由 useSerial 内部自动管理）
const { connectionState } = useSerial()

const handleSidebarSelect = (item: string) => {
  activePage.value = item as PageType
  switch (item) {
    case 'welcome':
      currentComponent.value = welcome;
      break;
    case 'message':
      currentComponent.value = Message;
      break;
    case 'gyro':
      currentComponent.value = Gyro;
      break;
    case 'receiver':
      currentComponent.value = receiver;
      break;
    case 'pid':
      currentComponent.value = Pid;
      break;
    case 'rate':
      currentComponent.value = Rate;
      break;
    case 'sensor':
      currentComponent.value = Sensor;
      break;
    case 'motorTest':
      currentComponent.value = MotorTest;
      break;
    case 'firmware':
      currentComponent.value = Firmware;
      break;
    case 'devSerial':
      currentComponent.value = DevelopModePanel;
      break;

    default:
      currentComponent.value = welcome;
  }
}

/**
 * 串口连接成功时的处理
 */
const handleSerialConnected = (_port: string) => {
  // 连接状态已由 useSerial 内部管理，这里只记录连接时所在页面并施加导航限制。
  if (activePage.value === 'firmware') {
    navigationLockMode.value = 'connectedFromFirmware'
    return
  }

  if (activePage.value === 'devSerial') {
    navigationLockMode.value = 'connectedFromDevSerial'
    return
  }

  if (activePage.value === 'welcome') {
    navigationLockMode.value = 'connectedFromWelcome'
    return
  }

  navigationLockMode.value = 'none'
}

/**
 * 串口断开连接时的处理
 */
const handleSerialDisconnected = () => {
  // 断连后回到欢迎页，避免停留在需要串口的模块
  navigationLockMode.value = 'none'
  activePage.value = 'welcome'
  currentComponent.value = welcome
}

/**
 * 串口连接错误时的处理
 */
const handleSerialError = (error: string) => {
  console.error('Serial connection error:', error)
}
</script>

<template>
  <div id="app" class="app-layout">
    <!-- 顶部 Topbar: BETAFPV + 串口连接 -->
    <header class="top-bar">
      <div class="topbar-left">
          <span class="logo-text">BETAFPV</span>
      </div>
      <div class="topbar-right">
        <SerialPanel 
          @connected="handleSerialConnected"
          @disconnected="handleSerialDisconnected"
          @error="handleSerialError"
        />
      </div>
    </header>

    <!-- 主容器: 侧边栏 + 内容 -->
    <div class="main-layout">
      <!-- 左侧边栏 -->
      <Sidebar 
        :activeItem="activePage"
        :isConnected="connectionState.isConnected"
        :navigationLockMode="navigationLockMode"
        @select="handleSidebarSelect"
      />

    <!-- 内容区域：动态组件 -->
    <main class="content">
      <component :is="currentComponent" />
    </main>


    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--surface-100);
  overflow: hidden;
}

/* 顶部栏 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background-color: var(--surface-50);
  border-bottom: 2px solid var(--primary-500);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-500);
  letter-spacing: 1px;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

/* 主容器 */
.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 内容区域 */
/* 响应式 */
@media (max-width: 768px) {
  .top-bar {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  .logo-text {
    font-size: 16px;
  }
}
</style>
