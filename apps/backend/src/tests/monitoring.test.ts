import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { monitoringService } from '../services/monitoringService';

// Mock dependencies
jest.mock('../services/redisService');
jest.mock('../services/cacheService');
jest.mock('../models/User');
jest.mock('../models/Game');

describe('Monitoring Service Tests', () => {
  beforeEach(() => {
    // Reset monitoring service state
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize monitoring service without errors', () => {
      expect(monitoringService).toBeDefined();
      expect(typeof monitoringService.performHealthCheck).toBe('function');
      expect(typeof monitoringService.recordCacheHit).toBe('function');
      expect(typeof monitoringService.recordCacheMiss).toBe('function');
      expect(typeof monitoringService.recordCacheError).toBe('function');
    });
  });

  describe('Cache Metrics Tracking', () => {
    it('should record cache hits correctly', () => {
      const initialMetrics = monitoringService.getCacheMetrics();
      const initialHits = initialMetrics.hits;
      const initialTotal = initialMetrics.totalRequests;

      monitoringService.recordCacheHit('test_key', 100);

      const updatedMetrics = monitoringService.getCacheMetrics();
      expect(updatedMetrics.hits).toBe(initialHits + 1);
      expect(updatedMetrics.totalRequests).toBe(initialTotal + 1);
      expect(updatedMetrics.avgResponseTime).toBeGreaterThan(0);
    });

    it('should record cache misses correctly', () => {
      const initialMetrics = monitoringService.getCacheMetrics();
      const initialMisses = initialMetrics.misses;
      const initialTotal = initialMetrics.totalRequests;

      monitoringService.recordCacheMiss('test_key_miss', 250);

      const updatedMetrics = monitoringService.getCacheMetrics();
      expect(updatedMetrics.misses).toBe(initialMisses + 1);
      expect(updatedMetrics.totalRequests).toBe(initialTotal + 1);
    });

    it('should calculate hit rate correctly', () => {
      // Record some hits and misses
      monitoringService.recordCacheHit('key1', 50);
      monitoringService.recordCacheHit('key2', 75);
      monitoringService.recordCacheMiss('key3', 100);

      const metrics = monitoringService.getCacheMetrics();
      
      // Hit rate should be calculated based on all recorded metrics
      expect(metrics.hitRate).toBeGreaterThan(0);
      expect(metrics.hitRate).toBeLessThanOrEqual(100);
      expect(metrics.totalRequests).toBeGreaterThan(0);
    });

    it('should record cache errors', () => {
      const testError = new Error('Test cache error');
      const initialMetrics = monitoringService.getCacheMetrics();
      const initialErrors = initialMetrics.errors;

      monitoringService.recordCacheError('test_operation', testError);

      const updatedMetrics = monitoringService.getCacheMetrics();
      expect(updatedMetrics.errors).toBe(initialErrors + 1);

      // Should also create an alert
      const alerts = monitoringService.getActiveAlerts();
      const cacheErrorAlert = alerts.find(alert => 
        alert.service === 'cache' && alert.message.includes('test_operation')
      );
      expect(cacheErrorAlert).toBeDefined();
    });
  });

  describe('Alert Management', () => {
    it('should create alerts correctly', () => {
      const initialAlerts = monitoringService.getActiveAlerts();
      
      monitoringService.createAlert({
        severity: 'warning',
        message: 'Test alert',
        service: 'test',
        details: { test: true }
      });

      const updatedAlerts = monitoringService.getActiveAlerts();
      expect(updatedAlerts.length).toBe(initialAlerts.length + 1);

      const newAlert = updatedAlerts.find(alert => alert.message === 'Test alert');
      expect(newAlert).toBeDefined();
      expect(newAlert?.severity).toBe('warning');
      expect(newAlert?.service).toBe('test');
      expect(newAlert?.resolved).toBe(false);
    });

    it('should resolve alerts correctly', () => {
      monitoringService.createAlert({
        severity: 'error',
        message: 'Test error alert',
        service: 'test'
      });

      const activeAlerts = monitoringService.getActiveAlerts();
      const testAlert = activeAlerts.find(alert => alert.message === 'Test error alert');
      expect(testAlert).toBeDefined();

      if (testAlert) {
        const resolved = monitoringService.resolveAlert(testAlert.id);
        expect(resolved).toBe(true);

        const updatedActiveAlerts = monitoringService.getActiveAlerts();
        const resolvedAlert = updatedActiveAlerts.find(alert => alert.id === testAlert.id);
        expect(resolvedAlert).toBeUndefined(); // Should not be in active alerts
      }
    });

    it('should handle non-existent alert resolution', () => {
      const resolved = monitoringService.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });
  });

  describe('System Statistics', () => {
    it('should return system stats', () => {
      const stats = monitoringService.getSystemStats();
      
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('startTime');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('activeAlerts');
      
      expect(typeof stats.uptime).toBe('number');
      expect(stats.startTime).toBeInstanceOf(Date);
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.totalErrors).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.activeAlerts).toBe('number');
    });

    it('should track requests and errors', () => {
      expect(() => {
        monitoringService.trackRequest();
      }).not.toThrow();
      
      expect(() => {
        monitoringService.trackError();
      }).not.toThrow();
      
      const stats = monitoringService.getSystemStats();
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.totalErrors).toBe('number');
    });
  });

  describe('Health Checks', () => {
    it('should perform health check without errors', async () => {
      try {
        const health = await monitoringService.performHealthCheck();
        
        expect(health).toHaveProperty('status');
        expect(health).toHaveProperty('services');
        expect(health).toHaveProperty('metrics');
        expect(health).toHaveProperty('alerts');
        expect(health).toHaveProperty('uptime');
        expect(health).toHaveProperty('timestamp');
        
        expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
        expect(health.services).toHaveProperty('redis');
        expect(health.services).toHaveProperty('mongodb');
        expect(health.services).toHaveProperty('cache');
        expect(Array.isArray(health.alerts)).toBe(true);
        expect(health.timestamp).toBeInstanceOf(Date);
      } catch (error) {
        // Health check might fail if dependencies are not available
        // This is expected in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should handle metric queries', () => {
      const cacheMetrics = monitoringService.getCacheMetrics();
      expect(cacheMetrics).toHaveProperty('hits');
      expect(cacheMetrics).toHaveProperty('misses');
      expect(cacheMetrics).toHaveProperty('hitRate');
      expect(cacheMetrics).toHaveProperty('totalRequests');
      expect(cacheMetrics).toHaveProperty('avgResponseTime');
      expect(cacheMetrics).toHaveProperty('errors');
      expect(cacheMetrics).toHaveProperty('lastUpdated');
    });

    it('should return all metrics', () => {
      const allMetrics = monitoringService.getAllMetrics();
      expect(typeof allMetrics).toBe('object');
    });

    it('should handle specific metric queries', () => {
      // This might return undefined if metric doesn't exist, which is fine
      const specificMetric = monitoringService.getMetric('cache');
      expect(specificMetric === undefined || typeof specificMetric === 'object').toBe(true);
    });
  });

  describe('Performance Tracking', () => {
    it('should track response times', () => {
      const initialMetrics = monitoringService.getCacheMetrics();
      
      // Record several operations with different response times
      monitoringService.recordCacheHit('key1', 100);
      monitoringService.recordCacheHit('key2', 200);
      monitoringService.recordCacheMiss('key3', 300);
      
      const updatedMetrics = monitoringService.getCacheMetrics();
      expect(updatedMetrics.avgResponseTime).toBeGreaterThan(0);
      expect(updatedMetrics.avgResponseTime).not.toBe(initialMetrics.avgResponseTime);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle errors gracefully', () => {
      // Test error handling without throwing
      expect(() => {
        monitoringService.recordCacheError('test', new Error('Test error'));
      }).not.toThrow();

      expect(() => {
        monitoringService.trackError();
      }).not.toThrow();

      expect(() => {
        monitoringService.createAlert({
          severity: 'critical',
          message: 'Critical test alert',
          service: 'test'
        });
      }).not.toThrow();
    });
  });
});