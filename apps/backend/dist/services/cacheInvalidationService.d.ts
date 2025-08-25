export interface InvalidationEvent {
    type: 'game_completed' | 'user_updated' | 'rating_changed' | 'user_registered' | 'manual';
    userId?: string;
    gameId?: string;
    affectedUsers?: string[];
    reason?: string;
}
export declare class CacheInvalidationService {
    private static instance;
    private constructor();
    static getInstance(): CacheInvalidationService;
    handleInvalidation(event: InvalidationEvent): Promise<void>;
    private handleGameCompleted;
    private handleUserUpdated;
    private handleRatingChanged;
    private handleUserRegistered;
    private handleManualInvalidation;
    private updateRedisLeaderboard;
    handleBatchInvalidation(events: InvalidationEvent[]): Promise<void>;
    private groupEvents;
    private handleBatchRatingChanges;
    private handleBatchGameCompletions;
    schedulePeriodicWarming(): Promise<void>;
    warmAllCaches(): Promise<void>;
    getInvalidationStats(): Promise<{
        totalInvalidations: number;
        invalidationsByType: Record<string, number>;
        lastInvalidation?: Date;
    }>;
    private trackInvalidation;
}
export declare const cacheInvalidationService: CacheInvalidationService;
//# sourceMappingURL=cacheInvalidationService.d.ts.map