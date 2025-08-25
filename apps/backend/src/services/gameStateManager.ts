import { BackgammonEngine } from '@playbg/game-logic';
import { GameModel, IGameDocument } from '../models/Game';
import { redisService } from './redisService';
import { logger } from '../utils/logger';
import {
  GameState,
  GameMove,
  ChatMessage,
  GameSpeed,
  GameType
} from '@playbg/shared';

export interface GameStateUpdate {
  gameId: string;
  move?: GameMove;
  state?: Partial<GameState>;
  chatMessage?: ChatMessage;
  playerAction?: {
    playerId: string;
    action: 'roll_dice' | 'end_turn' | 'forfeit' | 'request_draw' | 'accept_draw' | 'reject_draw';
    data?: any;
  };
}

export interface GameCreationOptions {
  player1Id: string;
  player2Id?: string;
  gameType: GameType;
  gameSpeed: GameSpeed;
  isPrivate: boolean;
  spectators?: string[];
}

export class GameStateManager {
  private static instance: GameStateManager;
  private engines: Map<string, BackgammonEngine> = new Map();

  private constructor() {}

  public static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  /**
   * Create a new game with BackgammonEngine
   */
  public async createGame(options: GameCreationOptions): Promise<IGameDocument> {
    try {
      // Create BackgammonEngine instance
      const engine = new BackgammonEngine();

      const initialState = {
        board: engine.getBoardState(),
        currentPlayer: 0 as 0 | 1,
        dice: null,
        moves: []
      };

      // Create game document
      const gameDoc = new GameModel({
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
      const gameId = (gameDoc._id as any).toString();

      // Store engine instance
      this.engines.set(gameId, engine);

      // Cache in Redis
      await redisService.setGameSession({
        gameId,
        players: [options.player1Id, options.player2Id].filter(Boolean) as string[],
        spectators: options.spectators || [],
        state: initialState,
        lastActivity: Date.now()
      });

      // Cache game state
      await redisService.cacheGameState(gameId, initialState);

      logger.info(`Created new game: ${gameId} with players: ${options.player1Id}, ${options.player2Id}`);
      return gameDoc;
    } catch (error) {
      logger.error('Error creating game:', error);
      throw error;
    }
  }

  /**
   * Load game state from database or cache
   */
  public async loadGame(gameId: string): Promise<IGameDocument | null> {
    try {
      // Load game document from database
      const gameDoc = await GameModel.findById(gameId);
      if (!gameDoc) {
        return null;
      }

      // Restore BackgammonEngine state if not already loaded
      if (!this.engines.has(gameId)) {
        const engine = new BackgammonEngine();
        // TODO: Implement state restoration when needed
        this.engines.set(gameId, engine);
      }

      return gameDoc;
    } catch (error) {
      logger.error(`Error loading game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Process a game move
   */
  public async processMove(gameId: string, playerId: string, move: GameMove): Promise<GameStateUpdate> {
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
      
      await redisService.cacheGameState(gameId, newState);
      await redisService.updateGameSession(gameId, {
        state: newState,
        lastActivity: Date.now()
      });

      const stateUpdate: GameStateUpdate = {
        gameId,
        move,
        state: {
          board: updatedBoard,
          currentPlayer,
          dice: currentDice
        } as any
      };

      // Publish game event
      await redisService.publishGameEvent(gameId, 'move', stateUpdate);

      logger.info(`Processed move for game ${gameId}: ${JSON.stringify(move)}`);
      return stateUpdate;
    } catch (error) {
      logger.error(`Error processing move for game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Roll dice for a player
   */
  public async rollDice(gameId: string, playerId: string): Promise<GameStateUpdate> {
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
      
      await redisService.cacheGameState(gameId, newState);
      await redisService.updateGameSession(gameId, {
        state: newState,
        lastActivity: Date.now()
      });

      const stateUpdate: GameStateUpdate = {
        gameId,
        state: { dice } as any
      };

      // Publish game event
      await redisService.publishGameEvent(gameId, 'dice_roll', stateUpdate);

      logger.info(`Player ${playerId} rolled dice in game ${gameId}: [${dice.join(', ')}]`);
      return stateUpdate;
    } catch (error) {
      logger.error(`Error rolling dice for game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Add chat message to game
   */
  public async addChatMessage(gameId: string, playerId: string, message: string): Promise<GameStateUpdate> {
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

      const chatMessage: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: message.trim(),
        timestamp: new Date(),
        type: 'chat'
      } as any;

      // Add to database
      await gameDoc.addChatMessage(chatMessage);

      // Update cache
      await redisService.updateGameSession(gameId, {
        lastActivity: Date.now()
      });

      const stateUpdate: GameStateUpdate = {
        gameId,
        chatMessage
      };

      // Publish game event
      await redisService.publishGameEvent(gameId, 'chat', stateUpdate);

      logger.info(`Chat message added to game ${gameId} by player ${playerId}`);
      return stateUpdate;
    } catch (error) {
      logger.error(`Error adding chat message to game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Add player to game (for joining empty slot)
   */
  public async addPlayer(gameId: string, playerId: string): Promise<IGameDocument> {
    try {
      const gameDoc = await this.loadGame(gameId);
      if (!gameDoc) {
        throw new Error(`Game not found: ${gameId}`);
      }

      // For now, just return the game document
      // TODO: Implement proper player joining logic
      return gameDoc;
    } catch (error) {
      logger.error(`Error adding player to game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Add spectator to game
   */
  public async addSpectator(gameId: string, spectatorId: string): Promise<IGameDocument> {
    try {
      const gameDoc = await this.loadGame(gameId);
      if (!gameDoc) {
        throw new Error(`Game not found: ${gameId}`);
      }

      if (!gameDoc.spectators.includes(spectatorId)) {
        gameDoc.spectators.push(spectatorId);
        await gameDoc.save();

        // Update cache
        await redisService.updateGameSession(gameId, {
          spectators: gameDoc.spectators,
          lastActivity: Date.now()
        });

        // Publish game event
        await redisService.publishGameEvent(gameId, 'spectator_joined', {
          gameId,
          spectatorId
        });

        logger.info(`Spectator ${spectatorId} joined game ${gameId}`);
      }

      return gameDoc;
    } catch (error) {
      logger.error(`Error adding spectator to game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Remove spectator from game
   */
  public async removeSpectator(gameId: string, spectatorId: string): Promise<void> {
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
        await redisService.updateGameSession(gameId, {
          spectators: gameDoc.spectators,
          lastActivity: Date.now()
        });

        // Publish game event
        await redisService.publishGameEvent(gameId, 'spectator_left', {
          gameId,
          spectatorId
        });

        logger.info(`Spectator ${spectatorId} left game ${gameId}`);
      }
    } catch (error) {
      logger.error(`Error removing spectator from game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Cleanup game resources
   */
  public async cleanupGame(gameId: string): Promise<void> {
    try {
      // Remove engine instance
      this.engines.delete(gameId);

      // Clear from Redis
      await redisService.deleteGameSession(gameId);
      await redisService.invalidateGameStateCache(gameId);
      await redisService.unsubscribeFromGameEvents(gameId);

      logger.info(`Cleaned up game resources for: ${gameId}`);
    } catch (error) {
      logger.error(`Error cleaning up game ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Get current game state
   */
  public async getGameState(gameId: string): Promise<GameState | null> {
    try {
      // Try cache first
      let state = await redisService.getCachedGameState(gameId);
      
      if (!state) {
        // Load from database
        const gameDoc = await GameModel.findById(gameId);
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
        await redisService.cacheGameState(gameId, state);
      }

      return state;
    } catch (error) {
      logger.error(`Error getting game state for ${gameId}:`, error);
      return null;
    }
  }

  // Helper methods removed for simplification

  /**
   * Get active games count
   */
  public getActiveGamesCount(): number {
    return this.engines.size;
  }

  /**
   * Cleanup inactive games (run periodically)
   */
  public async cleanupInactiveGames(inactiveMinutes: number = 60): Promise<number> {
    const cutoffTime = Date.now() - (inactiveMinutes * 60 * 1000);
    let cleaned = 0;

    for (const [gameId, engine] of this.engines.entries()) {
      try {
        const session = await redisService.getGameSession(gameId);
        if (!session || session.lastActivity < cutoffTime) {
          await this.cleanupGame(gameId);
          cleaned++;
        }
      } catch (error) {
        logger.error(`Error checking game activity for ${gameId}:`, error);
      }
    }

    logger.info(`Cleaned up ${cleaned} inactive games`);
    return cleaned;
  }
}

export const gameStateManager = GameStateManager.getInstance();