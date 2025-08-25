"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringService = exports.MonitoringService = void 0;
const cacheService_1 = require("./cacheService");
const User_1 = require("../models/User");
const Game_1 = require("../models/Game");
const logger_1 = require("../utils/logger");
class MonitoringService {
    constructor() {
        this.metrics = new Map();
        this.alerts = [];
        this.startTime = new Date();
        this.cacheMetrics = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalRequests: 0,
            avgResponseTime: 0,
            errors: 0,
            lastUpdated: new Date()
        };
        this.responseTimeSamples = [];
        this.requestCount = 0;
        this.errorCount = 0;
        this.initializeMonitoring();
    }
    static getInstance() {
        if (!MonitoringService.instance) {
            MonitoringService.instance = new MonitoringService();
        }
        return MonitoringService.instance;
    }
    initializeMonitoring() {
        setInterval(() => {
            this.performHealthCheck().catch(error => {
                logger_1.logger.error('Health check failed:', error);
            });
        }, 30 * 1000);
        setInterval(() => {
            this.collectMetrics().catch(error => {
                logger_1.logger.error('Metrics collection failed:', error);
            });
        }, 60 * 1000);
        setInterval(() => {
            this.cleanupMetrics();
        }, 300 * 1000);
        logger_1.logger.info('Monitoring service initialized');
    }
    recordCacheHit(key, responseTime) {
        this.cacheMetrics.hits++;
        this.cacheMetrics.totalRequests++;
        this.recordResponseTime(responseTime);
        this.updateCacheHitRate();
        logger_1.logger.debug(`Cache hit for key: ${key}, response time: ${responseTime}ms`);
    }
    recordCacheMiss(key, responseTime) {
        this.cacheMetrics.misses++;
        this.cacheMetrics.totalRequests++;
        this.recordResponseTime(responseTime);
        this.updateCacheHitRate();
        logger_1.logger.debug(`Cache miss for key: ${key}, response time: ${responseTime}ms`);
    }
    recordCacheError(operation, error) {
        this.cacheMetrics.errors++;
        this.errorCount++;
        this.createAlert({
            severity: 'error',
            message: `Cache error in ${operation}: ${error.message}`,
            service: 'cache',
            details: { operation, error: error.stack }
        });
        logger_1.logger.error(`Cache error in ${operation}:`, error);
    }
    recordResponseTime(time) {
        this.responseTimeSamples.push(time);
        if (this.responseTimeSamples.length > 1000) {
            this.responseTimeSamples.shift();
        }
        this.cacheMetrics.avgResponseTime =
            this.responseTimeSamples.reduce((sum, t) => sum + t, 0) / this.responseTimeSamples.length;
    }
    updateCacheHitRate() {
        if (this.cacheMetrics.totalRequests > 0) {
            this.cacheMetrics.hitRate =
                (this.cacheMetrics.hits / this.cacheMetrics.totalRequests) * 100;
        }
        this.cacheMetrics.lastUpdated = new Date();
    }
    async performHealthCheck() {
        const redis = await this.checkRedisHealth();
        const mongodb = await this.checkMongoDBHealth();
        const cache = await this.checkCacheHealth();
        const overallStatus = this.determineOverallStatus([redis, mongodb, cache]);
        const health = {
            status: overallStatus,
            services: { redis, mongodb, cache },
            metrics: {
                cache: { ...this.cacheMetrics },
                database: await this.getDatabaseMetrics(),
                performance: await this.getPerformanceMetrics()
            },
            alerts: this.getActiveAlerts(),
            uptime: Date.now() - this.startTime.getTime(),
            timestamp: new Date()
        };
        if (overallStatus === 'unhealthy') {
            this.createAlert({
                severity: 'critical',
                message: 'System health check failed - multiple services down',
                service: 'system',
                details: health.services
            });
        }
        return health;
    }
    async checkRedisHealth() {
        const startTime = Date.now();
        try {
            const health = await cacheService_1.cacheService.getCacheHealth();
            const responseTime = Date.now() - startTime;
            if (!health.connected) {
                return {
                    status: 'down',
                    responseTime,
                    lastCheck: new Date(),
                    error: 'Redis not connected'
                };
            }
            const status = responseTime > 1000 ? 'degraded' : 'up';
            return {
                status,
                responseTime,
                lastCheck: new Date(),
                details: health
            };
        }
        catch (error) {
            return {
                status: 'down',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }
    async checkMongoDBHealth() {
        const startTime = Date.now();
        try {
            await User_1.User.countDocuments().limit(1);
            const responseTime = Date.now() - startTime;
            const status = responseTime > 2000 ? 'degraded' : 'up';
            return {
                status,
                responseTime,
                lastCheck: new Date()
            };
        }
        catch (error) {
            return {
                status: 'down',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }
    async checkCacheHealth() {
        const startTime = Date.now();
        try {
            await cacheService_1.cacheService.setLeaderboard('test', 1, 1, {
                success: true,
                data: [],
                pagination: { page: 1, limit: 1, total: 0, totalPages: 0 }
            });
            await cacheService_1.cacheService.getLeaderboard('test', 1, 1);
            await cacheService_1.cacheService.invalidateLeaderboard('test');
            const responseTime = Date.now() - startTime;
            const status = responseTime > 1500 ? 'degraded' : 'up';
            return {
                status,
                responseTime,
                lastCheck: new Date(),
                details: {
                    operations: ['set', 'get', 'invalidate'],
                    testPassed: true
                }
            };
        }
        catch (error) {
            return {
                status: 'down',
                responseTime: Date.now() - startTime,
                lastCheck: new Date(),
                error: error.message
            };
        }
    }
    determineOverallStatus(services) {
        const downServices = services.filter(s => s.status === 'down');
        const degradedServices = services.filter(s => s.status === 'degraded');
        if (downServices.length > 1)
            return 'unhealthy';
        if (downServices.length === 1)
            return 'degraded';
        if (degradedServices.length > 0)
            return 'degraded';
        return 'healthy';
    }
    async collectMetrics() {
        try {
            await this.collectCacheMetrics();
            await this.collectDatabaseMetrics();
            await this.collectPerformanceMetrics();
            logger_1.logger.debug('Metrics collection completed');
        }
        catch (error) {
            logger_1.logger.error('Failed to collect metrics:', error);
        }
    }
    async collectCacheMetrics() {
        this.metrics.set('cache', {
            ...this.cacheMetrics,
            timestamp: new Date()
        });
    }
    async collectDatabaseMetrics() {
        try {
            const metrics = await this.getDatabaseMetrics();
            this.metrics.set('database', {
                ...metrics,
                timestamp: new Date()
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to collect database metrics:', error);
        }
    }
    async getDatabaseMetrics() {
        try {
            const [userCount, gameCount] = await Promise.all([
                User_1.User.countDocuments(),
                Game_1.GameModel.countDocuments()
            ]);
            return {
                connections: 1,
                queryTime: 0,
                slowQueries: 0,
                totalQueries: userCount + gameCount,
                errors: 0
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to collect database metrics:', error);
            return {
                connections: 0,
                queryTime: 0,
                slowQueries: 0,
                totalQueries: 0,
                errors: 1
            };
        }
    }
    async getPerformanceMetrics() {
        const memoryUsage = process.memoryUsage();
        return {
            memoryUsage: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            cpuUsage: process.cpuUsage().user / 1000000,
            activeConnections: 0,
            requestsPerSecond: this.calculateRequestsPerSecond(),
            averageResponseTime: this.cacheMetrics.avgResponseTime
        };
    }
    async collectPerformanceMetrics() {
        const metrics = await this.getPerformanceMetrics();
        this.metrics.set('performance', {
            ...metrics,
            timestamp: new Date()
        });
        if (metrics.memoryUsage.percentage > 85) {
            this.createAlert({
                severity: 'warning',
                message: `High memory usage: ${metrics.memoryUsage.percentage.toFixed(1)}%`,
                service: 'performance',
                details: metrics.memoryUsage
            });
        }
        if (metrics.averageResponseTime > 2000) {
            this.createAlert({
                severity: 'warning',
                message: `High average response time: ${metrics.averageResponseTime.toFixed(0)}ms`,
                service: 'performance',
                details: { avgResponseTime: metrics.averageResponseTime }
            });
        }
    }
    calculateRequestsPerSecond() {
        return this.requestCount / 60;
    }
    createAlert(alertData) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            resolved: false,
            ...alertData
        };
        this.alerts.push(alert);
        if (this.alerts.length > 100) {
            this.alerts.shift();
        }
        logger_1.logger.warn(`Alert created: [${alert.severity.toUpperCase()}] ${alert.message}`, {
            alertId: alert.id,
            service: alert.service,
            details: alert.details
        });
    }
    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.resolved = true;
            logger_1.logger.info(`Alert resolved: ${alertId}`);
            return true;
        }
        return false;
    }
    getActiveAlerts() {
        return this.alerts
            .filter(alert => !alert.resolved)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    getAllAlerts(limit = 50) {
        return this.alerts
            .slice(-limit)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    getCacheMetrics() {
        return { ...this.cacheMetrics };
    }
    getMetric(key) {
        return this.metrics.get(key);
    }
    getAllMetrics() {
        const result = {};
        this.metrics.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    trackRequest() {
        this.requestCount++;
    }
    trackError() {
        this.errorCount++;
    }
    cleanupMetrics() {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.metrics.forEach((value, key) => {
            if (value.timestamp && value.timestamp.getTime() < cutoff) {
                this.metrics.delete(key);
            }
        });
        this.alerts = this.alerts.filter(alert => !alert.resolved || (Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000));
        logger_1.logger.debug('Metrics cleanup completed');
    }
    getSystemStats() {
        return {
            uptime: Date.now() - this.startTime.getTime(),
            startTime: this.startTime,
            totalRequests: this.cacheMetrics.totalRequests,
            totalErrors: this.errorCount,
            cacheHitRate: this.cacheMetrics.hitRate,
            activeAlerts: this.getActiveAlerts().length
        };
    }
}
exports.MonitoringService = MonitoringService;
exports.monitoringService = MonitoringService.getInstance();
//# sourceMappingURL=monitoringService.js.map