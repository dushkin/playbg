import { getRedisService } from './redisService';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string, action: string) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  error?: string;
}

export class RateLimitService {
  private static instance: RateLimitService;
  
  private configs: Map<string, RateLimitConfig> = new Map();

  private constructor() {
    this.setupDefaultConfigs();
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  private setupDefaultConfigs(): void {
    // API Rate Limits
    this.configs.set('api:auth', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5 // 5 login attempts per 15 minutes
    });

    this.configs.set('api:general', {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100 // 100 requests per 15 minutes
    });

    this.configs.set('api:tournament_create', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3 // 3 tournament creations per hour
    });

    // Game Action Rate Limits
    this.configs.set('game:move', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30 // 30 moves per minute (reasonable for backgammon)
    });

    this.configs.set('game:dice_roll', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10 // 10 dice rolls per minute
    });

    this.configs.set('game:chat', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20 // 20 chat messages per minute
    });

    this.configs.set('game:join', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10 // 10 game joins per minute
    });

    // Matchmaking Rate Limits
    this.configs.set('matchmaking:join', {
      windowMs: 30 * 1000, // 30 seconds
      maxRequests: 5 // 5 matchmaking attempts per 30 seconds
    });

    // Tournament Rate Limits
    this.configs.set('tournament:join', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10 // 10 tournament joins per minute
    });

    this.configs.set('tournament:action', {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20 // 20 tournament actions per minute
    });
  }

  /**
   * Check if an action is allowed based on rate limits
   */
  public async checkLimit(
    identifier: string, 
    action: string, 
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    try {
      const config = this.getConfig(action, customConfig);
      const key = this.generateKey(identifier, action);
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // Clean old entries and count current requests
      const currentCount = await this.getCurrentCount(key, windowStart, now);

      if (currentCount >= config.maxRequests) {
        const resetTime = await this.getResetTime(key, config.windowMs);
        
        logger.warn(`Rate limit exceeded for ${identifier}:${action} - ${currentCount}/${config.maxRequests}`);
        
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime,
          error: 'Rate limit exceeded. Please try again later.'
        };
      }

      // Record this request
      await this.recordRequest(key, now, config.windowMs);

      return {
        allowed: true,
        remainingRequests: config.maxRequests - currentCount - 1,
        resetTime: now + config.windowMs
      };
    } catch (error) {
      logger.error(`Rate limit check error for ${identifier}:${action}:`, error);
      // On error, allow the request but log it
      return {
        allowed: true,
        remainingRequests: 0,
        resetTime: Date.now(),
        error: 'Rate limit service error'
      };
    }
  }

  /**
   * Add a custom rate limit configuration
   */
  public addConfig(action: string, config: RateLimitConfig): void {
    this.configs.set(action, config);
  }

  /**
   * Get rate limit stats for monitoring
   */
  public async getStats(identifier: string, action: string): Promise<{
    currentCount: number;
    maxRequests: number;
    windowMs: number;
    resetTime: number;
  }> {
    const config = this.getConfig(action);
    const key = this.generateKey(identifier, action);
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const currentCount = await this.getCurrentCount(key, windowStart, now);
    const resetTime = await this.getResetTime(key, config.windowMs);

    return {
      currentCount,
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      resetTime
    };
  }

  /**
   * Reset rate limit for a specific identifier and action
   */
  public async resetLimit(identifier: string, action: string): Promise<void> {
    const key = this.generateKey(identifier, action);
    await getRedisService().getRedisClient().del(key);
    logger.info(`Rate limit reset for ${identifier}:${action}`);
  }

  private getConfig(action: string, customConfig?: Partial<RateLimitConfig>): RateLimitConfig {
    const baseConfig = this.configs.get(action) || this.configs.get('api:general')!;
    
    if (customConfig) {
      return { ...baseConfig, ...customConfig };
    }
    
    return baseConfig;
  }

  private generateKey(identifier: string, action: string): string {
    return `rate_limit:${action}:${identifier}`;
  }

  private async getCurrentCount(key: string, windowStart: number, now: number): Promise<number> {
    // Get Redis client
    const redis = getRedisService().getRedisClient();
    
    // Remove expired entries
    await redis.zremrangebyscore(key, '-inf', windowStart);
    
    // Count current entries
    const count = await redis.zcard(key);
    return count;
  }

  private async recordRequest(key: string, timestamp: number, windowMs: number): Promise<void> {
    // Get Redis client
    const redis = getRedisService().getRedisClient();
    
    // Add current request with timestamp as score
    await redis.zadd(key, timestamp, `${timestamp}-${Math.random()}`);
    
    // Set expiry for the key
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }

  private async getResetTime(key: string, windowMs: number): Promise<number> {
    // Get the oldest entry to determine when window resets
    const oldestEntries = await getRedisService().getRedisClient().zrange(key, 0, 0, 'WITHSCORES');
    
    if (oldestEntries.length === 0) {
      return Date.now() + windowMs;
    }
    
    const oldestTimestamp = parseInt(oldestEntries[1]);
    return oldestTimestamp + windowMs;
  }

  /**
   * Middleware factory for Express routes
   */
  public createExpressMiddleware(action: string, customConfig?: Partial<RateLimitConfig>) {
    return async (req: any, res: any, next: any) => {
      const identifier = req.ip || req.user?.id || 'anonymous';
      const result = await this.checkLimit(identifier, action, customConfig);
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': this.getConfig(action, customConfig).maxRequests.toString(),
        'X-RateLimit-Remaining': result.remainingRequests.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
      });

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          error: result.error,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }

      next();
    };
  }

  /**
   * Socket.IO middleware factory
   */
  public createSocketMiddleware(action: string, customConfig?: Partial<RateLimitConfig>) {
    return async (socket: any, next: any) => {
      const identifier = socket.userId || socket.id;
      const result = await this.checkLimit(identifier, action, customConfig);

      if (!result.allowed) {
        const error = new Error(result.error || 'Rate limit exceeded');
        (error as any).type = 'RateLimitError';
        (error as any).retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        return next(error);
      }

      next();
    };
  }

  /**
   * Clean up expired rate limit data
   */
  public async cleanup(): Promise<number> {
    const pattern = 'rate_limit:*';
    const keys = await getRedisService().getRedisClient().keys(pattern);
    let cleaned = 0;

    for (const key of keys) {
      const ttl = await getRedisService().getRedisClient().ttl(key);
      if (ttl === -1) {
        // Key without expiry, clean old entries
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
        const removed = await getRedisService().getRedisClient().zremrangebyscore(key, '-inf', cutoff);
        if (removed > 0) {
          cleaned += removed;
        }
        
        // Check if key is now empty and delete if so
        const count = await getRedisService().getRedisClient().zcard(key);
        if (count === 0) {
          await getRedisService().getRedisClient().del(key);
          cleaned++;
        }
      }
    }

    logger.info(`Rate limit cleanup: ${cleaned} entries cleaned`);
    return cleaned;
  }
}

export const rateLimitService = RateLimitService.getInstance();