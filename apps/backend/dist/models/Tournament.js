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
exports.TournamentModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const shared_1 = require("@playbg/shared");
const TournamentRulesSchema = new mongoose_1.Schema({
    matchLength: {
        type: Number,
        required: true,
        min: [1, 'Match length must be at least 1'],
        max: [21, 'Match length cannot exceed 21']
    },
    timeControl: {
        type: String,
        enum: Object.values(shared_1.GameSpeed),
        required: true
    },
    doubleAllowed: {
        type: Boolean,
        default: true
    },
    crawfordRule: {
        type: Boolean,
        default: true
    }
});
const TournamentMatchSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true
    },
    player1: {
        type: String,
        required: true
    },
    player2: {
        type: String,
        required: true
    },
    gameId: {
        type: String,
        default: null
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
    }
});
const TournamentRoundSchema = new mongoose_1.Schema({
    roundNumber: {
        type: Number,
        required: true,
        min: [1, 'Round number must be at least 1']
    },
    matches: {
        type: [TournamentMatchSchema],
        default: []
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: Object.values(shared_1.RoundStatus),
        default: shared_1.RoundStatus.PENDING
    }
});
const TournamentParticipantSchema = new mongoose_1.Schema({
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
        required: true,
        min: [1, 'Seed must be at least 1']
    },
    status: {
        type: String,
        enum: Object.values(shared_1.ParticipantStatus),
        default: shared_1.ParticipantStatus.REGISTERED
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
});
const tournamentSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, 'Tournament name is required'],
        trim: true,
        minlength: [3, 'Tournament name must be at least 3 characters'],
        maxlength: [100, 'Tournament name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
        default: ''
    },
    type: {
        type: String,
        enum: Object.values(shared_1.TournamentType),
        required: true
    },
    format: {
        type: String,
        enum: Object.values(shared_1.TournamentFormat),
        required: true
    },
    maxPlayers: {
        type: Number,
        required: true,
        min: [4, 'Tournament must allow at least 4 players'],
        max: [128, 'Tournament cannot exceed 128 players']
    },
    currentPlayers: {
        type: Number,
        default: 0,
        min: [0, 'Current players cannot be negative']
    },
    entryFee: {
        type: Number,
        min: [0, 'Entry fee cannot be negative'],
        default: 0
    },
    prizePool: {
        type: Number,
        min: [0, 'Prize pool cannot be negative'],
        default: 0
    },
    startTime: {
        type: Date,
        required: true,
        validate: {
            validator: function (startTime) {
                return startTime > new Date();
            },
            message: 'Start time must be in the future'
        }
    },
    endTime: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: Object.values(shared_1.TournamentStatus),
        default: shared_1.TournamentStatus.REGISTRATION
    },
    rounds: {
        type: [TournamentRoundSchema],
        default: []
    },
    participants: {
        type: [TournamentParticipantSchema],
        default: []
    },
    organizer: {
        type: String,
        required: true,
        ref: 'User'
    },
    rules: {
        type: TournamentRulesSchema,
        required: true
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
tournamentSchema.index({ status: 1 });
tournamentSchema.index({ type: 1 });
tournamentSchema.index({ startTime: 1 });
tournamentSchema.index({ organizer: 1 });
tournamentSchema.index({ 'participants.userId': 1 });
tournamentSchema.index({ currentPlayers: 1, maxPlayers: 1 });
// Virtual for available slots
tournamentSchema.virtual('availableSlots').get(function () {
    return this.maxPlayers - this.currentPlayers;
});
// Virtual for is full
tournamentSchema.virtual('isFull').get(function () {
    return this.currentPlayers >= this.maxPlayers;
});
// Methods
tournamentSchema.methods.addParticipant = function (userId, username, rating) {
    if (this.currentPlayers >= this.maxPlayers) {
        throw new Error('Tournament is full');
    }
    if (this.status !== shared_1.TournamentStatus.REGISTRATION) {
        throw new Error('Tournament registration is closed');
    }
    if (this.isParticipant(userId)) {
        throw new Error('User is already registered for this tournament');
    }
    const seed = this.currentPlayers + 1;
    this.participants.push({
        userId,
        username,
        rating,
        seed,
        status: shared_1.ParticipantStatus.REGISTERED,
        joinedAt: new Date()
    });
    this.currentPlayers += 1;
    return this.save();
};
tournamentSchema.methods.removeParticipant = function (userId) {
    if (!this.isParticipant(userId)) {
        throw new Error('User is not registered for this tournament');
    }
    if (this.status !== shared_1.TournamentStatus.REGISTRATION) {
        throw new Error('Cannot remove participant after tournament has started');
    }
    this.participants = this.participants.filter((p) => p.userId !== userId);
    this.currentPlayers = Math.max(0, this.currentPlayers - 1);
    // Reassign seeds
    this.participants.forEach((participant, index) => {
        participant.seed = index + 1;
    });
    return this.save();
};
tournamentSchema.methods.isParticipant = function (userId) {
    return this.participants.some((p) => p.userId === userId);
};
tournamentSchema.methods.getParticipant = function (userId) {
    const participant = this.participants.find((p) => p.userId === userId);
    return participant || null;
};
tournamentSchema.methods.generateBracket = function () {
    if (this.status !== shared_1.TournamentStatus.REGISTRATION) {
        throw new Error('Can only generate bracket during registration phase');
    }
    if (this.currentPlayers < 4) {
        throw new Error('Need at least 4 players to start tournament');
    }
    // Sort participants by rating for seeding
    const sortedParticipants = [...this.participants].sort((a, b) => b.rating - a.rating);
    // Reassign seeds based on rating
    sortedParticipants.forEach((participant, index) => {
        participant.seed = index + 1;
    });
    this.participants = sortedParticipants;
    // Generate first round matches
    const firstRound = this.generateFirstRound();
    this.rounds.push(firstRound);
    this.status = shared_1.TournamentStatus.IN_PROGRESS;
    return this.save();
};
tournamentSchema.methods.generateFirstRound = function () {
    const matches = [];
    const participants = [...this.participants];
    // For elimination tournaments, pair highest seed with lowest seed
    if (this.type === shared_1.TournamentType.SINGLE_ELIMINATION || this.type === shared_1.TournamentType.DOUBLE_ELIMINATION) {
        for (let i = 0; i < participants.length / 2; i++) {
            const player1 = participants[i];
            const player2 = participants[participants.length - 1 - i];
            matches.push({
                id: `match_${Date.now()}_${i}`,
                player1: player1.userId,
                player2: player2.userId,
                gameId: undefined,
                winner: undefined,
                status: shared_1.MatchStatus.SCHEDULED,
                scheduledTime: new Date(this.startTime.getTime() + (i * 15 * 60 * 1000)) // Stagger matches by 15 minutes
            });
        }
    }
    // For round robin, generate all possible pairings (implement later if needed)
    return {
        roundNumber: 1,
        matches,
        startTime: this.startTime,
        endTime: undefined,
        status: shared_1.RoundStatus.PENDING
    };
};
tournamentSchema.methods.advanceToNextRound = function () {
    const currentRound = this.rounds[this.rounds.length - 1];
    if (!currentRound) {
        throw new Error('No rounds available');
    }
    // Check if current round is complete
    const allMatchesComplete = currentRound.matches.every((match) => match.status === shared_1.MatchStatus.COMPLETED && match.winner);
    if (!allMatchesComplete) {
        throw new Error('Current round is not complete');
    }
    // Get winners for next round
    const winners = currentRound.matches.map((match) => match.winner).filter(Boolean);
    if (winners.length <= 1) {
        // Tournament is complete
        this.status = shared_1.TournamentStatus.FINISHED;
        this.endTime = new Date();
        return this.save();
    }
    // Generate next round
    const nextRoundMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
        if (winners[i + 1]) {
            nextRoundMatches.push({
                id: `match_${Date.now()}_${i / 2}`,
                player1: winners[i],
                player2: winners[i + 1],
                gameId: undefined,
                winner: undefined,
                status: shared_1.MatchStatus.SCHEDULED,
                scheduledTime: new Date(Date.now() + (30 * 60 * 1000)) // 30 minutes from now
            });
        }
    }
    const nextRound = {
        roundNumber: currentRound.roundNumber + 1,
        matches: nextRoundMatches,
        startTime: new Date(Date.now() + (30 * 60 * 1000)),
        endTime: undefined,
        status: shared_1.RoundStatus.PENDING
    };
    this.rounds.push(nextRound);
    return this.save();
};
tournamentSchema.methods.isComplete = function () {
    return this.status === shared_1.TournamentStatus.FINISHED;
};
// Pre-save middleware
tournamentSchema.pre('save', function (next) {
    // Update current players count
    this.currentPlayers = this.participants.length;
    // Calculate prize pool based on entry fees
    if (this.entryFee && this.entryFee > 0) {
        this.prizePool = this.entryFee * this.currentPlayers;
    }
    next();
});
exports.TournamentModel = mongoose_1.default.model('Tournament', tournamentSchema);
//# sourceMappingURL=Tournament.js.map