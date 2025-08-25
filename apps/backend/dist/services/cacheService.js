"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const redisService_1 = require("./redisService");
const User_1 = require("../models/User");
const Game_1 = require("../models/Game");
const logger_1 = require("../utils/logger");
class CacheService {
    constructor() { }
    static getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }
    // Leaderboard Caching
    async getLeaderboard(type = 'overall', page = 1, limit = 20) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.LEADERBOARD(type, page, limit);
            const cached = await redis.get(key);
            if (cached) {
                logger_1.logger.info(`Cache hit for leaderboard: ${key}`);
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting cached leaderboard:', error);
            return null;
        }
    }
    async setLeaderboard(type = 'overall', page = 1, limit = 20, data) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.LEADERBOARD(type, page, limit);
            await redis.setex(key, CacheService.CACHE_TTL.LEADERBOARD, JSON.stringify(data));
            logger_1.logger.info(`Cached leaderboard: ${key}`);
        }
        catch (error) {
            logger_1.logger.error('Error caching leaderboard:', error);
        }
    }
    async invalidateLeaderboard(type) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const pattern = type ? `leaderboard:${type}:*` : 'leaderboard:*';
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                logger_1.logger.info(`Invalidated ${keys.length} leaderboard cache entries`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error invalidating leaderboard cache:', error);
        }
    }
    // User Statistics Caching
    async getUserStatistics(userId) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.USER_STATS(userId);
            const cached = await redis.get(key);
            if (cached) {
                logger_1.logger.info(`Cache hit for user stats: ${userId}`);
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting cached user statistics:', error);
            return null;
        }
    }
    async setUserStatistics(userId, stats) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.USER_STATS(userId);
            await redis.setex(key, CacheService.CACHE_TTL.USER_STATS, JSON.stringify(stats));
            logger_1.logger.info(`Cached user statistics: ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error caching user statistics:', error);
        }
    }
    async invalidateUserStatistics(userId) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.USER_STATS(userId);
            await redis.del(key);
            logger_1.logger.info(`Invalidated user statistics cache: ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error invalidating user statistics cache:', error);
        }
    }
    // Global Statistics Caching
    async getGlobalStatistics() {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.GLOBAL_STATS;
            const cached = await redis.get(key);
            if (cached) {
                logger_1.logger.info('Cache hit for global statistics');
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting cached global statistics:', error);
            return null;
        }
    }
    async setGlobalStatistics(stats) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.GLOBAL_STATS;
            await redis.setex(key, CacheService.CACHE_TTL.GLOBAL_STATS, JSON.stringify(stats));
            logger_1.logger.info('Cached global statistics');
        }
        catch (error) {
            logger_1.logger.error('Error caching global statistics:', error);
        }
    }
    async invalidateGlobalStatistics() {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.GLOBAL_STATS;
            await redis.del(key);
            logger_1.logger.info('Invalidated global statistics cache');
        }
        catch (error) {
            logger_1.logger.error('Error invalidating global statistics cache:', error);
        }
    }
    // User Profile Caching (extended profile with stats)
    async getUserProfile(userId) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.USER_PROFILE(userId);
            const cached = await redis.get(key);
            if (cached) {
                logger_1.logger.info(`Cache hit for user profile: ${userId}`);
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting cached user profile:', error);
            return null;
        }
    }
    async setUserProfile(userId, profile) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.USER_PROFILE(userId);
            await redis.setex(key, CacheService.CACHE_TTL.USER_PROFILE, JSON.stringify(profile));
            logger_1.logger.info(`Cached user profile: ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error caching user profile:', error);
        }
    }
    async invalidateUserProfile(userId) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.USER_PROFILE(userId);
            await redis.del(key);
            logger_1.logger.info(`Invalidated user profile cache: ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error invalidating user profile cache:', error);
        }
    }
    // Recent Games Caching
    async getRecentGames(userId, page = 1, limit = 10) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.RECENT_GAMES(userId, page, limit);
            const cached = await redis.get(key);
            if (cached) {
                logger_1.logger.info(`Cache hit for recent games: ${userId}`);
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            logger_1.logger.error('Error getting cached recent games:', error);
            return null;
        }
    }
    async setRecentGames(userId, page = 1, limit = 10, data) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const key = CacheService.KEYS.RECENT_GAMES(userId, page, limit);
            await redis.setex(key, CacheService.CACHE_TTL.RECENT_GAMES, JSON.stringify(data));
            logger_1.logger.info(`Cached recent games: ${userId}`);
        }
        catch (error) {
            logger_1.logger.error('Error caching recent games:', error);
        }
    }
    async invalidateUserGames(userId) {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const pattern = `user:games:${userId}:*`;
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
                logger_1.logger.info(`Invalidated ${keys.length} user games cache entries for: ${userId}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Error invalidating user games cache:', error);
        }
    }
    // Cache warming methods
    async warmLeaderboardCache() {
        try {
            logger_1.logger.info('Starting leaderboard cache warming...');
            // Warm overall leaderboard (first 3 pages)
            for (let page = 1; page <= 3; page++) {
                const users = await User_1.User.find({ gamesPlayed: { $gte: 5 } })
                    .sort({ rating: -1 })
                    .skip((page - 1) * 20)
                    .limit(20)
                    .select('username rating gamesPlayed gamesWon avatar country');
                if (users.length === 0)
                    break;
                const total = await User_1.User.countDocuments({ gamesPlayed: { $gte: 5 } });
                const leaderboard = users.map((user, index) => ({
                    userId: user._id.toString(),
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
            logger_1.logger.info('Leaderboard cache warming completed');
        }
        catch (error) {
            logger_1.logger.error('Error warming leaderboard cache:', error);
        }
    }
    async warmGlobalStatsCache() {
        try {
            logger_1.logger.info('Starting global stats cache warming...');
            const [totalUsers, totalGames, activeUsers, avgRatingResult, topRatingResult, gamesToday] = await Promise.all([
                User_1.User.countDocuments(),
                Game_1.GameModel.countDocuments(),
                User_1.User.countDocuments({ isOnline: true }),
                User_1.User.aggregate([{ $group: { _id: null, avgRating: { $avg: '$rating' } } }]),
                User_1.User.findOne().sort({ rating: -1 }).select('rating'),
                Game_1.GameModel.countDocuments({
                    createdAt: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                })
            ]);
            const stats = {
                totalUsers,
                totalGames,
                activeUsers,
                averageRating: Math.round(avgRatingResult[0]?.avgRating || 1200),
                topRating: topRatingResult?.rating || 1200,
                totalGamesToday: gamesToday,
                lastUpdated: new Date()
            };
            await this.setGlobalStatistics(stats);
            logger_1.logger.info('Global stats cache warming completed');
        }
        catch (error) {
            logger_1.logger.error('Error warming global stats cache:', error);
        }
    }
    // Bulk cache invalidation
    async invalidateAll() {
        try {
            const redis = redisService_1.redisService.getRedisClient();
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
                    logger_1.logger.info(`Invalidated ${keys.length} cache entries for pattern: ${pattern}`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error invalidating all caches:', error);
        }
    }
    // Cache health check
    async getCacheHealth() {
        try {
            const redis = redisService_1.redisService.getRedisClient();
            const info = await redis.info('memory');
            const keyCount = await redis.dbsize();
            const memoryMatch = info.match(/used_memory_human:(.+)/);
            const memoryUsage = memoryMatch ? memoryMatch[1].trim() : undefined;
            return {
                connected: true,
                keyCount,
                memoryUsage
            };
        }
        catch (error) {
            logger_1.logger.error('Error checking cache health:', error);
            return {
                connected: false,
                keyCount: 0
            };
        }
    }
}
exports.CacheService = CacheService;
// Cache TTL values in seconds
CacheService.CACHE_TTL = {
    LEADERBOARD: 300, // 5 minutes
    USER_STATS: 600, // 10 minutes
    GLOBAL_STATS: 900, // 15 minutes
    USER_PROFILE: 1800, // 30 minutes
    RECENT_GAMES: 180 // 3 minutes
};
// Cache keys
CacheService.KEYS = {
    LEADERBOARD: (type, page, limit) => `leaderboard:${type}:${page}:${limit}`,
    USER_STATS: (userId) => `user:stats:${userId}`,
    GLOBAL_STATS: 'global:stats',
    USER_PROFILE: (userId) => `user:profile:${userId}`,
    RECENT_GAMES: (userId, page, limit) => `user:games:${userId}:${page}:${limit}`,
    LEADERBOARD_TOTAL: (type) => `leaderboard:total:${type}`
};
exports.cacheService = CacheService.getInstance();
//# sourceMappingURL=cacheService.js.map