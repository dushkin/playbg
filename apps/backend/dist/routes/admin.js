"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cacheService_1 = require("../services/cacheService");
const cacheInvalidationService_1 = require("../services/cacheInvalidationService");
const statisticsService_1 = require("../services/statisticsService");
const router = express_1.default.Router();
// @route   GET /api/admin/cache/health
// @desc    Get cache health status
// @access  Private (Admin)
router.get('/cache/health', async (req, res) => {
    try {
        const health = await cacheService_1.cacheService.getCacheHealth();
        res.json({
            success: true,
            data: health
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   POST /api/admin/cache/warm
// @desc    Manually warm caches
// @access  Private (Admin)
router.post('/cache/warm', async (req, res) => {
    try {
        const { type } = req.body;
        switch (type) {
            case 'leaderboard':
                await cacheService_1.cacheService.warmLeaderboardCache();
                break;
            case 'global':
                await cacheService_1.cacheService.warmGlobalStatsCache();
                break;
            case 'all':
            default:
                await cacheInvalidationService_1.cacheInvalidationService.warmAllCaches();
                break;
        }
        res.json({
            success: true,
            message: `Cache warming completed for type: ${type || 'all'}`
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   DELETE /api/admin/cache/invalidate
// @desc    Invalidate caches
// @access  Private (Admin)
router.delete('/cache/invalidate', async (req, res) => {
    try {
        const { type, userId } = req.body;
        switch (type) {
            case 'leaderboard':
                await cacheService_1.cacheService.invalidateLeaderboard();
                break;
            case 'user':
                if (userId) {
                    await Promise.all([
                        cacheService_1.cacheService.invalidateUserStatistics(userId),
                        cacheService_1.cacheService.invalidateUserProfile(userId),
                        cacheService_1.cacheService.invalidateUserGames(userId)
                    ]);
                }
                break;
            case 'global':
                await cacheService_1.cacheService.invalidateGlobalStatistics();
                break;
            case 'all':
            default:
                await cacheService_1.cacheService.invalidateAll();
                break;
        }
        res.json({
            success: true,
            message: `Cache invalidation completed for type: ${type || 'all'}`
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   POST /api/admin/cache/invalidate/event
// @desc    Trigger cache invalidation via event
// @access  Private (Admin)
router.post('/cache/invalidate/event', async (req, res) => {
    try {
        const { eventType, userId, gameId, affectedUsers, reason } = req.body;
        await cacheInvalidationService_1.cacheInvalidationService.handleInvalidation({
            type: eventType,
            userId,
            gameId,
            affectedUsers,
            reason: reason || 'Manual admin trigger'
        });
        res.json({
            success: true,
            message: 'Cache invalidation event processed'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/admin/cache/stats
// @desc    Get cache invalidation statistics
// @access  Private (Admin)
router.get('/cache/stats', async (req, res) => {
    try {
        const stats = await cacheInvalidationService_1.cacheInvalidationService.getInvalidationStats();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/admin/statistics/overview
// @desc    Get comprehensive statistics overview
// @access  Private (Admin)
router.get('/statistics/overview', async (req, res) => {
    try {
        const [globalStats, cacheHealth, invalidationStats] = await Promise.all([
            statisticsService_1.statisticsService.getGlobalStatistics(),
            cacheService_1.cacheService.getCacheHealth(),
            cacheInvalidationService_1.cacheInvalidationService.getInvalidationStats()
        ]);
        res.json({
            success: true,
            data: {
                global: globalStats,
                cache: cacheHealth,
                invalidations: invalidationStats
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   POST /api/admin/cache/rebuild
// @desc    Rebuild all caches from scratch
// @access  Private (Admin)
router.post('/cache/rebuild', async (req, res) => {
    try {
        // Invalidate all caches first
        await cacheService_1.cacheService.invalidateAll();
        // Warm critical caches
        await Promise.all([
            cacheService_1.cacheService.warmLeaderboardCache(),
            cacheService_1.cacheService.warmGlobalStatsCache()
        ]);
        res.json({
            success: true,
            message: 'Cache rebuild completed successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map