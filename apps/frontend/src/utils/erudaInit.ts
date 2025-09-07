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
            displaySize: 50,
            transparency: 0.8,
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
  
  // Don't auto-initialize here to prevent conflicts with main.tsx
  // Just setup the global function for manual use
}

// Removed auto-initialization to prevent conflicts