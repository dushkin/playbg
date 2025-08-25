import Redis from 'ioredis';
import { GameSpeed } from '@playbg/shared';
export interface MatchmakingQueue {
    userId: string;
    username: string;
    rating: number;
    gameSpeed: GameSpeed;
    isPrivate: boolean;
    preferences: {
        minRating?: number;
        maxRating?: number;
        gameType?: string;
    };
    joinedAt: number;
}
export interface GameSession {
    gameId: string;
    players: string[];
    spectators: string[];
    state: any;
    lastActivity: number;
}
export declare class RedisService {
    private static instance;
    private redis;
    private subscriber;
    private publisher;
    private constructor();
    static getInstance(): RedisService;
    private setupEventHandlers;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getRedisClient(): Redis;
    addToMatchmakingQueue(queue: MatchmakingQueue): Promise<void>;
    removeFromMatchmakingQueue(userId: string): Promise<void>;
    findMatchmakingOpponent(userId: string, rating: number, gameSpeed: GameSpeed, isPrivate?: boolean, ratingRange?: number): Promise<MatchmakingQueue | null>;
    setGameSession(session: GameSession): Promise<void>;
    getGameSession(gameId: string): Promise<GameSession | null>;
    updateGameSession(gameId: string, updates: Partial<GameSession>): Promise<void>;
    deleteGameSession(gameId: string): Promise<void>;
    setUserSocketId(userId: string, socketId: string): Promise<void>;
    getUserSocketId(userId: string): Promise<string | null>;
    removeUserSocketId(userId: string): Promise<void>;
    cacheGameState(gameId: string, state: any, ttl?: number): Promise<void>;
    getCachedGameState(gameId: string): Promise<any | null>;
    invalidateGameStateCache(gameId: string): Promise<void>;
    publishGameEvent(gameId: string, event: string, data: any): Promise<void>;
    subscribeToGameEvents(gameId: string, callback: (event: string, data: any) => void): Promise<void>;
    unsubscribeFromGameEvents(gameId: string): Promise<void>;
    updateLeaderboard(userId: string, rating: number, gameType?: string): Promise<void>;
    getLeaderboard(gameType?: string, limit?: number): Promise<Array<{
        userId: string;
        rating: number;
    }>>;
    cleanupExpiredSessions(): Promise<number>;
}
export declare const redisService: RedisService;
//# sourceMappingURL=redisService.d.ts.map