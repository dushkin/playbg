import { Request as ExpressRequest } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export interface AuthenticatedRequest extends ExpressRequest {
  user?: any;
}

export interface ValidatedRequest extends AuthenticatedRequest {
  validatedData?: any;
  file?: any; // Multer file type
}

export interface TimedRequest extends ExpressRequest {
  startTime?: number;
  operationType?: 'cache' | 'database' | 'api';
  cacheKey?: string;
}