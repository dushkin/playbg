import { CapacitorGlobal } from '@capacitor/core'

declare global {
  const __APP_VERSION__: string
  const __BUILD_TIME__: string

  interface Window {
    Capacitor: CapacitorGlobal
    eruda: any
    toggleEruda: () => void
    initErudaDebug: () => void
  }

  interface ImportMetaEnv {
    readonly DEV: boolean
    readonly MODE: string
    readonly VITE_API_URL?: string
    readonly VITE_DEBUG_MOBILE?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}