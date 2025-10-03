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
  private currentGameId: string | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private lastPongTime: number = Date.now()

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket
    }

    // Extract WebSocket URL - if VITE_API_URL has /api, remove it for Socket.IO
    const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api'
    const WS_BASE_URL = apiUrl.replace('/api', '')

    console.log('Socket connecting to:', WS_BASE_URL);

    this.socket = io(WS_BASE_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep trying indefinitely for server wake-up
      reconnectionDelay: 1000,  // Start at 1 second
      reconnectionDelayMax: 15000, // Max 15s between attempts for server wake-up
      timeout: 60000, // Increased to 60s for Render free tier wake-up
      forceNew: false,
      transports: ['polling', 'websocket'], // Start with polling for better reliability
      upgrade: true, // Allow transport upgrades
      rememberUpgrade: true, // Remember successful upgrades
      // Add ack timeout to prevent hanging on slow networks
      ackTimeout: 15000, // 15 seconds for acknowledgments (server wake-up)
      // Ensure connection stays alive with proper ping/pong
      closeOnBeforeunload: false // Don't close on page refresh
    })

    this.setupEventListeners()
    return this.socket
  }

  disconnect() {
    this.stopHeartbeat()
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
      this.lastPongTime = Date.now()
      this.startHeartbeat()
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
      this.stopHeartbeat()

      if (reason === 'io server disconnect') {
        // Server-initiated disconnect, don't auto-reconnect
        toast.error('Disconnected by server')
      } else if (reason === 'transport close' || reason === 'transport error') {
        // Network issues, will auto-reconnect
        console.log('Network disconnection, auto-reconnecting...')
        toast('Connection lost, reconnecting...', { duration: 3000, icon: 'ℹ️' })
      }
    })

    // Monitor server pings/pongs for connection health
    // Socket.IO automatically handles ping/pong at the engine level
    // We track pongs by listening to the underlying engine events
    if (this.socket.io.engine) {
      this.socket.io.engine.on('ping', () => {
        console.log('📡 Ping sent to server')
      })

      this.socket.io.engine.on('pong', () => {
        this.lastPongTime = Date.now()
        console.log('📡 Pong received from server')
      })
    }

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Reconnected after ${attemptNumber} attempts`)
      toast.success('Connection restored! Reloading game...', { duration: 3000 })

      // Rejoin the game if we were in one
      if (this.currentGameId) {
        console.log(`Rejoining game ${this.currentGameId} after reconnection`)
        this.socket?.emit('game:join', { gameId: this.currentGameId })

        // Emit a custom event that Game component can listen to
        this.socket?.emit('game:reconnected', { gameId: this.currentGameId })
      }
    })

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`)
      if (attemptNumber === 1) {
        toast('Reconnecting...', { duration: 2000, icon: '🔄' })
      } else if (attemptNumber === 5) {
        toast('Server may be waking up, please wait...', { duration: 3000, icon: '⏳' })
      } else if (attemptNumber % 10 === 0) {
        toast(`Still reconnecting... (attempt ${attemptNumber})`, { duration: 3000, icon: '🔄' })
      }
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
        // Don't show repeated messages for server wake-up
        console.log('Server starting up, connection will retry automatically')
      } else if (error.message.includes('CORS') || error.message.toLowerCase().includes('cors')) {
        // CORS errors during reconnection are often due to server spin-down on free tier
        console.warn('CORS error detected - likely server spin-down, will retry')
        // Don't show scary error message, this is normal for free tier
      } else if (error.message.includes('Authentication')) {
        // Token expired - need to refresh and reconnect
        console.warn('Socket authentication failed - token may have expired. Page reload required.')
        toast.error('Session expired. Please refresh the page.', { duration: 0 })
      } else if (error.message.includes('xhr poll error') || error.message.includes('websocket error')) {
        // Network/transport errors - likely server spin-down
        console.log('Transport error - server may be waking up, retrying...')
      } else {
        // Only show user-facing error for unexpected errors
        console.warn('Unexpected connection error:', error.message)
      }
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

      // Handle specific error types
      if (data.message?.includes('No matching document found')) {
        // This is usually a temporary concurrency issue, don't show scary error
        console.warn('Document version conflict detected - this is usually resolved automatically')
      } else {
        toast.error(data.message || 'Game error occurred')
      }
    })

    // Game list update events
    this.socket.on('game:created', (data) => {
      console.log('New game created:', data)
      // This event will be handled by components that are listening
      // The Dashboard component should listen to this event directly
    })

    this.socket.on('game:unavailable', (data) => {
      console.log('Game is on now!', data)
      // This event will be handled by components that are listening
    })

    // User status events
    this.socket.on('user:offline', () => {
      // Only log if it's relevant to the current user (e.g., in same game)
      // For now, we'll just silently handle this event without logging
      // console.log('User went offline:', data)
    })
  }

  // Matchmaking methods
  joinMatchmaking(preferences: {
    gamePeriod: string
    gameType?: string
    isPrivate?: boolean
    preferences?: any
  }) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('matchmaking:join', {
      gamePeriod: preferences.gamePeriod,
      gameType: preferences.gameType || 'not-ranked',
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

    this.currentGameId = gameId
    this.socket.emit('game:join', { gameId })
  }

  leaveGame(gameId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    if (this.currentGameId === gameId) {
      this.currentGameId = null
    }
    this.socket.emit('game:leave', { gameId })
  }

  makeMove(gameId: string, move: any): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket not connected')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Move acknowledgment timeout'))
      }, 10000) // 10 second timeout

      this.socket!.emit('game:move', {
        gameId,
        move
      }, (response: any) => {
        clearTimeout(timeout)
        if (response?.error) {
          reject(new Error(response.error))
        } else {
          resolve()
        }
      })
    })
  }

  rollDice(gameId: string): Promise<{ success: boolean; dice?: [number, number]; error?: string }> {
    if (!this.socket) {
      return Promise.reject(new Error('Socket not connected'))
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Dice roll acknowledgment timeout'))
      }, 10000) // 10 second timeout

      this.socket!.emit('game:dice_roll', { gameId }, (response: any) => {
        clearTimeout(timeout)
        if (response?.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
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

  // Heartbeat monitoring to detect stale connections
  private startHeartbeat() {
    this.stopHeartbeat() // Clear any existing interval

    // Check connection health every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const timeSinceLastPong = Date.now() - this.lastPongTime

      // If no pong received in 90 seconds, connection might be stale
      if (timeSinceLastPong > 90000) {
        console.warn(`⚠️ No pong received for ${Math.round(timeSinceLastPong / 1000)}s - connection may be stale`)

        // If connection appears stale but socket thinks it's connected, force reconnect
        if (this.socket?.connected && timeSinceLastPong > 150000) {
          console.error('🔴 Connection stale for >150s, forcing reconnect')
          this.socket.disconnect().connect()
        }
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
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