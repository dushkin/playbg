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
        // Create a separate container for Eruda to avoid React conflicts
        let erudaContainer = document.getElementById('eruda-container')
        if (!erudaContainer) {
          erudaContainer = document.createElement('div')
          erudaContainer.id = 'eruda-container'
          erudaContainer.style.position = 'fixed'
          erudaContainer.style.top = '0'
          erudaContainer.style.left = '0'
          erudaContainer.style.width = '100%'
          erudaContainer.style.height = '100%'
          erudaContainer.style.pointerEvents = 'none' // Allow clicks through
          erudaContainer.style.zIndex = '999999'
          document.body.appendChild(erudaContainer)
        }
        
        // Initialize with the separate container
        eruda.default.init({
          container: erudaContainer,
          tool: ['console', 'elements', 'network', 'resources', 'info', 'snippets'],
          useShadowDom: true,
          autoScale: true,
          defaults: {
            displaySize: 50,
            transparency: 0.8,
            theme: 'Material Design'
          }
        })
        
        // Enable pointer events on Eruda elements
        setTimeout(() => {
          const erudaElements = erudaContainer.querySelectorAll('[class*="eruda"]')
          erudaElements.forEach(el => {
            ;(el as HTMLElement).style.pointerEvents = 'auto'
          })
        }, 100)
        
        console.log('✅ Eruda manually initialized!')
        localStorage.setItem('eruda-debug', 'true')
        
        // Add toggle function
        window.toggleEruda = () => {
          if (window.eruda) {
            if (window.eruda._isInit) {
              window.eruda.destroy()
              // Remove the container
              const container = document.getElementById('eruda-container')
              if (container) {
                container.remove()
              }
              localStorage.setItem('eruda-debug', 'false')
              console.log('❌ Eruda disabled')
            } else {
              window.initErudaDebug() // Re-initialize
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