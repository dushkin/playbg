import mongoose, { Document, Schema } from 'mongoose';
import {
  TournamentMatch,
  MatchStatus,
  GameResult
} from '@playbg/shared';

// Extended match document with additional fields for standalone match tracking
export interface IMatchDocument extends Document, Omit<TournamentMatch, 'id'> {
  _id: mongoose.Types.ObjectId;
  tournamentId: string;
  roundNumber: number;
  player1Details: {
    userId: string;
    username: string;
    rating: number;
    seed?: number;
  };
  player2Details: {
    userId: string;
    username: string;
    rating: number;
    seed?: number;
  };
  result?: {
    winner: string;
    loser: string;
    score: string; // e.g., "7-3", "15-0"
    gameResult: GameResult;
    duration: number; // in minutes
    completedAt: Date;
  };
  // Methods
  startMatch(gameId: string): Promise<IMatchDocument>;
  completeMatch(winnerId: string, score: string, duration: number): Promise<IMatchDocument>;
  forfeitMatch(forfeitingUserId: string): Promise<IMatchDocument>;
  isParticipant(userId: string): boolean;
  getOpponent(userId: string): string | null;
}

const PlayerDetailsSchema = new Schema({
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

const MatchResultSchema = new Schema({
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
    enum: Object.values(GameResult),
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

const matchSchema = new Schema<IMatchDocument>({
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
    enum: Object.values(MatchStatus),
    default: MatchStatus.SCHEDULED
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
    transform: function(doc: any, ret: any) {
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
matchSchema.virtual('isScheduled').get(function(this: IMatchDocument) {
  return this.status === MatchStatus.SCHEDULED;
});

matchSchema.virtual('isInProgress').get(function(this: IMatchDocument) {
  return this.status === MatchStatus.IN_PROGRESS;
});

matchSchema.virtual('isCompleted').get(function(this: IMatchDocument) {
  return this.status === MatchStatus.COMPLETED;
});

matchSchema.virtual('matchName').get(function(this: IMatchDocument) {
  return `${this.player1Details.username} vs ${this.player2Details.username}`;
});

// Methods
matchSchema.methods.startMatch = function(gameId: string) {
  if (this.status !== MatchStatus.SCHEDULED) {
    throw new Error('Match must be scheduled to start');
  }

  if (new Date() < this.scheduledTime) {
    throw new Error('Match cannot start before scheduled time');
  }

  this.status = MatchStatus.IN_PROGRESS;
  this.gameId = gameId;

  return this.save();
};

matchSchema.methods.completeMatch = function(winnerId: string, score: string, duration: number) {
  if (this.status !== MatchStatus.IN_PROGRESS) {
    throw new Error('Match must be in progress to complete');
  }

  if (!this.isParticipant(winnerId)) {
    throw new Error('Winner must be a participant in this match');
  }

  const loserId = winnerId === this.player1 ? this.player2 : this.player1;

  this.status = MatchStatus.COMPLETED;
  this.winner = winnerId;
  this.result = {
    winner: winnerId,
    loser: loserId,
    score,
    gameResult: GameResult.WIN,
    duration,
    completedAt: new Date()
  };

  return this.save();
};

matchSchema.methods.forfeitMatch = function(forfeitingUserId: string) {
  if (this.status === MatchStatus.COMPLETED) {
    throw new Error('Cannot forfeit a completed match');
  }

  if (!this.isParticipant(forfeitingUserId)) {
    throw new Error('Only participants can forfeit a match');
  }

  const winnerId = forfeitingUserId === this.player1 ? this.player2 : this.player1;

  this.status = MatchStatus.WALKOVER;
  this.winner = winnerId;
  this.result = {
    winner: winnerId,
    loser: forfeitingUserId,
    score: 'Walkover',
    gameResult: GameResult.ABANDONED,
    duration: 0,
    completedAt: new Date()
  };

  return this.save();
};

matchSchema.methods.isParticipant = function(userId: string): boolean {
  return this.player1 === userId || this.player2 === userId;
};

matchSchema.methods.getOpponent = function(userId: string): string | null {
  if (this.player1 === userId) return this.player2;
  if (this.player2 === userId) return this.player1;
  return null;
};

// Static methods
matchSchema.statics.findByUser = function(userId: string) {
  return this.find({
    $or: [
      { player1: userId },
      { player2: userId }
    ]
  }).sort({ scheduledTime: -1 });
};

matchSchema.statics.findByTournament = function(tournamentId: string) {
  return this.find({ tournamentId })
    .sort({ roundNumber: 1, scheduledTime: 1 });
};

matchSchema.statics.findUpcoming = function(userId?: string) {
  const query: any = {
    status: MatchStatus.SCHEDULED,
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
matchSchema.pre('save', function(next) {
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

export const MatchModel = mongoose.model<IMatchDocument>('Match', matchSchema);