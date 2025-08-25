"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertMiddleware = exports.withCacheMonitoring = exports.healthCheckMiddleware = exports.databaseMetricsMiddleware = exports.errorTrackingMiddleware = exports.cacheMetricsMiddleware = exports.requestMetricsMiddleware = void 0;
exports.MonitorCache = MonitorCache;
exports.MonitorPerformance = MonitorPerformance;
const monitoringService_1 = require("../services/monitoringService");
const logger_1 = require("../utils/logger");
/**
 * Middleware to track request metrics
 */
const requestMetricsMiddleware = (req, res, next) => {
    req.startTime = Date.now();
    // Track request count
    monitoringService_1.monitoringService.trackRequest();
    // Track response metrics when request completes
    const originalSend = res.send;
    const originalJson = res.json;
    res.send = function (data) {
        trackResponseMetrics(req, res);
        return originalSend.call(this, data);
    };
    res.json = function (data) {
        trackResponseMetrics(req, res);
        return originalJson.call(this, data);
    };
    next();
};
exports.requestMetricsMiddleware = requestMetricsMiddleware;
/**
 * Middleware specifically for cache operations
 */
const cacheMetricsMiddleware = (operation) => {
    return (req, res, next) => {
        req.startTime = Date.now();
        req.operationType = 'cache';
        req.cacheKey = `${req.method}:${req.path}`;
        // Override response methods to capture cache metrics
        const originalJson = res.json;
        res.json = function (data) {
            const responseTime = Date.now() - (req.startTime || Date.now());
            // Determine if this was a cache hit or miss based on response
            const isCacheHit = data && data.success && data.data;
            const cacheKey = req.cacheKey || 'unknown';
            if (isCacheHit) {
                monitoringService_1.monitoringService.recordCacheHit(cacheKey, responseTime);
            }
            else {
                monitoringService_1.monitoringService.recordCacheMiss(cacheKey, responseTime);
            }
            return originalJson.call(this, data);
        };
        next();
    };
};
exports.cacheMetricsMiddleware = cacheMetricsMiddleware;
/**
 * Error handling middleware that tracks errors
 */
const errorTrackingMiddleware = (error, req, res, next) => {
    const responseTime = Date.now() - (req.startTime || Date.now());
    // Track error in monitoring service
    monitoringService_1.monitoringService.trackError();
    // Record cache error if this was a cache operation
    if (req.operationType === 'cache') {
        monitoringService_1.monitoringService.recordCacheError(req.cacheKey || 'unknown_operation', error);
    }
    // Log the error with context
    logger_1.logger.error('Request error:', {
        method: req.method,
        path: req.path,
        responseTime,
        operationType: req.operationType,
        error: error.message,
        stack: error.stack
    });
    next(error);
};
exports.errorTrackingMiddleware = errorTrackingMiddleware;
/**
 * Middleware to track database operation metrics
 */
const databaseMetricsMiddleware = (operation) => {
    return (req, res, next) => {
        req.startTime = Date.now();
        req.operationType = 'database';
        next();
    };
};
exports.databaseMetricsMiddleware = databaseMetricsMiddleware;
/**
 * Health check middleware that adds monitoring headers
 */
const healthCheckMiddleware = (req, res, next) => {
    // Add monitoring headers to response
    res.setHeader('X-Service-Status', 'operational');
    res.setHeader('X-Service-Version', process.env.npm_package_version || '1.0.0');
    res.setHeader('X-Uptime', process.uptime().toString());
    next();
};
exports.healthCheckMiddleware = healthCheckMiddleware;
/**
 * Cache monitoring wrapper for service methods
 */
const withCacheMonitoring = (operation, fn) => {
    return async (...args) => {
        const startTime = Date.now();
        const cacheKey = `${operation}:${args[0]}`;
        try {
            const result = await fn(...args);
            const responseTime = Date.now() - startTime;
            // Determine cache hit/miss based on result
            if (result) {
                monitoringService_1.monitoringService.recordCacheHit(cacheKey, responseTime);
            }
            else {
                monitoringService_1.monitoringService.recordCacheMiss(cacheKey, responseTime);
            }
            return result;
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            monitoringService_1.monitoringService.recordCacheError(operation, error);
            monitoringService_1.monitoringService.recordCacheMiss(cacheKey, responseTime);
            throw error;
        }
    };
};
exports.withCacheMonitoring = withCacheMonitoring;
/**
 * Alert middleware that creates alerts for specific conditions
 */
const alertMiddleware = (req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;
    res.send = function (data) {
        checkForAlertConditions(req, res);
        return originalSend.call(this, data);
    };
    res.json = function (data) {
        checkForAlertConditions(req, res);
        return originalJson.call(this, data);
    };
    next();
};
exports.alertMiddleware = alertMiddleware;
// Helper Functions
function trackResponseMetrics(req, res) {
    const responseTime = Date.now() - (req.startTime || Date.now());
    const statusCode = res.statusCode;
    // Log slow requests
    if (responseTime > 5000) { // 5 seconds
        logger_1.logger.warn('Slow request detected:', {
            method: req.method,
            path: req.path,
            responseTime,
            statusCode,
            userAgent: req.get('user-agent')
        });
        // Create alert for slow requests
        monitoringService_1.monitoringService.createAlert({
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
        monitoringService_1.monitoringService.trackError();
        if (statusCode === 503) {
            monitoringService_1.monitoringService.createAlert({
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
function checkForAlertConditions(req, res) {
    const statusCode = res.statusCode;
    // Check for high error rates
    if (statusCode >= 400) {
        const systemStats = monitoringService_1.monitoringService.getSystemStats();
        const errorRate = systemStats.totalErrors / Math.max(systemStats.totalRequests, 1) * 100;
        if (errorRate > 5) { // More than 5% error rate
            monitoringService_1.monitoringService.createAlert({
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
    const cacheMetrics = monitoringService_1.monitoringService.getCacheMetrics();
    if (cacheMetrics.totalRequests > 100 && cacheMetrics.hitRate < 50) {
        monitoringService_1.monitoringService.createAlert({
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
function MonitorCache(operation) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const startTime = Date.now();
            const cacheKey = `${operation}:${JSON.stringify(args[0] || 'no-key')}`;
            try {
                const result = await originalMethod.apply(this, args);
                const responseTime = Date.now() - startTime;
                if (result !== null && result !== undefined) {
                    monitoringService_1.monitoringService.recordCacheHit(cacheKey, responseTime);
                }
                else {
                    monitoringService_1.monitoringService.recordCacheMiss(cacheKey, responseTime);
                }
                return result;
            }
            catch (error) {
                const responseTime = Date.now() - startTime;
                monitoringService_1.monitoringService.recordCacheError(operation, error);
                monitoringService_1.monitoringService.recordCacheMiss(cacheKey, responseTime);
                throw error;
            }
        };
        return descriptor;
    };
}
function MonitorPerformance(operation) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const startTime = Date.now();
            try {
                const result = await originalMethod.apply(this, args);
                const responseTime = Date.now() - startTime;
                // Log slow operations
                if (responseTime > 2000) {
                    logger_1.logger.warn(`Slow operation detected: ${operation} took ${responseTime}ms`);
                    monitoringService_1.monitoringService.createAlert({
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
            }
            catch (error) {
                const responseTime = Date.now() - startTime;
                logger_1.logger.error(`Operation failed: ${operation}`, {
                    responseTime,
                    error: error.message
                });
                throw error;
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=monitoring.js.map