import mongoose from 'mongoose';
import { IRefreshTokenDocument } from '../models/RefreshToken';
export interface TokenPayload {
    userId: string;
    username: string;
}
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}
export declare class TokenService {
    private static readonly ACCESS_TOKEN_EXPIRY;
    private static readonly REFRESH_TOKEN_EXPIRY_DAYS;
    /**
     * Generate access token (JWT)
     */
    static generateAccessToken(userId: string, username: string): string;
    /**
     * Generate refresh token and store in database
     */
    static generateRefreshToken(userId: mongoose.Types.ObjectId, deviceInfo?: {
        userAgent?: string;
        ipAddress?: string;
        deviceId?: string;
    }): Promise<IRefreshTokenDocument>;
    /**
     * Generate both access and refresh tokens
     */
    static generateTokenPair(userId: string, username: string, deviceInfo?: {
        userAgent?: string;
        ipAddress?: string;
        deviceId?: string;
    }): Promise<{
        accessToken: string;
        refreshToken: IRefreshTokenDocument;
    }>;
    /**
     * Verify access token
     */
    static verifyAccessToken(token: string): TokenPayload;
    /**
     * Verify refresh token and return user info
     */
    static verifyRefreshToken(token: string): Promise<{
        refreshTokenDoc: IRefreshTokenDocument;
        userId: string;
        username: string;
    }>;
    /**
     * Refresh access token using refresh token
     */
    static refreshAccessToken(refreshToken: string, deviceInfo?: {
        userAgent?: string;
        ipAddress?: string;
        deviceId?: string;
    }): Promise<{
        accessToken: string;
        refreshToken: IRefreshTokenDocument;
        revokedToken: IRefreshTokenDocument;
    }>;
    /**
     * Revoke refresh token (logout)
     */
    static revokeRefreshToken(token: string, reason?: string): Promise<boolean>;
    /**
     * Revoke all refresh tokens for a user
     */
    static revokeAllUserTokens(userId: string, reason?: string): Promise<number>;
    /**
     * Get active refresh tokens for a user
     */
    static getUserActiveTokens(userId: string): Promise<IRefreshTokenDocument[]>;
    /**
     * Cleanup expired tokens (to be run periodically)
     */
    static cleanupExpiredTokens(): Promise<number>;
    /**
     * Extract device info from request
     */
    static extractDeviceInfo(req: any): {
        userAgent?: string;
        ipAddress?: string;
        deviceId?: string;
    };
    /**
     * Decode access token without verification (for debugging)
     */
    static decodeAccessToken(token: string): any;
}
//# sourceMappingURL=tokenService.d.ts.map