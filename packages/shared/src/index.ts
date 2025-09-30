// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: Date;
  updatedAt: Date;
  isOnline: boolean;
  lastSeen: Date;
}

export interface UserProfile extends User {
  bio?: string;
  country?: string;
  preferredGameSpeed: GamePeriod;
  achievements: Achievement[];
  statistics: UserStatistics;
}

export interface UserStatistics {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  averageGameDuration: number;
  longestWinStreak: number;
  currentWinStreak: number;
  ratingHistory: RatingHistoryEntry[];
}

export interface RatingHistoryEntry {
  rating: number;
  date: Date;
  gameId: string;
  opponent: string;
  result: GameResult;
}

// Game Types
export interface Game {
  id: string;
  players: [Player, Player];
  board: BoardState;
  currentPlayer: 0 | 1;
  dice: [number, number] | null;
  gameState: GameState;
  gameType: GameType;
  gamePeriod: GamePeriod;
  stepPeriod?: StepPeriod; // Only used when gamePeriod is UNLIMITED
  startTime: Date;
  endTime?: Date;
  winner?: string;
  moves: GameMove[];
  spectators: string[];
  chatMessages: ChatMessage[];
}

export interface Player {
  userId: string;
  username: string;
  rating: number;
  color: 'white' | 'black';
  timeRemaining?: number;
  isReady: boolean;
}

export interface BoardState {
  points: number[][]; // 24 points, each containing checkers for each player
  bar: [number, number]; // checkers on the bar for each player
  off: [number, number]; // checkers borne off for each player
}

export interface GameMove {
  playerId: string;
  from: number;
  to: number;
  timestamp: Date;
  dice?: [number, number];
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'chat' | 'system' | 'game';
}

// Enums
export enum GameState {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  PAUSED = 'paused',
  ABANDONED = 'abandoned'
}

export enum GameType {
  NOT_RANKED = 'not_ranked',
  RANKED = 'ranked'
}

export enum GamePeriod {
  THREE_MINUTES = '3min',     // 3 minutes per match
  TEN_MINUTES = '10min',      // 10 minutes per match
  THIRTY_MINUTES = '30min',   // 30 minutes per match
  UNLIMITED = 'unlimited'     // Unlimited time for a match.
}

export enum StepPeriod {
  TEN_SECONDS = '10s',
  THIRTY_SECONDS = '30s',
  ONE_MINUTE = '1m',
  THREE_MINUTES = '3m',
  TEN_MINUTES = '10m',
  ONE_HOUR = '1h',
  THREE_HOURS = '3h',
  ONE_DAY = '1d',
  THREE_DAYS = '3d',
  FIVE_DAYS = '5d',
  SEVEN_DAYS = '7d',
  TEN_DAYS = '10d',
  UNLIMITED = 'unlimited'
}

export enum GameResult {
  WIN = 'win',
  LOSS = 'loss',
  DRAW = 'draw',
  ABANDONED = 'abandoned'
}

// Tournament Types
export interface Tournament {
  id: string;
  name: string;
  description: string;
  type: TournamentType;
  format: TournamentFormat;
  maxPlayers: number;
  currentPlayers: number;
  entryFee?: number;
  prizePool?: number;
  startTime: Date;
  endTime?: Date;
  status: TournamentStatus;
  rounds: TournamentRound[];
  participants: TournamentParticipant[];
  organizer: string;
  rules: TournamentRules;
}

export interface TournamentParticipant {
  userId: string;
  username: string;
  rating: number;
  seed: number;
  status: ParticipantStatus;
  joinedAt: Date;
}

export interface TournamentRound {
  roundNumber: number;
  matches: TournamentMatch[];
  startTime: Date;
  endTime?: Date;
  status: RoundStatus;
}

export interface TournamentMatch {
  id: string;
  player1: string;
  player2: string;
  gameId?: string;
  winner?: string;
  status: MatchStatus;
  scheduledTime: Date;
}

export enum TournamentType {
  SINGLE_ELIMINATION = 'single_elimination',
  DOUBLE_ELIMINATION = 'double_elimination',
  ROUND_ROBIN = 'round_robin',
  SWISS = 'swiss'
}

export enum TournamentFormat {
  MATCH_PLAY = 'match_play',
  MONEY_GAME = 'money_game'
}

export enum TournamentStatus {
  REGISTRATION = 'registration',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished',
  CANCELLED = 'cancelled'
}

export enum ParticipantStatus {
  REGISTERED = 'registered',
  ACTIVE = 'active',
  ELIMINATED = 'eliminated',
  WITHDRAWN = 'withdrawn'
}

export enum RoundStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  WALKOVER = 'walkover'
}

export interface TournamentRules {
  matchLength: number;
  timeControl: GamePeriod;
  doubleAllowed: boolean;
  crawfordRule: boolean;
}

// Achievement Types
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  requirement: AchievementRequirement;
  unlockedAt?: Date;
}

export enum AchievementCategory {
  GAMES = 'games',
  WINS = 'wins',
  RATING = 'rating',
  TOURNAMENTS = 'tournaments',
  SOCIAL = 'social',
  SPECIAL = 'special'
}

export interface AchievementRequirement {
  type: 'games_played' | 'games_won' | 'rating_reached' | 'tournaments_won' | 'win_streak';
  value: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket Event Types
export interface SocketEvents {
  // Game Events
  'game:join': { gameId: string };
  'game:leave': { gameId: string };
  'game:move': { gameId: string; move: GameMove };
  'game:dice_roll': { gameId: string; dice: [number, number] };
  'game:chat': { gameId: string; message: string };
  'game:completed': { gameId: string; winner: string };
  'game:offer_double': { gameId: string };
  'game:accept_double': { gameId: string };
  'game:decline_double': { gameId: string };
  'game:resign': { gameId: string };
  
  // Matchmaking Events
  'matchmaking:join': { gameType: GameType; gamePeriod: GamePeriod };
  'matchmaking:leave': {};
  'matchmaking:match_found': { gameId: string; opponent: Player };
  
  // User Events
  'user:online': { userId: string };
  'user:offline': { userId: string };
  'user:typing': { gameId: string; userId: string };
  
  // Tournament Events
  'tournament:join': { tournamentId: string };
  'tournament:leave': { tournamentId: string };
  'tournament:start': { tournamentId: string };
  'tournament:round_start': { tournamentId: string; roundNumber: number };
  'tournament:match_ready': { tournamentId: string; matchId: string };
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// Game Logic Constants
// Board layout: Both players move from top-right (point 23) towards bottom-right (point 0)
// Both players start in the top half of the board and move downward
// Player 0 (white) starts at points 23(2), 12(5), 16(3), 18(5) - total 15 checkers
// Player 1 (black) starts at points 22(2), 13(5), 17(3), 19(5) - total 15 checkers
export const INITIAL_BOARD_STATE: BoardState = {
  points: [
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],  // Points 0-5: Empty (bearing off zone)
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0],  // Points 6-11: Empty (middle zone)
    [5, 0], [0, 5], [0, 0], [0, 0], [3, 0], [0, 3],  // Points 12-17: P0 at 12(5),16(3) | P1 at 13(5),17(3)
    [5, 0], [0, 5], [0, 0], [0, 0], [0, 2], [2, 0]   // Points 18-23: P0 at 18(5),23(2) | P1 at 19(5),22(2)
  ],
  bar: [0, 0],
  off: [0, 0]
};

export const INITIAL_RATING = 1200;
export const MIN_RATING = 100;
export const MAX_RATING = 3000;

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  validationErrors?: ValidationError[];
}
