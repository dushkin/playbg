import express from 'express';
import { Response } from '../types/custom-express';
import Joi from 'joi';
import { AuthenticatedRequest } from '../middleware/auth';
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
  GameSpeed,
  GameState,
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

const router = express.Router();

// Helper function to get time limits based on game speed
function getTimeForSpeed(speed: GameSpeed): number {
  switch (speed) {
    case GameSpeed.BLITZ:
      return 3 * 60 * 1000; // 3 minutes in milliseconds
    case GameSpeed.RAPID:
      return 10 * 60 * 1000; // 10 minutes
    case GameSpeed.STANDARD:
      return 30 * 60 * 1000; // 30 minutes
    case GameSpeed.UNLIMITED:
    default:
      return 0; // No time limit
  }
}

// Validation schemas
const createGameSchema = Joi.object({
  gameType: Joi.string().valid(...Object.values(GameType)).required(),
  gameSpeed: Joi.string().valid(...Object.values(GameSpeed)).required(),
  opponentId: Joi.string().optional() // For private games
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

// @route   GET /api/games
// @desc    Get user's games
// @access  Private
router.get('/', 
  validateQueryParams(['status', 'limit', 'page']),
  validatePagination,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Use validated data from middleware
    const validatedData = (req as any).validatedData;
    const { gameType, gameSpeed, opponentId } = validatedData;
    const userId = req.user._id.toString();

    let opponent: any = null;
    
    if (opponentId && gameType === GameType.PRIVATE) {
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
      gameSpeed,
      isPrivate: gameType === GameType.PRIVATE
    });

    logger.info(`Game created: ${game._id} by user: ${userId}`);

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

// @route   GET /api/games/:id
// @desc    Get game state by ID
// @access  Private
router.get('/:id', 
  validateObjectId('id'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    
    if (!isPlayer && !isSpectator && (game as any).isPrivate) {
      res.status(403).json({
        success: false,
        error: 'Access denied to this game'
      } as ApiResponse);
      return;
    }

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
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
router.put('/:id/join', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      timeRemaining: game.gameSpeed === GameSpeed.UNLIMITED ? undefined : getTimeForSpeed(game.gameSpeed),
      isReady: true
    };

    // Start the game if both players are ready
    if (game.players[0].isReady && game.players[1].isReady) {
      game.gameState = GameState.IN_PROGRESS;
      game.startTime = new Date();
    }

    await game.save();

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
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
router.post('/:id/spectate', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Can't spectate private games unless you're a player
    if (game.gameType === GameType.PRIVATE && !game.isPlayerInGame(userId)) {
      res.status(403).json({
        success: false,
        error: 'Cannot spectate private games'
      } as ApiResponse);
      return;
    }

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

export default router;
