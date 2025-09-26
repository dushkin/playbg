import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { gamesAPI } from '../services/api'
import { Game as GameType, GameState as GameStateEnum } from '@playbg/shared'
import LoadingSpinner from '../components/UI/LoadingSpinner'
import socketService from '../services/socketService'
import Dice3D from '../components/Game/Dice3D'

const Game: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAppSelector((state) => state.auth)

  const [game, setGame] = useState<GameType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRollingDice, setIsRollingDice] = useState(false)
  const [usedDice, setUsedDice] = useState<boolean[]>([])
  const [optimisticMoveId, setOptimisticMoveId] = useState<string | null>(null)
  const optimisticMoveRef = useRef<string | null>(null)
  const pendingOptimisticMoves = useRef<Set<string>>(new Set())
  const [hasRolledThisTurn, setHasRolledThisTurn] = useState<boolean>(false)

  useEffect(() => {
    if (gameId) {
      loadGame();
      socketService.joinGame(gameId);
    }

    const socket = socketService.getSocket();
    if (socket) {
      const handleGameJoined = (data: any) => {
        if (data.gameId === gameId) {
          console.log('🎮 Game joined, setting state:', data);
          // Backend sends the state in data.state, not data.gameData
          if (data.state) {
            setGame(data.state);
          }
        }
      };

      const handleDiceRoll = (data: any) => {
        if (data.gameId === gameId) {
          setIsRollingDice(false);

          // Always set hasRolledThisTurn to true when any dice are rolled
          // This ensures the dice display correctly
          setHasRolledThisTurn(true);

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

            return updatedGame;
          });
        }
      };

      const handleGameMove = (data: any) => {
        console.log('📨 Server move response:', data)
        console.log('🔄 Current optimistic move ID:', optimisticMoveId)
        console.log('🔄 Pending optimistic moves:', Array.from(pendingOptimisticMoves.current))
        console.log('🔄 Server move data:', data.move)
        if (data.gameId === gameId) {
          // Check if this server move matches any of our pending optimistic moves
          if (data.move) {
            const serverMoveId = `${data.move.from}-${data.move.to}`
            const isOptimisticMove = pendingOptimisticMoves.current.has(serverMoveId)

            console.log('🔄 Checking optimistic move match:', `Server: ${serverMoveId}`, 'in pending:', isOptimisticMove)

            if (isOptimisticMove) {
              console.log('✅ Confirmed optimistic move, removing from pending')
              pendingOptimisticMoves.current.delete(serverMoveId)

              // Clear the single optimistic ID references if they match
              if (optimisticMoveRef.current === serverMoveId) {
                setOptimisticMoveId(null)
                optimisticMoveRef.current = null
              }
              // Only update currentPlayer and dice from server, keep our board state
              setGame(prevGame => {
                if (!prevGame) return null;
                return {
                  ...prevGame,
                  currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
                  dice: data.state?.dice || prevGame.dice,
                };
              });

              // Check for turn changes after the optimistic move confirmation
              const currentPlayerIndex = game?.players.findIndex(p => p.userId === user?.id) ?? -1

              if (data.state?.currentPlayer !== undefined) {
                if (currentPlayerIndex !== -1 && data.state.currentPlayer === currentPlayerIndex) {
                  // It's now our turn - reset roll status
                  setHasRolledThisTurn(false)
                } else if (currentPlayerIndex !== -1 && data.state.currentPlayer !== currentPlayerIndex) {
                  // Turn changed to opponent - also reset
                  setHasRolledThisTurn(false)
                }
              }

              if (data.state?.gameState === 'finished') {
                // Game finished, check for next game or go to dashboard
                setTimeout(() => {
                  checkForNextGameOrDashboard();
                }, 3000); // Wait longer for game finish
              } else if (data.state?.currentPlayer !== undefined &&
                        currentPlayerIndex !== -1 &&
                        data.state.currentPlayer !== currentPlayerIndex) {
                // Player turn changed - check if it's a complete turn change (not just a move)
                // A complete turn change means either no dice or the turn naturally ended
                const turnCompleted = !data.state.dice ||
                                    data.state.dice.length === 0 ||
                                    data.state.dice.every((d: number) => d === 0);

                if (turnCompleted) {
                  console.log('🔄 Complete turn finished, checking for next game in 1.5s...', {
                    currentPlayer: data.state.currentPlayer,
                    myIndex: currentPlayerIndex,
                    dice: data.state.dice,
                    reason: 'Turn completed'
                  });
                  setTimeout(() => {
                    checkForNextGameOrDashboard();
                  }, 1500);
                } else {
                  console.log('🎲 Player changed but dice still available, continuing current game...', {
                    currentPlayer: data.state.currentPlayer,
                    myIndex: currentPlayerIndex,
                    dice: data.state.dice
                  });
                }
              }

              return; // Don't process further for our optimistic moves
            } else {
              console.log('❌ Server move not in pending optimistic moves')
            }
          } else {
            console.log('ℹ️ No move data in server response')
          }

          console.log('🔄 Processing non-optimistic server move')

          // Normal server update (not our optimistic move)
          setGame(prevGame => {
            if (!prevGame) return null;

            // If we have any pending optimistic moves, don't overwrite the board state
            const hasPendingOptimisticMoves = pendingOptimisticMoves.current.size > 0
            const shouldPreserveBoardState = hasPendingOptimisticMoves

            if (shouldPreserveBoardState) {
              console.log('🔒 Preserving optimistic board state, only updating player/dice')
              return {
                ...prevGame,
                currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
                dice: data.state?.dice || prevGame.dice,
              };
            } else {
              console.log('📋 Full server update (no pending optimistic moves)')
              return {
                ...prevGame,
                board: data.state?.board || prevGame.board,
                currentPlayer: data.state?.currentPlayer !== undefined ? data.state.currentPlayer : prevGame.currentPlayer,
                dice: data.state?.dice || prevGame.dice,
              };
            }
          });

          // Update dice usage when move is made (only for non-optimistic moves)
          if (data.move && game?.dice) {
            const distance = Math.abs(data.move.to - data.move.from);
            const isDoubles = game.dice[0] === game.dice[1];

            setUsedDice(prev => {
              const newUsed = [...prev];
              if (isDoubles) {
                // For doubles, mark first available die as used
                const firstAvailable = newUsed.findIndex(used => !used);
                if (firstAvailable !== -1) {
                  newUsed[firstAvailable] = true;
                }
              } else {
                // For regular dice, mark the appropriate die as used
                if (distance === game.dice![0] && !newUsed[0]) {
                  newUsed[0] = true;
                } else if (distance === game.dice![1] && !newUsed[1]) {
                  newUsed[1] = true;
                }
              }
              return newUsed;
            });
          }


          // Check if all dice are used and end turn automatically
          if (usedDice.every(used => used)) {
            // All dice used, turn should end
            setUsedDice([]);
          }

          // Check for turn changes and game end (for non-optimistic moves)
          const currentPlayerIndex = game?.players.findIndex(p => p.userId === user?.id) ?? -1
          if (data.state?.currentPlayer !== undefined) {
            if (currentPlayerIndex !== -1 && data.state.currentPlayer === currentPlayerIndex) {
              // It's now our turn - reset roll status
              setHasRolledThisTurn(false)
            }
          }

          if (data.state?.gameState === 'finished') {
            // Game finished, check for next game or go to dashboard
            setTimeout(() => {
              checkForNextGameOrDashboard();
            }, 3000); // Wait longer for game finish
          } else if (data.state?.currentPlayer !== undefined &&
                    currentPlayerIndex !== -1 &&
                    data.state.currentPlayer !== currentPlayerIndex) {
            // Player turn changed - check if it's a complete turn change (not just a move)
            const turnCompleted = !data.state.dice ||
                                data.state.dice.length === 0 ||
                                data.state.dice.every((d: number) => d === 0);

            if (turnCompleted) {
              console.log('🔄 Complete turn finished (non-optimistic), checking for next game in 1.5s...', {
                currentPlayer: data.state.currentPlayer,
                myIndex: currentPlayerIndex,
                dice: data.state.dice,
                reason: 'Turn completed'
              });
              setTimeout(() => {
                checkForNextGameOrDashboard();
              }, 1500);
            } else {
              console.log('🎲 Player changed but dice still available (non-optimistic), continuing...', {
                currentPlayer: data.state.currentPlayer,
                myIndex: currentPlayerIndex,
                dice: data.state.dice
              });
            }
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
              dice: data.state?.dice || null, // Reset dice when player joins
            };
          });

          // Reset dice-related state when player joins (fresh game start)
          setHasRolledThisTurn(false);
          setUsedDice([]);
        }
      };

      socket.on('game:joined', handleGameJoined);
      socket.on('game:dice_roll', handleDiceRoll);
      socket.on('game:move', handleGameMove);
      socket.on('game:player_joined', handlePlayerJoined);

      return () => {
        socket.off('game:joined', handleGameJoined);
        socket.off('game:dice_roll', handleDiceRoll);
        socket.off('game:move', handleGameMove);
        socket.off('game:player_joined', handlePlayerJoined);
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
        console.log('🎮 Loaded game from API:', response.data)
        setGame(response.data)

        // Initialize dice state based on loaded game
        if (response.data.dice && response.data.dice.length === 2) {
          setHasRolledThisTurn(true)
          // Initialize dice usage tracking
          if (response.data.dice[0] === response.data.dice[1]) {
            setUsedDice([false, false, false, false]); // Doubles
          } else {
            setUsedDice([false, false]); // Regular
          }
        } else {
          setHasRolledThisTurn(false)
          setUsedDice([])
        }
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
    console.log('🎯 Point clicked:', pointIndex)
    if (!game || game.gameState !== GameStateEnum.IN_PROGRESS) {
      console.log('❌ Game not in progress')
      return
    }

    // Check if it's the current player's turn
    const currentPlayerIndex = game.players.findIndex(p => p.userId === user?.id)
    console.log('👤 Current player index:', currentPlayerIndex, 'Game current player:', game.currentPlayer)
    if (currentPlayerIndex !== game.currentPlayer) {
      console.log('❌ Not current player turn')
      return
    }

    // Check if there are available dice values
    console.log('🎲 Available dice values:', availableDiceValues)
    if (availableDiceValues.length === 0) {
      console.log('❌ No available dice values')
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
      return
    }

    // Try to find a valid move with any available dice value
    const isDoubles = game.dice && game.dice[0] === game.dice[1]
    let bestMove: { from: number; to: number; diceValue: number } | null = null

    console.log('🎲 Dice:', game.dice, 'Is doubles:', isDoubles)

    for (const diceValue of availableDiceValues) {
      let targetPoint: number

      // Check if player has checkers on bar - must handle bar moves first
      if (game.board.bar[currentPlayerIndex] > 0) {
        // This is a bar move - calculate entry point
        targetPoint = currentPlayerIndex === 0 ? 24 - diceValue : diceValue - 1

        if (isValidBarMove(targetPoint, diceValue, currentPlayerIndex)) {
          bestMove = { from: -1, to: targetPoint, diceValue } // from: -1 indicates bar move
          console.log('✅ Found valid bar move:', bestMove)
          break
        }
        continue // Skip regular moves when on bar
      }

      // Regular move calculation
      if (currentPlayerIndex === 0) {
        // Player 0 moves counter-clockwise (decreasing point numbers)
        targetPoint = pointIndex - diceValue
      } else {
        // Player 1 moves clockwise (increasing point numbers)
        targetPoint = pointIndex + diceValue
      }

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
      console.log('🚀 Executing move:', bestMove)

      // Add to pending optimistic moves and set current optimistic move ID
      const moveId = `${bestMove.from}-${bestMove.to}`
      console.log('🔄 Adding optimistic move to pending:', moveId)
      pendingOptimisticMoves.current.add(moveId)
      setOptimisticMoveId(moveId)
      optimisticMoveRef.current = moveId

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
          if (bestMove.diceValue === game.dice![0] && !newUsed[0]) {
            newUsed[0] = true
          } else if (bestMove.diceValue === game.dice![1] && !newUsed[1]) {
            newUsed[1] = true
          }
        }
        console.log('🎲 After dice usage update:', newUsed)
        return newUsed
      })

      // Send the move to the server (server will validate and correct if needed)
      const move = {
        from: bestMove.from,
        to: bestMove.to
      }

      console.log('📡 Sending move to server:', move)
      socketService.makeMove(gameId, move)
    } else if (!bestMove) {
      console.log('❌ No valid move found')
    } else if (!gameId) {
      console.log('❌ No game ID')
    }
  }

  const handleRollDice = () => {
    if (gameId) {
      setIsRollingDice(true);
      socketService.rollDice(gameId);
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

    // Calculate entry point based on dice value
    const entryPoint = playerIndex === 0 ? 24 - diceValue : diceValue - 1

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

    const homeBoard = playerIndex === 0
      ? [0, 1, 2, 3, 4, 5] // Player 0 home board
      : [18, 19, 20, 21, 22, 23] // Player 1 home board

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

    // Must be moving from home board
    const homeBoard = playerIndex === 0
      ? [0, 1, 2, 3, 4, 5]
      : [18, 19, 20, 21, 22, 23]

    if (!homeBoard.includes(from)) {
      console.log('❌ Invalid: Not moving from home board')
      return false
    }

    // Must have checkers at source
    if (!game.board.points[from] || game.board.points[from][playerIndex] === 0) {
      console.log('❌ Invalid: No checkers at source for bearing off')
      return false
    }

    // Validate dice usage for bearing off
    const distanceToEnd = playerIndex === 0 ? from + 1 : 24 - from

    if (diceValue >= distanceToEnd) {
      // Can use this dice value
      console.log('✅ Valid bear off move')
      return true
    } else {
      // Check if there are checkers on higher points that must be moved first
      const higherPoints = playerIndex === 0
        ? homeBoard.filter(p => p > from)
        : homeBoard.filter(p => p < from)

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
    const currentPlayerIndex = game?.players.findIndex(p => p.userId === user?.id) ?? -1
    const isCurrentPlayer = game?.currentPlayer !== undefined && game?.players[game?.currentPlayer]?.userId === user?.id
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
          transition-all duration-300 ease-out
          ${canMove ? 'cursor-pointer hover:scale-105 hover:z-10' : 'cursor-default'}
          ${canMove ? 'ring-2 ring-blue-400 ring-opacity-50 bg-blue-50' : ''}
          ${canMove ? 'touch-manipulation' : ''}
          min-h-0 min-w-0
        `}
        style={{
          WebkitTapHighlightColor: canMove ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
          minHeight: '44px'
        }}
        {...pointHandlers}
      >
        {/* Point triangle */}
        <div
          className={`
            absolute inset-0 transition-all duration-200
            ${canMove ? 'ring-4 ring-blue-400 ring-opacity-75' : ''}
          `}
          style={{
            background: `linear-gradient(to bottom, ${pointColorClass.includes('amber-100') ? '#fef3c7, #fde68a' : '#92400e, #78350f'})`,
            clipPath: isTopHalf 
              ? 'polygon(50% 100%, 0% 0%, 100% 0%)'
              : 'polygon(0% 100%, 100% 100%, 50% 0%)',
            boxShadow: canMove ? 'inset 0 0 20px rgba(59, 130, 246, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
        
        {/* Checkers */}        <div className={`
          relative z-20 flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center
          ${isTopHalf ? 'justify-start pt-1' : 'justify-start pt-1'}
          h-full px-2
        `}>
          {point && point.map((playerCheckers, playerIndex) => {
            if (playerCheckers === 0) return null
            
            const isMyChecker = playerIndex === currentPlayerIndex
            const canMoveThisChecker = isMyChecker && canMove

            return (
              <div key={playerIndex} className={`flex ${isTopHalf ? 'flex-col' : 'flex-col-reverse'} items-center`}>
                {Array.from({ length: Math.min(playerCheckers, 5) }, (_, checkerIndex) => (
                <div
                  key={checkerIndex}
                  className={`
                    relative w-4 h-4 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-9 xl:h-9 rounded-full transition-all duration-300 ease-out
                    ${checkerIndex === 0 ? '' : '-mt-0.5 sm:-mt-1'}
                    ${canMoveThisChecker ? 'hover:scale-110 hover:z-30 cursor-pointer ring-2 ring-green-400 ring-opacity-60' : 'cursor-default'}
                    transform ${canMoveThisChecker ? 'hover:-translate-y-1' : ''}
                    ${canMoveThisChecker ? 'animate-pulse' : ''}
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

      </div>
    )
  }
  const renderBoard = () => {
    if (!game) return null

    const isCurrentPlayer = game.currentPlayer !== undefined && game.players[game.currentPlayer]?.userId === user?.id

    return (
      <div className="bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 p-1 sm:p-4 lg:p-6 rounded-xl sm:rounded-2xl shadow-2xl w-full mx-auto max-w-full overflow-hidden">
        {/* Board border with wood grain effect */}
        <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 p-1 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl shadow-inner">
          <div className="bg-gradient-to-br from-amber-100 to-amber-50 p-1 sm:p-4 lg:p-6 rounded-md sm:rounded-lg">
            
            {/* Top numbers */}
            <div className="flex text-xs font-bold text-amber-900 opacity-50 mb-1">
              <div className="flex-1 flex justify-around">
                {Array.from({ length: 6 }, (_, i) => 13 + i).map(num => <div key={num} className="w-4 sm:w-8 text-center text-xs sm:text-sm overflow-hidden">{num}</div>)}
              </div>
              <div className="w-6 sm:w-8 lg:w-10 xl:w-12" />
              <div className="flex-1 flex justify-around">
                {Array.from({ length: 6 }, (_, i) => 19 + i).map(num => <div key={num} className="w-4 sm:w-8 text-center text-xs sm:text-sm overflow-hidden">{num}</div>)}
              </div>
            </div>

            {/* Top half of board */}
            <div className="flex gap-1 sm:gap-1 lg:gap-2 h-32 sm:h-48 lg:h-64 xl:h-72">
              {/* Points 12-17 */}
              <div className="flex gap-1 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`top-left-${i}`} className="flex-1 min-w-0">
                    {renderPoint(12 + i, true)}
                  </div>
                ))}
              </div>
              
              {/* Center bar with dice */}
              <div className="w-8 sm:w-10 lg:w-12 xl:w-14 flex flex-col items-center justify-center px-1">
                <div className="
                  bg-gradient-to-b from-amber-800 to-amber-900 w-full h-28 sm:h-44 lg:h-56 xl:h-64 rounded-md sm:rounded-lg shadow-inner
                  border border-amber-700 sm:border-2 flex flex-col items-center justify-center
                  relative overflow-hidden
                ">
                  <div className="text-amber-200 text-xs font-bold mb-1 sm:mb-2 z-10">BAR</div>

                  {/* Dice display */}
                  {game?.dice && game.dice.length === 2 && hasRolledThisTurn ? (
                    <div className="flex flex-col gap-0.5 sm:gap-1 z-20">
                      <div>
                        <Dice3D value={game.dice[0]} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} />
                      </div>
                      <div>
                        <Dice3D value={game.dice[1]} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5 sm:gap-1 z-20">
                      <div
                        className={`${isCurrentPlayer && game.gameState === GameStateEnum.IN_PROGRESS ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        onClick={() => {
                          if (isCurrentPlayer && game.gameState === GameStateEnum.IN_PROGRESS && !isRollingDice) {
                            handleRollDice();
                          }
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault()
                          if (isCurrentPlayer && game.gameState === GameStateEnum.IN_PROGRESS && !isRollingDice) {
                            handleRollDice();
                          }
                        }}
                      >
                        <Dice3D value={1} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} showR={true} />
                      </div>
                      <div
                        className={`${isCurrentPlayer && game.gameState === GameStateEnum.IN_PROGRESS ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        onClick={() => {
                          if (isCurrentPlayer && game.gameState === GameStateEnum.IN_PROGRESS && !isRollingDice) {
                            handleRollDice();
                          }
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault()
                          if (isCurrentPlayer && game.gameState === GameStateEnum.IN_PROGRESS && !isRollingDice) {
                            handleRollDice();
                          }
                        }}
                      >
                        <Dice3D value={1} size="xs" isRolling={isRollingDice} color={game.currentPlayer === 0 ? 'white' : 'black'} showR={true} />
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
              <div className="flex gap-1 flex-1">
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
            <div className="flex gap-1 sm:gap-1 lg:gap-2 h-32 sm:h-48 lg:h-64 xl:h-72">
              {/* Points 11-6 */}
              <div className="flex gap-1 flex-1">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={`bottom-left-${i}`} className="flex-1 min-w-0">
                    {renderPoint(11 - i, false)}
                  </div>
                ))}
              </div>
              
              {/* Center bar */}
              <div className="w-8 sm:w-10 lg:w-12 xl:w-14 flex flex-col items-center justify-center px-1">
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
              <div className="flex gap-1 flex-1">
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
                {Array.from({ length: 6 }, (_, i) => 12 - i).map(num => <div key={num} className="w-4 sm:w-8 text-center text-xs sm:text-sm overflow-hidden">{num}</div>)}
              </div>
              <div className="w-6 sm:w-8 lg:w-10 xl:w-12" />
              <div className="flex-1 flex justify-around">
                {Array.from({ length: 6 }, (_, i) => 6 - i).map(num => <div key={num} className="w-4 sm:w-8 text-center text-xs sm:text-sm overflow-hidden">{num}</div>)}
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

  const currentPlayer = game.currentPlayer !== undefined ? game.players[game.currentPlayer] : null
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
              disabled={!isCurrentPlayer || game.gameState !== GameStateEnum.IN_PROGRESS || availableDiceValues.length > 0}
              onClick={() => {
                if (gameId && isCurrentPlayer && availableDiceValues.length === 0) {
                  // End turn - send socket event
                  socketService.getSocket()?.emit('game:end_turn', { gameId });
                  setUsedDice([]);
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
               availableDiceValues.length > 0 ?
                 `Available moves: ${availableDiceValues.join(', ')}. Click a checker to move it.` :
                 'All dice used. Click "End Turn" to pass turn to opponent.' :
             "Waiting for opponent's move..."}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Game
