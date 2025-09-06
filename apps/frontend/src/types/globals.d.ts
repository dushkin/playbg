import { CapacitorGlobal } from '@capacitor/core'

declare global {
  interface Window {
    Capacitor: CapacitorGlobal
    eruda: any
    toggleEruda: () => void
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