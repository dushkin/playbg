import { Request } from 'express';

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
  body: any;
  params: any;
}

export interface TimedRequest extends Request {
  startTime?: number;
  operationType?: 'cache' | 'database' | 'api';
  cacheKey?: string;
  method: string;
  path: string;
  get(header: string): string | undefined;
}