import { redisService } from './redisService';
import { User } from '../models/User';
import { GameModel } from '../models/Game';
import { UserStatistics, PaginatedResponse } from '@playbg/shared';
import { logger } from '../utils/logger';

export interface LeaderboardEntry {
  userId: string;
  username: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
  avatar?: string;
  country?: string;
  rank: number;
}

export interface GlobalStats {
  totalUsers: number;
  totalGames: number;
  activeUsers: number;
  averageRating: number;
  topRating: number;
  totalGamesToday: number;
  lastUpdated: Date;
}

export class CacheService {
  private static instance: CacheService;
  
  // Cache TTL values in seconds
  private static readonly CACHE_TTL = {
    LEADERBOARD: 300,      // 5 minutes
    USER_STATS: 600,       // 10 minutes
    GLOBAL_STATS: 900,     // 15 minutes
    USER_PROFILE: 1800,    // 30 minutes
    RECENT_GAMES: 180      // 3 minutes
  };

  // Cache keys
  private static readonly KEYS = {
    LEADERBOARD: (type: string, page: number, limit: number) => `leaderboard:${type}:${page}:${limit}`,
    USER_STATS: (userId: string) => `user:stats:${userId}`,
    GLOBAL_STATS: 'global:stats',
    USER_PROFILE: (userId: string) => `user:profile:${userId}`,
    RECENT_GAMES: (userId: string, page: number, limit: number) => `user:games:${userId}:${page}:${limit}`,
    LEADERBOARD_TOTAL: (type: string) => `leaderboard:total:${type}`
  };

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // Leaderboard Caching
  public async getLeaderboard(
    type: string = 'overall',
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResponse<LeaderboardEntry> | null> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.LEADERBOARD(type, page, limit);
      const cached = await redis.get(key);

      if (cached) {
        logger.info(`Cache hit for leaderboard: ${key}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached leaderboard:', error);
      return null;
    }
  }

  public async setLeaderboard(
    type: string = 'overall',
    page: number = 1,
    limit: number = 20,
    data: PaginatedResponse<LeaderboardEntry>
  ): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.LEADERBOARD(type, page, limit);
      
      await redis.setex(
        key,
        CacheService.CACHE_TTL.LEADERBOARD,
        JSON.stringify(data)
      );

      logger.info(`Cached leaderboard: ${key}`);
    } catch (error) {
      logger.error('Error caching leaderboard:', error);
    }
  }

  public async invalidateLeaderboard(type?: string): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const pattern = type ? `leaderboard:${type}:*` : 'leaderboard:*';
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated ${keys.length} leaderboard cache entries`);
      }
    } catch (error) {
      logger.error('Error invalidating leaderboard cache:', error);
    }
  }

  // User Statistics Caching
  public async getUserStatistics(userId: string): Promise<UserStatistics | null> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.USER_STATS(userId);
      const cached = await redis.get(key);

      if (cached) {
        logger.info(`Cache hit for user stats: ${userId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached user statistics:', error);
      return null;
    }
  }

  public async setUserStatistics(userId: string, stats: UserStatistics): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.USER_STATS(userId);
      
      await redis.setex(
        key,
        CacheService.CACHE_TTL.USER_STATS,
        JSON.stringify(stats)
      );

      logger.info(`Cached user statistics: ${userId}`);
    } catch (error) {
      logger.error('Error caching user statistics:', error);
    }
  }

  public async invalidateUserStatistics(userId: string): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.USER_STATS(userId);
      await redis.del(key);
      logger.info(`Invalidated user statistics cache: ${userId}`);
    } catch (error) {
      logger.error('Error invalidating user statistics cache:', error);
    }
  }

  // Global Statistics Caching
  public async getGlobalStatistics(): Promise<GlobalStats | null> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.GLOBAL_STATS;
      const cached = await redis.get(key);

      if (cached) {
        logger.info('Cache hit for global statistics');
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached global statistics:', error);
      return null;
    }
  }

  public async setGlobalStatistics(stats: GlobalStats): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.GLOBAL_STATS;
      
      await redis.setex(
        key,
        CacheService.CACHE_TTL.GLOBAL_STATS,
        JSON.stringify(stats)
      );

      logger.info('Cached global statistics');
    } catch (error) {
      logger.error('Error caching global statistics:', error);
    }
  }

  public async invalidateGlobalStatistics(): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.GLOBAL_STATS;
      await redis.del(key);
      logger.info('Invalidated global statistics cache');
    } catch (error) {
      logger.error('Error invalidating global statistics cache:', error);
    }
  }

  // User Profile Caching (extended profile with stats)
  public async getUserProfile(userId: string): Promise<any | null> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.USER_PROFILE(userId);
      const cached = await redis.get(key);

      if (cached) {
        logger.info(`Cache hit for user profile: ${userId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached user profile:', error);
      return null;
    }
  }

  public async setUserProfile(userId: string, profile: any): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.USER_PROFILE(userId);
      
      await redis.setex(
        key,
        CacheService.CACHE_TTL.USER_PROFILE,
        JSON.stringify(profile)
      );

      logger.info(`Cached user profile: ${userId}`);
    } catch (error) {
      logger.error('Error caching user profile:', error);
    }
  }

  public async invalidateUserProfile(userId: string): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.USER_PROFILE(userId);
      await redis.del(key);
      logger.info(`Invalidated user profile cache: ${userId}`);
    } catch (error) {
      logger.error('Error invalidating user profile cache:', error);
    }
  }

  // Recent Games Caching
  public async getRecentGames(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResponse<any> | null> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.RECENT_GAMES(userId, page, limit);
      const cached = await redis.get(key);

      if (cached) {
        logger.info(`Cache hit for recent games: ${userId}`);
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error('Error getting cached recent games:', error);
      return null;
    }
  }

  public async setRecentGames(
    userId: string,
    page: number = 1,
    limit: number = 10,
    data: PaginatedResponse<any>
  ): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const key = CacheService.KEYS.RECENT_GAMES(userId, page, limit);
      
      await redis.setex(
        key,
        CacheService.CACHE_TTL.RECENT_GAMES,
        JSON.stringify(data)
      );

      logger.info(`Cached recent games: ${userId}`);
    } catch (error) {
      logger.error('Error caching recent games:', error);
    }
  }

  public async invalidateUserGames(userId: string): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const pattern = `user:games:${userId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated ${keys.length} user games cache entries for: ${userId}`);
      }
    } catch (error) {
      logger.error('Error invalidating user games cache:', error);
    }
  }

  // Cache warming methods
  public async warmLeaderboardCache(): Promise<void> {
    try {
      logger.info('Starting leaderboard cache warming...');

      // Warm overall leaderboard (first 3 pages)
      for (let page = 1; page <= 3; page++) {
        const users = await User.find({ gamesPlayed: { $gte: 5 } })
          .sort({ rating: -1 })
          .skip((page - 1) * 20)
          .limit(20)
          .select('username rating gamesPlayed gamesWon avatar country');

        if (users.length === 0) break;

        const total = await User.countDocuments({ gamesPlayed: { $gte: 5 } });
        const leaderboard: LeaderboardEntry[] = users.map((user, index) => ({
          userId: (user as any)._id.toString(),
          username: user.username,
          rating: user.rating,
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          avatar: user.avatar,
          country: user.country,
          rank: (page - 1) * 20 + index + 1
        }));

        await this.setLeaderboard('overall', page, 20, {
          success: true,
          data: leaderboard,
          pagination: {
            page,
            limit: 20,
            total,
            totalPages: Math.ceil(total / 20)
          }
        });
      }

      logger.info('Leaderboard cache warming completed');
    } catch (error) {
      logger.error('Error warming leaderboard cache:', error);
    }
  }

  public async warmGlobalStatsCache(): Promise<void> {
    try {
      logger.info('Starting global stats cache warming...');

      const [
        totalUsers,
        totalGames,
        activeUsers,
        avgRatingResult,
        topRatingResult,
        gamesToday
      ] = await Promise.all([
        User.countDocuments(),
        GameModel.countDocuments(),
        User.countDocuments({ isOnline: true }),
        User.aggregate([{ $group: { _id: null, avgRating: { $avg: '$rating' } } }]),
        User.findOne().sort({ rating: -1 }).select('rating'),
        GameModel.countDocuments({
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        })
      ]);

      const stats: GlobalStats = {
        totalUsers,
        totalGames,
        activeUsers,
        averageRating: Math.round(avgRatingResult[0]?.avgRating || 1200),
        topRating: topRatingResult?.rating || 1200,
        totalGamesToday: gamesToday,
        lastUpdated: new Date()
      };

      await this.setGlobalStatistics(stats);
      logger.info('Global stats cache warming completed');
    } catch (error) {
      logger.error('Error warming global stats cache:', error);
    }
  }

  // Bulk cache invalidation
  public async invalidateAll(): Promise<void> {
    try {
      const redis = redisService.getRedisClient();
      const patterns = [
        'leaderboard:*',
        'user:stats:*',
        'user:profile:*',
        'user:games:*',
        'global:stats'
      ];

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.info(`Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
        }
      }
    } catch (error) {
      logger.error('Error invalidating all caches:', error);
    }
  }

  // Cache health check
  public async getCacheHealth(): Promise<{
    connected: boolean;
    keyCount: number;
    memoryUsage?: string;
  }> {
    try {
      const redis = redisService.getRedisClient();
      const info = await redis.info('memory');
      const keyCount = await redis.dbsize();
      
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : undefined;

      return {
        connected: true,
        keyCount,
        memoryUsage
      };
    } catch (error) {
      logger.error('Error checking cache health:', error);
      return {
        connected: false,
        keyCount: 0
      };
    }
  }
}

export const cacheService = CacheService.getInstance();