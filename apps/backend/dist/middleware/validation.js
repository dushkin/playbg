"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeInput = exports.validateContentType = exports.validateBodySize = exports.validateFileUpload = exports.validatePagination = exports.validateQueryParams = exports.validateObjectId = exports.validateChatMessage = exports.validateGameMove = exports.validateRequest = void 0;
const validationService_1 = require("../services/validationService");
const logger_1 = require("../utils/logger");
/**
 * Generic validation middleware factory
 */
const validateRequest = (validationType) => {
    return async (req, res, next) => {
        try {
            let validationResult;
            switch (validationType) {
                case 'user-registration':
                    validationResult = validationService_1.validationService.validateUserRegistration(req.body);
                    break;
                case 'user-login':
                    validationResult = validationService_1.validationService.validateUserLogin(req.body);
                    break;
                case 'game-creation':
                    validationResult = validationService_1.validationService.validateGameCreation(req.body);
                    break;
                case 'tournament-creation':
                    validationResult = validationService_1.validationService.validateTournamentCreation(req.body);
                    break;
                default:
                    return res.status(500).json({
                        success: false,
                        error: 'Invalid validation type'
                    });
            }
            if (!validationResult.isValid) {
                logger_1.logger.warn(`Validation failed for ${validationType}: ${validationResult.error}`);
                return res.status(400).json({
                    success: false,
                    error: validationResult.error
                });
            }
            // Attach sanitized data to request
            if (validationResult.sanitizedData) {
                req.validatedData = validationResult.sanitizedData;
            }
            next();
        }
        catch (error) {
            logger_1.logger.error(`Validation middleware error for ${validationType}:`, error);
            res.status(500).json({
                success: false,
                error: 'Validation error occurred'
            });
        }
    };
};
exports.validateRequest = validateRequest;
/**
 * Game move validation middleware
 */
const validateGameMove = async (req, res, next) => {
    try {
        const { gameId } = req.params;
        const move = req.body;
        if (!gameId) {
            return res.status(400).json({
                success: false,
                error: 'Game ID is required'
            });
        }
        // Basic move structure validation
        if (!move.from && move.from !== 0 && move.from !== -1) {
            return res.status(400).json({
                success: false,
                error: 'Move source (from) is required'
            });
        }
        if (!move.to && move.to !== 0 && move.to !== -1) {
            return res.status(400).json({
                success: false,
                error: 'Move destination (to) is required'
            });
        }
        // Add move metadata
        move.playerId = req.user?.id || req.user?._id?.toString();
        move.timestamp = new Date();
        req.validatedData = {
            gameId: validationService_1.validationService.sanitizeString(gameId),
            move: {
                playerId: move.playerId,
                from: validationService_1.validationService.sanitizeNumber(move.from, -1, 25),
                to: validationService_1.validationService.sanitizeNumber(move.to, -1, 25),
                timestamp: move.timestamp
            }
        };
        next();
    }
    catch (error) {
        logger_1.logger.error('Game move validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Move validation error'
        });
    }
};
exports.validateGameMove = validateGameMove;
/**
 * Chat message validation middleware
 */
const validateChatMessage = async (req, res, next) => {
    try {
        const { message, type } = req.body;
        const userId = req.user?.id || req.user?._id?.toString();
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User authentication required'
            });
        }
        const validationResult = validationService_1.validationService.validateChatMessage(message, userId, type);
        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                error: validationResult.error
            });
        }
        req.validatedData = validationResult.sanitizedData;
        next();
    }
    catch (error) {
        logger_1.logger.error('Chat message validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Message validation error'
        });
    }
};
exports.validateChatMessage = validateChatMessage;
/**
 * MongoDB ObjectId validation middleware
 */
const validateObjectId = (paramName) => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (!id) {
            return res.status(400).json({
                success: false,
                error: `${paramName} is required`
            });
        }
        // MongoDB ObjectId validation (24 character hex string)
        const objectIdPattern = /^[0-9a-fA-F]{24}$/;
        if (!objectIdPattern.test(id)) {
            return res.status(400).json({
                success: false,
                error: `Invalid ${paramName} format`
            });
        }
        next();
    };
};
exports.validateObjectId = validateObjectId;
/**
 * Query parameter validation middleware
 */
const validateQueryParams = (allowedParams) => {
    return (req, res, next) => {
        const queryKeys = Object.keys(req.query);
        const invalidParams = queryKeys.filter(key => !allowedParams.includes(key));
        if (invalidParams.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Invalid query parameters: ${invalidParams.join(', ')}`
            });
        }
        // Sanitize allowed parameters
        for (const param of allowedParams) {
            if (req.query[param]) {
                req.query[param] = validationService_1.validationService.sanitizeString(req.query[param]);
            }
        }
        next();
    };
};
exports.validateQueryParams = validateQueryParams;
/**
 * Pagination validation middleware
 */
const validatePagination = (req, res, next) => {
    const { page, limit } = req.query;
    if (page) {
        const pageNum = validationService_1.validationService.sanitizeNumber(page, 1, 1000);
        req.query.page = pageNum.toString();
    }
    if (limit) {
        const limitNum = validationService_1.validationService.sanitizeNumber(limit, 1, 100);
        req.query.limit = limitNum.toString();
    }
    next();
};
exports.validatePagination = validatePagination;
/**
 * File upload validation middleware
 */
const validateFileUpload = (allowedTypes, maxSize = 5 * 1024 * 1024) => {
    return (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        // Validate file type
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
            });
        }
        // Validate file size
        if (req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
            });
        }
        // Additional security checks
        if (req.file.originalname.includes('..') || req.file.originalname.includes('/')) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file name'
            });
        }
        next();
    };
};
exports.validateFileUpload = validateFileUpload;
/**
 * Request body size validation middleware
 */
const validateBodySize = (maxSize = 1024 * 1024) => {
    return (req, res, next) => {
        const contentLength = req.get('content-length');
        if (contentLength && parseInt(contentLength) > maxSize) {
            return res.status(413).json({
                success: false,
                error: `Request body too large. Maximum size: ${maxSize / 1024}KB`
            });
        }
        next();
    };
};
exports.validateBodySize = validateBodySize;
/**
 * Content type validation middleware
 */
const validateContentType = (allowedTypes) => {
    return (req, res, next) => {
        const contentType = req.get('content-type');
        if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
            return res.status(415).json({
                success: false,
                error: `Unsupported content type. Allowed types: ${allowedTypes.join(', ')}`
            });
        }
        next();
    };
};
exports.validateContentType = validateContentType;
/**
 * Input sanitization middleware (runs after validation)
 */
const sanitizeInput = (req, res, next) => {
    // Recursively sanitize all string inputs
    const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
            return validationService_1.validationService.sanitizeString(obj);
        }
        else if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = sanitizeObject(obj[key]);
                }
            }
            return sanitized;
        }
        else if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        return obj;
    };
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    next();
};
exports.sanitizeInput = sanitizeInput;
//# sourceMappingURL=validation.js.map