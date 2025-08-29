/// <reference path="../types/express-augmentation.ts" />

import express, { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { ApiResponse, PaginatedResponse } from '@playbg/shared';
import { statisticsService } from '../services/statisticsService';
import { cacheService } from '../services/cacheService';

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: user
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedUpdates = ['bio', 'country', 'preferredGameSpeed', 'avatar'];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      res.status(400).json({
        success: false,
        error: 'Invalid updates'
      } as ApiResponse);
      return;
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      } as ApiResponse);
      return;
    }

    updates.forEach(update => {
      (user as any)[update] = req.body[update];
    });

    await user.save();

    res.json({
      success: true,
      data: user
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/leaderboard
// @desc    Get user leaderboard
// @access  Private
router.get('/leaderboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = (req.query.type as string) || 'overall';

    const result = await statisticsService.getLeaderboard(type, page, limit);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    } as PaginatedResponse<any>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/search
// @desc    Search users by username
// @access  Private
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query required'
      } as ApiResponse);
      return;
    }

    const users = await User.find({
      username: { $regex: q, $options: 'i' }
    })
    .limit(10)
    .select('username rating avatar isOnline');

    res.json({
      success: true,
      data: users
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/statistics
// @desc    Get current user statistics
// @access  Private
router.get('/statistics', async (req: Request, res: Response): Promise<void> => {
  try {
    const statistics = await statisticsService.getUserStatistics(req.user._id);

    res.json({
      success: true,
      data: statistics
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/statistics/global
// @desc    Get global platform statistics
// @access  Private
router.get('/statistics/global', async (req: Request, res: Response): Promise<void> => {
  try {
    const globalStats = await statisticsService.getGlobalStatistics();

    res.json({
      success: true,
      data: globalStats
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/games/recent
// @desc    Get user's recent games
// @access  Private
router.get('/games/recent', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await statisticsService.getUserRecentGames(req.user._id, page, limit);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    } as PaginatedResponse<any>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/analytics/performance
// @desc    Get user performance analytics
// @access  Private
router.get('/analytics/performance', async (req: Request, res: Response): Promise<void> => {
  try {
    const analytics = await statisticsService.getUserPerformanceAnalytics(req.user._id);

    res.json({
      success: true,
      data: analytics
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/:id/statistics
// @desc    Get user statistics by ID
// @access  Private
router.get('/:id/statistics', async (req: Request, res: Response): Promise<void> => {
  try {
    const statistics = await statisticsService.getUserStatistics(req.params.id);

    res.json({
      success: true,
      data: statistics
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .select('-email'); // Don't expose email to other users

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: user
    } as ApiResponse);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    } as ApiResponse);
  }
});

export default router;
