import bcrypt from 'bcryptjs';
import mongoose, { Document, Schema } from 'mongoose';
import { GameSpeed, INITIAL_RATING } from '@playbg/shared';

export interface IUserDocument extends Document {
  username: string;
  email: string;
  password: string;
  avatar?: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
  isOnline: boolean;
  lastSeen: Date;
  bio?: string;
  country?: string;
  preferredGameSpeed: GameSpeed;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
}

const userSchema = new Schema<IUserDocument>({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [20, 'Username cannot exceed 20 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  avatar: {
    type: String,
    default: null
  },
  rating: {
    type: Number,
    default: INITIAL_RATING,
    min: [100, 'Rating cannot be below 100'],
    max: [3000, 'Rating cannot exceed 3000']
  },
  gamesPlayed: {
    type: Number,
    default: 0,
    min: [0, 'Games played cannot be negative']
  },
  gamesWon: {
    type: Number,
    default: 0,
    min: [0, 'Games won cannot be negative']
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  country: {
    type: String,
    maxlength: [50, 'Country name cannot exceed 50 characters']
  },
  preferredGameSpeed: {
    type: String,
    enum: Object.values(GameSpeed),
    default: GameSpeed.STANDARD
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc: any, ret: any) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes (username and email already have unique indexes from schema definition)
userSchema.index({ rating: -1 });
userSchema.index({ isOnline: 1 });

// Virtual for win rate
userSchema.virtual('winRate').get(function(this: IUserDocument) {
  return this.gamesPlayed > 0 ? (this.gamesWon / this.gamesPlayed) * 100 : 0;
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate auth token
userSchema.methods.generateAuthToken = function(): string {
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { userId: this._id, username: this.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
  return token;
};

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email: string, password: string) {
  const user = await this.findOne({ email }).select('+password');
  if (!user) {
    throw new Error('Invalid login credentials');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid login credentials');
  }

  return user;
};

export const User = mongoose.model<IUserDocument>('User', userSchema);
