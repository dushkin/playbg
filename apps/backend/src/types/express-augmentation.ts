// This file augments the Express Request interface with custom properties
// It contains only type definitions and no runtime code

import { Request } from 'express';

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

// Type aliases to ensure proper Express Request type inheritance
export interface AuthenticatedRequest extends Request {
  user: any;
}

export interface TimedRequest extends Request {
  startTime?: number;
}

// This empty export makes this file a module
export {};