import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { gamesAPI } from '../services/api'
import { GameType, GameSpeed } from '@playbg/shared'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const CreateGame: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [gameData, setGameData] = useState({
    gameType: GameType.CASUAL,
    gameSpeed: GameSpeed.STANDARD,
  })

  if (!user) {
    return <div>Loading...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await gamesAPI.createGame(gameData)

      if (response.success && response.data) {
        // Navigate to the game page
        navigate(`/game/${response.data.id}`)
      } else {
        setError(response.error || 'Failed to create game')
      }
    } catch (err) {
      setError('Failed to create game. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-md mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Create New Game</h2>
              <p className="mt-2 text-sm text-gray-600">
                Set up your game preferences
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Game Type Selection */}
              <div>
                <label htmlFor="gameType" className="block text-sm font-medium text-gray-700 mb-2">
                  Game Type
                </label>
                <select
                  id="gameType"
                  value={gameData.gameType}
                  onChange={(e) => setGameData({ ...gameData, gameType: e.target.value as GameType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                >
                  <option value={GameType.CASUAL}>Casual</option>
                  <option value={GameType.RANKED}>Ranked</option>
                  <option value={GameType.PRIVATE}>Private</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {gameData.gameType === GameType.CASUAL && "Play for fun without affecting your rating"}
                  {gameData.gameType === GameType.RANKED && "Compete for rating points"}
                  {gameData.gameType === GameType.PRIVATE && "Invite a specific opponent"}
                </p>
              </div>

              {/* Game Speed Selection */}
              <div>
                <label htmlFor="gameSpeed" className="block text-sm font-medium text-gray-700 mb-2">
                  Time Control
                </label>
                <select
                  id="gameSpeed"
                  value={gameData.gameSpeed}
                  onChange={(e) => setGameData({ ...gameData, gameSpeed: e.target.value as GameSpeed })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                >
                  <option value={GameSpeed.BLITZ}>Blitz (3 minutes)</option>
                  <option value={GameSpeed.RAPID}>Rapid (10 minutes)</option>
                  <option value={GameSpeed.STANDARD}>Standard (30 minutes)</option>
                  <option value={GameSpeed.UNLIMITED}>Unlimited</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {gameData.gameSpeed === GameSpeed.BLITZ && "Fast-paced games for quick matches"}
                  {gameData.gameSpeed === GameSpeed.RAPID && "Balanced time control"}
                  {gameData.gameSpeed === GameSpeed.STANDARD && "Traditional time control"}
                  {gameData.gameSpeed === GameSpeed.UNLIMITED && "No time limit"}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Creating...</span>
                    </>
                  ) : (
                    'Create Game'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateGame
