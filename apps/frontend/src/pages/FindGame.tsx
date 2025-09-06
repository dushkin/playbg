import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector, useAppDispatch } from '../hooks/redux'
import { GameSpeed, GameType } from '@playbg/shared'
import { gamesAPI } from '../services/api'
import FindGameModal, { FindGamePreferences } from '../components/FindGame/FindGameModal'
import { useSocket } from '../hooks/useSocket'
import { startMatchmaking, stopMatchmaking, updateMatchmakingStatus } from '../store/slices/gameSlice'
import toast from 'react-hot-toast'

const FindGame: React.FC = () => {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((state) => state.auth)
  const { matchmaking } = useAppSelector((state) => state.game)
  const socketService = useSocket()

  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (matchmaking.isSearching) {
      // Update wait time every second
      interval = setInterval(() => {
        dispatch(updateMatchmakingStatus({
          queuePosition: matchmaking.queuePosition,
          estimatedWaitTime: matchmaking.estimatedWaitTime,
          waitTime: matchmaking.waitTime + 1000
        }))
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [matchmaking.isSearching, matchmaking.queuePosition, matchmaking.estimatedWaitTime, matchmaking.waitTime, dispatch])

  const handleFindGame = async (preferences: FindGamePreferences) => {
    dispatch(startMatchmaking(preferences))
    
    try {
      // First try HTTP API for immediate match
      const response = await gamesAPI.findGame({
        gameSpeed: preferences.gameSpeed,
        gameType: preferences.gameType,
        preferences: {
          ratingRange: preferences.ratingRange,
          acceptLowerRating: preferences.acceptLowerRating,
          acceptHigherRating: preferences.acceptHigherRating
        }
      })

      if (response.success && response.data.matchFound) {
        // Immediate match found via HTTP
        toast.success('Match found!')
        dispatch(stopMatchmaking())
        navigate(`/game/${response.data.gameId}`)
        return
      }

      // If no immediate match, use Socket.IO for real-time matchmaking
      if (socketService.isConnected()) {
        socketService.joinMatchmaking({
          gameSpeed: preferences.gameSpeed,
          gameType: preferences.gameType,
          isPrivate: false,
          preferences: {
            ratingRange: preferences.ratingRange,
            acceptLowerRating: preferences.acceptLowerRating,
            acceptHigherRating: preferences.acceptHigherRating
          }
        })
        toast.success('Searching for opponents...')
      } else {
        throw new Error('Not connected to server')
      }
    } catch (error) {
      console.error('Find game error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to find game')
      dispatch(stopMatchmaking())
    }
  }

  const handleCancelSearch = async () => {
    try {
      if (socketService.isConnected()) {
        socketService.leaveMatchmaking()
      }
      await gamesAPI.leaveMatchmaking()
      dispatch(stopMatchmaking())
      setShowModal(false)
      toast.success('Cancelled search')
    } catch (error) {
      console.error('Error leaving queue:', error)
      toast.error('Failed to cancel search')
      // Still stop locally even if server call fails
      dispatch(stopMatchmaking())
    }
  }

  const handleModalClose = () => {
    if (matchmaking.isSearching) {
      handleCancelSearch()
    } else {
      setShowModal(false)
    }
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Please log in to find games</h2>
        <button
          onClick={() => navigate('/login')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors"
        >
          Go to Login
        </button>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Find a Game</h1>
          <p className="text-lg text-gray-600">
            Find opponents based on your preferences and skill level
          </p>
        </div>

        {/* Quick Start Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Blitz Game</h3>
              <p className="text-gray-600 text-sm mb-4">Quick 3-minute games</p>
              <button
                onClick={() => handleFindGame({
                  gameSpeed: GameSpeed.BLITZ,
                  gameType: GameType.CASUAL,
                  ratingRange: 200,
                  acceptLowerRating: true,
                  acceptHigherRating: true
                })}
                disabled={matchmaking.isSearching}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50"
              >
                {matchmaking.isSearching ? 'Searching...' : 'Play Blitz'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏆</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ranked Game</h3>
              <p className="text-gray-600 text-sm mb-4">Compete for rating points</p>
              <button
                onClick={() => handleFindGame({
                  gameSpeed: GameSpeed.STANDARD,
                  gameType: GameType.RANKED,
                  ratingRange: 200,
                  acceptLowerRating: true,
                  acceptHigherRating: true
                })}
                disabled={matchmaking.isSearching}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50"
              >
                {matchmaking.isSearching ? 'Searching...' : 'Play Ranked'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚙️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Custom Game</h3>
              <p className="text-gray-600 text-sm mb-4">Choose your preferences</p>
              <button
                onClick={() => setShowModal(true)}
                disabled={matchmaking.isSearching}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50"
              >
                {matchmaking.isSearching ? 'Searching...' : 'Customize'}
              </button>
            </div>
          </div>
        </div>

        {/* Current Search Status */}
        {matchmaking.isSearching && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Searching for Game...</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">#{matchmaking.queuePosition || 1}</div>
                  <div className="text-sm text-gray-600">Queue Position</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {Math.floor(matchmaking.waitTime / 1000)}s
                  </div>
                  <div className="text-sm text-gray-600">Wait Time</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {matchmaking.estimatedWaitTime}s
                  </div>
                  <div className="text-sm text-gray-600">Estimated</div>
                </div>
              </div>
              <button
                onClick={handleCancelSearch}
                className="mt-4 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-md transition-colors"
              >
                Cancel Search
              </button>
            </div>
          </div>
        )}

        {/* Player Stats */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{user.rating}</div>
              <div className="text-sm text-gray-600">Rating</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{user.gamesPlayed}</div>
              <div className="text-sm text-gray-600">Games Played</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{user.gamesWon}</div>
              <div className="text-sm text-gray-600">Games Won</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0}%
              </div>
              <div className="text-sm text-gray-600">Win Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Find Game Modal */}
      <FindGameModal
        isOpen={showModal}
        onClose={handleModalClose}
        onFindGame={handleFindGame}
        isSearching={matchmaking.isSearching}
        queueStatus={matchmaking.isSearching ? {
          position: matchmaking.queuePosition || 1,
          estimatedWaitTime: matchmaking.estimatedWaitTime,
          waitTime: matchmaking.waitTime
        } : null}
      />
    </div>
  )
}

export default FindGame