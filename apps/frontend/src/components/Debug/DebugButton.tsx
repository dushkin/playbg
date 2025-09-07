import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

const DebugButton = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [erudaActive, setErudaActive] = useState(false)

  useEffect(() => {
    // Only show debug button on mobile devices
    const isMobile = Capacitor.isNativePlatform() || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    setIsVisible(isMobile)
    
    // Check if Eruda is already active
    const checkErudaStatus = () => {
      setErudaActive(!!(window as any).eruda && (window as any).eruda._isInit)
    }
    
    checkErudaStatus()
    
    // Check periodically for Eruda status changes
    const interval = setInterval(checkErudaStatus, 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleEruda = async () => {
    try {
      if ((window as any).initErudaDebug) {
        if (erudaActive && (window as any).toggleEruda) {
          (window as any).toggleEruda()
        } else {
          await (window as any).initErudaDebug()
        }
        
        // Update status after a brief delay
        setTimeout(() => {
          setErudaActive(!!(window as any).eruda && (window as any).eruda._isInit)
        }, 100)
      } else {
        console.log('Debug functions not available yet')
      }
    } catch (error) {
      console.error('Failed to toggle Eruda:', error)
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <button
      onClick={toggleEruda}
      className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 opacity-80 hover:opacity-100"
      title={erudaActive ? "Close Eruda" : "Open Debug Tools"}
      style={{ fontSize: '12px', minWidth: '48px', minHeight: '48px' }}
    >
      {erudaActive ? '🔧' : '🐛'}
    </button>
  )
}

export default DebugButton