import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './hooks/redux'
import { checkAuth } from './store/slices/authSlice'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import CreateGame from './pages/CreateGame'
import Game from './pages/Game'
import LoadingSpinner from './components/UI/LoadingSpinner'

function App() {
  const dispatch = useAppDispatch()
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth)

  useEffect(() => {
    dispatch(checkAuth())
  }, [dispatch])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route 
        path="/login" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
        } 
      />
      <Route 
        path="/register" 
        element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
        } 
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/create-game"
        element={
          isAuthenticated ? <CreateGame /> : <Navigate to="/login" replace />
        }
      />

      {/* Placeholder routes for future implementation */}
      <Route path="/tournaments" element={<div>Tournaments - Coming Soon</div>} />
      <Route path="/leaderboard" element={<div>Leaderboard - Coming Soon</div>} />
      <Route path="/profile" element={<div>Profile - Coming Soon</div>} />
      <Route
        path="/game/:gameId"
        element={
          isAuthenticated ? <Game /> : <Navigate to="/login" replace />
        }
      />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
