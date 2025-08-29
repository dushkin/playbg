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

// This empty export makes this file a module
export {};