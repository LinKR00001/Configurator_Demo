/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UOM_API_BASE_URL: string
  readonly VITE_UOM_DEREGISTRATION_PATH: string
}

declare module '*.gltf?url' {
  const src: string
  export default src
}