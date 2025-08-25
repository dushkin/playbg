import { GameMove, BoardState } from '@playbg/shared';
export interface ValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedData?: any;
}
export interface GameMoveValidationContext {
    boardState: BoardState;
    currentPlayer: 0 | 1;
    dice: [number, number] | null;
    playerId: string;
    gameEnded: boolean;
}
export declare class ValidationService {
    private static instance;
    private constructor();
    static getInstance(): ValidationService;
    /**
     * Comprehensive backgammon move validation
     */
    validateGameMove(move: GameMove, context: GameMoveValidationContext): ValidationResult;
    private validateMoveStructure;
    private validatePlayerOwnership;
    private validateBackgammonMoveLogic;
    private canBearOff;
    private sanitizeGameMove;
    validateChatMessage(message: string, userId: string, type?: string): ValidationResult;
    private containsProfanity;
    private isSpam;
    validateUserRegistration(userData: any): ValidationResult;
    validateUserLogin(loginData: any): ValidationResult;
    validateGameCreation(gameData: any): ValidationResult;
    validateTournamentCreation(tournamentData: any): ValidationResult;
    private isPowerOfTwo;
    validateSocketEvent(eventName: string, data: any): ValidationResult;
    sanitizeString(input: string, maxLength?: number): string;
    sanitizeNumber(input: any, min?: number, max?: number): number;
    sanitizeBoolean(input: any): boolean;
}
export declare const validationService: ValidationService;
//# sourceMappingURL=validationService.d.ts.map