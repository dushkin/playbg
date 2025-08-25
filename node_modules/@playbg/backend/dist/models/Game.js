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
exports.GameModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const shared_1 = require("@playbg/shared");
const PlayerSchema = new mongoose_1.Schema({
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
    color: {
        type: String,
        enum: ['white', 'black'],
        required: true
    },
    timeRemaining: {
        type: Number,
        default: null
    },
    isReady: {
        type: Boolean,
        default: false
    }
});
const BoardStateSchema = new mongoose_1.Schema({
    points: {
        type: [[Number]],
        required: true,
        default: shared_1.INITIAL_BOARD_STATE.points
    },
    bar: {
        type: [Number],
        required: true,
        default: shared_1.INITIAL_BOARD_STATE.bar
    },
    off: {
        type: [Number],
        required: true,
        default: shared_1.INITIAL_BOARD_STATE.off
    }
});
const GameMoveSchema = new mongoose_1.Schema({
    playerId: {
        type: String,
        required: true
    },
    from: {
        type: Number,
        required: true
    },
    to: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    dice: {
        type: [Number],
        validate: {
            validator: function (dice) {
                return !dice || (dice.length === 2 && dice.every(d => d >= 1 && d <= 6));
            },
            message: 'Dice must be array of 2 numbers between 1-6'
        }
    }
});
const ChatMessageSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: [500, 'Message cannot exceed 500 characters']
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    type: {
        type: String,
        enum: ['chat', 'system', 'game'],
        default: 'chat'
    }
});
const gameSchema = new mongoose_1.Schema({
    players: {
        type: [PlayerSchema],
        required: true,
        validate: {
            validator: function (players) {
                return players.length === 2;
            },
            message: 'Game must have exactly 2 players'
        }
    },
    board: {
        type: BoardStateSchema,
        required: true,
        default: () => JSON.parse(JSON.stringify(shared_1.INITIAL_BOARD_STATE))
    },
    currentPlayer: {
        type: Number,
        enum: [0, 1],
        default: 0
    },
    dice: {
        type: [Number],
        default: null,
        validate: {
            validator: function (dice) {
                return dice === null || (dice.length === 2 && dice.every(d => d >= 1 && d <= 6));
            },
            message: 'Dice must be null or array of 2 numbers between 1-6'
        }
    },
    gameState: {
        type: String,
        enum: Object.values(shared_1.GameState),
        default: shared_1.GameState.WAITING
    },
    gameType: {
        type: String,
        enum: Object.values(shared_1.GameType),
        required: true
    },
    gameSpeed: {
        type: String,
        enum: Object.values(shared_1.GameSpeed),
        required: true
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date,
        default: null
    },
    winner: {
        type: String,
        default: null
    },
    moves: {
        type: [GameMoveSchema],
        default: []
    },
    spectators: {
        type: [String],
        default: []
    },
    chatMessages: {
        type: [ChatMessageSchema],
        default: []
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
gameSchema.index({ 'players.userId': 1 });
gameSchema.index({ gameState: 1 });
gameSchema.index({ gameType: 1 });
gameSchema.index({ createdAt: -1 });
gameSchema.index({ startTime: -1 });
// Methods
gameSchema.methods.addMove = function (move) {
    this.moves.push(move);
    return this.save();
};
gameSchema.methods.addChatMessage = function (message) {
    this.chatMessages.push(message);
    return this.save();
};
gameSchema.methods.addSpectator = function (userId) {
    if (!this.spectators.includes(userId)) {
        this.spectators.push(userId);
    }
    return this.save();
};
gameSchema.methods.removeSpectator = function (userId) {
    this.spectators = this.spectators.filter((id) => id !== userId);
    return this.save();
};
gameSchema.methods.isPlayerInGame = function (userId) {
    return this.players.some((player) => player.userId === userId);
};
gameSchema.methods.getPlayerIndex = function (userId) {
    const index = this.players.findIndex((player) => player.userId === userId);
    return index !== -1 ? index : null;
};
// Middleware to handle cache invalidation on game completion
gameSchema.post('save', async function () {
    // Only trigger cache invalidation when game finishes
    if (this.gameState === shared_1.GameState.FINISHED && this.winner) {
        try {
            const { cacheInvalidationService } = await Promise.resolve().then(() => __importStar(require('../services/cacheInvalidationService')));
            const affectedUsers = this.players.map((player) => player.userId);
            await cacheInvalidationService.handleInvalidation({
                type: 'game_completed',
                gameId: this._id.toString(),
                userId: this.winner,
                affectedUsers,
                reason: `Game ${this._id} completed`
            });
        }
        catch (error) {
            // Don't fail the save if cache invalidation fails
            console.error('Cache invalidation failed for game completion:', error);
        }
    }
});
// Middleware to handle cache invalidation when rating changes are applied
gameSchema.post('findOneAndUpdate', async function (doc) {
    if (doc && doc.gameState === shared_1.GameState.FINISHED && doc.winner) {
        try {
            const { cacheInvalidationService } = await Promise.resolve().then(() => __importStar(require('../services/cacheInvalidationService')));
            const affectedUsers = doc.players.map((player) => player.userId);
            await cacheInvalidationService.handleInvalidation({
                type: 'rating_changed',
                gameId: doc._id.toString(),
                userId: doc.winner,
                affectedUsers,
                reason: `Rating update for game ${doc._id}`
            });
        }
        catch (error) {
            console.error('Cache invalidation failed for rating change:', error);
        }
    }
});
exports.GameModel = mongoose_1.default.model('Game', gameSchema);
//# sourceMappingURL=Game.js.map