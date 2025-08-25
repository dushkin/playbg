"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const monitoringService_1 = require("../services/monitoringService");
const cacheService_1 = require("../services/cacheService");
const cacheInvalidationService_1 = require("../services/cacheInvalidationService");
const router = express_1.default.Router();
// @route   GET /health
// @desc    Basic health check endpoint
// @access  Public
router.get('/', async (req, res) => {
    try {
        const basicHealth = await monitoringService_1.monitoringService.performHealthCheck();
        // Return simple status for load balancers
        if (basicHealth.status === 'healthy' || basicHealth.status === 'degraded') {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0'
            });
        }
        else {
            res.status(503).json({
                status: 'UNHEALTHY',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        }
    }
    catch (error) {
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});
// @route   GET /health/detailed
// @desc    Detailed health check with all service statuses
// @access  Public
router.get('/detailed', async (req, res) => {
    try {
        const health = await monitoringService_1.monitoringService.performHealthCheck();
        const statusCode = health.status === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json({
            success: true,
            data: {
                status: health.status,
                services: health.services,
                uptime: health.uptime,
                timestamp: health.timestamp,
                alerts: health.alerts,
                summary: {
                    totalServices: 3,
                    healthyServices: Object.values(health.services).filter(s => s.status === 'up').length,
                    degradedServices: Object.values(health.services).filter(s => s.status === 'degraded').length,
                    downServices: Object.values(health.services).filter(s => s.status === 'down').length,
                    activeAlerts: health.alerts.length
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to perform detailed health check'
        });
    }
});
// @route   GET /health/metrics
// @desc    Get system metrics
// @access  Private (Admin)
router.get('/metrics', async (req, res) => {
    try {
        const health = await monitoringService_1.monitoringService.performHealthCheck();
        res.json({
            success: true,
            data: {
                cache: health.metrics.cache,
                database: health.metrics.database,
                performance: health.metrics.performance,
                system: monitoringService_1.monitoringService.getSystemStats(),
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve metrics'
        });
    }
});
// @route   GET /health/cache
// @desc    Cache-specific health check
// @access  Private (Admin)
router.get('/cache', async (req, res) => {
    try {
        const cacheHealth = await cacheService_1.cacheService.getCacheHealth();
        const invalidationStats = await cacheInvalidationService_1.cacheInvalidationService.getInvalidationStats();
        const cacheMetrics = monitoringService_1.monitoringService.getCacheMetrics();
        const status = cacheHealth.connected ? 'healthy' : 'unhealthy';
        const statusCode = status === 'unhealthy' ? 503 : 200;
        res.status(statusCode).json({
            success: true,
            data: {
                status,
                connection: cacheHealth,
                metrics: cacheMetrics,
                invalidations: invalidationStats,
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to check cache health'
        });
    }
});
// @route   GET /health/alerts
// @desc    Get system alerts
// @access  Private (Admin)
router.get('/alerts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const activeOnly = req.query.active === 'true';
        const alerts = activeOnly
            ? monitoringService_1.monitoringService.getActiveAlerts()
            : monitoringService_1.monitoringService.getAllAlerts(limit);
        res.json({
            success: true,
            data: {
                alerts,
                summary: {
                    total: alerts.length,
                    active: monitoringService_1.monitoringService.getActiveAlerts().length,
                    bySevert: {
                        critical: alerts.filter(a => a.severity === 'critical').length,
                        error: alerts.filter(a => a.severity === 'error').length,
                        warning: alerts.filter(a => a.severity === 'warning').length,
                        info: alerts.filter(a => a.severity === 'info').length
                    }
                },
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve alerts'
        });
    }
});
// @route   POST /health/alerts/:alertId/resolve
// @desc    Resolve a specific alert
// @access  Private (Admin)
router.post('/alerts/:alertId/resolve', async (req, res) => {
    try {
        const { alertId } = req.params;
        const resolved = monitoringService_1.monitoringService.resolveAlert(alertId);
        if (resolved) {
            res.json({
                success: true,
                message: `Alert ${alertId} resolved successfully`
            });
        }
        else {
            res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to resolve alert'
        });
    }
});
// @route   GET /health/performance
// @desc    Get performance metrics
// @access  Private (Admin)  
router.get('/performance', async (req, res) => {
    try {
        const health = await monitoringService_1.monitoringService.performHealthCheck();
        const systemStats = monitoringService_1.monitoringService.getSystemStats();
        res.json({
            success: true,
            data: {
                performance: health.metrics.performance,
                system: systemStats,
                trends: {
                    memoryUsage: health.metrics.performance.memoryUsage.percentage,
                    responseTime: health.metrics.performance.averageResponseTime,
                    cacheHitRate: health.metrics.cache.hitRate,
                    errorRate: systemStats.totalErrors / Math.max(systemStats.totalRequests, 1) * 100
                },
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve performance metrics'
        });
    }
});
// @route   POST /health/test
// @desc    Run comprehensive system test
// @access  Private (Admin)
router.post('/test', async (req, res) => {
    try {
        const testResults = {
            timestamp: new Date(),
            tests: [],
            overall: 'unknown'
        };
        // Test 1: Cache Operations
        try {
            const testKey = `health_test_${Date.now()}`;
            await cacheService_1.cacheService.setLeaderboard(testKey, 1, 1, {
                success: true,
                data: [],
                pagination: { page: 1, limit: 1, total: 0, totalPages: 0 }
            });
            const cached = await cacheService_1.cacheService.getLeaderboard(testKey, 1, 1);
            await cacheService_1.cacheService.invalidateLeaderboard(testKey);
            testResults.tests.push({
                name: 'Cache Operations',
                status: 'pass',
                duration: 0,
                details: 'Cache set, get, and invalidate operations successful'
            });
        }
        catch (error) {
            testResults.tests.push({
                name: 'Cache Operations',
                status: 'fail',
                error: error.message,
                duration: 0
            });
        }
        // Test 2: Database Connectivity
        try {
            const startTime = Date.now();
            const count = await require('../models/User').User.countDocuments().limit(1);
            const duration = Date.now() - startTime;
            testResults.tests.push({
                name: 'Database Connectivity',
                status: 'pass',
                duration,
                details: `Query completed in ${duration}ms`
            });
        }
        catch (error) {
            testResults.tests.push({
                name: 'Database Connectivity',
                status: 'fail',
                error: error.message,
                duration: 0
            });
        }
        // Test 3: Cache Invalidation Service
        try {
            await cacheInvalidationService_1.cacheInvalidationService.handleInvalidation({
                type: 'manual',
                reason: 'Health check test'
            });
            testResults.tests.push({
                name: 'Cache Invalidation Service',
                status: 'pass',
                duration: 0,
                details: 'Invalidation service responding correctly'
            });
        }
        catch (error) {
            testResults.tests.push({
                name: 'Cache Invalidation Service',
                status: 'fail',
                error: error.message,
                duration: 0
            });
        }
        // Test 4: Monitoring Service
        try {
            const health = await monitoringService_1.monitoringService.performHealthCheck();
            testResults.tests.push({
                name: 'Monitoring Service',
                status: 'pass',
                duration: 0,
                details: `System status: ${health.status}`
            });
        }
        catch (error) {
            testResults.tests.push({
                name: 'Monitoring Service',
                status: 'fail',
                error: error.message,
                duration: 0
            });
        }
        // Determine overall status
        const failedTests = testResults.tests.filter((test) => test.status === 'fail');
        testResults.overall = failedTests.length === 0 ? 'pass' : 'fail';
        testResults.summary = {
            total: testResults.tests.length,
            passed: testResults.tests.filter((test) => test.status === 'pass').length,
            failed: failedTests.length
        };
        const statusCode = testResults.overall === 'pass' ? 200 : 503;
        res.status(statusCode).json({
            success: testResults.overall === 'pass',
            data: testResults
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to run system tests'
        });
    }
});
// @route   GET /health/dashboard
// @desc    Get dashboard data for monitoring UI
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
    try {
        const health = await monitoringService_1.monitoringService.performHealthCheck();
        const systemStats = monitoringService_1.monitoringService.getSystemStats();
        const activeAlerts = monitoringService_1.monitoringService.getActiveAlerts();
        res.json({
            success: true,
            data: {
                overview: {
                    status: health.status,
                    uptime: health.uptime,
                    services: {
                        total: 3,
                        healthy: Object.values(health.services).filter(s => s.status === 'up').length,
                        degraded: Object.values(health.services).filter(s => s.status === 'degraded').length,
                        down: Object.values(health.services).filter(s => s.status === 'down').length
                    },
                    alerts: {
                        active: activeAlerts.length,
                        critical: activeAlerts.filter(a => a.severity === 'critical').length,
                        warning: activeAlerts.filter(a => a.severity === 'warning').length
                    }
                },
                services: health.services,
                metrics: {
                    cache: {
                        hitRate: health.metrics.cache.hitRate,
                        totalRequests: health.metrics.cache.totalRequests,
                        avgResponseTime: health.metrics.cache.avgResponseTime,
                        errors: health.metrics.cache.errors
                    },
                    performance: {
                        memoryUsage: health.metrics.performance.memoryUsage.percentage,
                        cpuUsage: health.metrics.performance.cpuUsage,
                        responseTime: health.metrics.performance.averageResponseTime
                    },
                    system: {
                        requestsPerSecond: health.metrics.performance.requestsPerSecond,
                        errorRate: systemStats.totalErrors / Math.max(systemStats.totalRequests, 1) * 100
                    }
                },
                recentAlerts: activeAlerts.slice(0, 5),
                timestamp: new Date()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve dashboard data'
        });
    }
});
exports.default = router;
//# sourceMappingURL=health.js.map