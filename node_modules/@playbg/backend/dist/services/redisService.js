"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisService = exports.RedisService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
class RedisService {
    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.redis = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });
        this.subscriber = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });
        this.publisher = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true
        });
        this.setupEventHandlers();
    }
    static getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    setupEventHandlers() {
        this.redis.on('connect', () => {
            logger_1.logger.info('Redis connected successfully');
        });
        this.redis.on('error', (error) => {
            logger_1.logger.error('Redis connection error:', error);
        });
        this.redis.on('ready', () => {
            logger_1.logger.info('Redis ready for operations');
        });
    }
    async connect() {
        try {
            await Promise.all([
                this.redis.connect(),
                this.subscriber.connect(),
                this.publisher.connect()
            ]);
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    async disconnect() {
        await Promise.all([
            this.redis.quit(),
            this.subscriber.quit(),
            this.publisher.quit()
        ]);
    }
    // Expose Redis operations for rate limiting
    getRedisClient() {
        return this.redis;
    }
    // Matchmaking Queue Management
    async addToMatchmakingQueue(queue) {
        const key = `matchmaking:${queue.gameSpeed}:${queue.isPrivate ? 'private' : 'public'}`;
        const data = JSON.stringify(queue);
        // Add to sorted set with rating as score for ranking-based matchmaking
        await this.redis.zadd(key, queue.rating, data);
        // Set expiry for queue entry (15 minutes)
        await this.redis.expire(key, 900);
        logger_1.logger.info(`Added user ${queue.username} to matchmaking queue: ${key}`);
    }
    async removeFromMatchmakingQueue(userId) {
        const patterns = ['matchmaking:*:public', 'matchmaking:*:private'];
        for (const pattern of patterns) {
            const keys = await this.redis.keys(pattern);
            for (const key of keys) {
                const members = await this.redis.zrange(key, 0, -1);
                for (const member of members) {
                    const queue = JSON.parse(member);
                    if (queue.userId === userId) {
                        await this.redis.zrem(key, member);
                        logger_1.logger.info(`Removed user ${queue.username} from matchmaking queue: ${key}`);
                        return;
                    }
                }
            }
        }
    }
    async findMatchmakingOpponent(userId, rating, gameSpeed, isPrivate = false, ratingRange = 200) {
        const key = `matchmaking:${gameSpeed}:${isPrivate ? 'private' : 'public'}`;
        // Find opponents within rating range
        const minRating = rating - ratingRange;
        const maxRating = rating + ratingRange;
        const candidates = await this.redis.zrangebyscore(key, minRating, maxRating);
        for (const candidate of candidates) {
            const queue = JSON.parse(candidate);
            if (queue.userId !== userId) {
                // Remove matched opponent from queue
                await this.redis.zrem(key, candidate);
                return queue;
            }
        }
        return null;
    }
    // Game Session Management
    async setGameSession(session) {
        const key = `game:${session.gameId}`;
        const data = JSON.stringify(session);
        await this.redis.setex(key, 86400, data); // 24 hour expiry
        logger_1.logger.info(`Stored game session: ${session.gameId}`);
    }
    async getGameSession(gameId) {
        const key = `game:${gameId}`;
        const data = await this.redis.get(key);
        if (!data) {
            return null;
        }
        return JSON.parse(data);
    }
    async updateGameSession(gameId, updates) {
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
    async deleteGameSession(gameId) {
        const key = `game:${gameId}`;
        await this.redis.del(key);
        logger_1.logger.info(`Deleted game session: ${gameId}`);
    }
    // User Session Management
    async setUserSocketId(userId, socketId) {
        const key = `user:socket:${userId}`;
        await this.redis.setex(key, 3600, socketId); // 1 hour expiry
    }
    async getUserSocketId(userId) {
        const key = `user:socket:${userId}`;
        return await this.redis.get(key);
    }
    async removeUserSocketId(userId) {
        const key = `user:socket:${userId}`;
        await this.redis.del(key);
    }
    // Game State Caching
    async cacheGameState(gameId, state, ttl = 3600) {
        const key = `gamestate:${gameId}`;
        await this.redis.setex(key, ttl, JSON.stringify(state));
    }
    async getCachedGameState(gameId) {
        const key = `gamestate:${gameId}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }
    async invalidateGameStateCache(gameId) {
        const key = `gamestate:${gameId}`;
        await this.redis.del(key);
    }
    // Pub/Sub for real-time events
    async publishGameEvent(gameId, event, data) {
        const channel = `game:events:${gameId}`;
        const payload = JSON.stringify({ event, data, timestamp: Date.now() });
        await this.publisher.publish(channel, payload);
    }
    async subscribeToGameEvents(gameId, callback) {
        const channel = `game:events:${gameId}`;
        this.subscriber.subscribe(channel, (err, count) => {
            if (err) {
                logger_1.logger.error(`Failed to subscribe to ${channel}:`, err);
                return;
            }
            logger_1.logger.info(`Subscribed to ${channel}, total subscriptions: ${count}`);
        });
        this.subscriber.on('message', (receivedChannel, message) => {
            if (receivedChannel === channel) {
                try {
                    const { event, data } = JSON.parse(message);
                    callback(event, data);
                }
                catch (error) {
                    logger_1.logger.error('Error parsing game event message:', error);
                }
            }
        });
    }
    async unsubscribeFromGameEvents(gameId) {
        const channel = `game:events:${gameId}`;
        await this.subscriber.unsubscribe(channel);
    }
    // Leaderboard Management
    async updateLeaderboard(userId, rating, gameType = 'overall') {
        const key = `leaderboard:${gameType}`;
        await this.redis.zadd(key, rating, userId);
    }
    async getLeaderboard(gameType = 'overall', limit = 100) {
        const key = `leaderboard:${gameType}`;
        const results = await this.redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
        const leaderboard = [];
        for (let i = 0; i < results.length; i += 2) {
            leaderboard.push({
                userId: results[i],
                rating: parseInt(results[i + 1])
            });
        }
        return leaderboard;
    }
    // Cleanup utilities
    async cleanupExpiredSessions() {
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
        logger_1.logger.info(`Cleaned up ${cleaned} Redis keys`);
        return cleaned;
    }
}
exports.RedisService = RedisService;
exports.redisService = RedisService.getInstance();
//# sourceMappingURL=redisService.js.map