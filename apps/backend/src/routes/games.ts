/// <reference path="../types/express-augmentation.ts" />

import express, { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { GameModel } from '../models/Game';
import { User } from '../models/User';
import { BackgammonEngine } from '@playbg/game-logic';
import { gameStateManager } from '../services/gameStateManager';
import { getRedisService } from '../services/redisService';
import { logger } from '../utils/logger';
import {
  ApiResponse,
  Game,
  GameType,
  GamePeriod,
  GameState,
  StepPeriod,
  Player,
  GameMove,
  ChatMessage
} from '@playbg/shared';
import { 
  validateRequest, 
  validateGameMove, 
  validateChatMessage, 
  validateObjectId,
  validateQueryParams,
  validatePagination,
  sanitizeInput
} from '../middleware/validation';
import { emitGameUpdate } from '../utils/socketEmitter';

const router = express.Router();

// Helper function to get time limits based on game period
function getTimeForPeriod(period: GamePeriod): number {
  switch (period) {
    case GamePeriod.THREE_MINUTES:
      return 3 * 60 * 1000; // 3 minutes in milliseconds
    case GamePeriod.TEN_MINUTES:
      return 10 * 60 * 1000; // 10 minutes
    case GamePeriod.THIRTY_MINUTES:
      return 30 * 60 * 1000; // 30 minutes
    case GamePeriod.UNLIMITED:
    default:
      return 0; // No time limit
  }
}

// Validation schemas
const createGameSchema = Joi.object({
  gameType: Joi.string().valid(...Object.values(GameType)).required(),
  gamePeriod: Joi.string().valid(...Object.values(GamePeriod)).required(),
  stepPeriod: Joi.string().valid(...Object.values(StepPeriod)).optional(),
  opponentId: Joi.string().optional()
});

const makeMoveSchema = Joi.object({
  from: Joi.number().integer().min(-1).max(23).required(), // -1 for bar
  to: Joi.number().integer().min(-1).max(23).required(),   // -1 for bear off
  dice: Joi.array().items(Joi.number().integer().min(1).max(6)).length(2).optional()
});

const addChatSchema = Joi.object({
  message: Joi.string().min(1).max(500).required(),
  type: Joi.string().valid('chat', 'system', 'game').default('chat')
});

const findGameSchema = Joi.object({
  gamePeriod: Joi.string().valid(...Object.values(GamePeriod)).required(),
  gameType: Joi.string().valid(...Object.values(GameType)).default(GameType.NOT_RANKED),
  stepPeriod: Joi.string().valid(...Object.values(StepPeriod)).optional(),
  isPrivate: Joi.boolean().default(false),
  preferences: Joi.object({
    ratingRange: Joi.number().integer().min(0).max(500).default(200),
    acceptLowerRating: Joi.boolean().default(true),
    acceptHigherRating: Joi.boolean().default(true)
  }).default({})
});

// @route   GET /api/games
// @desc    Get user's games
// @access  Private
router.get('/', 
  validateQueryParams(['status', 'limit', 'page']),
  validatePagination,
  async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id.toString();
    const { status, limit = 10, page = 1 } = req.query;

    const query: any = {
      'players.userId': userId
    };

    if (status && Object.values(GameState).includes(status as GameState)) {
      query.gameState = status;
    }

    const games = await GameModel.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * Number(page))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await GameModel.countDocuments(query);

    res.json({
      success: true,
      data: games,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error retrieving games'
    } as ApiResponse);
  }
});

// @route   POST /api/games
// @desc    Create a new game
// @access  Private
router.post('/',
  sanitizeInput,
  validateRequest('game-creation'),
  async (req: Request, res: Response): Promise<void> => {
  try {
    // Use validated data from middleware
    const validatedData = (req as any).validatedData;
    const { gameType, gamePeriod, stepPeriod, opponentId } = validatedData;
    const userId = req.user._id.toString();
    const user = req.user;

    let opponent: any = null;

    if (opponentId && gameType === GameType.NOT_RANKED) {
      opponent = await User.findById(opponentId);
      if (!opponent) {
        res.status(404).json({
          success: false,
          error: 'Opponent not found'
        } as ApiResponse);
        return;
      }
    }

    // Create game using GameStateManager
    const game = await gameStateManager.createGame({
      player1Id: userId,
      player2Id: opponent?._id?.toString(),
      gameType,
      gamePeriod,
      stepPeriod,
      isPrivate: false
    });

    // Update player information with actual user data
    if (game.players && game.players[0]) {
      game.players[0].username = user.username;
      game.players[0].rating = user.rating;
    }

    if (opponent && game.players && game.players[1]) {
      game.players[1].username = opponent.username;
      game.players[1].rating = opponent.rating;
    }

    await game.save();

    // Game created successfully - no automatic matchmaking

    logger.info(`Game created: ${game._id} by user: ${userId}`);

    // Emit socket event for new game available
    emitGameUpdate('game:created', {
      gameId: game._id.toString(),
      creator: user.username,
      gameData: game.toJSON()
    });

    res.status(201).json({
      success: true,
      data: game.toJSON(),
      message: 'Game created successfully'
    } as ApiResponse);
  } catch (error) {
    logger.error('Error creating game:', error);
    res.status(500).json({
      success: false,
      error: 'Server error creating game'
    } as ApiResponse);
  }
});

