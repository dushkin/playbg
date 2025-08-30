/**
 * Mock Redis Service for testing
 * Provides in-memory implementation for Redis operations
 */

interface MockRedisClient {
  zcard: jest.Mock;
  zadd: jest.Mock;
  zremrangebyscore: jest.Mock;
  expire: jest.Mock;
  zrange: jest.Mock;
  keys: jest.Mock;
  ttl: jest.Mock;
  del: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  setex: jest.Mock;
  incr: jest.Mock;
  decr: jest.Mock;
  exists: jest.Mock;
  multi: jest.Mock;
  exec: jest.Mock;
  zrangebyscore: jest.Mock;
  zrem: jest.Mock;
  zrevrange: jest.Mock;
  quit: jest.Mock;
  connect: jest.Mock;
}

class MockRedisService {
  private mockClient: MockRedisClient;
  private connected = false;
  private static instance: MockRedisService;

  constructor() {
    this.mockClient = {
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
  }
  
  public static getInstance(): MockRedisService {
    if (!MockRedisService.instance) {
      MockRedisService.instance = new MockRedisService();
    }
    return MockRedisService.instance;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  getRedisClient(): MockRedisClient {
    return this.mockClient;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async cleanupExpiredSessions(): Promise<number> {
    return 0;
  }

  // Matchmaking methods
  async addToMatchmakingQueue(queue: any): Promise<void> {}
  async removeFromMatchmakingQueue(userId: string): Promise<void> {}
  async findMatchmakingOpponent(userId: string, rating: number, gameSpeed: string, isPrivate?: boolean, ratingRange?: number): Promise<any> {
    return null;
  }

  // Game session methods
  async setGameSession(session: any): Promise<void> {}
  async getGameSession(gameId: string): Promise<any> {
    return null;
  }
  async updateGameSession(gameId: string, updates: any): Promise<void> {}
  async deleteGameSession(gameId: string): Promise<void> {}

  // User session methods
  async setUserSocketId(userId: string, socketId: string): Promise<void> {}
  async getUserSocketId(userId: string): Promise<string | null> {
    return null;
  }
  async removeUserSocketId(userId: string): Promise<void> {}

  // Game state caching
  async cacheGameState(gameId: string, state: any, ttl?: number): Promise<void> {}
  async getCachedGameState(gameId: string): Promise<any> {
    return null;
  }
  async invalidateGameStateCache(gameId: string): Promise<void> {}

  // Pub/Sub methods
  async publishGameEvent(gameId: string, event: string, data: any): Promise<void> {}
  async subscribeToGameEvents(gameId: string, callback: (event: string, data: any) => void): Promise<void> {}
  async unsubscribeFromGameEvents(gameId: string): Promise<void> {}

  // Leaderboard methods
  async updateLeaderboard(userId: string, rating: number, gameType?: string): Promise<void> {}
  async getLeaderboard(gameType?: string, limit?: number): Promise<Array<{userId: string, rating: number}>> {
    return [];
  }
}

// Mock the RedisService class
export const RedisService = MockRedisService;

// Get the singleton instance
const mockRedisService = MockRedisService.getInstance();

// Initialize the mock connection
mockRedisService.connect();

export const getRedisService = jest.fn(() => mockRedisService);
export { mockRedisService };
export default MockRedisService;