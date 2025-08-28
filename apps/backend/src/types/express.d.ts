import express, { Request as ExpressRequest, Response, NextFunction, Router } from 'express';

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

export interface AuthenticatedRequest extends ExpressRequest {
  user?: any;
}

export interface ValidatedRequest extends ExpressRequest {
  user?: any;
  validatedData?: any;
  file?: any; // Multer file type
}

export interface TimedRequest extends ExpressRequest {
  user?: any;
  startTime?: number;
  operationType?: 'cache' | 'database' | 'api';
  cacheKey?: string;
}

export { express as default, Router, Response, NextFunction };