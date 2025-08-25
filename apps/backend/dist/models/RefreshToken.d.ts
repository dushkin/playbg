import mongoose, { Document } from 'mongoose';
export interface IRefreshTokenDocument extends Document {
    token: string;
    userId: mongoose.Types.ObjectId;
    expiresAt: Date;
    isRevoked: boolean;
    replacedByToken?: string;
    revokedAt?: Date;
    revokedReason?: string;
    deviceInfo?: {
        userAgent?: string;
        ipAddress?: string;
        deviceId?: string;
    };
    createdAt: Date;
    updatedAt: Date;
    isExpired(): boolean;
    isActive(): boolean;
    revoke(reason?: string, replacedBy?: string): Promise<IRefreshTokenDocument>;
}
export interface IRefreshTokenModel extends mongoose.Model<IRefreshTokenDocument> {
    generateToken(): string;
    createRefreshToken(userId: mongoose.Types.ObjectId, deviceInfo?: any): Promise<IRefreshTokenDocument>;
    findActiveToken(token: string): Promise<IRefreshTokenDocument | null>;
    revokeAllUserTokens(userId: mongoose.Types.ObjectId, reason?: string): Promise<any>;
    cleanupExpiredTokens(): Promise<number>;
}
export declare const RefreshTokenModel: IRefreshTokenModel;
//# sourceMappingURL=RefreshToken.d.ts.map