/**
 * Smoke tests - Basic tests to verify core functionality works
 */

// Mock Redis service first
const mockRedisClient = {
  zcard: jest.fn().mockResolvedValue(0),
  zadd: jest.fn().mockResolvedValue(1),
  zremrangebyscore: jest.fn().mockResolvedValue(0),
  expire: jest.fn().mockResolvedValue(1),
  zrange: jest.fn().mockImplementation((key, start, stop, withScores) => {
    if (withScores === 'WITHSCORES') {
      return ['1000', Date.now().toString()]; // [value, score] format
    }
    return ['1000'];
  }),
  keys: jest.fn().mockResolvedValue([]),
  ttl: jest.fn().mockResolvedValue(60),
  del: jest.fn().mockResolvedValue(1),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  incr: jest.fn().mockResolvedValue(1),
  decr: jest.fn().mockResolvedValue(0),
  exists: jest.fn().mockResolvedValue(1),
  multi: jest.fn().mockReturnValue({
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([1, 1])
  }),
  exec: jest.fn().mockResolvedValue([]),
  zrangebyscore: jest.fn().mockResolvedValue([]),
  zrem: jest.fn().mockResolvedValue(1),
  zrevrange: jest.fn().mockResolvedValue([]),
  quit: jest.fn().mockResolvedValue('OK'),
  connect: jest.fn().mockResolvedValue(undefined)
};

const mockRedisService = {
  getRedisClient: () => mockRedisClient,
  isConnected: () => true
};

jest.mock('../services/redisService', () => ({
  getRedisService: () => mockRedisService
}));

import { rateLimitService } from '../services/rateLimitService';

describe('Smoke Tests', () => {
  describe('RateLimitService Integration', () => {
    it('should handle basic rate limiting flow without errors', async () => {
      // This should not throw any errors
      const result = await rateLimitService.checkLimit('testUser', 'game:move');
      
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remainingRequests');
      expect(result).toHaveProperty('resetTime');
      expect(typeof result.allowed).toBe('boolean');
    });

    it('should handle rate limit stats without errors', async () => {
      // This should not throw any errors
      const stats = await rateLimitService.getStats('testUser', 'game:move');
      
      expect(stats).toHaveProperty('currentCount');
      expect(stats).toHaveProperty('maxRequests');
      expect(stats).toHaveProperty('windowMs');
      expect(stats).toHaveProperty('resetTime');
    });

    it('should handle cleanup without errors', async () => {
      mockRedisClient.keys.mockResolvedValueOnce(['test-key1', 'test-key2']);
      mockRedisClient.ttl.mockResolvedValue(-1);
      mockRedisClient.zremrangebyscore.mockResolvedValue(2);
      mockRedisClient.zcard.mockResolvedValue(0);
      
      const result = await rateLimitService.cleanup();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle reset limit without errors', async () => {
      await expect(
        rateLimitService.resetLimit('testUser', 'game:move')
      ).resolves.not.toThrow();
      
      expect(mockRedisClient.del).toHaveBeenCalledWith('rate_limit:game:move:testUser');
    });
  });

  describe('Service Initialization', () => {
    it('should not throw errors during service initialization', () => {
      // Just importing the service shouldn't throw
      expect(() => {
        require('../services/rateLimitService');
        require('../services/validationService');
      }).not.toThrow();
    });
  });
});