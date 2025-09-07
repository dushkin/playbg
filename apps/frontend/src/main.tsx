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

// Initialize Eruda after React app is mounted
setTimeout(() => {
  try {
    // Setup debug functions first
    setupErudaDebug()
    
    // Check if we're in a Capacitor mobile environment
    const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isCapacitor || isMobile) {
      console.log('📱 Mobile environment detected, auto-initializing Eruda...')
      // Auto-initialize Eruda in mobile environments
      window.initErudaDebug()
    } else {
      console.log('🔧 Desktop environment - Eruda debug functions ready. Use window.initErudaDebug() to enable.')
    }
  } catch (err) {
    console.warn('Eruda setup failed:', err)
  }
}, 500) // Increased delay to ensure Capacitor is fully loaded
