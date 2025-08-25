import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
export interface ValidatedRequest extends AuthenticatedRequest {
    validatedData?: any;
    file?: any;
}
/**
 * Generic validation middleware factory
 */
export declare const validateRequest: (validationType: string) => (req: ValidatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Game move validation middleware
 */
export declare const validateGameMove: (req: ValidatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Chat message validation middleware
 */
export declare const validateChatMessage: (req: ValidatedRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * MongoDB ObjectId validation middleware
 */
export declare const validateObjectId: (paramName: string) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Query parameter validation middleware
 */
export declare const validateQueryParams: (allowedParams: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Pagination validation middleware
 */
export declare const validatePagination: (req: Request, res: Response, next: NextFunction) => void;
/**
 * File upload validation middleware
 */
export declare const validateFileUpload: (allowedTypes: string[], maxSize?: number) => (req: any, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Request body size validation middleware
 */
export declare const validateBodySize: (maxSize?: number) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Content type validation middleware
 */
export declare const validateContentType: (allowedTypes: string[]) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Input sanitization middleware (runs after validation)
 */
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map