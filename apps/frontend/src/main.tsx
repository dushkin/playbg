import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { store } from './store/index.ts'
import { setupErudaDebug } from './utils/erudaInit'
import './index.css'

// Initialize Eruda for mobile debugging
const initEruda = async () => {
  console.log('🔍 Checking for mobile environment...')
  
  // Wait for Capacitor to be ready
  const waitForCapacitor = () => {
    return new Promise<void>((resolve) => {
      if (window.Capacitor) {
        resolve()
      } else {
        const checkCapacitor = () => {
          if (window.Capacitor) {
            resolve()
          } else {
            setTimeout(checkCapacitor, 100)
          }
        }
        checkCapacitor()
      }
    })
  }

  try {
    await waitForCapacitor()
    
    // Check if we're in a mobile environment
    const isMobile = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
    
    console.log('🔍 Is mobile environment:', isMobile)
    console.log('🔍 Environment mode:', import.meta.env.MODE)
    console.log('🔍 Debug mobile setting:', import.meta.env.VITE_DEBUG_MOBILE)

    // Enable Eruda in mobile environments
    // For debugging builds, enable by default. For production, check environment variable or localStorage
    const shouldEnableEruda = isMobile && (
      import.meta.env.DEV || 
      import.meta.env.VITE_DEBUG_MOBILE === 'true' ||
      localStorage.getItem('eruda-debug') === 'true' ||
      // Enable by default in mobile environments for debugging (can be disabled via localStorage)
      localStorage.getItem('eruda-debug') !== 'false'
    )

    console.log('🔍 Should enable Eruda:', shouldEnableEruda)

    if (shouldEnableEruda) {
      console.log('📱 Loading Eruda...')
      const eruda = await import('eruda')
      
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
      
      console.log('📱 Eruda mobile debugging initialized successfully!')
      
      // Add a global method to toggle Eruda
      window.toggleEruda = () => {
        if (window.eruda) {
          if (window.eruda._isInit) {
            window.eruda.destroy()
            localStorage.setItem('eruda-debug', 'false')
          } else {
            window.eruda.init()
            localStorage.setItem('eruda-debug', 'true')
          }
        }
      }
      
      // Store debug state
      localStorage.setItem('eruda-debug', 'true')
    }
  } catch (err) {
    console.warn('Failed to initialize Eruda:', err)
  }
}

// Initialize Eruda (primary method)
initEruda()

// Setup alternative Eruda debug method
setupErudaDebug()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)
