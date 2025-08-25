"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const RefreshToken_1 = require("../models/RefreshToken");
class TokenService {
    /**
     * Generate access token (JWT)
     */
    static generateAccessToken(userId, username) {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }
        const payload = {
            userId,
            username
        };
        return jsonwebtoken_1.default.sign(payload, jwtSecret, {
            expiresIn: this.ACCESS_TOKEN_EXPIRY,
            issuer: 'playbg-backend',
            audience: 'playbg-frontend'
        });
    }
    /**
     * Generate refresh token and store in database
     */
    static async generateRefreshToken(userId, deviceInfo) {
        // First revoke any existing active refresh tokens for this user/device
        if (deviceInfo?.deviceId) {
            await RefreshToken_1.RefreshTokenModel.updateMany({
                userId,
                'deviceInfo.deviceId': deviceInfo.deviceId,
                isRevoked: false
            }, {
                isRevoked: true,
                revokedAt: new Date(),
                revokedReason: 'refresh'
            });
        }
        return RefreshToken_1.RefreshTokenModel.createRefreshToken(userId, deviceInfo);
    }
    /**
     * Generate both access and refresh tokens
     */
    static async generateTokenPair(userId, username, deviceInfo) {
        const accessToken = this.generateAccessToken(userId, username);
        const refreshToken = await this.generateRefreshToken(new mongoose_1.default.Types.ObjectId(userId), deviceInfo);
        return {
            accessToken,
            refreshToken
        };
    }
    /**
     * Verify access token
     */
    static verifyAccessToken(token) {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET not configured');
        }
        try {
            return jsonwebtoken_1.default.verify(token, jwtSecret, {
                issuer: 'playbg-backend',
                audience: 'playbg-frontend'
            });
        }
        catch (error) {
            throw new Error('Invalid access token');
        }
    }
    /**
     * Verify refresh token and return user info
     */
    static async verifyRefreshToken(token) {
        const refreshTokenDoc = await RefreshToken_1.RefreshTokenModel.findActiveToken(token);
        if (!refreshTokenDoc) {
            throw new Error('Invalid or expired refresh token');
        }
        if (!refreshTokenDoc.isActive()) {
            throw new Error('Refresh token is not active');
        }
        const user = refreshTokenDoc.userId; // Populated user
        return {
            refreshTokenDoc,
            userId: user._id.toString(),
            username: user.username
        };
    }
    /**
     * Refresh access token using refresh token
     */
    static async refreshAccessToken(refreshToken, deviceInfo) {
        const { refreshTokenDoc, userId, username } = await this.verifyRefreshToken(refreshToken);
        // Generate new token pair
        const { accessToken, refreshToken: newRefreshToken } = await this.generateTokenPair(userId, username, deviceInfo);
        // Revoke the old refresh token
        await refreshTokenDoc.revoke('refresh', newRefreshToken.token);
        return {
            accessToken,
            refreshToken: newRefreshToken,
            revokedToken: refreshTokenDoc
        };
    }
    /**
     * Revoke refresh token (logout)
     */
    static async revokeRefreshToken(token, reason = 'logout') {
        const refreshTokenDoc = await RefreshToken_1.RefreshTokenModel.findOne({ token });
        if (!refreshTokenDoc) {
            return false; // Token not found
        }
        if (refreshTokenDoc.isRevoked) {
            return true; // Already revoked
        }
        await refreshTokenDoc.revoke(reason);
        return true;
    }
    /**
     * Revoke all refresh tokens for a user
     */
    static async revokeAllUserTokens(userId, reason = 'security') {
        const result = await RefreshToken_1.RefreshTokenModel.revokeAllUserTokens(new mongoose_1.default.Types.ObjectId(userId), reason);
        return result.modifiedCount;
    }
    /**
     * Get active refresh tokens for a user
     */
    static async getUserActiveTokens(userId) {
        return RefreshToken_1.RefreshTokenModel.find({
            userId: new mongoose_1.default.Types.ObjectId(userId),
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });
    }
    /**
     * Cleanup expired tokens (to be run periodically)
     */
    static async cleanupExpiredTokens() {
        return RefreshToken_1.RefreshTokenModel.cleanupExpiredTokens();
    }
    /**
     * Extract device info from request
     */
    static extractDeviceInfo(req) {
        return {
            userAgent: req.get('User-Agent')?.substring(0, 500),
            ipAddress: req.ip || req.connection?.remoteAddress,
            deviceId: req.get('X-Device-ID') || req.get('X-Client-ID')
        };
    }
    /**
     * Decode access token without verification (for debugging)
     */
    static decodeAccessToken(token) {
        return jsonwebtoken_1.default.decode(token);
    }
}
exports.TokenService = TokenService;
TokenService.ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
TokenService.REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days
//# sourceMappingURL=tokenService.js.map