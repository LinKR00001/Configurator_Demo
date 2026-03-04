<template>
  <div class="welcome-container">
    <!-- 欢迎区域 -->
    <section class="welcome-section">
      <h1 class="page-title">欢迎</h1>
      <p class="description">
        这是一个基于 Vue 3 的配置工具，用于配置 BETAFPV 飞控。
      </p>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const flightControllerInfo = ref({
  majorVersion: '未知',
  minorVersion: '未知',
  patchVersion: '未知',
  targetId: '未知',
})
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
}
</style>