// Alternative Eruda initialization for mobile debugging
// This method uses a more direct approach to ensure Eruda loads in mobile environments

declare global {
  interface Window {
    initErudaDebug: () => void
  }
}

export const setupErudaDebug = () => {
  // Create a global function that can be called from the console to enable Eruda
  window.initErudaDebug = async () => {
    console.log('🔧 Manual Eruda initialization requested...')
    
    try {
      const eruda = await import('eruda')
      
      if (!window.eruda || !window.eruda._isInit) {
        eruda.default.init({
          container: document.body,
          tool: ['console', 'elements', 'network', 'resources', 'info', 'snippets'],
          useShadowDom: true,
          autoScale: true,
          defaults: {
            displaySize: 40,
            transparency: 0.9,
            theme: 'Material Design'
          }
        })
        
        console.log('✅ Eruda manually initialized!')
        localStorage.setItem('eruda-debug', 'true')
        
        // Add toggle function
        window.toggleEruda = () => {
          if (window.eruda) {
            if (window.eruda._isInit) {
              window.eruda.destroy()
              localStorage.setItem('eruda-debug', 'false')
              console.log('❌ Eruda disabled')
            } else {
              window.eruda.init()
              localStorage.setItem('eruda-debug', 'true')
              console.log('✅ Eruda enabled')
            }
          }
        }
      } else {
        console.log('ℹ️ Eruda already initialized')
      }
    } catch (err) {
      console.error('❌ Failed to initialize Eruda:', err)
    }
  }
  
  // Auto-initialize in mobile environments
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndInitEruda)
  } else {
    checkAndInitEruda()
  }
}

const checkAndInitEruda = async () => {
  // Wait a bit for Capacitor to load
  setTimeout(async () => {
    const isMobile = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
    
    if (isMobile) {
      console.log('📱 Mobile environment detected, auto-initializing Eruda...')
      
      // Check if we should auto-enable
      const autoEnable = localStorage.getItem('eruda-debug') !== 'false'
      
      if (autoEnable) {
        window.initErudaDebug()
      } else {
        console.log('ℹ️ Eruda auto-initialization disabled. Call window.initErudaDebug() to enable.')
      }
    } else {
      console.log('🖥️ Desktop environment detected. Eruda disabled.')
    }
  }, 500) // Give Capacitor time to initialize
}