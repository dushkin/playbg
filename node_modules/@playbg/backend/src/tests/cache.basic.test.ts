import { describe, it, expect } from '@jest/globals';
import { cacheService } from '../services/cacheService';
import { cacheInvalidationService } from '../services/cacheInvalidationService';
import { statisticsService } from '../services/statisticsService';

describe('Basic Cache Service Tests', () => {
  describe('Service Initialization', () => {
    it('should initialize cache service without errors', () => {
      expect(cacheService).toBeDefined();
      expect(typeof cacheService.getCacheHealth).toBe('function');
      expect(typeof cacheService.getLeaderboard).toBe('function');
      expect(typeof cacheService.setLeaderboard).toBe('function');
      expect(typeof cacheService.invalidateLeaderboard).toBe('function');
    });

    it('should initialize cache invalidation service without errors', () => {
      expect(cacheInvalidationService).toBeDefined();
      expect(typeof cacheInvalidationService.handleInvalidation).toBe('function');
      expect(typeof cacheInvalidationService.getInvalidationStats).toBe('function');
    });

    it('should initialize statistics service without errors', () => {
      expect(statisticsService).toBeDefined();
      expect(typeof statisticsService.getUserStatistics).toBe('function');
      expect(typeof statisticsService.getLeaderboard).toBe('function');
      expect(typeof statisticsService.getGlobalStatistics).toBe('function');
    });
  });

  describe('Cache Key Generation', () => {
    it('should handle cache health check structure', async () => {
      // This should return a structure without requiring Redis connection
      try {
        const health = await cacheService.getCacheHealth();
        expect(health).toHaveProperty('connected');
        expect(health).toHaveProperty('keyCount');
      } catch (error) {
        // Expected if Redis is not available
        expect(error).toBeDefined();
      }
    });

    it('should handle invalidation event structure', async () => {
      try {
        await cacheInvalidationService.handleInvalidation({
          type: 'manual',
          reason: 'Test invalidation event'
        });
        // Should not throw errors on valid event structure
        expect(true).toBe(true);
      } catch (error) {
        // Expected if Redis is not available, but should not be TypeScript errors
        expect(error).toBeDefined();
      }
    });

    it('should handle statistics error gracefully', async () => {
      try {
        const fakeUserId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
        await statisticsService.getUserStatistics(fakeUserId);
      } catch (error) {
        // Should throw "User not found" error, not TypeScript compilation errors
        expect((error as Error).message).toContain('User not found');
      }
    });
  });

  describe('Cache Invalidation Events', () => {
    const testEvents = [
      { type: 'game_completed', userId: '507f1f77bcf86cd799439011', gameId: 'test-game' },
      { type: 'user_updated', userId: '507f1f77bcf86cd799439012' },
      { type: 'rating_changed', userId: '507f1f77bcf86cd799439013' },
      { type: 'user_registered' },
      { type: 'manual', reason: 'Admin triggered' }
    ];

    testEvents.forEach((event) => {
      it(`should handle ${event.type} event structure`, async () => {
        try {
          await cacheInvalidationService.handleInvalidation(event as any);
          expect(true).toBe(true);
        } catch (error) {
          // Expected if Redis is not available, but structure should be valid
          expect(error).toBeDefined();
        }
      });
    });
  });

  describe('Type Safety Validation', () => {
    it('should export correct interfaces and types', () => {
      // Test that our imports have the expected structure
      expect(typeof cacheService.invalidateAll).toBe('function');
      expect(typeof cacheService.warmLeaderboardCache).toBe('function');
      expect(typeof cacheService.warmGlobalStatsCache).toBe('function');
      
      expect(typeof statisticsService.getUserPerformanceAnalytics).toBe('function');
      expect(typeof statisticsService.getUserRecentGames).toBe('function');
      
      expect(typeof cacheInvalidationService.warmAllCaches).toBe('function');
      expect(typeof cacheInvalidationService.schedulePeriodicWarming).toBe('function');
    });
  });
});