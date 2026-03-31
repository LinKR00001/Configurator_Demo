<template>
  <div class="sidebar">
    <nav class="sidebar-nav">
      <div class="nav-section">
        <a 
          href="#"
          @click.prevent="selectItem('welcome')"
          :class="{ active: activeItem === 'welcome' }"
          class="nav-item"
        >
          <span class="nav-label">欢迎</span>
        </a>
      </div>

      <div class="nav-section">
        <a 
          href="#"
          @click.prevent="selectItem('message')"
          :class="{ active: activeItem === 'message', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">飞控信息</span>
        </a>
      </div>

      <div class="nav-section">
        <a
          href="#"
          @click.prevent="selectItem('gyro')"
          :class="{ active: activeItem === 'gyro', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">陀螺仪</span>
        </a>
      </div>

      <div class="nav-section">
        <a 
          href="#"
          @click.prevent="selectItem('receiver')"
          :class="{ active: activeItem === 'receiver', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">接收机</span>
        </a>
      </div>

      <div class="nav-section">
        <a
          href="#"
          @click.prevent="selectItem('pid')"
          :class="{ active: activeItem === 'pid', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">PID调校</span>
        </a>
      </div>

      <div class="nav-section">
        <a
          href="#"
          @click.prevent="selectItem('rate')"
          :class="{ active: activeItem === 'rate', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">RATE设置</span>
        </a>
      </div>

      <div class="nav-section">
        <a
          href="#"
          @click.prevent="selectItem('sensor')"
          :class="{ active: activeItem === 'sensor', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">传感器数据</span>
        </a>
      </div>

      <div class="nav-section">
        <a
          href="#"
          @click.prevent="selectItem('motorTest')"
          :class="{ active: activeItem === 'motorTest', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">电机测试</span>
        </a>
      </div>
      <div class="nav-section">
        <a
          href="#"
          @click.prevent="selectItem('firmware')"
          :class="{ active: activeItem === 'firmware', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">固件升级</span>
        </a>
      </div>

      <div class="nav-section">
        <a
          href="#"
          @click.prevent="selectItem('devSerial')"
          :class="{ active: activeItem === 'devSerial', disabled: !isConnected }"
          class="nav-item"
        >
          <span class="nav-label">开发调试</span>
        </a>
      </div>

    </nav>

    <div class="sidebar-footer">
      <span class="version">Configurator V2</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  activeItem: {
    type: String,
    default: 'welcome'
  },
  isConnected: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  select: [item: string]
}>()

const selectItem = (item: string) => {
  if (!props.isConnected && item !== 'welcome') return
  emit('select', item)
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  background-color: var(--surface-950);
  color: white;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--surface-900);
  padding: var(--spacing-lg) 0;
  overflow-y: auto;
}

.sidebar-nav {
  flex: 1;
  padding: 0 var(--spacing-md);
}

.nav-section {
  margin-bottom: var(--spacing-xl);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-xs);
  border-radius: var(--radius-md);
  color: var(--surface-400);
  text-decoration: none;
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: var(--font-size-base);

  &:hover {
    background-color: var(--surface-900);
    color: white;
  }

  &.active {
    background-color: var(--primary-500);
    color: var(--text-on-primary);
    font-weight: 600;
  }

  &.disabled {
    opacity: 0.35;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.nav-label {
  flex: 1;
}

.sidebar-footer {
  padding: 0 var(--spacing-lg);
  margin-top: auto;
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--surface-800);
  text-align: center;
}

.version {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--surface-600);
}

/* 滚动条 */
.sidebar::-webkit-scrollbar {
  width: 6px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background: var(--surface-800);
  border-radius: 3px;

  &:hover {
    background: var(--surface-700);
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .sidebar {
    width: 200px;
  }

  .nav-label {
    display: none;
  }

  .sidebar-nav {
    padding: 0 var(--spacing-sm);
  }

  .nav-item {
    padding: var(--spacing-sm);
  }
}
</style>
