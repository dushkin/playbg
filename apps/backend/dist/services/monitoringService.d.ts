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
export declare class MonitoringService {
    private static instance;
    private metrics;
    private alerts;
    private startTime;
    private cacheMetrics;
    private responseTimeSamples;
    private requestCount;
    private errorCount;
    private constructor();
    static getInstance(): MonitoringService;
    private initializeMonitoring;
    recordCacheHit(key: string, responseTime: number): void;
    recordCacheMiss(key: string, responseTime: number): void;
    recordCacheError(operation: string, error: Error): void;
    private recordResponseTime;
    private updateCacheHitRate;
    performHealthCheck(): Promise<SystemHealthStatus>;
    private checkRedisHealth;
    private checkMongoDBHealth;
    private checkCacheHealth;
    private determineOverallStatus;
    private collectMetrics;
    private collectCacheMetrics;
    private collectDatabaseMetrics;
    private getDatabaseMetrics;
    private getPerformanceMetrics;
    private collectPerformanceMetrics;
    private calculateRequestsPerSecond;
    createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>): void;
    resolveAlert(alertId: string): boolean;
    getActiveAlerts(): Alert[];
    getAllAlerts(limit?: number): Alert[];
    getCacheMetrics(): CacheMetrics;
    getMetric(key: string): any;
    getAllMetrics(): Record<string, any>;
    trackRequest(): void;
    trackError(): void;
    private cleanupMetrics;
    getSystemStats(): {
        uptime: number;
        startTime: Date;
        totalRequests: number;
        totalErrors: number;
        cacheHitRate: number;
        activeAlerts: number;
    };
}
export declare const monitoringService: MonitoringService;
//# sourceMappingURL=monitoringService.d.ts.map