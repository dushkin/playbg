import express, { Response } from 'express';
import { ApiResponse } from '@playbg/shared';
import { AuthenticatedRequest } from '../middleware/auth';
import { monitoringService } from '../services/monitoringService';
import { cacheService } from '../services/cacheService';
import { cacheInvalidationService } from '../services/cacheInvalidationService';

const router = express.Router();

// @route   GET /health
// @desc    Basic health check endpoint
// @access  Public
router.get('/', async (req, res: Response): Promise<void> => {
  try {
    const basicHealth = await monitoringService.performHealthCheck();
    
    // Return simple status for load balancers
    if (basicHealth.status === 'healthy' || basicHealth.status === 'degraded') {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } else {
      res.status(503).json({
        status: 'UNHEALTHY',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    }
  } catch (error) {
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
router.get('/detailed', async (req, res: Response): Promise<void> => {
  try {
    const health = await monitoringService.performHealthCheck();
    
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
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to perform detailed health check'
    } as ApiResponse);
  }
});

// @route   GET /health/metrics
// @desc    Get system metrics
// @access  Private (Admin)
router.get('/metrics', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const health = await monitoringService.performHealthCheck();
    
    res.json({
      success: true,
      data: {
        cache: health.metrics.cache,
        database: health.metrics.database,
        performance: health.metrics.performance,
        system: monitoringService.getSystemStats(),
        timestamp: new Date()
      }
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    } as ApiResponse);
  }
});

// @route   GET /health/cache
// @desc    Cache-specific health check
// @access  Private (Admin)
router.get('/cache', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cacheHealth = await cacheService.getCacheHealth();
    const invalidationStats = await cacheInvalidationService.getInvalidationStats();
    const cacheMetrics = monitoringService.getCacheMetrics();
    
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
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check cache health'
    } as ApiResponse);
  }
});

// @route   GET /health/alerts
// @desc    Get system alerts
// @access  Private (Admin)
router.get('/alerts', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const activeOnly = req.query.active === 'true';
    
    const alerts = activeOnly 
      ? monitoringService.getActiveAlerts() 
      : monitoringService.getAllAlerts(limit);
    
    res.json({
      success: true,
      data: {
        alerts,
        summary: {
          total: alerts.length,
          active: monitoringService.getActiveAlerts().length,
          bySevert: {
            critical: alerts.filter(a => a.severity === 'critical').length,
            error: alerts.filter(a => a.severity === 'error').length,
            warning: alerts.filter(a => a.severity === 'warning').length,
            info: alerts.filter(a => a.severity === 'info').length
          }
        },
        timestamp: new Date()
      }
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    } as ApiResponse);
  }
});

// @route   POST /health/alerts/:alertId/resolve
// @desc    Resolve a specific alert
// @access  Private (Admin)
router.post('/alerts/:alertId/resolve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    const resolved = monitoringService.resolveAlert(alertId);
    
    if (resolved) {
      res.json({
        success: true,
        message: `Alert ${alertId} resolved successfully`
      } as ApiResponse);
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      } as ApiResponse);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    } as ApiResponse);
  }
});

// @route   GET /health/performance
// @desc    Get performance metrics
// @access  Private (Admin)  
router.get('/performance', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const health = await monitoringService.performHealthCheck();
    const systemStats = monitoringService.getSystemStats();
    
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
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics'
    } as ApiResponse);
  }
});

// @route   POST /health/test
// @desc    Run comprehensive system test
// @access  Private (Admin)
router.post('/test', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const testResults: any = {
      timestamp: new Date(),
      tests: [],
      overall: 'unknown' as 'pass' | 'fail' | 'unknown'
    };

    // Test 1: Cache Operations
    try {
      const testKey = `health_test_${Date.now()}`;
      await cacheService.setLeaderboard(testKey, 1, 1, {
        success: true,
        data: [],
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 }
      });
      
      const cached = await cacheService.getLeaderboard(testKey, 1, 1);
      await cacheService.invalidateLeaderboard(testKey);
      
      testResults.tests.push({
        name: 'Cache Operations',
        status: 'pass',
        duration: 0,
        details: 'Cache set, get, and invalidate operations successful'
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Cache Operations',
        status: 'fail',
        error: (error as Error).message,
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
    } catch (error) {
      testResults.tests.push({
        name: 'Database Connectivity',
        status: 'fail',
        error: (error as Error).message,
        duration: 0
      });
    }

    // Test 3: Cache Invalidation Service
    try {
      await cacheInvalidationService.handleInvalidation({
        type: 'manual',
        reason: 'Health check test'
      });
      
      testResults.tests.push({
        name: 'Cache Invalidation Service',
        status: 'pass',
        duration: 0,
        details: 'Invalidation service responding correctly'
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Cache Invalidation Service',
        status: 'fail',
        error: (error as Error).message,
        duration: 0
      });
    }

    // Test 4: Monitoring Service
    try {
      const health = await monitoringService.performHealthCheck();
      testResults.tests.push({
        name: 'Monitoring Service',
        status: 'pass',
        duration: 0,
        details: `System status: ${health.status}`
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Monitoring Service',
        status: 'fail',
        error: (error as Error).message,
        duration: 0
      });
    }

    // Determine overall status
    const failedTests = testResults.tests.filter((test: any) => test.status === 'fail');
    testResults.overall = failedTests.length === 0 ? 'pass' : 'fail';
    testResults.summary = {
      total: testResults.tests.length,
      passed: testResults.tests.filter((test: any) => test.status === 'pass').length,
      failed: failedTests.length
    };

    const statusCode = testResults.overall === 'pass' ? 200 : 503;
    
    res.status(statusCode).json({
      success: testResults.overall === 'pass',
      data: testResults
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to run system tests'
    } as ApiResponse);
  }
});

// @route   GET /health/dashboard
// @desc    Get dashboard data for monitoring UI
// @access  Private (Admin)
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const health = await monitoringService.performHealthCheck();
    const systemStats = monitoringService.getSystemStats();
    const activeAlerts = monitoringService.getActiveAlerts();
    
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
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data'
    } as ApiResponse);
  }
});

export default router;