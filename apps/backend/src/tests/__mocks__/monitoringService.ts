/**
 * Mock Monitoring Service for testing
 * Prevents actual intervals and timers from running during tests
 */

export class MockMonitoringService {
  private intervals: NodeJS.Timeout[] = [];
  
  performHealthCheck = jest.fn().mockResolvedValue({
    status: 'healthy',
    services: {
      redis: { status: 'up', responseTime: 10, lastCheck: new Date() },
      mongodb: { status: 'up', responseTime: 20, lastCheck: new Date() },
      cache: { status: 'up', responseTime: 5, lastCheck: new Date() }
    },
    metrics: {
      cache: {
        hits: 100,
        misses: 10,
        hitRate: 90.9,
        totalRequests: 110,
        avgResponseTime: 15,
        errors: 0,
        lastUpdated: new Date()
      },
      database: {
        connections: 5,
        queryTime: 25,
        slowQueries: 0,
        totalQueries: 1000,
        errors: 0
      },
      performance: {
        memoryUsage: { used: 100, total: 500, percentage: 20 },
        cpuUsage: 15,
        activeConnections: 5,
        requestsPerSecond: 10,
        averageResponseTime: 200
      }
    },
    alerts: [],
    uptime: 3600000,
    timestamp: new Date()
  });

  recordCacheHit = jest.fn();
  recordCacheMiss = jest.fn();
  recordCacheError = jest.fn();
  createAlert = jest.fn();
  resolveAlert = jest.fn().mockReturnValue(true);
  getActiveAlerts = jest.fn().mockReturnValue([]);
  getCacheMetrics = jest.fn().mockReturnValue({
    hits: 100,
    misses: 10,
    hitRate: 90.9,
    totalRequests: 110,
    avgResponseTime: 15,
    errors: 0,
    lastUpdated: new Date()
  });
  getSystemStats = jest.fn().mockReturnValue({
    uptime: 3600000,
    startTime: new Date(Date.now() - 3600000),
    totalRequests: 1000,
    totalErrors: 5,
    cacheHitRate: 90.9,
    activeAlerts: 0
  });
  getAllMetrics = jest.fn().mockReturnValue({});
  getMetric = jest.fn().mockReturnValue(undefined);
  trackRequest = jest.fn();
  trackError = jest.fn();
  
  // Mock cleanup method
  cleanup = jest.fn().mockImplementation(() => {
    // Clear any test intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  });
}

const mockMonitoringService = new MockMonitoringService();

export const monitoringService = mockMonitoringService;
export default mockMonitoringService;