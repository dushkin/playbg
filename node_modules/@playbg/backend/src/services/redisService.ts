import Redis from 'ioredis';
import { GameSpeed } from '@playbg/shared';
import { logger } from '../utils/logger';

export interface MatchmakingQueue {
  userId: string;
  username: string;
  rating: number;
  gameSpeed: GameSpeed;
  isPrivate: boolean;
  preferences: {
    minRating?: number;
    maxRating?: number;
    gameType?: string;
  };
  joinedAt: number;
}

export interface GameSession {
  gameId: string;
  players: string[];
  spectators: string[];
  state: any;
  lastActivity: number;
}

export class RedisService {
  private static instance: RedisService;
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;

  private constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.subscriber = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.publisher = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('ready', () => {
      logger.info('Redis ready for operations');
    });
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.redis.connect(),
        this.subscriber.connect(),
        this.publisher.connect()
      ]);
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    await Promise.all([
      this.redis.quit(),
      this.subscriber.quit(),
      this.publisher.quit()
    ]);
  }

  // Expose Redis operations for rate limiting
  public getRedisClient() {
    return this.redis;
  }

  // Matchmaking Queue Management
  public async addToMatchmakingQueue(queue: MatchmakingQueue): Promise<void> {
    const key = `matchmaking:${queue.gameSpeed}:${queue.isPrivate ? 'private' : 'public'}`;
    const data = JSON.stringify(queue);
    
    // Add to sorted set with rating as score for ranking-based matchmaking
    await this.redis.zadd(key, queue.rating, data);
    
    // Set expiry for queue entry (15 minutes)
    await this.redis.expire(key, 900);
    
    logger.info(`Added user ${queue.username} to matchmaking queue: ${key}`);
  }

  public async removeFromMatchmakingQueue(userId: string): Promise<void> {
    const patterns = ['matchmaking:*:public', 'matchmaking:*:private'];
    
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      for (const key of keys) {
        const members = await this.redis.zrange(key, 0, -1);
        for (const member of members) {
          const queue: MatchmakingQueue = JSON.parse(member);
          if (queue.userId === userId) {
            await this.redis.zrem(key, member);
            logger.info(`Removed user ${queue.username} from matchmaking queue: ${key}`);
            return;
          }
        }
      }
    }
  }

  public async findMatchmakingOpponent(
    userId: string,
    rating: number,
    gameSpeed: GameSpeed,
    isPrivate: boolean = false,
    ratingRange: number = 200
  ): Promise<MatchmakingQueue | null> {
    const key = `matchmaking:${gameSpeed}:${isPrivate ? 'private' : 'public'}`;
    
    // Find opponents within rating range
    const minRating = rating - ratingRange;
    const maxRating = rating + ratingRange;
    
    const candidates = await this.redis.zrangebyscore(key, minRating, maxRating);
    
    for (const candidate of candidates) {
      const queue: MatchmakingQueue = JSON.parse(candidate);
      if (queue.userId !== userId) {
        // Remove matched opponent from queue
        await this.redis.zrem(key, candidate);
        return queue;
      }
    }
    
    return null;
  }

  // Game Session Management
  public async setGameSession(session: GameSession): Promise<void> {
    const key = `game:${session.gameId}`;
    const data = JSON.stringify(session);
    
    await this.redis.setex(key, 86400, data); // 24 hour expiry
    logger.info(`Stored game session: ${session.gameId}`);
  }

  public async getGameSession(gameId: string): Promise<GameSession | null> {
    const key = `game:${gameId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data);
  }

  public async updateGameSession(gameId: string, updates: Partial<GameSession>): Promise<void> {
    const session = await this.getGameSession(gameId);
    if (!session) {
      throw new Error(`Game session not found: ${gameId}`);
    }
    
    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: Date.now()
    };
    
    await this.setGameSession(updatedSession);
  }

  public async deleteGameSession(gameId: string): Promise<void> {
    const key = `game:${gameId}`;
    await this.redis.del(key);
    logger.info(`Deleted game session: ${gameId}`);
  }

  // User Session Management
  public async setUserSocketId(userId: string, socketId: string): Promise<void> {
    const key = `user:socket:${userId}`;
    await this.redis.setex(key, 3600, socketId); // 1 hour expiry
  }

  public async getUserSocketId(userId: string): Promise<string | null> {
    const key = `user:socket:${userId}`;
    return await this.redis.get(key);
  }

  public async removeUserSocketId(userId: string): Promise<void> {
    const key = `user:socket:${userId}`;
    await this.redis.del(key);
  }

  // Game State Caching
  public async cacheGameState(gameId: string, state: any, ttl: number = 3600): Promise<void> {
    const key = `gamestate:${gameId}`;
    await this.redis.setex(key, ttl, JSON.stringify(state));
  }

  public async getCachedGameState(gameId: string): Promise<any | null> {
    const key = `gamestate:${gameId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  public async invalidateGameStateCache(gameId: string): Promise<void> {
    const key = `gamestate:${gameId}`;
    await this.redis.del(key);
  }

  // Pub/Sub for real-time events
  public async publishGameEvent(gameId: string, event: string, data: any): Promise<void> {
    const channel = `game:events:${gameId}`;
    const payload = JSON.stringify({ event, data, timestamp: Date.now() });
    await this.publisher.publish(channel, payload);
  }

  public async subscribeToGameEvents(gameId: string, callback: (event: string, data: any) => void): Promise<void> {
    const channel = `game:events:${gameId}`;
    
    this.subscriber.subscribe(channel, (err, count) => {
      if (err) {
        logger.error(`Failed to subscribe to ${channel}:`, err);
        return;
      }
      logger.info(`Subscribed to ${channel}, total subscriptions: ${count}`);
    });

    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const { event, data } = JSON.parse(message);
          callback(event, data);
        } catch (error) {
          logger.error('Error parsing game event message:', error);
        }
      }
    });
  }

  public async unsubscribeFromGameEvents(gameId: string): Promise<void> {
    const channel = `game:events:${gameId}`;
    await this.subscriber.unsubscribe(channel);
  }

  // Leaderboard Management
  public async updateLeaderboard(userId: string, rating: number, gameType: string = 'overall'): Promise<void> {
    const key = `leaderboard:${gameType}`;
    await this.redis.zadd(key, rating, userId);
  }

  public async getLeaderboard(gameType: string = 'overall', limit: number = 100): Promise<Array<{userId: string, rating: number}>> {
    const key = `leaderboard:${gameType}`;
    const results = await this.redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    
    const leaderboard: Array<{userId: string, rating: number}> = [];
    for (let i = 0; i < results.length; i += 2) {
      leaderboard.push({
        userId: results[i],
        rating: parseInt(results[i + 1])
      });
    }
    
    return leaderboard;
  }

  // Cleanup utilities
  public async cleanupExpiredSessions(): Promise<number> {
    const patterns = ['game:*', 'user:socket:*', 'gamestate:*'];
    let cleaned = 0;
    
    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // Keys without expiry
          await this.redis.expire(key, 3600); // Set 1 hour default expiry
          cleaned++;
        }
      }
    }
    
    logger.info(`Cleaned up ${cleaned} Redis keys`);
    return cleaned;
  }
}

export const redisService = RedisService.getInstance();