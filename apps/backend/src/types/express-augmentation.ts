// This file augments the Express Request interface with custom properties
// It contains only type definitions and no runtime code

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

// Import Express types for type aliases
import { Request as ExpressRequest } from 'express-serve-static-core';

// Type aliases to ensure proper Express Request type inheritance
export interface AuthenticatedRequest extends ExpressRequest {
  user: any;
}

export interface TimedRequest extends ExpressRequest {
  startTime?: number;
}

// This empty export makes this file a module
export {};