import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export interface ValidatedRequest extends AuthenticatedRequest {
  validatedData?: any;
  file?: any; // Multer file type
}

export interface TimedRequest extends Request {
  startTime?: number;
  operationType?: 'cache' | 'database' | 'api';
  cacheKey?: string;
}

export { Request, Response, NextFunction } from 'express';