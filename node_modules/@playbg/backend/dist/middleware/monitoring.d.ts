import { Request, Response, NextFunction } from 'express';
interface TimedRequest extends Request {
    startTime?: number;
    operationType?: 'cache' | 'database' | 'api';
    cacheKey?: string;
}
/**
 * Middleware to track request metrics
 */
export declare const requestMetricsMiddleware: (req: TimedRequest, res: Response, next: NextFunction) => void;
/**
 * Middleware specifically for cache operations
 */
export declare const cacheMetricsMiddleware: (operation: string) => (req: TimedRequest, res: Response, next: NextFunction) => void;
/**
 * Error handling middleware that tracks errors
 */
export declare const errorTrackingMiddleware: (error: Error, req: TimedRequest, res: Response, next: NextFunction) => void;
/**
 * Middleware to track database operation metrics
 */
export declare const databaseMetricsMiddleware: (operation: string) => (req: TimedRequest, res: Response, next: NextFunction) => void;
/**
 * Health check middleware that adds monitoring headers
 */
export declare const healthCheckMiddleware: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Cache monitoring wrapper for service methods
 */
export declare const withCacheMonitoring: <T extends any[], R>(operation: string, fn: (...args: T) => Promise<R>) => (...args: T) => Promise<R>;
/**
 * Alert middleware that creates alerts for specific conditions
 */
export declare const alertMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare function MonitorCache(operation: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export declare function MonitorPerformance(operation: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export {};
//# sourceMappingURL=monitoring.d.ts.map