// @route   GET /api/games/available
// @desc    Get list of games waiting for opponents
// @access  Private
router.get('/available',
  validateQueryParams(['limit']),
  async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      logger.error('No authenticated user found in request');
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }
    
    const userId = req.user._id.toString();
    logger.info(`Getting available games for user: ${userId}`);
    
    // Find games that are waiting for opponents (second player is 'waiting') and not created by current user
    const availableGames = await GameModel.find({
      gameState: GameState.WAITING,
      'players.1.userId': 'waiting', // Second player slot is waiting for someone to join
      'players.0.userId': { $ne: userId } // Not created by current user
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
    
    logger.info(`Found ${availableGames.length} available games`);

    res.json({
      success: true,
      data: availableGames
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting available games:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.user?._id?.toString()
    });
    res.status(500).json({
      success: false,
      error: 'Server error retrieving available games'
    } as ApiResponse);
  }
});

// @route   GET /api/games/my-games
// @desc    Get list of user's active games
// @access  Private
router.get('/my-games',
  validateQueryParams(['status']),
  async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      logger.error('No authenticated user found in my-games request');
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }
    
    const userId = req.user._id.toString();
    logger.info(`Getting my games for user: ${userId}`);
    
    // Find games where user is a player and game is active
    const myGames = await GameModel.find({
      $or: [
        { gameState: GameState.WAITING },
        { gameState: GameState.IN_PROGRESS }
      ],
      'players.userId': userId
    })
    .sort({ updatedAt: -1 })
    .lean();
    
    logger.info(`Found ${myGames.length} user games`);

    // Add status information for each game
    const gamesWithStatus = myGames.map(game => {
      const isCreator = game.players[0]?.userId.toString() === userId;
      let status = 'Waiting for opponent';
      
      if (game.gameState === GameState.IN_PROGRESS) {
        const currentPlayerIndex = game.currentPlayer;
        const isMyTurn = game.players[currentPlayerIndex]?.userId.toString() === userId;
        status = isMyTurn ? 'Your turn' : "Opponent's turn";
      }
      
      return {
        ...game,
        status,
        isCreator
      };
    });

    res.json({
      success: true,
      data: gamesWithStatus
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting my games:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving your games'
    } as ApiResponse);
  }
});

// @route   GET /api/games/history
// @desc    Get list of user's completed games
// @access  Private
router.get('/history',
  validateQueryParams(['page', 'limit']),
  validatePagination,
  async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      logger.error('No authenticated user found in history request');
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      } as ApiResponse);
      return;
    }
    
    const userId = req.user._id.toString();
    logger.info(`Getting game history for user: ${userId}`);
    const { page = 1, limit = 20 } = req.query;
    
    // Find completed games where user was a player
    const historyGames = await GameModel.find({
      $or: [
        { gameState: GameState.FINISHED },
        { gameState: GameState.ABANDONED }
      ],
      'players.userId': userId
    })
    .sort({ endTime: -1, updatedAt: -1 })
    .limit(Number(limit) * Number(page))
    .skip((Number(page) - 1) * Number(limit))
    .lean();
    
    logger.info(`Found ${historyGames.length} history games`);

    const total = await GameModel.countDocuments({
      $or: [
        { gameState: GameState.FINISHED },
        { gameState: GameState.ABANDONED }
      ],
      'players.userId': userId
    });

    // Add result information for each game
    const gamesWithResult = historyGames.map(game => {
      const isWinner = game.winner === userId;
      const result = game.winner ? (isWinner ? 'Won' : 'Lost') : 'Draw';
      
      return {
        ...game,
        result
      };
    });

    res.json({
      success: true,
      data: gamesWithResult,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    } as ApiResponse);
  } catch (error) {
    logger.error('Error getting game history:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving game history'
    } as ApiResponse);
  }
});

