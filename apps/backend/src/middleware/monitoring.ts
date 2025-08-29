/// <reference path="../types/express-augmentation.ts" />

import { Request, Response, NextFunction } from 'express';
import { TimedRequest } from '../types/express-augmentation';
import { monitoringService } from '../services/monitoringService';
import { logger } from '../utils/logger';

/**
 * Middleware to track request metrics
 */
export const requestMetricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();
  
  // Track request count
  monitoringService.trackRequest();
  
  // Track response metrics when request completes
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    trackResponseMetrics(req, res);
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    trackResponseMetrics(req, res);
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware specifically for cache operations
 */
export const cacheMetricsMiddleware = (operation: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    req.startTime = Date.now();
    req.operationType = 'cache';
    req.cacheKey = `${req.method}:${req.path}`;
    
    // Override response methods to capture cache metrics
    const originalJson = res.json;
    
    res.json = function(data: any) {
      const responseTime = Date.now() - (req.startTime || Date.now());
      
      // Determine if this was a cache hit or miss based on response
      const isCacheHit = data && data.success && data.data;
      const cacheKey = req.cacheKey || 'unknown';
      
      if (isCacheHit) {
        monitoringService.recordCacheHit(cacheKey, responseTime);
      } else {
        monitoringService.recordCacheMiss(cacheKey, responseTime);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

/**
 * Error handling middleware that tracks errors
 */
export const errorTrackingMiddleware = (error: Error, req: TimedRequest, res: Response, next: NextFunction): void => {
  const responseTime = Date.now() - (req.startTime || Date.now());
  
  // Track error in monitoring service
  monitoringService.trackError();
  
  // Record cache error if this was a cache operation
  if (req.operationType === 'cache') {
    monitoringService.recordCacheError(
      req.cacheKey || 'unknown_operation',
      error
    );
  }
  
  // Log the error with context
  logger.error('Request error:', {
    method: req.method,
    path: req.path,
    responseTime,
    operationType: req.operationType,
    error: error.message,
    stack: error.stack
  });
  
  next(error);
};

/**
 * Middleware to track database operation metrics
 */
export const databaseMetricsMiddleware = (operation: string) => {
  return (req: TimedRequest, res: Response, next: NextFunction): void => {
    req.startTime = Date.now();
    req.operationType = 'database';
    
    next();
  };
};

/**
 * Health check middleware that adds monitoring headers
 */
export const healthCheckMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Add monitoring headers to response
  res.setHeader('X-Service-Status', 'operational');
  res.setHeader('X-Service-Version', process.env.npm_package_version || '1.0.0');
  res.setHeader('X-Uptime', process.uptime().toString());
  
  next();
};

/**
 * Cache monitoring wrapper for service methods
 */
export const withCacheMonitoring = <T extends any[], R>(
  operation: string,
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    const cacheKey = `${operation}:${args[0]}`;
    
    try {
      const result = await fn(...args);
      const responseTime = Date.now() - startTime;
      
      // Determine cache hit/miss based on result
      if (result) {
        monitoringService.recordCacheHit(cacheKey, responseTime);
      } else {
        monitoringService.recordCacheMiss(cacheKey, responseTime);
      }
      
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      monitoringService.recordCacheError(operation, error as Error);
      monitoringService.recordCacheMiss(cacheKey, responseTime);
      throw error;
    }
  };
};

/**
 * Alert middleware that creates alerts for specific conditions
 */
export const alertMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    checkForAlertConditions(req, res);
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    checkForAlertConditions(req, res);
    return originalJson.call(this, data);
  };
  
  next();
};

// Helper Functions

function trackResponseMetrics(req: TimedRequest, res: Response): void {
  const responseTime = Date.now() - (req.startTime || Date.now());
  const statusCode = res.statusCode;
  
  // Log slow requests
  if (responseTime > 5000) { // 5 seconds
    logger.warn('Slow request detected:', {
      method: req.method,
      path: req.path,
      responseTime,
      statusCode,
      userAgent: req.get('user-agent')
    });
    
    // Create alert for slow requests
    monitoringService.createAlert({
      severity: 'warning',
      message: `Slow request: ${req.method} ${req.path} took ${responseTime}ms`,
      service: 'api',
      details: {
        method: req.method,
        path: req.path,
        responseTime,
        statusCode
      }
    });
  }
  
  // Track errors
  if (statusCode >= 500) {
    monitoringService.trackError();
    
    if (statusCode === 503) {
      monitoringService.createAlert({
        severity: 'error',
        message: `Service unavailable: ${req.method} ${req.path}`,
        service: 'api',
        details: {
          method: req.method,
          path: req.path,
          statusCode,
          responseTime
        }
      });
    }
  }
}

function checkForAlertConditions(req: Request, res: Response): void {
  const statusCode = res.statusCode;
  
  // Check for high error rates
  if (statusCode >= 400) {
    const systemStats = monitoringService.getSystemStats();
    const errorRate = systemStats.totalErrors / Math.max(systemStats.totalRequests, 1) * 100;
    
    if (errorRate > 5) { // More than 5% error rate
      monitoringService.createAlert({
        severity: 'warning',
        message: `High error rate detected: ${errorRate.toFixed(1)}%`,
        service: 'api',
        details: {
          errorRate,
          totalRequests: systemStats.totalRequests,
          totalErrors: systemStats.totalErrors
        }
      });
    }
  }
  
  // Check cache performance
  const cacheMetrics = monitoringService.getCacheMetrics();
  if (cacheMetrics.totalRequests > 100 && cacheMetrics.hitRate < 50) {
    monitoringService.createAlert({
      severity: 'warning',
      message: `Low cache hit rate: ${cacheMetrics.hitRate.toFixed(1)}%`,
      service: 'cache',
      details: {
        hitRate: cacheMetrics.hitRate,
        totalRequests: cacheMetrics.totalRequests,
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses
      }
    });
  }
}

// Monitoring decorators for services
export function MonitorCache(operation: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now();
      const cacheKey = `${operation}:${JSON.stringify(args[0] || 'no-key')}`;
      
      try {
        const result = await originalMethod.apply(this, args);
        const responseTime = Date.now() - startTime;
        
        if (result !== null && result !== undefined) {
          monitoringService.recordCacheHit(cacheKey, responseTime);
        } else {
          monitoringService.recordCacheMiss(cacheKey, responseTime);
        }
        
        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        monitoringService.recordCacheError(operation, error as Error);
        monitoringService.recordCacheMiss(cacheKey, responseTime);
        throw error;
      }
    };
    
    return descriptor;
  };
}

export function MonitorPerformance(operation: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const responseTime = Date.now() - startTime;
        
        // Log slow operations
        if (responseTime > 2000) {
          logger.warn(`Slow operation detected: ${operation} took ${responseTime}ms`);
          
          monitoringService.createAlert({
            severity: 'warning',
            message: `Slow ${operation} operation: ${responseTime}ms`,
            service: 'performance',
            details: {
              operation,
              responseTime,
              args: args.length
            }
          });
        }
        
        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        logger.error(`Operation failed: ${operation}`, {
          responseTime,
          error: (error as Error).message
        });
        
        throw error;
      }
    };
    
    return descriptor;
  };
}