import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { gamesAPI } from '../services/api'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import { socketService } from '../services/socketService'

interface GameItem {
  _id: string
  players: Array<{
    userId: string
    username: string
    rating: number
    color: string
  }>
  gameState: string
  gamePeriod: string
  gameType: string
  status?: string
  isCreator?: boolean
  result?: string
  createdAt: string
  updatedAt: string
}

const Dashboard: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth)
  const navigate = useNavigate()

  const [availableGames, setAvailableGames] = useState<GameItem[]>([])
  const [myGames, setMyGames] = useState<GameItem[]>([])
  const [gameHistory, setGameHistory] = useState<GameItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'available' | 'my-games'>('available')

  useEffect(() => {
    loadGameData()
    
    // Set up socket listeners for real-time updates
    const socket = socketService.getSocket()
    if (socket) {
      socket.on('game:created', handleGameCreated)
      socket.on('game:joined', handleGameJoined)
      socket.on('game:unavailable', handleGameUnavailable)
    }

    // Refresh data every 30 seconds as backup
    const interval = setInterval(loadGameData, 30000)
    
    return () => {
      clearInterval(interval)
      if (socket) {
        socket.off('game:created', handleGameCreated)
        socket.off('game:joined', handleGameJoined)
        socket.off('game:unavailable', handleGameUnavailable)
      }
    }
  }, [])

  const loadGameData = async () => {
    try {
      const [availableRes, myGamesRes, historyRes] = await Promise.all([
        gamesAPI.getAvailableGames(),
        gamesAPI.getMyGames(),
        gamesAPI.getGameHistory(1, 10)
      ])

      if (availableRes.success) setAvailableGames(availableRes.data || [])
      if (myGamesRes.success) setMyGames(myGamesRes.data || [])
      if (historyRes.success) setGameHistory(historyRes.data || [])
    } catch (error) {
      console.error('Error loading game data:', error)
      toast.error('Failed to load game data')
    } finally {
      setLoading(false)
    }
  }

  // Socket event handlers
  const handleGameCreated = (data: any) => {
    console.log('New game created:', data)
    // Add new game to available games if it's not created by current user
    if (data.gameData?.players?.[0]?.userId !== user?.id) {
      setAvailableGames(prev => [data.gameData, ...prev])
    } else {
      // If current user created the game, add to my games
      setMyGames(prev => [{ ...data.gameData, status: 'Waiting for opponent', isCreator: true }, ...prev])
    }
  }

  const handleGameJoined = (data: any) => {
    console.log('Game joined:', data)
    // Refresh data to get updated status
    loadGameData()
    
    // Show notification if someone joined your game
    if (data.gameData?.players?.some((p: any) => p.userId === user?.id)) {
      toast.success(`${data.joiner} joined your game! ${data.firstPlayer} goes first.`)
    }
  }

  const handleGameUnavailable = (data: any) => {
    console.log('Game no longer available:', data)
    // Remove game from available games
    setAvailableGames(prev => prev.filter(game => game._id !== data.gameId))
  }

  const handleJoinGame = async (gameId: string) => {
    try {
      const response = await gamesAPI.joinGame(gameId)
      if (response.success) {
        toast.success('Successfully joined game!')
        navigate(`/game/${gameId}`)
      } else {
        toast.error(response.error || 'Failed to join game')
      }
    } catch (error) {
      console.error('Error joining game:', error)
      toast.error('Failed to join game')
    }
  }

  const handleCreateGame = () => {
    navigate('/create-game')
  }

  const handleViewGame = (gameId: string) => {
    navigate(`/game/${gameId}`)
  }

  const formatGamePeriod = (period: string) => {
    switch (period) {
      case '3min': return '3 minutes'
      case '10min': return '10 minutes'
      case '30min': return '30 minutes'
      case 'unlimited': return 'Unlimited'
      default: return period
    }
  }

  const formatGameType = (type: string) => {
    switch (type) {
      case 'not_ranked': return 'Casual'
      case 'ranked': return 'Ranked'
      default: return type
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Your turn': return 'text-green-600'
      case "Opponent's turn": return 'text-blue-600'
      case 'Waiting for opponent': return 'text-yellow-600'
      default: return 'text-gray-600'
    }
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'Won': return 'text-green-600'
      case 'Lost': return 'text-red-600'
      case 'Draw': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Welcome back, {user.username}!
          </h1>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">R</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Current Rating
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {user.rating}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">G</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Games Played
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {user.gamesPlayed}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-bold">W</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Win Rate
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleCreateGame}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  Create Game
                </button>
                <button
                  onClick={() => loadGameData()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  Refresh Games
                </button>
                <button 
                  onClick={() => navigate('/tournaments')}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  Tournaments
                </button>
              </div>
            </div>
          </div>

          {/* Game Lists */}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Mobile Tabs (visible on mobile only) */}
              <div className="lg:hidden col-span-1">
                <div className="border-b border-gray-200 mb-6">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setActiveTab('available')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'available'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Available Games ({availableGames.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('my-games')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'my-games'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      My Games ({myGames.length})
                    </button>
                  </nav>
                </div>
              </div>

              {/* Available Games */}
              <div className={`${activeTab !== 'available' ? 'hidden lg:block' : ''}`}>
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Available Games ({availableGames.length})
                    </h3>
                    
                    {availableGames.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">
                        No games available. Create one to get started!
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {availableGames.map((game) => (
                          <div key={game._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-md font-medium text-gray-900">
                                    vs {game.players[0]?.username} ({game.players[0]?.rating})
                                  </h4>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {formatGameType(game.gameType)}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 space-y-1">
                                  <div>Time Control: {formatGamePeriod(game.gamePeriod)}</div>
                                  <div>Created: {new Date(game.createdAt).toLocaleString()}</div>
                                </div>
                              </div>
                              <div className="ml-4">
                                <button
                                  onClick={() => handleJoinGame(game._id)}
                                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                                >
                                  Join
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* My Games */}
              <div className={`${activeTab !== 'my-games' ? 'hidden lg:block' : ''}`}>
                <div className="bg-white shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      My Games ({myGames.length})
                    </h3>
                    
                    {myGames.length === 0 ? (
                      <div className="text-gray-500 text-center py-8">
                        No active games. Create or join one to start playing!
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {myGames.map((game) => (
                          <div key={game._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-md font-medium text-gray-900">
                                    {game.players.length === 1 ? 'Waiting for opponent' : 
                                     `vs ${game.players.find(p => p.userId !== user.id)?.username || 'Unknown'}`}
                                  </h4>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(game.status || '')}`}>
                                    {game.status}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-500 space-y-1">
                                  <div>Time Control: {formatGamePeriod(game.gamePeriod)}</div>
                                  <div>Type: {formatGameType(game.gameType)}</div>
                                  <div>Updated: {new Date(game.updatedAt).toLocaleString()}</div>
                                </div>
                              </div>
                              <div className="ml-4">
                                <button
                                  onClick={() => handleViewGame(game._id)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                                >
                                  View
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Game History */}
          {gameHistory.length > 0 && (
            <div className="bg-white shadow rounded-lg mt-8">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Recent Games ({gameHistory.length})
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {gameHistory.map((game) => (
                    <div key={game._id} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          vs {game.players.find(p => p.userId !== user.id)?.username || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(game.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`text-sm font-medium ${getResultColor(game.result || '')}`}>
                        {game.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard