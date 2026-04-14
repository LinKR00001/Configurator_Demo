import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let rawBody = ''

    request.on('data', (chunk) => {
      rawBody += chunk.toString()
    })

    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {})
      } catch (error) {
        reject(error)
      }
    })

    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

const mockUomPlugin = {
  name: 'mock-uom-plugin',
  configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
    server.middlewares.use(async (request, response, next) => {
      if (request.method !== 'POST' || !request.url?.startsWith('/mock-uom/realname/status')) {
        next()
        return
      }

      try {
        const payload = await readJsonBody(request)
        const id = typeof payload.id === 'string' ? payload.id.trim() : ''
        const body = typeof payload.body === 'string' ? payload.body.trim() : ''

        if (!id || !body) {
          sendJson(response, {
            code: 401,
            msg: '参数不合法',
          })
          return
        }

        sendJson(response, {
          code: 200,
          msg: '校验完成',
          body: {
            name: '正常',
            value: '0',
          },
        })
      } catch {
        sendJson(response, {
          code: 401,
          msg: '参数不合法',
        })
      }
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: '/Configurator_Demo/',
  plugins: [
    vue(),
    vueDevTools(),
    mockUomPlugin,
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
