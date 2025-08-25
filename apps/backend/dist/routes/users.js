"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../models/User");
const statisticsService_1 = require("../services/statisticsService");
const router = express_1.default.Router();
// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user._id);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        res.json({
            success: true,
            data: user
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', async (req, res) => {
    try {
        const allowedUpdates = ['bio', 'country', 'preferredGameSpeed', 'avatar'];
        const updates = Object.keys(req.body);
        const isValidOperation = updates.every(update => allowedUpdates.includes(update));
        if (!isValidOperation) {
            res.status(400).json({
                success: false,
                error: 'Invalid updates'
            });
            return;
        }
        const user = await User_1.User.findById(req.user._id);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        updates.forEach(update => {
            user[update] = req.body[update];
        });
        await user.save();
        res.json({
            success: true,
            data: user
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/leaderboard
// @desc    Get user leaderboard
// @access  Private
router.get('/leaderboard', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const type = req.query.type || 'overall';
        const result = await statisticsService_1.statisticsService.getLeaderboard(type, page, limit);
        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/search
// @desc    Search users by username
// @access  Private
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            res.status(400).json({
                success: false,
                error: 'Search query required'
            });
            return;
        }
        const users = await User_1.User.find({
            username: { $regex: q, $options: 'i' }
        })
            .limit(10)
            .select('username rating avatar isOnline');
        res.json({
            success: true,
            data: users
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/statistics
// @desc    Get current user statistics
// @access  Private
router.get('/statistics', async (req, res) => {
    try {
        const statistics = await statisticsService_1.statisticsService.getUserStatistics(req.user._id);
        res.json({
            success: true,
            data: statistics
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/statistics/global
// @desc    Get global platform statistics
// @access  Private
router.get('/statistics/global', async (req, res) => {
    try {
        const globalStats = await statisticsService_1.statisticsService.getGlobalStatistics();
        res.json({
            success: true,
            data: globalStats
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/games/recent
// @desc    Get user's recent games
// @access  Private
router.get('/games/recent', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const result = await statisticsService_1.statisticsService.getUserRecentGames(req.user._id, page, limit);
        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/analytics/performance
// @desc    Get user performance analytics
// @access  Private
router.get('/analytics/performance', async (req, res) => {
    try {
        const analytics = await statisticsService_1.statisticsService.getUserPerformanceAnalytics(req.user._id);
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/:id/statistics
// @desc    Get user statistics by ID
// @access  Private
router.get('/:id/statistics', async (req, res) => {
    try {
        const statistics = await statisticsService_1.statisticsService.getUserStatistics(req.params.id);
        res.json({
            success: true,
            data: statistics
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});
// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id)
            .select('-email'); // Don't expose email to other users
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'User not found'
            });
            return;
        }
        res.json({
            success: true,
            data: user
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
//# sourceMappingURL=users.js.map