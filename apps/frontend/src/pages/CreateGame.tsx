import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { gamesAPI } from '../services/api'
import { GameType, GamePeriod, StepPeriod } from '@playbg/shared'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const CreateGame: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [gameData, setGameData] = useState({
    gameType: GameType.NOT_RANKED,
    gamePeriod: GamePeriod.UNLIMITED,
    stepPeriod: StepPeriod.THREE_DAYS,
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
                  <option value={GameType.NOT_RANKED}>Not Ranked</option>
                  <option value={GameType.RANKED}>Ranked</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {gameData.gameType === GameType.NOT_RANKED && "Play for fun without affecting your rating"}
                  {gameData.gameType === GameType.RANKED && "Compete for rating points"}
                </p>
              </div>

              {/* Game Period Selection */}
              <div>
                <label htmlFor="gamePeriod" className="block text-sm font-medium text-gray-700 mb-2">
                  Max Match Time
                </label>
                <select
                  id="gamePeriod"
                  value={gameData.gamePeriod}
                  onChange={(e) => setGameData({ ...gameData, gamePeriod: e.target.value as GamePeriod })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={isLoading}
                >
                  <option value={GamePeriod.THREE_MINUTES}>3 minutes</option>
                  <option value={GamePeriod.TEN_MINUTES}>10 minutes</option>
                  <option value={GamePeriod.THIRTY_MINUTES}>30 minutes</option>
                  <option value={GamePeriod.UNLIMITED}>Unlimited</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {gameData.gamePeriod === GamePeriod.THREE_MINUTES && "Fast-paced matches"}
                  {gameData.gamePeriod === GamePeriod.TEN_MINUTES && "Medium-length matches"}
                  {gameData.gamePeriod === GamePeriod.THIRTY_MINUTES && "Longer matches"}
                  {gameData.gamePeriod === GamePeriod.UNLIMITED && "Set maximum time period for the whole match"}
                </p>
              </div>

              {/* Step Period Selection (only for Unlimited) */}
              {gameData.gamePeriod === GamePeriod.UNLIMITED && (
                <div>
                  <label htmlFor="stepPeriod" className="block text-sm font-medium text-gray-700 mb-2">
                    Time per Move
                  </label>
                  <select
                    id="stepPeriod"
                    value={gameData.stepPeriod}
                    onChange={(e) => setGameData({ ...gameData, stepPeriod: e.target.value as StepPeriod })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isLoading}
                  >
                    <option value={StepPeriod.TEN_SECONDS}>10 seconds</option>
                    <option value={StepPeriod.THIRTY_SECONDS}>30 seconds</option>
                    <option value={StepPeriod.ONE_MINUTE}>1 minute</option>
                    <option value={StepPeriod.THREE_MINUTES}>3 minutes</option>
                    <option value={StepPeriod.TEN_MINUTES}>10 minutes</option>
                    <option value={StepPeriod.ONE_HOUR}>1 hour</option>
                    <option value={StepPeriod.THREE_HOURS}>3 hours</option>
                    <option value={StepPeriod.ONE_DAY}>1 day</option>
                    <option value={StepPeriod.THREE_DAYS}>3 days (Default)</option>
                    <option value={StepPeriod.FIVE_DAYS}>5 days</option>
                    <option value={StepPeriod.SEVEN_DAYS}>7 days</option>
                    <option value={StepPeriod.TEN_DAYS}>10 days</option>
                    <option value={StepPeriod.UNLIMITED}>Unlimited</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum time allowed per move
                  </p>
                </div>
              )}

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
