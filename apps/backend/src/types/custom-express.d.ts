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

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export interface ValidatedRequest extends Request {
  user?: any;
  validatedData?: any;
  file?: any; // Multer file type
}

export interface TimedRequest extends Request {
  user?: any;
  startTime?: number;
  operationType?: 'cache' | 'database' | 'api';
  cacheKey?: string;
}

export { Request, Response, NextFunction } from 'express';