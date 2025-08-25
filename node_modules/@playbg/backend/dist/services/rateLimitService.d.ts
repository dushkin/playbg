export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (identifier: string, action: string) => string;
}
export interface RateLimitResult {
    allowed: boolean;
    remainingRequests: number;
    resetTime: number;
    error?: string;
}
export declare class RateLimitService {
    private static instance;
    private configs;
    private constructor();
    static getInstance(): RateLimitService;
    private setupDefaultConfigs;
    /**
     * Check if an action is allowed based on rate limits
     */
    checkLimit(identifier: string, action: string, customConfig?: Partial<RateLimitConfig>): Promise<RateLimitResult>;
    /**
     * Add a custom rate limit configuration
     */
    addConfig(action: string, config: RateLimitConfig): void;
    /**
     * Get rate limit stats for monitoring
     */
    getStats(identifier: string, action: string): Promise<{
        currentCount: number;
        maxRequests: number;
        windowMs: number;
        resetTime: number;
    }>;
    /**
     * Reset rate limit for a specific identifier and action
     */
    resetLimit(identifier: string, action: string): Promise<void>;
    private getConfig;
    private generateKey;
    private getCurrentCount;
    private recordRequest;
    private getResetTime;
    /**
     * Middleware factory for Express routes
     */
    createExpressMiddleware(action: string, customConfig?: Partial<RateLimitConfig>): (req: any, res: any, next: any) => Promise<any>;
    /**
     * Socket.IO middleware factory
     */
    createSocketMiddleware(action: string, customConfig?: Partial<RateLimitConfig>): (socket: any, next: any) => Promise<any>;
    /**
     * Clean up expired rate limit data
     */
    cleanup(): Promise<number>;
}
export declare const rateLimitService: RateLimitService;
//# sourceMappingURL=rateLimitService.d.ts.map