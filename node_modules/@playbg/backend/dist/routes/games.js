"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const Game_1 = require("../models/Game");
const User_1 = require("../models/User");
const gameStateManager_1 = require("../services/gameStateManager");
const logger_1 = require("../utils/logger");
const shared_1 = require("@playbg/shared");
const validation_1 = require("../middleware/validation");
const router = express_1.default.Router();
// Helper function to get time limits based on game speed
function getTimeForSpeed(speed) {
    switch (speed) {
        case shared_1.GameSpeed.BLITZ:
            return 3 * 60 * 1000; // 3 minutes in milliseconds
        case shared_1.GameSpeed.RAPID:
            return 10 * 60 * 1000; // 10 minutes
        case shared_1.GameSpeed.STANDARD:
            return 30 * 60 * 1000; // 30 minutes
        case shared_1.GameSpeed.UNLIMITED:
        default:
            return 0; // No time limit
    }
}
// Validation schemas
const createGameSchema = joi_1.default.object({
    gameType: joi_1.default.string().valid(...Object.values(shared_1.GameType)).required(),
    gameSpeed: joi_1.default.string().valid(...Object.values(shared_1.GameSpeed)).required(),
    opponentId: joi_1.default.string().optional() // For private games
});
const makeMoveSchema = joi_1.default.object({
    from: joi_1.default.number().integer().min(-1).max(23).required(), // -1 for bar
    to: joi_1.default.number().integer().min(-1).max(23).required(), // -1 for bear off
    dice: joi_1.default.array().items(joi_1.default.number().integer().min(1).max(6)).length(2).optional()
});
const addChatSchema = joi_1.default.object({
    message: joi_1.default.string().min(1).max(500).required(),
    type: joi_1.default.string().valid('chat', 'system', 'game').default('chat')
});
// @route   GET /api/games
// @desc    Get user's games
// @access  Private
router.get('/', (0, validation_1.validateQueryParams)(['status', 'limit', 'page']), validation_1.validatePagination, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const { status, limit = 10, page = 1 } = req.query;
        const query = {
            'players.userId': userId
        };
        if (status && Object.values(shared_1.GameState).includes(status)) {
            query.gameState = status;
        }
        const games = await Game_1.GameModel.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit) * Number(page))
            .skip((Number(page) - 1) * Number(limit))
            .lean();
        const total = await Game_1.GameModel.countDocuments(query);
        res.json({
            success: true,
            data: games,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error retrieving games'
        });
    }
});
// @route   POST /api/games
// @desc    Create a new game
// @access  Private
router.post('/', validation_1.sanitizeInput, (0, validation_1.validateRequest)('game-creation'), async (req, res) => {
    try {
        // Use validated data from middleware
        const validatedData = req.validatedData;
        const { gameType, gameSpeed, opponentId } = validatedData;
        const userId = req.user._id.toString();
        let opponent = null;
        if (opponentId && gameType === shared_1.GameType.PRIVATE) {
            opponent = await User_1.User.findById(opponentId);
            if (!opponent) {
                res.status(404).json({
                    success: false,
                    error: 'Opponent not found'
                });
                return;
            }
        }
        // Create game using GameStateManager
        const game = await gameStateManager_1.gameStateManager.createGame({
            player1Id: userId,
            player2Id: opponent?._id?.toString(),
            gameType,
            gameSpeed,
            isPrivate: gameType === shared_1.GameType.PRIVATE
        });
        logger_1.logger.info(`Game created: ${game._id} by user: ${userId}`);
        res.status(201).json({
            success: true,
            data: game.toJSON(),
            message: 'Game created successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating game:', error);
        res.status(500).json({
            success: false,
            error: 'Server error creating game'
        });
    }
});
// @route   GET /api/games/:id
// @desc    Get game state by ID
// @access  Private
router.get('/:id', (0, validation_1.validateObjectId)('id'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id.toString();
        const game = await gameStateManager_1.gameStateManager.loadGame(id);
        if (!game) {
            res.status(404).json({
                success: false,
                error: 'Game not found'
            });
            return;
        }
        // Check if user is part of the game or is a spectator
        const isPlayer = game.isPlayerInGame(userId);
        const isSpectator = game.spectators.includes(userId);
        if (!isPlayer && !isSpectator && game.isPrivate) {
            res.status(403).json({
                success: false,
                error: 'Access denied to this game'
            });
            return;
        }
        // Get current game state from cache or database
        const gameState = await gameStateManager_1.gameStateManager.getGameState(id);
        res.json({
            success: true,
            data: {
                ...game.toJSON(),
                state: gameState
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Error retrieving game:', error);
        res.status(500).json({
            success: false,
            error: 'Server error retrieving game'
        });
    }
});
// @route   PUT /api/games/:id/move
// @desc    Make a move in the game
// @access  Private
router.put('/:id/move', (0, validation_1.validateObjectId)('id'), validation_1.validateGameMove, async (req, res) => {
    try {
        // Use validated data from middleware
        const validatedData = req.validatedData;
        const { gameId, move } = validatedData;
        // Process move using GameStateManager
        const stateUpdate = await gameStateManager_1.gameStateManager.processMove(gameId, move.playerId, move);
        res.json({
            success: true,
            data: {
                gameId,
                move: stateUpdate.move,
                state: stateUpdate.state
            },
            message: 'Move made successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error making move:', error);
        const errorMessage = error instanceof Error ? error.message : 'Server error making move';
        res.status(400).json({
            success: false,
            error: errorMessage
        });
    }
});
// @route   PUT /api/games/:id/join
// @desc    Join a game as the second player
// @access  Private
router.put('/:id/join', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id.toString();
        const user = req.user;
        const game = await Game_1.GameModel.findById(id);
        if (!game) {
            res.status(404).json({
                success: false,
                error: 'Game not found'
            });
            return;
        }
        // Check if game is waiting for players
        if (game.gameState !== shared_1.GameState.WAITING) {
            res.status(400).json({
                success: false,
                error: 'Game is not accepting new players'
            });
            return;
        }
        // Check if user is already in the game
        if (game.isPlayerInGame(userId)) {
            res.status(400).json({
                success: false,
                error: 'You are already in this game'
            });
            return;
        }
        // Check if there's an empty slot (second player)
        if (game.players[1].userId !== 'waiting') {
            res.status(400).json({
                success: false,
                error: 'Game is full'
            });
            return;
        }
        // Add player to the game
        game.players[1] = {
            userId: userId,
            username: user.username,
            rating: user.rating,
            color: 'black',
            timeRemaining: game.gameSpeed === shared_1.GameSpeed.UNLIMITED ? undefined : getTimeForSpeed(game.gameSpeed),
            isReady: true
        };
        // Start the game if both players are ready
        if (game.players[0].isReady && game.players[1].isReady) {
            game.gameState = shared_1.GameState.IN_PROGRESS;
            game.startTime = new Date();
        }
        await game.save();
        res.json({
            success: true,
            data: game.toJSON(),
            message: 'Joined game successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error joining game'
        });
    }
});
// @route   POST /api/games/:id/chat
// @desc    Send a chat message in the game
// @access  Private
router.post('/:id/chat', (0, validation_1.validateObjectId)('id'), validation_1.sanitizeInput, validation_1.validateChatMessage, async (req, res) => {
    try {
        // Use validated data from middleware
        const validatedData = req.validatedData;
        const { id } = req.params;
        const { message, type } = validatedData;
        const userId = req.user._id.toString();
        const username = req.user.username;
        const game = await Game_1.GameModel.findById(id);
        if (!game) {
            res.status(404).json({
                success: false,
                error: 'Game not found'
            });
            return;
        }
        // Check if user is part of the game or is a spectator
        const isPlayer = game.isPlayerInGame(userId);
        const isSpectator = game.spectators.includes(userId);
        if (!isPlayer && !isSpectator) {
            res.status(403).json({
                success: false,
                error: 'You must be a player or spectator to chat'
            });
            return;
        }
        const chatMessage = {
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
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error sending message'
        });
    }
});
// @route   POST /api/games/:id/spectate
// @desc    Join as spectator
// @access  Private
router.post('/:id/spectate', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id.toString();
        const game = await Game_1.GameModel.findById(id);
        if (!game) {
            res.status(404).json({
                success: false,
                error: 'Game not found'
            });
            return;
        }
        // Can't spectate private games unless you're a player
        if (game.gameType === shared_1.GameType.PRIVATE && !game.isPlayerInGame(userId)) {
            res.status(403).json({
                success: false,
                error: 'Cannot spectate private games'
            });
            return;
        }
        // Can't spectate if you're already a player
        if (game.isPlayerInGame(userId)) {
            res.status(400).json({
                success: false,
                error: 'Players cannot spectate their own game'
            });
            return;
        }
        await game.addSpectator(userId);
        res.json({
            success: true,
            message: 'Joined as spectator'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error joining as spectator'
        });
    }
});
exports.default = router;
//# sourceMappingURL=games.js.map