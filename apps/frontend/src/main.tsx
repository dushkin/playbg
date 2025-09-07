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
    // Only setup the debug functions, don't auto-initialize Eruda
    // This prevents Eruda from interfering with app loading
    setupErudaDebug()
    
    // Log that we're ready for manual Eruda initialization
    console.log('🔧 Eruda debug functions ready. Use window.initErudaDebug() to enable.')
  } catch (err) {
    console.warn('Eruda setup failed:', err)
  }
}, 100) // Small delay to ensure React is rendered first
