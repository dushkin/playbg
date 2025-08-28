import Joi from 'joi';
import {
  GameMove,
  GameType,
  GameSpeed,
  TournamentType,
  TournamentFormat,
  MatchStatus,
  ChatMessage,
  BoardState,
  INITIAL_BOARD_STATE
} from '@playbg/shared';
import { logger } from '../utils/logger';

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

export class ValidationService {
  private static instance: ValidationService;

  private constructor() {}

  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // === GAME MOVE VALIDATION ===

  /**
   * Comprehensive backgammon move validation
   */
  public validateGameMove(move: GameMove, context: GameMoveValidationContext): ValidationResult {
    try {
      // Basic structure validation
      const structureValidation = this.validateMoveStructure(move);
      if (!structureValidation.isValid) {
        return structureValidation;
      }

      // Game state validation
      if (context.gameEnded) {
        return {
          isValid: false,
          error: 'Cannot make moves in a finished game'
        };
      }

      if (!context.dice) {
        return {
          isValid: false,
          error: 'No dice rolled - cannot make move'
        };
      }

      // Player ownership validation
      const ownershipValidation = this.validatePlayerOwnership(move, context);
      if (!ownershipValidation.isValid) {
        return ownershipValidation;
      }

      // Backgammon-specific move validation
      const moveLogicValidation = this.validateBackgammonMoveLogic(move, context);
      if (!moveLogicValidation.isValid) {
        return moveLogicValidation;
      }

      return {
        isValid: true,
        sanitizedData: this.sanitizeGameMove(move)
      };
    } catch (error) {
      logger.error('Move validation error:', error);
      return {
        isValid: false,
        error: 'Invalid move format'
      };
    }
  }

  private validateMoveStructure(move: GameMove): ValidationResult {
    const schema = Joi.object({
      playerId: Joi.string().required(),
      from: Joi.number().integer().min(-1).max(25).required(), // -1 for bar, 25 for off
      to: Joi.number().integer().min(-1).max(25).required(),
      timestamp: Joi.date().required(),
      dice: Joi.array().items(Joi.number().integer().min(1).max(6)).length(2).optional()
    });

    const { error } = schema.validate(move);
    if (error) {
      return {
        isValid: false,
        error: `Invalid move structure: ${error.details[0].message}`
      };
    }

    // Additional structural checks
    if (move.from === move.to) {
      return {
        isValid: false,
        error: 'Cannot move piece to the same position'
      };
    }

    return { isValid: true };
  }

  private validatePlayerOwnership(move: GameMove, context: GameMoveValidationContext): ValidationResult {
    const { from, playerId } = move;
    const { boardState, currentPlayer } = context;

    // Determine if this is player 0 or 1 based on playerId
    // This would need to be cross-referenced with actual game player IDs
    const isPlayer0 = currentPlayer === 0;

    // Check if moving from bar
    if (from === -1) {
      const barCount = boardState.bar[currentPlayer];
      if (barCount === 0) {
        return {
          isValid: false,
          error: 'No pieces on the bar to move'
        };
      }
      return { isValid: true };
    }

    // Check if piece exists at source position and belongs to current player
    if (from < 0 || from > 23) {
      return {
        isValid: false,
        error: 'Invalid source position'
      };
    }

    const piecesAtPosition = boardState.points[from];
    if (!piecesAtPosition || piecesAtPosition[currentPlayer] === 0) {
      return {
        isValid: false,
        error: 'No pieces at source position'
      };
    }

    return { isValid: true };
  }

  private validateBackgammonMoveLogic(move: GameMove, context: GameMoveValidationContext): ValidationResult {
    const { from, to } = move;
    const { boardState, currentPlayer, dice } = context;

    if (!dice) {
      return {
        isValid: false,
        error: 'No dice available'
      };
    }

    // Calculate move distance
    let distance: number;
    
    if (from === -1) {
      // Moving from bar
      if (currentPlayer === 0) {
        distance = to + 1; // Player 0 enters from position 0
      } else {
        distance = 24 - to; // Player 1 enters from position 23
      }
    } else if (to === -1) {
      // Bearing off
      if (!this.canBearOff(boardState, currentPlayer)) {
        return {
          isValid: false,
          error: 'Cannot bear off - pieces still outside home board'
        };
      }
      
      if (currentPlayer === 0) {
        distance = from + 1;
      } else {
        distance = 24 - from;
      }
    } else {
      // Regular move
      if (currentPlayer === 0) {
        distance = to - from;
      } else {
        distance = from - to;
      }
    }

    // Check if distance matches available dice
    if (!dice.includes(distance)) {
      return {
        isValid: false,
        error: `Invalid move distance: ${distance}. Available dice: ${dice.join(', ')}`
      };
    }

    // Check destination validity
    if (to >= 0 && to <= 23) {
      const opponentPieces = boardState.points[to][1 - currentPlayer];
      if (opponentPieces > 1) {
        return {
          isValid: false,
          error: 'Cannot move to a point occupied by opponent (more than 1 piece)'
        };
      }
    }

    return { isValid: true };
  }

