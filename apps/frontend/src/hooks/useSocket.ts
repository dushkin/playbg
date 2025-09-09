import { useEffect, useRef } from 'react'
import { useAppSelector } from './redux'
import { socketService } from '../services/socketService'

export const useSocket = () => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const initialized = useRef(false)
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear any existing timeout
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }

    if (isAuthenticated && user && !initialized.current) {
      const token = localStorage.getItem('token')
      if (token && !socketService.isConnected()) {
        // Delay connection slightly to avoid rapid reconnects
        connectTimeoutRef.current = setTimeout(() => {
          socketService.connect(token)
          initialized.current = true
        }, 100)
      }
    }

    if (!isAuthenticated && initialized.current) {
      socketService.disconnect()
      initialized.current = false
    }

    return () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
    }
  }, [isAuthenticated, user])

  return socketService
}

export default useSocket