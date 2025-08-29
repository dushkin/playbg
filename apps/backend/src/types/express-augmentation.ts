// This file augments the Express Request interface with custom properties
// It contains only type definitions and no runtime code

import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      startTime?: number;
      operationType?: 'cache' | 'database' | 'api';
      cacheKey?: string;
      validatedData?: any;
      file?: any;
    }
  }
}

// Type aliases for enhanced request types
export interface AuthenticatedRequest extends Request {
  user: any;
}

export interface ValidatedRequest extends Request {
  user?: any;
  validatedData?: any;
  file?: any;
}

export interface TimedRequest extends Request {
  user?: any;
  startTime?: number;
  operationType?: 'cache' | 'database' | 'api';
  cacheKey?: string;
}

// Type alias to ensure compatibility
export type BaseRequest = Request;

// Re-export Express types for convenience
export { Request, Response, NextFunction } from 'express';