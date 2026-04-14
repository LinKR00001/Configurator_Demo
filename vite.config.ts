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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const mockUomPlugin = {
  name: 'mock-uom-plugin',
  configureServer(server: { middlewares: { use: (handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void | Promise<void>) => void } }) {
    server.middlewares.use(async (request, response, next) => {
      const requestPath = request.url?.split('?')[0] ?? ''

      if (request.method !== 'POST' || !requestPath.startsWith('/mock-uom/')) {
        next()
        return
      }

      try {
        const payload = await readJsonBody(request)
        if (requestPath === '/mock-uom/realname/status') {
          if (!isNonEmptyString(payload.id) || !isNonEmptyString(payload.body)) {
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
          return
        }

        if (requestPath === '/mock-uom/activation/report') {
          if (!isNonEmptyString(payload.id) || !isNonEmptyString(payload.body)) {
            sendJson(response, {
              code: 401,
              msg: '参数不合法',
            })
            return
          }

          sendJson(response, {
            code: 200,
            msg: '上报成功',
            body: {
              token: 'mock-token-activation-001',
              value: '1',
            },
          })
          return
        }

        if (requestPath === '/mock-uom/deregistration') {
          if (!isNonEmptyString(payload.id) || !isNonEmptyString(payload.body)) {
            sendJson(response, {
              code: 401,
              msg: '参数不合法',
            })
            return
          }

          sendJson(response, {
            code: 200,
            msg: '注销登记完成',
            body: {
              name: '注销',
              value: '3',
            },
          })
          return
        }

        next()
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
  },
})
