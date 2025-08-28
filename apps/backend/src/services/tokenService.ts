import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { RefreshTokenModel, IRefreshTokenDocument } from '../models/RefreshToken';

export interface TokenPayload {
  userId: string;
  username: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
  private static readonly REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

  /**
   * Generate access token (JWT)
   */
  static generateAccessToken(userId: string, username: string): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const payload: TokenPayload = {
      userId,
      username
    };

    return jwt.sign(payload, jwtSecret, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'playbg-backend',
      audience: 'playbg-frontend'
    });
  }

  /**
   * Generate refresh token and store in database
   */
  static async generateRefreshToken(
    userId: mongoose.Types.ObjectId,
    deviceInfo?: {
      userAgent?: string;
      ipAddress?: string;
      deviceId?: string;
    }
  ): Promise<IRefreshTokenDocument> {
    // First revoke any existing active refresh tokens for this user/device
    if (deviceInfo?.deviceId) {
      await RefreshTokenModel.updateMany(
        {
          userId,
          'deviceInfo.deviceId': deviceInfo.deviceId,
          isRevoked: false
        },
        {
          isRevoked: true,
          revokedAt: new Date(),
          revokedReason: 'refresh'
        }
      );
    }

    return (RefreshTokenModel as any).createRefreshToken(userId, deviceInfo);
  }

  /**
   * Generate both access and refresh tokens
   */
  static async generateTokenPair(
    userId: string,
    username: string,
    deviceInfo?: {
      userAgent?: string;
      ipAddress?: string;
      deviceId?: string;
    }
  ): Promise<{
    accessToken: string;
    refreshToken: IRefreshTokenDocument;
  }> {
    const accessToken = this.generateAccessToken(userId, username);
    const refreshToken = await this.generateRefreshToken(
      new mongoose.Types.ObjectId(userId),
      deviceInfo
    );

    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      return jwt.verify(token, jwtSecret, {
        issuer: 'playbg-backend',
        audience: 'playbg-frontend'
      }) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token and return user info
   */
  static async verifyRefreshToken(token: string): Promise<{
    refreshTokenDoc: IRefreshTokenDocument;
    userId: string;
    username: string;
  }> {
    const refreshTokenDoc = await (RefreshTokenModel as any).findActiveToken(token);
    
    if (!refreshTokenDoc) {
      throw new Error('Invalid or expired refresh token');
    }

    if (!refreshTokenDoc.isActive()) {
      throw new Error('Refresh token is not active');
    }

    const user = refreshTokenDoc.userId as any; // Populated user

    return {
      refreshTokenDoc,
      userId: user._id.toString(),
      username: user.username
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(
    refreshToken: string,
    deviceInfo?: {
      userAgent?: string;
      ipAddress?: string;
      deviceId?: string;
    }
  ): Promise<{
    accessToken: string;
    refreshToken: IRefreshTokenDocument;
    revokedToken: IRefreshTokenDocument;
  }> {
    const { refreshTokenDoc, userId, username } = await this.verifyRefreshToken(refreshToken);

    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokenPair(
      userId,
      username,
      deviceInfo
    );

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
  static async revokeRefreshToken(token: string, reason: string = 'logout'): Promise<boolean> {
    const refreshTokenDoc = await RefreshTokenModel.findOne({ token });
    
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
  static async revokeAllUserTokens(userId: string, reason: string = 'security'): Promise<number> {
    const result = await (RefreshTokenModel as any).revokeAllUserTokens(
      new mongoose.Types.ObjectId(userId),
      reason
    );
    return result.modifiedCount;
  }

  /**
   * Get active refresh tokens for a user
   */
  static async getUserActiveTokens(userId: string): Promise<IRefreshTokenDocument[]> {
    return RefreshTokenModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
  }

  /**
   * Cleanup expired tokens (to be run periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    return (RefreshTokenModel as any).cleanupExpiredTokens();
  }

  /**
   * Extract device info from request
   */
  static extractDeviceInfo(req: any): {
    userAgent?: string;
    ipAddress?: string;
    deviceId?: string;
  } {
    return {
      userAgent: req.get('User-Agent')?.substring(0, 500),
      ipAddress: req.ip || req.connection?.remoteAddress,
      deviceId: req.get('X-Device-ID') || req.get('X-Client-ID')
    };
  }

  /**
   * Decode access token without verification (for debugging)
   */
  static decodeAccessToken(token: string): any {
    return jwt.decode(token);
  }
}