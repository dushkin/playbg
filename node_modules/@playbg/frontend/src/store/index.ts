import { configureStore } from '@reduxjs/toolkit'
import authSlice from './slices/authSlice'
import gameSlice from './slices/gameSlice'
import tournamentSlice from './slices/tournamentSlice'
import uiSlice from './slices/uiSlice'

export const store = configureStore({
  reducer: {
    auth: authSlice,
    game: gameSlice,
    tournament: tournamentSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
