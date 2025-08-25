"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statisticsService = exports.StatisticsService = void 0;
const User_1 = require("../models/User");
const Game_1 = require("../models/Game");
const shared_1 = require("@playbg/shared");
const cacheService_1 = require("./cacheService");
const logger_1 = require("../utils/logger");
class StatisticsService {
    constructor() { }
    static getInstance() {
        if (!StatisticsService.instance) {
            StatisticsService.instance = new StatisticsService();
        }
        return StatisticsService.instance;
    }
    // Get comprehensive user statistics
    async getUserStatistics(userId) {
        try {
            // Try to get from cache first
            const cached = await cacheService_1.cacheService.getUserStatistics(userId);
            if (cached) {
                return cached;
            }
            // Calculate from database
            const stats = await this.calculateUserStatistics(userId);
            // Cache the result
            await cacheService_1.cacheService.setUserStatistics(userId, stats);
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Error getting user statistics:', error);
            throw error;
        }
    }
    // Calculate user statistics from database
    async calculateUserStatistics(userId) {
        const [user, games, ratingHistory] = await Promise.all([
            User_1.User.findById(userId),
            Game_1.GameModel.find({
                $or: [
                    { 'players.0.userId': userId },
                    { 'players.1.userId': userId }
                ],
                gameState: 'finished'
            }).sort({ endTime: -1 }),
            this.getUserRatingHistory(userId)
        ]);
        if (!user) {
            throw new Error('User not found');
        }
        const totalGames = games.length;
        const wins = games.filter(game => game.winner === userId).length;
        const losses = totalGames - wins;
        const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
        // Calculate average game duration
        const completedGames = games.filter(game => game.endTime);
        const totalDuration = completedGames.reduce((sum, game) => {
            const duration = game.endTime.getTime() - game.startTime.getTime();
            return sum + duration;
        }, 0);
        const averageGameDuration = completedGames.length > 0 ?
            Math.round(totalDuration / completedGames.length / 1000 / 60) : 0; // in minutes
        // Calculate win streaks
        const { longestWinStreak, currentWinStreak } = this.calculateWinStreaks(games, userId);
        const statistics = {
            totalGames,
            wins,
            losses,
            winRate: Math.round(winRate * 100) / 100,
            averageGameDuration,
            longestWinStreak,
            currentWinStreak,
            ratingHistory
        };
        return statistics;
    }
    // Calculate win streaks
    calculateWinStreaks(games, userId) {
        let longestWinStreak = 0;
        let currentWinStreak = 0;
        let currentStreak = 0;
        // Sort games by date (most recent first)
        const sortedGames = [...games].sort((a, b) => new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime());
        for (const game of sortedGames) {
            const isWin = game.winner === userId;
            if (isWin) {
                currentStreak++;
                longestWinStreak = Math.max(longestWinStreak, currentStreak);
                // Update current win streak (only for the most recent games)
                if (currentWinStreak === 0 || currentStreak === 1) {
                    currentWinStreak = currentStreak;
                }
            }
            else {
                if (currentWinStreak > 0 && currentStreak === currentWinStreak) {
                    currentWinStreak = 0; // Streak broken
                }
                currentStreak = 0;
            }
        }
        return { longestWinStreak, currentWinStreak };
    }
    // Get user rating history
    async getUserRatingHistory(userId, limit = 50) {
        const games = await Game_1.GameModel.find({
            $or: [
                { 'players.0.userId': userId },
                { 'players.1.userId': userId }
            ],
            gameState: 'finished'
        })
            .sort({ endTime: -1 })
            .limit(limit)
            .populate('players.userId', 'username');
        const history = [];
        for (const game of games) {
            const player = game.players.find((p) => p.userId.toString() === userId);
            const opponent = game.players.find((p) => p.userId.toString() !== userId);
            if (player && opponent) {
                const result = game.winner === userId ? shared_1.GameResult.WIN :
                    game.winner ? shared_1.GameResult.LOSS : shared_1.GameResult.DRAW;
                history.push({
                    rating: player.rating || 1200,
                    date: game.endTime || game.startTime,
                    gameId: game.id,
                    opponent: opponent.username || 'Unknown',
                    result
                });
            }
        }
        return history.reverse(); // Return chronological order
    }
    // Get leaderboard with caching
    async getLeaderboard(type = 'overall', page = 1, limit = 20) {
        try {
            // Try to get from cache first
            const cached = await cacheService_1.cacheService.getLeaderboard(type, page, limit);
            if (cached && cached.success) {
                return {
                    data: cached.data,
                    pagination: cached.pagination
                };
            }
            // Calculate from database
            const result = await this.calculateLeaderboard(type, page, limit);
            // Cache the result
            await cacheService_1.cacheService.setLeaderboard(type, page, limit, {
                success: true,
                data: result.data,
                pagination: result.pagination
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error getting leaderboard:', error);
            throw error;
        }
    }
    // Calculate leaderboard from database
    async calculateLeaderboard(type = 'overall', page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        let filter = { gamesPlayed: { $gte: 5 } };
        // Add time-based filters for different leaderboard types
        if (type === 'monthly') {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            // Get users who played games this month
            const monthlyUsers = await Game_1.GameModel.distinct('players.userId', {
                startTime: { $gte: monthStart },
                gameState: 'finished'
            });
            filter._id = { $in: monthlyUsers };
        }
        else if (type === 'weekly') {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            weekStart.setHours(0, 0, 0, 0);
            // Get users who played games this week
            const weeklyUsers = await Game_1.GameModel.distinct('players.userId', {
                startTime: { $gte: weekStart },
                gameState: 'finished'
            });
            filter._id = { $in: weeklyUsers };
        }
        const [users, total] = await Promise.all([
            User_1.User.find(filter)
                .sort({ rating: -1 })
                .skip(skip)
                .limit(limit)
                .select('username rating gamesPlayed gamesWon avatar country'),
            User_1.User.countDocuments(filter)
        ]);
        const leaderboard = users.map((user, index) => ({
            userId: user._id.toString(),
            username: user.username,
            rating: user.rating,
            gamesPlayed: user.gamesPlayed,
            gamesWon: user.gamesWon,
            avatar: user.avatar,
            country: user.country,
            rank: skip + index + 1
        }));
        return {
            data: leaderboard,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    // Get global statistics
    async getGlobalStatistics() {
        try {
            // Try to get from cache first
            const cached = await cacheService_1.cacheService.getGlobalStatistics();
            if (cached) {
                return cached;
            }
            // Calculate from database
            const stats = await this.calculateGlobalStatistics();
            // Cache the result
            await cacheService_1.cacheService.setGlobalStatistics(stats);
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Error getting global statistics:', error);
            throw error;
        }
    }
    // Calculate global statistics from database
    async calculateGlobalStatistics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [totalUsers, totalGames, activeUsers, avgRatingResult, topRatingResult, totalGamesToday] = await Promise.all([
            User_1.User.countDocuments(),
            Game_1.GameModel.countDocuments({ gameState: 'finished' }),
            User_1.User.countDocuments({
                lastSeen: {
                    $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
            }),
            User_1.User.aggregate([
                { $match: { gamesPlayed: { $gte: 1 } } },
                { $group: { _id: null, avgRating: { $avg: '$rating' } } }
            ]),
            User_1.User.findOne().sort({ rating: -1 }).select('rating'),
            Game_1.GameModel.countDocuments({
                startTime: { $gte: today },
                gameState: 'finished'
            })
        ]);
        return {
            totalUsers,
            totalGames,
            activeUsers,
            averageRating: Math.round(avgRatingResult[0]?.avgRating || 1200),
            topRating: topRatingResult?.rating || 1200,
            totalGamesToday,
            lastUpdated: new Date()
        };
    }
    // Get user's recent games
    async getUserRecentGames(userId, page = 1, limit = 10) {
        try {
            // Try to get from cache first
            const cached = await cacheService_1.cacheService.getRecentGames(userId, page, limit);
            if (cached && cached.success) {
                return {
                    data: cached.data,
                    pagination: cached.pagination
                };
            }
            // Calculate from database
            const result = await this.calculateUserRecentGames(userId, page, limit);
            // Cache the result
            await cacheService_1.cacheService.setRecentGames(userId, page, limit, {
                success: true,
                data: result.data,
                pagination: result.pagination
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error getting user recent games:', error);
            throw error;
        }
    }
    // Calculate user's recent games from database
    async calculateUserRecentGames(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [games, total] = await Promise.all([
            Game_1.GameModel.find({
                $or: [
                    { 'players.0.userId': userId },
                    { 'players.1.userId': userId }
                ]
            })
                .sort({ startTime: -1 })
                .skip(skip)
                .limit(limit)
                .populate('players.userId', 'username avatar')
                .select('players gameState gameType startTime endTime winner moves'),
            Game_1.GameModel.countDocuments({
                $or: [
                    { 'players.0.userId': userId },
                    { 'players.1.userId': userId }
                ]
            })
        ]);
        const formattedGames = games.map(game => {
            const opponent = game.players.find((p) => p.userId._id.toString() !== userId);
            const userPlayer = game.players.find((p) => p.userId._id.toString() === userId);
            return {
                id: game._id,
                opponent: opponent ? {
                    id: opponent.userId._id,
                    username: opponent.userId.username,
                    avatar: opponent.userId.avatar
                } : null,
                gameState: game.gameState,
                gameType: game.gameType,
                startTime: game.startTime,
                endTime: game.endTime,
                result: game.winner === userId ? 'win' :
                    game.winner ? 'loss' :
                        game.gameState === 'finished' ? 'draw' : 'ongoing',
                moves: game.moves?.length || 0
            };
        });
        return {
            data: formattedGames,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    // Performance analytics
    async getUserPerformanceAnalytics(userId) {
        const recentGames = await Game_1.GameModel.find({
            $or: [
                { 'players.0.userId': userId },
                { 'players.1.userId': userId }
            ],
            gameState: 'finished'
        })
            .sort({ endTime: -1 })
            .limit(50)
            .populate('players.userId', 'username');
        // Rating trend analysis
        const ratingHistory = recentGames.slice(0, 10);
        let ratingTrend = 'stable';
        if (ratingHistory.length >= 5) {
            const recent = ratingHistory.slice(0, 5);
            const older = ratingHistory.slice(5, 10);
            const recentAvg = recent.reduce((sum, game) => {
                const player = game.players.find((p) => p.userId._id.toString() === userId);
                return sum + (player?.rating || 1200);
            }, 0) / recent.length;
            const olderAvg = older.reduce((sum, game) => {
                const player = game.players.find((p) => p.userId._id.toString() === userId);
                return sum + (player?.rating || 1200);
            }, 0) / older.length;
            const diff = recentAvg - olderAvg;
            ratingTrend = diff > 20 ? 'up' : diff < -20 ? 'down' : 'stable';
        }
        // Last 10 games performance
        const last10 = recentGames.slice(0, 10);
        const wins10 = last10.filter(game => game.winner === userId).length;
        const losses10 = last10.length - wins10;
        // Last 30 days performance
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const last30Days = recentGames.filter(game => new Date(game.endTime || game.startTime) >= thirtyDaysAgo);
        const avgRating30 = last30Days.length > 0 ?
            last30Days.reduce((sum, game) => {
                const player = game.players.find((p) => p.userId._id.toString() === userId);
                return sum + (player?.rating || 1200);
            }, 0) / last30Days.length : 1200;
        // Opponent analysis
        const opponentStats = new Map();
        recentGames.forEach(game => {
            const opponent = game.players.find((p) => p.userId._id.toString() !== userId);
            if (opponent) {
                const opponentId = opponent.userId._id.toString();
                const existing = opponentStats.get(opponentId) || {
                    wins: 0,
                    losses: 0,
                    username: opponent.userId.username
                };
                if (game.winner === userId) {
                    existing.wins++;
                }
                else if (game.winner) {
                    existing.losses++;
                }
                opponentStats.set(opponentId, existing);
            }
        });
        const strongestOpponents = Array.from(opponentStats.values())
            .filter(stats => stats.wins + stats.losses >= 3)
            .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
            .slice(0, 5)
            .map(stats => ({
            username: stats.username,
            wins: stats.wins,
            losses: stats.losses
        }));
        return {
            ratingTrend,
            recentPerformance: {
                last10Games: {
                    wins: wins10,
                    losses: losses10,
                    winRate: last10.length > 0 ? (wins10 / last10.length) * 100 : 0
                },
                last30Days: {
                    gamesPlayed: last30Days.length,
                    averageRating: Math.round(avgRating30)
                }
            },
            strongestOpponents
        };
    }
}
exports.StatisticsService = StatisticsService;
exports.statisticsService = StatisticsService.getInstance();
//# sourceMappingURL=statisticsService.js.map