// @route   GET /api/games/:id
// @desc    Get game state by ID
// @access  Private
router.get('/:id', 
  validateObjectId('id'),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const game = await gameStateManager.loadGame(id);
    
    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found'
      } as ApiResponse);
      return;
    }

    // Check if user is part of the game or is a spectator
    const isPlayer = game.isPlayerInGame(userId);
    const isSpectator = game.spectators.includes(userId);
    
    // All games are publicly accessible

    // Get current game state from cache or database
    const gameState = await gameStateManager.getGameState(id);

    res.json({
      success: true,
      data: {
        ...game.toJSON(),
        state: gameState
      }
    } as ApiResponse);
  } catch (error) {
    logger.error('Error retrieving game:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving game'
    } as ApiResponse);
  }
});

// @route   PUT /api/games/:id/move
// @desc    Make a move in the game
// @access  Private
router.put('/:id/move', 
  validateObjectId('id'),
  validateGameMove,
  async (req: Request, res: Response): Promise<void> => {
  try {
    // Use validated data from middleware
    const validatedData = (req as any).validatedData;
    const { gameId, move } = validatedData;

    // Process move using GameStateManager
    const stateUpdate = await gameStateManager.processMove(gameId, move.playerId, move);

    res.json({
      success: true,
      data: {
        gameId,
        move: stateUpdate.move,
        state: stateUpdate.state
      },
      message: 'Move made successfully'
    } as ApiResponse);
  } catch (error) {
    logger.error('Error making move:', error);
    const errorMessage = error instanceof Error ? error.message : 'Server error making move';
    res.status(400).json({
      success: false,
      error: errorMessage
    } as ApiResponse);
  }
});

// @route   PUT /api/games/:id/join
// @desc    Join a game as the second player
// @access  Private
router.put('/:id/join', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();
    const user = req.user;

    const game = await GameModel.findById(id);
    
    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found'
      } as ApiResponse);
      return;
    }

    // Check if game is waiting for players
    if (game.gameState !== GameState.WAITING) {
      res.status(400).json({
        success: false,
        error: 'Game is not accepting new players'
      } as ApiResponse);
      return;
    }

    // Check if user is already in the game
    if (game.isPlayerInGame(userId)) {
      res.status(400).json({
        success: false,
        error: 'You are already in this game'
      } as ApiResponse);
      return;
    }

    // Check if there's an empty slot (second player)
    if (game.players[1].userId !== 'waiting') {
      res.status(400).json({
        success: false,
        error: 'Game is full'
      } as ApiResponse);
      return;
    }

    // Add player to the game
    game.players[1] = {
      userId: userId,
      username: user.username,
      rating: user.rating,
      color: 'black',
      timeRemaining: game.gamePeriod === GamePeriod.UNLIMITED ? undefined : getTimeForPeriod(game.gamePeriod),
      isReady: true
    };

    // Start the game if both players are ready
    if (game.players[0].isReady && game.players[1].isReady) {
      game.gameState = GameState.IN_PROGRESS;
      game.startTime = new Date();
    }

    await game.save();

    // Emit socket events for game updates
    emitGameUpdate('game:joined', {
      gameId: game._id.toString(),
      joiner: user.username,
      gameData: game.toJSON(),
      firstPlayer: game.players[0].username
    });

    // Remove game from available games list since it's now full
    emitGameUpdate('game:unavailable', {
      gameId: game._id.toString()
    });

    res.json({
      success: true,
      data: game.toJSON(),
      message: 'Joined game successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error joining game'
    } as ApiResponse);
  }
});

// @route   POST /api/games/:id/chat
// @desc    Send a chat message in the game
// @access  Private
router.post('/:id/chat', 
  validateObjectId('id'),
  sanitizeInput,
  validateChatMessage,
  async (req: Request, res: Response): Promise<void> => {
  try {
    // Use validated data from middleware
    const validatedData = (req as any).validatedData;
    const { id } = req.params;
    const { message, type } = validatedData;
    const userId = req.user._id.toString();
    const username = req.user.username;

    const game = await GameModel.findById(id);
    
    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found'
      } as ApiResponse);
      return;
    }

    // Check if user is part of the game or is a spectator
    const isPlayer = game.isPlayerInGame(userId);
    const isSpectator = game.spectators.includes(userId);
    
    if (!isPlayer && !isSpectator) {
      res.status(403).json({
        success: false,
        error: 'You must be a player or spectator to chat'
      } as ApiResponse);
      return;
    }

    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      username,
      message,
      timestamp: new Date(),
      type: type || 'chat'
    };

    game.chatMessages.push(chatMessage);
    await game.save();

    res.json({
      success: true,
      data: chatMessage,
      message: 'Chat message sent'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error sending message'
    } as ApiResponse);
  }
});

