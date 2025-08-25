"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitService = exports.RateLimitService = void 0;
const redisService_1 = require("./redisService");
const logger_1 = require("../utils/logger");
class RateLimitService {
    constructor() {
        this.configs = new Map();
        this.setupDefaultConfigs();
    }
    static getInstance() {
        if (!RateLimitService.instance) {
            RateLimitService.instance = new RateLimitService();
        }
        return RateLimitService.instance;
    }
    setupDefaultConfigs() {
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
    async checkLimit(identifier, action, customConfig) {
        try {
            const config = this.getConfig(action, customConfig);
            const key = this.generateKey(identifier, action);
            const now = Date.now();
            const windowStart = now - config.windowMs;
            // Clean old entries and count current requests
            const currentCount = await this.getCurrentCount(key, windowStart, now);
            if (currentCount >= config.maxRequests) {
                const resetTime = await this.getResetTime(key, config.windowMs);
                logger_1.logger.warn(`Rate limit exceeded for ${identifier}:${action} - ${currentCount}/${config.maxRequests}`);
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
        }
        catch (error) {
            logger_1.logger.error(`Rate limit check error for ${identifier}:${action}:`, error);
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
    addConfig(action, config) {
        this.configs.set(action, config);
    }
    /**
     * Get rate limit stats for monitoring
     */
    async getStats(identifier, action) {
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
    async resetLimit(identifier, action) {
        const key = this.generateKey(identifier, action);
        await redisService_1.redisService.getRedisClient().del(key);
        logger_1.logger.info(`Rate limit reset for ${identifier}:${action}`);
    }
    getConfig(action, customConfig) {
        const baseConfig = this.configs.get(action) || this.configs.get('api:general');
        if (customConfig) {
            return { ...baseConfig, ...customConfig };
        }
        return baseConfig;
    }
    generateKey(identifier, action) {
        return `rate_limit:${action}:${identifier}`;
    }
    async getCurrentCount(key, windowStart, now) {
        // Get Redis client
        const redis = redisService_1.redisService.getRedisClient();
        // Remove expired entries
        await redis.zremrangebyscore(key, '-inf', windowStart);
        // Count current entries
        const count = await redis.zcard(key);
        return count;
    }
    async recordRequest(key, timestamp, windowMs) {
        // Get Redis client
        const redis = redisService_1.redisService.getRedisClient();
        // Add current request with timestamp as score
        await redis.zadd(key, timestamp, `${timestamp}-${Math.random()}`);
        // Set expiry for the key
        await redis.expire(key, Math.ceil(windowMs / 1000));
    }
    async getResetTime(key, windowMs) {
        // Get the oldest entry to determine when window resets
        const oldestEntries = await redisService_1.redisService.getRedisClient().zrange(key, 0, 0, 'WITHSCORES');
        if (oldestEntries.length === 0) {
            return Date.now() + windowMs;
        }
        const oldestTimestamp = parseInt(oldestEntries[1]);
        return oldestTimestamp + windowMs;
    }
    /**
     * Middleware factory for Express routes
     */
    createExpressMiddleware(action, customConfig) {
        return async (req, res, next) => {
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
    createSocketMiddleware(action, customConfig) {
        return async (socket, next) => {
            const identifier = socket.userId || socket.id;
            const result = await this.checkLimit(identifier, action, customConfig);
            if (!result.allowed) {
                const error = new Error(result.error || 'Rate limit exceeded');
                error.type = 'RateLimitError';
                error.retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
                return next(error);
            }
            next();
        };
    }
    /**
     * Clean up expired rate limit data
     */
    async cleanup() {
        const pattern = 'rate_limit:*';
        const keys = await redisService_1.redisService.getRedisClient().keys(pattern);
        let cleaned = 0;
        for (const key of keys) {
            const ttl = await redisService_1.redisService.getRedisClient().ttl(key);
            if (ttl === -1) {
                // Key without expiry, clean old entries
                const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
                const removed = await redisService_1.redisService.getRedisClient().zremrangebyscore(key, '-inf', cutoff);
                if (removed > 0) {
                    cleaned += removed;
                }
                // Check if key is now empty and delete if so
                const count = await redisService_1.redisService.getRedisClient().zcard(key);
                if (count === 0) {
                    await redisService_1.redisService.getRedisClient().del(key);
                    cleaned++;
                }
            }
        }
        logger_1.logger.info(`Rate limit cleanup: ${cleaned} entries cleaned`);
        return cleaned;
    }
}
exports.RateLimitService = RateLimitService;
exports.rateLimitService = RateLimitService.getInstance();
//# sourceMappingURL=rateLimitService.js.map