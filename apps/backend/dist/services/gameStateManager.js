"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameStateManager = exports.GameStateManager = void 0;
const game_logic_1 = require("@playbg/game-logic");
const Game_1 = require("../models/Game");
const redisService_1 = require("./redisService");
const logger_1 = require("../utils/logger");
class GameStateManager {
    constructor() {
        this.engines = new Map();
    }
    static getInstance() {
        if (!GameStateManager.instance) {
            GameStateManager.instance = new GameStateManager();
        }
        return GameStateManager.instance;
    }
    /**
     * Create a new game with BackgammonEngine
     */
    async createGame(options) {
        try {
            // Create BackgammonEngine instance
            const engine = new game_logic_1.BackgammonEngine();
            const initialState = {
                board: engine.getBoardState(),
                currentPlayer: 0,
                dice: null,
                moves: []
            };
            // Create game document
            const gameDoc = new Game_1.GameModel({
                player1: options.player1Id,
                player2: options.player2Id,
                gameType: options.gameType,
                gameSpeed: options.gameSpeed,
                isPrivate: options.isPrivate,
                spectators: options.spectators || [],
                state: initialState,
                chatMessages: []
            });
            await gameDoc.save();
            const gameId = gameDoc._id.toString();
            // Store engine instance
            this.engines.set(gameId, engine);
            // Cache in Redis
            await redisService_1.redisService.setGameSession({
                gameId,
                players: [options.player1Id, options.player2Id].filter(Boolean),
                spectators: options.spectators || [],
                state: initialState,
                lastActivity: Date.now()
            });
            // Cache game state
            await redisService_1.redisService.cacheGameState(gameId, initialState);
            logger_1.logger.info(`Created new game: ${gameId} with players: ${options.player1Id}, ${options.player2Id}`);
            return gameDoc;
        }
        catch (error) {
            logger_1.logger.error('Error creating game:', error);
            throw error;
        }
    }
    /**
     * Load game state from database or cache
     */
    async loadGame(gameId) {
        try {
            // Load game document from database
            const gameDoc = await Game_1.GameModel.findById(gameId);
            if (!gameDoc) {
                return null;
            }
            // Restore BackgammonEngine state if not already loaded
            if (!this.engines.has(gameId)) {
                const engine = new game_logic_1.BackgammonEngine();
                // TODO: Implement state restoration when needed
                this.engines.set(gameId, engine);
            }
            return gameDoc;
        }
        catch (error) {
            logger_1.logger.error(`Error loading game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Process a game move
     */
    async processMove(gameId, playerId, move) {
        try {
            const gameDoc = await this.loadGame(gameId);
            if (!gameDoc) {
                throw new Error(`Game not found: ${gameId}`);
            }
            // Get BackgammonEngine instance
            const engine = this.engines.get(gameId);
            if (!engine) {
                throw new Error(`Game engine not found for game: ${gameId}`);
            }
            // Validate player is in game
            if (!gameDoc.isPlayerInGame(playerId)) {
                throw new Error('Player not in game');
            }
            // For now, just validate the move format and add it to moves
            const isValidMove = engine.makeMove(move);
            if (!isValidMove) {
                throw new Error('Invalid move');
            }
            // Update game state with engine results
            const updatedBoard = engine.getBoardState();
            const currentPlayer = engine.getCurrentPlayer();
            const currentDice = engine.getCurrentDice();
            // Add move to game
            await gameDoc.addMove(move);
            // Update cache
            const newState = {
                board: updatedBoard,
                currentPlayer,
                dice: currentDice,
                moves: [...gameDoc.moves, move]
            };
            await redisService_1.redisService.cacheGameState(gameId, newState);
            await redisService_1.redisService.updateGameSession(gameId, {
                state: newState,
                lastActivity: Date.now()
            });
            const stateUpdate = {
                gameId,
                move,
                state: {
                    board: updatedBoard,
                    currentPlayer,
                    dice: currentDice
                }
            };
            // Publish game event
            await redisService_1.redisService.publishGameEvent(gameId, 'move', stateUpdate);
            logger_1.logger.info(`Processed move for game ${gameId}: ${JSON.stringify(move)}`);
            return stateUpdate;
        }
        catch (error) {
            logger_1.logger.error(`Error processing move for game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Roll dice for a player
     */
    async rollDice(gameId, playerId) {
        try {
            const gameDoc = await this.loadGame(gameId);
            if (!gameDoc) {
                throw new Error(`Game not found: ${gameId}`);
            }
            const engine = this.engines.get(gameId);
            if (!engine) {
                throw new Error(`Game engine not found for game: ${gameId}`);
            }
            // Validate player is in game
            if (!gameDoc.isPlayerInGame(playerId)) {
                throw new Error('Player not in game');
            }
            // Roll dice using BackgammonEngine
            const dice = engine.rollDice();
            // Update cache
            const newState = {
                board: engine.getBoardState(),
                currentPlayer: engine.getCurrentPlayer(),
                dice,
                moves: gameDoc.moves
            };
            await redisService_1.redisService.cacheGameState(gameId, newState);
            await redisService_1.redisService.updateGameSession(gameId, {
                state: newState,
                lastActivity: Date.now()
            });
            const stateUpdate = {
                gameId,
                state: { dice }
            };
            // Publish game event
            await redisService_1.redisService.publishGameEvent(gameId, 'dice_roll', stateUpdate);
            logger_1.logger.info(`Player ${playerId} rolled dice in game ${gameId}: [${dice.join(', ')}]`);
            return stateUpdate;
        }
        catch (error) {
            logger_1.logger.error(`Error rolling dice for game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Add chat message to game
     */
    async addChatMessage(gameId, playerId, message) {
        try {
            const gameDoc = await this.loadGame(gameId);
            if (!gameDoc) {
                throw new Error(`Game not found: ${gameId}`);
            }
            // Validate player is in game or spectator
            const isPlayer = gameDoc.isPlayerInGame(playerId);
            const isSpectator = gameDoc.spectators.includes(playerId);
            if (!isPlayer && !isSpectator) {
                throw new Error('Player not in game');
            }
            const chatMessage = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                message: message.trim(),
                timestamp: new Date(),
                type: 'chat'
            };
            // Add to database
            await gameDoc.addChatMessage(chatMessage);
            // Update cache
            await redisService_1.redisService.updateGameSession(gameId, {
                lastActivity: Date.now()
            });
            const stateUpdate = {
                gameId,
                chatMessage
            };
            // Publish game event
            await redisService_1.redisService.publishGameEvent(gameId, 'chat', stateUpdate);
            logger_1.logger.info(`Chat message added to game ${gameId} by player ${playerId}`);
            return stateUpdate;
        }
        catch (error) {
            logger_1.logger.error(`Error adding chat message to game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Add player to game (for joining empty slot)
     */
    async addPlayer(gameId, playerId) {
        try {
            const gameDoc = await this.loadGame(gameId);
            if (!gameDoc) {
                throw new Error(`Game not found: ${gameId}`);
            }
            // For now, just return the game document
            // TODO: Implement proper player joining logic
            return gameDoc;
        }
        catch (error) {
            logger_1.logger.error(`Error adding player to game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Add spectator to game
     */
    async addSpectator(gameId, spectatorId) {
        try {
            const gameDoc = await this.loadGame(gameId);
            if (!gameDoc) {
                throw new Error(`Game not found: ${gameId}`);
            }
            if (!gameDoc.spectators.includes(spectatorId)) {
                gameDoc.spectators.push(spectatorId);
                await gameDoc.save();
                // Update cache
                await redisService_1.redisService.updateGameSession(gameId, {
                    spectators: gameDoc.spectators,
                    lastActivity: Date.now()
                });
                // Publish game event
                await redisService_1.redisService.publishGameEvent(gameId, 'spectator_joined', {
                    gameId,
                    spectatorId
                });
                logger_1.logger.info(`Spectator ${spectatorId} joined game ${gameId}`);
            }
            return gameDoc;
        }
        catch (error) {
            logger_1.logger.error(`Error adding spectator to game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Remove spectator from game
     */
    async removeSpectator(gameId, spectatorId) {
        try {
            const gameDoc = await this.loadGame(gameId);
            if (!gameDoc) {
                throw new Error(`Game not found: ${gameId}`);
            }
            const index = gameDoc.spectators.indexOf(spectatorId);
            if (index !== -1) {
                gameDoc.spectators.splice(index, 1);
                await gameDoc.save();
                // Update cache
                await redisService_1.redisService.updateGameSession(gameId, {
                    spectators: gameDoc.spectators,
                    lastActivity: Date.now()
                });
                // Publish game event
                await redisService_1.redisService.publishGameEvent(gameId, 'spectator_left', {
                    gameId,
                    spectatorId
                });
                logger_1.logger.info(`Spectator ${spectatorId} left game ${gameId}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error removing spectator from game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Cleanup game resources
     */
    async cleanupGame(gameId) {
        try {
            // Remove engine instance
            this.engines.delete(gameId);
            // Clear from Redis
            await redisService_1.redisService.deleteGameSession(gameId);
            await redisService_1.redisService.invalidateGameStateCache(gameId);
            await redisService_1.redisService.unsubscribeFromGameEvents(gameId);
            logger_1.logger.info(`Cleaned up game resources for: ${gameId}`);
        }
        catch (error) {
            logger_1.logger.error(`Error cleaning up game ${gameId}:`, error);
            throw error;
        }
    }
    /**
     * Get current game state
     */
    async getGameState(gameId) {
        try {
            // Try cache first
            let state = await redisService_1.redisService.getCachedGameState(gameId);
            if (!state) {
                // Load from database
                const gameDoc = await Game_1.GameModel.findById(gameId);
                if (!gameDoc) {
                    return null;
                }
                // For now, return a basic state
                state = {
                    board: null,
                    currentPlayer: 0,
                    dice: null,
                    moves: []
                };
                // Cache for future use
                await redisService_1.redisService.cacheGameState(gameId, state);
            }
            return state;
        }
        catch (error) {
            logger_1.logger.error(`Error getting game state for ${gameId}:`, error);
            return null;
        }
    }
    // Helper methods removed for simplification
    /**
     * Get active games count
     */
    getActiveGamesCount() {
        return this.engines.size;
    }
    /**
     * Cleanup inactive games (run periodically)
     */
    async cleanupInactiveGames(inactiveMinutes = 60) {
        const cutoffTime = Date.now() - (inactiveMinutes * 60 * 1000);
        let cleaned = 0;
        for (const [gameId, engine] of this.engines.entries()) {
            try {
                const session = await redisService_1.redisService.getGameSession(gameId);
                if (!session || session.lastActivity < cutoffTime) {
                    await this.cleanupGame(gameId);
                    cleaned++;
                }
            }
            catch (error) {
                logger_1.logger.error(`Error checking game activity for ${gameId}:`, error);
            }
        }
        logger_1.logger.info(`Cleaned up ${cleaned} inactive games`);
        return cleaned;
    }
}
exports.GameStateManager = GameStateManager;
exports.gameStateManager = GameStateManager.getInstance();
//# sourceMappingURL=gameStateManager.js.map