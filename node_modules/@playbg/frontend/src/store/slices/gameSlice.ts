import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Game, GameMove } from '@playbg/shared'

interface GameState {
  currentGame: Game | null
  isInGame: boolean
  isLoading: boolean
  error: string | null
  availableMoves: GameMove[]
  selectedChecker: { point: number; checkerIndex: number } | null
}

const initialState: GameState = {
  currentGame: null,
  isInGame: false,
  isLoading: false,
  error: null,
  availableMoves: [],
  selectedChecker: null,
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
} = gameSlice.actions

export default gameSlice.reducer
