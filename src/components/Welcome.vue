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

/* 暗色主题适配（如果项目使用了暗色变量） */
@media (prefers-color-scheme: dark) {
  .page-title {
    color: #f8fafc;
  }
  .description {
    color: #cbd5e1;
  }
}
</style>