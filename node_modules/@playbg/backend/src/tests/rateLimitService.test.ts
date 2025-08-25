import { rateLimitService } from '../services/rateLimitService';
import { redisService } from '../services/redisService';

// Mock Redis service for testing
jest.mock('../services/redisService', () => ({
  redisService: {
    getRedisClient: () => ({
      zremrangebyscore: jest.fn().mockResolvedValue(0),
      zcard: jest.fn().mockResolvedValue(0),
      zadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue(['1000', '1000']),
      keys: jest.fn().mockResolvedValue([]),
      ttl: jest.fn().mockResolvedValue(60),
      del: jest.fn().mockResolvedValue(1)
    })
  }
}));

describe('RateLimitService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLimit', () => {
    it('should allow requests within rate limit', async () => {
      const result = await rateLimitService.checkLimit('user123', 'game:move');
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBeGreaterThanOrEqual(0);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests when rate limit exceeded', async () => {
      // Mock Redis to return max requests count
      const mockRedis = redisService.getRedisClient() as any;
      mockRedis.zcard.mockResolvedValue(30); // Max for game:move is 30
      
      const result = await rateLimitService.checkLimit('user123', 'game:move');
      
      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should use custom config when provided', async () => {
      const customConfig = {
        windowMs: 5000,
        maxRequests: 5
      };
      
      const result = await rateLimitService.checkLimit('user123', 'custom_action', customConfig);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBeLessThanOrEqual(4);
    });
  });

  describe('getStats', () => {
    it('should return rate limit statistics', async () => {
      const stats = await rateLimitService.getStats('user123', 'game:move');
      
      expect(stats).toHaveProperty('currentCount');
      expect(stats).toHaveProperty('maxRequests');
      expect(stats).toHaveProperty('windowMs');
      expect(stats).toHaveProperty('resetTime');
      expect(stats.maxRequests).toBe(30); // Default for game:move
    });
  });

  describe('Express middleware', () => {
    it('should create Express middleware that allows requests within limit', async () => {
      const middleware = rateLimitService.createExpressMiddleware('api:general');
      
      const mockReq = { ip: '127.0.0.1', user: { id: 'user123' } };
      const mockRes = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();
      
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': expect.any(String),
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should block requests and return 429 when rate limit exceeded', async () => {
      // Mock Redis to return max requests count
      const mockRedis = redisService.getRedisClient() as any;
      mockRedis.zcard.mockResolvedValue(100); // Max for api:general
      
      const middleware = rateLimitService.createExpressMiddleware('api:general');
      
      const mockReq = { ip: '127.0.0.1', user: { id: 'user123' } };
      const mockRes = {
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();
      
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: expect.any(Number)
      });
    });
  });

  describe('Socket middleware', () => {
    it('should create Socket.IO middleware that allows requests within limit', async () => {
      const middleware = rateLimitService.createSocketMiddleware('game:move');
      
      const mockSocket = { userId: 'user123', id: 'socket123' };
      const mockNext = jest.fn();
      
      await middleware(mockSocket, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should block requests when rate limit exceeded', async () => {
      // Mock Redis to return max requests count
      const mockRedis = redisService.getRedisClient() as any;
      mockRedis.zcard.mockResolvedValue(30); // Max for game:move
      
      const middleware = rateLimitService.createSocketMiddleware('game:move');
      
      const mockSocket = { userId: 'user123', id: 'socket123' };
      const mockNext = jest.fn();
      
      await middleware(mockSocket, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      const error = mockNext.mock.calls[0][0];
      expect(error.type).toBe('RateLimitError');
      expect(error.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired rate limit data', async () => {
      const mockRedis = redisService.getRedisClient() as any;
      mockRedis.keys.mockResolvedValue(['rate_limit:test:user1', 'rate_limit:test:user2']);
      mockRedis.ttl.mockResolvedValue(-1); // No expiry
      mockRedis.zremrangebyscore.mockResolvedValue(5);
      mockRedis.zcard.mockResolvedValue(0);
      
      const cleaned = await rateLimitService.cleanup();
      
      expect(cleaned).toBeGreaterThan(0);
      expect(mockRedis.keys).toHaveBeenCalledWith('rate_limit:*');
    });
  });

  describe('resetLimit', () => {
    it('should reset rate limit for a user and action', async () => {
      const mockRedis = redisService.getRedisClient() as any;
      
      await rateLimitService.resetLimit('user123', 'game:move');
      
      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:game:move:user123');
    });
  });
});

// Integration test simulation
describe('Rate Limiting Integration', () => {
  it('should demonstrate typical game action rate limiting flow', async () => {
    const userId = 'testUser123';
    const action = 'game:move';
    
    // First request should be allowed
    const result1 = await rateLimitService.checkLimit(userId, action);
    expect(result1.allowed).toBe(true);
    expect(result1.remainingRequests).toBe(29); // 30 max - 1
    
    // Reset to simulate clean state for test
    await rateLimitService.resetLimit(userId, action);
    
    // Get stats
    const stats = await rateLimitService.getStats(userId, action);
    expect(stats.maxRequests).toBe(30);
    expect(stats.windowMs).toBe(60000); // 1 minute
  });
});