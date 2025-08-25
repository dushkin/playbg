"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const DeviceInfoSchema = new mongoose_1.Schema({
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
const refreshTokenSchema = new mongoose_1.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
        transform: function (doc, ret) {
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
refreshTokenSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};
refreshTokenSchema.methods.isActive = function () {
    return !this.isRevoked && !this.isExpired();
};
refreshTokenSchema.methods.revoke = function (reason = 'logout', replacedBy) {
    this.isRevoked = true;
    this.revokedAt = new Date();
    this.revokedReason = reason;
    if (replacedBy) {
        this.replacedByToken = replacedBy;
    }
    return this.save();
};
// Static methods
refreshTokenSchema.statics.generateToken = function () {
    return crypto_1.default.randomBytes(64).toString('hex');
};
refreshTokenSchema.statics.createRefreshToken = async function (userId, deviceInfo) {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
    return this.create({
        token,
        userId,
        expiresAt,
        deviceInfo
    });
};
refreshTokenSchema.statics.findActiveToken = function (token) {
    return this.findOne({
        token,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
    }).populate('userId');
};
refreshTokenSchema.statics.revokeAllUserTokens = async function (userId, reason = 'security') {
    return this.updateMany({ userId, isRevoked: false }, {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason
    });
};
refreshTokenSchema.statics.cleanupExpiredTokens = async function () {
    const result = await this.deleteMany({
        $or: [
            { expiresAt: { $lt: new Date() } },
            { isRevoked: true, revokedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Remove revoked tokens older than 7 days
        ]
    });
    return result.deletedCount;
};
// Pre-save middleware
refreshTokenSchema.pre('save', function (next) {
    if (this.isModified('isRevoked') && this.isRevoked && !this.revokedAt) {
        this.revokedAt = new Date();
    }
    next();
});
exports.RefreshTokenModel = mongoose_1.default.model('RefreshToken', refreshTokenSchema);
//# sourceMappingURL=RefreshToken.js.map