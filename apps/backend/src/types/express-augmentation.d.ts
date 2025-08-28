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

// Re-export Express types for convenience
export { Request, Response, NextFunction, Router } from 'express';

// Define our custom request types as aliases to the augmented Request
export type AuthenticatedRequest = Request;
export type ValidatedRequest = Request;
export type TimedRequest = Request;