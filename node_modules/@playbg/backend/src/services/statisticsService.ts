import { User } from '../models/User';
import { GameModel } from '../models/Game';
import { UserStatistics, GameResult, RatingHistoryEntry } from '@playbg/shared';
import { cacheService, LeaderboardEntry, GlobalStats } from './cacheService';
import { logger } from '../utils/logger';

export class StatisticsService {
  private static instance: StatisticsService;

  private constructor() {}

  public static getInstance(): StatisticsService {
    if (!StatisticsService.instance) {
      StatisticsService.instance = new StatisticsService();
    }
    return StatisticsService.instance;
  }

  // Get comprehensive user statistics
  public async getUserStatistics(userId: string): Promise<UserStatistics> {
    try {
      // Try to get from cache first
      const cached = await cacheService.getUserStatistics(userId);
      if (cached) {
        return cached;
      }

      // Calculate from database
      const stats = await this.calculateUserStatistics(userId);
      
      // Cache the result
      await cacheService.setUserStatistics(userId, stats);
      
      return stats;
    } catch (error) {
      logger.error('Error getting user statistics:', error);
      throw error;
    }
  }

  // Calculate user statistics from database
  private async calculateUserStatistics(userId: string): Promise<UserStatistics> {
    const [user, games, ratingHistory] = await Promise.all([
      User.findById(userId),
      GameModel.find({
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
      const duration = game.endTime!.getTime() - game.startTime.getTime();
      return sum + duration;
    }, 0);
    const averageGameDuration = completedGames.length > 0 ? 
      Math.round(totalDuration / completedGames.length / 1000 / 60) : 0; // in minutes

    // Calculate win streaks
    const { longestWinStreak, currentWinStreak } = this.calculateWinStreaks(games, userId);

    const statistics: UserStatistics = {
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
  private calculateWinStreaks(games: any[], userId: string): {
    longestWinStreak: number;
    currentWinStreak: number;
  } {
    let longestWinStreak = 0;
    let currentWinStreak = 0;
    let currentStreak = 0;

    // Sort games by date (most recent first)
    const sortedGames = [...games].sort((a, b) => 
      new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime()
    );

    for (const game of sortedGames) {
      const isWin = game.winner === userId;
      
      if (isWin) {
        currentStreak++;
        longestWinStreak = Math.max(longestWinStreak, currentStreak);
        
        // Update current win streak (only for the most recent games)
        if (currentWinStreak === 0 || currentStreak === 1) {
          currentWinStreak = currentStreak;
        }
      } else {
        if (currentWinStreak > 0 && currentStreak === currentWinStreak) {
          currentWinStreak = 0; // Streak broken
        }
        currentStreak = 0;
      }
    }

    return { longestWinStreak, currentWinStreak };
  }

  // Get user rating history
  private async getUserRatingHistory(userId: string, limit: number = 50): Promise<RatingHistoryEntry[]> {
    const games = await GameModel.find({
      $or: [
        { 'players.0.userId': userId },
        { 'players.1.userId': userId }
      ],
      gameState: 'finished'
    })
    .sort({ endTime: -1 })
    .limit(limit)
    .populate('players.userId', 'username');

    const history: RatingHistoryEntry[] = [];

    for (const game of games) {
      const player = game.players.find((p: any) => p.userId.toString() === userId);
      const opponent = game.players.find((p: any) => p.userId.toString() !== userId);
      
      if (player && opponent) {
        const result: GameResult = game.winner === userId ? GameResult.WIN : 
                                 game.winner ? GameResult.LOSS : GameResult.DRAW;

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
  public async getLeaderboard(
    type: string = 'overall',
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: LeaderboardEntry[]; pagination: any }> {
    try {
      // Try to get from cache first
      const cached = await cacheService.getLeaderboard(type, page, limit);
      if (cached && cached.success) {
        return {
          data: cached.data!,
          pagination: cached.pagination!
        };
      }

      // Calculate from database
      const result = await this.calculateLeaderboard(type, page, limit);
      
      // Cache the result
      await cacheService.setLeaderboard(type, page, limit, {
        success: true,
        data: result.data,
        pagination: result.pagination
      });
      
      return result;
    } catch (error) {
      logger.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  // Calculate leaderboard from database
  private async calculateLeaderboard(
    type: string = 'overall',
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: LeaderboardEntry[]; pagination: any }> {
    const skip = (page - 1) * limit;
    
    let filter: any = { gamesPlayed: { $gte: 5 } };
    
    // Add time-based filters for different leaderboard types
    if (type === 'monthly') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      // Get users who played games this month
      const monthlyUsers = await GameModel.distinct('players.userId', {
        startTime: { $gte: monthStart },
        gameState: 'finished'
      });
      
      filter._id = { $in: monthlyUsers };
    } else if (type === 'weekly') {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      // Get users who played games this week
      const weeklyUsers = await GameModel.distinct('players.userId', {
        startTime: { $gte: weekStart },
        gameState: 'finished'
      });
      
      filter._id = { $in: weeklyUsers };
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ rating: -1 })
        .skip(skip)
        .limit(limit)
        .select('username rating gamesPlayed gamesWon avatar country'),
      User.countDocuments(filter)
    ]);

    const leaderboard: LeaderboardEntry[] = users.map((user, index) => ({
      userId: (user as any)._id.toString(),
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
  public async getGlobalStatistics(): Promise<GlobalStats> {
    try {
      // Try to get from cache first
      const cached = await cacheService.getGlobalStatistics();
      if (cached) {
        return cached;
      }

      // Calculate from database
      const stats = await this.calculateGlobalStatistics();
      
      // Cache the result
      await cacheService.setGlobalStatistics(stats);
      
      return stats;
    } catch (error) {
      logger.error('Error getting global statistics:', error);
      throw error;
    }
  }

  // Calculate global statistics from database
  private async calculateGlobalStatistics(): Promise<GlobalStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalGames,
      activeUsers,
      avgRatingResult,
      topRatingResult,
      totalGamesToday
    ] = await Promise.all([
      User.countDocuments(),
      GameModel.countDocuments({ gameState: 'finished' }),
      User.countDocuments({ 
        lastSeen: { 
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        } 
      }),
      User.aggregate([
        { $match: { gamesPlayed: { $gte: 1 } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]),
      User.findOne().sort({ rating: -1 }).select('rating'),
      GameModel.countDocuments({
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
  public async getUserRecentGames(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: any[]; pagination: any }> {
    try {
      // Try to get from cache first
      const cached = await cacheService.getRecentGames(userId, page, limit);
      if (cached && cached.success) {
        return {
          data: cached.data!,
          pagination: cached.pagination!
        };
      }

      // Calculate from database
      const result = await this.calculateUserRecentGames(userId, page, limit);
      
      // Cache the result
      await cacheService.setRecentGames(userId, page, limit, {
        success: true,
        data: result.data,
        pagination: result.pagination
      });
      
      return result;
    } catch (error) {
      logger.error('Error getting user recent games:', error);
      throw error;
    }
  }

  // Calculate user's recent games from database
  private async calculateUserRecentGames(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ data: any[]; pagination: any }> {
    const skip = (page - 1) * limit;

    const [games, total] = await Promise.all([
      GameModel.find({
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
      
      GameModel.countDocuments({
        $or: [
          { 'players.0.userId': userId },
          { 'players.1.userId': userId }
        ]
      })
    ]);

    const formattedGames = games.map(game => {
      const opponent = game.players.find((p: any) => (p.userId as any)._id.toString() !== userId);
      const userPlayer = game.players.find((p: any) => (p.userId as any)._id.toString() === userId);
      
      return {
        id: game._id,
        opponent: opponent ? {
          id: (opponent.userId as any)._id,
          username: (opponent.userId as any).username,
          avatar: (opponent.userId as any).avatar
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
  public async getUserPerformanceAnalytics(userId: string): Promise<{
    ratingTrend: 'up' | 'down' | 'stable';
    recentPerformance: {
      last10Games: { wins: number; losses: number; winRate: number };
      last30Days: { gamesPlayed: number; averageRating: number };
    };
    strongestOpponents: Array<{ username: string; wins: number; losses: number }>;
  }> {
    const recentGames = await GameModel.find({
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
    let ratingTrend: 'up' | 'down' | 'stable' = 'stable';
    
    if (ratingHistory.length >= 5) {
      const recent = ratingHistory.slice(0, 5);
      const older = ratingHistory.slice(5, 10);
      
      const recentAvg = recent.reduce((sum, game) => {
        const player = game.players.find((p: any) => p.userId._id.toString() === userId);
        return sum + (player?.rating || 1200);
      }, 0) / recent.length;
      
      const olderAvg = older.reduce((sum, game) => {
        const player = game.players.find((p: any) => p.userId._id.toString() === userId);
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
    const last30Days = recentGames.filter(game => 
      new Date(game.endTime || game.startTime) >= thirtyDaysAgo
    );
    
    const avgRating30 = last30Days.length > 0 ? 
      last30Days.reduce((sum, game) => {
        const player = game.players.find((p: any) => p.userId._id.toString() === userId);
        return sum + (player?.rating || 1200);
      }, 0) / last30Days.length : 1200;

    // Opponent analysis
    const opponentStats = new Map<string, { wins: number; losses: number; username: string }>();
    
    recentGames.forEach(game => {
      const opponent = game.players.find((p: any) => (p.userId as any)._id.toString() !== userId);
      if (opponent) {
        const opponentId = (opponent.userId as any)._id.toString();
        const existing = opponentStats.get(opponentId) || { 
          wins: 0, 
          losses: 0, 
          username: (opponent.userId as any).username 
        };
        
        if (game.winner === userId) {
          existing.wins++;
        } else if (game.winner) {
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

export const statisticsService = StatisticsService.getInstance();