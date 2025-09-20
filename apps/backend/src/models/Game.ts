import mongoose, { Document, Schema } from 'mongoose';
import {
  Game,
  Player,
  BoardState,
  GameMove,
  ChatMessage,
  GameState,
  GameType,
  GamePeriod,
  StepPeriod,
  INITIAL_BOARD_STATE
} from '@playbg/shared';
import logger from '../utils/logger';

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
    required: false,
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
  gamePeriod: {
    type: String,
    enum: Object.values(GamePeriod),
    required: true,
    default: GamePeriod.UNLIMITED
  },
  stepPeriod: {
    type: String,
    enum: Object.values(StepPeriod),
    required: false
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

// Pre-save middleware to migrate old enum values
gameSchema.pre('save', function(next) {
  // Migration map for old GameSpeed/GamePeriod values to new ones
  const gamePeriodMigrationMap: Record<string, string> = {
    'blitz': GamePeriod.THREE_MINUTES,
    'rapid': GamePeriod.TEN_MINUTES,
    'standard': GamePeriod.THIRTY_MINUTES,
    'unlimited': GamePeriod.UNLIMITED
  };

  // Migration map for old GameType values to new ones
  const gameTypeMigrationMap: Record<string, string> = {
    'casual': GameType.NOT_RANKED,
    'private': GameType.NOT_RANKED,
    'tournament': GameType.NOT_RANKED
  };

  // Handle both old gameSpeed and new gamePeriod fields for migration
  if ((this as any).gameSpeed) {
    const oldValue = (this as any).gameSpeed;
    if (gamePeriodMigrationMap[oldValue]) {
      this.gamePeriod = gamePeriodMigrationMap[oldValue] as GamePeriod;
    } else if (oldValue === 'standard') {
      this.gamePeriod = GamePeriod.THIRTY_MINUTES;
    } else {
      this.gamePeriod = oldValue;
    }
    delete (this as any).gameSpeed;
  }
  
  if (this.gamePeriod && gamePeriodMigrationMap[this.gamePeriod]) {
    this.gamePeriod = gamePeriodMigrationMap[this.gamePeriod] as GamePeriod;
  }
  
  // Handle stepTiming to stepPeriod migration
  if ((this as any).stepTiming) {
    this.stepPeriod = (this as any).stepTiming;
    delete (this as any).stepTiming;
  }

  if (this.gameType && gameTypeMigrationMap[this.gameType]) {
    this.gameType = gameTypeMigrationMap[this.gameType] as GameType;
  }

  next();
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
      logger.error('Cache invalidation failed for game completion', { 
        error: error instanceof Error ? error.message : String(error), 
        gameId: this._id.toString() 
      });
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
      logger.error('Cache invalidation failed for rating change', { 
        error: error instanceof Error ? error.message : String(error), 
        gameId: doc._id.toString(), 
        userId: doc.winner 
      });
    }
  }
});

export const GameModel = mongoose.model<IGameDocument>('Game', gameSchema);