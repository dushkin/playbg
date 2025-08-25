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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const shared_1 = require("@playbg/shared");
const PlayerDetailsSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        ref: 'User'
    },
    username: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    seed: {
        type: Number,
        default: null
    }
});
const MatchResultSchema = new mongoose_1.Schema({
    winner: {
        type: String,
        required: true
    },
    loser: {
        type: String,
        required: true
    },
    score: {
        type: String,
        required: true,
        match: /^\d+-\d+$/ // Format: "7-3"
    },
    gameResult: {
        type: String,
        enum: Object.values(shared_1.GameResult),
        required: true
    },
    duration: {
        type: Number,
        required: true,
        min: [1, 'Match duration must be at least 1 minute']
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
});
const matchSchema = new mongoose_1.Schema({
    tournamentId: {
        type: String,
        required: true,
        ref: 'Tournament'
    },
    roundNumber: {
        type: Number,
        required: true,
        min: [1, 'Round number must be at least 1']
    },
    player1: {
        type: String,
        required: true
    },
    player2: {
        type: String,
        required: true
    },
    player1Details: {
        type: PlayerDetailsSchema,
        required: true
    },
    player2Details: {
        type: PlayerDetailsSchema,
        required: true
    },
    gameId: {
        type: String,
        default: null,
        ref: 'Game'
    },
    winner: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: Object.values(shared_1.MatchStatus),
        default: shared_1.MatchStatus.SCHEDULED
    },
    scheduledTime: {
        type: Date,
        required: true
    },
    result: {
        type: MatchResultSchema,
        default: null
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id.toString();
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});
// Indexes
matchSchema.index({ tournamentId: 1, roundNumber: 1 });
matchSchema.index({ player1: 1 });
matchSchema.index({ player2: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ scheduledTime: 1 });
matchSchema.index({ gameId: 1 });
// Indexes for finding user matches
matchSchema.index({ player1: 1 });
matchSchema.index({ player2: 1 });
// Virtual properties
matchSchema.virtual('isScheduled').get(function () {
    return this.status === shared_1.MatchStatus.SCHEDULED;
});
matchSchema.virtual('isInProgress').get(function () {
    return this.status === shared_1.MatchStatus.IN_PROGRESS;
});
matchSchema.virtual('isCompleted').get(function () {
    return this.status === shared_1.MatchStatus.COMPLETED;
});
matchSchema.virtual('matchName').get(function () {
    return `${this.player1Details.username} vs ${this.player2Details.username}`;
});
// Methods
matchSchema.methods.startMatch = function (gameId) {
    if (this.status !== shared_1.MatchStatus.SCHEDULED) {
        throw new Error('Match must be scheduled to start');
    }
    if (new Date() < this.scheduledTime) {
        throw new Error('Match cannot start before scheduled time');
    }
    this.status = shared_1.MatchStatus.IN_PROGRESS;
    this.gameId = gameId;
    return this.save();
};
matchSchema.methods.completeMatch = function (winnerId, score, duration) {
    if (this.status !== shared_1.MatchStatus.IN_PROGRESS) {
        throw new Error('Match must be in progress to complete');
    }
    if (!this.isParticipant(winnerId)) {
        throw new Error('Winner must be a participant in this match');
    }
    const loserId = winnerId === this.player1 ? this.player2 : this.player1;
    this.status = shared_1.MatchStatus.COMPLETED;
    this.winner = winnerId;
    this.result = {
        winner: winnerId,
        loser: loserId,
        score,
        gameResult: shared_1.GameResult.WIN,
        duration,
        completedAt: new Date()
    };
    return this.save();
};
matchSchema.methods.forfeitMatch = function (forfeitingUserId) {
    if (this.status === shared_1.MatchStatus.COMPLETED) {
        throw new Error('Cannot forfeit a completed match');
    }
    if (!this.isParticipant(forfeitingUserId)) {
        throw new Error('Only participants can forfeit a match');
    }
    const winnerId = forfeitingUserId === this.player1 ? this.player2 : this.player1;
    this.status = shared_1.MatchStatus.WALKOVER;
    this.winner = winnerId;
    this.result = {
        winner: winnerId,
        loser: forfeitingUserId,
        score: 'Walkover',
        gameResult: shared_1.GameResult.ABANDONED,
        duration: 0,
        completedAt: new Date()
    };
    return this.save();
};
matchSchema.methods.isParticipant = function (userId) {
    return this.player1 === userId || this.player2 === userId;
};
matchSchema.methods.getOpponent = function (userId) {
    if (this.player1 === userId)
        return this.player2;
    if (this.player2 === userId)
        return this.player1;
    return null;
};
// Static methods
matchSchema.statics.findByUser = function (userId) {
    return this.find({
        $or: [
            { player1: userId },
            { player2: userId }
        ]
    }).sort({ scheduledTime: -1 });
};
matchSchema.statics.findByTournament = function (tournamentId) {
    return this.find({ tournamentId })
        .sort({ roundNumber: 1, scheduledTime: 1 });
};
matchSchema.statics.findUpcoming = function (userId) {
    const query = {
        status: shared_1.MatchStatus.SCHEDULED,
        scheduledTime: { $gt: new Date() }
    };
    if (userId) {
        query.$or = [
            { player1: userId },
            { player2: userId }
        ];
    }
    return this.find(query)
        .sort({ scheduledTime: 1 });
};
// Pre-save validation
matchSchema.pre('save', function (next) {
    // Ensure player1 and player2 are different
    if (this.player1 === this.player2) {
        next(new Error('Player1 and Player2 cannot be the same'));
        return;
    }
    // Ensure winner is one of the players
    if (this.winner && !this.isParticipant(this.winner)) {
        next(new Error('Winner must be one of the match participants'));
        return;
    }
    // Validate result consistency
    if (this.result && this.result.winner !== this.winner) {
        next(new Error('Result winner must match match winner'));
        return;
    }
    next();
});
exports.MatchModel = mongoose_1.default.model('Match', matchSchema);
//# sourceMappingURL=Match.js.map