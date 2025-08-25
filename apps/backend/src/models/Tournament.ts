import mongoose, { Document, Schema } from 'mongoose';
import {
  Tournament,
  TournamentParticipant,
  TournamentRound,
  TournamentMatch,
  TournamentRules,
  TournamentType,
  TournamentFormat,
  TournamentStatus,
  ParticipantStatus,
  RoundStatus,
  MatchStatus,
  GameSpeed
} from '@playbg/shared';

export interface ITournamentDocument extends Document, Omit<Tournament, 'id'> {
  _id: mongoose.Types.ObjectId;
  addParticipant(userId: string, username: string, rating: number): Promise<ITournamentDocument>;
  removeParticipant(userId: string): Promise<ITournamentDocument>;
  isParticipant(userId: string): boolean;
  getParticipant(userId: string): TournamentParticipant | null;
  generateBracket(): Promise<ITournamentDocument>;
  advanceToNextRound(): Promise<ITournamentDocument>;
  isComplete(): boolean;
}

const TournamentRulesSchema = new Schema<TournamentRules>({
  matchLength: {
    type: Number,
    required: true,
    min: [1, 'Match length must be at least 1'],
    max: [21, 'Match length cannot exceed 21']
  },
  timeControl: {
    type: String,
    enum: Object.values(GameSpeed),
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

const TournamentMatchSchema = new Schema<TournamentMatch>({
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
    enum: Object.values(MatchStatus),
    default: MatchStatus.SCHEDULED
  },
  scheduledTime: {
    type: Date,
    required: true
  }
});

const TournamentRoundSchema = new Schema<TournamentRound>({
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
    enum: Object.values(RoundStatus),
    default: RoundStatus.PENDING
  }
});

const TournamentParticipantSchema = new Schema<TournamentParticipant>({
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
    enum: Object.values(ParticipantStatus),
    default: ParticipantStatus.REGISTERED
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const tournamentSchema = new Schema<ITournamentDocument>({
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
    enum: Object.values(TournamentType),
    required: true
  },
  format: {
    type: String,
    enum: Object.values(TournamentFormat),
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
      validator: function(startTime: Date) {
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
    enum: Object.values(TournamentStatus),
    default: TournamentStatus.REGISTRATION
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
    transform: function(doc: any, ret: any) {
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
tournamentSchema.virtual('availableSlots').get(function(this: ITournamentDocument) {
  return this.maxPlayers - this.currentPlayers;
});

// Virtual for is full
tournamentSchema.virtual('isFull').get(function(this: ITournamentDocument) {
  return this.currentPlayers >= this.maxPlayers;
});

// Methods
tournamentSchema.methods.addParticipant = function(userId: string, username: string, rating: number) {
  if (this.currentPlayers >= this.maxPlayers) {
    throw new Error('Tournament is full');
  }

  if (this.status !== TournamentStatus.REGISTRATION) {
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
    status: ParticipantStatus.REGISTERED,
    joinedAt: new Date()
  });

  this.currentPlayers += 1;

  return this.save();
};

tournamentSchema.methods.removeParticipant = function(userId: string) {
  if (!this.isParticipant(userId)) {
    throw new Error('User is not registered for this tournament');
  }

  if (this.status !== TournamentStatus.REGISTRATION) {
    throw new Error('Cannot remove participant after tournament has started');
  }

  this.participants = this.participants.filter((p: TournamentParticipant) => p.userId !== userId);
  this.currentPlayers = Math.max(0, this.currentPlayers - 1);

  // Reassign seeds
  this.participants.forEach((participant: TournamentParticipant, index: number) => {
    participant.seed = index + 1;
  });

  return this.save();
};

tournamentSchema.methods.isParticipant = function(userId: string): boolean {
  return this.participants.some((p: TournamentParticipant) => p.userId === userId);
};

tournamentSchema.methods.getParticipant = function(userId: string): TournamentParticipant | null {
  const participant = this.participants.find((p: TournamentParticipant) => p.userId === userId);
  return participant || null;
};

tournamentSchema.methods.generateBracket = function() {
  if (this.status !== TournamentStatus.REGISTRATION) {
    throw new Error('Can only generate bracket during registration phase');
  }

  if (this.currentPlayers < 4) {
    throw new Error('Need at least 4 players to start tournament');
  }

  // Sort participants by rating for seeding
  const sortedParticipants = [...this.participants].sort((a: TournamentParticipant, b: TournamentParticipant) => b.rating - a.rating);
  
  // Reassign seeds based on rating
  sortedParticipants.forEach((participant: TournamentParticipant, index: number) => {
    participant.seed = index + 1;
  });

  this.participants = sortedParticipants;

  // Generate first round matches
  const firstRound = this.generateFirstRound();
  this.rounds.push(firstRound);

  this.status = TournamentStatus.IN_PROGRESS;
  
  return this.save();
};

tournamentSchema.methods.generateFirstRound = function(): TournamentRound {
  const matches: TournamentMatch[] = [];
  const participants = [...this.participants];

  // For elimination tournaments, pair highest seed with lowest seed
  if (this.type === TournamentType.SINGLE_ELIMINATION || this.type === TournamentType.DOUBLE_ELIMINATION) {
    for (let i = 0; i < participants.length / 2; i++) {
      const player1 = participants[i];
      const player2 = participants[participants.length - 1 - i];
      
      matches.push({
        id: `match_${Date.now()}_${i}`,
        player1: player1.userId,
        player2: player2.userId,
        gameId: undefined,
        winner: undefined,
        status: MatchStatus.SCHEDULED,
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
    status: RoundStatus.PENDING
  };
};

tournamentSchema.methods.advanceToNextRound = function() {
  const currentRound = this.rounds[this.rounds.length - 1];
  
  if (!currentRound) {
    throw new Error('No rounds available');
  }

  // Check if current round is complete
  const allMatchesComplete = currentRound.matches.every((match: TournamentMatch) => 
    match.status === MatchStatus.COMPLETED && match.winner
  );

  if (!allMatchesComplete) {
    throw new Error('Current round is not complete');
  }

  // Get winners for next round
  const winners = currentRound.matches.map((match: TournamentMatch) => match.winner).filter(Boolean);

  if (winners.length <= 1) {
    // Tournament is complete
    this.status = TournamentStatus.FINISHED;
    this.endTime = new Date();
    return this.save();
  }

  // Generate next round
  const nextRoundMatches: TournamentMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i + 1]) {
      nextRoundMatches.push({
        id: `match_${Date.now()}_${i / 2}`,
        player1: winners[i]!,
        player2: winners[i + 1]!,
        gameId: undefined,
        winner: undefined,
        status: MatchStatus.SCHEDULED,
        scheduledTime: new Date(Date.now() + (30 * 60 * 1000)) // 30 minutes from now
      });
    }
  }

  const nextRound: TournamentRound = {
    roundNumber: currentRound.roundNumber + 1,
    matches: nextRoundMatches,
    startTime: new Date(Date.now() + (30 * 60 * 1000)),
    endTime: undefined,
    status: RoundStatus.PENDING
  };

  this.rounds.push(nextRound);
  
  return this.save();
};

tournamentSchema.methods.isComplete = function(): boolean {
  return this.status === TournamentStatus.FINISHED;
};

// Pre-save middleware
tournamentSchema.pre('save', function(next) {
  // Update current players count
  this.currentPlayers = this.participants.length;
  
  // Calculate prize pool based on entry fees
  if (this.entryFee && this.entryFee > 0) {
    this.prizePool = this.entryFee * this.currentPlayers;
  }

  next();
});

export const TournamentModel = mongoose.model<ITournamentDocument>('Tournament', tournamentSchema);