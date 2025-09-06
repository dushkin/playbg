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
 */
export const initMobileDebugging = async (): Promise<void> => {
  if (isMobile() && isDevelopment()) {
    try {
      const eruda = await import('eruda')
      eruda.default.init({
        container: document.body,
        tool: ['console', 'elements', 'network', 'resources', 'info', 'snippets'],
        useShadowDom: true,
        autoScale: true,
        defaults: {
          displaySize: 50,
          transparency: 0.9,
          theme: 'Material Design'
        }
      })
      
      console.log('📱 Eruda mobile debugging initialized')
    } catch (error) {
      console.warn('Failed to initialize Eruda:', error)
    }
  }
}