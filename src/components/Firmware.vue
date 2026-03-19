<template>
  <div class="firmware-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>固件升级</h1>
        <p class="page-subtitle">升级固件</p>
      </div>
      <div class="header-right">
        <!-- 连接状态 -->
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

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConnection } from '@/composables/useConnection'
import { useGlobalSerialManager } from '@/composables/useGlobalSerialManager'

const { connectionState } = useConnection()
const { getInstance } = useGlobalSerialManager()



// ── 定时器句柄 ───────────────────────────────────────────────
let pollTimerId: ReturnType<typeof setInterval> | null = null
let fpsTimerId:  ReturnType<typeof setInterval> | null = null



function handleData(event: any) {
  const chunk: Uint8Array = event.data
  if (!chunk?.length) return
}

onMounted(() => { getInstance().addEventListener('data', handleData) })
onUnmounted(() => { getInstance().removeEventListener('data', handleData) })
</script>

<style scoped>
.firmware-container {
  padding: var(--spacing-2xl);
  max-width: 860px;
  display: flex;
  flex-direction: column;
  gap: 0;
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


/* 底部统计 */
.stats-row {
  display: flex;
  gap: var(--spacing-xl);
  flex-wrap: wrap;
  padding: var(--spacing-md) 0;
  border-top: 1px solid var(--border-light);
  margin-top: var(--spacing-lg);
}
.stat-item { font-size: var(--font-size-sm); color: var(--text-disabled); }
.stat-item strong { color: var(--text-primary); font-family: 'Consolas', monospace; }
</style>