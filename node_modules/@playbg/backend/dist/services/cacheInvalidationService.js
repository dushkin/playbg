"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheInvalidationService = exports.CacheInvalidationService = void 0;
const cacheService_1 = require("./cacheService");
const redisService_1 = require("./redisService");
const logger_1 = require("../utils/logger");
class CacheInvalidationService {
    constructor() { }
    static getInstance() {
        if (!CacheInvalidationService.instance) {
            CacheInvalidationService.instance = new CacheInvalidationService();
        }
        return CacheInvalidationService.instance;
    }
    // Main invalidation handler
    async handleInvalidation(event) {
        try {
            logger_1.logger.info(`Processing cache invalidation event: ${event.type}`, {
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
                    logger_1.logger.warn(`Unknown invalidation event type: ${event.type}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error handling cache invalidation:', error);
        }
    }
    // Game completion invalidation
    async handleGameCompleted(event) {
        const { userId, gameId, affectedUsers = [] } = event;
        // Invalidate for all players in the game
        const playersToInvalidate = userId ? [userId, ...affectedUsers] : affectedUsers;
        await Promise.all([
            // Invalidate leaderboards
            cacheService_1.cacheService.invalidateLeaderboard('overall'),
            cacheService_1.cacheService.invalidateLeaderboard('monthly'),
            cacheService_1.cacheService.invalidateLeaderboard('weekly'),
            // Invalidate global stats
            cacheService_1.cacheService.invalidateGlobalStatistics(),
            // Invalidate player-specific caches
            ...playersToInvalidate.map(playerId => Promise.all([
                cacheService_1.cacheService.invalidateUserStatistics(playerId),
                cacheService_1.cacheService.invalidateUserProfile(playerId),
                cacheService_1.cacheService.invalidateUserGames(playerId)
            ]))
        ]);
        // Update Redis leaderboard for affected users
        if (playersToInvalidate.length > 0) {
            await this.updateRedisLeaderboard(playersToInvalidate);
        }
        logger_1.logger.info(`Game completion invalidation completed for game: ${gameId}`);
    }
    // User profile update invalidation
    async handleUserUpdated(event) {
        const { userId } = event;
        if (!userId) {
            logger_1.logger.warn('User updated event missing userId');
            return;
        }
        await Promise.all([
            // Invalidate user-specific caches
            cacheService_1.cacheService.invalidateUserProfile(userId),
            cacheService_1.cacheService.invalidateUserStatistics(userId),
            // Invalidate leaderboards (in case display name or avatar changed)
            cacheService_1.cacheService.invalidateLeaderboard('overall'),
        ]);
        logger_1.logger.info(`User update invalidation completed for user: ${userId}`);
    }
    // Rating change invalidation
    async handleRatingChanged(event) {
        const { userId, affectedUsers = [] } = event;
        const usersToInvalidate = userId ? [userId, ...affectedUsers] : affectedUsers;
        await Promise.all([
            // Invalidate all leaderboards
            cacheService_1.cacheService.invalidateLeaderboard(),
            // Invalidate global stats (average rating may have changed)
            cacheService_1.cacheService.invalidateGlobalStatistics(),
            // Invalidate affected user caches
            ...usersToInvalidate.map(playerId => Promise.all([
                cacheService_1.cacheService.invalidateUserProfile(playerId),
                cacheService_1.cacheService.invalidateUserStatistics(playerId)
            ]))
        ]);
        // Update Redis leaderboard
        await this.updateRedisLeaderboard(usersToInvalidate);
        logger_1.logger.info(`Rating change invalidation completed for ${usersToInvalidate.length} users`);
    }
    // New user registration invalidation
    async handleUserRegistered(event) {
        await Promise.all([
            // Invalidate global stats (user count changed)
            cacheService_1.cacheService.invalidateGlobalStatistics(),
        ]);
        logger_1.logger.info('User registration invalidation completed');
    }
    // Manual invalidation
    async handleManualInvalidation(event) {
        const { reason } = event;
        await cacheService_1.cacheService.invalidateAll();
        logger_1.logger.info(`Manual cache invalidation completed. Reason: ${reason || 'Not specified'}`);
    }
    // Helper method to update Redis leaderboard for specific users
    async updateRedisLeaderboard(userIds) {
        try {
            // Import User model dynamically to avoid circular dependency
            const { User } = await Promise.resolve().then(() => __importStar(require('../models/User')));
            for (const userId of userIds) {
                const user = await User.findById(userId).select('rating');
                if (user) {
                    await redisService_1.redisService.updateLeaderboard(userId, user.rating);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error updating Redis leaderboard:', error);
        }
    }
    // Batch invalidation for multiple events
    async handleBatchInvalidation(events) {
        logger_1.logger.info(`Processing batch invalidation: ${events.length} events`);
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
    groupEvents(events) {
        const grouped = new Map();
        for (const event of events) {
            const existing = grouped.get(event.type) || [];
            existing.push(event);
            grouped.set(event.type, existing);
        }
        return grouped;
    }
    async handleBatchRatingChanges(events) {
        const allAffectedUsers = new Set();
        for (const event of events) {
            if (event.userId)
                allAffectedUsers.add(event.userId);
            if (event.affectedUsers) {
                event.affectedUsers.forEach(id => allAffectedUsers.add(id));
            }
        }
        await this.handleRatingChanged({
            type: 'rating_changed',
            affectedUsers: Array.from(allAffectedUsers),
            reason: `Batch rating changes for ${allAffectedUsers.size} users`
        });
        logger_1.logger.info(`Batch rating changes invalidation completed for ${allAffectedUsers.size} users`);
    }
    async handleBatchGameCompletions(events) {
        const allAffectedUsers = new Set();
        for (const event of events) {
            if (event.userId)
                allAffectedUsers.add(event.userId);
            if (event.affectedUsers) {
                event.affectedUsers.forEach(id => allAffectedUsers.add(id));
            }
        }
        await this.handleGameCompleted({
            type: 'game_completed',
            affectedUsers: Array.from(allAffectedUsers),
            reason: `Batch game completions for ${events.length} games`
        });
        logger_1.logger.info(`Batch game completions invalidation completed for ${events.length} games`);
    }
    // Schedule periodic cache warming
    async schedulePeriodicWarming() {
        // Warm leaderboard cache every 5 minutes
        setInterval(async () => {
            try {
                await cacheService_1.cacheService.warmLeaderboardCache();
            }
            catch (error) {
                logger_1.logger.error('Error in scheduled leaderboard cache warming:', error);
            }
        }, 5 * 60 * 1000);
        // Warm global stats cache every 15 minutes
        setInterval(async () => {
            try {
                await cacheService_1.cacheService.warmGlobalStatsCache();
            }
            catch (error) {
                logger_1.logger.error('Error in scheduled global stats cache warming:', error);
            }
        }, 15 * 60 * 1000);
        logger_1.logger.info('Scheduled periodic cache warming tasks');
    }
    // Manual cache warming trigger
    async warmAllCaches() {
        logger_1.logger.info('Starting manual cache warming...');
        await Promise.all([
            cacheService_1.cacheService.warmLeaderboardCache(),
            cacheService_1.cacheService.warmGlobalStatsCache()
        ]);
        logger_1.logger.info('Manual cache warming completed');
    }
    // Get cache invalidation statistics
    async getInvalidationStats() {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            // Get invalidation counters
            const stats = await redis.hgetall('cache:invalidation:stats');
            const totalInvalidations = parseInt(stats.total || '0');
            const lastInvalidation = stats.lastInvalidation ? new Date(stats.lastInvalidation) : undefined;
            // Get invalidation by type
            const typeKeys = await redis.keys('cache:invalidation:type:*');
            const invalidationsByType = {};
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
        }
        catch (error) {
            logger_1.logger.error('Error getting invalidation stats:', error);
            return {
                totalInvalidations: 0,
                invalidationsByType: {}
            };
        }
    }
    // Track invalidation statistics
    async trackInvalidation(eventType) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            // Increment total counter
            await redis.hincrby('cache:invalidation:stats', 'total', 1);
            // Update last invalidation timestamp
            await redis.hset('cache:invalidation:stats', 'lastInvalidation', new Date().toISOString());
            // Increment type-specific counter
            await redis.incr(`cache:invalidation:type:${eventType}`);
            // Set expiry for stats (30 days)
            await redis.expire('cache:invalidation:stats', 30 * 24 * 60 * 60);
            await redis.expire(`cache:invalidation:type:${eventType}`, 30 * 24 * 60 * 60);
        }
        catch (error) {
            logger_1.logger.error('Error tracking invalidation stats:', error);
        }
    }
}
exports.CacheInvalidationService = CacheInvalidationService;
exports.cacheInvalidationService = CacheInvalidationService.getInstance();
//# sourceMappingURL=cacheInvalidationService.js.map