/**
 * Mock Cache Invalidation Service for testing
 * Prevents actual intervals and timers from running during tests
 */

export class MockCacheInvalidationService {
  private intervals: NodeJS.Timeout[] = [];

  invalidateUser = jest.fn().mockResolvedValue(undefined);
  invalidateGame = jest.fn().mockResolvedValue(undefined);
  invalidateLeaderboard = jest.fn().mockResolvedValue(undefined);
  invalidatePattern = jest.fn().mockResolvedValue(undefined);
  scheduleInvalidation = jest.fn().mockResolvedValue(undefined);
  
  // Mock cleanup method
  cleanup = jest.fn().mockImplementation(() => {
    // Clear any test intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  });
}

const mockCacheInvalidationService = new MockCacheInvalidationService();

export const cacheInvalidationService = mockCacheInvalidationService;
export default mockCacheInvalidationService;