  private canBearOff(boardState: BoardState, player: 0 | 1): boolean {
    // Check if all pieces are in home board
    const homeRange = player === 0 ? [18, 23] : [0, 5];
    
    // Check bar
    if (boardState.bar[player] > 0) {
      return false;
    }

    // Check if any pieces outside home board
    for (let i = 0; i < 24; i++) {
      if (boardState.points[i][player] > 0) {
        if (player === 0 && (i < homeRange[0] || i > homeRange[1])) {
          return false;
        }
        if (player === 1 && (i < homeRange[0] || i > homeRange[1])) {
          return false;
        }
      }
    }

    return true;
  }

  private sanitizeGameMove(move: GameMove): GameMove {
    return {
      playerId: move.playerId.trim(),
      from: Math.floor(move.from),
      to: Math.floor(move.to),
      timestamp: new Date(move.timestamp),
      dice: move.dice ? move.dice.map(d => Math.floor(d)) as [number, number] : undefined
    };
  }

  // === CHAT MESSAGE VALIDATION ===

  public validateChatMessage(message: string, userId: string, type: string = 'chat'): ValidationResult {
    const schema = Joi.object({
      message: Joi.string()
        .min(1)
        .max(500)
        .pattern(/^[a-zA-Z0-9\s\.,!?;:()\-_@#$%^&*+='"\/\\]*$/) // Allow common characters
        .required(),
      userId: Joi.string().required(),
      type: Joi.string().valid('chat', 'system', 'game').default('chat')
    });

    const { error } = schema.validate({ message, userId, type });
    if (error) {
      return {
        isValid: false,
        error: error.details[0].message
      };
    }

    // Additional content validation
    if (this.containsProfanity(message)) {
      return {
        isValid: false,
        error: 'Message contains inappropriate content'
      };
    }

    if (this.isSpam(message)) {
      return {
        isValid: false,
        error: 'Message appears to be spam'
      };
    }

    return {
      isValid: true,
      sanitizedData: {
        message: message.trim(),
        userId: userId.trim(),
        type: type.toLowerCase()
      }
    };
  }

  private containsProfanity(message: string): boolean {
    // Basic profanity filter - in production, use a comprehensive list
    const profanityList = ['spam', 'scam', 'cheat', 'hack'];
    const lowerMessage = message.toLowerCase();
    return profanityList.some(word => lowerMessage.includes(word));
  }

  private isSpam(message: string): boolean {
    // Check for repeated characters
    if (/(.)\1{4,}/.test(message)) {
      return true;
    }

    // Check for excessive caps
    const capsCount = (message.match(/[A-Z]/g) || []).length;
    if (capsCount > message.length * 0.7 && message.length > 10) {
      return true;
    }

    // Check for repeated words
    const words = message.split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 5 && uniqueWords.size < words.length * 0.5) {
      return true;
    }

    return false;
  }

  // === USER INPUT VALIDATION ===

  public validateUserRegistration(userData: any): ValidationResult {
    const schema = Joi.object({
      username: Joi.string()
        .alphanum()
        .min(3)
        .max(20)
        .pattern(/^[a-zA-Z0-9]+$/)
        .required(),
      email: Joi.string()
        .email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'org', 'edu', 'io', 'co'] } })
        .max(255)
        .required(),
      password: Joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .required()
        .messages({
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        }),
      confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
          'any.only': 'Passwords must match'
        })
    });

    const { error, value } = schema.validate(userData);
    if (error) {
      return {
        isValid: false,
        error: error.details[0].message
      };
    }

    return {
      isValid: true,
      sanitizedData: {
        username: value.username.toLowerCase().trim(),
        email: value.email.toLowerCase().trim(),
        password: value.password // Don't sanitize password
      }
    };
  }

  public validateUserLogin(loginData: any): ValidationResult {
    const schema = Joi.object({
      email: Joi.string().email().max(255).required(),
      password: Joi.string().min(1).max(128).required()
    });

    const { error, value } = schema.validate(loginData);
    if (error) {
      return {
        isValid: false,
        error: error.details[0].message
      };
    }

    return {
      isValid: true,
      sanitizedData: {
        email: value.email.toLowerCase().trim(),
        password: value.password
      }
    };
  }

  // === GAME CREATION VALIDATION ===

  public validateGameCreation(gameData: any): ValidationResult {
    const schema = Joi.object({
      gameType: Joi.string().valid(...Object.values(GameType)).required(),
      gameSpeed: Joi.string().valid(...Object.values(GameSpeed)).required(),
      opponentId: Joi.string().optional(),
      isPrivate: Joi.boolean().default(false),
      stakes: Joi.number().min(0).max(1000).optional()
    });

    const { error, value } = schema.validate(gameData);
    if (error) {
      return {
        isValid: false,
        error: error.details[0].message
      };
    }

    // Additional business logic validation
    if (value.gameType === GameType.PRIVATE && !value.opponentId) {
      return {
        isValid: false,
        error: 'Private games require an opponent ID'
      };
    }

    if (value.gameType === GameType.RANKED && value.stakes && value.stakes > 0) {
      return {
        isValid: false,
        error: 'Ranked games cannot have stakes'
      };
    }

    return {
      isValid: true,
      sanitizedData: value
    };
  }

  // === TOURNAMENT VALIDATION ===

  public validateTournamentCreation(tournamentData: any): ValidationResult {
    const schema = Joi.object({
      name: Joi.string()
        .min(3)
        .max(100)
        .pattern(/^[a-zA-Z0-9\s\-_]+$/)
        .required(),
      description: Joi.string().max(1000).optional(),
      type: Joi.string().valid(...Object.values(TournamentType)).required(),
      format: Joi.string().valid(...Object.values(TournamentFormat)).required(),
      maxPlayers: Joi.number().integer().min(4).max(128).required(),
      entryFee: Joi.number().min(0).max(10000).default(0),
      startTime: Joi.date().greater('now').required(),
      rules: Joi.object({
        matchLength: Joi.number().integer().min(1).max(21).required(),
        timeControl: Joi.string().valid(...Object.values(GameSpeed)).required(),
        doubleAllowed: Joi.boolean().default(true),
        crawfordRule: Joi.boolean().default(true)
      }).required()
    });

    const { error, value } = schema.validate(tournamentData);
    if (error) {
      return {
        isValid: false,
        error: error.details[0].message
      };
    }

    // Additional tournament-specific validation
    const startTime = new Date(value.startTime);
    const minStartTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    if (startTime < minStartTime) {
      return {
        isValid: false,
        error: 'Tournament must start at least 30 minutes from now'
      };
    }

    // Validate max players is power of 2 for elimination tournaments
    if ((value.type === TournamentType.SINGLE_ELIMINATION || value.type === TournamentType.DOUBLE_ELIMINATION)) {
      if (!this.isPowerOfTwo(value.maxPlayers)) {
        return {
          isValid: false,
          error: 'Elimination tournaments require a power of 2 number of players'
        };
      }
    }

    return {
      isValid: true,
      sanitizedData: {
        ...value,
        name: value.name.trim(),
        description: value.description ? value.description.trim() : ''
      }
    };
  }

  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  // === SOCKET EVENT VALIDATION ===

  public validateSocketEvent(eventName: string, data: any): ValidationResult {
    const schemas: Record<string, Joi.ObjectSchema> = {
      'matchmaking:join': Joi.object({
        gameSpeed: Joi.string().valid(...Object.values(GameSpeed)).default(GameSpeed.STANDARD),
        gameType: Joi.string().valid(...Object.values(GameType)).default(GameType.CASUAL),
        isPrivate: Joi.boolean().default(false),
        preferences: Joi.object({
          minRating: Joi.number().integer().min(0).max(3000).optional(),
          maxRating: Joi.number().integer().min(0).max(3000).optional()
        }).optional()
      }),
      
      'game:join': Joi.object({
        gameId: Joi.string().required()
      }),
      
      'game:move': Joi.object({
        gameId: Joi.string().required(),
        move: Joi.object({
          from: Joi.number().integer().min(-1).max(25).required(),
          to: Joi.number().integer().min(-1).max(25).required()
        }).required()
      }),
      
      'game:dice_roll': Joi.object({
        gameId: Joi.string().required()
      }),
      
      'game:chat': Joi.object({
        gameId: Joi.string().required(),
        message: Joi.string().min(1).max(500).required()
      }),
      
      'tournament:join': Joi.object({
        tournamentId: Joi.string().required()
      }),
      
      'tournament:start': Joi.object({
        tournamentId: Joi.string().required()
      }),
      
      'tournament:report_match_result': Joi.object({
        tournamentId: Joi.string().required(),
        matchId: Joi.string().required(),
        winner: Joi.string().required()
      })
    };

    const schema = schemas[eventName];
    if (!schema) {
      return {
        isValid: false,
        error: `Unknown socket event: ${eventName}`
      };
    }

    const { error, value } = schema.validate(data);
    if (error) {
      return {
        isValid: false,
        error: `Invalid ${eventName} data: ${error.details[0].message}`
      };
    }

    return {
      isValid: true,
      sanitizedData: value
    };
  }

  // === GENERAL INPUT SANITIZATION ===

  public sanitizeString(input: string, maxLength: number = 255): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .trim()
      .slice(0, maxLength)
      .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  public sanitizeNumber(input: any, min: number = 0, max: number = Number.MAX_SAFE_INTEGER): number {
    const num = parseFloat(input);
    if (isNaN(num)) {
      return min;
    }
    return Math.max(min, Math.min(max, num));
  }

  public sanitizeBoolean(input: any): boolean {
    if (typeof input === 'boolean') {
      return input;
    }
    if (typeof input === 'string') {
      return input.toLowerCase() === 'true';
    }
    return Boolean(input);
  }
}

export const validationService = ValidationService.getInstance();