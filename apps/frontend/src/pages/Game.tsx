import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { gamesAPI } from '../services/api'
import { Game as GameType, GameState as GameStateEnum } from '@playbg/shared'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import socketService from '../services/socketService'
import Dice3D from '../components/Game/Dice3D'
import { isMobile } from '../utils/mobile'

const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)

  const [game, setGame] = useState<GameType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null)
  const [isRollingDice, setIsRollingDice] = useState(false)

  useEffect(() => {
    if (gameId) {
      loadGame();
      socketService.joinGame(gameId);
    }

    const socket = socketService.getSocket();
    if (socket) {
      const handleGameJoined = (data: any) => {
        if (data.gameId === gameId) {
          setGame(data.gameData);
        }
      };

      const handleDiceRoll = (data: any) => {
        if (data.gameId === gameId) {
          setIsRollingDice(false);
          setGame(prevGame => {
            if (!prevGame) return null;
            const updatedGame = {
              ...prevGame,
              dice: data.dice,
              // Keep the current player as is if state.currentPlayer is undefined
              currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
            };

            // Clear selected point when dice are rolled
            setSelectedPoint(null);

            return updatedGame;
          });
        }
      };

      const handleGameMove = (data: any) => {
        if (data.gameId === gameId) {
          setGame(prevGame => {
            if (!prevGame) return null;
            return {
              ...prevGame,
              board: data.state?.board || prevGame.board,
              currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
            };
          });

          // Clear selected point when move is made
          setSelectedPoint(null);
        }
      };

      socket.on('game:joined', handleGameJoined);
      socket.on('game:dice_roll', handleDiceRoll);
      socket.on('game:move', handleGameMove);

      return () => {
        socket.off('game:joined', handleGameJoined);
        socket.off('game:dice_roll', handleDiceRoll);
        socket.off('game:move', handleGameMove);
        if (gameId) {
          socketService.leaveGame(gameId);
        }
      };
    }
  }, [gameId]);

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
      // Select a point if it has checkers belonging to the current player
      const point = game.board.points[pointIndex]
      if (point && point[currentPlayerIndex] > 0) {
        setSelectedPoint(pointIndex)
      }
    } else if (selectedPoint === pointIndex) {
      // Deselect if clicking the same point
      setSelectedPoint(null)
    } else {
      // Try to make a move
      if (validDestinations.has(pointIndex) && gameId) {
        // Make the move (backend will add playerId and timestamp)
        const move = {
          from: selectedPoint,
          to: pointIndex
        }

        socketService.makeMove(gameId, move)
        setSelectedPoint(null)
      } else {
        // Invalid move, deselect
        setSelectedPoint(null)
      }
    }
  }

  const handleRollDice = () => {
    if (gameId) {
      setIsRollingDice(true);
      socketService.rollDice(gameId);
    }
  };

  // Calculate valid destination points for the selected point
  const validDestinations = useMemo(() => {
    if (selectedPoint === null || !game?.dice) return new Set<number>()

    const currentPlayerIndex = game.players.findIndex(p => p.userId === user?.id)
    if (currentPlayerIndex === -1) return new Set<number>()

    const validTargets = new Set<number>()
    const dice = game.dice

    // Calculate possible destinations based on dice values
    dice.forEach(diceValue => {
      let targetPoint: number

      if (currentPlayerIndex === 0) {
        // Player 0 moves counter-clockwise (decreasing point numbers)
        targetPoint = selectedPoint - diceValue
      } else {
        // Player 1 moves clockwise (increasing point numbers)
        targetPoint = selectedPoint + diceValue
      }

      // Check if target point is valid (within board bounds)
      if (targetPoint >= 0 && targetPoint < 24) {
        // Basic validation: check if opponent has more than 1 checker
        const opponentIndex = 1 - currentPlayerIndex
        const opponentCheckers = game.board.points[targetPoint][opponentIndex]

        if (opponentCheckers <= 1) {
          validTargets.add(targetPoint)
        }
      }
    })

    return validTargets
  }, [selectedPoint, game?.dice, game?.board, user?.id, game?.players])

  const renderPoint = (pointIndex: number, isTopHalf: boolean) => {
    const point = game?.board.points[pointIndex]
    const isSelected = selectedPoint === pointIndex
    const isValidDestination = validDestinations.has(pointIndex)
    
    // Determine point color (alternating pattern)
    const isEvenPoint = pointIndex % 2 === 0
    const pointColorClass = isEvenPoint 
      ? 'from-amber-100 to-amber-200' 
      : 'from-amber-800 to-amber-900'
    
    const pointHandlers = {
      onClick: () => handlePointClick(pointIndex),
      ...(isMobile() && { onTouchEnd: (e: React.TouchEvent) => {
        e.preventDefault()
        handlePointClick(pointIndex)
      }}),
    }

    return (
      <div
        key={`point-${pointIndex}`}
        className={`
          relative flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center h-full
          cursor-pointer transition-all duration-300 ease-out
          ${isSelected ? 'scale-110 z-20' : 'hover:scale-105 hover:z-10'}
          ${isSelected ? 'animate-pulse' : ''}
          ${isValidDestination ? 'ring-2 ring-green-400 ring-opacity-75' : ''}
        `}
        {...pointHandlers}
      >
        {/* Point triangle */}
        <div
          className={`
            absolute inset-0 transition-all duration-200
            ${isSelected ? 'ring-4 ring-blue-400 ring-opacity-75' : ''}
            ${isValidDestination ? 'ring-4 ring-green-400 ring-opacity-75' : ''}
          `}
          style={{
            background: `linear-gradient(to bottom, ${pointColorClass.includes('amber-100') ? '#fef3c7, #fde68a' : '#92400e, #78350f'})`,
            clipPath: isTopHalf 
              ? 'polygon(50% 100%, 0% 0%, 100% 0%)'
              : 'polygon(0% 100%, 100% 100%, 50% 0%)',
            boxShadow: isSelected ? 'inset 0 0 20px rgba(59, 130, 246, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
        
        {/* Checkers */}        <div className={`
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
                    relative w-4 h-4 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-9 xl:h-9 rounded-full transition-all duration-300 ease-out
                    ${checkerIndex === 0 ? '' : '-mt-0.5 sm:-mt-1'}
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
                    absolute ${isTopHalf ? 'top-0.5' : 'bottom-0.5'} right-0.5 sm:${isTopHalf ? 'top-1' : 'bottom-1'} sm:right-1
                    bg-blue-600 text-white text-xs font-bold rounded-full w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5
                    flex items-center justify-center shadow-lg z-30
                  `}>
                    {playerCheckers}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Valid destination indicator */}
        {isValidDestination && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="w-6 h-6 bg-green-500 rounded-full opacity-75 animate-ping"></div>
            <div className="absolute w-4 h-4 bg-green-400 rounded-full"></div>
          </div>
        )}
      </div>
    )
  }
  const renderBoard = () => {
    if (!game) return null

    const isCurrentPlayer = game.players[game.currentPlayer]?.userId === user?.id

    return (
      <div className="bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-2 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl shadow-2xl w-full mx-auto">
        {/* Board border with wood grain effect */}
        <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 p-2 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl shadow-inner">
          <div className="bg-gradient-to-br from-amber-100 to-amber-50 p-2 sm:p-4 lg:p-6 rounded-md sm:rounded-lg">
            
            {/* Top numbers */}
            <div className="flex text-xs font-bold text-amber-900 opacity-50 mb-1">
              <div className="flex-1 flex justify-around">
                {Array.from({ length: 6 }, (_, i) => 13 + i).map(num => <div key={num} className="w-8 text-center">{num}</div>)}
              </div>
              <div className="w-6 sm:w-8 lg:w-10 xl:w-12" />
              <div className="flex-1 flex justify-around">
                {Array.from({ length: 6 }, (_, i) => 19 + i).map(num => <div key={num} className="w-8 text-center">{num}</div>)}
              </div>
            </div>

            {/* Top half of board */}
            <div className="flex gap-0.5 sm:gap-1 lg:gap-2 h-32 sm:h-48 lg:h-64 xl:h-72">
              {/* Points 12-17 */}
              <div className="flex gap-0.5 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`top-left-${i}`} className="flex-1 min-w-0">
                    {renderPoint(12 + i, true)}
                  </div>
                ))}
              </div>
              
              {/* Center bar with dice */}
              <div className="w-6 sm:w-8 lg:w-10 xl:w-12 flex flex-col items-center justify-center px-0.5 sm:px-1">
                <div className="
                  bg-gradient-to-b from-amber-800 to-amber-900 w-full h-28 sm:h-44 lg:h-56 xl:h-64 rounded-md sm:rounded-lg shadow-inner
                  border border-amber-700 sm:border-2 flex flex-col items-center justify-center
                  relative overflow-hidden
                ">
                  <div className="text-amber-200 text-xs font-bold mb-1 sm:mb-2 z-10">BAR</div>

                  {/* Dice display */}
                  {game?.dice && game.dice.length === 2 ? (
                    <div className="flex flex-col gap-1 z-20">
                      <Dice3D value={game.dice[0]} size="sm" isRolling={isRollingDice} />
                      <Dice3D value={game.dice[1]} size="sm" isRolling={isRollingDice} />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 z-20">
                      <div
                        className={`
                          w-8 h-8 bg-white rounded-lg shadow-lg border border-gray-300 cursor-pointer
                          transition-all duration-200 hover:scale-110 hover:shadow-xl
                          flex items-center justify-center text-gray-400 font-bold text-xs
                          ${isCurrentPlayer && game.gameState === 'in_progress' ? 'hover:bg-blue-50 hover:border-blue-300' : 'cursor-not-allowed opacity-50'}
                          ${isRollingDice ? 'animate-spin' : ''}
                        `}
                        onClick={() => {
                          if (isCurrentPlayer && game.gameState === 'in_progress' && !isRollingDice) {
                            handleRollDice();
                          }
                        }}
                      >
                        ?
                      </div>
                      <div
                        className={`
                          w-8 h-8 bg-white rounded-lg shadow-lg border border-gray-300 cursor-pointer
                          transition-all duration-200 hover:scale-110 hover:shadow-xl
                          flex items-center justify-center text-gray-400 font-bold text-xs
                          ${isCurrentPlayer && game.gameState === 'in_progress' ? 'hover:bg-blue-50 hover:border-blue-300' : 'cursor-not-allowed opacity-50'}
                          ${isRollingDice ? 'animate-spin' : ''}
                        `}
                        onClick={() => {
                          if (isCurrentPlayer && game.gameState === 'in_progress' && !isRollingDice) {
                            handleRollDice();
                          }
                        }}
                      >
                        ?
                      </div>
                    </div>
                  )}

                  {/* Wood grain effect */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform -skew-y-12" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform skew-y-12 translate-y-2 sm:translate-y-4" />
                  </div>
                </div>
              </div>
              
              {/* Points 18-23 */}
              <div className="flex gap-0.5 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`top-right-${i}`} className="flex-1 min-w-0">
                    {renderPoint(18 + i, true)}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Center divider */}
            <div className="h-2 sm:h-3 lg:h-4 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 my-1 sm:my-2 rounded shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent opacity-30" />
            </div>
            
            {/* Bottom half of board */}
            <div className="flex gap-0.5 sm:gap-1 lg:gap-2 h-32 sm:h-48 lg:h-64 xl:h-72">
              {/* Points 11-6 */}
              <div className="flex gap-0.5 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`bottom-left-${i}`} className="flex-1 min-w-0">
                    {renderPoint(11 - i, false)}
                  </div>
                ))}
              </div>
              
              {/* Center bar */}
              <div className="w-6 sm:w-8 lg:w-10 xl:w-12 flex flex-col items-center justify-center px-0.5 sm:px-1">
                <div className="
                  bg-gradient-to-b from-amber-800 to-amber-900 w-full h-28 sm:h-44 lg:h-56 xl:h-64 rounded-md sm:rounded-lg shadow-inner
                  border border-amber-700 sm:border-2 flex flex-col items-center justify-center
                  relative overflow-hidden
                ">
                  <div className="text-amber-200 text-xs font-bold mt-1 sm:mt-2 z-10">BAR</div>
                  {/* Wood grain effect */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform -skew-y-12" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform skew-y-12 translate-y-2 sm:translate-y-4" />
                  </div>
                </div>
              </div>
              
              {/* Points 5-0 */}
              <div className="flex gap-0.5 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`bottom-right-${i}`} className="flex-1 min-w-0">
                    {renderPoint(5 - i, false)}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom numbers */}
            <div className="flex text-xs font-bold text-amber-900 opacity-50 mt-1">
              <div className="flex-1 flex justify-around">
                {Array.from({ length: 6 }, (_, i) => 12 - i).map(num => <div key={num} className="w-8 text-center">{num}</div>)}
              </div>
              <div className="w-6 sm:w-8 lg:w-10 xl:w-12" />
              <div className="flex-1 flex justify-around">
                {Array.from({ length: 6 }, (_, i) => 6 - i).map(num => <div key={num} className="w-8 text-center">{num}</div>)}
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
      <div className="max-w-7xl mx-auto py-2 sm:py-4 lg:py-6 px-2 sm:px-4">
        {/* Game Header */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-4 lg:p-6 mb-3 sm:mb-4 lg:mb-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Your turn</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-2 sm:py-2 sm:px-4 rounded text-sm sm:text-base"
            >
              Back
            </button>
          </div>

          {/* Players Info */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div className={`p-2 sm:p-3 lg:p-4 rounded-lg ${game.currentPlayer === 0 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'} flex items-center gap-2 sm:gap-3`}>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-white via-gray-100 to-gray-200 border border-gray-300 shadow-md flex-shrink-0"></div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base lg:text-lg truncate">{game.players[0]?.username || 'Player 1'}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{game.players[0]?.rating || 'N/A'}</p>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">White Checkers</p>
              </div>
            </div>
            <div className={`p-2 sm:p-3 lg:p-4 rounded-lg ${game.currentPlayer === 1 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'} flex items-center gap-2 sm:gap-3`}>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gray-800 via-gray-600 to-gray-700 border border-gray-800 shadow-md flex-shrink-0"></div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base lg:text-lg truncate">{game.players[1]?.username || 'Player 2'}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{game.players[1]?.rating || 'N/A'}</p>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">Black Checkers</p>
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
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white shadow rounded-lg p-2 sm:p-4 lg:p-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-4 text-center">Game Board</h2>
          {renderBoard()}
        </div>

        {/* Game Actions */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-4 lg:p-6 mt-3 sm:mt-4 lg:mt-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Actions</h3>
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4 sm:gap-0">
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 text-sm sm:text-base"
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS}
            >
              End Turn
            </button>
            <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm sm:text-base">
              Resign
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {!game?.dice ? 'Click the dice on the board to roll them!' :
             isCurrentPlayer ? 'Click a checker to move it automatically. First move uses the higher dice value.' :
             "Waiting for opponent's move..."}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Game
