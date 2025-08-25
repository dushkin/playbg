import { IGameDocument } from '../models/Game';
import { GameState, GameMove, ChatMessage, GameSpeed, GameType } from '@playbg/shared';
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
export declare class GameStateManager {
    private static instance;
    private engines;
    private constructor();
    static getInstance(): GameStateManager;
    /**
     * Create a new game with BackgammonEngine
     */
    createGame(options: GameCreationOptions): Promise<IGameDocument>;
    /**
     * Load game state from database or cache
     */
    loadGame(gameId: string): Promise<IGameDocument | null>;
    /**
     * Process a game move
     */
    processMove(gameId: string, playerId: string, move: GameMove): Promise<GameStateUpdate>;
    /**
     * Roll dice for a player
     */
    rollDice(gameId: string, playerId: string): Promise<GameStateUpdate>;
    /**
     * Add chat message to game
     */
    addChatMessage(gameId: string, playerId: string, message: string): Promise<GameStateUpdate>;
    /**
     * Add player to game (for joining empty slot)
     */
    addPlayer(gameId: string, playerId: string): Promise<IGameDocument>;
    /**
     * Add spectator to game
     */
    addSpectator(gameId: string, spectatorId: string): Promise<IGameDocument>;
    /**
     * Remove spectator from game
     */
    removeSpectator(gameId: string, spectatorId: string): Promise<void>;
    /**
     * Cleanup game resources
     */
    cleanupGame(gameId: string): Promise<void>;
    /**
     * Get current game state
     */
    getGameState(gameId: string): Promise<GameState | null>;
    /**
     * Get active games count
     */
    getActiveGamesCount(): number;
    /**
     * Cleanup inactive games (run periodically)
     */
    cleanupInactiveGames(inactiveMinutes?: number): Promise<number>;
}
export declare const gameStateManager: GameStateManager;
//# sourceMappingURL=gameStateManager.d.ts.map