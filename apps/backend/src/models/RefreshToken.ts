import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

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
  
  // Methods
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

const DeviceInfoSchema = new Schema({
  userAgent: {
    type: String,
    maxlength: 500
  },
  ipAddress: {
    type: String,
    maxlength: 45 // IPv6 max length
  },
  deviceId: {
    type: String,
    maxlength: 100
  }
});

const refreshTokenSchema = new Schema<IRefreshTokenDocument>({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  replacedByToken: {
    type: String,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revokedReason: {
    type: String,
    enum: ['logout', 'refresh', 'security', 'expired', 'admin'],
    default: null
  },
  deviceInfo: {
    type: DeviceInfoSchema,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.token; // Never expose actual token in JSON
      return ret;
    }
  }
});

// Indexes
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
refreshTokenSchema.index({ token: 1, isRevoked: 1 });

// Instance methods
refreshTokenSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

refreshTokenSchema.methods.isActive = function(): boolean {
  return !this.isRevoked && !this.isExpired();
};

refreshTokenSchema.methods.revoke = function(reason: string = 'logout', replacedBy?: string) {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  if (replacedBy) {
    this.replacedByToken = replacedBy;
  }
  return this.save();
};

// Static methods
refreshTokenSchema.statics.generateToken = function(): string {
  return crypto.randomBytes(64).toString('hex');
};

refreshTokenSchema.statics.createRefreshToken = async function(
  userId: mongoose.Types.ObjectId,
  deviceInfo?: any
): Promise<IRefreshTokenDocument> {
  const token = (this as any).generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

  return this.create({
    token,
    userId,
    expiresAt,
    deviceInfo
  });
};

refreshTokenSchema.statics.findActiveToken = function(token: string) {
  return this.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).populate('userId');
};

refreshTokenSchema.statics.revokeAllUserTokens = async function(userId: mongoose.Types.ObjectId, reason: string = 'security') {
  return this.updateMany(
    { userId, isRevoked: false },
    {
      isRevoked: true,
      revokedAt: new Date(),
      revokedReason: reason
    }
  );
};

refreshTokenSchema.statics.cleanupExpiredTokens = async function() {
  const result = await this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Remove revoked tokens older than 7 days
    ]
  });
  return result.deletedCount;
};

// Pre-save middleware
refreshTokenSchema.pre('save', function(next) {
  if (this.isModified('isRevoked') && this.isRevoked && !this.revokedAt) {
    this.revokedAt = new Date();
  }
  next();
});

export const RefreshTokenModel = mongoose.model<IRefreshTokenDocument, IRefreshTokenModel>('RefreshToken', refreshTokenSchema);