import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Tournament } from '@playbg/shared'

interface TournamentState {
  tournaments: Tournament[]
  currentTournament: Tournament | null
  isLoading: boolean
  error: string | null
}

const initialState: TournamentState = {
  tournaments: [],
  currentTournament: null,
  isLoading: false,
  error: null,
}

const tournamentSlice = createSlice({
  name: 'tournament',
  initialState,
  reducers: {
    setTournaments: (state, action: PayloadAction<Tournament[]>) => {
      state.tournaments = action.payload
    },
    addTournament: (state, action: PayloadAction<Tournament>) => {
      state.tournaments.push(action.payload)
    },
    updateTournament: (state, action: PayloadAction<{ id: string; updates: Partial<Tournament> }>) => {
      const index = state.tournaments.findIndex(t => t.id === action.payload.id)
      if (index !== -1) {
        state.tournaments[index] = { ...state.tournaments[index], ...action.payload.updates }
      }
      if (state.currentTournament?.id === action.payload.id) {
        state.currentTournament = { ...state.currentTournament, ...action.payload.updates }
      }
    },
    setCurrentTournament: (state, action: PayloadAction<Tournament | null>) => {
      state.currentTournament = action.payload
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
  setTournaments,
  addTournament,
  updateTournament,
  setCurrentTournament,
  setLoading,
  setError,
} = tournamentSlice.actions

export default tournamentSlice.reducer
