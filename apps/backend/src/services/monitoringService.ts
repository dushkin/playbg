import { getRedisService } from './redisService';
import { cacheService } from './cacheService';
import { cacheInvalidationService } from './cacheInvalidationService';
import { User } from '../models/User';
import { GameModel } from '../models/Game';
import { logger } from '../utils/logger';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  avgResponseTime: number;
  errors: number;
  lastUpdated: Date;
}

export interface SystemHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    redis: ServiceHealth;
    mongodb: ServiceHealth;
    cache: ServiceHealth;
  };
  metrics: {
    cache: CacheMetrics;
    database: DatabaseMetrics;
    performance: PerformanceMetrics;
  };
  alerts: Alert[];
  uptime: number;
  timestamp: Date;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  lastCheck: Date;
  error?: string;
  details?: any;
}

export interface DatabaseMetrics {
  connections: number;
  queryTime: number;
  slowQueries: number;
  totalQueries: number;
  errors: number;
}

export interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  activeConnections: number;
  requestsPerSecond: number;
  averageResponseTime: number;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  service: string;
  resolved: boolean;
  details?: any;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Map<string, any> = new Map();
  private alerts: Alert[] = [];
  private startTime: Date = new Date();

  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0,
    avgResponseTime: 0,
    errors: 0,
    lastUpdated: new Date()
  };

  private responseTimeSamples: number[] = [];
  private requestCount = 0;
  private errorCount = 0;

  private constructor() {
    this.initializeMonitoring();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private initializeMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck().catch(error => {
        logger.error('Health check failed:', error);
      });
    }, 30 * 1000);

    setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Metrics collection failed:', error);
      });
    }, 60 * 1000);

    setInterval(() => {
      this.cleanupMetrics();
    }, 300 * 1000);

    logger.info('Monitoring service initialized');
  }

  public recordCacheHit(key: string, responseTime: number): void {
    this.cacheMetrics.hits++;
    this.cacheMetrics.totalRequests++;
    this.recordResponseTime(responseTime);
    this.updateCacheHitRate();
    
    logger.debug(`Cache hit for key: ${key}, response time: ${responseTime}ms`);
  }

  public recordCacheMiss(key: string, responseTime: number): void {
    this.cacheMetrics.misses++;
    this.cacheMetrics.totalRequests++;
    this.recordResponseTime(responseTime);
    this.updateCacheHitRate();
    
    logger.debug(`Cache miss for key: ${key}, response time: ${responseTime}ms`);
  }

  public recordCacheError(operation: string, error: Error): void {
    this.cacheMetrics.errors++;
    this.errorCount++;
    
    this.createAlert({
      severity: 'error',
      message: `Cache error in ${operation}: ${error.message}`,
      service: 'cache',
      details: { operation, error: error.stack }
    });

    logger.error(`Cache error in ${operation}:`, error);
  }

  private recordResponseTime(time: number): void {
    this.responseTimeSamples.push(time);
    
    if (this.responseTimeSamples.length > 1000) {
      this.responseTimeSamples.shift();
    }

    this.cacheMetrics.avgResponseTime = 
      this.responseTimeSamples.reduce((sum, t) => sum + t, 0) / this.responseTimeSamples.length;
  }

  private updateCacheHitRate(): void {
    if (this.cacheMetrics.totalRequests > 0) {
      this.cacheMetrics.hitRate = 
        (this.cacheMetrics.hits / this.cacheMetrics.totalRequests) * 100;
    }
    this.cacheMetrics.lastUpdated = new Date();
  }

  public async performHealthCheck(): Promise<SystemHealthStatus> {
    const redis = await this.checkRedisHealth();
    const mongodb = await this.checkMongoDBHealth();
    const cache = await this.checkCacheHealth();

    const overallStatus = this.determineOverallStatus([redis, mongodb, cache]);
    
    const health: SystemHealthStatus = {
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

  private async checkRedisHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const health = await cacheService.getCacheHealth();
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
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  private async checkMongoDBHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      await User.countDocuments().limit(1);
      const responseTime = Date.now() - startTime;
      
      const status = responseTime > 2000 ? 'degraded' : 'up';
      
      return {
        status,
        responseTime,
        lastCheck: new Date()
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  private async checkCacheHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      await cacheService.setLeaderboard('test', 1, 1, {
        success: true,
        data: [],
        pagination: { page: 1, limit: 1, total: 0, totalPages: 0 }
      });
      
      await cacheService.getLeaderboard('test', 1, 1);
      await cacheService.invalidateLeaderboard('test');
      
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
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: (error as Error).message
      };
    }
  }

  private determineOverallStatus(services: ServiceHealth[]): 'healthy' | 'degraded' | 'unhealthy' {
    const downServices = services.filter(s => s.status === 'down');
    const degradedServices = services.filter(s => s.status === 'degraded');
    
    if (downServices.length > 1) return 'unhealthy';
    if (downServices.length === 1) return 'degraded';
    if (degradedServices.length > 0) return 'degraded';
    
    return 'healthy';
  }

  private async collectMetrics(): Promise<void> {
    try {
      await this.collectCacheMetrics();
      await this.collectDatabaseMetrics();
      await this.collectPerformanceMetrics();
      
      logger.debug('Metrics collection completed');
    } catch (error) {
      logger.error('Failed to collect metrics:', error);
    }
  }

  private async collectCacheMetrics(): Promise<void> {
    this.metrics.set('cache', {
      ...this.cacheMetrics,
      timestamp: new Date()
    });
  }

  private async collectDatabaseMetrics(): Promise<void> {
    try {
      const metrics = await this.getDatabaseMetrics();
      this.metrics.set('database', {
        ...metrics,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to collect database metrics:', error);
    }
  }

  private async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    try {
      const [userCount, gameCount] = await Promise.all([
        User.countDocuments(),
        GameModel.countDocuments()
      ]);

      return {
        connections: 1,
        queryTime: 0,
        slowQueries: 0,
        totalQueries: userCount + gameCount,
        errors: 0
      };
    } catch (error) {
      logger.error('Failed to collect database metrics:', error);
      return {
        connections: 0,
        queryTime: 0,
        slowQueries: 0,
        totalQueries: 0,
        errors: 1
      };
    }
  }

  private async getPerformanceMetrics(): Promise<PerformanceMetrics> {
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

  private async collectPerformanceMetrics(): Promise<void> {
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

  private calculateRequestsPerSecond(): number {
    return this.requestCount / 60;
  }

  public createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    this.alerts.push(alert);
    
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    logger.warn(`Alert created: [${alert.severity.toUpperCase()}] ${alert.message}`, {
      alertId: alert.id,
      service: alert.service,
      details: alert.details
    });
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info(`Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getAllAlerts(limit: number = 50): Alert[] {
    return this.alerts
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getCacheMetrics(): CacheMetrics {
    return { ...this.cacheMetrics };
  }

  public getMetric(key: string): any {
    return this.metrics.get(key);
  }

  public getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    this.metrics.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  public trackRequest(): void {
    this.requestCount++;
  }

  public trackError(): void {
    this.errorCount++;
  }

  private cleanupMetrics(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    
    this.metrics.forEach((value, key) => {
      if (value.timestamp && value.timestamp.getTime() < cutoff) {
        this.metrics.delete(key);
      }
    });

    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || (Date.now() - alert.timestamp.getTime() < 24 * 60 * 60 * 1000)
    );

    logger.debug('Metrics cleanup completed');
  }

  public getSystemStats(): {
    uptime: number;
    startTime: Date;
    totalRequests: number;
    totalErrors: number;
    cacheHitRate: number;
    activeAlerts: number;
  } {
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

export const monitoringService = MonitoringService.getInstance();