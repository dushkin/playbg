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
    preferredGameSpeed: GameSpeed;
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
export interface Game {
    id: string;
    players: [Player, Player];
    board: BoardState;
    currentPlayer: 0 | 1;
    dice: [number, number] | null;
    gameState: GameState;
    gameType: GameType;
    gameSpeed: GameSpeed;
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
    points: number[][];
    bar: [number, number];
    off: [number, number];
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
export declare enum GameState {
    WAITING = "waiting",
    IN_PROGRESS = "in_progress",
    FINISHED = "finished",
    PAUSED = "paused",
    ABANDONED = "abandoned"
}
export declare enum GameType {
    CASUAL = "casual",
    RANKED = "ranked",
    TOURNAMENT = "tournament",
    PRIVATE = "private"
}
export declare enum GameSpeed {
    BLITZ = "blitz",// 3 minutes per player
    RAPID = "rapid",// 10 minutes per player
    STANDARD = "standard",// 30 minutes per player
    UNLIMITED = "unlimited"
}
export declare enum GameResult {
    WIN = "win",
    LOSS = "loss",
    DRAW = "draw",
    ABANDONED = "abandoned"
}
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
export declare enum TournamentType {
    SINGLE_ELIMINATION = "single_elimination",
    DOUBLE_ELIMINATION = "double_elimination",
    ROUND_ROBIN = "round_robin",
    SWISS = "swiss"
}
export declare enum TournamentFormat {
    MATCH_PLAY = "match_play",
    MONEY_GAME = "money_game"
}
export declare enum TournamentStatus {
    REGISTRATION = "registration",
    IN_PROGRESS = "in_progress",
    FINISHED = "finished",
    CANCELLED = "cancelled"
}
export declare enum ParticipantStatus {
    REGISTERED = "registered",
    ACTIVE = "active",
    ELIMINATED = "eliminated",
    WITHDRAWN = "withdrawn"
}
export declare enum RoundStatus {
    PENDING = "pending",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed"
}
export declare enum MatchStatus {
    SCHEDULED = "scheduled",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    WALKOVER = "walkover"
}
export interface TournamentRules {
    matchLength: number;
    timeControl: GameSpeed;
    doubleAllowed: boolean;
    crawfordRule: boolean;
}
export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: AchievementCategory;
    requirement: AchievementRequirement;
    unlockedAt?: Date;
}
export declare enum AchievementCategory {
    GAMES = "games",
    WINS = "wins",
    RATING = "rating",
    TOURNAMENTS = "tournaments",
    SOCIAL = "social",
    SPECIAL = "special"
}
export interface AchievementRequirement {
    type: 'games_played' | 'games_won' | 'rating_reached' | 'tournaments_won' | 'win_streak';
    value: number;
}
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
export interface SocketEvents {
    'game:join': {
        gameId: string;
    };
    'game:leave': {
        gameId: string;
    };
    'game:move': {
        gameId: string;
        move: GameMove;
    };
    'game:dice_roll': {
        gameId: string;
        dice: [number, number];
    };
    'game:chat': {
        gameId: string;
        message: string;
    };
    'game:offer_double': {
        gameId: string;
    };
    'game:accept_double': {
        gameId: string;
    };
    'game:decline_double': {
        gameId: string;
    };
    'game:resign': {
        gameId: string;
    };
    'matchmaking:join': {
        gameType: GameType;
        gameSpeed: GameSpeed;
    };
    'matchmaking:leave': {};
    'matchmaking:match_found': {
        gameId: string;
        opponent: Player;
    };
    'user:online': {
        userId: string;
    };
    'user:offline': {
        userId: string;
    };
    'user:typing': {
        gameId: string;
        userId: string;
    };
    'tournament:join': {
        tournamentId: string;
    };
    'tournament:leave': {
        tournamentId: string;
    };
    'tournament:start': {
        tournamentId: string;
    };
    'tournament:round_start': {
        tournamentId: string;
        roundNumber: number;
    };
    'tournament:match_ready': {
        tournamentId: string;
        matchId: string;
    };
}
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
export declare const INITIAL_BOARD_STATE: BoardState;
export declare const INITIAL_RATING = 1200;
export declare const MIN_RATING = 100;
export declare const MAX_RATING = 3000;
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
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
//# sourceMappingURL=index.d.ts.map