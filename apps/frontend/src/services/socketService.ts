import { io, Socket } from 'socket.io-client'
import { store } from '../store'
import { 
  updateMatchmakingStatus,
  matchmakingSuccess,
  stopMatchmaking
} from '../store/slices/gameSlice'
import toast from 'react-hot-toast'

class SocketService {
  private socket: Socket | null = null

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket
    }

    const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'
    
    this.socket = io(API_BASE_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    })

    this.setupEventListeners()
    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  private setupEventListeners() {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server')
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      toast.error('Connection error. Please refresh the page.')
    })

    // Matchmaking events
    this.socket.on('matchmaking:queued', (data) => {
      console.log('Queued for matchmaking:', data)
      store.dispatch(updateMatchmakingStatus({
        queuePosition: data.position || 1,
        estimatedWaitTime: (data.position || 1) * 30,
        waitTime: 0
      }))
    })

    this.socket.on('matchmaking:found', (data) => {
      console.log('Match found:', data)
      toast.success(`Match found against ${data.opponent.username}!`)
      store.dispatch(matchmakingSuccess(data.gameId))
      
      // Navigate to game - this should be handled by the component
      window.location.href = `/game/${data.gameId}`
    })

    this.socket.on('matchmaking:left', () => {
      console.log('Left matchmaking')
      store.dispatch(stopMatchmaking())
    })

    this.socket.on('matchmaking:error', (data) => {
      console.error('Matchmaking error:', data)
      toast.error(data.message || 'Matchmaking error occurred')
      store.dispatch(stopMatchmaking())
    })

    // Rate limiting
    this.socket.on('rate_limit_exceeded', (data) => {
      console.warn('Rate limit exceeded:', data)
      toast.error(`Rate limit exceeded for ${data.action}. Try again in ${data.retryAfter} seconds.`)
    })

    // Validation errors
    this.socket.on('validation_error', (data) => {
      console.error('Validation error:', data)
      toast.error(`Validation error: ${data.message}`)
    })

    // Game events (for existing game functionality)
    this.socket.on('game:joined', (data) => {
      console.log('Joined game:', data)
    })

    this.socket.on('game:error', (data) => {
      console.error('Game error:', data)
      toast.error(data.message || 'Game error occurred')
    })

    // User status events
    this.socket.on('user:offline', (data) => {
      console.log('User went offline:', data)
    })
  }

  // Matchmaking methods
  joinMatchmaking(preferences: {
    gameSpeed: string
    gameType?: string
    isPrivate?: boolean
    preferences?: any
  }) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('matchmaking:join', {
      gameSpeed: preferences.gameSpeed,
      gameType: preferences.gameType || 'casual',
      isPrivate: preferences.isPrivate || false,
      preferences: preferences.preferences || {}
    })
  }

  leaveMatchmaking() {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('matchmaking:leave')
  }

  // Game methods
  joinGame(gameId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('game:join', { gameId })
  }

  leaveGame(gameId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('game:leave', { gameId })
  }

  makeMove(gameId: string, move: any) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('game:move', {
      gameId,
      move
    })
  }

  rollDice(gameId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('game:dice_roll', { gameId })
  }

  sendChat(gameId: string, message: string) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('game:chat', {
      gameId,
      message
    })
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

export const socketService = new SocketService()
export default socketService