// @route   POST /api/games/:id/spectate
// @desc    Join as spectator
// @access  Private
router.post('/:id/spectate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const game = await GameModel.findById(id);
    
    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found'
      } as ApiResponse);
      return;
    }

    // All games can be spectated

    // Can't spectate if you're already a player
    if (game.isPlayerInGame(userId)) {
      res.status(400).json({
        success: false,
        error: 'Players cannot spectate their own game'
      } as ApiResponse);
      return;
    }

    await game.addSpectator(userId);

    res.json({
      success: true,
      message: 'Joined as spectator'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error joining as spectator'
    } as ApiResponse);
  }
});

// @route   POST /api/games/find
// @desc    Find a game using matchmaking
// @access  Private
router.post('/find',
  sanitizeInput,
  validateRequest('find-game'),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = (req as any).validatedData;
    const { gamePeriod, gameType, preferences } = validatedData;
    const userId = req.user._id.toString();
    const user = req.user;

    // Check if user is already in matchmaking queue - skip this check for now
    const redisService = getRedisService();
    
    // Try to find immediate match
    const opponent = await redisService.findMatchmakingOpponent(
      userId,
      user.rating,
      gamePeriod,
      preferences?.ratingRange || 200
    );

    if (opponent) {
      let game;
      
      // Check if opponent already has a game waiting (from create game flow)
      if (opponent.gameId) {
        // Join existing game
        game = await GameModel.findById(opponent.gameId);
        if (game && game.players.length < 2) {
          // Add second player to existing game
          game.players.push({
            userId: user._id.toString(),
            username: user.username,
            rating: user.rating,
            color: 'black',
            timeRemaining: game.gamePeriod === GamePeriod.UNLIMITED ? undefined : getTimeForPeriod(game.gamePeriod),
            isReady: true
          });
          await game.save();
          
          logger.info(`User ${user.username} joined existing game: ${game._id}`);
        } else {
          // Game is full or doesn't exist, create new one
          game = await gameStateManager.createGame({
            player1Id: userId,
            player2Id: opponent.userId,
            gameType: gameType || GameType.NOT_RANKED,
            gamePeriod,
            isPrivate: false
          });
        }
      } else {
        // Create new game
        game = await gameStateManager.createGame({
          player1Id: userId,
          player2Id: opponent.userId,
          gameType: gameType || GameType.NOT_RANKED,
          gamePeriod,
          isPrivate: false
        });
      }

      // Update player information
      if (game.players && game.players[0]) {
        game.players[0].username = user.username;
        game.players[0].rating = user.rating;
      }

      if (game.players && game.players[1]) {
        const opponentUser = await User.findById(opponent.userId);
        if (opponentUser) {
          game.players[1].username = opponentUser.username;
          game.players[1].rating = opponentUser.rating;
        }
      }

      await game.save();

      logger.info(`Instant match found: ${user.username} vs ${opponent.username}`);

      res.json({
        success: true,
        data: {
          gameId: game._id.toString(),
          opponent: {
            id: opponent.userId,
            username: opponent.username,
            rating: opponent.rating
          },
          matchFound: true
        },
        message: 'Match found!'
      } as ApiResponse);
    } else {
      // Add to matchmaking queue
      const queueData = {
        userId,
        username: user.username,
        rating: user.rating,
        gamePeriod,
        isPrivate: false,
        preferences: preferences || {},
        joinedAt: Date.now()
      };

      await redisService.addToMatchmakingQueue(queueData);

      const queuePosition = 1; // Simplified - would need to implement queue position tracking

      logger.info(`${user.username} added to matchmaking queue, position: ${queuePosition}`);

      res.json({
        success: true,
        data: {
          queuePosition,
          estimatedWaitTime: queuePosition * 30, // rough estimate: 30 seconds per position
          matchFound: false
        },
        message: 'Added to matchmaking queue'
      } as ApiResponse);
    }
  } catch (error) {
    logger.error('Find game error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error finding game'
    } as ApiResponse);
  }
});

// @route   DELETE /api/games/find
// @desc    Leave matchmaking queue
// @access  Private
router.delete('/find', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id.toString();
    const redisService = getRedisService();

    await redisService.removeFromMatchmakingQueue(userId);

    logger.info(`${req.user.username} left matchmaking queue`);

    res.json({
      success: true,
      message: 'Left matchmaking queue'
    } as ApiResponse);
  } catch (error) {
    logger.error('Leave matchmaking error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error leaving matchmaking'
    } as ApiResponse);
  }
});

// @route   GET /api/games/find/status
// @desc    Get current matchmaking status
// @access  Private
router.get('/find/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user._id.toString();
    const redisService = getRedisService();

    // For now, return simple status - would need to implement proper queue tracking
    res.json({
      success: true,
      data: {
        inQueue: false // Simplified implementation
      }
    } as ApiResponse);
  } catch (error) {
    logger.error('Get matchmaking status error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting matchmaking status'
    } as ApiResponse);
  }
});

export default router;
