import mongoose, { Document, Schema } from 'mongoose';
import {
  Game,
  Player,
  BoardState,
  GameMove,
  ChatMessage,
  GameState,
  GameType,
  GameSpeed,
  INITIAL_BOARD_STATE
} from '@playbg/shared';

export interface IGameDocument extends Document, Omit<Game, 'id'> {
  _id: mongoose.Types.ObjectId;
  addMove(move: GameMove): Promise<IGameDocument>;
  addChatMessage(message: ChatMessage): Promise<IGameDocument>;
  addSpectator(userId: string): Promise<IGameDocument>;
  removeSpectator(userId: string): Promise<IGameDocument>;
  isPlayerInGame(userId: string): boolean;
  getPlayerIndex(userId: string): number | null;
}

const PlayerSchema = new Schema<Player>({
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

const BoardStateSchema = new Schema<BoardState>({
  points: {
    type: [[Number]],
    required: true,
    default: INITIAL_BOARD_STATE.points
  },
  bar: {
    type: [Number],
    required: true,
    default: INITIAL_BOARD_STATE.bar
  },
  off: {
    type: [Number],
    required: true,
    default: INITIAL_BOARD_STATE.off
  }
});

const GameMoveSchema = new Schema<GameMove>({
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
      validator: function(dice: number[] | undefined) {
        return !dice || (dice.length === 2 && dice.every(d => d >= 1 && d <= 6));
      },
      message: 'Dice must be array of 2 numbers between 1-6'
    }
  }
});

const ChatMessageSchema = new Schema<ChatMessage>({
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

const gameSchema = new Schema<IGameDocument>({
  players: {
    type: [PlayerSchema],
    required: true,
    validate: {
      validator: function(players: Player[]) {
        return players.length === 2;
      },
      message: 'Game must have exactly 2 players'
    }
  },
  board: {
    type: BoardStateSchema,
    required: true,
    default: () => JSON.parse(JSON.stringify(INITIAL_BOARD_STATE))
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
      validator: function(dice: number[] | null) {
        return dice === null || (dice.length === 2 && dice.every(d => d >= 1 && d <= 6));
      },
      message: 'Dice must be null or array of 2 numbers between 1-6'
    }
  },
  gameState: {
    type: String,
    enum: Object.values(GameState),
    default: GameState.WAITING
  },
  gameType: {
    type: String,
    enum: Object.values(GameType),
    required: true
  },
  gameSpeed: {
    type: String,
    enum: Object.values(GameSpeed),
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
    transform: function(doc: any, ret: any) {
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
gameSchema.methods.addMove = function(move: GameMove) {
  this.moves.push(move);
  return this.save();
};

gameSchema.methods.addChatMessage = function(message: ChatMessage) {
  this.chatMessages.push(message);
  return this.save();
};

gameSchema.methods.addSpectator = function(userId: string) {
  if (!this.spectators.includes(userId)) {
    this.spectators.push(userId);
  }
  return this.save();
};

gameSchema.methods.removeSpectator = function(userId: string) {
  this.spectators = this.spectators.filter((id: string) => id !== userId);
  return this.save();
};

gameSchema.methods.isPlayerInGame = function(userId: string): boolean {
  return this.players.some((player: Player) => player.userId === userId);
};

gameSchema.methods.getPlayerIndex = function(userId: string): number | null {
  const index = this.players.findIndex((player: Player) => player.userId === userId);
  return index !== -1 ? index : null;
};

// Middleware to handle cache invalidation on game completion
gameSchema.post('save', async function(this: IGameDocument) {
  // Only trigger cache invalidation when game finishes
  if (this.gameState === GameState.FINISHED && this.winner) {
    try {
      const { cacheInvalidationService } = await import('../services/cacheInvalidationService');
      
      const affectedUsers = this.players.map((player: Player) => player.userId);
      
      await cacheInvalidationService.handleInvalidation({
        type: 'game_completed',
        gameId: this._id.toString(),
        userId: this.winner,
        affectedUsers,
        reason: `Game ${this._id} completed`
      });
    } catch (error) {
      // Don't fail the save if cache invalidation fails
      console.error('Cache invalidation failed for game completion:', error);
    }
  }
});

// Middleware to handle cache invalidation when rating changes are applied
gameSchema.post('findOneAndUpdate', async function(doc: IGameDocument | null) {
  if (doc && doc.gameState === GameState.FINISHED && doc.winner) {
    try {
      const { cacheInvalidationService } = await import('../services/cacheInvalidationService');
      
      const affectedUsers = doc.players.map((player: Player) => player.userId);
      
      await cacheInvalidationService.handleInvalidation({
        type: 'rating_changed',
        gameId: doc._id.toString(),
        userId: doc.winner,
        affectedUsers,
        reason: `Rating update for game ${doc._id}`
      });
    } catch (error) {
      console.error('Cache invalidation failed for rating change:', error);
    }
  }
});

export const GameModel = mongoose.model<IGameDocument>('Game', gameSchema);