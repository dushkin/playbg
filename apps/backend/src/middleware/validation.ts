import express, { Response, NextFunction } from 'express';
import '../types/express-augmentation';
import { validationService, ValidationResult } from '../services/validationService';
import { logger } from '../utils/logger';
import { ApiResponse } from '@playbg/shared';

/**
 * Generic validation middleware factory
 */
export const validateRequest = (validationType: string) => {
  return async (req: express.Request, res: Response, next: NextFunction) => {
    try {
      let validationResult: ValidationResult;

      switch (validationType) {
        case 'user-registration':
          validationResult = validationService.validateUserRegistration(req.body);
          break;
        case 'user-login':
          validationResult = validationService.validateUserLogin(req.body);
          break;
        case 'game-creation':
          validationResult = validationService.validateGameCreation(req.body);
          break;
        case 'tournament-creation':
          validationResult = validationService.validateTournamentCreation(req.body);
          break;
        default:
          return res.status(500).json({
            success: false,
            error: 'Invalid validation type'
          } as ApiResponse);
      }

      if (!validationResult.isValid) {
        logger.warn(`Validation failed for ${validationType}: ${validationResult.error}`);
        return res.status(400).json({
          success: false,
          error: validationResult.error
        } as ApiResponse);
      }

      // Attach sanitized data to request
      if (validationResult.sanitizedData) {
        req.validatedData = validationResult.sanitizedData;
      }

      next();
    } catch (error) {
      logger.error(`Validation middleware error for ${validationType}:`, error);
      res.status(500).json({
        success: false,
        error: 'Validation error occurred'
      } as ApiResponse);
    }
  };
};

/**
 * Game move validation middleware
 */
export const validateGameMove = async (req: express.Request, res: Response, next: NextFunction) => {
  try {
    const { gameId } = req.params;
    const move = req.body;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        error: 'Game ID is required'
      } as ApiResponse);
    }

    // Basic move structure validation
    if (!move.from && move.from !== 0 && move.from !== -1) {
      return res.status(400).json({
        success: false,
        error: 'Move source (from) is required'
      } as ApiResponse);
    }

    if (!move.to && move.to !== 0 && move.to !== -1) {
      return res.status(400).json({
        success: false,
        error: 'Move destination (to) is required'
      } as ApiResponse);
    }

    // Add move metadata
    move.playerId = req.user?.id || req.user?._id?.toString();
    move.timestamp = new Date();

    req.validatedData = {
      gameId: validationService.sanitizeString(gameId),
      move: {
        playerId: move.playerId,
        from: validationService.sanitizeNumber(move.from, -1, 25),
        to: validationService.sanitizeNumber(move.to, -1, 25),
        timestamp: move.timestamp
      }
    };

    next();
  } catch (error) {
    logger.error('Game move validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Move validation error'
    } as ApiResponse);
  }
};

/**
 * Chat message validation middleware
 */
export const validateChatMessage = async (req: express.Request, res: Response, next: NextFunction) => {
  try {
    const { message, type } = req.body;
    const userId = req.user?.id || req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      } as ApiResponse);
    }

    const validationResult = validationService.validateChatMessage(message, userId, type);

    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: validationResult.error
      } as ApiResponse);
    }

    req.validatedData = validationResult.sanitizedData;
    next();
  } catch (error) {
    logger.error('Chat message validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Message validation error'
    } as ApiResponse);
  }
};

/**
 * MongoDB ObjectId validation middleware
 */
export const validateObjectId = (paramName: string) => {
  return (req: express.Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: `${paramName} is required`
      } as ApiResponse);
    }

    // MongoDB ObjectId validation (24 character hex string)
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`
      } as ApiResponse);
    }

    next();
  };
};

/**
 * Query parameter validation middleware
 */
export const validateQueryParams = (allowedParams: string[]) => {
  return (req: express.Request, res: Response, next: NextFunction) => {
    const queryKeys = Object.keys(req.query);
    const invalidParams = queryKeys.filter(key => !allowedParams.includes(key));

    if (invalidParams.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid query parameters: ${invalidParams.join(', ')}`
      } as ApiResponse);
    }

    // Sanitize allowed parameters
    for (const param of allowedParams) {
      if (req.query[param]) {
        req.query[param] = validationService.sanitizeString(req.query[param] as string);
      }
    }

    next();
  };
};

/**
 * Pagination validation middleware
 */
export const validatePagination = (req: express.Request, res: Response, next: NextFunction) => {
  const { page, limit } = req.query;

  if (page) {
    const pageNum = validationService.sanitizeNumber(page, 1, 1000);
    req.query.page = pageNum.toString();
  }

  if (limit) {
    const limitNum = validationService.sanitizeNumber(limit, 1, 100);
    req.query.limit = limitNum.toString();
  }

  next();
};

/**
 * File upload validation middleware
 */
export const validateFileUpload = (allowedTypes: string[], maxSize: number = 5 * 1024 * 1024) => {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      } as ApiResponse);
    }

    // Validate file type
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
      } as ApiResponse);
    }

    // Validate file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
      } as ApiResponse);
    }

    // Additional security checks
    if (req.file.originalname.includes('..') || req.file.originalname.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name'
      } as ApiResponse);
    }

    next();
  };
};

/**
 * Request body size validation middleware
 */
export const validateBodySize = (maxSize: number = 1024 * 1024) => {
  return (req: express.Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        success: false,
        error: `Request body too large. Maximum size: ${maxSize / 1024}KB`
      } as ApiResponse);
    }

    next();
  };
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: express.Request, res: Response, next: NextFunction) => {
    const contentType = req.get('content-type');
    
    if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
      return res.status(415).json({
        success: false,
        error: `Unsupported content type. Allowed types: ${allowedTypes.join(', ')}`
      } as ApiResponse);
    }

    next();
  };
};

/**
 * Input sanitization middleware (runs after validation)
 */
export const sanitizeInput = (req: express.Request, res: Response, next: NextFunction) => {
  // Recursively sanitize all string inputs
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return validationService.sanitizeString(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    } else if (Array.isArray(obj)) {
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