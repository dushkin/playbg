import { Request, Response, NextFunction } from 'express';
import { ApiResponse, ApiError } from '@playbg/shared';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: ApiError = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Something went wrong'
  };

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = {
      code: 'INVALID_ID',
      message: 'Invalid resource ID'
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = {
      code: 'DUPLICATE_FIELD',
      message: `${field} already exists`
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const validationErrors = Object.values(err.errors).map((val: any) => ({
      field: val.path,
      message: val.message
    }));

    error = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      validationErrors
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      code: 'INVALID_TOKEN',
      message: 'Invalid token'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      code: 'TOKEN_EXPIRED',
      message: 'Token expired'
    };
  }

  // Log error
  if (logger) {
    logger.error('Error occurred:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip
    });
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: error.message,
    code: error.code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  } as ApiResponse);
};

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }
}
