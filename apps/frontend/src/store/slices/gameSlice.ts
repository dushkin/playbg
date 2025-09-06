import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Game, GameMove } from '@playbg/shared'

interface GameState {
  currentGame: Game | null
  isInGame: boolean
  isLoading: boolean
  error: string | null
  availableMoves: GameMove[]
  selectedChecker: { point: number; checkerIndex: number } | null
  
  // Matchmaking state
  matchmaking: {
    isSearching: boolean
    inQueue: boolean
    queuePosition: number
    estimatedWaitTime: number
    waitTime: number
    preferences: any | null
  }
}

const initialState: GameState = {
  currentGame: null,
  isInGame: false,
  isLoading: false,
  error: null,
  availableMoves: [],
  selectedChecker: null,
  
  matchmaking: {
    isSearching: false,
    inQueue: false,
    queuePosition: 0,
    estimatedWaitTime: 0,
    waitTime: 0,
    preferences: null
  }
}

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setCurrentGame: (state, action: PayloadAction<Game>) => {
      state.currentGame = action.payload
      state.isInGame = true
    },
    updateGameState: (state, action: PayloadAction<Partial<Game>>) => {
      if (state.currentGame) {
        state.currentGame = { ...state.currentGame, ...action.payload }
      }
    },
    addMove: (state, action: PayloadAction<GameMove>) => {
      if (state.currentGame) {
        state.currentGame.moves.push(action.payload)
      }
    },
    setAvailableMoves: (state, action: PayloadAction<GameMove[]>) => {
      state.availableMoves = action.payload
    },
    selectChecker: (state, action: PayloadAction<{ point: number; checkerIndex: number } | null>) => {
      state.selectedChecker = action.payload
    },
    leaveGame: (state) => {
      state.currentGame = null
      state.isInGame = false
      state.availableMoves = []
      state.selectedChecker = null
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    
    // Matchmaking actions
    startMatchmaking: (state, action: PayloadAction<any>) => {
      state.matchmaking.isSearching = true
      state.matchmaking.inQueue = true
      state.matchmaking.preferences = action.payload
      state.matchmaking.queuePosition = 0
      state.matchmaking.estimatedWaitTime = 0
      state.matchmaking.waitTime = 0
    },
    updateMatchmakingStatus: (state, action: PayloadAction<{
      queuePosition: number
      estimatedWaitTime: number
      waitTime: number
    }>) => {
      state.matchmaking.queuePosition = action.payload.queuePosition
      state.matchmaking.estimatedWaitTime = action.payload.estimatedWaitTime
      state.matchmaking.waitTime = action.payload.waitTime
    },
    matchmakingSuccess: (state) => {
      state.matchmaking.isSearching = false
      state.matchmaking.inQueue = false
      state.matchmaking.queuePosition = 0
      state.matchmaking.preferences = null
      // Game ID is in action.payload for navigation
    },
    stopMatchmaking: (state) => {
      state.matchmaking.isSearching = false
      state.matchmaking.inQueue = false
      state.matchmaking.queuePosition = 0
      state.matchmaking.estimatedWaitTime = 0
      state.matchmaking.waitTime = 0
      state.matchmaking.preferences = null
    },
  },
})

export const {
  setCurrentGame,
  updateGameState,
  addMove,
  setAvailableMoves,
  selectChecker,
  leaveGame,
  setLoading,
  setError,
  startMatchmaking,
  updateMatchmakingStatus,
  matchmakingSuccess,
  stopMatchmaking,
} = gameSlice.actions

export default gameSlice.reducer
