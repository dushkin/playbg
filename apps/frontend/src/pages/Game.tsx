import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { gamesAPI } from '../services/api'
import { Game as GameType, GameState as GameStateEnum } from '@playbg/shared'
import LoadingSpinner from '../components/UI/LoadingSpinner'

const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)

  const [game, setGame] = useState<GameType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)

  useEffect(() => {
    if (gameId) {
      loadGame()
    }
  }, [gameId])

  const loadGame = async () => {
    if (!gameId) return

    try {
      setIsLoading(true)
      const response = await gamesAPI.getGame(gameId)

      if (response.success && response.data) {
        setGame(response.data)
      } else {
        setError(response.error || 'Failed to load game')
      }
    } catch (err) {
      setError('Failed to load game')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePointClick = (pointIndex: number) => {
    if (!game || game.gameState !== GameStateEnum.IN_PROGRESS) return

    // Check if it's the current player's turn
    const currentPlayerIndex = game.players.findIndex(p => p.userId === user?.id)
    if (currentPlayerIndex !== game.currentPlayer) return

    if (selectedPoint === null) {
      // Select a point if it has checkers
      const point = game.board.points[pointIndex]
      if (point && point[currentPlayerIndex] > 0) {
        setSelectedPoint(pointIndex)
        // TODO: Calculate possible moves for this point
      }
    } else if (selectedPoint === pointIndex) {
      // Deselect if clicking the same point
      setSelectedPoint(null)
    } else {
      // Try to make a move
      // TODO: Implement move logic
      setSelectedPoint(null)
    }
  }

  const renderPoint = (pointIndex: number, isTopHalf: boolean) => {
    const point = game?.board.points[pointIndex]
    const isSelected = selectedPoint === pointIndex
    
    // Determine point color (alternating pattern)
    const isEvenPoint = pointIndex % 2 === 0
    const pointColorClass = isEvenPoint 
      ? 'from-amber-100 to-amber-200' 
      : 'from-amber-800 to-amber-900'
    
    return (
      <div
        key={`point-${pointIndex}`}
        className={`
          relative flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center h-full
          cursor-pointer transition-all duration-300 ease-out
          ${isSelected ? 'scale-110 z-20' : 'hover:scale-105 hover:z-10'}
          ${isSelected ? 'animate-pulse' : ''}
        `}
        onClick={() => handlePointClick(pointIndex)}
      >
        {/* Point triangle */}
        <div
          className={`
            absolute inset-0 transition-all duration-200
            ${isSelected ? 'ring-4 ring-blue-400 ring-opacity-75' : ''}
          `}
          style={{
            background: `linear-gradient(to bottom, ${pointColorClass.includes('amber-100') ? '#fef3c7, #fde68a' : '#92400e, #78350f'})`,
            clipPath: isTopHalf 
              ? 'polygon(50% 100%, 0% 0%, 100% 0%)'
              : 'polygon(0% 100%, 100% 100%, 50% 0%)',
            boxShadow: isSelected ? 'inset 0 0 20px rgba(59, 130, 246, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
        
        {/* Point number */}
        <div className={`
          absolute ${isTopHalf ? 'bottom-0.5' : 'top-0.5'} left-1/2 transform -translate-x-1/2
          text-xs font-bold text-amber-900 opacity-50 z-10 pointer-events-none
        `}>
          {pointIndex + 1}
        </div>
        
        {/* Checkers */}
        <div className={`
          relative z-20 flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center
          ${isTopHalf ? 'justify-start pt-1' : 'justify-start pt-1'}
          h-full px-2
        `}>
          {point && point.map((playerCheckers, playerIndex) => {
            if (playerCheckers === 0) return null
            
            return (
              <div key={playerIndex} className={`flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center`}>
                {Array.from({ length: Math.min(playerCheckers, 5) }, (_, checkerIndex) => (
                <div
                  key={checkerIndex}
                  className={`
                    relative w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-full transition-all duration-300 ease-out
                    ${checkerIndex === 0 ? '' : '-mt-1'}
                    hover:scale-110 hover:z-30 cursor-pointer
                    transform hover:-translate-y-1
                  `}
                  style={{
                    background: playerIndex === 0
                      ? `radial-gradient(circle at 30% 30%, #ffffff, #f8f9fa 40%, #e5e7eb 70%, #d1d5db)`
                      : `radial-gradient(circle at 30% 30%, #1f2937, #374151 40%, #4b5563 70%, #6b7280)`,
                    boxShadow: `
                      0 6px 12px rgba(0,0,0,0.25),
                      0 2px 4px rgba(0,0,0,0.1),
                      inset 0 1px 3px rgba(255,255,255,0.4),
                      inset 0 -2px 3px rgba(0,0,0,0.15)
                    `
                  }}
                >
                  {/* Inner highlight for 3D effect */}
                  <div 
                    className="absolute inset-1 rounded-full"
                    style={{
                      background: playerIndex === 0
                        ? `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.9), transparent 50%)`
                        : `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2), transparent 50%)`
                    }}
                  />
                  
                  {/* Subtle border */}
                  <div 
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: `1px solid ${playerIndex === 0 ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.3)'}`,
                      background: 'transparent'
                    }}
                  />
                </div>
                ))}
                {playerCheckers > 5 && (
                  <div className={`
                    absolute ${isTopHalf ? 'top-1' : 'bottom-1'} right-1
                    bg-blue-600 text-white text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5
                    flex items-center justify-center shadow-lg z-30
                  `}>
                    {playerCheckers}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderBoard = () => {
    if (!game) return null

    return (
      <div className="bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-4 sm:p-6 lg:p-8 rounded-2xl shadow-2xl max-w-6xl mx-auto">
        {/* Board border with wood grain effect */}
        <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 p-3 sm:p-4 rounded-xl shadow-inner">
          <div className="bg-gradient-to-br from-amber-100 to-amber-50 p-4 sm:p-6 rounded-lg">
            
            {/* Top half of board */}
            <div className="flex gap-1 sm:gap-2 h-56 sm:h-64 lg:h-72">
              {/* Points 12-17 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`top-left-${i}`} className="flex-1 min-w-0">
                    {renderPoint(12 + i, true)}
                  </div>
                ))}
              </div>
              
              {/* Center bar */}
              <div className="w-8 sm:w-10 lg:w-12 flex flex-col items-center justify-center px-1">
                <div className="
                  bg-gradient-to-b from-amber-800 to-amber-900 w-full h-48 sm:h-56 lg:h-64 rounded-lg shadow-inner
                  border-2 border-amber-700 flex flex-col items-center justify-center
                  relative overflow-hidden
                ">
                  <div className="text-amber-200 text-xs font-bold mb-2 z-10">BAR</div>
                  {/* Wood grain effect */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform -skew-y-12" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform skew-y-12 translate-y-4" />
                  </div>
                </div>
              </div>
              
              {/* Points 18-23 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`top-right-${i}`} className="flex-1 min-w-0">
                    {renderPoint(18 + i, true)}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Center divider */}
            <div className="h-3 sm:h-4 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 my-2 rounded shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent opacity-30" />
            </div>
            
            {/* Bottom half of board */}
            <div className="flex gap-1 sm:gap-2 h-56 sm:h-64 lg:h-72">
              {/* Points 11-6 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`bottom-left-${i}`} className="flex-1 min-w-0">
                    {renderPoint(11 - i, false)}
                  </div>
                ))}
              </div>
              
              {/* Center bar */}
              <div className="w-8 sm:w-10 lg:w-12 flex flex-col items-center justify-center px-1">
                <div className="
                  bg-gradient-to-b from-amber-800 to-amber-900 w-full h-48 sm:h-56 lg:h-64 rounded-lg shadow-inner
                  border-2 border-amber-700 flex flex-col items-center justify-center
                  relative overflow-hidden
                ">
                  <div className="text-amber-200 text-xs font-bold mt-2 z-10">BAR</div>
                  {/* Wood grain effect */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform -skew-y-12" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform skew-y-12 translate-y-4" />
                  </div>
                </div>
              </div>
              
              {/* Points 5-0 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`bottom-right-${i}`} className="flex-1 min-w-0">
                    {renderPoint(5 - i, false)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Game</h2>
          <p className="text-gray-600 mb-4">{error || 'Game not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const currentPlayer = game.players[game.currentPlayer]
  const isCurrentPlayer = currentPlayer?.userId === user?.id

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Game Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Backgammon Game</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
            >
              Back to Dashboard
            </button>
          </div>

          {/* Players Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className={`p-4 rounded-lg ${game.currentPlayer === 0 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'} flex items-center gap-3`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white via-gray-100 to-gray-200 border border-gray-300 shadow-md"></div>
              <div>
                <h3 className="font-bold text-lg">{game.players[0]?.username || 'Player 1'}</h3>
                <p className="text-sm text-gray-600">Rating: {game.players[0]?.rating || 'N/A'}</p>
                <p className="text-sm text-gray-600">White Checkers</p>
              </div>
            </div>
            <div className={`p-4 rounded-lg ${game.currentPlayer === 1 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'} flex items-center gap-3`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 via-gray-600 to-gray-700 border border-gray-800 shadow-md"></div>
              <div>
                <h3 className="font-bold text-lg">{game.players[1]?.username || 'Player 2'}</h3>
                <p className="text-sm text-gray-600">Rating: {game.players[1]?.rating || 'N/A'}</p>
                <p className="text-sm text-gray-600">Black Checkers</p>
              </div>
            </div>
          </div>

          {/* Game Status */}
          <div className="text-center">
            <p className="text-lg font-semibold">
              {game.gameState === GameStateEnum.WAITING && 'Waiting for opponent...'}
              {game.gameState === GameStateEnum.IN_PROGRESS && (
                isCurrentPlayer ? 'Your turn' : `${currentPlayer?.username}'s turn`
              )}
              {game.gameState === GameStateEnum.FINISHED && 'Game finished'}
            </p>
            {game.dice && game.dice.length === 2 && (
              <p className="text-sm text-gray-600 mt-2">
                Dice: {game.dice[0]}, {game.dice[1]}
              </p>
            )}
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">Game Board</h2>
          {renderBoard()}
        </div>

        {/* Game Actions */}
        <div className="bg-white shadow rounded-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Game Actions</h3>
          <div className="flex space-x-4">
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS}
            >
              Roll Dice
            </button>
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS}
            >
              End Turn
            </button>
            <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
              Resign
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Game
