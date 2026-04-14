import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  base: '/Configurator_Demo/',
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 8080,
    proxy: {
      '/snap-test': {
        target: 'https://api.snap-test.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/snap-test/, ''),
      },
    },
  },
})
