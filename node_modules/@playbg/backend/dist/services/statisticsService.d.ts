import { UserStatistics } from '@playbg/shared';
import { LeaderboardEntry, GlobalStats } from './cacheService';
export declare class StatisticsService {
    private static instance;
    private constructor();
    static getInstance(): StatisticsService;
    getUserStatistics(userId: string): Promise<UserStatistics>;
    private calculateUserStatistics;
    private calculateWinStreaks;
    private getUserRatingHistory;
    getLeaderboard(type?: string, page?: number, limit?: number): Promise<{
        data: LeaderboardEntry[];
        pagination: any;
    }>;
    private calculateLeaderboard;
    getGlobalStatistics(): Promise<GlobalStats>;
    private calculateGlobalStatistics;
    getUserRecentGames(userId: string, page?: number, limit?: number): Promise<{
        data: any[];
        pagination: any;
    }>;
    private calculateUserRecentGames;
    getUserPerformanceAnalytics(userId: string): Promise<{
        ratingTrend: 'up' | 'down' | 'stable';
        recentPerformance: {
            last10Games: {
                wins: number;
                losses: number;
                winRate: number;
            };
            last30Days: {
                gamesPlayed: number;
                averageRating: number;
            };
        };
        strongestOpponents: Array<{
            username: string;
            wins: number;
            losses: number;
        }>;
    }>;
}
export declare const statisticsService: StatisticsService;
//# sourceMappingURL=statisticsService.d.ts.map