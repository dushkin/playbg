import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { store } from './store/index.ts'
import './index.css'

// Initialize Eruda for mobile debugging
const initEruda = () => {
  // Check if we're in a mobile environment
  const isMobile = () => {
    return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
  }

  // Enable Eruda in development or when VITE_DEBUG_MOBILE is set
  const shouldEnableEruda = import.meta.env.DEV || import.meta.env.VITE_DEBUG_MOBILE === 'true'

  if (isMobile() && shouldEnableEruda) {
    import('eruda').then((eruda) => {
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
      
      // Add a global method to toggle Eruda
      window.toggleEruda = () => {
        if (window.eruda) {
          if (window.eruda._isInit) {
            window.eruda.destroy()
          } else {
            window.eruda.init()
          }
        }
      }
    }).catch(err => {
      console.warn('Failed to load Eruda:', err)
    })
  }
}

// Initialize Eruda
initEruda()

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
