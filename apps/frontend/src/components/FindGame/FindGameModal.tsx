import React, { useState } from 'react'
import { GameSpeed, GameType } from '@playbg/shared'
import LoadingSpinner from '../UI/LoadingSpinner'

interface FindGameModalProps {
  isOpen: boolean
  onClose: () => void
  onFindGame: (preferences: FindGamePreferences) => void
  isSearching: boolean
  queueStatus?: {
    position: number
    estimatedWaitTime: number
    waitTime: number
  } | null
}

export interface FindGamePreferences {
  gameSpeed: GameSpeed
  gameType: GameType
  ratingRange: number
  acceptLowerRating: boolean
  acceptHigherRating: boolean
}

const FindGameModal: React.FC<FindGameModalProps> = ({
  isOpen,
  onClose,
  onFindGame,
  isSearching,
  queueStatus
}) => {
  const [preferences, setPreferences] = useState<FindGamePreferences>({
    gameSpeed: GameSpeed.STANDARD,
    gameType: GameType.CASUAL,
    ratingRange: 200,
    acceptLowerRating: true,
    acceptHigherRating: true
  })

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFindGame(preferences)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Find Game</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isSearching}
          >
            ×
          </button>
        </div>

        {isSearching ? (
          // Queue Status Display
          <div className="text-center py-8">
            <div className="mb-4">
              <LoadingSpinner size="lg" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Searching for opponent...
            </h3>
            {queueStatus && (
              <div className="space-y-2 text-gray-600">
                <p>Queue position: #{queueStatus.position}</p>
                <p>Wait time: {formatTime(Math.floor(queueStatus.waitTime / 1000))}</p>
                <p>Estimated: {formatTime(queueStatus.estimatedWaitTime)}</p>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Cancel Search
            </button>
          </div>
        ) : (
          // Game Preferences Form
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Game Speed */}
            <div>
              <label htmlFor="gameSpeed" className="block text-sm font-medium text-gray-700 mb-1">
                Time Control
              </label>
              <select
                id="gameSpeed"
                value={preferences.gameSpeed}
                onChange={(e) => setPreferences({ ...preferences, gameSpeed: e.target.value as GameSpeed })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={GameSpeed.BLITZ}>Blitz (3 minutes)</option>
                <option value={GameSpeed.RAPID}>Rapid (10 minutes)</option>
                <option value={GameSpeed.STANDARD}>Standard (30 minutes)</option>
                <option value={GameSpeed.UNLIMITED}>Unlimited</option>
              </select>
            </div>

            {/* Game Type */}
            <div>
              <label htmlFor="gameType" className="block text-sm font-medium text-gray-700 mb-1">
                Game Type
              </label>
              <select
                id="gameType"
                value={preferences.gameType}
                onChange={(e) => setPreferences({ ...preferences, gameType: e.target.value as GameType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={GameType.CASUAL}>Casual</option>
                <option value={GameType.RANKED}>Ranked</option>
              </select>
            </div>

            {/* Advanced Preferences */}
            <div>
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {isAdvancedOpen ? '- Hide' : '+ Show'} Advanced Preferences
              </button>
            </div>

            {isAdvancedOpen && (
              <div className="space-y-4 border-t pt-4">
                {/* Rating Range */}
                <div>
                  <label htmlFor="ratingRange" className="block text-sm font-medium text-gray-700 mb-1">
                    Rating Range: ±{preferences.ratingRange}
                  </label>
                  <input
                    type="range"
                    id="ratingRange"
                    min="50"
                    max="500"
                    step="25"
                    value={preferences.ratingRange}
                    onChange={(e) => setPreferences({ ...preferences, ratingRange: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Exact (±50)</span>
                    <span>Flexible (±500)</span>
                  </div>
                </div>

                {/* Rating Preferences */}
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.acceptLowerRating}
                      onChange={(e) => setPreferences({ ...preferences, acceptLowerRating: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Accept lower rated opponents</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preferences.acceptHigherRating}
                      onChange={(e) => setPreferences({ ...preferences, acceptHigherRating: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Accept higher rated opponents</span>
                  </label>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Find Game
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default FindGameModal