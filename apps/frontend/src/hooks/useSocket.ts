import { useEffect, useRef } from 'react'
import { useAppSelector } from './redux'
import { socketService } from '../services/socketService'

export const useSocket = () => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const initalized = useRef(false)

  useEffect(() => {
    if (isAuthenticated && user && !initalized.current) {
      const token = localStorage.getItem('token')
      if (token) {
        socketService.connect(token)
        initalized.current = true
      }
    }

    if (!isAuthenticated && initalized.current) {
      socketService.disconnect()
      initalized.current = false
    }

    return () => {
      if (!isAuthenticated) {
        socketService.disconnect()
      }
    }
  }, [isAuthenticated, user])

  return socketService
}

export default useSocket