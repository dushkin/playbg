// Test setup file for Jest
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock Redis service for all tests - use the one from __mocks__
jest.mock('../services/redisService', () => {
  const mockRedisClient = {
    zcard: jest.fn().mockResolvedValue(0),
    zadd: jest.fn().mockResolvedValue(1),
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue(['1000', '1000']),
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
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getRedisClient: jest.fn(() => mockRedisClient),
    isConnected: jest.fn(() => true),
    cleanupExpiredSessions: jest.fn().mockResolvedValue(0),
    // Matchmaking methods
    addToMatchmakingQueue: jest.fn().mockResolvedValue(undefined),
    removeFromMatchmakingQueue: jest.fn().mockResolvedValue(undefined),
    findMatchmakingOpponent: jest.fn().mockResolvedValue(null),
    // Game session methods
    setGameSession: jest.fn().mockResolvedValue(undefined),
    getGameSession: jest.fn().mockResolvedValue(null),
    updateGameSession: jest.fn().mockResolvedValue(undefined),
    deleteGameSession: jest.fn().mockResolvedValue(undefined),
    // User session methods
    setUserSocketId: jest.fn().mockResolvedValue(undefined),
    getUserSocketId: jest.fn().mockResolvedValue(null),
    removeUserSocketId: jest.fn().mockResolvedValue(undefined),
    // Game state caching
    cacheGameState: jest.fn().mockResolvedValue(undefined),
    getCachedGameState: jest.fn().mockResolvedValue(null),
    invalidateGameStateCache: jest.fn().mockResolvedValue(undefined),
    // Pub/Sub methods
    publishGameEvent: jest.fn().mockResolvedValue(undefined),
    subscribeToGameEvents: jest.fn().mockResolvedValue(undefined),
    unsubscribeFromGameEvents: jest.fn().mockResolvedValue(undefined),
    // Leaderboard methods
    updateLeaderboard: jest.fn().mockResolvedValue(undefined),
    getLeaderboard: jest.fn().mockResolvedValue([])
  };

  return {
    getRedisService: jest.fn(() => mockRedisService),
    RedisService: {
      getInstance: jest.fn(() => mockRedisService)
    }
  };
});

// Mock database models
jest.mock('../models/User');
jest.mock('../models/Game');

// Mock services with intervals/timers
jest.mock('../services/monitoringService');
jest.mock('../services/cacheInvalidationService');

// Global teardown - close any open handles
afterAll(async () => {
  // Close any timers, intervals, or other async operations
  jest.clearAllTimers();
  jest.useRealTimers();
  
  // Give a small delay for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});