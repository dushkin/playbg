import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { gamesAPI } from '../services/api'
import { Game as GameType, GameState as GameStateEnum } from '@playbg/shared'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import socketService from '../services/socketService'
import Dice3D from '../components/Game/Dice3D'
import toast from 'react-hot-toast'

const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)

  const [game, setGame] = useState<GameType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRollingDice, setIsRollingDice] = useState(false)
  const [usedDice, setUsedDice] = useState<boolean[]>([])
  const [, setOptimisticMoveId] = useState<string | null>(null)
  const optimisticMoveRef = useRef<string | null>(null)
  const pendingOptimisticMoves = useRef<Set<string>>(new Set())
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState<boolean>(false)
  const [movesMadeThisTurn, setMovesMadeThisTurn] = useState<Array<{from: number, to: number, diceValue: number}>>([])
  const [originalBoardState, setOriginalBoardState] = useState<any>(null)
  const [turnSubmitted, setTurnSubmitted] = useState<boolean>(false)
  const hydratedFromSocket = useRef(false)

  useEffect(() => {
    if (gameId) {
      // Join socket first so we can hydrate with live state before API
      socketService.joinGame(gameId);
      loadGame();
    }

    const socket = socketService.getSocket();
    if (socket) {
      const handleGameJoined = (data: any) => {
        if (data.gameId === gameId) {
          const joinedState = data.state || data.gameData;
          if (joinedState) {
            setGame(joinedState);
            setError(null);
            hydratedFromSocket.current = true;
            setIsLoading(false);
          }
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

            // Initialize dice usage tracking
            if (data.dice && data.dice[0] === data.dice[1]) {
              // Doubles: 4 moves
              setUsedDice([false, false, false, false]);
            } else if (data.dice) {
              // Regular: 2 moves
              setUsedDice([false, false]);
            } else {
              setUsedDice([]);
            }

            // Mark that current player has rolled this turn
            if (data.playerId === user?.id) {
              setHasRolledThisTurn(true)
              setTurnSubmitted(false)
              setMovesMadeThisTurn([])
              // Save original board state for potential reset
              setOriginalBoardState(prevGame ? JSON.parse(JSON.stringify(prevGame.board)) : null)
            }


            return updatedGame;
          });
        }
      };

      const handleGameMove = (data: any) => {
        console.log('📨 Server move response:', data)
        if (data.gameId === gameId) {
          const isOurMove = data.playerId === user?.id

          // Check if this is our optimistic move being confirmed
          if (data.move && isOurMove) {
            const serverMoveId = `${data.move.from}-${data.move.to}`
            const isOptimisticConfirmation = pendingOptimisticMoves.current.has(serverMoveId)

            if (isOptimisticConfirmation) {
              console.log('✅ Confirmed optimistic move, cleaning up')
              pendingOptimisticMoves.current.delete(serverMoveId)

              if (optimisticMoveRef.current === serverMoveId) {
                setOptimisticMoveId(null)
                optimisticMoveRef.current = null
              }

              // Just update turn state for our confirmed moves, keep board as-is
              setGame(prevGame => {
                if (!prevGame) return null;
                return {
                  ...prevGame,
                  currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
                  dice: data.state?.dice || prevGame.dice,
                };
              });

              // Handle turn changes
              const currentPlayerIndex = (game?.players || []).findIndex(p => p.userId === user?.id)
              if (data.state?.currentPlayer !== undefined && currentPlayerIndex !== -1) {
                const isNowMyTurn = data.state.currentPlayer === currentPlayerIndex
                console.log('🔄 Turn change detected:', {
                  currentPlayerIndex,
                  gameCurrentPlayer: data.state.currentPlayer,
                  isNowMyTurn,
                  dice: data.state.dice,
                  prevHasRolledThisTurn: hasRolledThisTurn,
                  prevTurnSubmitted: turnSubmitted
                })

                // Only reset dice roll state when it becomes our turn
                if (isNowMyTurn) {
                  // Check if dice were already rolled for this turn
                  const diceAlreadyRolled = data.state.dice && data.state.dice.length === 2
                  console.log('🎲 Setting turn state for new turn:', {
                    diceAlreadyRolled,
                    diceValues: data.state.dice,
                    willSetHasRolledThisTurn: diceAlreadyRolled || false
                  })

                  setHasRolledThisTurn(diceAlreadyRolled || false)
                  setTurnSubmitted(false)
                  setMovesMadeThisTurn([])
                  setOriginalBoardState(null)
                  setIsRollingDice(false)

                  // Initialize dice usage state if dice are already rolled
                  if (diceAlreadyRolled) {
                    if (data.state.dice[0] === data.state.dice[1]) {
                      setUsedDice([false, false, false, false]) // Doubles
                      console.log('🎲 Initialized doubles dice usage state')
                    } else {
                      setUsedDice([false, false]) // Regular
                      console.log('🎲 Initialized regular dice usage state')
                    }
                  } else {
                    setUsedDice([])
                    console.log('🎲 Cleared dice usage state (no dice rolled yet)')
                  }
                }
              }

              if (data.state?.gameState === 'finished') {
                setTimeout(() => checkForNextGameOrDashboard(), 3000);
              }
              return;
            }
          }

          // For all other moves (opponent moves or non-optimistic updates), apply full server state
          console.log('📋 Applying server update for', isOurMove ? 'our non-optimistic' : 'opponent', 'move')

          // Capture current game state before update for dice tracking
          const gameBeforeUpdate = game;

          setGame(prevGame => {
            if (!prevGame) return null;

            const ourIndex = (prevGame.players || []).findIndex(p => p.userId === user?.id);

            // Apply full server state if available, otherwise preserve previous state
            const updatedGame = data.state ? {
              ...prevGame,
              ...data.state,
              // Ensure we preserve properties that might not be in the update
              id: prevGame.id,
              players: data.state.players || prevGame.players,
            } : prevGame;

            console.log('🎮 Game state update:', {
              previousCurrentPlayer: prevGame.currentPlayer,
              newCurrentPlayer: updatedGame.currentPlayer,
              dataStateCurrentPlayer: data.state?.currentPlayer,
              prevDice: prevGame.dice,
              newDice: updatedGame.dice,
              ourIndex
            });

            // If opponent just moved and it's now our turn, reset our turn state
            if (!isOurMove && updatedGame.currentPlayer === ourIndex) {
              // Reset turn state when it becomes our turn
              setHasRolledThisTurn(false);
              setTurnSubmitted(false);
              setMovesMadeThisTurn([]);
              setUsedDice([]);
              setIsRollingDice(false);
              console.log('🔄 Reset turn state - it\'s now our turn');
            }

            return updatedGame;
          });

          // Track opponent dice usage for client-side turn switching
          if (data.move && gameBeforeUpdate?.dice && !isOurMove) {
            const distance = Math.abs(data.move.to - data.move.from);
            const dice = gameBeforeUpdate.dice;
            const isDoubles = dice[0] === dice[1];

            console.log('🎲 Tracking opponent dice usage:', {
              move: data.move,
              distance,
              dice,
              isDoubles,
              currentUsedDice: usedDice
            });

            setUsedDice(prev => {
              const newUsed = [...prev];
              if (isDoubles) {
                const firstAvailable = newUsed.findIndex(used => !used);
                if (firstAvailable !== -1) {
                  newUsed[firstAvailable] = true;
                }
              } else {
                if (distance === dice[0] && !newUsed[0]) {
                  newUsed[0] = true;
                } else if (distance === dice[1] && !newUsed[1]) {
                  newUsed[1] = true;
                }
              }

              // Check if all dice are now used after this move
              const allDiceUsed = newUsed.every(used => used);
              console.log('🎲 Dice usage after opponent move:', { newUsed, allDiceUsed, isDoubles });

              // If all dice are used, the turn should switch
              if (allDiceUsed && gameBeforeUpdate) {
                const ourIndex = (gameBeforeUpdate.players || []).findIndex(p => p.userId === user?.id);
                console.log('✅ All opponent dice used, turn should switch to us', { ourIndex, currentPlayer: gameBeforeUpdate.currentPlayer });

                // Force game state update to switch turns
                setTimeout(() => {
                  setGame(prevGame => {
                    if (!prevGame) return null;

                    // Only switch if server hasn't already switched
                    if (prevGame.currentPlayer !== ourIndex) {
                      console.log('🔄 Client-side turn correction: switching currentPlayer from', prevGame.currentPlayer, 'to', ourIndex);
                      return {
                        ...prevGame,
                        currentPlayer: ourIndex as 0 | 1,
                        dice: null, // Clear dice for new turn
                      };
                    }
                    return prevGame;
                  });

                  // Reset turn state
                  setHasRolledThisTurn(false);
                  setTurnSubmitted(false);
                  setMovesMadeThisTurn([]);
                  setUsedDice([]);
                  setIsRollingDice(false);
                  console.log('🔄 Reset turn state after client-side turn correction');
                }, 100); // Small delay to let server update arrive first if it's coming
              }

              return newUsed;
            });
          } else if (data.move && !isOurMove) {
            console.log('⚠️ Cannot track opponent dice - dice is null:', {
              hasMove: !!data.move,
              gameBeforeUpdateDice: gameBeforeUpdate?.dice,
              dataStateDice: data.state?.dice,
              isOurMove
            });
          }

          // Handle turn changes
          const currentPlayerIndex = (game?.players || []).findIndex(p => p.userId === user?.id)
          if (data.state?.currentPlayer !== undefined && currentPlayerIndex !== -1) {
            const isNowMyTurn = data.state.currentPlayer === currentPlayerIndex
            console.log('🔄 [Socket] Turn change detected:', {
              currentPlayerIndex,
              gameCurrentPlayer: data.state.currentPlayer,
              isNowMyTurn,
              dice: data.state.dice,
              prevHasRolledThisTurn: hasRolledThisTurn,
              prevTurnSubmitted: turnSubmitted
            })

            // Only reset dice roll state when it becomes our turn
            if (isNowMyTurn) {
              // Check if dice were already rolled for this turn
              const diceAlreadyRolled = data.state.dice && data.state.dice.length === 2
              console.log('🎲 [Socket] Setting turn state for new turn:', {
                diceAlreadyRolled,
                diceValues: data.state.dice,
                willSetHasRolledThisTurn: diceAlreadyRolled || false
              })

              setHasRolledThisTurn(diceAlreadyRolled || false)
              setTurnSubmitted(false)
              setMovesMadeThisTurn([])
              setOriginalBoardState(null)
              setIsRollingDice(false)

              // Initialize dice usage state if dice are already rolled
              if (diceAlreadyRolled) {
                if (data.state.dice[0] === data.state.dice[1]) {
                  setUsedDice([false, false, false, false]) // Doubles
                  console.log('🎲 [Socket] Initialized doubles dice usage state')
                } else {
                  setUsedDice([false, false]) // Regular
                  console.log('🎲 [Socket] Initialized regular dice usage state')
                }
              } else {
                setUsedDice([])
                console.log('🎲 [Socket] Cleared dice usage state (no dice rolled yet)')
              }
            }
          }

          if (data.state?.gameState === 'finished') {
            setTimeout(() => checkForNextGameOrDashboard(), 3000);
          }
        }
      };

      const handlePlayerJoined = (data: any) => {
        if (data.gameId === gameId) {
          setGame(prevGame => {
            if (!prevGame) return null;
            return {
              ...prevGame,
              players: data.state?.players || prevGame.players,
              gameState: data.state?.gameState || prevGame.gameState,
              currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
              board: data.state?.board || prevGame.board,
            };
          });
        }
      };

      const handleGameCompleted = (data: any) => {
        if (data.gameId === gameId) {
          console.log('🏆 [Socket] Game completed!', data);
          setGame(prevGame => {
            if (!prevGame) return null;
            return {
              ...prevGame,
              gameState: GameStateEnum.FINISHED,
              winner: data.winner,
              endTime: data.timestamp,
              board: data.state?.board || prevGame.board,
              currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
              dice: data.state?.dice !== undefined ? data.state.dice : prevGame.dice,
            } as GameType;
          });
          // Navigate to dashboard after a short delay
          setTimeout(() => checkForNextGameOrDashboard(), 3000);
        }
      };

      socket.on('game:joined', handleGameJoined);
      socket.on('game:dice_roll', handleDiceRoll);
      socket.on('game:move', handleGameMove);
      socket.on('game:player_joined', handlePlayerJoined);
      socket.on('game:completed', handleGameCompleted);

      return () => {
        socket.off('game:joined', handleGameJoined);
        socket.off('game:dice_roll', handleDiceRoll);
        socket.off('game:move', handleGameMove);
        socket.off('game:player_joined', handlePlayerJoined);
        socket.off('game:completed', handleGameCompleted);
        if (gameId) {
          socketService.leaveGame(gameId);
        }
      };
    }
  }, [gameId]);

  const loadGame = async (retryCount = 0) => {
    if (!gameId) return

    if (hydratedFromSocket.current) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      console.log(`🎮 Loading game ${gameId} (attempt ${retryCount + 1})`)
      const response = await gamesAPI.getGame(gameId)

      if (response.success && response.data) {
        const apiData = response.data
        // API returns game doc plus a nested state with live board/currentPlayer/dice
        const mergedApi = (apiData as any).state ? { ...apiData, ...(apiData as any).state } : apiData
        console.log('🎮 Loaded game from API:', apiData)

        // If socket already hydrated, preserve live board/currentPlayer/dice from current state
        const targetGame = hydratedFromSocket.current && game
          ? { ...mergedApi, board: game.board ?? mergedApi.board, currentPlayer: (game as any).currentPlayer ?? mergedApi.currentPlayer, dice: game.dice ?? mergedApi.dice }
          : mergedApi

        setGame(targetGame)
        setError(null) // Clear any previous errors

        // Initialize dice state based on the final target game data
        if (targetGame.dice && targetGame.dice.length === 2) {
          setHasRolledThisTurn(true)
          if (targetGame.dice[0] === targetGame.dice[1]) {
            setUsedDice([false, false, false, false]) // Doubles
          } else {
            setUsedDice([false, false]) // Regular
          }
        } else {
          setHasRolledThisTurn(false)
          setUsedDice([])
        }
      } else {
        setError(response.error || 'Failed to load game')
      }
    } catch (err: any) {
      console.error('Error loading game data:', err)

      const isNetworkError = err?.code === 'ERR_NETWORK' || err?.message === 'Network Error'
      const maxRetries = 3

      if (isNetworkError && retryCount < maxRetries && !hydratedFromSocket.current) {
        console.log(`🔄 Network error, retrying in ${(retryCount + 1) * 2}s... (${retryCount + 1}/${maxRetries})`)
        setTimeout(() => {
          loadGame(retryCount + 1)
        }, (retryCount + 1) * 2000) // Progressive delay: 2s, 4s, 6s
      } else {
        const errorMsg = isNetworkError
          ? 'Connection lost. Please check your internet connection and try again.'
          : 'Failed to load game data. Please try refreshing the page.'
        if (!hydratedFromSocket.current) setError(errorMsg)
      }
    } finally {
      if (retryCount === 0) { // Only set loading to false on the initial attempt
        setIsLoading(false)
      }
    }
  }

  const resetMovesThisTurn = () => {
    if (originalBoardState && game) {
      console.log('🔄 Resetting moves this turn')
      setGame(prevGame => {
        if (!prevGame) return null
        return {
          ...prevGame,
          board: JSON.parse(JSON.stringify(originalBoardState))
        }
      })
      setMovesMadeThisTurn([])

      // Reset dice usage properly based on dice type
      if (game.dice && game.dice.length === 2) {
        const isDoubles = game.dice[0] === game.dice[1]
        if (isDoubles) {
          setUsedDice([false, false, false, false]) // Reset doubles
        } else {
          setUsedDice([false, false]) // Reset regular dice
        }
      } else {
        setUsedDice([])
      }
    }
  }

  const handleBarClick = () => {
    console.log('🎯 Bar clicked')
    if (!game || game.gameState !== GameStateEnum.IN_PROGRESS) {
      console.log('❌ Game not in progress')
      return
    }

    if (turnSubmitted) {
      console.log('❌ Turn already submitted')
      return
    }

    const currentPlayerIndex = (game.players || []).findIndex(p => p.userId === user?.id)
    if (currentPlayerIndex !== game.currentPlayer) {
      console.log('❌ Not current player turn')
      return
    }

    // Check if player has checkers on bar
    if (game.board.bar[currentPlayerIndex] === 0) {
      console.log('❌ No checkers on bar')
      return
    }

    if (availableDiceValues.length === 0) {
      console.log('❌ No available dice values')
      return
    }

    // Try to find a valid bar entry move
    const isDoubles = game.dice && game.dice[0] === game.dice[1]
    let bestMove: { from: number; to: number; diceValue: number } | null = null

    for (const diceValue of availableDiceValues) {
      // BOTH players enter from point 24 moving towards point 1
      const targetPoint = 24 - diceValue

      if (isValidBarMove(targetPoint, diceValue, currentPlayerIndex)) {
        bestMove = { from: -1, to: targetPoint, diceValue }
        console.log('✅ Found valid bar move:', bestMove)
        break
      }
    }

    if (bestMove && gameId) {
      console.log('🚀 Making bar move locally:', bestMove)
      executeOptimisticMove(bestMove, currentPlayerIndex, isDoubles)
    } else {
      console.log('❌ No valid bar move found')
    }
  }

  const executeOptimisticMove = (
    bestMove: { from: number; to: number; diceValue: number },
    currentPlayerIndex: number,
    isDoubles: boolean | null
  ) => {
    // Track this move for potential submission
    setMovesMadeThisTurn(prev => [...prev, bestMove])

    // Optimistic update: immediately update the UI
    setGame(prevGame => {
      if (!prevGame) return null

      console.log('🎮 Optimistic update - Move type:',
        bestMove.from === -1 ? 'Bar move' : bestMove.to === -1 ? 'Bear off' : 'Regular move')

      const newBoard = { ...prevGame.board }
      newBoard.points = prevGame.board.points.map(point => [...point])
      newBoard.bar = [...prevGame.board.bar]
      newBoard.off = [...prevGame.board.off]

      const opponentIndex = 1 - currentPlayerIndex

      if (bestMove.from === -1) {
        // Bar move: move from bar to board
        console.log('🎮 Bar move: moving to point', bestMove.to)
        newBoard.bar[currentPlayerIndex]--

        // Handle hitting opponent checker at destination
        if (newBoard.points[bestMove.to][opponentIndex] === 1) {
          newBoard.points[bestMove.to][opponentIndex] = 0
          newBoard.bar[opponentIndex]++
          console.log('🎮 Hit opponent checker, sent to bar')
        }

        newBoard.points[bestMove.to][currentPlayerIndex]++
      } else if (bestMove.to === -1) {
        // Bear off move: move from board to off
        console.log('🎮 Bear off: removing from point', bestMove.from)
        newBoard.points[bestMove.from][currentPlayerIndex]--
        newBoard.off[currentPlayerIndex]++
      } else {
        // Regular move: move from one point to another
        console.log('🎮 Regular move:', bestMove.from, '→', bestMove.to)
        newBoard.points[bestMove.from][currentPlayerIndex]--

        // Handle hitting opponent checker at destination
        if (newBoard.points[bestMove.to][opponentIndex] === 1) {
          newBoard.points[bestMove.to][opponentIndex] = 0
          newBoard.bar[opponentIndex]++
          console.log('🎮 Hit opponent checker, sent to bar')
        }

        newBoard.points[bestMove.to][currentPlayerIndex]++
      }

      return { ...prevGame, board: newBoard }
    })

    // Update dice usage optimistically
    setUsedDice(prev => {
      console.log('🎲 Before dice usage update:', prev)
      const newUsed = [...prev]
      if (isDoubles) {
        // For doubles, mark first available die as used
        const firstAvailable = newUsed.findIndex(used => !used)
        console.log('🎲 First available die index:', firstAvailable)
        if (firstAvailable !== -1) {
          newUsed[firstAvailable] = true
        }
      } else {
        // For regular dice, mark the appropriate die as used
        if (bestMove.diceValue === game!.dice![0] && !newUsed[0]) {
          newUsed[0] = true
        } else if (bestMove.diceValue === game!.dice![1] && !newUsed[1]) {
          newUsed[1] = true
        }
      }
      console.log('🎲 After dice usage update:', newUsed)
      return newUsed
    })
  }

  const handlePointClick = (pointIndex: number) => {
    console.log('🎯 Point clicked:', pointIndex)
    if (!game || game.gameState !== GameStateEnum.IN_PROGRESS) {
      console.log('❌ Game not in progress')
      return
    }

    // Check if turn was already submitted
    if (turnSubmitted) {
      console.log('❌ Turn already submitted')
      return
    }

    // Check if it's the current player's turn
    const currentPlayerIndex = (game.players || []).findIndex(p => p.userId === user?.id)
    console.log('👤 Current player index:', currentPlayerIndex, 'Game current player:', game.currentPlayer)
    if (currentPlayerIndex !== game.currentPlayer) {
      console.log('❌ Not current player turn - resetting moves')
      resetMovesThisTurn()
      return
    }

    // Check if there are available dice values
    console.log('🎲 Available dice values:', availableDiceValues)
    if (availableDiceValues.length === 0) {
      console.log('❌ No available dice values')
      // If we have moves made this turn, clicking when no dice available should reset
      if (movesMadeThisTurn.length > 0) {
        console.log('🔄 Resetting moves - clicked with no available dice')
        resetMovesThisTurn()
      }
      return
    }

    // If player has checkers on bar, they must move from bar first
    if (game.board.bar[currentPlayerIndex] > 0) {
      console.log('❌ Must move checkers from bar first - use handleBarClick or click on bar')
      handleBarClick()
      return
    }

    // Debug: Show all points with current player's checkers
    const pointsWithMyCheckers = game.board.points
      .map((point, index) => ({ index, checkers: point[currentPlayerIndex] }))
      .filter(p => p.checkers > 0)
    console.log('🔍 Points with my checkers:', pointsWithMyCheckers)

    // Check if the clicked point has checkers belonging to the current player
    const point = game.board.points[pointIndex]
    console.log('📍 Point data:', point, 'Current player checkers:', point?.[currentPlayerIndex])
    if (!point || point[currentPlayerIndex] === 0) {
      console.log('❌ No checkers for current player at this point')
      console.log('💡 Try clicking on points:', pointsWithMyCheckers.map(p => p.index).join(', '))

      // If we have moves made this turn, clicking on opponent/empty point should reset
      if (movesMadeThisTurn.length > 0) {
        console.log('🔄 Resetting moves - clicked on opponent/empty point')
        resetMovesThisTurn()
      }
      return
    }

    // Try to find a valid move with any available dice value
    const isDoubles = game.dice && game.dice[0] === game.dice[1]
    let bestMove: { from: number; to: number; diceValue: number } | null = null

    console.log('🎲 Dice:', game.dice, 'Is doubles:', isDoubles)

    for (const diceValue of availableDiceValues) {
      let targetPoint: number

      // Regular move calculation - BOTH players move in same direction (24→1)
      // Player 0 moves counter-clockwise (decreasing point numbers)
      // Player 1 NOW ALSO moves counter-clockwise (decreasing point numbers)
      targetPoint = pointIndex - diceValue

      console.log(`🎯 Trying dice ${diceValue}: ${pointIndex} → ${targetPoint}`)

      // Check for bearing off
      if (targetPoint < 0 || targetPoint >= 24) {
        if (isValidBearOffMove(pointIndex, diceValue, currentPlayerIndex)) {
          bestMove = { from: pointIndex, to: -1, diceValue } // to: -1 indicates bear off
          console.log('✅ Found valid bear off move:', bestMove)
          break
        }
        continue
      }

      // Regular move validation
      if (isValidMove(pointIndex, targetPoint, diceValue, currentPlayerIndex)) {
        bestMove = { from: pointIndex, to: targetPoint, diceValue }
        console.log('✅ Found valid regular move:', bestMove)
        break // Use the first valid move found
      }
    }

    if (bestMove && gameId) {
      console.log('🚀 Making move locally:', bestMove)
      executeOptimisticMove(bestMove, currentPlayerIndex, isDoubles)
    } else if (!bestMove) {
      console.log('❌ No valid move found')
    } else if (!gameId) {
      console.log('❌ No game ID')
    }
  }

  const handleDiceClick = () => {
    console.log('🎲 Dice click attempt:', {
      gameId: !!gameId,
      isCurrentPlayer,
      hasRolledThisTurn,
      turnSubmitted,
      isRollingDice,
      movesMadeThisTurnLength: movesMadeThisTurn.length,
      gameState: game?.gameState,
      gameDice: game?.dice,
      usedDice
    })

    // Prevent rolling dice if game is not in progress
    if (game?.gameState !== GameStateEnum.IN_PROGRESS) {
      console.log('🎲 ❌ Cannot roll dice: Game is not in progress')
      return
    }

    if (gameId && isCurrentPlayer) {
      // If dice are already rolled and we have moves made, reset and swap dice order
      if (hasRolledThisTurn && movesMadeThisTurn.length > 0 && !turnSubmitted && game?.dice) {
        console.log('🔄 Resetting moves and swapping dice order due to dice click')
        resetMovesThisTurn()

        // Swap dice order (only if not doubles)
        if (game.dice[0] !== game.dice[1]) {
          const swappedDice: [number, number] = [game.dice[1], game.dice[0]]
          console.log('🔄 Swapping dice order:', game.dice, '→', swappedDice)
          setGame(prevGame => {
            if (!prevGame) return null
            return {
              ...prevGame,
              dice: swappedDice
            } as GameType
          })
        }
        return
      }

      // If dice are already rolled but no moves made, just swap dice order
      if (hasRolledThisTurn && movesMadeThisTurn.length === 0 && !turnSubmitted && game?.dice) {
        // Swap dice order (only if not doubles)
        if (game.dice[0] !== game.dice[1]) {
          const swappedDice: [number, number] = [game.dice[1], game.dice[0]]
          console.log('🔄 Swapping dice order:', game.dice, '→', swappedDice)
          setGame(prevGame => {
            if (!prevGame) return null
            return {
              ...prevGame,
              dice: swappedDice
            } as GameType
          })
        }
        return
      }

      // Only roll dice if not already rolled, turn not submitted, and not currently rolling
      if (!hasRolledThisTurn && !isRollingDice && !turnSubmitted) {
        console.log('🎲 ✅ Rolling dice!')
        setIsRollingDice(true);
        socketService.rollDice(gameId);
      } else {
        console.log('🎲 ❌ Cannot roll dice:', {
          hasRolledThisTurn,
          isRollingDice,
          turnSubmitted
        })
      }
    } else {
      console.log('🎲 ❌ Cannot click dice:', {
        hasGameId: !!gameId,
        isCurrentPlayer
      })
    }
  };

  const handleSubmitMoves = async () => {
    if (!gameId || movesMadeThisTurn.length === 0 || turnSubmitted) return

    console.log('📡 Submitting moves:', movesMadeThisTurn)
    setTurnSubmitted(true)

    // Send moves one at a time with delay to prevent race conditions
    for (let i = 0; i < movesMadeThisTurn.length; i++) {
      const move = movesMadeThisTurn[i]
      const moveData = {
        from: move.from,
        to: move.to
      }

      // Add to pending optimistic moves tracking
      const moveId = `${move.from}-${move.to}`
      pendingOptimisticMoves.current.add(moveId)

      console.log(`📡 Sending move ${i + 1}/${movesMadeThisTurn.length}:`, moveData)
      socketService.makeMove(gameId, moveData)

      // Add delay between moves to allow backend processing
      if (i < movesMadeThisTurn.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200)) // Increased from 100ms to 200ms
      }
    }
  };

  // Comprehensive client-side move validation
  const isValidMove = (from: number, to: number, diceValue: number, playerIndex: number) => {
    if (!game) return false

    console.log(`🔍 Validating move: Player ${playerIndex} from ${from} to ${to} using dice ${diceValue}`)

    // 1. Basic bounds check
    if (from < 0 || from >= 24 || to < 0 || to >= 24) {
      console.log('❌ Invalid: Move out of bounds')
      return false
    }

    // 2. Direction validation
    const expectedDistance = playerIndex === 0 ? from - to : to - from
    if (expectedDistance !== diceValue) {
      console.log(`❌ Invalid: Wrong distance. Expected ${diceValue}, got ${expectedDistance}`)
      return false
    }

    // 3. Source point validation - must have player's checkers
    const sourcePoint = game.board.points[from]
    if (!sourcePoint || sourcePoint[playerIndex] === 0) {
      console.log('❌ Invalid: No checkers at source point')
      return false
    }

    // 4. Destination point validation
    const destPoint = game.board.points[to]
    const opponentIndex = 1 - playerIndex
    const opponentCheckersAtDest = destPoint ? destPoint[opponentIndex] : 0

    if (opponentCheckersAtDest > 1) {
      console.log(`❌ Invalid: Opponent has ${opponentCheckersAtDest} checkers at destination`)
      return false
    }

    // 5. Check if player has checkers on the bar (must move bar checkers first)
    const playerCheckersOnBar = game.board.bar[playerIndex]
    if (playerCheckersOnBar > 0) {
      console.log('❌ Invalid: Must move checkers from bar first')
      return false
    }

    console.log('✅ Valid move')
    return true
  }

  // Enhanced validation for bar moves (entering from bar)
  const isValidBarMove = (to: number, diceValue: number, playerIndex: number) => {
    if (!game) return false

    console.log(`🔍 Validating bar move: Player ${playerIndex} entering at ${to} using dice ${diceValue}`)

    // Must have checkers on bar
    if (game.board.bar[playerIndex] === 0) {
      console.log('❌ Invalid: No checkers on bar')
      return false
    }

    // Calculate entry point based on dice value - BOTH players enter from point 24
    const entryPoint = 24 - diceValue

    if (to !== entryPoint) {
      console.log(`❌ Invalid: Wrong entry point. Expected ${entryPoint}, got ${to}`)
      return false
    }

    // Check destination point
    const destPoint = game.board.points[to]
    const opponentIndex = 1 - playerIndex
    const opponentCheckersAtDest = destPoint ? destPoint[opponentIndex] : 0

    if (opponentCheckersAtDest > 1) {
      console.log(`❌ Invalid: Opponent has ${opponentCheckersAtDest} checkers at entry point`)
      return false
    }

    console.log('✅ Valid bar move')
    return true
  }

  // Check if player can bear off (all checkers in home board)
  const canBearOff = (playerIndex: number) => {
    if (!game) return false

    // BOTH players now have the same home board (points 0-5) since they move in same direction
    const homeBoard = [0, 1, 2, 3, 4, 5]

    // Check if all checkers are in home board or already borne off
    for (let i = 0; i < 24; i++) {
      if (!homeBoard.includes(i) && game.board.points[i][playerIndex] > 0) {
        return false // Found checkers outside home board
      }
    }

    // Also check bar
    if (game.board.bar[playerIndex] > 0) {
      return false // Can't bear off with checkers on bar
    }

    return true
  }

  // Validate bearing off moves
  const isValidBearOffMove = (from: number, diceValue: number, playerIndex: number) => {
    if (!game) return false

    console.log(`🔍 Validating bear off: Player ${playerIndex} from ${from} using dice ${diceValue}`)

    // Must be able to bear off
    if (!canBearOff(playerIndex)) {
      console.log('❌ Invalid: Cannot bear off yet')
      return false
    }

    // Must be moving from home board - BOTH players use same home board now
    const homeBoard = [0, 1, 2, 3, 4, 5]

    if (!homeBoard.includes(from)) {
      console.log('❌ Invalid: Not moving from home board')
      return false
    }

    // Must have checkers at source
    if (!game.board.points[from] || game.board.points[from][playerIndex] === 0) {
      console.log('❌ Invalid: No checkers at source for bearing off')
      return false
    }

    // Validate dice usage for bearing off - BOTH players bear off from same direction
    const distanceToEnd = from + 1 // Distance from point to bearing off (point 0 = 1 away, point 5 = 6 away)

    if (diceValue >= distanceToEnd) {
      // Can use this dice value
      console.log('✅ Valid bear off move')
      return true
    } else {
      // Check if there are checkers on higher points that must be moved first
      const higherPoints = homeBoard.filter(p => p > from)

      const hasCheckersOnHigherPoints = higherPoints.some(p =>
        game.board.points[p] && game.board.points[p][playerIndex] > 0
      )

      if (hasCheckersOnHigherPoints) {
        console.log('❌ Invalid: Must move checkers from higher points first')
        return false
      }

      console.log('✅ Valid bear off move (no higher checkers)')
      return true
    }
  }

  const [isCheckingNextGame, setIsCheckingNextGame] = useState(false)

  const checkForNextGameOrDashboard = async () => {
    // Prevent multiple simultaneous calls
    if (isCheckingNextGame) {
      console.log('🔄 Already checking for next game, skipping...')
      return
    }

    try {
      setIsCheckingNextGame(true)
      console.log('🔍 Checking for next game or navigating to dashboard...')

      // Get current user's games
      const response = await gamesAPI.getMyGames()
      if (response.success && response.data) {
        // Find games where it's the current user's turn
        const myTurnGames = response.data.filter((g: any) => {
          const currentPlayerIndex = g.players.findIndex((p: any) => p.userId === user?.id)
          return g.gameState === 'in_progress' &&
                 g.currentPlayer === currentPlayerIndex &&
                 g._id !== gameId // Don't include current game
        })

        if (myTurnGames.length > 0) {
          console.log(`🎮 Found ${myTurnGames.length} games waiting for your turn, navigating to first one...`)
          // Navigate to the first game where it's the player's turn
          navigate(`/game/${myTurnGames[0]._id}`)
        } else {
          console.log('📊 No more games waiting for your turn, going to dashboard...')
          // No more games with player's turn, go to dashboard
          navigate('/dashboard')
        }
      } else {
        console.log('❌ Failed to fetch games, going to dashboard...')
        // Error fetching games, go to dashboard
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Error checking for next game:', error)
      // Don't navigate to dashboard immediately on network errors
      // This could be a temporary network issue during gameplay
      console.log('🌐 Network error - staying in current game for now')
    } finally {
      setIsCheckingNextGame(false)
    }
  };

  // Get available dice values (unused dice)
  const availableDiceValues = useMemo(() => {
    if (!game?.dice || usedDice.length === 0) return []

    const values: number[] = []
    const isDoubles = game.dice[0] === game.dice[1]

    if (isDoubles) {
      // For doubles, add the dice value for each unused die
      usedDice.forEach(used => {
        if (!used) values.push(game.dice![0])
      })
    } else {
      // For regular dice, add each unused die value
      if (!usedDice[0]) values.push(game.dice[0])
      if (!usedDice[1]) values.push(game.dice[1])
    }

    return values
  }, [game?.dice, usedDice])


  const renderPoint = (pointIndex: number, isTopHalf: boolean) => {
    const point = game?.board.points[pointIndex]

    // Check if this point has checkers that can be moved by current player
    const currentPlayerIndex = (game?.players || []).findIndex(p => p.userId === user?.id)
    const isCurrentPlayer = Array.isArray(game?.players) && typeof game?.currentPlayer === 'number' && (game!.players as any[])[game!.currentPlayer]?.userId === user?.id
    const hasCurrentPlayerCheckers = point && point[currentPlayerIndex] > 0
    const canMove = isCurrentPlayer && hasCurrentPlayerCheckers && availableDiceValues.length > 0
    
    // Determine point color (alternating pattern)
    const isEvenPoint = pointIndex % 2 === 0
    const pointColorClass = isEvenPoint 
      ? 'from-amber-100 to-amber-200' 
      : 'from-amber-800 to-amber-900'
    
    const pointHandlers = {
      onClick: () => handlePointClick(pointIndex),
      onTouchEnd: (e: React.TouchEvent) => {
        e.preventDefault()
        handlePointClick(pointIndex)
      },
    }

    return (
      <div
        key={`point-${pointIndex}`}
        className={`
          relative flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center h-full
          transition-all duration-300 ease-out overflow-hidden
          ${canMove ? 'cursor-pointer hover:scale-105 hover:z-10' : 'cursor-default'}
          ${canMove ? 'ring-2 ring-blue-400 ring-opacity-50 bg-blue-50' : ''}
          ${canMove ? 'touch-manipulation' : ''}
          min-h-0 min-w-0 max-w-full
        `}
        style={{
          WebkitTapHighlightColor: canMove ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
          minHeight: '80px',
          minWidth: '20px',
          maxWidth: '100%'
        }}
        {...pointHandlers}
      >
        {/* Point triangle */}
        <div
          className={`
            absolute inset-0 transition-all duration-200 overflow-hidden w-full h-full
            ${canMove ? 'ring-2 ring-blue-400 ring-opacity-75' : ''}
          `}
          style={{
            background: `linear-gradient(to bottom, ${pointColorClass.includes('amber-100') ? '#fef3c7, #fde68a' : '#92400e, #78350f'})`,
            clipPath: isTopHalf
              ? 'polygon(50% 100%, 15% 0%, 85% 0%)'
              : 'polygon(15% 100%, 85% 100%, 50% 0%)',
            boxShadow: canMove ? 'inset 0 0 10px rgba(59, 130, 246, 0.3)' : 'inset 0 1px 2px rgba(0,0,0,0.1)',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
        
        {/* Checkers */}
        <div className={`
          relative z-20 flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center
          ${isTopHalf ? 'justify-start pt-0.5 sm:pt-1' : 'justify-start pt-0.5 sm:pt-1'}
          h-full px-0.5 sm:px-1 max-w-full overflow-hidden
        `}>
          {point && (() => {
            const bothPlayersPresent = point[0] > 0 && point[1] > 0;

            if (bothPlayersPresent) {
              // Both players have checkers - display side by side
              return (
                <div className="flex flex-row gap-0.5 items-start justify-center w-full">
                  {point.map((playerCheckers, playerIndex) => {
                    if (playerCheckers === 0) return null;
                    const isMyChecker = playerIndex === currentPlayerIndex;
                    const canMoveThisChecker = isMyChecker && canMove;

                    return (
                      <div key={playerIndex} className={`flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center flex-1 min-w-0`}>
                        {Array.from({ length: Math.min(playerCheckers, 3) }, (_, checkerIndex) => (
                          <div
                            key={checkerIndex}
                            className={`
                              relative w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6 rounded-full transition-all duration-300 ease-out
                              ${checkerIndex === 0 ? '' : '-mt-0.5'}
                              ${canMoveThisChecker ? 'hover:scale-110 hover:z-30 cursor-pointer ring-1 ring-green-400 ring-opacity-60' : 'cursor-default'}
                              ${canMoveThisChecker ? 'animate-pulse' : ''}
                              max-w-full max-h-full
                            `}
                            style={{
                              background: playerIndex === 0
                                ? `radial-gradient(circle at 30% 30%, #ffffff, #f8f9fa 40%, #e5e7eb 70%, #d1d5db)`
                                : `radial-gradient(circle at 30% 30%, #1f2937, #374151 40%, #4b5563 70%, #6b7280)`,
                              boxShadow: `0 2px 4px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.4)`
                            }}
                          />
                        ))}
                        {playerCheckers > 3 && (
                          <div className="bg-blue-600 text-white text-[0.5rem] font-bold rounded-full w-3 h-3 flex items-center justify-center shadow-lg mt-0.5">
                            {playerCheckers}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Single player - display normally
            return point.map((playerCheckers, playerIndex) => {
              if (playerCheckers === 0) return null;
              const isMyChecker = playerIndex === currentPlayerIndex;
              const canMoveThisChecker = isMyChecker && canMove;

              return (
                <div key={playerIndex} className={`flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center`}>
                  {Array.from({ length: Math.min(playerCheckers, 5) }, (_, checkerIndex) => (
                <div
                  key={checkerIndex}
                  className={`
                    relative w-4 h-4 sm:w-5 sm:h-5 lg:w-7 lg:h-7 xl:w-8 xl:h-8 rounded-full transition-all duration-300 ease-out
                    ${checkerIndex === 0 ? '' : '-mt-1 sm:-mt-1'}
                    ${canMoveThisChecker ? 'hover:scale-110 hover:z-30 cursor-pointer ring-2 ring-green-400 ring-opacity-60' : 'cursor-default'}
                    transform ${canMoveThisChecker ? 'hover:-translate-y-1' : ''}
                    ${canMoveThisChecker ? 'animate-pulse' : ''}
                    max-w-full max-h-full
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
                    absolute ${isTopHalf ? 'top-0' : 'bottom-0'} right-0 sm:${isTopHalf ? 'top-1' : 'bottom-1'} sm:right-1
                    bg-blue-600 text-white text-xs font-bold rounded-full w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5
                    flex items-center justify-center shadow-lg z-30
                  `}
                  style={{ fontSize: '0.6rem' }}>
                    {playerCheckers}
                  </div>
                )}
              </div>
            );
          });
          })()}
        </div>

      </div>
    )
  }
  const renderBoard = () => {
    if (!game) return null

    const isCurrentPlayer = Array.isArray(game.players) && typeof game.currentPlayer === 'number' && game.players[game.currentPlayer]?.userId === user?.id

    return (
      <div className="bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-0.5 sm:p-2 lg:p-3 rounded-lg sm:rounded-2xl shadow-2xl w-full mx-auto max-w-5xl overflow-hidden">
        {/* Board border with wood grain effect */}
        <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 p-1 sm:p-2 lg:p-3 rounded-md sm:rounded-xl shadow-inner overflow-hidden">
          <div className="bg-gradient-to-br from-amber-100 to-amber-50 p-1 sm:p-2 lg:p-3 rounded-sm sm:rounded-lg overflow-hidden">
            
            {/* Top numbers */}
            <div className="flex text-xs font-bold text-amber-900 opacity-50 mb-0.5 sm:mb-1">
              <div className="flex-1 grid grid-cols-6 gap-0.5 sm:gap-1">
                {Array.from({ length: 6 }, (_, i) => 13 + i).map(num => <div key={num} className="text-center text-xs sm:text-sm">{num}</div>)}
              </div>
              <div className="w-6 sm:w-10 lg:w-12 xl:w-14" />
              <div className="flex-1 grid grid-cols-6 gap-0.5 sm:gap-1">
                {Array.from({ length: 6 }, (_, i) => 19 + i).map(num => <div key={num} className="text-center text-xs sm:text-sm">{num}</div>)}
              </div>
            </div>

            {/* Top half of board */}
            <div className="flex gap-0.5 sm:gap-1 lg:gap-2 h-32 sm:h-48 lg:h-60 xl:h-72 overflow-visible">
              {/* Points 12-17 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1 min-w-0 overflow-hidden">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`top-left-${i}`} className="flex-1 min-w-0 max-w-full overflow-hidden">
                    {renderPoint(12 + i, true)}
                  </div>
                ))}
              </div>
              
              {/* Center bar with dice */}
              <div className="w-6 sm:w-10 lg:w-12 xl:w-14 flex flex-col items-center justify-center px-0.5 sm:px-1 flex-shrink-0">
                <div className="
                  bg-gradient-to-b from-amber-800 to-amber-900 w-full h-full rounded-sm sm:rounded-lg shadow-inner
                  border border-amber-700 sm:border-2 flex flex-col items-center justify-center
                  relative overflow-hidden
                ">
                  {/* Dice display */}
                  {game?.dice && game.dice.length === 2 && hasRolledThisTurn && !turnSubmitted ? (
                    <div className="flex flex-col gap-0 sm:gap-1 z-20 items-center">
                      <div
                        className="scale-75 sm:scale-100 cursor-pointer"
                        onClick={handleDiceClick}
                        onTouchEnd={(e) => {
                          e.preventDefault()
                          handleDiceClick()
                        }}
                      >
                        <Dice3D value={game.dice[0]} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} />
                      </div>
                      <div
                        className="scale-75 sm:scale-100 cursor-pointer"
                        onClick={handleDiceClick}
                        onTouchEnd={(e) => {
                          e.preventDefault()
                          handleDiceClick()
                        }}
                      >
                        <Dice3D value={game.dice[1]} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} />
                      </div>
                    </div>
                  ) : turnSubmitted && hasRolledThisTurn ? (
                    <div className="flex flex-col gap-0 sm:gap-1 z-20 items-center">
                      <div className="scale-75 sm:scale-100">
                        <Dice3D value={1} size="xs" isRolling={false} color={game.currentPlayer === 0 ? 'white' : 'black'} showR={true} />
                      </div>
                      <div className="scale-75 sm:scale-100">
                        <Dice3D value={1} size="xs" isRolling={false} color={game.currentPlayer === 0 ? 'white' : 'black'} showR={true} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0 sm:gap-1 z-20 items-center">
                      <div
                        className={`scale-75 sm:scale-100 ${isCurrentPlayer ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        onClick={handleDiceClick}
                        onTouchEnd={(e) => {
                          e.preventDefault()
                          handleDiceClick()
                        }}
                      >
                        <Dice3D value={1} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} showR={true} />
                      </div>
                      <div
                        className={`scale-75 sm:scale-100 ${isCurrentPlayer ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        onClick={handleDiceClick}
                        onTouchEnd={(e) => {
                          e.preventDefault()
                          handleDiceClick()
                        }}
                      >
                        <Dice3D value={1} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} showR={true} />
                      </div>
                    </div>
                  )}

                  {/* Wood grain effect */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform -skew-y-12" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform skew-y-12 translate-y-2 sm:translate-y-4" />
                  </div>
                </div>
              </div>
              
              {/* Points 18-23 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1 min-w-0 overflow-hidden">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`top-right-${i}`} className="flex-1 min-w-0 max-w-full overflow-hidden">
                    {renderPoint(18 + i, true)}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Center divider with bar checkers */}
            <div className="h-6 sm:h-8 lg:h-10 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 my-1 sm:my-2 rounded shadow-inner relative overflow-visible flex items-center justify-center gap-2">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent opacity-30 pointer-events-none" />

              {/* Player 0 (white) bar checkers - left side */}
              <div className="flex flex-row items-center gap-0.5 z-10">
                {game?.board.bar[0] > 0 && Array.from({ length: Math.min(game.board.bar[0], 5) }).map((_, idx) => (
                  <div
                    key={`bar-horizontal-p0-${idx}`}
                    className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full ${
                      isCurrentPlayer && game.currentPlayer === 0 ? 'cursor-pointer hover:scale-110 ring-2 ring-blue-400 ring-opacity-50' : 'cursor-default'
                    }`}
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, #ffffff, #f8f9fa 40%, #e5e7eb 70%, #d1d5db)',
                      boxShadow: '0 3px 6px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.4)'
                    }}
                    onClick={handleBarClick}
                    onTouchEnd={(e) => {
                      e.preventDefault()
                      handleBarClick()
                    }}
                  />
                ))}
                {game?.board.bar[0] > 5 && (
                  <div className="text-white text-xs sm:text-sm font-bold bg-amber-900 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                    {game.board.bar[0]}
                  </div>
                )}
              </div>

              {/* Player 1 (black) bar checkers - right side */}
              <div className="flex flex-row items-center gap-0.5 z-10">
                {game?.board.bar[1] > 0 && Array.from({ length: Math.min(game.board.bar[1], 5) }).map((_, idx) => (
                  <div
                    key={`bar-horizontal-p1-${idx}`}
                    className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 rounded-full ${
                      isCurrentPlayer && game.currentPlayer === 1 ? 'cursor-pointer hover:scale-110 ring-2 ring-blue-400 ring-opacity-50' : 'cursor-default'
                    }`}
                    style={{
                      background: 'radial-gradient(circle at 30% 30%, #1f2937, #374151 40%, #4b5563 70%, #6b7280)',
                      boxShadow: '0 3px 6px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.2)'
                    }}
                    onClick={handleBarClick}
                    onTouchEnd={(e) => {
                      e.preventDefault()
                      handleBarClick()
                    }}
                  />
                ))}
                {game?.board.bar[1] > 5 && (
                  <div className="text-white text-xs sm:text-sm font-bold bg-amber-900 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
                    {game.board.bar[1]}
                  </div>
                )}
              </div>
            </div>
            
            {/* Bottom half of board */}
            <div className="flex gap-0.5 sm:gap-1 lg:gap-2 h-32 sm:h-48 lg:h-60 xl:h-72 overflow-visible">
              {/* Points 11-6 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1 min-w-0 overflow-hidden">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`bottom-left-${i}`} className="flex-1 min-w-0 max-w-full overflow-hidden">
                    {renderPoint(11 - i, false)}
                  </div>
                ))}
              </div>
              
              {/* Center bar - Bottom half */}
              <div className="w-6 sm:w-10 lg:w-12 xl:w-14 flex flex-col items-center justify-center px-0.5 sm:px-1 flex-shrink-0">
                <div className="
                  bg-gradient-to-b from-amber-800 to-amber-900 w-full h-full rounded-sm sm:rounded-lg shadow-inner
                  border border-amber-700 sm:border-2 flex flex-col items-center justify-center
                  relative overflow-hidden
                ">
                  {/* Wood grain effect */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform -skew-y-12" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-600 to-transparent transform skew-y-12 translate-y-2 sm:translate-y-4" />
                  </div>
                </div>
              </div>
              
              {/* Points 5-0 */}
              <div className="flex gap-0.5 sm:gap-1 flex-1 min-w-0 overflow-hidden">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`bottom-right-${i}`} className="flex-1 min-w-0 max-w-full overflow-hidden">
                    {renderPoint(5 - i, false)}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom numbers */}
            <div className="flex text-xs font-bold text-amber-900 opacity-50 mt-0.5 sm:mt-1">
              <div className="flex-1 grid grid-cols-6 gap-0.5 sm:gap-1">
                {Array.from({ length: 6 }, (_, i) => 12 - i).map(num => <div key={num} className="text-center text-xs sm:text-sm">{num}</div>)}
              </div>
              <div className="w-6 sm:w-10 lg:w-12 xl:w-14" />
              <div className="flex-1 grid grid-cols-6 gap-0.5 sm:gap-1">
                {Array.from({ length: 6 }, (_, i) => 6 - i).map(num => <div key={num} className="text-center text-xs sm:text-sm">{num}</div>)}
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
    const isNetworkError = error?.includes('Connection lost') || error?.includes('Network Error')

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="text-center max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4">
            {isNetworkError ? (
              <div className="w-16 h-16 mx-auto mb-4 text-orange-500">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto mb-4 text-red-500">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isNetworkError ? 'Connection Issues' : 'Error Loading Game'}
          </h2>
          <p className="text-gray-600 mb-6 text-sm">{error || 'Game not found'}</p>

          <div className="space-y-3">
            {isNetworkError && (
              <button
                onClick={() => loadGame(0)}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                {isLoading ? 'Retrying...' : 'Retry Connection'}
              </button>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentPlayer = Array.isArray(game.players) && typeof game.currentPlayer === 'number' ? game.players[game.currentPlayer] : undefined
  const isCurrentPlayer = !!(currentPlayer && currentPlayer.userId === user?.id)



  return (
    <div className="h-screen bg-gray-100 overflow-hidden">
      {/* Mobile Layout (Stack Vertically) */}
      <div className="lg:hidden max-w-7xl mx-auto h-full flex flex-col py-1 sm:py-2 px-1 sm:px-4">
        {/* Game Header */}
        <div className="bg-white shadow rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 flex-shrink-0">
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
                <h3 className="font-bold text-sm sm:text-base lg:text-lg truncate">{(game.players || [])[0]?.username || 'Player 1'}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{(game.players || [])[0]?.rating || 'N/A'}</p>
                <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">White Checkers</p>
              </div>
            </div>
            <div className={`p-2 sm:p-3 lg:p-4 rounded-lg ${game.currentPlayer === 1 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'} flex items-center gap-2 sm:gap-3`}>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gray-800 via-gray-600 to-gray-700 border border-gray-800 shadow-md flex-shrink-0"></div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base lg:text-lg truncate">{(game.players || [])[1]?.username || 'Player 2'}</h3>
                <p className="text-xs sm:text-sm text-gray-600">{(game.players || [])[1]?.rating || 'N/A'}</p>
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
        <div className="bg-white shadow rounded-lg p-1 sm:p-2 lg:p-4 flex-1 flex flex-col overflow-hidden">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1 sm:mb-2 text-center flex-shrink-0">Game Board</h2>
          <div className="flex-1 flex items-start justify-center overflow-auto">
            {renderBoard()}
          </div>
        </div>

        {/* Game Actions */}
        <div className="bg-white shadow rounded-lg p-1 sm:p-2 lg:p-3 mt-1 sm:mt-2 lg:mt-3 flex-shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-2 sm:mb-3">Actions</h3>
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-4 sm:gap-0">
            {/* Submit Moves Button */}
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 text-sm sm:text-base"
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS || movesMadeThisTurn.length === 0 || turnSubmitted}
              onClick={handleSubmitMoves}
            >
              Submit Moves ({movesMadeThisTurn.length})
            </button>

            {/* Reset Moves Button */}
            <button
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 text-sm sm:text-base"
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS || movesMadeThisTurn.length === 0 || turnSubmitted}
              onClick={resetMovesThisTurn}
            >
              Reset Moves
            </button>

            {/* End Turn Button */}
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 text-sm sm:text-base"
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS || !turnSubmitted}
              onClick={() => {
                if (gameId && isCurrentPlayer && turnSubmitted) {
                  // End turn - send socket event
                  socketService.getSocket()?.emit('game:end_turn', { gameId });
                  setUsedDice([]);
                  setTurnSubmitted(false);
                  setMovesMadeThisTurn([]);
                  setHasRolledThisTurn(false);
                }
              }}
            >
              End Turn
            </button>

            <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm sm:text-base">
              Resign
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {!game?.dice ? 'Click the dice on the board to roll them!' :
             isCurrentPlayer ?
               turnSubmitted ?
                 'Moves submitted. Click "End Turn" to pass turn to opponent.' :
                 movesMadeThisTurn.length > 0 ?
                   `Made ${movesMadeThisTurn.length} move${movesMadeThisTurn.length > 1 ? 's' : ''}. Click "Submit Moves" to confirm or make more moves.` :
                   availableDiceValues.length > 0 ?
                     `Available moves: ${availableDiceValues.join(', ')}. Click a checker to move it.` :
                     'No moves available. Click "Submit Moves" to complete turn.' :
             "Waiting for opponent's move..."}
          </p>
        </div>
      </div>

      {/* Desktop Layout (Three Columns) */}
      <div className="hidden lg:flex h-full">
        {/* Left Sidebar - Game Info */}
        <div className="w-80 bg-white shadow-lg p-4 overflow-y-auto flex-shrink-0">
          {/* Back Button */}
          <div className="mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded w-full"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Game Status */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {game.gameState === GameStateEnum.WAITING && 'Waiting for opponent...'}
              {game.gameState === GameStateEnum.IN_PROGRESS && (
                isCurrentPlayer ? 'Your turn' : `${currentPlayer?.username}'s turn`
              )}
              {game.gameState === GameStateEnum.FINISHED && 'Game finished'}
            </h1>
          </div>

          {/* Players Info */}
          <div className="space-y-4 mb-6">
            <div className={`p-4 rounded-lg ${game.currentPlayer === 0 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white via-gray-100 to-gray-200 border border-gray-300 shadow-md flex-shrink-0"></div>
                <div>
                  <h3 className="font-bold text-lg">{(game.players || [])[0]?.username || 'Player 1'}</h3>
                  <p className="text-sm text-gray-600">Rating: {(game.players || [])[0]?.rating || 'N/A'}</p>
                  <p className="text-sm text-gray-600">White Checkers</p>
                </div>
              </div>
            </div>
            <div className={`p-4 rounded-lg ${game.currentPlayer === 1 ? 'bg-blue-100 border-2 border-blue-500' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 via-gray-600 to-gray-700 border border-gray-800 shadow-md flex-shrink-0"></div>
                <div>
                  <h3 className="font-bold text-lg">{(game.players || [])[1]?.username || 'Player 2'}</h3>
                  <p className="text-sm text-gray-600">Rating: {(game.players || [])[1]?.rating || 'N/A'}</p>
                  <p className="text-sm text-gray-600">Black Checkers</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center - Game Board */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-auto">
          <div className="w-full max-w-6xl">
            {renderBoard()}
          </div>
        </div>

        {/* Right Sidebar - Actions */}
        <div className="w-80 bg-white shadow-lg p-4 overflow-y-auto flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Game Actions</h3>

          <div className="space-y-3">
            {/* Submit Moves Button */}
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded disabled:opacity-50 w-full"
              disabled={movesMadeThisTurn.length === 0 || turnSubmitted || !isCurrentPlayer}
              onClick={handleSubmitMoves}
            >
              Submit Moves ({movesMadeThisTurn.length})
            </button>

            {/* Reset Moves Button */}
            <button
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 w-full"
              disabled={movesMadeThisTurn.length === 0 || turnSubmitted}
              onClick={() => {
                resetMovesThisTurn()
                toast.success('Moves reset!')
              }}
            >
              Reset Moves
            </button>

            {/* End Turn Button */}
            <button
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 w-full"
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS || !turnSubmitted}
              onClick={() => {
                if (gameId && isCurrentPlayer && turnSubmitted) {
                  // End turn - send socket event (server may auto-end turn when moves exhausted, but keep client state consistent)
                  socketService.getSocket()?.emit('game:end_turn', { gameId });
                  setUsedDice([]);
                  setTurnSubmitted(false);
                  setMovesMadeThisTurn([]);
                  setHasRolledThisTurn(false);
                }
              }}
            >
              End Turn
            </button>

            {/* Resign Button */}
            <button
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded w-full"
              onClick={() => {
                if (confirm('Are you sure you want to resign?')) {
                  toast.error('Game resigned')
                  navigate('/dashboard')
                }
              }}
            >
              Resign
            </button>
          </div>

          {/* Game Instructions */}
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Instructions</h4>
            <p className="text-sm text-blue-800">
              {!hasRolledThisTurn && isCurrentPlayer ?
                'Click the dice on the board to roll them!' :
                hasRolledThisTurn && movesMadeThisTurn.length === 0 && isCurrentPlayer ?
                  'Click on your checkers to move them.' :
                  movesMadeThisTurn.length > 0 && !turnSubmitted && isCurrentPlayer ?
                    'Click "Submit Moves" when ready to complete your turn.' :
                    turnSubmitted && isCurrentPlayer ?
                      'No moves available. Click "Submit Moves" to complete turn.' :
                "Waiting for opponent's move..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Game
