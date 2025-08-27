import { cacheService } from './cacheService';
import { getRedisService } from './redisService';
import { logger } from '../utils/logger';

export interface InvalidationEvent {
  type: 'game_completed' | 'user_updated' | 'rating_changed' | 'user_registered' | 'manual';
  userId?: string;
  gameId?: string;
  affectedUsers?: string[];
  reason?: string;
}

export class CacheInvalidationService {
  private static instance: CacheInvalidationService;

  private constructor() {}

  public static getInstance(): CacheInvalidationService {
    if (!CacheInvalidationService.instance) {
      CacheInvalidationService.instance = new CacheInvalidationService();
    }
    return CacheInvalidationService.instance;
  }

  // Main invalidation handler
  public async handleInvalidation(event: InvalidationEvent): Promise<void> {
    try {
      logger.info(`Processing cache invalidation event: ${event.type}`, { 
        userId: event.userId, 
        gameId: event.gameId,
        reason: event.reason
      });

      switch (event.type) {
        case 'game_completed':
          await this.handleGameCompleted(event);
          break;
        case 'user_updated':
          await this.handleUserUpdated(event);
          break;
        case 'rating_changed':
          await this.handleRatingChanged(event);
          break;
        case 'user_registered':
          await this.handleUserRegistered(event);
          break;
        case 'manual':
          await this.handleManualInvalidation(event);
          break;
        default:
          logger.warn(`Unknown invalidation event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling cache invalidation:', error);
    }
  }

  // Game completion invalidation
  private async handleGameCompleted(event: InvalidationEvent): Promise<void> {
    const { userId, gameId, affectedUsers = [] } = event;
    
    // Invalidate for all players in the game
    const playersToInvalidate = userId ? [userId, ...affectedUsers] : affectedUsers;

    await Promise.all([
      // Invalidate leaderboards
      cacheService.invalidateLeaderboard('overall'),
      cacheService.invalidateLeaderboard('monthly'),
      cacheService.invalidateLeaderboard('weekly'),
      
      // Invalidate global stats
      cacheService.invalidateGlobalStatistics(),
      
      // Invalidate player-specific caches
      ...playersToInvalidate.map(playerId => Promise.all([
        cacheService.invalidateUserStatistics(playerId),
        cacheService.invalidateUserProfile(playerId),
        cacheService.invalidateUserGames(playerId)
      ]))
    ]);

    // Update Redis leaderboard for affected users
    if (playersToInvalidate.length > 0) {
      await this.updateRedisLeaderboard(playersToInvalidate);
    }

    logger.info(`Game completion invalidation completed for game: ${gameId}`);
  }

  // User profile update invalidation
  private async handleUserUpdated(event: InvalidationEvent): Promise<void> {
    const { userId } = event;
    
    if (!userId) {
      logger.warn('User updated event missing userId');
      return;
    }

    await Promise.all([
      // Invalidate user-specific caches
      cacheService.invalidateUserProfile(userId),
      cacheService.invalidateUserStatistics(userId),
      
      // Invalidate leaderboards (in case display name or avatar changed)
      cacheService.invalidateLeaderboard('overall'),
    ]);

    logger.info(`User update invalidation completed for user: ${userId}`);
  }

  // Rating change invalidation
  private async handleRatingChanged(event: InvalidationEvent): Promise<void> {
    const { userId, affectedUsers = [] } = event;
    const usersToInvalidate = userId ? [userId, ...affectedUsers] : affectedUsers;

    await Promise.all([
      // Invalidate all leaderboards
      cacheService.invalidateLeaderboard(),
      
      // Invalidate global stats (average rating may have changed)
      cacheService.invalidateGlobalStatistics(),
      
      // Invalidate affected user caches
      ...usersToInvalidate.map(playerId => Promise.all([
        cacheService.invalidateUserProfile(playerId),
        cacheService.invalidateUserStatistics(playerId)
      ]))
    ]);

    // Update Redis leaderboard
    await this.updateRedisLeaderboard(usersToInvalidate);

    logger.info(`Rating change invalidation completed for ${usersToInvalidate.length} users`);
  }

  // New user registration invalidation
  private async handleUserRegistered(event: InvalidationEvent): Promise<void> {
    await Promise.all([
      // Invalidate global stats (user count changed)
      cacheService.invalidateGlobalStatistics(),
    ]);

    logger.info('User registration invalidation completed');
  }

  // Manual invalidation
  private async handleManualInvalidation(event: InvalidationEvent): Promise<void> {
    const { reason } = event;
    
    await cacheService.invalidateAll();
    
    logger.info(`Manual cache invalidation completed. Reason: ${reason || 'Not specified'}`);
  }

  // Helper method to update Redis leaderboard for specific users
  private async updateRedisLeaderboard(userIds: string[]): Promise<void> {
    try {
      // Import User model dynamically to avoid circular dependency
      const { User } = await import('../models/User');
      
      for (const userId of userIds) {
        const user = await User.findById(userId).select('rating');
        if (user) {
          await getRedisService().updateLeaderboard(userId, user.rating);
        }
      }
    } catch (error) {
      logger.error('Error updating Redis leaderboard:', error);
    }
  }

  // Batch invalidation for multiple events
  public async handleBatchInvalidation(events: InvalidationEvent[]): Promise<void> {
    logger.info(`Processing batch invalidation: ${events.length} events`);

    // Group similar events to optimize invalidation
    const groupedEvents = this.groupEvents(events);
    
    for (const [eventType, eventGroup] of groupedEvents.entries()) {
      switch (eventType) {
        case 'rating_changed':
          await this.handleBatchRatingChanges(eventGroup);
          break;
        case 'game_completed':
          await this.handleBatchGameCompletions(eventGroup);
          break;
        default:
          // Handle individual events
          for (const event of eventGroup) {
            await this.handleInvalidation(event);
          }
      }
    }
  }

  private groupEvents(events: InvalidationEvent[]): Map<string, InvalidationEvent[]> {
    const grouped = new Map<string, InvalidationEvent[]>();
    
    for (const event of events) {
      const existing = grouped.get(event.type) || [];
      existing.push(event);
      grouped.set(event.type, existing);
    }
    
    return grouped;
  }

  private async handleBatchRatingChanges(events: InvalidationEvent[]): Promise<void> {
    const allAffectedUsers = new Set<string>();
    
    for (const event of events) {
      if (event.userId) allAffectedUsers.add(event.userId);
      if (event.affectedUsers) {
        event.affectedUsers.forEach(id => allAffectedUsers.add(id));
      }
    }

    await this.handleRatingChanged({
      type: 'rating_changed',
      affectedUsers: Array.from(allAffectedUsers),
      reason: `Batch rating changes for ${allAffectedUsers.size} users`
    });

    logger.info(`Batch rating changes invalidation completed for ${allAffectedUsers.size} users`);
  }

  private async handleBatchGameCompletions(events: InvalidationEvent[]): Promise<void> {
    const allAffectedUsers = new Set<string>();
    
    for (const event of events) {
      if (event.userId) allAffectedUsers.add(event.userId);
      if (event.affectedUsers) {
        event.affectedUsers.forEach(id => allAffectedUsers.add(id));
      }
    }

    await this.handleGameCompleted({
      type: 'game_completed',
      affectedUsers: Array.from(allAffectedUsers),
      reason: `Batch game completions for ${events.length} games`
    });

    logger.info(`Batch game completions invalidation completed for ${events.length} games`);
  }

  // Schedule periodic cache warming
  public async schedulePeriodicWarming(): Promise<void> {
    // Warm leaderboard cache every 5 minutes
    setInterval(async () => {
      try {
        await cacheService.warmLeaderboardCache();
      } catch (error) {
        logger.error('Error in scheduled leaderboard cache warming:', error);
      }
    }, 5 * 60 * 1000);

    // Warm global stats cache every 15 minutes
    setInterval(async () => {
      try {
        await cacheService.warmGlobalStatsCache();
      } catch (error) {
        logger.error('Error in scheduled global stats cache warming:', error);
      }
    }, 15 * 60 * 1000);

    logger.info('Scheduled periodic cache warming tasks');
  }

  // Manual cache warming trigger
  public async warmAllCaches(): Promise<void> {
    logger.info('Starting manual cache warming...');
    
    await Promise.all([
      cacheService.warmLeaderboardCache(),
      cacheService.warmGlobalStatsCache()
    ]);
    
    logger.info('Manual cache warming completed');
  }

  // Get cache invalidation statistics
  public async getInvalidationStats(): Promise<{
    totalInvalidations: number;
    invalidationsByType: Record<string, number>;
    lastInvalidation?: Date;
  }> {
    try {
      const redis = getRedisService().getRedisClient();
      
      // Get invalidation counters
      const stats = await redis.hgetall('cache:invalidation:stats');
      const totalInvalidations = parseInt(stats.total || '0');
      const lastInvalidation = stats.lastInvalidation ? new Date(stats.lastInvalidation) : undefined;
      
      // Get invalidation by type
      const typeKeys = await redis.keys('cache:invalidation:type:*');
      const invalidationsByType: Record<string, number> = {};
      
      for (const key of typeKeys) {
        const type = key.replace('cache:invalidation:type:', '');
        const count = await redis.get(key);
        invalidationsByType[type] = parseInt(count || '0');
      }

      return {
        totalInvalidations,
        invalidationsByType,
        lastInvalidation
      };
    } catch (error) {
      logger.error('Error getting invalidation stats:', error);
      return {
        totalInvalidations: 0,
        invalidationsByType: {}
      };
    }
  }

  // Track invalidation statistics
  private async trackInvalidation(eventType: string): Promise<void> {
    try {
      const redis = getRedisService().getRedisClient();
      
      // Increment total counter
      await redis.hincrby('cache:invalidation:stats', 'total', 1);
      
      // Update last invalidation timestamp
      await redis.hset('cache:invalidation:stats', 'lastInvalidation', new Date().toISOString());
      
      // Increment type-specific counter
      await redis.incr(`cache:invalidation:type:${eventType}`);
      
      // Set expiry for stats (30 days)
      await redis.expire('cache:invalidation:stats', 30 * 24 * 60 * 60);
      await redis.expire(`cache:invalidation:type:${eventType}`, 30 * 24 * 60 * 60);
    } catch (error) {
      logger.error('Error tracking invalidation stats:', error);
    }
  }
}

export const cacheInvalidationService = CacheInvalidationService.getInstance();