import { Capacitor } from '@capacitor/core'

/**
 * Check if the app is running on a mobile device
 */
export const isMobile = (): boolean => {
  return Capacitor.isNativePlatform()
}

/**
 * Check if the app is running on Android
 */
export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android'
}

/**
 * Check if the app is running on iOS
 */
export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios'
}

/**
 * Check if the app is running in development mode
 */
export const isDevelopment = (): boolean => {
  return import.meta.env.DEV || import.meta.env.MODE === 'development'
}

/**
 * Initialize mobile debugging tools
 * DISABLED: Conflicted with main.tsx Eruda setup, causing blank screen
 */
export const initMobileDebugging = async (): Promise<void> => {
  // Eruda initialization moved to main.tsx and erudaInit.ts for better control
  // This function is now a no-op to prevent conflicts
  console.log('🔧 Mobile debugging setup handled by main.tsx - use window.initErudaDebug()')
}