import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { store } from './store/index.ts'
import { setupErudaDebug } from './utils/erudaInit'
import './index.css'

// Eruda initialization moved to after React render to prevent blocking

// Initialize React app first, then setup Eruda asynchronously
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

// Setup Eruda debug functions after React app is mounted
setTimeout(() => {
  try {
    // Setup debug functions first
    setupErudaDebug()
    
    // Auto-initialize on mobile devices now that we have proper isolation
    const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isCapacitor || isMobile) {
      console.log('📱 Mobile environment detected, auto-initializing Eruda...')
      window.initErudaDebug()
    } else {
      console.log('🔧 Desktop environment - Eruda debug functions ready. Use window.initErudaDebug() to enable.')
    }
  } catch (err) {
    console.warn('Eruda setup failed:', err)
  }
}, 500) // Delay to ensure Capacitor and React are fully loaded
