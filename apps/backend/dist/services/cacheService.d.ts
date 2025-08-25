import { UserStatistics, PaginatedResponse } from '@playbg/shared';
export interface LeaderboardEntry {
    userId: string;
    username: string;
    rating: number;
    gamesPlayed: number;
    gamesWon: number;
    avatar?: string;
    country?: string;
    rank: number;
}
export interface GlobalStats {
    totalUsers: number;
    totalGames: number;
    activeUsers: number;
    averageRating: number;
    topRating: number;
    totalGamesToday: number;
    lastUpdated: Date;
}
export declare class CacheService {
    private static instance;
    private static readonly CACHE_TTL;
    private static readonly KEYS;
    private constructor();
    static getInstance(): CacheService;
    getLeaderboard(type?: string, page?: number, limit?: number): Promise<PaginatedResponse<LeaderboardEntry> | null>;
    setLeaderboard(type: string | undefined, page: number | undefined, limit: number | undefined, data: PaginatedResponse<LeaderboardEntry>): Promise<void>;
    invalidateLeaderboard(type?: string): Promise<void>;
    getUserStatistics(userId: string): Promise<UserStatistics | null>;
    setUserStatistics(userId: string, stats: UserStatistics): Promise<void>;
    invalidateUserStatistics(userId: string): Promise<void>;
    getGlobalStatistics(): Promise<GlobalStats | null>;
    setGlobalStatistics(stats: GlobalStats): Promise<void>;
    invalidateGlobalStatistics(): Promise<void>;
    getUserProfile(userId: string): Promise<any | null>;
    setUserProfile(userId: string, profile: any): Promise<void>;
    invalidateUserProfile(userId: string): Promise<void>;
    getRecentGames(userId: string, page?: number, limit?: number): Promise<PaginatedResponse<any> | null>;
    setRecentGames(userId: string, page: number | undefined, limit: number | undefined, data: PaginatedResponse<any>): Promise<void>;
    invalidateUserGames(userId: string): Promise<void>;
    warmLeaderboardCache(): Promise<void>;
    warmGlobalStatsCache(): Promise<void>;
    invalidateAll(): Promise<void>;
    getCacheHealth(): Promise<{
        connected: boolean;
        keyCount: number;
        memoryUsage?: string;
    }>;
}
export declare const cacheService: CacheService;
//# sourceMappingURL=cacheService.d.ts.map