"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validationService = exports.ValidationService = void 0;
const joi_1 = __importDefault(require("joi"));
const shared_1 = require("@playbg/shared");
const logger_1 = require("../utils/logger");
class ValidationService {
    constructor() { }
    static getInstance() {
        if (!ValidationService.instance) {
            ValidationService.instance = new ValidationService();
        }
        return ValidationService.instance;
    }
    // === GAME MOVE VALIDATION ===
    /**
     * Comprehensive backgammon move validation
     */
    validateGameMove(move, context) {
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
        }
        catch (error) {
            logger_1.logger.error('Move validation error:', error);
            return {
                isValid: false,
                error: 'Invalid move format'
            };
        }
    }
    validateMoveStructure(move) {
        const schema = joi_1.default.object({
            playerId: joi_1.default.string().required(),
            from: joi_1.default.number().integer().min(-1).max(25).required(), // -1 for bar, 25 for off
            to: joi_1.default.number().integer().min(-1).max(25).required(),
            timestamp: joi_1.default.date().required(),
            dice: joi_1.default.array().items(joi_1.default.number().integer().min(1).max(6)).length(2).optional()
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
    validatePlayerOwnership(move, context) {
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
    validateBackgammonMoveLogic(move, context) {
        const { from, to } = move;
        const { boardState, currentPlayer, dice } = context;
        if (!dice) {
            return {
                isValid: false,
                error: 'No dice available'
            };
        }
        // Calculate move distance
        let distance;
        if (from === -1) {
            // Moving from bar
            if (currentPlayer === 0) {
                distance = to + 1; // Player 0 enters from position 0
            }
            else {
                distance = 24 - to; // Player 1 enters from position 23
            }
        }
        else if (to === -1) {
            // Bearing off
            if (!this.canBearOff(boardState, currentPlayer)) {
                return {
                    isValid: false,
                    error: 'Cannot bear off - pieces still outside home board'
                };
            }
            if (currentPlayer === 0) {
                distance = from + 1;
            }
            else {
                distance = 24 - from;
            }
        }
        else {
            // Regular move
            if (currentPlayer === 0) {
                distance = to - from;
            }
            else {
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
    canBearOff(boardState, player) {
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
    sanitizeGameMove(move) {
        return {
            playerId: move.playerId.trim(),
            from: Math.floor(move.from),
            to: Math.floor(move.to),
            timestamp: new Date(move.timestamp),
            dice: move.dice ? move.dice.map(d => Math.floor(d)) : undefined
        };
    }
    // === CHAT MESSAGE VALIDATION ===
    validateChatMessage(message, userId, type = 'chat') {
        const schema = joi_1.default.object({
            message: joi_1.default.string()
                .min(1)
                .max(500)
                .pattern(/^[a-zA-Z0-9\s\.,!?;:()\-_@#$%^&*+='"\/\\]*$/) // Allow common characters
                .required(),
            userId: joi_1.default.string().required(),
            type: joi_1.default.string().valid('chat', 'system', 'game').default('chat')
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
    containsProfanity(message) {
        // Basic profanity filter - in production, use a comprehensive list
        const profanityList = ['spam', 'scam', 'cheat', 'hack'];
        const lowerMessage = message.toLowerCase();
        return profanityList.some(word => lowerMessage.includes(word));
    }
    isSpam(message) {
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
    validateUserRegistration(userData) {
        const schema = joi_1.default.object({
            username: joi_1.default.string()
                .alphanum()
                .min(3)
                .max(20)
                .pattern(/^[a-zA-Z0-9]+$/)
                .required(),
            email: joi_1.default.string()
                .email({ minDomainSegments: 2, tlds: { allow: ['com', 'net', 'org', 'edu', 'io', 'co'] } })
                .max(255)
                .required(),
            password: joi_1.default.string()
                .min(8)
                .max(128)
                .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
                .required()
                .messages({
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            }),
            confirmPassword: joi_1.default.string()
                .valid(joi_1.default.ref('password'))
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
    validateUserLogin(loginData) {
        const schema = joi_1.default.object({
            email: joi_1.default.string().email().max(255).required(),
            password: joi_1.default.string().min(1).max(128).required()
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
    validateGameCreation(gameData) {
        const schema = joi_1.default.object({
            gameType: joi_1.default.string().valid(...Object.values(shared_1.GameType)).required(),
            gameSpeed: joi_1.default.string().valid(...Object.values(shared_1.GameSpeed)).required(),
            opponentId: joi_1.default.string().optional(),
            isPrivate: joi_1.default.boolean().default(false),
            stakes: joi_1.default.number().min(0).max(1000).optional()
        });
        const { error, value } = schema.validate(gameData);
        if (error) {
            return {
                isValid: false,
                error: error.details[0].message
            };
        }
        // Additional business logic validation
        if (value.gameType === shared_1.GameType.PRIVATE && !value.opponentId) {
            return {
                isValid: false,
                error: 'Private games require an opponent ID'
            };
        }
        if (value.gameType === shared_1.GameType.RANKED && value.stakes && value.stakes > 0) {
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
    validateTournamentCreation(tournamentData) {
        const schema = joi_1.default.object({
            name: joi_1.default.string()
                .min(3)
                .max(100)
                .pattern(/^[a-zA-Z0-9\s\-_]+$/)
                .required(),
            description: joi_1.default.string().max(1000).optional(),
            type: joi_1.default.string().valid(...Object.values(shared_1.TournamentType)).required(),
            format: joi_1.default.string().valid(...Object.values(shared_1.TournamentFormat)).required(),
            maxPlayers: joi_1.default.number().integer().min(4).max(128).required(),
            entryFee: joi_1.default.number().min(0).max(10000).default(0),
            startTime: joi_1.default.date().greater('now').required(),
            rules: joi_1.default.object({
                matchLength: joi_1.default.number().integer().min(1).max(21).required(),
                timeControl: joi_1.default.string().valid(...Object.values(shared_1.GameSpeed)).required(),
                doubleAllowed: joi_1.default.boolean().default(true),
                crawfordRule: joi_1.default.boolean().default(true)
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
        if ((value.type === shared_1.TournamentType.SINGLE_ELIMINATION || value.type === shared_1.TournamentType.DOUBLE_ELIMINATION)) {
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
    isPowerOfTwo(n) {
        return n > 0 && (n & (n - 1)) === 0;
    }
    // === SOCKET EVENT VALIDATION ===
    validateSocketEvent(eventName, data) {
        const schemas = {
            'matchmaking:join': joi_1.default.object({
                gameSpeed: joi_1.default.string().valid(...Object.values(shared_1.GameSpeed)).default(shared_1.GameSpeed.STANDARD),
                gameType: joi_1.default.string().valid(...Object.values(shared_1.GameType)).default(shared_1.GameType.CASUAL),
                isPrivate: joi_1.default.boolean().default(false),
                preferences: joi_1.default.object({
                    minRating: joi_1.default.number().integer().min(0).max(3000).optional(),
                    maxRating: joi_1.default.number().integer().min(0).max(3000).optional()
                }).optional()
            }),
            'game:join': joi_1.default.object({
                gameId: joi_1.default.string().required()
            }),
            'game:move': joi_1.default.object({
                gameId: joi_1.default.string().required(),
                move: joi_1.default.object({
                    from: joi_1.default.number().integer().min(-1).max(25).required(),
                    to: joi_1.default.number().integer().min(-1).max(25).required()
                }).required()
            }),
            'game:dice_roll': joi_1.default.object({
                gameId: joi_1.default.string().required()
            }),
            'game:chat': joi_1.default.object({
                gameId: joi_1.default.string().required(),
                message: joi_1.default.string().min(1).max(500).required()
            }),
            'tournament:join': joi_1.default.object({
                tournamentId: joi_1.default.string().required()
            }),
            'tournament:start': joi_1.default.object({
                tournamentId: joi_1.default.string().required()
            }),
            'tournament:report_match_result': joi_1.default.object({
                tournamentId: joi_1.default.string().required(),
                matchId: joi_1.default.string().required(),
                winner: joi_1.default.string().required()
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
    sanitizeString(input, maxLength = 255) {
        if (typeof input !== 'string') {
            return '';
        }
        return input
            .trim()
            .slice(0, maxLength)
            .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
            .replace(/\s+/g, ' '); // Normalize whitespace
    }
    sanitizeNumber(input, min = 0, max = Number.MAX_SAFE_INTEGER) {
        const num = parseFloat(input);
        if (isNaN(num)) {
            return min;
        }
        return Math.max(min, Math.min(max, num));
    }
    sanitizeBoolean(input) {
        if (typeof input === 'boolean') {
            return input;
        }
        if (typeof input === 'string') {
            return input.toLowerCase() === 'true';
        }
        return Boolean(input);
    }
}
exports.ValidationService = ValidationService;
exports.validationService = ValidationService.getInstance();
//# sourceMappingURL=validationService.js.map