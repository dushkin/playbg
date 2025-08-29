/// <reference path="../types/express-augmentation.ts" />

import express, { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@playbg/shared';
import { cacheService } from '../services/cacheService';
import { cacheInvalidationService } from '../services/cacheInvalidationService';
import { statisticsService } from '../services/statisticsService';

const router = express.Router();

// @route   GET /api/admin/cache/health
// @desc    Get cache health status
// @access  Private (Admin)
router.get('/cache/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await cacheService.getCacheHealth();

    res.json({
      success: true,
      data: health
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   POST /api/admin/cache/warm
// @desc    Manually warm caches
// @access  Private (Admin)
router.post('/cache/warm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.body;

    switch (type) {
      case 'leaderboard':
        await cacheService.warmLeaderboardCache();
        break;
      case 'global':
        await cacheService.warmGlobalStatsCache();
        break;
      case 'all':
      default:
        await cacheInvalidationService.warmAllCaches();
        break;
    }

    res.json({
      success: true,
      message: `Cache warming completed for type: ${type || 'all'}`
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   DELETE /api/admin/cache/invalidate
// @desc    Invalidate caches
// @access  Private (Admin)
router.delete('/cache/invalidate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, userId } = req.body;

    switch (type) {
      case 'leaderboard':
        await cacheService.invalidateLeaderboard();
        break;
      case 'user':
        if (userId) {
          await Promise.all([
            cacheService.invalidateUserStatistics(userId),
            cacheService.invalidateUserProfile(userId),
            cacheService.invalidateUserGames(userId)
          ]);
        }
        break;
      case 'global':
        await cacheService.invalidateGlobalStatistics();
        break;
      case 'all':
      default:
        await cacheService.invalidateAll();
        break;
    }

    res.json({
      success: true,
      message: `Cache invalidation completed for type: ${type || 'all'}`
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   POST /api/admin/cache/invalidate/event
// @desc    Trigger cache invalidation via event
// @access  Private (Admin)
router.post('/cache/invalidate/event', async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventType, userId, gameId, affectedUsers, reason } = req.body;

    await cacheInvalidationService.handleInvalidation({
      type: eventType,
      userId,
      gameId,
      affectedUsers,
      reason: reason || 'Manual admin trigger'
    });

    res.json({
      success: true,
      message: 'Cache invalidation event processed'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/admin/cache/stats
// @desc    Get cache invalidation statistics
// @access  Private (Admin)
router.get('/cache/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await cacheInvalidationService.getInvalidationStats();

    res.json({
      success: true,
      data: stats
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/admin/statistics/overview
// @desc    Get comprehensive statistics overview
// @access  Private (Admin)
router.get('/statistics/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const [globalStats, cacheHealth, invalidationStats] = await Promise.all([
      statisticsService.getGlobalStatistics(),
      cacheService.getCacheHealth(),
      cacheInvalidationService.getInvalidationStats()
    ]);

    res.json({
      success: true,
      data: {
        global: globalStats,
        cache: cacheHealth,
        invalidations: invalidationStats
      }
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   POST /api/admin/cache/rebuild
// @desc    Rebuild all caches from scratch
// @access  Private (Admin)
router.post('/cache/rebuild', async (req: Request, res: Response): Promise<void> => {
  try {
    // Invalidate all caches first
    await cacheService.invalidateAll();
    
    // Warm critical caches
    await Promise.all([
      cacheService.warmLeaderboardCache(),
      cacheService.warmGlobalStatsCache()
    ]);

    res.json({
      success: true,
      message: 'Cache rebuild completed successfully'
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

export default router;