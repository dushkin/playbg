import { BoardState, GameMove } from '@playbg/shared';
export declare class BackgammonEngine {
    private board;
    private currentPlayer;
    private dice;
    private usedDice;
    constructor(initialBoard?: BoardState);
    /**
     * Roll dice for the current player
     */
    rollDice(): [number, number];
    /**
     * Get all possible moves for the current player
     */
    getPossibleMoves(): GameMove[];
    /**
     * Validate and execute a move
     */
    makeMove(move: GameMove): boolean;
    /**
     * Check if the game is over
     */
    isGameOver(): boolean;
    /**
     * Get the winner (if game is over)
     */
    getWinner(): 0 | 1 | null;
    /**
     * Get current board state
     */
    getBoardState(): BoardState;
    /**
     * Get current dice
     */
    getCurrentDice(): [number, number] | null;
    /**
     * Get current player
     */
    getCurrentPlayer(): 0 | 1;
    private getBarMoves;
    private getBearOffMoves;
    private getRegularMoves;
    private canMoveToPoint;
    private canBearOff;
    private isHighestChecker;
    private executeMove;
    private updateUsedDice;
    private allDiceUsed;
    private getAvailableDiceValues;
    private endTurn;
}
export declare class EloRating {
    private static readonly K_FACTOR;
    private static readonly MIN_RATING;
    private static readonly MAX_RATING;
    /**
     * Calculate new ratings after a game
     */
    static calculateNewRatings(player1Rating: number, player2Rating: number, result: 1 | 0 | 0.5): [number, number];
    private static getExpectedScore;
}
export declare class GameUtils {
    /**
     * Generate a unique game ID
     */
    static generateGameId(): string;
    /**
     * Calculate game duration in minutes
     */
    static calculateGameDuration(startTime: Date, endTime: Date): number;
    /**
     * Validate move format
     */
    static isValidMoveFormat(move: any): move is GameMove;
    /**
     * Create initial board state
     */
    static createInitialBoard(): BoardState;
}
export { INITIAL_BOARD_STATE } from '@playbg/shared';
//# sourceMappingURL=index.d.ts.map