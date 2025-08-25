import mongoose, { Document } from 'mongoose';
import { TournamentMatch, GameResult } from '@playbg/shared';
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
        score: string;
        gameResult: GameResult;
        duration: number;
        completedAt: Date;
    };
    startMatch(gameId: string): Promise<IMatchDocument>;
    completeMatch(winnerId: string, score: string, duration: number): Promise<IMatchDocument>;
    forfeitMatch(forfeitingUserId: string): Promise<IMatchDocument>;
    isParticipant(userId: string): boolean;
    getOpponent(userId: string): string | null;
}
export declare const MatchModel: mongoose.Model<IMatchDocument, {}, {}, {}, mongoose.Document<unknown, {}, IMatchDocument, {}, {}> & IMatchDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Match.d.ts.map